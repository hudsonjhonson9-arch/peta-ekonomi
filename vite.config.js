import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base URL: default ke '/umadata/' untuk integrasi portal utama bapperidasb,
// atau '/' bila dijalankan standalone murni (VITE_BASE=/)
const base = process.env.VITE_BASE || '/umadata/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
          if (id.includes('html2pdf') || id.includes('html2canvas') || id.includes('jspdf')) return 'vendor-pdfgen';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
