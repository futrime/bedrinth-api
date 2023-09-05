'use strict'

import{consola} from 'consola';
import * as express from 'express';
import httpErrors from 'http-errors';
import {isValidVersionString} from '../lib/version.js';
import {createToothMetadataFromJsonString} from '../lib/tooth_metadata.js';


/**
 * The regular expression for matching the tooth path.
 * @type {RegExp}
 * @const
 */
const TOOTH_PATH_REGEXP =
    /^github.com\/(?<owner>[a-zA-Z0-9-]+)\/(?<repo>[a-zA-Z0-9-_.]+)$/;

export const router = express.Router();

router.get('/:tooth/:version', async (req, res) => {
  try {
    const toothParam = req.params.tooth;
    const versionParam = req.params.version;

    // No need to check if toothParam and versionParam is undefined because
    // express will return 404 if the route doesn't match.

    // Validate toothParam.
    const toothPathMatch = TOOTH_PATH_REGEXP.exec(toothParam);
    if (toothPathMatch === null) {
      throw new httpErrors.BadRequest('Invalid parameter - tooth.');
    }

    // Validate versionParam.
    if (!isValidVersionString(versionParam)) {
      throw new httpErrors.BadRequest('Invalid parameter - version.');
    }

    const ownerParam = toothPathMatch.groups.owner;
    const repoParam = toothPathMatch.groups.repo;

    const [toothMetadata, readme, versionList] = await Promise.all([
      fetchToothMetadata(ownerParam, repoParam, versionParam),
      fetchReadme(ownerParam, repoParam, versionParam),
      fetchVersionList(ownerParam, repoParam),
    ]);

    // Construct the response.
    res.send({
      code: 200,
      data: {
        tooth: toothMetadata.getToothPath(),
        version: toothMetadata.getVersion().toString(),
        name: toothMetadata.getName(),
        description: toothMetadata.getDescription(),
        author: toothMetadata.getAuthor(),
        available_versions: versionList,
        readme: readme,
        tags: toothMetadata.getTags(),
        dependencies: toothMetadata.getDependencies(),
      }
    });

  } catch (error) {
    if (httpErrors.isHttpError(error)) {
      res.status(error.statusCode).send({
        code: error.statusCode,
        message: error.message,
      });
      return;

    } else {
      consola.error(error);
      res.status(500).send({
        code: 500,
        message: 'Internal server error.',
      });
      return;
    }
  }
});

/**
 * Fetches the README.md file from the given owner and repo.
 * @param {string} owner The owner of the tooth.
 * @param {string} repo The name of the tooth.
 * @param {string} versionString The version string.
 * @return {Promise<string>} The README.md file.
 */
async function fetchReadme(owner, repo, versionString) {
  const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/v${
      versionString}/README.md`;

  const response = await fetch(readmeUrl);
  if (response.status === 404) {
    return '';

  } else if (!response.ok) {
    if (response.status === 404) {
      return '';
    }

    throw httpErrors(
        response.status, `Failed to fetch README.md: ${await response.text()}`);

  } else {
    return await response.text();
  }
}

/**
 * Fetches the tooth.json file from the given owner and repo. Then converts it
 * to a ToothMetadata object.
 * @param {string} owner The owner of the tooth.
 * @param {string} repo The name of the tooth.
 * @param {string} versionString The version string.
 * @return {Promise<ToothMetadata>} The tooth metadata.
 */
async function fetchToothMetadata(owner, repo, versionString) {
  const toothJsonUrl = `https://raw.githubusercontent.com/${owner}/${repo}/v${
      versionString}/tooth.json`;

  const response = await fetch(toothJsonUrl);
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
async function fetchVersionList(owner, repo) {
  const versionListUrl =
      `https://goproxy.io/github.com/${owner}/${repo}/@v/list`;

  const response = await fetch(versionListUrl);
  if (!response.ok) {
    throw httpErrors(
        response.status,
        `Failed to fetch version list: ${await response.text()}`);
  }

  const goTagList = (await response.text()).split('\n');

  // Remove prefix 'v' and suffix '+incompatible'.
  const versionList = goTagList.map((tag) => {
    return tag.replace(/^v/, '').replace(/\+incompatible$/, '');
  });

  return versionList;
}
