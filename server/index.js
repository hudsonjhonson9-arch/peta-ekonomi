import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import pg      from 'pg';
import bcrypt  from 'bcrypt';
import path    from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const isProd    = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// ── Static files (production) ─────────────────────────────────────────────
// Di production Coolify, Express serve hasil build React dari /dist
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

// ── PostgreSQL ────────────────────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
    // Ambil hash dari user_credentials
    const credResult = await pool.query(
      'SELECT password_hash FROM user_credentials WHERE nip = $1', [nip]
    );
    if (!credResult.rows.length)
      return res.status(401).json({ error: 'NIP atau password salah' });

    const match = await bcrypt.compare(password, credResult.rows[0].password_hash);
    if (!match)
      return res.status(401).json({ error: 'NIP atau password salah' });

    // Ambil data user dari user_list
    const userResult = await pool.query(
      'SELECT * FROM user_list WHERE "NIP" = $1', [nip]
    );
    if (!userResult.rows.length)
      return res.status(404).json({ error: 'Data user tidak ditemukan' });

    const u = userResult.rows[0];
    res.json({
      message: 'Login berhasil',
      user: {
        id:     u.id,
        name:   u.username,
        nip:    u.NIP,
        role:   u.role   || 'Staf',
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
        TO_CHAR(tanggal, 'YYYY')            AS year,
        'Diarsipkan'                        AS status,
        '—'                                 AS uploader,
        '—'                                 AS "reviewedBy",
        ukuran                              AS size,
        0                                   AS pages,
        TO_CHAR(tanggal, 'DD Mon YYYY')     AS "uploadDate",
        ''                                  AS desc,
        url,
        icon_data
      FROM bapperida_dokumen
      ORDER BY id DESC
    `);
    res.json(docs.map(d => ({ ...d, tags: d.type ? [d.type] : [] })));
  } catch (err) {
    console.error('Docs error:', err);
    res.status(500).json({ error: 'Gagal mengambil dokumen' });
  }
});

app.post('/api/docs', async (req, res) => {
  const { title, type, sector, uploader } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, created_at)
       VALUES ($1, $2, $3, NOW(), $4, NOW()) RETURNING *`,
      [title, type, sector, '0 MB']
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

// ── Users: dari user_list ─────────────────────────────────────────────────
app.get('/api/users', async (_, res) => {
  try {
    const users = await queryDB(`
      SELECT id,
             username  AS name,
             role,
             bidang    AS unit,
             "Status"  AS status,
             "NIP"     AS nip
      FROM user_list
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data pengguna' });
  }
});

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
