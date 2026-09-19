import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import pg      from 'pg';
import bcrypt from 'bcryptjs';
import path    from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const isProd    = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Static files (production) ─────────────────────────────────────────────
// Di production Coolify, Express serve hasil build React dari /dist
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

// ── PostgreSQL ────────────────────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Auto-migration: tambah kolom bidang ────────────────────────────────────
(async () => {
  try {
    await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS bidang TEXT`);
    await pool.query(`UPDATE bapperida_dokumen SET bidang = 'Bidang Ekonomi dan SDA' WHERE bidang IS NULL`);
    console.log('Migration: bidang column ready');
  } catch (e) { console.error('Migration bidang error:', e.message); }
})();

(async () => {
  try {
    await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS files TEXT`);
    console.log('Migration: files column ready');
  } catch (e) { console.error('Migration files error:', e.message); }
})();

const queryDB = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'db error' });
  }
});

// ── Auth: Login dengan NIP + bcrypt ──────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { nip, password } = req.body;
  if (!nip || !password)
    return res.status(400).json({ error: 'NIP dan Password diperlukan' });

  try {
    // Ambil hash dan role dari user_credentials
    const credResult = await pool.query(
      'SELECT password_hash, role FROM user_credentials WHERE nip = $1', [nip]
    );
    if (!credResult.rows.length)
      return res.status(401).json({ error: 'NIP atau password salah' });

    const match = await bcrypt.compare(password, credResult.rows[0].password_hash);
    if (!match)
      return res.status(401).json({ error: 'NIP atau password salah' });

    // Update last_login
    await pool.query(
      'UPDATE user_credentials SET last_login = NOW() WHERE nip = $1', [nip]
    );
    // Ambil data user dari user_list
    const userResult = await pool.query(
      'SELECT * FROM user_list WHERE "NIP" = $1', [nip]
    );
    if (!userResult.rows.length)
      return res.status(404).json({ error: 'Data user tidak ditemukan' });

    const u = userResult.rows[0];
    const cred = credResult.rows[0];
    res.json({
      message: 'Login berhasil',
      user: {
        id:     u.id,
        name:   u.username,
        nip:    u.NIP,
        role:   cred.role || 'Staf',
        unit:   u.bidang || '—',
        status: u.Status || 'Aktif',
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});

// ── Documents: dari bapperida_dokumen ────────────────────────────────────
app.get('/api/docs', async (_, res) => {
  try {
    const docs = await queryDB(`
      SELECT
        id,
        judul                               AS title,
        kategori                            AS type,
        tipe                                AS sector,
        file_type                           AS "fileType",
        TO_CHAR(tanggal, 'YYYY')            AS year,
        status,
        COALESCE(uploader_id, '')           AS "uploaderId",
        COALESCE("desc", '')                AS "desc",
        COALESCE(tags, '')                  AS "tagsRaw",
        COALESCE(nomor_dokumen, '')         AS "nomorDokumen",
        TO_CHAR(tanggal_dokumen, 'DD Mon YYYY') AS "tanggalDokumen",
        COALESCE(versi, 1)                  AS versi,
        COALESCE(reviewed_by, '—')        AS "reviewedBy",
        COALESCE(review_note, '')          AS "reviewNote",
        ukuran                              AS size,
        COALESCE(pages, 0)                  AS pages,
        TO_CHAR(tanggal, 'DD Mon YYYY')     AS "uploadDate",
        url,
        files,
        icon_data,
        COALESCE(publik, false)             AS publik,
        COALESCE(bidang, '')                AS bidang,
        index_status                        AS "indexStatus"
      FROM bapperida_dokumen
      ORDER BY id DESC
    `);
    res.json(docs.map(d => {
      let files = [];
      if (d.files) { try { files = JSON.parse(d.files); } catch (_) { files = []; } }
      const tags = d.tagsRaw ? d.tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      return { ...d, files, tags };
    }));
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

  const { title, type, sector, uploader, url, ukuran, bidang, files, pages,
          desc, tags, uploader_id, nomor_dokumen, tanggal_dokumen, tahun,
          fileType } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO bapperida_dokumen
       (judul, kategori, tipe, file_type, tanggal, ukuran, url, created_at, bidang, files, pages,
        "desc", tags, uploader_id, nomor_dokumen, tanggal_dokumen)
       VALUES ($1, $2, $3, $14, COALESCE($10::date, NOW()), $4, $5, NOW(), $6, $7, $8,
               $9, $11, $12, $13, $10::date)
       RETURNING *`,
      [title, type, sector, ukuran || '0 MB', url || '', bidang || '',
       files ? JSON.stringify(files) : null, pages || 0,
       desc || '', tanggal_dokumen || null, tags || '',
       uploader_id || '', nomor_dokumen || '', fileType || '']
    );
    // Insert doc_history
    try {
      await pool.query(
        `INSERT INTO doc_history (doc_id, action, from_status, to_status, actor_id, actor_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [result.rows[0].id, 'upload', null, 'Menunggu Review', uploader_id || '', uploader || 'System']
      );
    } catch (_) {}
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [uploader || 'System', 'Upload dokumen', title]
    );
    // Notify all admins about new upload
    try {
      const admins = await queryDB(`SELECT id FROM user_list WHERE role = 'Admin' OR id = (SELECT id FROM user_list WHERE "NIP" = $1)`, [uploader_id || uploader]);
      for (const a of admins) {
        createNotification(a.id, 'Dokumen Baru', `"${title}" diunggah oleh ${uploader || 'System'}.`, 'info', result.rows[0].id);
      }
    } catch (_) {}
    res.json({ message: 'Dokumen berhasil diunggah', doc: result.rows[0] });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Gagal menyimpan dokumen' });
  }
});

