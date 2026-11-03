import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 120_000,
      gcTime: 600_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Preload peta GeoJSON Sumba Barat agar langsung siap saat buka SPM / Wilayah
fetch('/geojson/5312.min.geojson').catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)

export { queryClient }
