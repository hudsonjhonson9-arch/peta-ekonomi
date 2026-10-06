# Plan: Screening RKA — Standar Harga (SSH/SBU) + Draft Rincian Belanja

Status: FINAL — siap eksekusi (mode: subagent per task).
Repo: `D:\Code\peta-ekonomi` → https://github.com/hudsonjhonson9-arch/peta-ekonomi

## Keputusan (terjawab user)

- Scope V1 (Tasks 1–6): upload Excel + accordion Program→Kegiatan→Sub Kegiatan + daftar standar harga; **tanpa** perhitungan rincian otomatis.
- Upload Excel: parse **client-side** (`xlsx`), **replace-all** per (tahun, jenis); preview dulu sebelum replace.
- Menu: item sidebar **Perencanaan**, label "Screening RKA", icon `filter` (ada di ui.jsx:63), terlihat semua role.
- Filter: **per kode rekening** — admin menetapkan chips rekening per sub kegiatan; chips kosong = tampilkan semua + notice.
- Pagu: input manual per sub kegiatan, **Admin saja**.
- Fase 2 (Tasks 7–10): draft rincian per sub kegiatan, pencocokan standar harga manual, screening rencana vs pagu.
- **Akses CRUD draft rincian: LOGIN** (semua staf); pagu & chips tetap ADMIN.
- Eksekusi: **subagent per task** (brief dari file ini, review sebelum task berikut).
- Push **2 titik**: akhir Task 6 (V1) dan akhir Task 10 (fase 2).

## Fakta kode terverifikasi (anchor absolut)

- Rantai migration berakhir `jalankanMigration('tahap_6', ...)` di `server/index.js:412` → sisip tahap_7 (Task 1) dan tahap_8 (Task 7) setelahnya.
- `GET /api/pks/tree` `server/index.js:1661`; sub SELECT `server/index.js:1673` = `SELECT id, kegiatan_id, kode, nama, urutan, indikator, target` → tambah `pagu, kode_rekening`.
- `PUT /api/pks/:level/:id` `server/index.js:2023` — kebijakan sudah ADMIN (`kebijakan.js:55`) → perluan `pagu`/`kode_rekening` otomatis admin-only.
- Kebijakan: helper `const t = (m, lvl, pola) => ({m, lvl, pola: new RegExp('^'+pola+'$')})` (`kebijakan.js:24`); exports `PUBLIK/LOGIN/REVIEW/ADMIN` (16–19); route tak terdaftar = LOGIN; blok bankdata di lines 92-96 → sisip aturan standar-harga setelahnya.
- `src/hooks.js`: helper `api(url, method='GET', body)` line 3; hooks berakhir `useKertasKerja` line 168 → sisip hook baru setelah `usePksDeadlineTerdekat` (line 157).
- `KertasKerja.jsx`: `Panel:274`, `SubKey:297` (fork referensi); `admin = canManageOutput(user.role)` line 39 — ** ScreeningRKA pakai helper yang sama**, dari `src/data.js:230`.
- `src/data.js`: group Perencanaan lines 83–88 (kertas-kerja, bankdata) → sisip menu **setelah line 88**.
- `src/App.jsx`: judul `page === "kertas-kerja" && "Kertas Kerja"` line 1006; render block line 1080; `showToast` tersedia.
- `pks_subkegiatan` (`server/migrations/tahap_2.sql:51-64`): belum ada `pagu`/`kode_rekening` → ditambah tahap_7.
- **Tidak ada** formatter rupiah di `src/` → definisikan lokal di `ScreeningRKA.jsx`.
- `package.json`: tanpa `xlsx`, tanpa lint script; deps: express ^5.2.1, react 18, @tanstack/react-query 5, pg, cors, dotenv, bcryptjs, concurrently, pdfjs-dist, qrcode; dev: vite ^5.4, @vitejs/plugin-react.
- `window.confirm`/`confirm(` pola umum (BankData.jsx:59 dll) — boleh dipakai.
- `CariPilih` (`ui.jsx:171`): `value/onChange/opsi[{label,value,hint}]`.
- Reference: `D:\Code\apbd-perubahan\src\lib\parseStandarHarga.ts` HEADER_MAP lines 15-25; `RincianItem` di `src/types/index.ts:53-83`; deps `xlsx@^0.18.5`.

## Kontrak antar-task (dikunci)

