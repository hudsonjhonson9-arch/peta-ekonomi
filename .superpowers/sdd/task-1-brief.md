# Task 1 Brief: Server — kolom `files` + POST/GET `/api/docs`

**Goal:** Add a `files` TEXT column to `bapperida_dokumen` to store multi-file upload metadata as JSON. GET returns it parsed as an array; POST accepts it and stores as JSON string.

**File to modify:** `server/index.js`

**Working directory:** `D:\Code\peta-ekonomi`

## Current Code Context

### Migration block (lines 30-36):
```js
(async () => {
  try {
    await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS bidang TEXT`);
    await pool.query(`UPDATE bapperida_dokumen SET bidang = 'Bidang Ekonomi dan SDA' WHERE bidang IS NULL`);
    console.log('Migration: bidang column ready');
  } catch (e) { console.error('Migration bidang error:', e.message); }
})();
```

### GET /api/docs (lines 102-130):
```js
app.get('/api/docs', async (_, res) => {
  try {
    const docs = await queryDB(`
      SELECT
        id,
        judul                               AS title,
        kategori                            AS type,
        tipe                                AS sector,
        TO_CHAR(tanggal, 'YYYY')            AS year,
        status,
        '—'                                 AS uploader,
        '—'                                 AS "reviewedBy",
        ukuran                              AS size,
        0                                   AS pages,
        TO_CHAR(tanggal, 'DD Mon YYYY')     AS "uploadDate",
        ''                                  AS desc,
        url,
        icon_data,
        COALESCE(publik, false)             AS publik,
        COALESCE(bidang, '')                AS bidang
      FROM bapperida_dokumen
      ORDER BY id DESC
    `);
    res.json(docs.map(d => ({ ...d, tags: d.type ? [d.type] : [] })));
  } catch (err) {
    console.error('Docs error:', err);
    res.status(500).json({ error: 'Gagal mengambil dokumen' });
  }
});
```

### POST /api/docs (lines 132-156):
```js
app.post('/api/docs', async (req, res) => {
  if (process.env.UPLOAD_API_KEY) {
    const key = req.headers['x-upload-key'];
    if (!key || key !== process.env.UPLOAD_API_KEY)
      return res.status(403).json({ error: 'Forbidden: invalid upload key' });
  }

  const { title, type, sector, uploader, url, ukuran, bidang } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at, bidang)
       VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6) RETURNING *`,
      [title, type, sector, ukuran || '0 MB', url || '', bidang || '']

    );
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [uploader || 'System', 'Upload dokumen', title]
    );
    res.json({ message: 'Dokumen berhasil diunggah', doc: result.rows[0] });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Gagal menyimpan dokumen' });
  }
});
```

## Exact Changes

### Step 1: Add migration for `files` column
Insert after the `bidang` migration block (after line 36), before `const queryDB`:

```js
(async () => {
  try {
    await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS files TEXT`);
    console.log('Migration: files column ready');
  } catch (e) { console.error('Migration files error:', e.message); }
})();
```

### Step 2: Modify GET /api/docs SELECT
Add `files,` to the SELECT between `url,` and `icon_data,`:

```
        url,
        files,
        icon_data,
```

Then change the response map (line 125) to parse files:

```js
res.json(docs.map(d => {
  let files = [];
  if (d.files) { try { files = JSON.parse(d.files); } catch (_) { files = []; } }
  return { ...d, files, tags: d.type ? [d.type] : [] };
}));
```

### Step 3: Modify POST /api/docs
Change destructuring to include `files`:
```js
const { title, type, sector, uploader, url, ukuran, bidang, files } = req.body;
```

Change INSERT to include `files` column (9 columns, $1-$9):
```js
const result = await pool.query(
  `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at, bidang, files)
   VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6, $7) RETURNING *`,
  [title, type, sector, ukuran || '0 MB', url || '', bidang || '', files ? JSON.stringify(files) : null]
);
```

### Step 4: Verify
Run: `node --check server/index.js`
Expected: no output, exit code 0.

### Step 5: Commit
```bash
git add server/index.js
git commit -m "feat: kolom files untuk multi-file upload (folder Drive)"
```

## Constraints
- Do NOT change any other endpoint or migration
- Do NOT add any new dependency
- Do NOT change the `bidang` migration or any existing logic
