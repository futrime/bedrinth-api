'use strict'

import{consola} from 'consola';
import httpErrors from 'http-errors';
import {Octokit} from 'octokit';
import {createToothMetadataFromJsonString} from './tooth_metadata.js';
import {createVersionFromString} from './version.js';


/**
 * A GitHub Bot fetches all available tooth repos from GitHub
 * and extracts their metadata, then stores them in the database.
 */
export class GitHubBot {
  /**
   * @param {import('sequelize').Model} toothModel The tooth model.
   * @param {number} interval The interval in milliseconds between each run.
   * @param {string} authToken The GitHub auth token.
   */
  constructor(toothModel, interval, authToken) {
    /** @type {import('sequelize').Model} */ this.toothModel_ = toothModel;
    /** @type {number} */ this.interval_ = interval;

    /** @type {Octokit} */ this.octokit_ = new Octokit({
      auth: authToken,
    });
    /** @type {NodeJS.Timeout|null} */ this.timeoutHandler_ = null;
  }

  /**
   * Starts the bot.
   */
  async start() {
    if (this.timeoutHandler_) {
      throw new Error('Bot already started.');
    }

    this.timeoutHandler_ =
        setInterval(this.runAllJobs_.bind(this), this.interval_);

    // Run all jobs immediately.
    this.runAllJobs_();
  }

  /**
   * Stops the bot.
   */
  async stop() {
    if (!this.timeoutHandler_) {
      throw new Error('Bot not started.');
    }

    clearInterval(this.timeoutHandler_);
    this.timeoutHandler_ = null;
  }

  /**
   * Runs all jobs.
   */
  async runAllJobs_() {
    try {
      consola.log('GitHub Bot starts running all jobs...');

      await this.fetchToothRepos_();

      consola.log('GitHub Bot finished running all jobs.');

    } catch (err) {
      consola.error(`Failed to run all jobs: ${err.message}`);
    }
  }

  async fetchToothRepos_() {
    let isLastPage = false;
    let page = 1;
    while (isLastPage === false) {
      let response = null;
      try {
        response = await this.octokit_.rest.search.code({
          q: 'path:/+filename:tooth.json+format_version+tooth+info',
          per_page: 100,
          page,
        })
        consola.debug(`octokit.rest.search.code: ${response.status}`);

      } catch (err) {
        throw new Error(`Failed to fetch tooth repos: ${err.message}`);
      }

      isLastPage = !response.data.incomplete_results;

      for (const item of response.data.items) {
        const owner = item.repository.owner.login;
        const repo = item.repository.name;

        // Fetch tooth metadata.
        let toothMetadata = null;
        try {
          toothMetadata = await fetchToothMetadata(owner, repo);
        } catch (err) {
          consola.error(`Failed to fetch tooth metadata: ${err.message}`);
          continue;
        }

        // Fetch latest version.
        let latestVersion = null;
        try {
          latestVersion = await fetchLatestVersion(owner, repo);
        } catch (err) {
          consola.error(`Failed to fetch latest version: ${err.message}`);
          continue;
        }

        await this.toothModel_.upsert({
          tooth: toothMetadata.getToothPath(),
          name: toothMetadata.getName(),
          description: toothMetadata.getDescription(),
          author: toothMetadata.getAuthor(),
          latestVersion: latestVersion.toString(),
          tags: toothMetadata.getTags(),
        });
      }

      page++;
    }
  }
}

/**
 * Fetches the latest version from the given owner and repo.
 * @param {string} owner The owner of the tooth.
 * @param {string} repo The name of the tooth.
 * @return {Promise<import('./version.js').Version>} The latest version.
 */
async function fetchLatestVersion(owner, repo) {
  const versionList = await fetchVersionStringList(owner, repo);

  if (versionList.length === 0) {
    throw new Error('No version found.');
  }

  // The last stable version is the latest version.
  let /** @type {import('./version.js').Version|null} */ latestVersion = null;
  for (const versionString of versionList) {
    const version = createVersionFromString(versionString);
    if (version.isStable() &&
        (latestVersion === null || version.isGreaterThan(latestVersion))) {
      latestVersion = version;
    }
  }

  if (latestVersion === null) {
    latestVersion =
        createVersionFromString(versionList[versionList.length - 1]);
  }

  return latestVersion;
}

/**
 * Fetches the tooth.json file from the given owner and repo. Then converts
 * it to a ToothMetadata object.
 * @param {string} owner The owner of the tooth.
 * @param {string} repo The name of the tooth.
 * @return {Promise<import('./tooth_metadata.js').ToothMetadata>} The
 *     tooth metadata.
 */
async function fetchToothMetadata(owner, repo) {
  const toothJsonUrl =
      `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/tooth.json`;

  const response = await fetch(toothJsonUrl);
  consola.debug(
      `fetch(${toothJsonUrl}) ${response.status} ${response.statusText}`);
  if (!response.ok) {
    throw httpErrors(
        response.status,
        `Failed to fetch tooth.json: ${await response.text()}`);
  }

  const toothMetadata =
      createToothMetadataFromJsonString(await response.text());

  return toothMetadata;
}

/**
 * Fetches the list of available versions from the given owner and repo.
 * @param {string} owner The owner of the tooth.
 * @param {string} repo The name of the tooth.
 * @return {Promise<Array<string>>} The list of available versions.
 */
async function fetchVersionStringList(owner, repo) {
  // To lower case because goproxy.io only accepts lower case owner and repo.
  owner = owner.toLowerCase();
  repo = repo.toLowerCase();

  const versionListUrl =
      `https://goproxy.io/github.com/${owner}/${repo}/@v/list`;

  const response = await fetch(versionListUrl);
  consola.debug(
      `fetch(${versionListUrl}) ${response.status} ${response.statusText}`);
  if (!response.ok) {
    throw httpErrors(
        response.status,
        `Failed to fetch version list: ${await response.text()}`);
  }

  const goTagList = (await response.text())
                        .split('\n')
                        .slice(0, -1);  // Remove the last empty line.

  // Remove prefix 'v' and suffix '+incompatible'.
  const versionList = goTagList.map((tag) => {
    return tag.replace(/^v/, '').replace(/\+incompatible$/, '');
  });

  return versionList;
}
