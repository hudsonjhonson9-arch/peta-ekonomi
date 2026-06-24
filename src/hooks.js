import { useQuery } from '@tanstack/react-query';

const api = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

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