app.patch('/api/docs/:id/status', async (req, res) => {
  const { status, user_id } = req.body;
  const { id } = req.params;
  const allowed = ['Menunggu Review', 'Diarsipkan', 'Ditolak'];
  if (!allowed.includes(status))
    return res.status(400).json({ error: 'Status tidak valid' });
  try {
    const result = await pool.query(
      `UPDATE bapperida_dokumen SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    const doc = result.rows[0];
    // Notify uploader
    if (user_id && status !== 'Menunggu Review') {
      const label = status === 'Diarsipkan' ? 'Diarsipkan' : 'Ditolak';
      createNotification(user_id, `Dokumen ${label}`, `"${doc.judul}" telah ${label}.`, status === 'Diarsipkan' ? 'success' : 'warning', doc.id);
    }
    res.json({ message: 'Status diperbarui', doc });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui status' });
  }
});

app.patch('/api/docs/:id/publik', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE bapperida_dokumen SET publik = NOT COALESCE(publik, false) WHERE id = $1 RETURNING id, publik`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    res.json({ message: result.rows[0].publik ? 'Dokumen dipublikasikan' : 'Dokumen tidak dipublikasikan', publik: result.rows[0].publik });
  } catch (err) {
    console.error('Publik toggle error:', err);
    res.status(500).json({ error: 'Gagal mengubah status publikasi' });
  }
});

// ── Delete Dokumen ──────────────────────────────────────────────────────────
app.delete('/api/docs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Collect all URLs (active + versions) for frontend Drive cleanup
    const verUrls = await pool.query(
      `SELECT url FROM doc_versions WHERE doc_id = $1`, [id]
    );
    const versionUrls = verUrls.rows.map(r => r.url).filter(Boolean);

    const result = await pool.query(
      `DELETE FROM bapperida_dokumen WHERE id = $1 RETURNING judul, url, files`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    const doc = result.rows[0];

    // Clean up related rows
    await pool.query(`DELETE FROM doc_versions WHERE doc_id = $1`, [id]);
    await pool.query(`DELETE FROM doc_history WHERE doc_id = $1`, [id]);
    await pool.query(`DELETE FROM doc_content WHERE doc_id = $1`, [id]);

    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [req.body.user || 'Admin', 'Hapus dokumen', doc.judul]
    );
    const allUrls = [doc.url, ...versionUrls].filter(Boolean);
    res.json({ message: 'Dokumen berhasil dihapus', gdriveUrl: doc.url, files: doc.files, allUrls });
  } catch (err) {
    console.error('Delete doc error:', err);
    res.status(500).json({ error: 'Gagal menghapus dokumen' });
  }
});

