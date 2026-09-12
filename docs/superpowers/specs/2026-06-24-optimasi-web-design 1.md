# Optimasi Web Peta Ekonomi

## Masalah
1. **Loading data lambat** — halaman dashboard, daftar dokumen, pencarian terasa lambat
2. **Upload dokumen tidak ada progress** — user tidak tahu status upload
3. **Tidak ada metadata file pre-upload** — user tidak bisa lihat nama/ukuran/tipe file sebelum upload

## Pendekatan
**B — React Query untuk data layer** (dipilih user).

## Dependencies
- `@tanstack/react-query` — caching, loading state, background refetch otomatis

## Design

### 1. Data Layer — React Query
- Bungkus root App dengan `QueryClientProvider`
- Default: `retry: 1`, `staleTime: 30 detik`
- Semua `useEffect` + `fetch` pattern diganti dengan `useQuery` hooks
- Komponen affected: `DocPages`, `Dashboard`, `Pencarian`, `PortalPublik`, `ManajemenPengguna`, `ManajemenKategoriDokumen`
- Server: tambah `LIMIT/OFFSET` di endpoint `/api/docs` untuk pagination

### 2. Upload UX — Progress Bar + File Metadata
- **Pre-upload**: saat user pilih file, tampilkan nama, ukuran (format otomatis KB/MB), tipe dari `File` object
- **Progress**: ganti `fetch` dengan `XMLHttpRequest` + `upload.onprogress` untuk progress bar real-time
- **Visual**: progress bar CSS `width: ${progress}%`

### 3. Code Cleanup
- Hapus endpoint `/api/upload-proxy` (48 baris) + import `https`/`url` di server
- Hapus `INITIAL_DOCS`, `INITIAL_USERS`, `INITIAL_LOGS` dari data.js
- Simplify `mapRoleToFrontend`/`mapRoleToDb` jadi lookup object
- `git rm --cached dist/*` + `.gitignore`

## Implementation Order
1. Code cleanup (safe, no functional change)
2. Install React Query + setup QueryClientProvider
3. Migrate data fetching ke useQuery (DocPages, Dashboard, Pencarian, dll)
4. Upload UX: file metadata + progress bar
5. Build + deploy test

## Files Changed
- `package.json` — add @tanstack/react-query
- `src/App.jsx` — QueryClientProvider wrapper
- `src/App.jsx` — handleUpload: ganti fetch ke XHR
- `src/components/UploadForm.jsx` — file metadata pre-upload, progress bar
- `src/components/DocPages.jsx` — useQuery hooks
- `src/components/Dashboard.jsx` — useQuery hooks
- `src/components/Pages.jsx` — useQuery hooks (Pencarian, PortalPublik, ManajemenPengguna, ManajemenKategoriDokumen)
- `src/data.js` — hapus INITIAL_* constants
- `server/index.js` — hapus proxy, imports, simplify role mapping
- `.gitignore` — tambah dist/
