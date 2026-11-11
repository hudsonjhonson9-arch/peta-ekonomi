import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base URL: default ke '/umadata/' untuk integrasi portal utama bapperidasb,
// atau '/' bila dijalankan standalone murni (VITE_BASE=/)
const base = process.env.VITE_BASE || '/umadata/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