// ── Riwayat Dokumen ──────────────────────────────────────────────────────
app.get('/api/docs/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await queryDB(
      `SELECT id, doc_id, action, from_status, to_status, actor_id, actor_name, note,
              TO_CHAR(created_at, 'DD Mon YYYY HH24:MI') AS created_at
       FROM doc_history WHERE doc_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Gagal mengambil riwayat' });
  }
});

// ── Update Status Dokumen ────────────────────────────────────────────────
app.patch('/api/docs/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, note, actor_id, actor_name } = req.body;

  const VALID_TRANSITIONS = {
    'Menunggu Review':    ['Diarsipkan', 'Ditolak'],
    'Menunggu Persetujuan':['Diarsipkan', 'Ditolak'],
    'Ditolak':            ['Menunggu Review'],
  };

  try {
    // Get current status
    const current = await pool.query(
      `SELECT status, judul, uploader_id FROM bapperida_dokumen WHERE id = $1`,
      [id]
    );
    if (!current.rows.length)
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });

    const cur = current.rows[0];
    const from = cur.status;

    // Validate transition
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(status))
      return res.status(400).json({ error: `Transisi dari "${from}" ke "${status}" tidak diizinkan` });

    // Reject requires note (min 5 chars)
    if (status === 'Ditolak' && (!note || note.trim().length < 5))
      return res.status(400).json({ error: 'Penolakan wajib diisi catatan (minimal 5 karakter)' });

    // Update doc status + review fields
    await pool.query(
      `UPDATE bapperida_dokumen
       SET status = $1,
           reviewed_by = $2,
           reviewed_at = NOW(),
           review_note = $3
       WHERE id = $4`,
      [status, actor_name || '', note || '', id]
    );

    // Insert history
    await pool.query(
      `INSERT INTO doc_history (doc_id, action, from_status, to_status, actor_id, actor_name, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, status === 'Diarsipkan' ? 'approve' : 'reject', from, status, actor_id || '', actor_name || '', note || '']
    );

    // Notify uploader
    if (cur.uploader_id) {
      const label = status === 'Diarsipkan' ? 'disetujui' : 'ditolak';
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, doc_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [cur.uploader_id, `Dokumen ${label}`, `"${cur.judul}" ${label}${note ? ': ' + note : ''}`,
         status === 'Diarsipkan' ? 'success' : 'warning', id]
      ).catch(() => {});
    }

    res.json({ message: `Status berhasil diubah ke "${status}"`, status });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Gagal mengubah status' });
  }
});

// ── Edit Dokumen ────────────────────────────────────────────────────────────
app.put('/api/docs/:id', async (req, res) => {
  const { id } = req.params;
  const { judul, kategori, tipe, bidang, desc, tags, nomor, tanggal, tahun, fileType } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bapperida_dokumen
       SET judul = COALESCE($1, judul),
           kategori = COALESCE($2, kategori),
           tipe = COALESCE($3, tipe),
           file_type = COALESCE($10, file_type),
           bidang = COALESCE($4, bidang),
           "desc" = COALESCE($5, "desc"),
           tags = COALESCE($6, tags),
           nomor_dokumen = COALESCE($7, nomor_dokumen),
           tanggal_dokumen = COALESCE($8::date, tanggal_dokumen),
           tanggal = COALESCE($8::date, tanggal)
       WHERE id = $9 RETURNING *`,
      [judul, kategori, tipe, bidang, desc, tags, nomor, tanggal || null, id, fileType || null]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [req.body.user || 'Admin', 'Edit dokumen', judul || result.rows[0].judul]
    );
    res.json({ message: 'Dokumen berhasil diperbarui', doc: result.rows[0] });
  } catch (err) {
    console.error('Edit doc error:', err);
    res.status(500).json({ error: 'Gagal memperbarui dokumen' });
  }
});

// ── Simpan Isi Dokumen per Halaman ──────────────────────────────────────
app.post('/api/docs/:id/content', async (req, res) => {
  const { id } = req.params;
  const { version_no, pages, status } = req.body;
  if (!Array.isArray(pages) || pages.length === 0)
    return res.status(400).json({ error: 'pages harus array' });

  try {
    for (const p of pages) {
      await pool.query(
        `INSERT INTO doc_content (doc_id, version_no, page_no, content)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (doc_id, version_no, page_no) DO UPDATE SET content = $4`,
        [id, version_no || 1, p.page, p.text]
      );
    }
    await pool.query(
      `UPDATE bapperida_dokumen SET index_status = $1 WHERE id = $2`,
      [status || 'ok', id]
    );
    res.json({ message: `${pages.length} halaman tersimpan`, indexStatus: status || 'ok' });
  } catch (err) {
    console.error('Save content error:', err);
    res.status(500).json({ error: 'Gagal menyimpan isi dokumen' });
  }
});

// ── Status Indeks Dokumen ──────────────────────────────────────────────
app.get('/api/docs/:id/index-status', async (req, res) => {
  const { id } = req.params;
  try {
    const r = await pool.query(
      `SELECT index_status, COALESCE(versi, 1) AS versi FROM bapperida_dokumen WHERE id = $1`, [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    const { index_status, versi } = r.rows[0];
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM doc_content WHERE doc_id = $1 AND version_no = $2`,
      [id, versi]
    );
    res.json({ status: index_status, version: versi, pages: count.rows[0].total });
  } catch (err) {
    console.error('Get index status error:', err);
    res.status(500).json({ error: 'Gagal mengambil status indeks' });
  }
});

