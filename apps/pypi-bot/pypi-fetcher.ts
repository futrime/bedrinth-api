import { Package } from './package.js'
import consola from 'consola'
import { PackageFetcher } from './package-fetcher.js'

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

    // Remove empty releases
    const releases = Object.keys(data.releases).filter(version => data.releases[version].length > 0)

    return {
      identifier: project,
      name: project,
      description: data.info.summary,
      author: data.info.author ?? data.info.author_email ?? 'Unknown',
      tags: (data.info.keywords ?? '').split(','),
      avatarUrl: '',
      hotness: data.info.downloads.last_month,
      updated: data.releases[data.info.version][0].upload_time_iso_8601,
      versions: releases.map(version => ({
        version,
        releasedAt: data.releases[version][0].upload_time_iso_8601
      }))
    }
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
