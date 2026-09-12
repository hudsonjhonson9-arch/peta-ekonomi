# Optimasi Web Peta Ekonomi — Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Improve data loading speed, add upload progress bar with file metadata, remove dead code.

**Architecture:** Add React Query for data layer (caching, loading states, refetch). Replace `fetch` with `XMLHttpRequest` for upload progress. Minimal structural changes — React Query cache replaces `useState` + `useEffect` for data fetching, but component tree stays the same shape.

**Tech Stack:** React 18, Express 5, PostgreSQL, @tanstack/react-query

## Global Constraints
- Only new dep: @tanstack/react-query
- All existing routes and behavior unchanged
- Upload flow remains Frontend → GAS → Express

---

### Task 1: Cleanup — dead code & unused track

**Files:**
- Modify: `src/data.js` — lines 46-48
- Modify: `src/App.jsx` — lines 9, 18-20
- Modify: `server/index.js` — lines 7-8, 149-196
- Modify: `.gitignore`
- Run: `git rm --cached dist/icon.svg dist/index.html`

**Rationale:** `INITIAL_DOCS/USERS/LOGS` are just `[]` — inline `[]` at the call site. Proxy endpoint is dead since frontend calls GAS directly.

- [ ] **Step 1: Remove empty constants from data.js**

Delete lines 46-48 from `src/data.js`:
```
export const INITIAL_DOCS = [];
export const INITIAL_USERS = [];
export const INITIAL_LOGS = [];
```

- [ ] **Step 2: Update imports and state in App.jsx**

Change import on line 9:
```js
import { INITIAL_DOCS, INITIAL_USERS, INITIAL_LOGS, ROLE_COLOR } from "./data.js";
```
→
```js
import { ROLE_COLOR } from "./data.js";
```

Change state initializers on lines 18-20:
```js
const [docs,      setDocs]      = useState(INITIAL_DOCS);
const [users,     setUsers]     = useState(INITIAL_USERS);
const [logs,      setLogs]      = useState(INITIAL_LOGS);
```
→
```js
const [docs,      setDocs]      = useState([]);
const [users,     setUsers]     = useState([]);
const [logs,      setLogs]      = useState([]);
```

- [ ] **Step 3: Remove proxy endpoint from server**

Remove 2 lines from `server/index.js`:
```js
import https  from 'https';
import urlMod from 'url';
```

Remove lines 149-196 (the entire `/api/upload-proxy` block):
```js
// ── Proxy upload ke Google Apps Script (hindari CORS) ────────────────────
app.post('/api/upload-proxy', async (req, res) => {
  ...
});
```

- [ ] **Step 4: Untrack dist/ from git**

Append to `.gitignore`:
```
dist/
```

Run:
```bash
git rm --cached dist/icon.svg dist/index.html
```

- [ ] **Step 5: Commit**

```bash
git add src/data.js src/App.jsx server/index.js .gitignore
git commit -m "cleanup: remove dead code, untrack dist/"
```

---

### Task 2: Install React Query & create data hooks

**Files:**
- Modify: `package.json`
- Create: `src/hooks.js`
- Modify: `src/App.jsx` — lines 1-3, 12-40, new QueryClient wrapper

- [ ] **Step 1: Install @tanstack/react-query**

```bash
npm install @tanstack/react-query
```

- [ ] **Step 2: Create src/hooks.js**

```js
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
```

- [ ] **Step 3: Setup QueryClient + wrapper in App.jsx**

Add to imports in `src/App.jsx`:
```js
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useDocs, useUsers, useLogs, useCategories } from './hooks.js';
```

Create QueryClient before App component:
```js
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
});
```

Wrap the return:
```js
export default function App() {
  ...
  if (!user) return <LoginPage onLogin={handleLogin} />;
  
  // return unchanged, but wrap it:
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{...}}>
        ...
      </div>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Replace useEffect data fetching with useQuery**

Replace lines 34-40 in `src/App.jsx`:
```js
useEffect(() => {
  if (!user) return;
  fetch("/api/docs").then(r => r.json()).then(setDocs).catch(console.error);
  fetch("/api/logs").then(r => r.json()).then(setLogs).catch(console.error);
  fetchUsers();
  fetchCategories();
}, [user]);
```
→
```js
const { data: serverDocs = [] } = useDocs();
const { data: logs = [] } = useLogs();
```

- [ ] **Step 5: Commit**

```bash
git add package.json src/hooks.js src/App.jsx
git commit -m "feat: add react-query for data fetching"
```

---

### Task 3: Sync server data into local state

**Files:**
- Modify: `src/App.jsx`

**Rationale:** `docs`, `users`, `logs`, `categories` state must stay for local mutations (approve/reject, upload) but populated from React Query cache. When the query returns fresh data, merge into local state preserving overrides.

- [ ] **Step 1: Add sync effect for docs**

Add after the useQuery calls (replacing the old useEffect):
```js
const queryClient = useQueryClient();