// ── Pencarian Full-Text ────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const { q, type, sector, bidang, year, status, limit = 20, offset = 0 } = req.query;
  if (!q || q.trim().length === 0)
    return res.status(400).json({ error: 'Parameter q wajib diisi' });

  const searchTerm = q.trim();
  const safeLimit = Math.min(parseInt(limit) || 20, 100);
  const safeOffset = parseInt(offset) || 0;

  try {
    // Build metadata filter conditions
    const metaFilters = [];
    const metaParams = [];
    let paramIdx = 1;

    if (type) { metaFilters.push(`d.kategori = $${paramIdx++}`); metaParams.push(type); }
    if (sector) { metaFilters.push(`d.tipe = $${paramIdx++}`); metaParams.push(sector); }
    if (bidang) { metaFilters.push(`d.bidang = $${paramIdx++}`); metaParams.push(bidang); }
    if (year) { metaFilters.push(`d.tahun::text = $${paramIdx++}`); metaParams.push(year); }
    if (status) { metaFilters.push(`d.status = $${paramIdx++}`); metaParams.push(status); }

    const whereClause = metaFilters.length > 0 ? `AND ${metaFilters.join(' AND ')}` : '';

    // Full-text search combining content + metadata
    const sql = `
      WITH search AS (
        SELECT
          d.id,
          d.judul,
          d.kategori,
          d.tipe,
          d.bidang,
          d.tahun,
          d.status,
          d.versi,
          d.index_status,
          COALESCE(d.uploader_id, '') AS uploader_id,
          COALESCE(d."desc", '') AS "desc",
          COALESCE(d.tags, '') AS tags,
          COALESCE(d.nomor_dokumen, '') AS nomor_dokumen,
          TO_CHAR(d.tanggal, 'YYYY') AS upload_year,
          TO_CHAR(d.tanggal, 'DD Mon YYYY') AS upload_date,
          COALESCE(d.file_type, '') AS file_type,
          COALESCE(d.url, '') AS url,
          d.ukuran AS size,
          COALESCE(d.pages, 0) AS pages,
          COALESCE(d.publik, false) AS publik,
          CASE
            WHEN d.judul ILIKE $${paramIdx} THEN 10
            WHEN d.nomor_dokumen ILIKE $${paramIdx} THEN 8
            WHEN d."desc" ILIKE $${paramIdx} THEN 5
            WHEN d.tags ILIKE $${paramIdx} THEN 3
            ELSE 0
          END AS meta_score,
          COALESCE(MAX(ts_rank_cd(c.tsv, websearch_to_tsquery('simple', $${paramIdx}))), 0) AS content_score
        FROM bapperida_dokumen d
        LEFT JOIN doc_content c ON c.doc_id = d.id AND c.version_no = COALESCE(d.versi, 1)
        WHERE (
          d.judul ILIKE $${paramIdx}
          OR d.nomor_dokumen ILIKE $${paramIdx}
          OR d."desc" ILIKE $${paramIdx}
          OR d.tags ILIKE $${paramIdx}
          OR c.tsv @@ websearch_to_tsquery('simple', $${paramIdx})
        )
        ${whereClause}
        GROUP BY d.id
        ORDER BY (meta_score + content_score * 20) DESC
        LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}
      ),
      hits AS (
        SELECT
          c.doc_id,
          c.page_no,
          ts_headline('simple', c.content, websearch_to_tsquery('simple', $${paramIdx}),
            'MaxFragments=1,MaxWords=30,MinWords=12,StartSel=<mark>,StopSel=</mark>') AS snippet
        FROM doc_content c
        WHERE c.tsv @@ websearch_to_tsquery('simple', $${paramIdx})
          AND c.doc_id IN (SELECT id FROM search)
        ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('simple', $${paramIdx})) DESC
      )
      SELECT
        s.*,
        COALESCE(
          (SELECT json_agg(h.* ORDER BY h.page_no) FROM hits h WHERE h.doc_id = s.id LIMIT 3),
          '[]'::json
        ) AS hits
      FROM search s
    `;

    const likePattern = `%${searchTerm}%`;
    const params = [...metaParams, likePattern, safeLimit, safeOffset];
    const result = await pool.query(sql, params);

    res.json({
      results: result.rows.map(r => ({
        doc: {
          id: r.id, title: r.judul, type: r.kategori, sector: r.tipe,
          bidang: r.bidang, year: r.tahun || r.upload_year, status: r.status,
          versi: r.versi, indexStatus: r.index_status, uploaderId: r.uploader_id,
          desc: r.desc, tags: r.tags, nomorDokumen: r.nomor_dokumen,
          fileType: r.file_type, url: r.url, size: r.size, pages: r.pages,
          publik: r.publik, uploadDate: r.upload_date,
        },
        score: r.meta_score + r.content_score * 20,
        hits: r.hits || [],
      })),
      total: result.rows.length,
      query: searchTerm,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Gagal menjalankan pencarian' });
  }
});

