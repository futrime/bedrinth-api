import consola from 'consola'
import { Package, Version, normalizePackage } from './package.js'
import { GitHubFetcher, RepositoryDescriptor } from './github-fetcher.js'

export class LeviLaminaFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching LeviLamina packages')

    const query = 'path:/+filename:tooth.json+"format_version"+2+"tooth"+"version"+"info"+"name"+"description"+"author"+"tags"+"github.com/LiteLDev/LeviLamina"'

    for await (const repo of this.searchForRepositories(query)) {
      if (repo.owner === 'LiteLDev' && repo.repo === 'LeviLamina') {
        continue // Skip LeviLamina itself
      }

      try {
        const packageInfo = await this.fetchPackage(repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching LeviLamina package github.com/${repo.owner}/${repo.repo}:`, error)
      }
    }
  }

  private escapeForGoProxy (s: string): string {
    return s.replace(/([A-Z])/g, (match) => `!${match.toLowerCase()}`)
  }

  private async fetchPackage (repo: RepositoryDescriptor): Promise<Package> {
    consola.debug(`Fetching LeviLamina package github.com/${repo.owner}/${repo.repo}`)

    const repositoryPromise = this.fetchRepository(repo)
    const toothMetadataPromise = this.fetchToothMetadata(repo)
    const versionsPromise = this.fetchVersionsFromGoproxy(repo)

    const [repository, toothMetadata, versions] = await Promise.all([repositoryPromise, toothMetadataPromise, versionsPromise])

    if (versions.length === 0) {
      throw new Error(`no versions found for github.com/${repo.owner}/${repo.repo}`)
    }

    const packageInfo: Package = {
      packageManager: 'lip',
      source: 'github',
      identifier: `${repo.owner}/${repo.repo}`,
      name: toothMetadata.info.name,
      description: toothMetadata.info.description,
      author: repo.owner,
      tags: ['platform:levilamina', ...toothMetadata.info.tags],
      avatarUrl: '',
      hotness: repository.stargazers_count,
      updated: '', // Add when normalized
      versions
    }

    const normalizedPackage = normalizePackage(packageInfo)
    return normalizedPackage
  }

  private async fetchToothMetadata (repo: RepositoryDescriptor): Promise<ToothMetadata> {
    consola.debug(`Fetching tooth metadata for LeviLamina package github.com/${repo.owner}/${repo.repo}`)

    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/tooth.json`
    const response = await fetch(url)
    const data = await response.json()
    return data as ToothMetadata
  }

  private async fetchVersionsFromGoproxy (repo: RepositoryDescriptor): Promise<Version[]> {
    consola.debug(`Fetching versions for github.com/${repo.owner}/${repo.repo}`)

    const url = `https://goproxy.io/github.com/${this.escapeForGoProxy(repo.owner)}/${this.escapeForGoProxy(repo.repo)}/@v/list`
    const response = await fetch(url)
    const text = await response.text()
    const versionList = text.split('\n').map(line => line.trim()).filter(line => line.length > 0).map(line => line.replace(/^v/, ''))

    const fetchPromiseList: Array<Promise<Response>> = []
    for (const version of versionList) {
      const url = `https://goproxy.io/github.com/${this.escapeForGoProxy(repo.owner)}/${this.escapeForGoProxy(repo.repo)}/@v/v${version}.info`
      const fetchPromise = fetch(url)
      fetchPromiseList.push(fetchPromise)
    }

    const fetchResponseList = await Promise.all(fetchPromiseList)
    const jsonPromiseList = fetchResponseList.map(async fetchResponse => await fetchResponse.json())
    const jsonList = await Promise.all(jsonPromiseList)
    return jsonList.map(json => ({
      version: (json as { Version: string }).Version.replace(/^v/, '').replace(/\+incompatible/g, ''),
      releasedAt: new Date((json as { Time: string }).Time).toISOString()
    }))
  }
}

interface ToothMetadata {
  info: {
    name: string
    description: string
    tags: string[]
  }
}
