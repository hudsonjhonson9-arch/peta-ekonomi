import { useQuery } from '@tanstack/react-query';

export const api = (url, method = 'GET', body) => fetch(url, {
  method,
  headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

export function useDocs() {
  return useQuery({ queryKey: ['docs'], queryFn: () => api('/api/docs') });
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api('/api/users') });
}

export function useLogs() {
  return useQuery({ queryKey: ['logs'], queryFn: () => api('/api/logs') });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api('/api/kategori-dokumen') });
}

export function useSectors() {
  return useQuery({ queryKey: ['sectors'], queryFn: () => api('/api/sektor') });
}

export function useBidang() {
  return useQuery({ queryKey: ['bidang'], queryFn: () => api('/api/bidang') });
}

export function useIndikator() {
  return useQuery({ queryKey: ['indikator'], queryFn: () => api('/api/indikator') });
}
