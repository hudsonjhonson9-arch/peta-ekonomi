# Panduan Pengguna, Bank Data & Fix Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Panduan Pengguna page, Bank Data CRUD + dashboard display, and fix page reload persistence.

**Architecture:** Three independent features: sessionStorage fix (2 lines), Panduan page (new component + nav entries), Bank Data (2 DB tables, 6 API endpoints, 2 components). All follow existing patterns: state-based routing, inline CSS, React Query.

**Tech Stack:** React 18, Vite, Express 5, PostgreSQL (pg), TanStack React Query 5

## Global Constraints

- No new npm dependencies — use existing stack
- Follow existing patterns: inline CSS, state-based routing, React Query hooks in hooks.js, try/catch on API handlers
- Icons from existing Icon component (PATHS in ui.jsx) — no new SVG definitions needed beyond existing set
- Admin-only gating: `user.role === "Admin"`
- All API endpoints unprotected (following existing pattern — no JWT middleware)

---
## Files to touch

- **Create:**
  - `src/components/PanduanPengguna.jsx` — full user guide page
  - `src/components/BankData.jsx` — CRUD management page (Admin)
  - `src/components/BankDataDashboard.jsx` — dashboard table display

- **Modify:**
  - `src/App.jsx` — sessionStorage fix, imports, routing, topbar title
  - `src/components/Sidebar.jsx` — +2 nav entries
  - `src/components/BottomNav.jsx` — +2 nav entries
  - `src/hooks.js` — +useIndikator hook
  - `server/index.js` — +6 indikator endpoints
  - `src/components/Dashboard.jsx` — +Bank Data table section at bottom

- **SQL:**
  - Create 2 tables + seed sample data

---

### Task 1: SQL — Create Bank Data Tables

**Files:**
- Create: SQL script (run via postgres-mcp apply_migration or execute_sql)

- [ ] **Step 1: Write and execute SQL**

```sql
-- Tabel indikator
CREATE TABLE IF NOT EXISTS indikator (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabel nilai per tahun (row-based)
CREATE TABLE IF NOT EXISTS nilai_indikator (
  id SERIAL PRIMARY KEY,
  indikator_id INTEGER NOT NULL REFERENCES indikator(id) ON DELETE CASCADE,
  tahun INTEGER NOT NULL,
  nilai DECIMAL(20,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(indikator_id, tahun)
);

-- Tabel indikator yang tampil di dashboard
CREATE TABLE IF NOT EXISTS indikator_tampil (
  id SERIAL PRIMARY KEY,
  indikator_id INTEGER NOT NULL REFERENCES indikator(id) ON DELETE CASCADE UNIQUE,
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed sample data
INSERT INTO indikator (nama, satuan) VALUES
  ('Prosentase PAD terhadap APBD', '%'),
  ('PDRB Per Kapita', 'Ribu Rp'),
  ('Nilai PDRB', 'Miliar Rp'),
  ('Indeks Ketahanan Pangan', 'Indeks'),
  ('Tingkat Kemiskinan', '%'),
  ('Tingkat Pengangguran Terbuka', '%');
```

- [ ] **Step 2: Seed sample values**

```sql
-- Seed sample values for the demo indicators
INSERT INTO nilai_indikator (indikator_id, tahun, nilai) VALUES
  (1, 2021, 7.94), (1, 2022, 9.16), (1, 2023, 10.04), (1, 2024, 9.53), (1, 2025, 12.31),
  (2, 2021, 12500), (2, 2022, 13200), (2, 2023, 14100), (2, 2024, 14800), (2, 2025, 15600),
  (3, 2021, 4850), (3, 2022, 5120), (3, 2023, 5480), (3, 2024, 5790), (3, 2025, 6200),
  (4, 2021, 72.5), (4, 2022, 74.1), (4, 2023, 75.8), (4, 2024, 77.2), (4, 2025, 79.0),
  (5, 2021, 12.8), (5, 2022, 12.1), (5, 2023, 11.5), (5, 2024, 10.9), (5, 2025, 10.2),
  (6, 2021, 4.2), (6, 2022, 4.5), (6, 2023, 4.1), (6, 2024, 3.8), (6, 2025, 3.5);

-- Show first indicator on dashboard
INSERT INTO indikator_tampil (indikator_id, urutan) VALUES (1, 1);
```

