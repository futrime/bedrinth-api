import express from 'express'
import qs from 'qs'
import createHttpError from 'http-errors'
import { RedisClient } from '../../redis-client.js'

interface Params {
  q: string
  perPage: number
  page: number
  sort: 'hotness' | 'updated'
  order: 'asc' | 'desc'
}

function parseParams (query: qs.ParsedQs): Params {
  const {
    q = '',
    perPage = '10',
    page = '1',
    sort = 'hotness',
    order = 'desc'
  } = query

  return {
    q: String(q),
    perPage: validateNumber(perPage, 'perPage', 1, 100),
    page: validateNumber(page, 'page', 1, 100),
    sort: validateEnum(sort, ['hotness', 'updated'], 'sort'),
    order: validateEnum(order, ['asc', 'desc'], 'order')
  }
}

function validateNumber (value: any, name: string, min: number, max: number): number {
  const num = Number(value)
  if (isNaN(num) || num < min || num > max) {
    throw createHttpError(400, `invalid ${name}`)
  }
  return num
}

function validateEnum<T extends string> (value: any, allowedValues: T[], name: string): T {
  if (!allowedValues.includes(value)) {
    throw createHttpError(400, `invalid ${name}`)
  }
  return value as T
}

export const router = express.Router()

router.get('/', (async (req, res, next) => {
  const redisClient: RedisClient = req.app.locals.redisClient

  try {
    const params = parseParams(req.query)

    const packages = await redisClient.search(params.q, params.perPage, params.page, params.sort, params.order)

    res.json({
      apiVersion: '2.0.0',
      data: packages
    })
  } catch (error) {
    next(error)
  }
}) as express.RequestHandler)
