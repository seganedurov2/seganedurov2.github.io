/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The header badge reads the version from package.json instead of a literal in
// App.tsx, so a release bump is one edit and the UI can never drift from it.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const appVersion = process.env.npm_package_version ?? pkg.version

// Agent worktrees (.kilo/worktrees/<name>) are full checkouts of this app. A
// plain `npm test` from the root used to pick their tests up as well and fail on
// half-finished work sitting there. Always avoid them; a worktree can still run
// its own suites explicitly with `npx vitest run src/foo.test.ts`.
const WORKTREE_GLOBS = ['**/.kilo/**', '**/node_modules/**', '**/dist/**']

// https://vite.dev/config/
export default defineConfig({
  test: {
    exclude: WORKTREE_GLOBS
  },
  // Relative base so the build works both at the domain root and under a
  // GitHub Pages project subpath (/<repo>/), e.g. when opened as a
  // Telegram Mini App.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  // Allow localtunnel (loca.lt) hostnames to reach the dev/preview server
  // when testing through a temporary tunnel.
  server: {
    allowedHosts: ['.loca.lt'],
    watch: { ignored: WORKTREE_GLOBS }
  },
  preview: {
    allowedHosts: ['.loca.lt']
  },
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Keep the React runtime separate from the optional 3D scene graph.
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 50,
            },
            {
              // three-stdlib imports `three`; keep it in its own chunk so the
              // Three.js core stays intact in the vendor chunk and does not split
              // across boundaries (which caused "a is not a constructor" at runtime).
              name: 'three-stdlib',
              test: /[\\/]node_modules[\\/]three-stdlib[\\/]/,
              priority: 30,
            },
            {
              name: 'ui-vendor',
              test: /[\\/]node_modules[\\/](lucide-react|clsx)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
            },
            {
              name: 'game-engines',
              test: /[\\/]src[\\/].*Engine\.ts$/,
              priority: 5,
            },
            {
              name: 'game-content',
              test: /[\\/]src[\\/](content|data)[\\/]/,
              priority: 5,
            },
          ],
        },
      },
    },
  },
})
