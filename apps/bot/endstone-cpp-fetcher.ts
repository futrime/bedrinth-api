import consola from 'consola'
import { Package, Contributor, Version, normalizePackage } from './package.js'
import { GitHubFetcher, RepositoryDescriptor } from './github-fetcher.js'

export class EndstoneCppFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching Endstone C++ packages')

    // Just a magic string to search for CMakeLists.txt files with endstone_add_plugin
    const query = 'path:/+filename:CMakeLists.txt+endstone_add_plugin'

    for await (const repo of this.searchForRepositories(query)) {
      try {
        const packageInfo = await this.fetchPackage(repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching Endstone C++ package github.com/${repo.owner}/${repo.repo}:`, error)
      }
    }
  }

  private async fetchPackage (repo: RepositoryDescriptor): Promise<Package> {
    consola.debug(`Fetching Endstone C++ package github.com/${repo.owner}/${repo.repo}`)

    const [repository, repositoryContributors, repositoryVersions] = await Promise.all([
      this.fetchRepository(repo),
      this.fetchRepositoryContributors(repo),
      this.fetchRepositoryVersions(repo)
    ])

    const contributors: Contributor[] = repositoryContributors.map<Contributor>(contributor => ({
      username: contributor.login ?? '',
      contributions: contributor.contributions
    }))

    const versions: Version[] = repositoryVersions.map(version => ({
      version: version.tag_name,
      releasedAt: new Date(version.published_at ?? version.created_at).toISOString(),
      source: 'github',
      packageManager: ''
    }))

    if (versions.length === 0) {
      throw new Error(`no versions found for github.com/${repo.owner}/${repo.repo}`)
    }

    const packageInfo: Package = {
      identifier: `github.com/${repo.owner}/${repo.repo}`,
      name: repository.name,
      description: repository.description ?? '',
      author: repository.owner.login,
      tags: [
        'platform:endstone',
        'type:mod',
        ...(repository.topics ?? [])
      ],
      avatarUrl: `https://avatars.githubusercontent.com/${repo.owner}`,
      projectUrl: `https://github.com/${repo.owner}/${repo.repo}`,
      hotness: repository.stargazers_count,
      updated: '', // Add when normalized
      contributors,
      versions
    }

    const normalizedPackage = normalizePackage(packageInfo)
    return normalizedPackage
  }
}
