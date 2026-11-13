import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './global.css'
import App from './App.jsx'

// Intercept fetch untuk otomatis menyesuaikan endpoint jika berjalan di bawah subpath /umadata atau /arsip
const _fetchAsli = window.fetch;
window.fetch = function(input, init) {
  const currentPath = window.location.pathname;
  const isUmaData = currentPath.startsWith('/umadata');
  const isArsip = currentPath.startsWith('/arsip');
  const prefix = isUmaData ? '/umadata' : (isArsip ? '/arsip' : '');

  if (prefix) {
    if (typeof input === 'string') {
      if (!input.startsWith(prefix + '/')) {
        if (input.startsWith('/api/') || input.startsWith('/geojson/') || input.startsWith('/icon.')) {
          input = prefix + input;
        }
      }
    } else if (input instanceof Request) {
      try {
        const u = new URL(input.url);
        if (u.origin === window.location.origin && !u.pathname.startsWith(prefix + '/')) {
          if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/geojson/') || u.pathname.startsWith('/icon.')) {
            input = new Request(prefix + u.pathname + u.search, input);
          }
        }
      } catch (_) {}
    }
  }
  return _fetchAsli.call(this, input, init);
};

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
