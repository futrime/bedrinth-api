'use strict'

import{consola} from 'consola';
import * as express from 'express';
import httpErrors from 'http-errors';
import {isValidVersionString, createVersionFromString} from '../lib/version.js';
import sequelize from 'sequelize';


export const router = express.Router();

router.get('/:owner/:repo/:version', async (req, res) => {
  try {
    // No need to check if owner, repo and version is undefined because
    // express will return 404 if the route doesn't match.

    const /** @type {string} */ ownerParam = req.params.owner;
    const /** @type {string} */ repoParam = req.params.repo;

    const /** @type {sequelize.Model} */ toothModel = req.context.toothModel;
    const item = await toothModel.findOne({
      where: {
        [sequelize.Op.and]: [
          {
            toothRepoOwner: {
              [sequelize.Op.iLike]: ownerParam,
            },
          },
          {
            toothRepoName: {
              [sequelize.Op.iLike]: repoParam,
            },
          },
        ],
      }
    });

    if (item === null) {
      throw new httpErrors.NotFound(
          `tooth '${ownerParam}/${repoParam}' not found`);
    }

    const /** @type {import('../lib/version.js').Version[]} */ versionList =
        item.versions.map((x) => createVersionFromString(x.version));

    let versionParam = req.params.version;
    if (versionParam === 'latest') {
      versionParam = item.latestVersion;
    }

    if (!isValidVersionString(versionParam)) {
      throw new httpErrors.BadRequest(`invalid parameter 'version'`);
    }

    // Check if version exists.
    if (!versionList.map((version) => version.toString())
             .includes(versionParam)) {
      throw new httpErrors.NotFound(`version '${
          versionParam}' not found for tooth '${ownerParam}/${repoParam}'`);
    }

    // Construct the response.
    res.send({
      apiVersion: '1',
      data: {
        toothRepoPath: item.toothRepoPath,
        toothRepoOwner: item.toothRepoOwner,
        toothRepoName: item.toothRepoName,
        version: versionParam,
        releaseTime:
            item.versions.find((x) => x.version === versionParam).releaseTime,
        versions: item.versions,
        downloadCount: 0, // TODO: implement download count.
      },
    });
  } catch (error) {
    if (httpErrors.isHttpError(error)) {
      res.status(error.statusCode).send({
        apiVersion: '1',
        error: {
          code: error.statusCode,
          message: `Error: ${error.message}`,
        },
      });

    } else {
      consola.error(`[/teeth] ${error.message}`);

      res.status(500).send({
        apiVersion: '1',
        error: {
          code: 500,
          message: 'Internal Server Error',
        },
      });
    }
  }
});
