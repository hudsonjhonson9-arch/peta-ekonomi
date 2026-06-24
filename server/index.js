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
  if (process.env.UPLOAD_API_KEY) {
    const key = req.headers['x-upload-key'];
    if (!key || key !== process.env.UPLOAD_API_KEY)
      return res.status(403).json({ error: 'Forbidden: invalid upload key' });
  }

  const { title, type, sector, uploader, url, ukuran } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at)
       VALUES ($1, $2, $3, NOW(), $4, $5, NOW()) RETURNING *`,
      [title, type, sector, ukuran || '0 MB', url || '']

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
      WHERE u.bidang = 'Bidang Ekonomi dan SDA'
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