- [ ] **Step 3: Verify**

Run: `SELECT * FROM indikator;` — should show 6 rows
Run: `SELECT * FROM nilai_indikator LIMIT 5;` — should show data

---

### Task 2: Server — Bank Data API Endpoints

**Files:**
- Modify: `server/index.js` (add ~120 lines after kategori-dokumen section, before SPA fallback)

**Interfaces:**
- Consumes: existing `pool`, `queryDB` from server/index.js
- Produces: 6 endpoints consumed by hooks.js

- [ ] **Step 1: Add GET /api/indikator**

Returns all indicators with their values nested. Endpoint positioned after kategori-dokumen block (~line 405) and before SPA fallback (~line 408):

```js
// ── Bank Data: Indikator ──────────────────────────────────────────────────
app.get('/api/indikator', async (_, res) => {
  try {
    const indikator = await queryDB('SELECT * FROM indikator ORDER BY id ASC');
    const result = await Promise.all(indikator.map(async (i) => {
      const nilai = await queryDB(
        'SELECT id, tahun, nilai FROM nilai_indikator WHERE indikator_id = $1 ORDER BY tahun ASC',
        [i.id]
      );
      const tampil = await queryDB(
        'SELECT id FROM indikator_tampil WHERE indikator_id = $1', [i.id]
      );
      return { ...i, nilai, tampil_di_dashboard: tampil.length > 0 };
    }));
    res.json(result);
  } catch (err) {
    console.error('Get indikator error:', err);
    res.status(500).json({ error: 'Gagal mengambil data indikator' });
  }
});
```

- [ ] **Step 2: Add POST /api/indikator**

```js
app.post('/api/indikator', async (req, res) => {
  const { nama, satuan } = req.body;
  if (!nama || !satuan) return res.status(400).json({ error: 'Nama dan satuan wajib diisi' });
  try {
    const result = await queryDB(
      'INSERT INTO indikator (nama, satuan) VALUES ($1, $2) RETURNING *',
      [nama.trim(), satuan.trim()]
    );
    res.json({ message: 'Indikator berhasil ditambahkan', indikator: result[0] });
  } catch (err) {
    console.error('Create indikator error:', err);
    res.status(500).json({ error: 'Gagal menambahkan indikator' });
  }
});
```

- [ ] **Step 3: Add PUT /api/indikator/:id**

```js
app.put('/api/indikator/:id', async (req, res) => {
  const { id } = req.params;
  const { nama, satuan } = req.body;
  if (!nama || !satuan) return res.status(400).json({ error: 'Nama dan satuan wajib diisi' });
  try {
    await queryDB(
      'UPDATE indikator SET nama = $1, satuan = $2, updated_at = NOW() WHERE id = $3',
      [nama.trim(), satuan.trim(), id]
    );
    res.json({ message: 'Indikator berhasil diperbarui' });
  } catch (err) {
    console.error('Update indikator error:', err);
    res.status(500).json({ error: 'Gagal memperbarui indikator' });
  }
});
```

- [ ] **Step 4: Add DELETE /api/indikator/:id**

```js
app.delete('/api/indikator/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM nilai_indikator WHERE indikator_id = $1', [id]);
    await queryDB('DELETE FROM indikator_tampil WHERE indikator_id = $1', [id]);
    await queryDB('DELETE FROM indikator WHERE id = $1', [id]);
    res.json({ message: 'Indikator berhasil dihapus' });
  } catch (err) {
    console.error('Delete indikator error:', err);
    res.status(500).json({ error: 'Gagal menghapus indikator' });
  }
});
```

