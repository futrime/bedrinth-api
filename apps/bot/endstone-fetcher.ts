import consola from 'consola'
import toml from 'toml'
import { Package, Version, normalizePackage } from './package.js'
import { GitHubFetcher, RepositoryDescriptor } from './github-fetcher.js'

export class EndstoneFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.debug('Fetching Endstone packages')

    const cppQuery = 'path:/+filename:CMakeLists.txt+endstone_add_plugin'

    for await (const repo of this.searchForRepositories(cppQuery)) {
      try {
        const packageInfo = await this.fetchCppPackage(repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching Endstone package github.com/${repo.owner}/${repo.repo}:`, error)
      }
    }

    const pythonQuery = 'path:/+filename:pyproject.toml+[project.entry-points."endstone"]'

    for await (const repo of this.searchForRepositories(pythonQuery)) {
      try {
        const packageInfo = await this.fetchPythonPackage(repo)

        yield packageInfo
      } catch (error) {
        consola.error(`Error fetching Endstone package github.com/${repo.owner}/${repo.repo}:`, error)
      }
    }
  }

  private async checkPypiPackageExistence (name: string): Promise<boolean> {
    const url = `https://pypi.org/pypi/${name}/json`
    const response = await fetch(url)
    return response.ok
  }

  private async fetchCppPackage (repo: RepositoryDescriptor): Promise<Package> {
    consola.debug(`Fetching Endstone package github.com/${repo.owner}/${repo.repo}`)

    const repositoryPromise = this.fetchRepository(repo)
    const versionsPromise = this.fetchVersionsFromGitHub(repo)

    const [repository, versions] = await Promise.all([repositoryPromise, versionsPromise])

    if (versions.length === 0) {
      throw new Error(`no versions found for github.com/${repo.owner}/${repo.repo}`)
    }

    const packageInfo: Package = {
      packageManager: 'none',
      source: 'github',
      identifier: `${repo.owner}/${repo.repo}`,
      name: repository.name,
      description: repository.description ?? '',
      author: repository.owner.login,
      tags: ['platform:endstone', 'type:mod', ...(repository.topics ?? [])],
      avatarUrl: `https://avatars.githubusercontent.com/${repo.owner}`,
      hotness: repository.stargazers_count,
      updated: '', // Add when normalized
      versions
    }

    const normalizedPackage = normalizePackage(packageInfo)
    return normalizedPackage
  }

  private async fetchPythonPackage (repo: RepositoryDescriptor): Promise<Package> {
    consola.debug(`Fetching Endstone package github.com/${repo.owner}/${repo.repo}`)

    const repositoryPromise = this.fetchRepository(repo)
    const projectMetadataPromise = this.fetchPythonProjectMetadata(repo)

    const [repository, projectMetadata] = await Promise.all([repositoryPromise, projectMetadataPromise])

    if (await this.checkPypiPackageExistence(projectMetadata.project.name)) {
      const pypiPackageMetadata = await this.fetchPypiPackageMetadata(projectMetadata.project.name)

      const releases = Object.keys(pypiPackageMetadata.releases).filter(version => pypiPackageMetadata.releases[version].length > 0)

      if (releases.length === 0) {
        throw new Error(`no versions found for pypi package ${projectMetadata.project.name}`)
      }

      const packageInfo: Package = {
        packageManager: 'pip',
        source: 'pypi',
        identifier: `${projectMetadata.project.name}`,
        name: projectMetadata.project.name,
        description: projectMetadata.project.description ?? '',
        author: repository.owner.login,
        tags: ['platform:endstone', 'type:mod', ...(projectMetadata.project.keywords ?? [])],
        avatarUrl: `https://avatars.githubusercontent.com/${repo.owner}`,
        hotness: repository.stargazers_count,
        updated: '', // Add when normalized
        versions: releases.map(version => ({
          version,
          releasedAt: pypiPackageMetadata.releases[version][0].upload_time_iso_8601
        }))
      }

      const normalizedPackage = normalizePackage(packageInfo)
      return normalizedPackage
    } else {
      const versions = await this.fetchVersionsFromGitHub(repo)

      if (versions.length === 0) {
        throw new Error(`no versions found for github.com/${repo.owner}/${repo.repo}`)
      }

      const packageInfo: Package = {
        packageManager: 'pip',
        source: 'github',
        identifier: `${repo.owner}/${repo.repo}`,
        name: projectMetadata.project.name,
        description: projectMetadata.project.description ?? '',
        author: repository.owner.login,
        tags: ['platform:endstone', 'type:mod', ...(projectMetadata.project.keywords ?? [])],
        avatarUrl: `https://avatars.githubusercontent.com/${repo.owner}`,
        hotness: repository.stargazers_count,
        updated: '', // Add when normalized
        versions
      }

      const normalizedPackage = normalizePackage(packageInfo)
      return normalizedPackage
    }
  }

  private async fetchPythonProjectMetadata (repo: RepositoryDescriptor): Promise<PythonProjectMetadata> {
    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/pyproject.toml`
    const response = await fetch(url)
    const data = await response.text()
    return toml.parse(data) as PythonProjectMetadata
  }

  private async fetchPypiPackageMetadata (name: string): Promise<PypiPackageMetadata> {
    const url = `https://pypi.org/pypi/${name}/json`
    const response = await fetch(url)
    const data = await response.json() as PypiPackageMetadata
    return data
  }

  private async fetchVersionsFromGitHub (repo: RepositoryDescriptor): Promise<Version[]> {
    const releases = await this.octokit.rest.repos.listReleases({ owner: repo.owner, repo: repo.repo })
    return releases.data.map(release => ({
      version: release.tag_name,
      releasedAt: new Date(release.published_at ?? release.created_at).toISOString()
    }))
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
