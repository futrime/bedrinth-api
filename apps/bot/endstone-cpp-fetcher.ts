import consola from 'consola'
import { GitHubFetcher, RepoId } from './github-fetcher.js'
import { Contributor, Package, Version, normalizePackage } from './package.js'

export class EndstoneCppFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.start('Fetching Endstone C++ packages...')

    // Just a magic string to search for CMakeLists.txt files with endstone_add_plugin
    const query = 'path:/+filename:CMakeLists.txt+endstone_add_plugin'

    for await (const repo of this.searchForRepo(query)) {
      try {
        const packageInfo = await this.fetchPackage(repo)

        if (packageInfo !== null) {
          yield packageInfo
        }
      } catch (error) {
        consola.error(`Failed to fetch package ${repo.owner}/${repo.repo}:`, error)
      }
    }

    consola.success('Done fetching Endstone C++ packages')
  }

  private async fetchPackage (repo: RepoId): Promise<Package | null> {
    consola.debug(`EndstoneCppFetcher.fetchPackage(${repo.owner}/${repo.repo})`)

    const [repository, repositoryContributors, repositoryVersions] = await Promise.all([
      this.getRepo(repo),
      this.listRepoContributors(repo),
      this.listRepoReleases(repo)
    ])

    const contributors: Contributor[] = repositoryContributors.map<Contributor>(contributor => ({
      username: contributor.login ?? '',
      contributions: contributor.contributions
    }))

    const versions: Version[] = []

    for (const version of repositoryVersions) {
      consola.debug(`EndstoneCppFetcher.fetchPackage(${repo.owner}/${repo.repo}) (version=${version.tag_name})`)

      try {
        const cmakeListsTxtUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${version.tag_name}/CMakeLists.txt`
        const cmakeListsTxtResp = await fetch(cmakeListsTxtUrl)
        if (!cmakeListsTxtResp.ok) {
          consola.error(`Failed to fetch CMakeLists.txt file in ${repo.owner}/${repo.repo} for version ${version.tag_name}`)
          continue
        }

        const cmakeListsTxt = await cmakeListsTxtResp.text()

        const match = /FetchContent_Declare\(\s+endstone\s+GIT_REPOSITORY\s+https:\/\/github\.com\/EndstoneMC\/endstone\.git\s+GIT_TAG\s+(\S+)\s+\)/m.exec(cmakeListsTxt)

        const platformVersionRequirement = (match !== null) ? match[1] : ''

        versions.push({
          version: version.tag_name,
          releasedAt: new Date(version.published_at ?? version.created_at).toISOString(),
          source: 'github',
          packageManager: '',
          platformVersionRequirement
        })
      } catch (error) {
        consola.error(`Failed to fetch version ${version.tag_name} for package ${repo.owner}/${repo.repo}:`, error)
      }
    }

    if (versions.length === 0) {
      consola.error(`No versions found for package ${repo.owner}/${repo.repo}`)
      return null
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
