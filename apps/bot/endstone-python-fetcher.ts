import consola from 'consola'
import toml from 'toml'
import { Package, Contributor, Version, normalizePackage } from './package.js'
import { GitHubFetcher, RepositoryDescriptor } from './github-fetcher.js'

export class EndstonePythonFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching Endstone Python packages')

    // Just a magic string to search for pyproject.toml files with an entry point for endstone
    const query = 'path:/+filename:pyproject.toml+[project.entry-points."endstone"]'

    for await (const repo of this.searchForRepositories(query)) {
      try {
        const packageInfo = await this.fetchPythonPackage(repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching Endstone Python package github.com/${repo.owner}/${repo.repo}:`, error)
      }
    }
  }

  private async fetchPythonPackage (repo: RepositoryDescriptor): Promise<Package> {
    consola.debug(`Fetching Endstone Python package github.com/${repo.owner}/${repo.repo}`)

    const [repository, repositoryContributors, repositoryVersions, pyprojectMetadata] = await Promise.all([
      this.fetchRepository(repo),
      this.fetchRepositoryContributors(repo),
      this.fetchRepositoryVersions(repo),
      this.fetchPyprojectMetadata(repo)
    ])

    const pypiPackageMetadata = await this.fetchPypiPackageMetadata(pyprojectMetadata.project.name)

    const contributors: Contributor[] = repositoryContributors.map<Contributor>(contributor => ({
      username: contributor.login ?? '',
      avatarUrl: contributor.avatar_url,
      contributions: contributor.contributions
    }))

    let versions: Version[] = repositoryVersions.map(version => ({
      version: version.tag_name,
      releasedAt: new Date(version.published_at ?? version.created_at).toISOString(),
      source: 'github',
      packageManager: 'pip'
    }))

    if (pypiPackageMetadata !== null) {
      const pypiVersionStrings = Object.keys(pypiPackageMetadata.releases).filter(version => pypiPackageMetadata.releases[version].length > 0)

      const pypiVersions = pypiVersionStrings.map(version => ({
        version,
        releasedAt: pypiPackageMetadata.releases[version][0].upload_time_iso_8601,
        source: 'pypi',
        packageManager: 'pip'
      }))

      versions = versions.concat(pypiVersions)
    }

    if (versions.length === 0) {
      throw new Error(`no versions found for github.com/${repo.owner}/${repo.repo}`)
    }

    const packageInfo: Package = {
      identifier: `github.com/${repo.owner}/${repo.repo}`,
      name: pyprojectMetadata.project.name,
      description: pyprojectMetadata.project.description ?? '',
      author: repository.owner.login,
      tags: [
        'platform:endstone',
        'type:mod',
        ...(pyprojectMetadata.project.keywords ?? []),
        ...(repository.topics ?? [])
      ],
      avatarUrl: `https://avatars.githubusercontent.com/${repo.owner}`,
      hotness: repository.stargazers_count,
      updated: '', // Add when normalized
      contributors,
      versions
    }

    const normalizedPackage = normalizePackage(packageInfo)
    return normalizedPackage
  }

  private async fetchPyprojectMetadata (repo: RepositoryDescriptor): Promise<PythonProjectMetadata> {
    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/pyproject.toml`
    const response = await fetch(url)
    const data = await response.text()
    return toml.parse(data) as PythonProjectMetadata
  }

  private async fetchPypiPackageMetadata (name: string): Promise<PypiPackageMetadata | null> {
    const url = `https://pypi.org/pypi/${name}/json`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    return await response.json() as PypiPackageMetadata
  }
}

interface PythonProjectMetadata {
  project: {
    name: string
    description?: string
    keywords?: string[]
  }
}

interface PypiPackageMetadata {
  info: {
    author: string | null
    author_email: string | null
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
