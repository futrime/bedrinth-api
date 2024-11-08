import consola from 'consola'
import { Octokit } from 'octokit'
import { PackageFetcher } from './package-fetcher.js'
import { Package } from './package.js'

export abstract class GitHubFetcher implements PackageFetcher {
  protected readonly octokit: Octokit

  constructor (authToken: string) {
    this.octokit = new Octokit({ auth: authToken })
  }

  public abstract fetch (): AsyncGenerator<Package>

  protected async getRepo (repo: RepoId): Promise<Repository> {
    consola.debug(`GitHubFetcher.getRepo(${repo.owner}/${repo.repo})`)

    const response = await this.octokit.rest.repos.get({ owner: repo.owner, repo: repo.repo })

    return response.data
  }

  protected async listRepoContributors (repo: RepoId): Promise<RepositoryContributor[]> {
    consola.debug(`GitHubFetcher.listRepoContributors(${repo.owner}/${repo.repo})`)

    const response = await this.octokit.rest.repos.listContributors({ owner: repo.owner, repo: repo.repo })
    return response.data
  }

  protected async listRepoReleases (repo: RepoId): Promise<RepositoryVersion[]> {
    consola.debug(`GitHubFetcher.listRepoReleases(${repo.owner}/${repo.repo})`)

    const releases = await this.octokit.rest.repos.listReleases({ owner: repo.owner, repo: repo.repo })
    return releases.data
  }

  protected async * searchForRepo (query: string): AsyncGenerator<RepoId> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      consola.debug(`GitHubFetcher.searchForRepo(${query}) (page=${page})`)

      const response = await this.octokit.rest.search.code({
        q: query,
        per_page: 100,
        page
      })

      for (const item of response.data.items) {
        const owner = item.repository.owner.login
        const repo = item.repository.name
        yield { owner, repo }
      }

      hasMore = response.headers.link?.includes('rel="next"') ?? false
      page++
    }
  }
}

export interface RepoId {
  owner: string
  repo: string
}

export interface Repository {
  name: string
  full_name: string
  owner: {
    login: string
  }
  description: string | null
  stargazers_count: number
  topics?: string[]
}

export interface RepositoryContributor {
  login?: string
  avatar_url?: string
  contributions: number
}

export interface RepositoryVersion {
  tag_name: string
  created_at: string
  published_at: string | null
}
