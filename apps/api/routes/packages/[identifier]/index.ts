import express from 'express'
import createHttpError from 'http-errors'
import { apiVersion } from '../../../api-version.js'
import { RedisClient } from '../../../redis-client.js'

export const router = express.Router()

router.get('/', (async (req, res, next) => {
  const identifier = req.app.locals.identifier
  const redisClient: RedisClient = req.app.locals.redisClient

  try {
    const packageData = await redisClient.fetch(identifier)
    if (packageData === undefined) {
      throw new createHttpError.NotFound('package not found')
    }

    res.json({
      apiVersion,
      data: packageData
    })
  } catch (error) {
    next(error)
  }
}) as express.RequestHandler)
