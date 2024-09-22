import { Package } from './package.js'

export interface PackageFetcher {
  fetch: () => AsyncGenerator<Package>
}