// Sync server docs into local state, preserving local overrides (approve/reject/upload)
useEffect(() => {
  if (serverDocs.length > 0) {
    setDocs(prev => {
      const map = new Map(serverDocs.map(d => [d.id, d]));
      for (const d of prev) {
        if (map.has(d.id)) {
          // preserve local status overrides
          map.set(d.id, { ...map.get(d.id), status: d.status });
        } else {
          // keep locally uploaded docs not yet on server
          map.set(d.id, d);
        }
      }
      return [...map.values()];
    });
  }
}, [serverDocs]);

// Sync categories into App state for UploadForm
const { data: categories } = useCategories();
useEffect(() => { if (categories) setCategories(categories); }, [categories]);

// Sync users
const { data: usersData } = useUsers();
useEffect(() => { if (usersData) setUsers(usersData); }, [usersData]);

// Sync logs
useEffect(() => { if (logs) setLogs(logs); }, [logs]);
```

Remove `fetchUsers` and `fetchCategories` function definitions (lines 26-32) — App.jsx no longer needs them.

Update ManajemenPengguna category — change `onReload={fetchUsers}` to `onReload={() => queryClient.invalidateQueries(['users'])}`.

Same for kategori: `onReload={() => queryClient.invalidateQueries(['categories'])}`.

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: sync useQuery data into local state"
```

---

### Task 4: Upload UX — file metadata + progress bar

**Files:**
- Modify: `src/App.jsx` — rewrite `handleUpload`
- Modify: `src/components/UploadForm.jsx` — file metadata + progress bar
- Modify: `src/App.jsx` — simplify `openOrDownloadDataUrl` / `handleDownload` / `handlePreview`

- [ ] **Step 1: Rewrite handleUpload with XHR progress**

Replace lines 151-206 in `src/App.jsx`:
```js
const handleUpload = async (form, onProgress) => {
  if (!form.fileObj) return showToast("Pilih file terlebih dahulu.");

  try {
    var gasUrl = import.meta.env.VITE_GAS_WEBAPP_URL;
    if (!gasUrl) { showToast("GAS_URL belum dikonfigurasi"); return; }

    var reader = new FileReader();
    var base64 = await new Promise(function (resolve, reject) {
      reader.onload  = function () { resolve(reader.result.split(",")[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(form.fileObj);
    });

    var payload = JSON.stringify({
      file:     base64,
      filename: form.fileObj.name,
      mimeType: form.fileObj.type,
      title:    form.title,
      type:     form.type,
      sector:   form.sector,
      year:     form.year,
      uploader: user.name,
    });

    var data = await new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', gasUrl);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = function () {
        onProgress(100);
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (_) { resolve({}); }
      };
      xhr.onerror = function () { reject(new Error('Network error')); };
      xhr.send(payload);
    });

    var newDoc = {
      id:         Date.now(),
      title:      form.title,
      type:       form.type,
      sector:     form.sector,
      year:       form.year,
      status:     "Menunggu Review",
      uploader:   user.name,
      reviewedBy: "—",
      size:       form.fileObj.size ? (form.fileObj.size / 1048576).toFixed(1) + " MB" : "—",
      pages:      0,
      uploadDate: new Date().toLocaleDateString("id-ID"),
      desc:       form.desc || "—",
      tags:       form.tags ? form.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [],
      url:        data.fileUrl || "",
    };
    setDocs(function (d) { return [newDoc].concat(d); });
    addLog("Upload dokumen", newDoc);
    queryClient.invalidateQueries(['docs']); // background sync with DB
    setPage("dokumen");
    showToast("Dokumen berhasil diunggah dan dikirim untuk review.");
  } catch (err) {
    showToast("Gagal mengunggah: " + err.message);
  }
};
```

- [ ] **Step 2: Simplify openOrDownloadDataUrl for Drive URLs**

