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
        TO_CHAR(tanggal, 'YYYY')            AS year,
        status,
        '—'                                 AS uploader,
        '—'                                 AS "reviewedBy",
        ukuran                              AS size,
        0                                   AS pages,
        TO_CHAR(tanggal, 'DD Mon YYYY')     AS "uploadDate",
        ''                                  AS desc,
        url,
        files,
        icon_data,
        COALESCE(publik, false)             AS publik,
        COALESCE(bidang, '')                AS bidang
      FROM bapperida_dokumen
      ORDER BY id DESC
    `);
    res.json(docs.map(d => {
      let files = [];
      if (d.files) { try { files = JSON.parse(d.files); } catch (_) { files = []; } }
      return { ...d, files, tags: d.type ? [d.type] : [] };
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

  const { title, type, sector, uploader, url, ukuran, bidang, files } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at, bidang, files)
       VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6, $7) RETURNING *`,
      [title, type, sector, ukuran || '0 MB', url || '', bidang || '', files ? JSON.stringify(files) : null]

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

app.patch('/api/docs/:id/status', async (req, res) => {
  const { status } = req.body;
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
    res.json({ message: 'Status diperbarui', doc: result.rows[0] });
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
    const result = await pool.query(
      `DELETE FROM bapperida_dokumen WHERE id = $1 RETURNING judul, url, files`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    const doc = result.rows[0];
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [req.body.user || 'Admin', 'Hapus dokumen', doc.judul]
    );
    res.json({ message: 'Dokumen berhasil dihapus', gdriveUrl: doc.url, files: doc.files });
  } catch (err) {
    console.error('Delete doc error:', err);
    res.status(500).json({ error: 'Gagal menghapus dokumen' });
  }
});

// ── Edit Dokumen ────────────────────────────────────────────────────────────
app.put('/api/docs/:id', async (req, res) => {
  const { id } = req.params;
  const { judul, kategori, tipe, bidang } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bapperida_dokumen
       SET judul = COALESCE($1, judul),
           kategori = COALESCE($2, kategori),
           tipe = COALESCE($3, tipe),
           bidang = COALESCE($4, bidang)
       WHERE id = $5 RETURNING *`,
      [judul, kategori, tipe, bidang, id]
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