// ── Versi Dokumen ──────────────────────────────────────────────────────
app.get('/api/docs/:id/versions', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await pool.query(
      `SELECT COALESCE(versi,1) AS versi, url, ukuran, COALESCE(pages,0) AS pages,
              COALESCE(uploader_id,'') AS uploader_id, COALESCE(uploader_name,'') AS uploader_name
       FROM bapperida_dokumen WHERE id = $1`, [id]
    );
    if (!doc.rows.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    const d = doc.rows[0];

    const versions = await pool.query(
      `SELECT version_no, url, ukuran, pages, uploader_name, note, created_at
       FROM doc_versions WHERE doc_id = $1 ORDER BY version_no DESC`, [id]
    );

    // Prepend active version as first entry
    const result = [
      { version_no: d.versi, url: d.url, ukuran: d.ukuran, pages: d.pages,
        uploader_name: d.uploader_name, note: null, created_at: null, active: true },
      ...versions.rows.map(v => ({ ...v, active: false })),
    ];
    res.json({ versions: result });
  } catch (err) {
    console.error('Get versions error:', err);
    res.status(500).json({ error: 'Gagal mengambil riwayat versi' });
  }
});

app.post('/api/docs/:id/versions', async (req, res) => {
  const { id } = req.params;
  const { url, ukuran, pages, note, uploader_name, uploader_id } = req.body;
  if (!url) return res.status(400).json({ error: 'url wajib diisi' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current active version
    const cur = await client.query(
      `SELECT versi, url, ukuran, pages, uploader_id, uploader_name
       FROM bapperida_dokumen WHERE id = $1 FOR UPDATE`, [id]
    );
    if (!cur.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Dokumen tidak ditemukan' }); }
    const c = cur.rows[0];
    const newVer = (c.versi || 1) + 1;

    // Snapshot current active version into doc_versions
    await client.query(
      `INSERT INTO doc_versions (doc_id, version_no, url, ukuran, pages, uploader_id, uploader_name, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (doc_id, version_no) DO UPDATE SET url=$3, ukuran=$4, pages=$5`,
      [id, c.versi, c.url, c.ukuran, c.pages, c.uploader_id, c.uploader_name, null]
    );

    // Update doc to new version
    await client.query(
      `UPDATE bapperida_dokumen
       SET url = $1, ukuran = $2, pages = $3, versi = $4,
           status = 'Menunggu Review', publik = false
       WHERE id = $5`,
      [url, ukuran || '—', pages || 0, newVer, id]
    );

    // Insert history
    await client.query(
      `INSERT INTO doc_history (doc_id, action, from_status, to_status, actor_id, actor_name, note)
       VALUES ($1, 'version', 'Diarsipkan', 'Menunggu Review', $2, $3, $4)`,
      [id, uploader_id || '', uploader_name || '', note || `Versi ${newVer}`]
    );

    // Notify admin/reviewer
    const titleRes = await client.query(`SELECT judul FROM bapperida_dokumen WHERE id=$1`, [id]);
    const judul = titleRes.rows[0]?.judul || '';
    const notifRes = await client.query(
      `SELECT nip FROM user_credentials WHERE role IN ('Admin','Reviewer') AND active = true`
    );
    for (const r of notifRes.rows) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, doc_id)
         VALUES ($1, 'Versi baru', $2, 'info', $3)`,
        [r.nip, `"${judul}" memiliki versi baru (v${newVer})`, id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Versi ${newVer} berhasil diunggah`, version: newVer });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create version error:', err);
    res.status(500).json({ error: 'Gagal membuat versi baru' });
  } finally {
    client.release();
  }
});

