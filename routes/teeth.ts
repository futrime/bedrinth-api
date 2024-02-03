import assert from 'assert';
import express from 'express';
import createHttpError from 'http-errors';
import {SemVer} from 'semver';

import {createToothVersionModel} from '../models/tooth_version.js';

export const router = express.Router();

router.get(
    '/:owner/:repo/:version',
    (async (req, res, next) => {
      try {
        const owner = req.params.owner;
        const repo = req.params.repo;
        let version;
        try {
          version = new SemVer(req.params.version);
        } catch (err) {
          assert(err instanceof Error);

          throw new createHttpError.BadRequest(
              `invalid parameter version: ${err.message}`);
        }

        const toothVersionModel = req.app.locals.toothVersionModel as
            ReturnType<typeof createToothVersionModel>;

        const item = await toothVersionModel.findOne({
          where: {
            repoOwner: owner,
            repoName: repo,
            version: version.version,
          }
        });

        if (item === null) {
          throw new createHttpError.NotFound(
              `tooth '${owner}/${repo}' not found`);
        }

        assert(item.repoOwner === owner);
        assert(item.repoName === repo);
        assert(item.version === version.version);

        const versions = await getVersions(toothVersionModel, owner, repo);

        res.send({
          apiVersion: '1',
          data: {
            repoPath: `github.com/${item.repoOwner}/${item.repoName}`,
            repoOwner: item.repoOwner,
            repoName: item.repoName,
            version: item.version,
            releasedAt: item.releasedAt.toISOString(),
            name: item.name,
            description: item.description,
            author: item.author,
            tags: item.tags,
            avatarUrl: item.avatarUrl,
            repoCreatedAt: item.repoCreatedAt.toISOString(),
            starCount: item.starCount,
            versions:
                versions.map((version) => ({
                               version: version.version.version,
                               releasedAt: version.releasedAt.toISOString(),
                             })),
          },
        });

      } catch (error) {
        next(error);
      }
    }) as express.RequestHandler,
);

async function getVersions(
    toothVersionModel: ReturnType<typeof createToothVersionModel>,
    owner: string, repo: string): Promise<Array<{
  version: SemVer,
  releasedAt: Date,
}>> {
  const rows = await toothVersionModel.findAll({
    where: {
      repoOwner: owner,
      repoName: repo,
    },
    attributes: ['version', 'releasedAt'],
  });

  return rows.map((row) => ({
                    version: new SemVer(row.version),
                    releasedAt: row.releasedAt,
                  }));
}
