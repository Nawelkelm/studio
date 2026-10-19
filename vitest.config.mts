import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig uses `jsx: preserve` (Next.js compiles JSX); tests need the transform themselves
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    // fileURLToPath decodes the spaces in "3D Print Profit" (URL.pathname would leave %20)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
