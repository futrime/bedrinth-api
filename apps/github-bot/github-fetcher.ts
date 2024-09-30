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

    for await (const repo of this.fetchRepositories()) {
      try {
        const packageInfo = await this.fetchPackage(repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching ${repo.owner}/${repo.repo}:`, error)
      }
    }
  }

  private async fetchGoproxyInfo (repo: RepositoryDescriptor, tag: string): Promise<FetchGoproxyInfoResponse> {
    consola.debug(`Fetching goproxy info for ${repo.owner}/${repo.repo} ${tag}`)

    const url = `https://goproxy.io/github.com/${escapeForGoProxy(repo.owner)}/${escapeForGoProxy(repo.repo)}/@v/${tag}.info`
    const response = await fetch(url)
    const data = await response.json()
    return data as FetchGoproxyInfoResponse
  }

  private async fetchGoProxyList (repo: RepositoryDescriptor): Promise<string[]> {
    consola.debug(`Fetching goproxy list for ${repo.owner}/${repo.repo}`)

    const url = `https://goproxy.io/github.com/${escapeForGoProxy(repo.owner)}/${escapeForGoProxy(repo.repo)}/@v/list`
    const response = await fetch(url)
    const data = await response.text()
    return data.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  }

  private async fetchPackage (repo: RepositoryDescriptor): Promise<Package> {
    consola.debug(`Fetching package ${repo.owner}/${repo.repo}`)

    const toothMetadataPromise = this.fetchToothMetadata(repo)
    const repositoryPromise = this.fetchRepository(repo)
    const tagListPromise = this.fetchGoProxyList(repo)

    const goproxyInfoPromises: Array<Promise<FetchGoproxyInfoResponse | null>> = []
    for (const tag of await tagListPromise) {
      goproxyInfoPromises.push(this.fetchGoproxyInfo(repo, tag).catch(error => {
        consola.error(`error fetching goproxy info for ${repo.owner}/${repo.repo} ${tag}:`, error)
        return null
      }))
    }

    const [toothMetadata, repository, ...goproxyInfoList] = await Promise.all([toothMetadataPromise, repositoryPromise, ...goproxyInfoPromises])

    const releases: Release[] = goproxyInfoList.filter(goproxyInfo => goproxyInfo !== null).map(goproxyInfo => ({
      version: goproxyInfo.Version.replace(/^v/, '').replace(/\+incompatible/g, ''),
      releasedAt: new Date(goproxyInfo.Time).toISOString()
    }))

    if (releases.length === 0) {
      throw new Error(`no releases found for ${repo.owner}/${repo.repo}`)
    }

    const dateSorter = (a: string, b: string): number => {
      const aDate = new Date(a)
      const bDate = new Date(b)

      return aDate.getTime() - bDate.getTime()
    }

    const sortedReleases = releases.toSorted((a, b) => dateSorter(b.releasedAt, a.releasedAt))

    const identifier = `${repo.owner}/${repo.repo}`
    return {
      identifier,
      name: toothMetadata.info.name,
      description: toothMetadata.info.description,
      author: repo.owner,
      tags: toothMetadata.info.tags,
      avatarUrl: '',
      hotness: repository.stargazers_count,
      updated: sortedReleases[0].releasedAt,
      versions: sortedReleases
    }
  }

  private async * fetchRepositories (): AsyncGenerator<RepositoryDescriptor, void, unknown> {
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

  private async fetchRepository (repo: RepositoryDescriptor): Promise<FetchRepositoryResponse> {
    consola.debug(`Fetching repository ${repo.owner}/${repo.repo}`)

    const data = await this.octokit.rest.repos.get({ owner: repo.owner, repo: repo.repo })

    return data.data
  }

  private async fetchToothMetadata (repo: RepositoryDescriptor): Promise<FetchToothMetadataResponse> {
    consola.debug(`Fetching tooth metadata for ${repo.owner}/${repo.repo}`)

    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/tooth.json`
    const response = await fetch(url)
    const data = await response.json()
    return data as FetchToothMetadataResponse
  }
}

function escapeForGoProxy (s: string): string {
  return s.replace(/([A-Z])/g, (match) => `!${match.toLowerCase()}`)
}

interface FetchGoproxyInfoResponse {
  Version: string
  Time: string
}

interface FetchRepositoryResponse {
  stargazers_count: number
}

interface FetchToothMetadataResponse {
  info: {
    name: string
    description: string
    tags: string[]
  }
}

interface RepositoryDescriptor {
  owner: string
  repo: string
}