- `useStandarHarga({tahun, jenis, q, rekening})` → `{data: item[], isLoading}`; **`q` falsy = tanpa pencarian** (jangan query LIKE). Kembalikan array langsung (bukan `{data}`) — Task 9 memakainya top-5.
- `GET /api/standar-harga?tahun=&jenis=&q=&rekening=` → **array langsung** `{…item}`.
- `POST /api/standar-harga/upload` body `{tahun, jenis, items[]}` → replace-all, balas `{ok, n}`.
- `GET /api/draft-rincian?subkegiatan_id=` → `{items, total}`; POST/PUT/DELETE → `{ok, id?}`; body item: `{id?, subkegiatan_id, uraian, spesifikasi?, satuan, volume, harga_satuan, kode_rekening?, standar_harga_id?, catatan?}`; total = `Σ round(volume × harga_satuan)` server-side (helper `jumlahItem`).
- Chips sub kegiatan: `pks_subkegiatan.kode_rekening TEXT[]` (kosong = semua).

---

## FASE 1 — V1 (Tasks 1–6)

### Task 1 — Migration `tahap_7`

`server/migrations/tahap_7.sql`:

```sql
-- standar_harga: SSH/SBU dari SIPD (replace per tahun+jenis)
CREATE TABLE IF NOT EXISTS standar_harga (
  id BIGSERIAL PRIMARY KEY,
  tahun INT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('SSH','SBU')),
  kode_kelompok TEXT,
  uraian_kelompok TEXT,
  id_standar_harga TEXT,
  kode_barang TEXT,
  uraian_barang TEXT NOT NULL,
  spesifikasi TEXT,
  satuan TEXT,
  harga_satuan NUMERIC(15,2) NOT NULL CHECK (harga_satuan >= 0),
  kode_rekening TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS standar_harga_cari ON standar_harga (tahun, jenis, lower(uraian_barang));
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS pagu NUMERIC(15,2);
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS kode_rekening TEXT[];
```

Di `server/index.js` setelah line 412 (`tahap_6`): `jalankanMigration('tahap_7', ['standar_harga'], …)` — cek bentuk `jalankanMigration` (argumen kedua = tabel wajib) dan ikuti pola tahap_6; fallback toleran `pks_subkegiatan` kolom baru sesuai pola proyek.

Cekpoint: `node --check server/index.js`.

### Task 2 — Helper + uji

`server/standar-harga.js`:

```js
export const HEADER_MAP = {
  "KODE KELOMPOK BARANG": "kode_kelompok", "KELOMPOK": "kode_kelompok",
  "URAIAN KELOMPOK BARANG": "uraian_kelompok",
  "ID STANDAR HARGA": "id_standar_harga",
  "KODE BARANG": "kode_barang",
  "URAIAN BARANG": "uraian_barang", "NAMA BARANG": "uraian_barang",
  "SPESIFIKASI": "spesifikasi",
  "SATUAN": "satuan", "SATUAN JASA": "satuan",
  "HARGA SATUAN": "harga_satuan", "HARGA": "harga_satuan",
  "KODE REKENING": "kode_rekening",
};
// normalisasi header: trim, uppercase, hapus "(...)", spasi→spasi tunggal
export function validasiUpload(tahun, jenis, rows) → {ok: true, items} | {ok: false, error}
// wajib: tahun int, jenis in ['SSH','SBU'], uraian_barang tidak kosong,
// harga_satuan di-coerce (buang "Rp", titik ribuan, koma desimal) jadi number ≥ 0;
// baris tanpa uraian_barang dilewati; jika semua baris gugur → error.
export function filterDaftar(daftar, { q, rekening }) → daftar terfilter
// q: ILIKE uraian_barang/spesifikasi/kode_barang; rekening: string → cocok kode_rekening (exact)
```

`server/standar-harga.uji.mjs` — 6 assert (pola `*.uji.mjs` lain, `process.exitCode=1` bila gagal, cetak `6 uji lulus`):
1. HEADER_MAP mengenali header kotor (`" Uraian Barang (wajib) "`).
2. validasi: baris valid lolos semua field.
3. validasi: harga "1.500.500,00" → 1500500.
4. validasi: uraian kosong di-skip; semua gugur → `{ok:false}`.
5. validasi: jenis tak dikenal → `{ok:false}`.
6. filterDaftar: q + rekening menyaring benar; q kosong = semua.

Cekpoint: `node server/standar-harga.uji.mjs` → `6 uji lulus`; `node --check` semua file server yang diubah.

### Task 3 — Route + hook

`server/index.js` (import helper; route section, pisah dari pks):

