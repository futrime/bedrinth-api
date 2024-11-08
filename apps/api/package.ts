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
