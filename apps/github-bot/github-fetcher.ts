import { Octokit } from 'octokit'
import { Package, Release } from './package.js'
import consola from 'consola'
import { PackageFetcher } from './package-fetcher.js'
import semver from 'semver'

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
    consola.debug(`Fetching latest release time for ${owner}/${repo}`)

    const escapedOwner = escapeForGoProxy(owner)
    const escapedRepo = escapeForGoProxy(repo)
    const url = `https://goproxy.io/github.com/${escapedOwner}/${escapedRepo}/@latest`

    const response = await fetch(url)
    const data = await response.json() as { Time: string }
    return new Date(data.Time)
  }

  private async fetchPackage (owner: string, repo: string): Promise<Package> {
    consola.debug(`Fetching package ${owner}/${repo}`)

    const toothMetadata = await this.fetchToothMetadata(owner, repo)
    const repository = await this.fetchRepository(owner, repo)
    const latestReleaseTime = await this.fetchLatestReleaseTime(owner, repo)

    const identifier = `github.com/${owner}/${repo}`
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
    consola.debug(`Fetching repository ${owner}/${repo}`)

    const { data: repoData } = await this.octokit.rest.repos.get({ owner, repo })

    const releases: Release[] = []

    let hasMore = true
    let page = 1

    while (hasMore) {
      consola.debug(`Fetching releases for ${owner}/${repo} (page ${page})`)

      const { data: releasesData } = await this.octokit.rest.repos.listReleases({ owner, repo, page, per_page: 100 })
      releases.push(
        ...releasesData.map((release) => ({
          version: release.tag_name.replace(/^v/, ''),
          releasedAt: release.published_at as string
        })).filter((release) => semver.valid(release.version))
      )
      hasMore = releasesData.length === 100
      page++
    }

    const dateSorter = (a: string, b: string): number => {
      const aDate = new Date(a)
      const bDate = new Date(b)

      return aDate.getTime() - bDate.getTime()
    }

    return {
      stars: repoData.stargazers_count,
      releases: releases.toSorted((a, b) => dateSorter(b.releasedAt, a.releasedAt))
    }
  }

  private async fetchToothMetadata (owner: string, repo: string): Promise<ToothMetadata> {
    consola.debug(`Fetching tooth metadata for ${owner}/${repo}`)

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
    consola.debug('Searching repositories')

    const query = 'path:/+filename:tooth.json+"format_version"+2+"tooth"+"version"+"info"+"name"+"description"+"author"+"tags"'
    let page = 1
    let hasMore = true

    while (hasMore) {
      consola.debug(`Searching repositories (page ${page})`)

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
