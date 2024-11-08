import consola from 'consola'
import { Package, Contributor, Version, normalizePackage } from './package.js'
import { GitHubFetcher, RepositoryDescriptor } from './github-fetcher.js'

export class LeviLaminaFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching LeviLamina packages')

    // Just a magic string to search for tooth.json files
    const query = 'path:/+filename:tooth.json+"format_version"+2+"tooth"+"version"+"info"+"name"+"description"+"author"+"tags"+"github.com/LiteLDev/LeviLamina"'

    for await (const repo of this.searchForRepositories(query)) {
      // Skip LeviLamina itself
      if (repo.owner === 'LiteLDev' && repo.repo === 'LeviLamina') {
        continue
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

    const [repository, repositoryContributors, toothMetadata, versions, xmakeLuaResp] = await Promise.all([
      this.fetchRepository(repo),
      this.fetchRepositoryContributors(repo),
      this.fetchToothMetadata(repo),
      this.fetchVersionsFromGoproxy(repo),
      fetch(`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/xmake.lua`)
    ])

    const contributors: Contributor[] = repositoryContributors.map<Contributor>(contributor => ({
      username: contributor.login ?? '',
      contributions: contributor.contributions
    }))

    if (versions.length === 0) {
      throw new Error(`no versions found for github.com/${repo.owner}/${repo.repo}`)
    }

    let avatarUrl = toothMetadata.info.avatar_url ?? `https://avatars.githubusercontent.com/${repo.owner}`

    // Check if avatarUrl is relative and make it absolute if needed
    if (!/^(?:[a-z+]+:)?\/\//i.test(avatarUrl)) {
      // If relative, prepend the GitHub raw content URL
      avatarUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/${avatarUrl}`
    }

    const packageInfo: Package = {
      identifier: `github.com/${repo.owner}/${repo.repo}`,
      name: toothMetadata.info.name,
      description: toothMetadata.info.description,
      author: repo.owner,
      tags: [
        'platform:levilamina',
        ...(xmakeLuaResp.ok ? ['type:mod'] : []),
        ...toothMetadata.info.tags,
        ...(repository.topics ?? [])
      ],
      avatarUrl,
      projectUrl: `https://github.com/${repo.owner}/${repo.repo}`,
      hotness: repository.stargazers_count,
      updated: '', // Add when normalized
      contributors,
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
      releasedAt: new Date((json as { Time: string }).Time).toISOString(),
      source: 'github',
      packageManager: 'lip'
    }))
  }
}

interface ToothMetadata {
  info: {
    name: string
    description: string
    tags: string[]
    avatar_url?: string
  }
}
