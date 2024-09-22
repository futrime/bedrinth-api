import { createClient, RedisClientType } from 'redis'
import { Schema, Repository } from 'redis-om'
import { DatabaseClient } from './database-client.js'
import { Package } from './package.js'
import consola from 'consola'

const schema = new Schema('package', {
  source: { type: 'string' },
  identifier: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'text' },
  author: { type: 'string' },
  tags: { type: 'string[]' },
  avatarUrl: { type: 'string' },
  hotness: { type: 'number' },
  updated: { type: 'string' },
  readme: { type: 'text' },
  release_versions: { type: 'string[]', path: '$.versions[*].version' },
  release_releasedAt: { type: 'string[]', path: '$.versions[*].releasedAt' }
})

export class RedisClient implements DatabaseClient {
  private readonly client: RedisClientType
  private readonly repository: Repository

  constructor (url: string) {
    this.client = createClient({ url })
    this.client.on('error', (err) => {
      consola.error('Redis error:', err)
    })

    this.repository = new Repository(schema, this.client)
  }

  async connect (): Promise<void> {
    await this.client.connect()
  }

  async disconnect (): Promise<void> {
    await this.client.quit()
  }

  async savePackage (pkg: Package, expiry: Date): Promise<void> {
    const entityId = `github:${pkg.identifier}`
    const entityData = {
      source: 'github',
      ...pkg
    }

    await this.repository.save(entityId, entityData)

    // Set expiration
    const expiryInSeconds = Math.floor((expiry.getTime() - Date.now()) / 1000)
    await this.client.expire(entityId, expiryInSeconds)
  }
}