- [ ] **Step 5: Add POST /api/nilai** (upsert nilai per tahun)

```js
app.post('/api/nilai', async (req, res) => {
  const { indikator_id, tahun, nilai } = req.body;
  if (!indikator_id || !tahun) return res.status(400).json({ error: 'Indikator dan tahun wajib diisi' });
  try {
    // Upsert — insert or update
    await queryDB(
      `INSERT INTO nilai_indikator (indikator_id, tahun, nilai)
       VALUES ($1, $2, $3)
       ON CONFLICT (indikator_id, tahun)
       DO UPDATE SET nilai = $3`,
      [indikator_id, tahun, nilai ?? null]
    );
    res.json({ message: 'Nilai berhasil disimpan' });
  } catch (err) {
    console.error('Upsert nilai error:', err);
    res.status(500).json({ error: 'Gagal menyimpan nilai' });
  }
});
```

- [ ] **Step 6: Add DELETE /api/nilai/:id**

```js
app.delete('/api/nilai/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM nilai_indikator WHERE id = $1', [id]);
    res.json({ message: 'Nilai berhasil dihapus' });
  } catch (err) {
    console.error('Delete nilai error:', err);
    res.status(500).json({ error: 'Gagal menghapus nilai' });
  }
});
```

- [ ] **Step 7: Add GET/POST /api/indikator/tampil**

```js
app.get('/api/indikator/tampil', async (_, res) => {
  try {
    const rows = await queryDB(
      `SELECT i.id, i.nama, i.satuan, n.tahun, n.nilai
       FROM indikator_tampil it
       JOIN indikator i ON i.id = it.indikator_id
       LEFT JOIN nilai_indikator n ON n.indikator_id = i.id
       ORDER BY it.urutan ASC, n.tahun ASC`
    );
    // Group by indikator
    const map = {};
    for (const r of rows) {
      if (!map[r.id]) map[r.id] = { id: r.id, nama: r.nama, satuan: r.satuan, nilai: [] };
      if (r.tahun) map[r.id].nilai.push({ tahun: r.tahun, nilai: r.nilai });
    }
    res.json(Object.values(map));
  } catch (err) {
    console.error('Get tampil error:', err);
    res.status(500).json({ error: 'Gagal mengambil data dashboard' });
  }
});

app.post('/api/indikator/tampil', async (req, res) => {
  const { indikator_id, tampil } = req.body;
  if (!indikator_id) return res.status(400).json({ error: 'Indikator wajib diisi' });
  try {
    if (tampil) {
      const exists = await queryDB('SELECT id FROM indikator_tampil WHERE indikator_id = $1', [indikator_id]);
      if (exists.length === 0) {
        const max = await queryDB('SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM indikator_tampil');
        await queryDB('INSERT INTO indikator_tampil (indikator_id, urutan) VALUES ($1, $2)', [indikator_id, max[0].next]);
      }
    } else {
      await queryDB('DELETE FROM indikator_tampil WHERE indikator_id = $1', [indikator_id]);
    }
    res.json({ message: tampil ? 'Ditampilkan di dashboard' : 'Disembunyikan dari dashboard' });
  } catch (err) {
    console.error('Toggle tampil error:', err);
    res.status(500).json({ error: 'Gagal mengubah pengaturan tampilan' });
  }
});
```

- [ ] **Step 8: Verify with curl/Postman**

Run server, call `GET /api/indikator` — should return array of indikator objects with nilai arrays.

---

### Task 3: Frontend — useIndikator Hook + Fix Reload

**Files:**
- Modify: `src/hooks.js` (+4 lines)
- Modify: `src/App.jsx` (2 lines for fix + imports)

**Interfaces:**
- Produces: `useIndikator()` → `{ data: [...], isLoading }` consumed by BankData.jsx, Dashboard.jsx

- [ ] **Step 1: Add useIndikator hook**

In `src/hooks.js`, after `useCategories`:

```js
export function useIndikator() {
  return useQuery({ queryKey: ['indikator'], queryFn: () => api('/api/indikator') });
}
```

- [ ] **Step 2: Fix reload — sessionStorage in App.jsx**

Line 21: Change `useState("dashboard")` to:
```js
const [page, setPage] = useState(() => sessionStorage.getItem("page") || "dashboard");
```

Line 85: Change `goPage`:
```js
const goPage = p => { setPage(p); setViewDoc(null); sessionStorage.setItem("page", p); };
```

- [ ] **Step 3: Verify fix**

Open app, navigate to "Pencarian", refresh browser — should stay on Pencarian page, not reset to dashboard.

---

### Task 4: Panduan Pengguna Page

**Files:**
- Create: `src/components/PanduanPengguna.jsx`
- Modify: `src/components/Sidebar.jsx` (+1 nav entry)
- Modify: `src/components/BottomNav.jsx` (+1 nav entry)
- Modify: `src/App.jsx` (import, routing, topbar title)

**Interfaces:**
- Consumes: nothing from API — pure static page
- Produces: `<PanduanPengguna />` component rendered in App.jsx

- [ ] **Step 1: Create PanduanPengguna.jsx**

Write rewritten version of PANDUAN.md as a React component. Each section as a card. Clean inline styles matching app design system.

Screenshot approach: use `<div style="background:#f0f7f2;border-radius:8px;padding:12px 16px;font-size:12px;color:#666">` as placeholder boxes labeled with what would be screenshotted (e.g., "Tampilan Dashboard"). Can be replaced with actual screenshots later.