app.post('/api/docs/:id/versions/:no/restore', async (req, res) => {
  const { id, no } = req.params;
  const { actor_id, actor_name } = req.body;
  const versionNo = parseInt(no);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ver = await client.query(
      `SELECT url, ukuran, pages FROM doc_versions WHERE doc_id=$1 AND version_no=$2`, [id, versionNo]
    );
    if (!ver.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Versi tidak ditemukan' }); }
    const v = ver.rows[0];

    const cur = await client.query(
      `SELECT versi FROM bapperida_dokumen WHERE id=$1 FOR UPDATE`, [id]
    );
    const newVer = (cur.rows[0]?.versi || 1) + 1;

    // Snapshot current active before overwrite
    const c = await client.query(
      `SELECT versi, url, ukuran, pages, uploader_id, uploader_name FROM bapperida_dokumen WHERE id=$1`, [id]
    );
    const cc = c.rows[0];
    await client.query(
      `INSERT INTO doc_versions (doc_id, version_no, url, ukuran, pages, uploader_id, uploader_name, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (doc_id, version_no) DO UPDATE SET url=$3`,
      [id, cc.versi, cc.url, cc.ukuran, cc.pages, cc.uploader_id, cc.uploader_name, null]
    );

    // Overwrite with restored version
    await client.query(
      `UPDATE bapperida_dokumen SET url=$1, ukuran=$2, pages=$3, versi=$4,
       status='Menunggu Review', publik=false WHERE id=$5`,
      [v.url, v.ukuran, v.pages, newVer, id]
    );

    await client.query(
      `INSERT INTO doc_history (doc_id, action, from_status, to_status, actor_id, actor_name, note)
       VALUES ($1,'restore','Diarsipkan','Menunggu Review',$2,$3,$4)`,
      [id, actor_id||'', actor_name||'', `Pemulihan dari v${versionNo}`]
    );

    await client.query('COMMIT');
    res.json({ message: `Berhasil dipulihkan dari v${versionNo} → v${newVer}`, version: newVer });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Restore version error:', err);
    res.status(500).json({ error: 'Gagal memulihkan versi' });
  } finally {
    client.release();
  }
});

// ── Bulk Actions ─────────────────────────────────────────────────────────
app.post('/api/docs/bulk', async (req, res) => {
  const { action, ids } = req.body;
  if (!['delete', 'archive', 'publish'].includes(action))
    return res.status(400).json({ error: 'Action tidak valid' });
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'IDs tidak valid' });
  if (ids.length > 50)
    return res.status(400).json({ error: 'Maksimal 50 dokumen per request' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let result;
    if (action === 'delete') {
      result = await client.query(
        `DELETE FROM bapperida_dokumen WHERE id = ANY($1)`, [ids]
      );
    } else if (action === 'archive') {
      result = await client.query(
        `UPDATE bapperida_dokumen SET status = 'Diarsipkan' WHERE id = ANY($1)`, [ids]
      );
    } else {
      result = await client.query(
        `UPDATE bapperida_dokumen SET publik = true WHERE id = ANY($1)`, [ids]
      );
    }
    await client.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [req.body.user || 'Admin', `Bulk ${action}`, `${ids.length} dokumen`]
    );
    await client.query('COMMIT');
    res.json({ success: true, affected: result.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk action error:', err);
    res.status(500).json({ error: 'Gagal menjalankan bulk action' });
  } finally {
    client.release();
  }
});