```js
// GET /api/standar-harga?tahun=&jenis=&q=&rekening= → SELECT * … ORDER BY uraian_barang LIMIT 500
// POST /api/standar-harga/upload {tahun, jenis, items} → validasiUpload;
//   DELETE FROM standar_harga WHERE tahun=$1 AND jenis=$2; batch INSERT (chunks 200); balas {ok:true,n}
```

`server/kebijakan.js` setelah blok bankdata (line ~96):

```js
t('GET', LOGIN, '/api/standar-harga'),
t('POST', ADMIN, '/api/standar-harga/upload'),
```

`src/hooks.js` setelah `usePksDeadlineTerdekat`:

```js
export const useStandarHarga = ({ tahun, jenis, q, rekening }) => useQuery({
  queryKey: ['standar-harga', tahun, jenis, q || '', rekening || ''],
  queryFn: () => api(`/api/standar-harga?${new URLSearchParams(Object.entries({ tahun, jenis, q: q || undefined, rekening: rekening || undefined }).filter(([,v]) => v))}`),
  enabled: !!tahun && !!jenis,
});
```

Cekpoint: `node --check` (server), lanjut Task 4 (build di akhir Task 5).

### Task 4 — Halaman `ScreeningRKA.jsx`

File baru `src/components/ScreeningRKA.jsx`:

- `rupiah(n)` lokal: `n==null ? "—" : "Rp " + Math.round(n).toLocaleString('id-ID')`.
- `admin = canManageOutput(user.role)` (impor dari `../data.js`).
- Fork struktur **Panel/SubKey dari KertasKerja.jsx:274/:297** (baca dulu file-nya; jangan ubah KertasKerja): daftar tahun → tree `usePksTree({tahun})` → accordion Program → Kegiatan → Sub Kegiatan (kode+nama+indikator).
- Sub kegiatan terbuka → **DetailSub**:
  - Input **pagu** (Admin): simpan via `PUT /api/pks/subkegiatan/:id` body `{pagu}`.
  - **Chips kode rekening** (Admin): editor chips (tekan Enter/koma tambah, × hapus), array of string, simpan via `PUT /api/pks/subkegiatan/:id` `{kode_rekening: [...]}`.
  - Non-admin: lihat chips saja.
- `useRekeningOpsi` tidak perlu terpisah — opsional: derive dari chips sub aktif.
- Route App.jsx: import (dekat KertasKerja import line 58), judul di line ~1006 (`page === "screening" && "Screening RKA"`), render block setelah line 1086 dengan `showToast` line 1083.
- `src/data.js` line 88: `{ key: "screening", label: "Screening RKA", icon: "filter" }`.
- `package.json`: tambah `"xlsx": "^0.18.5"` → `npm install`.

### Task 5 — Tabel standar harga + upload

Di dalam `DetailSub` (masih Task 4 file):

- **Rekening aktif** = sub kegiatan aktif dari tree (kode rekening aktif).
- `<TabelStandarHarga tahun sub>`: `useStandarHarga({tahun, jenis, q, rekening})` — `rekening` = chips sub (array→join? kontrak string; pakai chips[0]? **tidak**): kontrak `rekening` menerima string — untuk multi-chips: kirim `rekening=chips.join(',')` dan server split(','). *Catatan: Task 3 server split rekening by comma.*
  - chips kosong → tanpa `rekening` + notice "Belum ada rekening — menampilkan semua data".
  - kolom: Uraian, Spesifikasi, Satuan, Harga (rupiah), Kode Rekening; search box (debounce 300ms) mengisi `q`.
- **Panel Upload (Admin)**: `<input type=file accept=".xlsx,.xls">` → `XLSX.read` → sheet pertama → `sheet_to_json({header:1})` → baris pertama = header → map lewat `HEADER_MAP` (impor dari server? **tidak bisa** — duplikasi peta di file upload ini atau ekspor ke file shared `src/lib/headerMap.js` yang diimpor berdua; pilih: buat `src/uploadStandarHarga.js` berisi `HEADER_MAP` + `parseRows` client-side, dan `server/standar-harga.js` import-from-copy? ESM lintas folder server↔src bisa bermasalah di build. **Keputusan: duplikasi peta header di dua tempat dengan komentar `// WAJIB sinkron dengan server/standar-harga.js`** (ponytail: 1 baris kontrak, sinkronkan saat berubah).)
  - Preview 5 baris pertama + jumlah baris → tombol "Ganti data (replace)" → konfirmasi `confirm(...)` → `POST /api/standar-harga/upload` → invalidate `['standar-harga']` → toast sukses.
  - Jenis: pilihan `SSH`/`SBU`; tahun dari tahun aktif.

