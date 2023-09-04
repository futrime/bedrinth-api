'use strict'

import{consola} from 'consola';

/**
 * @typedef {import('express').Request} express.Request
 * @typedef {import('express').Response} express.Response
 */

const TOOTH_PATH_REGEXP = /^github.com\/(?<owner>\S+)\/(?<repo>\S+)$/;

/**
 * Controller for the GET /:tooth/:version route.
 *
 * @param {express.Request} req The request object.
 * @param {express.Response} res The response object.
 */
export async function getToothController(req, res) {
  try {
    // Parse and validate the tooth and version parameters.
    const {tooth: toothParam, version: versionParam} = req.params;

    if (toothParam === undefined || versionParam === undefined) {
      res.status(400).send({
        code: 400,
        message: 'Missing tooth or version parameter.',
      });
      return;
    }

    const toothPathMatch = TOOTH_PATH_REGEXP.exec(toothParam);
    if (toothPathMatch === null) {
      res.status(400).send({
        code: 400,
        message: 'Invalid tooth parameter.',
      });
      return;
    }

    const {owner, repo} = toothPathMatch.groups;

    // Fetch /tooth.json and /README.md from GitHub.
    const toothJsonUrl = `https://raw.githubusercontent.com/${owner}/${repo}/v${
        versionParam}/tooth.json`;
    const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/v${
        versionParam}/README.md`;

    const [toothJsonResponse, readmeResponse] = await Promise.all([
      fetch(toothJsonUrl),
      fetch(readmeUrl),
    ]);

    if (!toothJsonResponse.ok) {
      res.status(404).send({
        code: 404,
        message: 'Tooth not found.',
      });
      return;
    }
    const toothJson = await toothJsonResponse.json();

    const readme = readmeResponse.ok ? await readmeResponse.text() : '';

    // Construct the response.
    res.send({
      code: 200,
      data: {
        tooth: toothJson.tooth,
        version: toothJson.version,
        name: toothJson.information.name,
        description: toothJson.information.description,
        author: toothJson.information.author,
        available_versions: [],
        readme: readme,
        tags: [],
        dependencies: {}
      }
    });

  } catch (error) {
    consola.error(error);
    res.status(500).send({
      code: 500,
      message: 'Internal server error.',
    });
  }
}
