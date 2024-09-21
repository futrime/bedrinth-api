import { Entity, Schema } from 'redis-om'

class Release extends Entity {
  version!: string
  releasedAt!: string
}

const releaseSchema = new Schema('release', {
  version: { type: 'string' },
  releasedAt: { type: 'date' }
})

class Package extends Entity {
  apiVersion!: string
  source!: string
  identifier!: string
  name!: string
  description!: string
  author!: string
  tags!: string[]
  avatarUrl!: string
  hotness!: number
  updated!: string
  readme!: string
  versions!: Release[]
}

const apiSchema = new Schema(Package, {
  apiVersion: { type: 'string' },
  source: { type: 'string' },
  identifier: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  author: { type: 'string' },
  tags: { type: 'string[]' },
  avatarUrl: { type: 'string' },
  hotness: { type: 'number' },
  updated: { type: 'date' },
  readme: { type: 'text' },
  versions: { type: 'array', schema: releaseSchema }
})

export { Package as API, apiSchema }