```jsx
import useResponsive from "../useResponsive.js";
import { Icon } from "./ui.jsx";

const SECTIONS = [
  { id: "login", title: "Login", icon: "users" },
  { id: "dashboard", title: "Dashboard", icon: "home" },
  { id: "dokumen", title: "Dokumen", icon: "archive" },
  { id: "detail", title: "Detail & Persetujuan", icon: "eye" },
  { id: "upload", title: "Upload Dokumen", icon: "upload" },
  { id: "pencarian", title: "Pencarian", icon: "search" },
  { id: "publik", title: "Portal Publik", icon: "world" },
  { id: "pengguna", title: "Manajemen Pengguna", icon: "users" },
  { id: "kategori", title: "Kategori Dokumen", icon: "tag" },
  { id: "audit", title: "Audit Trail", icon: "history" },
  { id: "bankdata", title: "Bank Data", icon: "chart" },
  { id: "trouble", title: "Troubleshooting", icon: "x" },
];

// Map section ID to content blocks
const CONTENT = {
  login: {
    desc: "Akses aplikasi dengan NIP dan Password.",
    steps: [
      "Buka aplikasi melalui browser",
      "Masukkan **NIP** (Nomor Induk Pegawai)",
      "Masukkan **Password** (default: admin123)",
      "Klik **Masuk**",
    ],
    note: "Klik salah satu nama akun di halaman login untuk mengisi NIP secara otomatis.",
    screenshot: "LoginPage",
  },
  dashboard: { ... },
  // etc. — full content from PANDUAN.md rewritten
};

export default function PanduanPengguna() {
  const { isMobile } = useResponsive();
  const [activeId, setActiveId] = useState("login");

  const section = CONTENT[activeId];
  if (!section) return null;

  return (
    <div>
      {/* Daftar Isi - horizontal scroll chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ padding: "6px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: activeId === s.id ? 600 : 400, whiteSpace: "nowrap",
              background: activeId === s.id ? "#1a7a4a" : "#f0f0f0", color: activeId === s.id ? "#fff" : "#666" }}>
            <Icon name={s.icon} size={12} style={{ marginRight: 4 }} />{s.title}
          </button>
        ))}
      </div>

      {/* Konten aktif */}
      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24, border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1a3a2a", marginBottom: 4 }}>{section.title}</div>
        {section.desc && <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 14 }}>{section.desc}</p>}

        {section.steps && (
          <ol style={{ paddingLeft: 20, marginBottom: 14 }}>
            {section.steps.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: "#444", marginBottom: 6, lineHeight: 1.5 }}>{s}</li>
            ))}
          </ol>
        )}

        {section.table && (
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              {section.table.header && (
                <thead><tr>{section.table.header.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600 }}>{h}</th>)}</tr></thead>
              )}
              <tbody>{section.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: "6px 10px", borderBottom: "1px solid #f5f5f5", color: "#444" }}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}

        {section.note && (
          <div style={{ background: "#fff8e1", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#f57f17", marginBottom: 14 }}>
            💡 {section.note}
          </div>
        )}

        {section.screenshot && (
          <div style={{ background: "#f0f7f2", borderRadius: 8, padding: "20px 16px", fontSize: 12, color: "#666", textAlign: "center", border: "1px dashed #c8e6c9" }}>
            [ Screenshot: {section.screenshot} ]
          </div>
        )}
      </div>
    </div>
  );
}

Full content is written in the CONTENT object using all 12 sections from PANDUAN.md. Each section has: title, desc (intro paragraph), steps (numbered list), table (optional), note (tip), screenshot (placeholder label for UI area to screenshot). The full CONTENT object is ~120 lines mapping every section from the existing PANDUAN.md exactly.

- [ ] **Step 2: Add nav entry in Sidebar.jsx**

Insert before `pengguna`:
```js
{ key: "panduan",  label: "Panduan",        icon: "file",   },
```

- [ ] **Step 3: Add nav entry in BottomNav.jsx**

Insert after `publik`:
```js
{ key: "panduan",  label: "Panduan",  icon: "file" },
```

- [ ] **Step 4: Wire up in App.jsx**

Import:
```js
import PanduanPengguna from "./components/PanduanPengguna.jsx";
```

Add routing condition after publik (~line 282):
```js
{page === "panduan" && <PanduanPengguna />}
```

Add topbar title (~line 231):
```js
{page === "panduan" && "Panduan Pengguna"}
```

- [ ] **Step 5: Verify**

Navigate to Panduan Pengguna page. All sections load and display.

---

### Task 5: Bank Data Management Page

**Files:**
- Create: `src/components/BankData.jsx`
- Modify: `src/components/Sidebar.jsx` (+1 nav entry)
- Modify: `src/App.jsx` (import, routing, topbar title)

**Interfaces:**
- Consumes: `useIndikator()` from hooks.js
- Consumes: `showToast()` from parent via props (passed from App.jsx)
- Produces: `<BankData onReload={() => queryClient.invalidateQueries(...)} showToast={...} />`

- [ ] **Step 1: Create BankData.jsx**

Full CRUD page with:
- Table of all indicators
- Add form (nama + satuan)
- Inline edit for each indicator
- Expandable section per indicator for nilai per-tahun
- Toggle button for dashboard visibility
- Delete indicator with cascade

```jsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";

