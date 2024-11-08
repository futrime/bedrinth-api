import { createClient, RedisClientType } from 'redis'
import { Schema, Repository } from 'redis-om'
import { DatabaseClient } from './database-client.js'
import { Package } from './package.js'
import consola from 'consola'

const schema = new Schema('package', {
  identifier: { type: 'string' },
  name: { type: 'text' },
  description: { type: 'text' },
  author: { type: 'text' },
  tags: { type: 'string[]' },
  avatarUrl: { type: 'string' },
  projectUrl: { type: 'string' },
  hotness: { type: 'number', sortable: true },
  updated: { type: 'string' },
  contributors_username: { type: 'string[]', path: '$.contributors[*].username' },
  contributors_contributions: { type: 'number[]', path: '$.contributors[*].contributions' },
  versions_version: { type: 'string[]', path: '$.versions[*].version' },
  versions_releasedAt: { type: 'string[]', path: '$.versions[*].releasedAt' },
  versions_source: { type: 'string[]', path: '$.versions[*].source' },
  versions_packageManager: { type: 'string[]', path: '$.versions[*].packageManager' },
  versions_platformVersionRequirement: { type: 'string[]', path: '$.versions[*].platformVersionRequirement' }
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
    this.client.on('error', (error) => {
      consola.error(error)
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
    await this.repository.save(pkg.identifier, pkg)
    await this.repository.expire(pkg.identifier, expiration)
  }
}
