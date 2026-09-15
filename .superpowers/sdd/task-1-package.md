2261801 feat: kolom files untuk multi-file upload (folder Drive)
 server/index.js | 22 +++++++++++++++++-----
 1 file changed, 17 insertions(+), 5 deletions(-)
diff --git a/server/index.js b/server/index.js
index 636b649..4deb651 100644
--- a/server/index.js
+++ b/server/index.js
@@ -28,20 +28,27 @@ const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 
 // GöÇGöÇ Auto-migration: tambah kolom bidang GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ
 (async () => {
   try {
     await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS bidang TEXT`);
     await pool.query(`UPDATE bapperida_dokumen SET bidang = 'Bidang Ekonomi dan SDA' WHERE bidang IS NULL`);
     console.log('Migration: bidang column ready');
   } catch (e) { console.error('Migration bidang error:', e.message); }
 })();
 
+(async () => {
+  try {
+    await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS files TEXT`);
+    console.log('Migration: files column ready');
+  } catch (e) { console.error('Migration files error:', e.message); }
+})();
+
 const queryDB = async (sql, params = []) => {
   const result = await pool.query(sql, params);
   return result.rows;
 };
 
 // GöÇGöÇ Health check GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ
 app.get('/api/health', async (_, res) => {
   try {
     await pool.query('SELECT 1');
     res.json({ status: 'ok' });
@@ -109,46 +116,51 @@ app.get('/api/docs', async (_, res) => {
         tipe                                AS sector,
         TO_CHAR(tanggal, 'YYYY')            AS year,
         status,
         'GÇö'                                 AS uploader,
         'GÇö'                                 AS "reviewedBy",
         ukuran                              AS size,
         0                                   AS pages,
         TO_CHAR(tanggal, 'DD Mon YYYY')     AS "uploadDate",
         ''                                  AS desc,
         url,
+        files,
         icon_data,
         COALESCE(publik, false)             AS publik,
         COALESCE(bidang, '')                AS bidang
       FROM bapperida_dokumen
       ORDER BY id DESC
     `);
-    res.json(docs.map(d => ({ ...d, tags: d.type ? [d.type] : [] })));
+    res.json(docs.map(d => {
+      let files = [];
+      if (d.files) { try { files = JSON.parse(d.files); } catch (_) { files = []; } }
+      return { ...d, files, tags: d.type ? [d.type] : [] };
+    }));
   } catch (err) {
     console.error('Docs error:', err);
     res.status(500).json({ error: 'Gagal mengambil dokumen' });
   }
 });
 
 app.post('/api/docs', async (req, res) => {
   if (process.env.UPLOAD_API_KEY) {
     const key = req.headers['x-upload-key'];
     if (!key || key !== process.env.UPLOAD_API_KEY)
       return res.status(403).json({ error: 'Forbidden: invalid upload key' });
   }
 
-  const { title, type, sector, uploader, url, ukuran, bidang } = req.body;
+  const { title, type, sector, uploader, url, ukuran, bidang, files } = req.body;
   try {
     const result = await pool.query(
-      `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at, bidang)
-       VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6) RETURNING *`,
-      [title, type, sector, ukuran || '0 MB', url || '', bidang || '']
+      `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at, bidang, files)
+       VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6, $7) RETURNING *`,
+      [title, type, sector, ukuran || '0 MB', url || '', bidang || '', files ? JSON.stringify(files) : null]
 
     );
     await pool.query(
       `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
       [uploader || 'System', 'Upload dokumen', title]
     );
     res.json({ message: 'Dokumen berhasil diunggah', doc: result.rows[0] });
   } catch (err) {
     console.error('Upload error:', err);
     res.status(500).json({ error: 'Gagal menyimpan dokumen' });
