import { Octokit } from 'octokit'
import { Package, Release } from './package.js'
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

    for await (const { owner, repo } of this.searchRepositories()) {
      try {
        const packageInfo = await this.fetchPackage(owner, repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching ${owner}/${repo}:`, error)
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

  private async fetchPackage (owner: string, repo: string): Promise<Package> {
    consola.debug(`Fetching ${owner}/${repo}`)

    const toothMetadata = await this.fetchToothMetadata(owner, repo)
    const repository = await this.fetchRepository(owner, repo)
    const latestReleaseTime = await this.fetchLatestReleaseTime(owner, repo)

    const identifier = `${owner}/${repo}`
    return {
      identifier,
      name: toothMetadata.info.name,
      description: toothMetadata.info.description,
      author: owner,
      tags: toothMetadata.info.tags,
      avatarUrl: '',
      hotness: repository.stars,
      updated: latestReleaseTime.toISOString(),
      versions: repository.releases
    }
  }

  private async fetchRepository (owner: string, repo: string): Promise<Repository> {
    const { data: repoData } = await this.octokit.rest.repos.get({ owner, repo })
    const { data: releasesData } = await this.octokit.rest.repos.listReleases({ owner, repo })

    return {
      stars: repoData.stargazers_count,
      releases: releasesData.filter((release) => release.published_at !== null).map((release) => ({
        version: release.tag_name.replace(/^v/, ''),
        releasedAt: release.published_at as string
      }))
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
  private async * searchRepositories (): AsyncGenerator<{ owner: string, repo: string }, void, unknown> {
    const query = 'path:/+filename:tooth.json+"format_version"+2+"tooth"+"version"+"info"+"name"+"description"+"author"+"tags"'
    let page = 1
    let hasMore = true

    while (hasMore) {
      consola.debug(`Searching page ${page}`)

      const { data } = await this.octokit.rest.search.code({
        q: query,
        per_page: 100,
        page
      })

      for (const item of data.items) {
        const owner = item.repository.owner.login
        const repo = item.repository.name
        yield { owner, repo }
      }

      hasMore = data.incomplete_results
      page++
    }
  }
}

interface Repository {
  stars: number
  releases: Release[]
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
