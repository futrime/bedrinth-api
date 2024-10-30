export interface Package {
  packageManager: string
  source: string
  identifier: string
  name: string
  description: string
  author: string
  tags: string[]
  avatarUrl: string
  hotness: number
  updated: string
  versions: Version[]
}

export interface Version {
  version: string
  releasedAt: string
}

export function normalizePackage (pkg: Package): Package {
  const normalizedPackage = {
    ...pkg
  }

  // Deduplicate tags
  normalizedPackage.tags = [...new Set(pkg.tags)]

  // Replace tags
  normalizedPackage.tags = normalizedPackage.tags.map(tag => TAG_REPLACEMENTS[tag] ?? tag)

  // Deduplicate versions
  normalizedPackage.versions = [...new Map(pkg.versions.map(item => [item.version, item])).values()]

  // Normalize release dates
  normalizedPackage.versions = pkg.versions.map(version => {
    return {
      ...version,
      releasedAt: new Date(version.releasedAt).toISOString()
    }
  })

  // Sort versions by release date
  normalizedPackage.versions = normalizedPackage.versions.sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime())

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
  modpack: 'type:modpack',
  addon: 'type:addon',
  world: 'type:world',
}
