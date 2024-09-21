import 'dotenv/config'
import consola from 'consola'
import { GitHubFetcher } from './github-fetcher.js'

interface Config {
  githubToken: string
  logLevel: number
}

async function main (): Promise<void> {
  const config: Config = {
    githubToken: process.env.GITHUB_TOKEN ?? '',
    logLevel: Number(process.env.LOG_LEVEL ?? 3)
  }

  consola.level = config.logLevel

  const fetcher = new GitHubFetcher(config.githubToken)

  for await (const packageInfo of fetcher.fetch()) {
    consola.log(packageInfo)
    // Process each package as it's fetched
    // For example, you could save it to a database here
  }
}

main().catch((error) => {
  consola.error('Unhandled error:', error)
  process.exit(1)
})
