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
  updated: { type: 'string' },
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

  async fetch (source: string, identifier: string): Promise<Package | undefined> {
    const key = `${source}:${identifier}`
    const entity = await this.repository.fetch(key)

    if (entity.identifier === undefined) {
      return undefined
    }

    return {
      packageManager: entity.packageManager,
      source: entity.source,
      identifier: entity.identifier,
      name: entity.name,
      description: entity.description,
      author: entity.author,
      tags: entity.tags,
      avatarUrl: entity.avatarUrl,
      hotness: entity.hotness,
      updated: entity.updated,
      versions: entity.versions.map((release: { version: string, releasedAt: string }) => ({
        version: release.version,
        releasedAt: release.releasedAt
      }))
    }
  }

  async search (q: string, perPage: number, page: number, sort: 'hotness' | 'updated', order: 'asc' | 'desc'): Promise<{ packages: Package[], pageCount: number }> {
    await this.repository.createIndex()

    const offset = (page - 1) * perPage
    const sortFieldMap = {
      hotness: 'hotness',
      updated: 'updated'
    }
    const sortOrderMap = {
      asc: 'ASC',
      desc: 'DESC'
    }

    let query = this.repository.search()

    if (q.length > 1) {
      const qList = q.replaceAll('*', ' ').split(' ').filter(item => item.length > 0)

      // If the query starts with a plus, it is an exact match
      const optionalQList = qList.filter(item => !item.startsWith('+'))
      const exactQList = qList.filter(item => item.startsWith('+')).map(item => item.slice(1))

      for (const qItem of exactQList) {
        if (/^[a-z0-9-]+:[a-z0-9-]+$/.test(qItem)) {
          query = query.and(subQuery => subQuery
            .or('tags').contains(qItem)
          )
        } else {
          const pattern = `*${qItem}*`
          query = query.and(subQuery => subQuery
            .or('name').matches(pattern)
            .or('description').matches(pattern)
            .or('author').matches(pattern)
            .or('tags').contains(pattern)
          )
        }
      }

      if (optionalQList.length > 0) {
        query = query.and(subQuery => {
          for (const qItem of optionalQList) {
            if (/^[a-z0-9-]+:[a-z0-9-]+$/.test(qItem)) {
              subQuery = subQuery.or(sub2Query => sub2Query
                .or('tags').contains(qItem)
              )
            } else {
              const pattern = `*${qItem}*`
              subQuery = subQuery.or(sub2Query => sub2Query
                .or('name').matches(pattern)
                .or('description').matches(pattern)
                .or('author').matches(pattern)
                .or('tags').contains(pattern)
              )
            }
          }

          return subQuery
        })
      }
    }

    const pageCount = Math.ceil(await query.count() / perPage)

    const entities = await query.sortBy(sortFieldMap[sort], sortOrderMap[order] as 'ASC' | 'DESC').return.page(offset, perPage)

    return {
      packages: entities.map((entity: any) => ({
        packageManager: entity.packageManager,
        source: entity.source,
        identifier: entity.identifier,
        name: entity.name,
        description: entity.description,
        author: entity.author,
        tags: entity.tags,
        avatarUrl: entity.avatarUrl,
        hotness: entity.hotness,
        updated: entity.updated,
        versions: entity.versions.map((release: { version: string, releasedAt: string }) => ({
          version: release.version,
          releasedAt: release.releasedAt
        }))
      })),
      pageCount
    }
  }
}
