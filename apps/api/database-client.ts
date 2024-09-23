import { Package } from './package.js'

export interface DatabaseClient {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  fetch: (source: string, identifier: string) => Promise<Package | undefined>
  search: (q: string, perPage: number, page: number, sort: 'hotness' | 'updated', order: 'asc' | 'desc') => Promise<Package[]>
}
