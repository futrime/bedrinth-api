import consola from 'consola'
import 'dotenv/config'
import { EndstoneCppFetcher } from './endstone-cpp-fetcher.js'
import { EndstonePythonFetcher } from './endstone-python-fetcher.js'
import { PackageFetcher } from './package-fetcher.js'
import { RedisClient } from './redis-client.js'
import { LeviLaminaFetcher } from './levilamina-fetcher.js'

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

  const fetchers: PackageFetcher[] = [
    new EndstoneCppFetcher(config.githubToken),
    new EndstonePythonFetcher(config.githubToken),
    new LeviLaminaFetcher(config.githubToken)
  ]

  const redisClient = new RedisClient(config.databaseUrl)
  await redisClient.connect()

  async function fetchAndSave (): Promise<void> {
    consola.start('Fetching and saving packages...')

    await Promise.all(fetchers.map(async (fetcher) => {
      for await (const packageInfo of fetcher.fetch()) {
        await redisClient.save(packageInfo, config.expiration)
        consola.log(`Fetched and saved ${packageInfo.identifier}`)
      }
    }))

    consola.success('Done fetching and saving packages')
  }

  // Initial fetch
  await fetchAndSave()
    .catch((error) => {
      consola.error(error)
    })

  // Set up interval for subsequent fetches
  setInterval(() => {
    (async () => {
      await fetchAndSave()
    })().catch((error) => {
      consola.error(error)
    })
  }, config.fetchInterval * 1000)
}

main().catch((error) => {
  consola.error(error)
  process.exit(1)
})