Cekpoint: `npm run build`.

### Task 6 — Catatan + push

- `CATATAN_FEAT.md`: blok `## REQ SCREENING RKA (V1)` — menu, upload replace, pagu+chips (admin), filter rekening, table.
- Commit: `feat: screening rka — standar harga ssh/sbu + filter rekening per sub kegiatan`. **git push** (titan akhir V1, minta konfirmasi bila remote minta auth).

---

## FASE 2 — Draft Rincian (Tasks 7–10)

### Task 7 — Migration `tahap_8` + helper + uji

`server/migrations/tahap_8.sql`:

```sql
-- draft_rincian: rencana belanja per sub kegiatan (LOGIN CRUD)
CREATE TABLE IF NOT EXISTS draft_rincian (
  id BIGSERIAL PRIMARY KEY,
  subkegiatan_id BIGINT NOT NULL REFERENCES pks_subkegiatan(id) ON DELETE CASCADE,
  urutan INT NOT NULL DEFAULT 0,
  uraian TEXT NOT NULL,
  spesifikasi TEXT,
  satuan TEXT NOT NULL,
  volume NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (volume > 0),
  harga_satuan NUMERIC(15,2) NOT NULL CHECK (harga_satuan >= 0),
  kode_rekening TEXT,
  standar_harga_id BIGINT REFERENCES standar_harga(id) ON DELETE SET NULL,
  harga_standar NUMERIC(15,2),           -- snapshot saat dicocokkan
  catatan TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draft_rincian_sub_idx ON draft_rincian (subkegiatan_id, urutan);
```

`server/index.js` setelah tahap_7: `jalankanMigration('tahap_8', ['draft_rincian'], …)`.

`server/draft-rincian.js`:

```js
export function validasiItem(body) {
  // → {ok: true, item} | {ok: false, error}
  // wajib: uraian (string, trim, maks 500), satuan (trim), volume number > 0,
  // harga_satuan number >= 0; opsional: spesifikasi, kode_rekening (trim),
  // standar_harga_id (integer|null), harga_standar (number|null), catatan (trim)
}
export const jumlahItem = (volume, harga) => Math.round(volume * harga); // rupiah pembulatan
```

`server/draft-rincian.uji.mjs` — 6 assert, cetak `6 uji lulus`:
1. item valid → ok, ter-coerce (volume "2" → 2).
2. uraian kosong → error.
3. volume ≤ 0 → error.
4. harga negatif → error.
5. semua field opsional hilang → ok (defaults).
6. `jumlahItem(2.5, 1500000)` = 3750000.

Cekpoint: `node server/draft-rincian.uji.mjs` + `node --check`.

### Task 8 — Route draft rincian + kebijakan

`server/index.js`:

```js
// GET /api/draft-rincian?subkegiatan_id= → {items:[...], total: Σ jumlahItem}
//   ORDER BY urutan, id; 404 bila subkegiatan_id kosong
// POST /api/draft-rincian → validasiItem; urutan = (max urutan)+1; created_by = req.pengguna?.id
// PUT /api/draft-rincian/:id → validasiItem (tanpa subkegiatan_id) → update, updated_at=now()
// DELETE /api/draft-rincian/:id → DELETE … RETURNING id → {ok:true, id}
// semua: cek baris ada, id transaksi aman; param id = integer cast aman (parseInt / cek regex)
```

`server/kebijakan.js` (setelah aturan standar-harga Task 3):

```js
// Draft rincian: semua staf boleh susun rencana (keputusan user 2026-10-06)
t('GET', LOGIN, '/api/draft-rincian'),
t('POST', LOGIN, '/api/draft-rincian'),
t('PUT', LOGIN, '/api/draft-rincian/[^/]+'),
t('DELETE', LOGIN, '/api/draft-rincian/[^/]+'),
```

`src/hooks.js`:

```js
export const useDraftRincian = (subkegiatanId) => useQuery({
  queryKey: ['draft-rincian', subkegiatanId],
  queryFn: () => api(`/api/draft-rincian?subkegiatan_id=${subkegiatanId}`),
  enabled: !!subkegiatanId,
});
```

Cekpoint: `node --check` + jalankan kedua `.uji.mjs` (6+6).

### Task 9 — UI `DraftRincian` (3 patch bug WAJIB)

