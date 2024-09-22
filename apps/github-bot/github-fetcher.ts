import { Octokit } from 'octokit'
import { Package } from './package.js'
import consola from 'consola'
import { PackageFetcher } from './package-fetcher.js'

export class GitHubFetcher implements PackageFetcher {
  private readonly octokit: Octokit

  /**
   * @param authToken The authentication token for the GitHub API
   */
  constructor (authToken: string) {
    this.octokit = new Octokit({ auth: authToken })
  }

  /**
   * Fetches packages from GitHub
   * @returns an async generator that yields Package objects
   */
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching packages')

    for await (const repository of this.searchRepositories()) {
      try {
        const packageInfo = await this.fetchPackage(repository)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching ${repository.owner}/${repository.repo}:`, error)
      }
    }
  }

  /**
   * Gets the latest release time for a repository
   * @returns the latest release time
   */
  private async fetchLatestReleaseTime (owner: string, repo: string): Promise<Date> {
    const escapedOwner = escapeForGoProxy(owner)
    const escapedRepo = escapeForGoProxy(repo)
    const url = `https://goproxy.io/github.com/${escapedOwner}/${escapedRepo}/@latest`

    const response = await fetch(url)
    const data = await response.json() as { Time: string }
    return new Date(data.Time)
  }

  private async fetchPackage (repository: Repository): Promise<Package> {
    consola.debug(`Fetching ${repository.owner}/${repository.repo}`)

    const toothMetadata = await this.fetchToothMetadata(repository.owner, repository.repo)
    const latestReleaseTime = await this.fetchLatestReleaseTime(repository.owner, repository.repo)
    const readme = await this.fetchReadme(repository.owner, repository.repo)

    const identifier = `${repository.owner}/${repository.repo}`
    return {
      identifier,
      name: toothMetadata.info.name,
      description: toothMetadata.info.description,
      author: repository.owner,
      tags: toothMetadata.info.tags,
      avatarUrl: '',
      hotness: repository.stars,
      updated: latestReleaseTime.toISOString(),
      readme,
      versions: []
    }
  }

  /**
   * Gets the README.md for a repository. If failed, it will return an empty string.
   * @returns the README.md
   */
  private async fetchReadme (owner: string, repo: string): Promise<string> {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`
      const response = await fetch(url)

      const data = await response.text()
      return data
    } catch (error) {
      consola.error(`Error fetching README.md for ${owner}/${repo}:`, error)
      return ''
    }
  }

  private async fetchToothMetadata (owner: string, repo: string): Promise<ToothMetadata> {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/tooth.json`
    const response = await fetch(url)
    const data = await response.json()
    return data as ToothMetadata
  }

  /**
   * Searches for repositories that contain a tooth.json file with the required structure.
   *
   * @returns an async generator that yields objects with owner and repo properties
   */
  private async * searchRepositories (): AsyncGenerator<Repository, void, unknown> {
    const query = 'path:/+filename:tooth.json+"format_version"+2+"tooth"+"version"+"info"+"name"+"description"+"author"+"tags"'
    let page = 1
    let hasMore = true

    while (hasMore) {
      consola.debug(`Searching for repositories on page ${page}`)

      const { data } = await this.octokit.rest.search.code({
        q: query,

        per_page: 100,
        page
      })

      for (const item of data.items) {
        const owner = item.repository.owner.login
        const repo = item.repository.name
        const stars = item.repository.stargazers_count ?? 0
        yield { owner, repo, stars }
      }

      hasMore = data.incomplete_results
      page++
    }
  }
}

interface Repository {
  owner: string
  repo: string
  stars: number
}

interface ToothMetadata {

  info: {
    name: string
    description: string
    tags: string[]
  }
}

function escapeForGoProxy (s: string): string {
  return s.replace(/([A-Z])/g, (match) => `!${match.toLowerCase()}`)
}
