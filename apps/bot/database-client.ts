import { Package } from './package.js'

export interface DatabaseClient {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  save: (pkg: Package, expiration: number) => Promise<void>
}
