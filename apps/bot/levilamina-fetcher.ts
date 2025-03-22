import consola from 'consola'
import { GitHubFetcher, RepoId } from './github-fetcher.js'
import { Contributor, Package, Version, normalizePackage } from './package.js'

export class LeviLaminaFetcher extends GitHubFetcher {
  public async * fetch (): AsyncGenerator<Package> {
    consola.start('Fetching LeviLamina packages...')

    // Just a magic string to search for tooth.json files
    const query = String.raw`path:/+filename:tooth.json+"\"format_version\":"+"\"tooth\":"+"\"version\":"`

    for await (const repo of this.searchForRepo(query)) {
      // Skip LeviLamina itself
      if (repo.owner === 'LiteLDev' && repo.repo === 'LeviLamina') {
        continue
      }

      try {
        const packageInfo = await this.fetchPackage(repo)

        if (packageInfo !== null) {
          yield packageInfo
        }
      } catch (error) {
        consola.error(`Failed to fetch package ${repo.owner}/${repo.repo}:`, error)
      }
    }

    consola.success('Done fetching LeviLamina packages')
  }

  private escapeForGoProxy (s: string): string {
    return s.replace(/([A-Z])/g, (match) => `!${match.toLowerCase()}`)
  }

  private async fetchPackage (repo: RepoId): Promise<Package | null> {
    consola.debug(`LeviLaminaFetcher.fetchPackage(${repo.owner}/${repo.repo})`)

    const [repository, repositoryContributors, tooth, versions] = await Promise.all([
      this.getRepo(repo),
      this.listRepoContributors(repo),
      this.fetchTooth(repo, 'HEAD'),
      this.fetchVersions(repo)
    ])

    if (tooth === null) {
      return null
    }

    if (versions.length === 0) {
      return null
    }

    let avatarUrl = tooth.info?.avatar_url ?? `https://avatars.githubusercontent.com/${repo.owner}`

    // Check if avatarUrl is relative and make it absolute if needed
    if (!/^(?:[a-z+]+:)?\//i.test(avatarUrl)) {
      avatarUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/${avatarUrl}`
    }
    // Check if avatarUrl starts with https://github.com/{owner}/{repo}/blob and convert it to raw.githubusercontent.com
    const githubUrlRegex = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([\w.-]+)\/blob\/(.+)/
    const githubUrlRegexMatch = githubUrlRegex.exec(avatarUrl)
    if (githubUrlRegexMatch !== null) {
      avatarUrl = `https://raw.githubusercontent.com/${githubUrlRegexMatch[1]}/${githubUrlRegexMatch[2]}/${githubUrlRegexMatch[3]}`
    }

    const contributors: Contributor[] = repositoryContributors.map<Contributor>(contributor => ({
      username: contributor.login ?? '',
      contributions: contributor.contributions
    }))

    const packageInfo: Package = {
      identifier: `github.com/${repo.owner}/${repo.repo}`,
      name: tooth.info?.name ?? repository.name,
      description: tooth.info?.description ?? repository.description ?? '',
      author: repo.owner,
      tags: [
        'platform:levilamina',
        ...tooth.info?.tags ?? [],
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

  private async fetchVersions (repo: RepoId): Promise<Version[]> {
    consola.debug(`LeviLaminaFetcher.fetchVersions(${repo.owner}/${repo.repo})`)

    const url = `https://goproxy.io/github.com/${this.escapeForGoProxy(repo.owner)}/${this.escapeForGoProxy(repo.repo)}/@v/list`
    const response = await fetch(url)
    const text = await response.text()
    const goproxyVersionStrList = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    const versionList: Version[] = []
    for (const goproxyVersionStr of goproxyVersionStrList) {
      consola.debug(`LeviLaminaFetcher.fetchVersions(${repo.owner}/${repo.repo}) (goproxyVersionStr=${goproxyVersionStr})`)

      try {
        const versionStr = goproxyVersionStr.replace(/^v/, '').replace(/\+incompatible/g, '')

        const [goproxyResp, toothResp] = await Promise.all([
          this.fetchGoProxyVersion(repo, goproxyVersionStr),
          this.fetchTooth(repo, `v${versionStr}`)
        ])

        if (goproxyResp === null || toothResp === null) {
          continue
        }

        const matchingVariant = toothResp.variants?.find(v => v.dependencies?.['github.com/LiteLDev/LeviLamina'] !== undefined)
        versionList.push({
          version: versionStr,
          releasedAt: new Date(goproxyResp.Time).toISOString(),
          source: 'github',
          packageManager: 'lip',
          platformVersionRequirement: matchingVariant?.dependencies?.['github.com/LiteLDev/LeviLamina'] ?? ''
        })
      } catch (error) {
        consola.error(`Failed to fetch version ${goproxyVersionStr} for package ${repo.owner}/${repo.repo}:`, error)
      }
    }

    return versionList
  }

  private async fetchGoProxyVersion (repo: RepoId, goproxyVersionStr: string): Promise<GoProxyVersion | null> {
    consola.debug(`LeviLaminaFetcher.fetchGoProxyVersion(${repo.owner}/${repo.repo}, ${goproxyVersionStr})`)

    const url = `https://goproxy.io/github.com/${this.escapeForGoProxy(repo.owner)}/${this.escapeForGoProxy(repo.repo)}/@v/${goproxyVersionStr}.info`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data as GoProxyVersion
  }

  private async fetchTooth (repo: RepoId, ref: string): Promise<Tooth | null> {
    consola.debug(`LeviLaminaFetcher.fetchTooth(${repo.owner}/${repo.repo}, ref=${ref})`)

    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${ref}/tooth.json`
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const data = await response.json()

    const tooth = this.migrateTooth(data as ToothBase)

    return tooth
  }

  private migrateTooth (legacyTooth: ToothBase): Tooth {
    if (legacyTooth.format_version === 1) {
      const legacyToothV1 = legacyTooth as ToothSchemaV1

      return {
        format_version: 3,
        info: {
          name: legacyToothV1.information?.name ?? '',
          description: legacyToothV1.information?.description ?? '',
          tags: [],
          avatar_url: ''
        },
        variants: [{
          dependencies: {
            'github.com/LiteLDev/LeviLamina': legacyToothV1.dependencies?.['github.com/LiteLDev/LeviLamina']
              ?.map(inner => inner.join(' '))
              .join(' || ') ?? ''
          }
        }]
      }
    } else if (legacyTooth.format_version === 2) {
      const legacyToothV2 = legacyTooth as ToothSchemaV2

      return {
        format_version: 3,
        info: {
          name: legacyToothV2.info.name,
          description: legacyToothV2.info.description,
          tags: legacyToothV2.info.tags,
          avatar_url: legacyToothV2.info.avatar_url
        },
        variants: [{
          dependencies: {
            'github.com/LiteLDev/LeviLamina': legacyToothV2.dependencies?.['github.com/LiteLDev/LeviLamina'] ?? legacyToothV2.prerequisites?.['github.com/LiteLDev/LeviLamina'] ?? ''
          }
        }]
      }
    } else if (legacyTooth.format_version === 3) {
      return legacyTooth as Tooth
    } else {
      throw new Error(`Unsupported tooth format version: ${legacyTooth.format_version}`)
    }
  }
}

interface ToothBase {
  format_version: number
}

interface Tooth extends ToothBase {
  format_version: 3
  info?: {
    name?: string
    description?: string
    tags?: string[]
    avatar_url?: string
  }
  variants?: Array<{
    label?: string
    platform?: string
    dependencies?: {
      'github.com/LiteLDev/LeviLamina'?: string
    }
  }>
}

interface ToothSchemaV2 extends ToothBase {
  format_version: 2
  info: {
    name: string
    description: string
    tags: string[]
    avatar_url?: string
  }
  dependencies?: {
    'github.com/LiteLDev/LeviLamina'?: string
  }
  prerequisites?: {
    'github.com/LiteLDev/LeviLamina'?: string
  }
}

interface ToothSchemaV1 {
  format_version: 1
  information?: {
    name?: string
    description?: string
  }
  dependencies?: {
    'github.com/LiteLDev/LeviLamina'?: string[][]
  }
}

interface GoProxyVersion {
  Version: string
  Time: string
}
