/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  // relative to the GitHub Pages subpath when DEPLOY_BASE=/<name>/ is set
  base: process.env.DEPLOY_BASE ?? '/',
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
