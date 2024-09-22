export interface Package {
  identifier: string
  name: string
  description: string
  author: string
  tags: string[]
  avatarUrl: string
  hotness: number
  updated: string
  versions: Release[]
}

export interface Release {
  version: string
  releasedAt: string
}
