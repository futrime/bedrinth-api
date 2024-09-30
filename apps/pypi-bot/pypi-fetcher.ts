import { Package } from './package.js'
import consola from 'consola'
import { PackageFetcher } from './package-fetcher.js'

const downloadToHotnessMagicNumber = 1 / 13

export class PypiFetcher implements PackageFetcher {
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

    const hotness = Math.round(await this.fetchMonthlyDownloadCount(project) * downloadToHotnessMagicNumber)

    // Remove empty releases
    const releases = Object.keys(data.releases).filter(version => data.releases[version].length > 0)

    if (releases.length === 0) {
      throw new Error(`no releases found for ${project}`)
    }

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
      tags: ['platform:endstone', ...(data.info.keywords ?? '').split(',').map(tag => tag.trim())],
      avatarUrl: '',
      hotness,
      updated: new Date(data.releases[data.info.version][0].upload_time_iso_8601).toISOString(),
      versions: releases.map(version => ({
        version,
        releasedAt: new Date(data.releases[version][0].upload_time_iso_8601).toISOString()
      })).toSorted((a, b) => dateSorter(b.releasedAt, a.releasedAt))
    }
  }

  private async fetchMonthlyDownloadCount (project: string): Promise<number> {
    const url = `https://pypistats.org/api/packages/${project}/recent`
    const response = await fetch(url)
    const data = await response.json() as PypiStatsRecentResponse

    return data.data.last_month
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

interface PypiStatsRecentResponse {
  data: {
    last_month: number
  }
}
