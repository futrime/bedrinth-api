'use strict'

import{consola} from 'consola';
import * as express from 'express';
import httpErrors from 'http-errors';
import sequelize from 'sequelize';

const ITEMS_PER_PAGE = 20;

export const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Get parameters.
    const /** @type {string} */ qParam = req.query.q || '';
    const /** @type {Array<string>} */ queryList = [
      ...new Set(qParam.split(' ').filter(item => item !== ''))
    ];  // Remove empty strings and duplicates.

    const /** @type {string} */ pageParam = req.query.page || '1';
    if (!/^[1-9]\d{0,9}$/.test(pageParam)) {  // pageParam must be an natural
                                              // number without leading zeros.
      throw new httpErrors.BadRequest(`invalid parameter 'page'`);
    }
    const /** @type {number} */ page = Number(pageParam);

    const /** @type {sequelize.Model} */ toothModel = req.context.toothModel;

    // Query.
    const {count, rows} = await toothModel.findAndCountAll({
      where: {
        [sequelize.Op.and]: queryList.map(
            (term, index) => ({
              [sequelize.Op.like]: sequelize.literal(
                  `CONCAT("toothRepoPath", ' ', name, ' ', author, ' ', description, ' ', array_to_string(tags, ' ')) ILIKE :searchTerm${
                      index}`),
            })),
      },
      replacements: Object.fromEntries(
          queryList.map((term, index) => [`searchTerm${index}`, `%${term}%`])),
      offset: (page - 1) * ITEMS_PER_PAGE,
      limit: ITEMS_PER_PAGE,
    });

    // Construct the response.
    res.send({
      apiVersion: '1',
      data: {
        pageIndex: page,
        totalPages: Math.ceil(count / ITEMS_PER_PAGE),
        items: rows.map((item) => ({
                          toothRepoPath: item.toothRepoPath,
                          toothRepoOwner: item.toothRepoOwner,
                          toothRepoName: item.toothRepoName,
                          name: item.name,
                          description: item.description,
                          author: item.author,
                          tags: item.tags,
                          versions: item.versions,
                        })),
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
      consola.error(`[/search/teeth] ${error.message}`);

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