export default function BankData({ showToast }) {
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();
  const { data: indikator = [], isLoading } = useQuery({
    queryKey: ['indikator'],
    queryFn: () => fetch('/api/indikator').then(r => r.json())
  });

  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [satuan, setSatuan] = useState("");
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const reload = () => queryClient.invalidateQueries({ queryKey: ['indikator'] });

  const handleAdd = async () => {
    if (!nama.trim() || !satuan.trim()) return showToast("Nama dan satuan wajib diisi");
    const res = await fetch('/api/indikator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim(), satuan: satuan.trim() })
    });
    const json = await res.json();
    if (!res.ok) return showToast(json.error);
    setNama(""); setSatuan(""); setShowForm(false);
    reload();
    showToast("Indikator berhasil ditambahkan");
  };

  const handleEdit = async (id) => {
    if (!nama.trim() || !satuan.trim()) return showToast("Nama dan satuan wajib diisi");
    const res = await fetch(`/api/indikator/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim(), satuan: satuan.trim() })
    });
    if (!res.ok) return showToast((await res.json()).error);
    setEditId(null); setNama(""); setSatuan("");
    reload();
    showToast("Indikator berhasil diperbarui");
  };

  const handleDelete = async (id, nama) => {
    if (!confirm(`Hapus indikator "${nama}" beserta semua nilainya?`)) return;
    const res = await fetch(`/api/indikator/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
    showToast("Indikator berhasil dihapus");
  };

  const handleToggleTampil = async (id, tampil) => {
    const res = await fetch('/api/indikator/tampil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indikator_id: id, tampil })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const handleUpsertNilai = async (indikatorId, tahun, nilai) => {
    const res = await fetch('/api/nilai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indikator_id: indikatorId, tahun, nilai })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const handleDeleteNilai = async (id) => {
    const res = await fetch(`/api/nilai/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  // Collect all unique years from all indicators
  const allYears = [...new Set(indikator.flatMap(i => i.nilai.map(n => n.tahun)))].sort();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Bank Data</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Kelola indikator ekonomi dan data statistik</div>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setNama(""); setSatuan(""); }}
          style={{ padding: "8px 16px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="plus" size={14} /> Tambah Indikator
        </button>
      </div>

      {/* Add/Edit form */}
      {(showForm || editId) && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Nama Indikator</div>
            <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: PDRB Per Kapita"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ width: 120 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Satuan</div>
            <input value={satuan} onChange={e => setSatuan(e.target.value)} placeholder="Contoh: %"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={editId ? () => handleEdit(editId) : handleAdd}
            style={{ padding: "9px 18px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {editId ? "Simpan" : "Tambah"}
          </button>
          <button onClick={() => { setShowForm(false); setEditId(null); setNama(""); setSatuan(""); }}
            style={{ padding: "9px 14px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
            Batal
          </button>
        </div>
      )}

      {/* Indikator list */}
      {indikator.map(i => (
        <div key={i.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", marginBottom: 8, overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}
            onClick={() => setExpandedId(expandedId === i.id ? null : i.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="chart" size={16} style={{ color: "#1a7a4a" }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1a3a2a" }}>{i.nama}</span>
                <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>({i.satuan})</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={e => { e.stopPropagation(); handleToggleTampil(i.id, !i.tampil_di_dashboard); }}
                style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
                  background: i.tampil_di_dashboard ? "#e8f5e9" : "#f5f5f5",
                  color: i.tampil_di_dashboard ? "#2e7d32" : "#999" }}>
                {i.tampil_di_dashboard ? "Tampil" : "Sembunyi"}
              </button>
              <button onClick={e => { e.stopPropagation(); setEditId(i.id); setNama(i.nama); setSatuan(i.satuan); setShowForm(false); }}
                style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "#888" }}>
                <Icon name="edit" size={14} />
              </button>
              <button onClick={e => { e.stopPropagation(); handleDelete(i.id, i.nama); }}
                style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "#c62828" }}>
                <Icon name="x" size={14} />
              </button>
              <Icon name="chevronRight" size={14} style={{ color: "#ccc", transform: expandedId === i.id ? "rotate(90deg)" : "", transition: "transform .2s" }} />
            </div>
          </div>

          {/* Expanded: Nilai per tahun */}
          {expandedId === i.id && (
            <div style={{ borderTop: "1px solid #f0f0f0", padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 10 }}>Nilai per Tahun</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[2021, 2022, 2023, 2024, 2025].map(tahun => {
                  const existing = i.nilai.find(n => n.tahun === tahun);
                  return (
                    <NilaiRow key={tahun}
                      tahun={tahun}
                      nilai={existing?.nilai ?? ""}
                      nilaiId={existing?.id}
                      onSave={(nilai) => handleUpsertNilai(i.id, tahun, nilai || null)}
                      onDelete={existing?.id ? () => handleDeleteNilai(existing.id) : null}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NilaiRow({ tahun, nilai, onSave, onDelete }) {
  const [val, setVal] = useState(nilai ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    onSave(val === "" ? null : val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 50, fontSize: 13, fontWeight: 600, color: "#444" }}>{tahun}</div>
      <input value={val} onChange={e => setVal(e.target.value)} type="number" step="any" placeholder="Nilai"
        style={{ flex: 1, maxWidth: 200, padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, outline: "none" }} />
      <button onClick={save}
        style={{ padding: "7px 14px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {saved ? "✓ Tersimpan" : "Simpan"}
      </button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: "7px 10px", background: "#ffebee", color: "#c62828", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
          Hapus
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add nav entry in Sidebar.jsx**

Add after `publik`:
```js
{ key: "bankdata", label: "Bank Data",       icon: "chart",  adminOnly: true },
```

- [ ] **Step 3: Add nav entry in BottomNav.jsx**

(Optional — keep mobile nav simple, no admin-only items in bottom nav. User can access Bank Data from sidebar.)

- [ ] **Step 4: Wire up in App.jsx**

Import:
```js
import BankData from "./components/BankData.jsx";
```

Routing (~line 288):
```js
{page === "bankdata" && user.role === "Admin" && (
  <BankData showToast={showToast} />
)}
```

Topbar title (~line 232):
```js
{page === "bankdata" && "Bank Data"}
```

- [ ] **Step 5: Verify**

Login as Admin, navigate to Bank Data. Add/edit/delete indicator. Add nilai values. Toggle dashboard visibility.

---

### Task 6: Bank Data Dashboard Section

**Files:**
- Modify: `src/components/Dashboard.jsx`

**Interfaces:**
- Consumes: nothing new — Dashboard gets data from direct fetch or props
- Produces: Bank Data table section below recent docs

- [ ] **Step 1: Create BankDataDashboard.jsx**

New component for the dashboard table, fetched independently:

```jsx
import { useQuery } from "@tanstack/react-query";
import useResponsive from "../useResponsive.js";

export default function BankDataDashboard() {
  const { isMobile } = useResponsive();
  const { data: indikator = [] } = useQuery({
    queryKey: ['indikator-tampil'],
    queryFn: () => fetch('/api/indikator/tampil').then(r => r.json()),
    staleTime: 60_000,
  });

  if (indikator.length === 0) return null;

  const allYears = [...new Set(indikator.flatMap(i => i.nilai.map(n => n.tahun)))].sort();

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8", marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 14 }}>Bank Data</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>Indikator</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>Satuan</th>
              {allYears.map(y => (
                <th key={y} style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indikator.map(i => (
              <tr key={i.id}>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", fontWeight: 500, color: "#1a3a2a" }}>{i.nama}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", color: "#888", fontSize: 12 }}>{i.satuan}</td>
                {allYears.map(y => {
                  const n = i.nilai.find(v => v.tahun === y);
                  return (
                    <td key={y} style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", textAlign: "right", fontWeight: 600, color: "#1a7a4a" }}>
                      {n ? n.nilai : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to Dashboard.jsx**

Import at top:
```js
import BankDataDashboard from "./BankDataDashboard.jsx";
```

Insert before the recent docs section (~line 88):
```jsx
<BankDataDashboard />
```

- [ ] **Step 3: Verify**

Toggle indicators to show on dashboard via Bank Data management page. Navigate to Dashboard — Bank Data table appears with selected indicators. Hide all — section disappears.

---

### Task 7: Integration & Final Test

- [ ] **Step 1: Run the app**

```bash
npm run dev
```

- [ ] **Step 2: Test all features**
  1. Login as Admin
  2. Navigate to a page, refresh browser — stays on that page
  3. Open Panduan Pengguna — all sections render
  4. Open Bank Data — add/edit/delete indicators, input nilai
  5. Toggle indicators to show on dashboard
  6. Go to Dashboard — Bank Data table visible
  7. Login as Staf — Bank Data nav hidden
  8. Login as Staf — Dashboard shows Bank Data table
