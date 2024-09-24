import { Package } from './package.js'
import consola from 'consola'
import { PackageFetcher } from './package-fetcher.js'
import { Octokit } from 'octokit'

export class PypiFetcher implements PackageFetcher {
  private readonly octokit: Octokit

  constructor () {
    this.octokit = new Octokit()
  }

  /**
   * Fetches packages from GitHub
   * @returns an async generator that yields Package objects
   */
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching packages')

    for await (const project of this.searchProjects()) {
      try {
        const packageInfo = await this.fetchPackage(project)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching ${project}:`, error)
      }
    }
  }

  private async fetchPackage (project: string): Promise<Package> {
    consola.debug(`Fetching ${project}`)

    const url = `https://pypi.org/pypi/${project}/json`
    const response = await fetch(url,
      {
        headers: {
          Accept: 'application/json'
        }
      }
    )

    const data = await response.json() as PypiResponse

    const stars = await this.fetchStars(project)

    // Remove empty releases
    const releases = Object.keys(data.releases).filter(version => data.releases[version].length > 0)

    const dateSorter = (a: string, b: string): number => {
      const aDate = new Date(a)
      const bDate = new Date(b)

      return aDate.getTime() - bDate.getTime()
    }

    return {
      identifier: project,
      name: project,
      description: data.info.summary,
      author: data.info.author ?? data.info.author_email ?? 'Unknown',
      tags: (data.info.keywords ?? '').split(',').map(tag => tag.trim()),
      avatarUrl: '',
      hotness: stars,
      updated: data.releases[data.info.version][0].upload_time_iso_8601,
      versions: releases.map(version => ({
        version,
        releasedAt: data.releases[version][0].upload_time_iso_8601
      })).toSorted((a, b) => dateSorter(b.releasedAt, a.releasedAt))
    }
  }

  private async fetchStars (project: string): Promise<number> {
    const url = `https://pypi.org/project/${project}`
    const response = await fetch(url)
    const data = await response.text()

    const regex = /"https:\/\/api.github.com\/repos\/(.+?)\/(.+?)"/
    const match = regex.exec(data)

    if (match != null) {
      const owner = match[1]
      const repo = match[2]

      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      })

      return data.stargazers_count
    }

    return 0
  }

  private async * searchProjects (): AsyncGenerator<string> {
    let page = 1

    const regex = /<span class="package-snippet__name">(endstone-.+?|endstone)<\/span>/g

    while (true) {
      consola.debug(`Searching page ${page}`)

      const url = `https://pypi.org/search/?q=endstone&page=${page}`
      const response = await fetch(url)

      if (!response.ok) {
        break
      }

      const html = await response.text()
      let match

      while ((match = regex.exec(html)) !== null) {
        yield match[1] // Yield the submatch (package name)
      }

      page++
    }
  }
}

interface PypiResponse {
  info: {
    author: string | null
    author_email: string | null
    downloads: {
      last_month: number
    }
    keywords: string | null
    name: string
    summary: string
    version: string
  }
  releases: {
    [version: string]: Array<{
      upload_time_iso_8601: string
    }>
  }
}