Komponen baru di `ScreeningRKA.jsx`, ditempatkan di DetailSub **antara chips rekening dan TabelStandarHarga**:

- `<DraftRincian T tahun sub admin>`: `useDraftRincian(sk.id)`; state `editId` (null | id), `form` (null | item copy), `tambahBuka` (bool), `cocok` (null | `{key, q}`).
- **Baris tampil** (`Baris`): uraian, spesifikasi, satuan × volume, harga_satuan, kode_rekening, total (`jumlahItem` klien: `Math.round(volume*harga)`), tombol Edit/Hapus (selalu bisa — staf), "Cocokkan" → **PATCH-1: `onCocok = () => { setEditId(it.id); setForm({...it}); setCocok({ key: it.id, q: it.uraian }); }`** (panel ada di FormBaris → wajib masuk mode edit dulu).
- **FormBaris** (`FormBaris` — shared untuk tambah & edit): input uraian/spesifikasi/satuan/volume/harga_satuan/kode_rekening/catatan; footer total live (r*upiah(Math.round(volume*harga))`);
  **PATCH-2 (panel cocok):** `const key = init.id ?? "baru"; const aktifCocok = cocok?.key === key; const qCocok = aktifCocok ? cocok.q : "";` — tombol "Cocokkan" di form: `setCocok({key, q: (form.uraian||"")})`. (Jangan pakai `init.id != null` — form baru tidak pernah cocok.)
  Simpan: `init.id` ada → PUT, tidak ada → POST → invalidate `['draft-rincian', sk.id]`.
- **Panel pencocokan** (saat `aktifCocok`): `useStandarHarga({tahun, jenis: 'SSH', q: qCocok, rekening: form.kode_rekening || (chips[0] ?? null)})` → daftar **top-5**: uraian, harga_standar; klik → isi `standar_harga_id`, `harga_standar`, dan bila `harga_satuan` kosong/0 isi harga; tombol "Tanpa standar" → `standar_harga_id=null, harga_standar=null`.
  - `rekening` kontrak string; kalau chips > 1 kirim chips[0]? **Tidak** — kirim `undefined` lalu filter klien top-5 dengan chips.includes(kode). Ponytail: klien sudah punya data, filter lokal 5 baris.
  - **Tanpa fuzzy** (skip `string-similarity-js`), tanpa hierarki kelompok/akun, tanpa PPN.
- **PATCH-3 (display null):** `it.harga_satuan == null ? "—" : rupiah(it.harga_satuan)` dan sebaliknya — jangan `rupiah(x) || "—"` (rupiah null-unsafe).
- Hapus baris: `confirm()` → DELETE.
- Loading/empty: "Belum ada rencana belanja" + tombol "+ Tambah baris".

Cekpoint: `npm run build`.

### Task 10 — Ringkasan rencana vs pagu + catatan + push

- `<RingkasanPagu>` di atas `DraftRincian` (setelah blok pagu): pakai `useDraftRincian(sk.id)` (react-query dedup cache — query sama, tidak dobel fetch), `totalRencana = Σ jumlahItem`, pagu dari sub aktif.
  - Status (klien): `< 90%` → "Aman" (hijau); `90–100%` → "Mendekati" (kuning); `> 100%` → "Melebihi" (merah). Pagu null → tampilkan total saja + "Pagu belum diisi".
  - Tampil: pagu, total rencana, sisa (pagu − total), persentase, badge status.
- `CATATAN_FEAT.md`: blok `## REQ SCREENING RKA — FASE 2 (draft rincian)`.
- Commit + **push** (milestone akhir): `feat: draft rincian belanja + screening rencana vs pagu`.

---

## Protokol eksekusi (subagent per task)

1. Per task: dispatch subagent `general` dengan brief = kutipan Task N dari file ini + fakta anchor; subagent WAJIB: baca file target dulu, tulis kode, jalankan cekpoint task, laporkan diff singkat + hasil cekpoint. Jangan commit — saya review dulu.
2. Saya review hasil (baca diff), commit sendiri bila lolos, lanjut task berikutnya.
3. Cekpoint wajib tiap task: `node --check` file server yang disentuh; `node server/standar-harga.uji.mjs` (Task 2+) & `node server/draft-rincian.uji.mjs` (Task 7+); `npm run build` (Task 4+ setiap perubahan src).
4. Push hanya di akhir Task 6 dan Task 10.
5. Larangan: jangan ubah `KertasKerja.jsx` (fork saja); jangan commit secret; jangan `git push` di luar milestone.
