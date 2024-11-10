import consola from 'consola'
import { createClient, RedisClientType } from 'redis'
import { Repository, Schema } from 'redis-om'
import { DatabaseClient } from './database-client.js'
import { Package } from './package.js'

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

  async fetch (identifier: string): Promise<Package | null> {
    const entity = await this.repository.fetch(identifier)

    // Check if the entity is empty
    if (Object.keys(entity).length === 0) {
      return null
    }

    return entity as Package
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

    const qList = q.replaceAll('*', ' ').split(' ').filter(item => item.length > 0).map(item => item.trim())

    // Key is the category, value is the list of query items
    const categoriezedQList: {[key: string]: string[]} = {}

    for (const qItem of qList) {
      const category = /^[a-z0-9-]+:[a-z0-9-]+$/.test(qItem) ? qItem.split(':')[0] : ''

      if (categoriezedQList[category] === undefined) {
        categoriezedQList[category] = []
      }
      categoriezedQList[category].push(qItem)
    }

    for (const category in categoriezedQList) {
      // Redis cannot search for query shorter than 2 characters
      const qList = categoriezedQList[category].filter(item => item.length > 1)

      // If the query starts with a plus, it is an exact match
      const optionalQList = qList.filter(item => !item.startsWith('+'))
      const exactQList = qList.filter(item => item.startsWith('+')).map(item => item.slice(1))

      for (const qItem of exactQList) {
        // For category:item, it is an exact match for the tag
        if (category !== '') {
          query = query.and(subQuery => subQuery
            .or('tags').contains(qItem)
          )

        // Otherwise, it is a pattern match for the name, description, author, or tag
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
            // For category:item, it is a match for the tag
            if (category !== '') {
              subQuery = subQuery.or(sub2Query => sub2Query
                .or('tags').contains(qItem)
              )

            // Otherwise, it is a pattern match for the name, description, author, or tag
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
      packages: entities as Package[],
      pageCount
    }
  }
}
