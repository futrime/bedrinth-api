'use strict'

import{consola} from 'consola';
import moment from 'moment';
import {Octokit} from 'octokit';
import sequelize from 'sequelize';
import {createToothMetadataFromJsonString} from './tooth_metadata.js';
import {createVersionFromString, getLatestVersionFromVersionList} from './version.js';

const GITHUB_SEARCH_QUERY_STRING = 'path:/+filename:tooth.json+"format_version":+2+"tooth":+"version"+"info":+"name":+"description":+"author":+"tags":';

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
      throw new Error('GitHub bot is running');
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
      throw new Error('GitHub bot is not running');
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
            `[GitHub Bot] Octokit_.rest.search.code({q: '${GITHUB_SEARCH_QUERY_STRING}', per_page: 100, page: ${
                page}})`);
        response = await this.octokit_.rest.search.code({
          q: GITHUB_SEARCH_QUERY_STRING,
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

        this.fetchAndSaveToothInfoSubJob_(owner, repo);
      }

      page++;
    }

    consola.log('[GitHub Bot] Fetched tooth information.');
  }

  async fetchAndSaveToothInfoSubJob_(owner, repo) {
    // Fetch tooth metadata.
    let toothMetadata = null;
    try {
      toothMetadata = await fetchToothMetadata(owner, repo);
    } catch (err) {
      consola.debug(`[GitHub Bot] Failed to fetch tooth metadata of ${owner}/${
          repo}: ${err.message}`);
      return;
    }

    // Fetch version list.
    let versionList = null;
    try {
      versionList = await fetchVersionList(owner, repo);
    } catch (err) {
      consola.debug(`[GitHub Bot] Failed to fetch version list of ${owner}/${
          repo}: ${err.message}`);
      return;
    }

    if (versionList.length === 0) {
      consola.debug(`[GitHub Bot] ${owner}/${repo} has no valid version`);
      return;
    }

    const versionInfoList = [];
    try {
      for (const version of versionList) {
        versionInfoList.push({
          version: version.toString(),
          releaseTime: Math.round(
              (await fetchReleaseTime(owner, repo, version)).getTime() / 1000),
        });
      }
    } catch (err) {
      consola.debug(`[GitHub Bot] Failed to fetch version info of ${owner}/${
          repo}: ${err.message}`);
      return;
    }

    const latestVersion = getLatestVersionFromVersionList(versionList);
    const latestVersionReleaseTime =
        versionInfoList
            .find((versionInfo) => {
              return versionInfo.version === latestVersion.toString();
            })
            .releaseTime;


    await this.toothModel_.upsert({
      toothRepoPath: toothMetadata.getToothPath(),
      toothRepoOwner: owner,
      toothRepoName: repo,
      name: toothMetadata.getName(),
      description: toothMetadata.getDescription(),
      author: toothMetadata.getAuthor(),
      tags: toothMetadata.getTags(),
      versions: versionInfoList,
      latestVersion: latestVersion.toString(),
      latestVersionReleaseTime: latestVersionReleaseTime,
    });
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
 * Fetches the release time of the given version from the given owner and repo.
 * @param {string} owner The owner of the tooth.
 * @param {string} repo The name of the tooth.
 * @param {import('./version.js').Version} version The version.
 * @return {Promise<Date>} The release time.
 */
async function fetchReleaseTime(owner, repo, version) {
  owner = owner.toLowerCase();
  repo = repo.toLowerCase();

  const /** @type {string} */ url = `https://goproxy.io/github.com/${owner}/${
      repo}/@v/v${version.toString()}${
      version.getMajor() > 1 ? '+incompatible' : ''}.info`;

  consola.debug(`[GitHub Bot] fetch('${url}')`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${await response.text()}`);
  }

  const info = await response.json();
  const dateTimeString = info.Time;

  return new Date(dateTimeString);
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
 * @return {Promise<Array<import('./version.js').Version>>} The list of
 *     available versions.
 */
async function fetchVersionList(owner, repo) {
  // To lower case because goproxy.io only accepts lower case owner and repo.
  owner = owner.toLowerCase();
  repo = repo.toLowerCase();

  const url = `https://goproxy.io/github.com/${owner}/${repo}/@v/list`;

  consola.debug(`[GitHub Bot] fetch('${url}')`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${await response.text()}`);
  }

  const goTagList = (await response.text())
                        .split('\n')
                        .slice(0, -1);  // Remove the last empty line.

  // Remove prefix 'v' and suffix '+incompatible'.
  const versionStringList = goTagList.map((tag) => {
    return tag.replace(/^v/, '').replace(/\+incompatible$/, '');
  });

  // Remove versions that are not valid.
  const /** @type {import('./version.js').Version[]} */ validVersionList = [];
  for (const versionString of versionStringList) {
    try {
      const version = createVersionFromString(versionString);

      validVersionList.push(version);
    } catch (err) {
      consola.debug(`[GitHub Bot] Found invalid version of ${owner}/${repo}: ${
          versionString}`);
    }
  }

  return validVersionList;
}
