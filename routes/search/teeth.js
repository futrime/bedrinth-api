'use strict'

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
      throw new httpErrors.BadRequest('Invalid parameter - page.');
    }
    const /** @type {number} */ page = Number(pageParam);

    const /** @type {import('sequelize').Model} */ toothModel =
        req.context.toothModel;

    // Query.
    const {count, rows} = await toothModel.findAndCountAll({
      where: {
        [sequelize.Op.and]: queryList.map(
            (term, index) => ({
              [sequelize.Op.like]: sequelize.literal(
                  `concat(tooth, ' ', name, ' ', author, ' ', description, ' ', array_to_string(tags, ' ')) ILIKE :searchTerm${
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
      code: 200,
      max_page: Math.ceil(count / ITEMS_PER_PAGE),
      list: rows.map((item) => ({
                       tooth: item.tooth,
                       name: item.name,
                       description: item.description,
                       author: item.author,
                       latest_version: item.latestVersion,
                       tags: item.tags,
                     }))
    });

  } catch (error) {
    if (httpErrors.isHttpError(error)) {
      res.status(error.statusCode).send({
        code: error.statusCode,
        message: error.message,
      });

    } else {
      res.status(500).send({
        code: 500,
        message: 'Internal server error.',
      });
    }
  }
});
