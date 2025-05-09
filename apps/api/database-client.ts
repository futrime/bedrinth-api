import { Package } from './package.js'

export interface DatabaseClient {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  fetch: (source: string, identifier: string) => Promise<Package | null>
  search: (q: string, perPage: number, page: number, sort: 'hotness' | 'updated', order: 'asc' | 'desc') => Promise<{ packages: Package[], pageCount: number }>
}