// ── Audit Logs ────────────────────────────────────────────────────────────
app.get('/api/logs', async (_, res) => {
  try {
    const logs = await queryDB(`
      SELECT id,
             user_name                              AS user,
             action,
             doc_title                              AS doc,
             TO_CHAR(created_at, 'DD Mon YYYY, HH24:MI') AS time
      FROM audit_logs
      ORDER BY id DESC LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil log' });
  }
});

app.post('/api/logs', async (req, res) => {
  const { user, action, doc } = req.body;
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [user, action, doc]
    );
    res.json({ message: 'Log dicatat' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mencatat log' });
  }
});

// ── Role Mapping Helpers ──────────────────────────────────────────────────
const mapRoleToFrontend = (dbRole) => {
  if (!dbRole) return 'Staf';
  const r = dbRole.toUpperCase();
  if (r === 'ADMIN') return 'Admin';
  if (r === 'KABID' || r === 'REVIEWER') return 'Reviewer';
  return 'Staf';
};

const mapRoleToDb = (feRole) => {
  if (feRole === 'Admin') return 'ADMIN';
  if (feRole === 'Reviewer') return 'KABID';
  return 'USER';
};

// ── Users: dari user_list & user_credentials ──────────────────────────────
app.get('/api/users', async (_, res) => {
  try {
    const users = await queryDB(`
      SELECT u.id,
             u.username  AS name,
             u.bidang    AS unit,
             u."Status"  AS status,
             u."NIP"     AS nip,
             c.role      AS cred_role,
             TO_CHAR(c.last_login, 'DD Mon YYYY, HH24:MI') AS "lastLogin"
      FROM user_list u
      LEFT JOIN user_credentials c ON u."NIP" = c.nip
      ORDER BY u.no ASC
    `);
    
    const mapped = users.map(u => ({
      id: u.id,
      name: u.name,
      role: mapRoleToFrontend(u.cred_role || u.role),
      unit: u.unit || '—',
      status: u.status || 'Aktif',
      nip: u.nip,
      lastLogin: u.lastLogin || '—'
    }));
    
    res.json(mapped);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Gagal mengambil data pengguna' });
  }
});

app.post('/api/users', async (req, res) => {
  const { nip, name, role, unit, status, password } = req.body;
  if (!nip || !name || !role || !password) {
    return res.status(400).json({ error: 'NIP, Nama, Peran, dan Password wajib diisi' });
  }
  
  try {
    const checkUser = await pool.query('SELECT 1 FROM user_list WHERE "NIP" = $1', [nip]);
    if (checkUser.rows.length) {
      return res.status(400).json({ error: 'NIP sudah digunakan' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const dbRole = mapRoleToDb(role);
    
    await pool.query(`
      INSERT INTO user_list (id, username, "NIP", role, bidang, "Status", no)
      VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(no), 0) + 1 FROM user_list))
    `, [userId, name, nip, dbRole, unit || '—', status || 'AKTIF']);
    
    await pool.query(`
      INSERT INTO user_credentials (nip, password_hash, role)
      VALUES ($1, $2, $3)
    `, [nip, passwordHash, role]);
    
    res.json({ message: 'Pengguna berhasil ditambahkan' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Gagal menambahkan pengguna' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { nip, name, role, unit, status, password } = req.body;
  if (!nip || !name || !role) {
    return res.status(400).json({ error: 'NIP, Nama, dan Peran wajib diisi' });
  }
  
  try {
    const oldUserResult = await pool.query('SELECT "NIP" FROM user_list WHERE id = $1', [id]);
    if (!oldUserResult.rows.length) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const oldNip = oldUserResult.rows[0].NIP;
    const dbRole = mapRoleToDb(role);
    
    if (nip !== oldNip) {
      const checkUser = await pool.query('SELECT 1 FROM user_list WHERE "NIP" = $1 AND id <> $2', [nip, id]);
      if (checkUser.rows.length) {
        return res.status(400).json({ error: 'NIP baru sudah digunakan oleh pengguna lain' });
      }
    }
    
    await pool.query(`
      UPDATE user_list
      SET username = $1, "NIP" = $2, role = $3, bidang = $4, "Status" = $5
      WHERE id = $6
    `, [name, nip, dbRole, unit || '—', status || 'AKTIF', id]);
    
    const credCheck = await pool.query('SELECT 1 FROM user_credentials WHERE nip = $1', [oldNip]);
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      if (credCheck.rows.length) {
        await pool.query(`
          UPDATE user_credentials
          SET nip = $1, password_hash = $2, role = $3, updated_at = NOW()
          WHERE nip = $4
        `, [nip, passwordHash, role, oldNip]);
      } else {
        await pool.query(`
          INSERT INTO user_credentials (nip, password_hash, role)
          VALUES ($1, $2, $3)
        `, [nip, passwordHash, role]);
      }
    } else {
      if (credCheck.rows.length) {
        await pool.query(`
          UPDATE user_credentials
          SET nip = $1, role = $2, updated_at = NOW()
          WHERE nip = $3
        `, [nip, role, oldNip]);
      } else {
        const defaultHash = '$2b$10$vgAo0ik8CSJ2vaoaM6Lh9OXfn3Tt2Mv/edTx1ZzdmqKD6AGvnhREq';
        await pool.query(`
          INSERT INTO user_credentials (nip, password_hash, role)
          VALUES ($1, $2, $3)
        `, [nip, defaultHash, role]);
      }
    }
    
    res.json({ message: 'Pengguna berhasil diperbarui' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Gagal memperbarui pengguna' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const userResult = await pool.query('SELECT "NIP" FROM user_list WHERE id = $1', [id]);
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    const nip = userResult.rows[0].NIP;
    
    await pool.query('DELETE FROM user_credentials WHERE nip = $1', [nip]);
    await pool.query('DELETE FROM user_list WHERE id = $1', [id]);
    
    res.json({ message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengguna' });
  }
});

// ── Kategori Dokumen (Tipe Dokumen) ───────────────────────────────────────
app.get('/api/kategori-dokumen', async (_, res) => {
  try {
    const categories = await queryDB(`
      SELECT id, nama
      FROM bapperida_kategori_dokumen
      ORDER BY nama ASC
    `);
    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Gagal mengambil kategori dokumen' });
  }
});

app.post('/api/kategori-dokumen', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  }
  try {
    await pool.query(
      'INSERT INTO bapperida_kategori_dokumen (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING',
      [name.trim()]
    );
    res.json({ message: 'Kategori berhasil ditambahkan' });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Gagal menambahkan kategori' });
  }
});

app.put('/api/kategori-dokumen/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  }
  try {
    await pool.query(
      'UPDATE bapperida_kategori_dokumen SET nama = $1 WHERE id = $2',
      [name.trim(), id]
    );
    res.json({ message: 'Kategori berhasil diperbarui' });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Gagal memperbarui kategori' });
  }
});

app.delete('/api/kategori-dokumen/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM bapperida_kategori_dokumen WHERE id = $1', [id]);
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Gagal menghapus kategori' });
  }
});

// ── Sektor ────────────────────────────────────────────────────────────────
app.get('/api/sektor', async (_, res) => {
  try {
    const sectors = await queryDB(`
      SELECT id, nama FROM bapperida_sektor ORDER BY nama ASC
    `);
    res.json(sectors);
  } catch (err) {
    console.error('Get sectors error:', err);
    res.status(500).json({ error: 'Gagal mengambil data sektor' });
  }
});

app.post('/api/sektor', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama sektor wajib diisi' });
  }
  try {
    await pool.query(
      'INSERT INTO bapperida_sektor (nama) VALUES ($1) ON CONFLICT (nama) DO NOTHING',
      [name.trim()]
    );
    res.json({ message: 'Sektor berhasil ditambahkan' });
  } catch (err) {
    console.error('Create sector error:', err);
    res.status(500).json({ error: 'Gagal menambahkan sektor' });
  }
});

app.put('/api/sektor/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama sektor wajib diisi' });
  }
  try {
    await pool.query(
      'UPDATE bapperida_sektor SET nama = $1 WHERE id = $2',
      [name.trim(), id]
    );
    res.json({ message: 'Sektor berhasil diperbarui' });
  } catch (err) {
    console.error('Update sector error:', err);
    res.status(500).json({ error: 'Gagal memperbarui sektor' });
  }
});

app.delete('/api/sektor/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM bapperida_sektor WHERE id = $1', [id]);
    res.json({ message: 'Sektor berhasil dihapus' });
  } catch (err) {
    console.error('Delete sector error:', err);
    res.status(500).json({ error: 'Gagal menghapus sektor' });
  }
});

// ── Bidang (Unit Kerja) ─────────────────────────────────────────────────
app.get('/api/bidang', async (_, res) => {
  try {
    const rows = await queryDB(`
      SELECT id, nama_bidang AS nama FROM bidang_list
      WHERE instansi_id = 'bapperida' ORDER BY id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get bidang error:', err);
    res.status(500).json({ error: 'Gagal mengambil data bidang' });
  }
});

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

