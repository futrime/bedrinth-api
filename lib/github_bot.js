'use strict'

import{consola} from 'consola';
import {Octokit} from 'octokit';
import {createToothMetadataFromJsonString} from './tooth_metadata.js';
import {createVersionFromString} from './version.js';
import sequelize from 'sequelize';
import moment from 'moment';


/**
 * A GitHub Bot fetches all available tooth repos from GitHub
 * and extracts their metadata, then stores them in the database.
 */
export class GitHubBot {
  /**
   * @param {import('sequelize').Model} toothModel The tooth model.
   * @param {number} interval The interval in seconds between each run.
   * @param {number} expire The number of seconds before a tooth repo is
   *    considered stale.
   * @param {string} authToken The GitHub auth token.
   */
  constructor(toothModel, interval, expire, authToken) {
    /** @type {import('sequelize').Model} */ this.toothModel_ = toothModel;
    /** @type {number} */ this.interval_ = interval;
    /** @type {number} */ this.expire_ = expire;

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
      throw new Error('GitHub bot is running.');
    }

    this.timeoutHandler_ =
        setInterval(this.runAllJobs_.bind(this), this.interval_ * 1000);

    // Run all jobs immediately.
    this.runAllJobs_();
  }

  /**
   * Stops the bot.
   */
  async stop() {
    if (!this.timeoutHandler_) {
      throw new Error('GitHub bot is not running.');
    }

    clearInterval(this.timeoutHandler_);
    this.timeoutHandler_ = null;
  }

  async removeStaleDatabaseEntriesJob_() {
    consola.log('[GitHub Bot] Removing stale database entries...');

    await this.toothModel_.destroy({
      where: {
        updatedAt: {
          [sequelize.Op.lt]:
              moment().subtract(this.expire_, 'seconds').toDate(),
        },
      },
    });

    consola.log('[GitHub Bot] Removed stale database entries.');
  }

  async fetchAndSaveToothInfoJob_() {
    consola.log('[GitHub Bot] Fetching tooth information...');

    let isLastPage = false;
    let page = 1;
    while (isLastPage === false) {
      let response = null;
      try {
        consola.debug(
            `[GitHub Bot] Octokit_.rest.search.code({q: 'path:/+filename:tooth.json+format_version+tooth+info', per_page: 100, page: ${
                page}})`);
        response = await this.octokit_.rest.search.code({
          q: 'path:/+filename:tooth.json+format_version+tooth+info',
          per_page: 100,
          page,
        });

      } catch (err) {
        throw new Error(`failed to search GitHub for teeth: ${err.message}`);
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
          consola.error(`[GitHub Bot] Failed to fetch tooth metadata of ${
              owner}/${repo}: ${err.message}`);
          continue;
        }

        // Fetch version list.
        let versionStringList = null;
        try {
          versionStringList = await fetchVersionStringList(owner, repo);
        } catch (err) {
          consola.error(`[GitHub Bot] Failed to fetch version list of ${
              owner}/${repo}: ${err.message}`);
          continue;
        }

        await this.toothModel_.upsert({
          toothRepoPath: toothMetadata.getToothPath(),
          name: toothMetadata.getName(),
          description: toothMetadata.getDescription(),
          author: toothMetadata.getAuthor(),
          tags: toothMetadata.getTags(),
          versions: versionStringList,
        });
      }

      page++;
    }

    consola.debug('[GitHub Bot] Fetched tooth information.');
  }

  /**
   * Runs all jobs.
   */
  async runAllJobs_() {
    try {
      await this.fetchAndSaveToothInfoJob_();
    } catch (err) {
      consola.error(`[GitHub Bot] Failed to fetch and save tooth information: ${
          err.message}`);
    }

    try {
      await this.removeStaleDatabaseEntriesJob_();
    } catch (err) {
      consola.error(`[GitHub Bot] Failed to remove stale database entries: ${
          err.message}`);
    }
  }
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

  consola.debug(`[GitHub Bot] fetch('${toothJsonUrl}')`);
  const response = await fetch(toothJsonUrl);
  if (!response.ok) {
    throw new Error(
        `failed to fetch ${toothJsonUrl}: ${await response.text()}`);
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

  consola.debug(`[GitHub Bot] fetch('${versionListUrl}')`);
  const response = await fetch(versionListUrl);
  if (!response.ok) {
    throw new Error(
        `failed to fetch ${versionListUrl}: ${await response.text()}`);
  }

  const goTagList = (await response.text())
                        .split('\n')
                        .slice(0, -1);  // Remove the last empty line.

  // Remove prefix 'v' and suffix '+incompatible'.
  const versionList = goTagList.map((tag) => {
    return tag.replace(/^v/, '').replace(/\+incompatible$/, '');
  });

  // Remove versions that are not valid.
  const validVersionList = [];
  for (const version of versionList) {
    try {
      createVersionFromString(version);
      validVersionList.push(version);
    } catch (err) {
      consola.error(
          `[GitHub Bot] Found invalid version of ${owner}/${repo}: ${version}`);
    }
  }

  return validVersionList;
}
