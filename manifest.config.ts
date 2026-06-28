import { defineManifest } from '@crxjs/vite-plugin'

import pkg from './package.json' with { type: 'json' }

export default defineManifest({
  manifest_version: 3,
  name: 'GraphQL Mock',
  version: pkg.version,
  description: pkg.description,
  permissions: ['storage'],
  host_permissions: ['<all_urls>'],
  devtools_page: 'src/devtools/devtools.html',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/main-world/injected.ts'],
      world: 'MAIN',
      run_at: 'document_start',
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content/bridge.ts'],
      run_at: 'document_start',
    },
  ],
})
