export interface Package {
  identifier: string
  name: string
  description: string
  author: string
  tags: string[]
  avatarUrl: string
  projectUrl: string
  hotness: number
  updated: string
  contributors: Contributor[]
  versions: Version[]
}

export interface Contributor {
  username: string
  contributions: number
}

export interface Version {
  version: string
  releasedAt: string
  source: string
  packageManager: string
}

export function normalizePackage (pkg: Package): Package {
  const normalizedPackage = {
    ...pkg
  }

  // Replace tags
  let tags = pkg.tags.map(tag => TAG_REPLACEMENTS[tag] ?? tag)

  // Deduplicate tags
  tags = [...new Set(tags)]

  // Sort tags:
  // - For those matching ^[a-z0-9-]+:[a-z0-9-]+$, put them first
  // - For either of matched and unmatched tags, sort lexicographically respectively
  tags = tags.sort((a, b) => {
    const aMatches = /^[a-z0-9-]+:[a-z0-9-]+$/.test(a)
    const bMatches = /^[a-z0-9-]+:[a-z0-9-]+$/.test(b)

    if (aMatches && !bMatches) return -1
    if (!aMatches && bMatches) return 1
    return a.localeCompare(b)
  })

  normalizedPackage.tags = tags

  let contributors = pkg.contributors

  // Remove contributors without username
  contributors = contributors.filter(contributor => contributor.username !== '')

  // Sort contributors by contributions
  contributors = contributors.sort((a, b) => b.contributions - a.contributions)

  normalizedPackage.contributors = contributors

  // Deduplicate versions
  let versions = [...new Map(pkg.versions.map(item => [item.version, item])).values()]

  // Normalize release dates
  versions = versions.map(version => {
    return {
      ...version,
      releasedAt: new Date(version.releasedAt).toISOString()
    }
  })

  // Sort versions by release date
  versions = versions.sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime())

  normalizedPackage.versions = versions

  // Normalize updated date
  if (normalizedPackage.versions.length === 0) {
    throw new Error('no versions')
  }
  normalizedPackage.updated = normalizedPackage.versions[0].releasedAt

  return normalizedPackage
}

const TAG_REPLACEMENTS: Record<string, string> = {
  endstone: 'platform:endstone',
  levilamina: 'platform:levilamina',
  mod: 'type:mod',
  plugin: 'type:mod',
  modpack: 'type:modpack',
  addon: 'type:addon',
  world: 'type:world'
}
