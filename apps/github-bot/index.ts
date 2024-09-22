import 'dotenv/config'
import consola from 'consola'
import { GitHubFetcher } from './github-fetcher.js'
import { RedisClient } from './redis-client.js'

interface Config {
  databaseUrl: string
  githubToken: string
  logLevel: number
}

async function main (): Promise<void> {
  const config: Config = {
    databaseUrl: process.env.DATABASE_URL ?? 'redis://localhost:6379',
    githubToken: process.env.GITHUB_TOKEN ?? '',
    logLevel: Number(process.env.LOG_LEVEL ?? 3)
  }

  consola.level = config.logLevel

  const fetcher = new GitHubFetcher(config.githubToken)
  const redisClient = new RedisClient(config.databaseUrl)
  await redisClient.connect()

  while (true) {
    for await (const packageInfo of fetcher.fetch()) {
      consola.log(packageInfo)

      await redisClient.save(packageInfo, 60 * 60)
    }
  }
}

main().catch((error) => {
  consola.error('Unhandled error:', error)
  process.exit(1)
})
