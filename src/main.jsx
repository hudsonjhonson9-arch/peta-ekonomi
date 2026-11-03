import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0, // Selalu anggap data perlu disinkronkan langsung dari database
      gcTime: 300_000,
      refetchOnWindowFocus: true, // Saat pengguna kembali ke tab, otomatis tarik data terbaru dari DB
      refetchOnReconnect: true,
    },
  },
});

// Preload peta GeoJSON Sumba Barat agar langsung siap saat buka SPM / Wilayah
fetch('/geojson/5312.min.geojson').catch(() => {});

let root = window.__reactRoot;
if (!root) {
  root = ReactDOM.createRoot(document.getElementById('root'));
  window.__reactRoot = root;
}
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)

export { queryClient }
