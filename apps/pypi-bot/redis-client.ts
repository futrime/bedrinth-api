import { createClient, RedisClientType } from 'redis'
import { Schema, Repository } from 'redis-om'
import { DatabaseClient } from './database-client.js'
import { Package } from './package.js'
import consola from 'consola'

const schema = new Schema('package', {
  packageManager: { type: 'string' },
  source: { type: 'string' },
  identifier: { type: 'string' },
  name: { type: 'text' },
  description: { type: 'text' },
  author: { type: 'text' },
  tags: { type: 'string[]' },
  avatarUrl: { type: 'string' },
  hotness: { type: 'number', sortable: true },
  updated: { type: 'string', sortable: true },
  versions_version: { type: 'string[]', path: '$.versions[*].version' },
  versions_releasedAt: { type: 'string[]', path: '$.versions[*].releasedAt' }
})

export class RedisClient implements DatabaseClient {
  private readonly client: RedisClientType
  private readonly repository: Repository

  constructor (url: string) {
    this.client = createClient({
      url,
      socket: {
        reconnectStrategy: () => 500
      }
    })
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

  async save (pkg: Package, expiration: number): Promise<void> {
    const entityId = `pypi:${pkg.identifier}`
    const entityData = {
      packageManager: 'pip',
      source: 'pypi',
      ...pkg
    }

    await this.repository.save(entityId, entityData)
    await this.repository.expire(entityId, expiration)
  }
}
