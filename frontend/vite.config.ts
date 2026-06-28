import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    // Remove console.log and debugger statements in production
    minify: 'esbuild',
    ...(mode === 'production' && {
      esbuild: {
        drop: ['debugger'],
        pure: ['console.log', 'console.debug', 'console.info', 'console.warn'],
      },
    }),
  },
}))