app.post('/api/nilai', async (req, res) => {
  const { indikator_id, tahun, nilai } = req.body;
  if (!indikator_id || !tahun) return res.status(400).json({ error: 'Indikator dan tahun wajib diisi' });
  try {
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

app.get('/api/indikator/tampil', async (_, res) => {
  try {
    const rows = await queryDB(
      `SELECT i.id, i.nama, i.satuan, n.tahun, n.nilai
       FROM indikator_tampil it
       JOIN indikator i ON i.id = it.indikator_id
       LEFT JOIN nilai_indikator n ON n.indikator_id = i.id
       ORDER BY it.urutan ASC, n.tahun ASC`
    );
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

// ── Notifications ────────────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id wajib' });
  try {
    const rows = await queryDB(
      `SELECT id, title, message, type, doc_id, is_read, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET notifications error:', err);
    res.status(500).json({ error: 'Gagal mengambil notifikasi' });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { user_id, title, message, type = 'info', doc_id = null } = req.body;
  if (!user_id || !title || !message) return res.status(400).json({ error: 'user_id, title, message wajib' });
  try {
    const rows = await queryDB(
      `INSERT INTO notifications (user_id, title, message, type, doc_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, title, message, type, doc_id, is_read, created_at`,
      [user_id, title, message, type, doc_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('POST notification error:', err);
    res.status(500).json({ error: 'Gagal membuat notifikasi' });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await queryDB('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update notifikasi' });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id wajib' });
  try {
    await queryDB('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [user_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update notifikasi' });
  }
});

// Helper: create notification + return it
async function createNotification(userId, title, message, type = 'info', docId = null) {
  try {
    await queryDB(
      `INSERT INTO notifications (user_id, title, message, type, doc_id) VALUES ($1, $2, $3, $4, $5)`,
      [userId, title, message, type, docId]
    );
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
}

// ── SPA fallback: semua route non-API → index.html (production only) ──────
if (isProd) {
  app.get('/{*path}', (_, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT} [${isProd ? 'production' : 'development'}]`);
});
