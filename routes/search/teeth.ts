import assert from 'assert';
import express from 'express';
import createHttpError from 'http-errors';
import isNaturalNumber from 'is-natural-number';
import qs from 'qs';
import sequelize from 'sequelize';

import {createToothVersionModel} from '../../models/tooth_version.js';

export const router = express.Router();

type SortParamType = 'starCount'|'createdAt'|'updatedAt';

type OrderParamType = 'ascending'|'descending';

interface ParamsType {
  queryList: string[];
  perPage: number;
  page: number;
  sort: SortParamType;
  order: OrderParamType;
}

const ORDER_MAP = {
  ascending: 'ASC',
  descending: 'DESC',
};

const SORT_MAP = {
  starCount: 'sourceRepoStarCount',
  createdAt: 'sourceRepoCreatedAt',
  updatedAt: 'releasedAt',
};

router.get(
    '/',
    (async (req, res, next) => {
      try {
        let params;
        try {
          params = parseParams(req.query);

        } catch (err) {
          assert(err instanceof Error);

          throw new createHttpError.BadRequest(err.message);
        }

        const toothVersionModel = req.app.locals.toothVersionModel as
            ReturnType<typeof createToothVersionModel>;

        // Query database.
        const {count, rows} = await toothVersionModel.findAndCountAll({
          where: {
            [sequelize.Op.and]: [
              ...params.queryList.map(
                  (_, index) => ({
                    [sequelize.Op.like]: sequelize.literal(
                        `CONCAT(repoOwner, ' ', repoName, ' ', name, ' ', description, ' ', author, ' ', array_to_string(tags, ' '), ' ', source) ILIKE :searchTerm${
                            index}`),
                  })),
              {
                isLatest: true,
              }
            ],
          },
          order: [
            [SORT_MAP[params.sort], ORDER_MAP[params.order]],
          ],
          replacements: Object.fromEntries(params.queryList.map(
              (term, index) => [`searchTerm${index}`, `%${term}%`])),
          offset: (params.page - 1) * params.perPage,
          limit: params.perPage,
        });

        validateNonRepeatability(rows);

        res.send({
          apiVersion: '1',
          data: {
            pageIndex: params.page,
            totalPages: Math.ceil(count / params.perPage),
            items: rows.map(
                (item) => ({
                  repoPath: `github.com/${item.repoOwner}/${item.repoName}`,
                  repoOwner: item.repoOwner,
                  repoName: item.repoName,
                  latestVersion: item.version,
                  latestVersionReleasedAt: item.releasedAt,
                  name: item.name,
                  description: item.description,
                  author: item.author,
                  tags: item.tags,
                  avatarUrl: item.avatarUrl,
                  source: item.source,
                  sourceRepoCreatedAt: item.sourceRepoCreatedAt,
                  starCount: item.sourceRepoStarCount,
                })),
          },
        });

      } catch (error) {
        next(error);
      }
    }) as express.RequestHandler,
);

function parseParams(query: qs.ParsedQs): ParamsType {
  assert(query.q === undefined || typeof query.q === 'string');
  assert(query.perPage === undefined || typeof query.perPage === 'string')
  assert(query.page === undefined || typeof query.page === 'string');
  assert(query.sort === undefined || typeof query.sort === 'string');
  assert(query.order === undefined || typeof query.order === 'string');

  const qParam = query.q ?? '';
  const perPageParam = query.perPage ?? '20';
  const pageParam = query.page ?? '1';
  const sortParam = query.sort ?? 'starCount';
  const orderParam = query.order ?? 'descending';

  validateParams(qParam, perPageParam, pageParam, sortParam, orderParam);

  return {
    queryList: (query.q ?? '').split(' ').filter((s) => s.length > 0),
    perPage: Number(query.perPage),
    page: Number(query.page),
    sort: (query.sort ?? 'starCount') as SortParamType,
    order: (query.order ?? 'descending') as OrderParamType,
  };
}

function validateNonRepeatability(rows: {
  repoOwner: string,
  repoName: string,
}[]) {
  const repoSet = new Set<string>();
  for (const item of rows) {
    const repoPath = `${item.repoOwner}/${item.repoName}`;
    if (repoSet.has(repoPath)) {
      throw new Error(`found duplicate item: ${repoPath}`);
    }
    repoSet.add(repoPath);
  }
}

function validateParams(
    q: string, perPage: string, page: string, sort: string, order: string) {
  if (!isNaturalNumber(perPage, {includeZero: true})) {
    throw new Error(`parameter perPage must be a natural number: ${perPage}`);
  }
  if (Number(perPage) > 100) {
    throw new Error(
        `parameter perPage must be less than or equal to 100: ${perPage}`);
  }

  if (!isNaturalNumber(page)) {
    throw new Error(
        `parameter page must be a positive natural number: ${page}`);
  }

  if (!['starCount', 'createdAt', 'updatedAt'].includes(sort)) {
    throw new Error(
        `parameter sort must be one of starCount, createdAt, updatedAt: ${
            sort}`);
  }

  if (!['ascending', 'descending'].includes(order)) {
    throw new Error(
        `parameter order must be one of ascending, descending: ${order}`);
  }
}
