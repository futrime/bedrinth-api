import { Package } from './package.js'

export interface DatabaseClient {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  savePackage: (pkg: Package, expiry: Date) => Promise<void>
}
