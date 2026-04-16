import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || '/tmp/vite-cache',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    exclude: ['**/node_modules/**', '**/dist/**', 'backend/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**'],
    },
  },
  server: {
    host: '0.0.0.0',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    proxy: {
      '/api/geocode-llm': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        proxyTimeout: 60000,
        timeout: 60000,
      },
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        proxyTimeout: 65000,
        timeout: 65000,
      },
    },
  },
})
