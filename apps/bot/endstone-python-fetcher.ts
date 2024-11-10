import consola from 'consola'
import toml from 'toml'
import { GitHubFetcher, RepoId, RepositoryVersion } from './github-fetcher.js'
import { Contributor, Package, Version, normalizePackage } from './package.js'

export class EndstonePythonFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.start('Fetching Endstone Python packages...')

    // Just a magic string to search for pyproject.toml files with an entry point for endstone
    const query = 'path:/+filename:pyproject.toml+[project.entry-points."endstone"]'

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

    consola.success('Done fetching Endstone Python packages')
  }

  private async fetchPackage (repo: RepoId): Promise<Package | null> {
    consola.debug(`EndstonePythonFetcher.fetchPackage(${repo.owner}/${repo.repo})`)

    const [repository, repositoryContributors, repositoryVersions, pyproject] = await Promise.all([
      this.getRepo(repo),
      this.listRepoContributors(repo),
      this.listRepoReleases(repo),
      this.fetchPyproject(repo, 'HEAD')
    ])

    if (pyproject === null) {
      return null
    }

    const contributors: Contributor[] = repositoryContributors.map<Contributor>(contributor => ({
      username: contributor.login ?? '',
      contributions: contributor.contributions
    }))

    let versions: Version[] = await this.fetchGitHubVersions(repo, repositoryVersions)

    const pypiProject = await this.fetchPypiProject(pyproject.project.name)

    if (pypiProject !== null) {
      versions = versions.concat(await this.fetchPypiVersions(repo, pypiProject))
    }

    if (versions.length === 0) {
      return null
    }

    const packageInfo: Package = {
      identifier: `github.com/${repo.owner}/${repo.repo}`,
      name: pyproject.project.name,
      description: pyproject.project.description ?? '',
      author: repository.owner.login,
      tags: [
        'platform:endstone',
        'type:mod',
        ...(pyproject.project.keywords ?? []),
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

  private async fetchGitHubVersions (repo: RepoId, repositoryVersions: RepositoryVersion[]): Promise<Version[]> {
    const versions: Version[] = []

    for (const version of repositoryVersions) {
      consola.debug(`EndstonePythonFetcher.fetchPackage(${repo.owner}/${repo.repo}) (source=github, version=${version.tag_name})`)

      try {
        const pyproject = await this.fetchPyproject(repo, version.tag_name)

        if (pyproject === null) {
          continue
        }

        const dependencies = pyproject.project.dependencies ?? []

        const endstoneDeps = dependencies.find(dependency => /^endstone[^A-Za-z0-9._-]?/.test(dependency)) ?? ''

        const platformVersionRequirement = endstoneDeps.replace(/^endstone/, '').trim()

        versions.push({
          version: version.tag_name,
          releasedAt: new Date(version.published_at ?? version.created_at).toISOString(),
          source: 'github',
          packageManager: 'pip',
          platformVersionRequirement
        })
      } catch (error) {
        consola.error(`Failed to fetch version ${version.tag_name} for package ${repo.owner}/${repo.repo} from GitHub:`, error)
      }
    }

    return versions
  }

  private async fetchPypiVersions (repo: RepoId, pypiProject: PypiProject): Promise<Version[]> {
    const pypiVersionStrings = Object.keys(pypiProject.releases).filter(version => pypiProject.releases[version].length > 0)

    const versions: Version[] = []

    for (const versionStr of pypiVersionStrings) {
      consola.debug(`EndstonePythonFetcher.fetchPackage(${repo.owner}/${repo.repo}) (source=pypi, version=${versionStr})`)

      try {
        const pypiProjectRelease = await this.fetchPypiProjectRelease(pypiProject.info.name, versionStr)

        if (pypiProjectRelease === null) {
          continue
        }

        if (pypiProjectRelease.urls.length === 0) {
          continue
        }

        const endstoneDep = pypiProjectRelease.info.requires_dist?.find(dep => /^endstone[^A-Za-z0-9._-]?/.test(dep)) ?? ''

        const platformVersionRequirement = endstoneDep.replace(/^endstone/, '').trim()

        versions.push({
          version: versionStr,
          releasedAt: pypiProjectRelease.urls[0].upload_time_iso_8601,
          source: 'pypi',
          packageManager: 'pip',
          platformVersionRequirement
        })
      } catch (error) {
        consola.error(`Failed to fetch version ${versionStr} for package ${repo.owner}/${repo.repo} from PyPI:`, error)
      }
    }

    return versions
  }

  private async fetchPyproject (repo: RepoId, ref: string): Promise<Pyproject | null> {
    consola.debug(`EndstonePythonFetcher.fetchPyproject(${repo.owner}/${repo.repo}, ${ref})`)

    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${ref}/pyproject.toml`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const data = await response.text()
    return toml.parse(data) as Pyproject
  }

  private async fetchPypiProject (name: string): Promise<PypiProject | null> {
    consola.debug(`EndstonePythonFetcher.fetchPypiProject(${name})`)

    const url = `https://pypi.org/pypi/${name}/json`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    return await response.json() as PypiProject
  }

  private async fetchPypiProjectRelease (name: string, version: string): Promise<PypiProjectRelease | null> {
    consola.debug(`EndstonePythonFetcher.fetchPypiProjectRelease(${name}, ${version})`)

    const url = `https://pypi.org/pypi/${name}/${version}/json`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    return await response.json() as PypiProjectRelease
  }
}

interface Pyproject {
  project: {
    name: string
    description?: string
    keywords?: string[]
    dependencies?: string[]
  }
}

interface PypiProject {
  info: {
    name: string
  }
  releases: {
    [version: string]: Array<{
      upload_time_iso_8601: string
    }>
  }
}

interface PypiProjectRelease {
  info: {
    requires_dist: string[] | null
  }
  urls: Array<{
    upload_time_iso_8601: string
  }>
}