Replace lines 88-149 in `src/App.jsx`:
```js
const handleDownload = doc => {
  addLog("Unduh dokumen", doc);
  showToast(`Membuka "${doc.title}"...`);
  window.open(doc.url, "_blank");
};

const handlePreview = doc => {
  addLog("Preview dokumen", doc);
  window.open(doc.url, "_blank");
};
```

Remove `openOrDownloadDataUrl` function entirely.

- [ ] **Step 3: Update UploadForm — file metadata + progress bar**

Add to imports in `src/components/UploadForm.jsx`:
```js
import { useState, useRef } from "react";
```

Add state inside component:
```js
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
```

Replace file selection area (lines 111-137) to show metadata:
```js
{/* File */}
<div style={{ gridColumn: "1 / -1" }}>
  <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
    File Dokumen * (PDF, DOCX, XLSX)
  </label>
  <input
    type="file" ref={fileRef}
    accept=".pdf,.doc,.docx,.xlsx"
    onChange={e => { setFile(e.target.files[0]); setProgress(0); }}
    style={{ display: "none" }}
  />
  <div
    onClick={() => !uploading && fileRef.current.click()}
    style={{
      border: `2px dashed ${errors.file ? "#c62828" : "#c8e6c9"}`,
      borderRadius: 10, padding: 28, textAlign: "center",
      cursor: uploading ? "not-allowed" : "pointer", background: file ? "#f0f7f2" : "#fafafa",
      transition: "all .15s",
    }}
  >
    <Icon name="upload" size={28} style={{ color: file ? "#1a7a4a" : "#ccc", marginBottom: 8 }} />
    <div style={{ fontSize: 13, fontWeight: 600, color: file ? "#1a7a4a" : "#999" }}>
      {file ? "✓ " + file.name : "Klik untuk pilih file atau seret ke sini"}
    </div>
    {file && (
      <div style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <span>{(file.size / 1024).toFixed(0)} KB</span>
        <span>{file.type || "unknown"}</span>
      </div>
    )}
    <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>PDF, DOCX, XLSX hingga 50 MB</div>
  </div>
  {errors.file && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.file}</div>}

  {/* Progress bar */}
  {uploading && (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 4 }}>
        <span>Mengunggah...</span>
        <span>{progress}%</span>
      </div>
      <div style={{ height: 6, background: "#f0f0f0", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#1a7a4a", borderRadius: 99, width: progress + "%", transition: "width .3s" }} />
      </div>
    </div>
  )}
</div>
```

Replace `handle` function:
```js
const handle = () => {
  if (!validate() || uploading) return;
  setUploading(true);
  setProgress(0);
  onSubmit({ ...form, fileObj: file }, function (pct) {
    setProgress(pct);
    if (pct >= 100) {
      // reset after brief delay
      setTimeout(function () {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  });
  setForm({ title: "", type: "", sector: "", year: new Date().getFullYear().toString(), desc: "", tags: "" });
  setFile(null);
  setErrors({});
};
```

Disable submit button while uploading:
```jsx
<button
  onClick={handle}
  disabled={uploading}
  style={{
    padding: "10px 24px",
    background: uploading ? "#ccc" : "#1a7a4a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    cursor: uploading ? "not-allowed" : "pointer",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 8,
  }}
>
  <Icon name="upload" size={14} />
  {uploading ? "Mengunggah " + progress + "%..." : "Upload & Kirim untuk Review"}
</button>
```

- [ ] **Step 4: Pass onProgress from UploadForm to handleUpload**

In `src/App.jsx`, change the UploadForm rendering to pass the new handler signature:
```jsx
{page === "upload" && (
  <UploadForm onSubmit={handleUpload} user={user} categories={categories} />
)}
```
(This line is unchanged — `onSubmit` mapping is the same.)

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/UploadForm.jsx
git commit -m "feat: upload progress bar, file metadata, simplify Drive URL handling"
```

---

### Task 5: Build & verify

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: Build succeeds, output in `dist/`.

- [ ] **Step 2: Quick smoke test**

```bash
npm run server &
# In another terminal or manual test:
# - Open http://localhost:3000
# - Login
# - Navigate pages
# - Upload a file
# - Check dashboard loads
```

- [ ] **Step 3: Commit remaining**

```bash
git add -A
git commit -m "chore: build artifacts, finalize"
```
