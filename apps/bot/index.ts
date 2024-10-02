import 'dotenv/config'
import consola from 'consola'
import { EndstoneFetcher } from './endstone-fetcher.js'
import { LeviLaminaFetcher } from './levilamina-fetcher.js'
import { RedisClient } from './redis-client.js'

interface Config {
  databaseUrl: string
  expiration: number
  fetchInterval: number
  githubToken: string
  logLevel: number
}

async function main (): Promise<void> {
  const config: Config = {
    databaseUrl: process.env.DATABASE_URL ?? 'redis://localhost:6379',
    expiration: Number(process.env.EXPIRATION ?? 60 * 60),
    fetchInterval: Number(process.env.FETCH_INTERVAL ?? 60 * 30),
    githubToken: process.env.GITHUB_TOKEN ?? '',
    logLevel: Number(process.env.LOG_LEVEL ?? 3)
  }

  consola.level = config.logLevel

  const fetchers = [
    new EndstoneFetcher(config.githubToken),
    new LeviLaminaFetcher(config.githubToken)
  ]

  const redisClient = new RedisClient(config.databaseUrl)
  await redisClient.connect()

  async function fetchAndSave (): Promise<void> {
    for (const fetcher of fetchers) {
      for await (const packageInfo of fetcher.fetch()) {
        await redisClient.save(packageInfo, config.expiration)
        consola.log(`Fetched ${packageInfo.source}:${packageInfo.identifier}`)
      }
    }
  }

  // Initial fetch
  await fetchAndSave()

  // Set up interval for subsequent fetches
  setInterval(() => {
    (async () => {
      await fetchAndSave()
    })().catch((error) => {
      consola.error('Error fetching and saving packages:', error)
    })
  }, config.fetchInterval * 1000)
}

main().catch((error) => {
  consola.error('Unhandled error:', error)
  process.exit(1)
})
