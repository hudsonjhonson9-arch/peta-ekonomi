import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;

// Konfigurasi koneksi ke PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper function to handle DB queries gracefully
const queryDB = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error("Database query error:", err);
    throw err;
  }
};

// ── Authentication Route ──────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { nip, password } = req.body;
  if (!nip || !password) {
    return res.status(400).json({ error: 'NIP dan Password diperlukan' });
  }

  try {
    // Cari kredensial berdasarkan NIP
    const credResult = await pool.query('SELECT password_hash FROM user_credentials WHERE nip = $1', [nip]);
    if (credResult.rows.length === 0) {
      return res.status(401).json({ error: 'Kredensial tidak valid' });
    }

    const { password_hash } = credResult.rows[0];
    const match = await bcrypt.compare(password, password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Kredensial tidak valid' });
    }

    // Ambil detail user dari user_list
    const userResult = await pool.query('SELECT * FROM user_list WHERE "NIP" = $1', [nip]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data user tidak ditemukan' });
    }

    const user = userResult.rows[0];
    
    // Map data user agar sesuai dengan ekspektasi frontend (peta-ekonomi)
    const mappedUser = {
      id: user.id,
      name: user.username,
      nip: user.NIP,
      role: user.role || 'Staf', 
      unit: user.bidang || '—',
      email: user.NIP + '@bapperida.go.id', // Fallback jika tidak ada email di skema
      status: user.Status || 'Aktif',
    };

    res.json({ message: 'Login berhasil', user: mappedUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});

// ── Documents Routes (bapperida_dokumen) ──────────────────────────────────
app.get('/api/docs', async (req, res) => {
  try {
    // Map kolom database ke format frontend
    const docs = await queryDB(`
      SELECT 
        id, 
        judul as title, 
        kategori as type, 
        tipe as sector, 
        TO_CHAR(tanggal, 'YYYY') as year, 
        'Diarsipkan' as status, 
        '—' as uploader, 
        '—' as reviewedBy, 
        ukuran as size, 
        0 as pages, 
        TO_CHAR(tanggal, 'DD Mon YYYY') as uploadDate, 
        '' as desc, 
        url,
        icon_data
      FROM bapperida_dokumen
      ORDER BY id DESC
    `);
    
    // Frontend membutuhkan tags berupa array
    const mappedDocs = docs.map(d => ({
      ...d,
      tags: d.type ? [d.type] : []
    }));

    res.json(mappedDocs);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil dokumen' });
  }
});

app.post('/api/docs', async (req, res) => {
  const { title, type, sector, year, desc, tags, uploader } = req.body;
  try {
    // Simpan dokumen baru ke bapperida_dokumen
    // frontend fields: title -> judul, type -> kategori, sector -> tipe
    const result = await pool.query(
      `INSERT INTO bapperida_dokumen 
      (judul, kategori, tipe, tanggal, ukuran, created_at) 
      VALUES ($1, $2, $3, NOW(), $4, NOW()) RETURNING *`,
      [title, type, sector, '0 MB']
    );

    // Juga catat log aktivitas
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [uploader || 'System', 'Upload dokumen', title]
    );

    res.json({ message: 'Dokumen berhasil diunggah', doc: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan dokumen' });
  }
});

// ── Audit Logs Routes ─────────────────────────────────────────────────────
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await queryDB(`
      SELECT 
        id, 
        user_name as user, 
        action, 
        doc_title as doc, 
        TO_CHAR(created_at, 'DD Mon YYYY, HH24:MI') as time 
      FROM audit_logs 
      ORDER BY id DESC LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil log aktivitas' });
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

// ── Users Route (user_list) ───────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const users = await queryDB(`
      SELECT 
        id, 
        username as name, 
        role, 
        bidang as unit, 
        "Status" as status, 
        "NIP" as nip 
      FROM user_list
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data pengguna' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server API berjalan di http://localhost:${PORT}`);
});
