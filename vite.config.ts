import { fileURLToPath } from 'node:url'

import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

import manifest from './manifest.config.ts'

const panelInput = fileURLToPath(new URL('./src/devtools/panel.html', import.meta.url))

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: { panel: panelInput },
    },
  },
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
  staged: {
    '*': 'vp check --fix',
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    semi: false,
    singleQuote: true,
  },
})
