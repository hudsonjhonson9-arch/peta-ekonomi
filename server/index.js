import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import crypto from 'crypto';
import pg      from 'pg';
import bcrypt from 'bcryptjs';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';
import { susunPatchPeriode } from './patch-periode.js';
import { idDokumenValid } from './tautan-periode.js';
import { validasiUpload, filterDaftar } from './standar-harga.js';
import { validasiItem, jumlahItem } from './draft-rincian.js';
import { ajukanDari, validasiStatus, cekSetujui } from './screening.js';
import {
  NAMA_COOKIE, MASA_JAM, R_ADMIN, R_REVIEWER, R_STAF,
  normalisasiRole, rahasia, buatToken, verifikasiTokenDetail,
  periksaKonfigurasiSession, periksaPemisahanSecret,
  bacaCookie, pasangCookie, lepasCookie, PANJANG_MINIMUM,
} from './session.js';
import { kebutuhan, PUBLIK, LOGIN, REVIEW, ADMIN } from './kebijakan.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const isProd    = process.env.NODE_ENV === 'production';

// CORS: default hanya menerima origin yang sama. Aplikasi disajikan dari
// server sendiri, jadi tidak butuh allow-list. Kalau ada integrator dari domain
// lain, sebutkan lewat CORS_ORIGIN (daftar origin dipisah koma). Jangan pakai
// '*' bersamaan dengan cookie session: itu membiarkan situs mana pun membaca
// respons API atas nama pengguna yang sedang login.
const ORIGIN_TERDAFTAR = (process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Di belakang reverse proxy (Coolify, Traefik, Nginx), req.protocol membaca
// koneksi TCP langsung ke container, yaitu http, walau klien sebenarnya lewat
// HTTPS. Tanpa trust proxy, req.secure selalu false di produksi dan cookie
// session tidak pernah bisa ditandai secure.
app.set('trust proxy', true);

app.use(cors({
  // Tanpa header Origin: permintaan same-origin atau server-to-server, boleh.
  // Dengan Origin: hanya boleh kalau terdaftar, dan daftar kosong menolak semua
  // yang datang dari domain lain.
  origin: (origin, cb) => cb(null, !origin || ORIGIN_TERDAFTAR.includes(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Integrator server-to-server mengunggah dokumen dengan header x-upload-key,
// bukan dengan session. Satu-satunya route yang boleh tanpa login, dan hanya
// kalau UPLOAD_API_KEY benar-benar disetel. Tanpa env itu, route-nya tetap
// butuh login — tanpa itu, siapa pun bisa mengunggah dokumen ke arsip.
const izinkanLewatiUpload = req => {
  if (req.method !== 'POST' || req.originalUrl.split('?')[0] !== '/api/docs') return false;
  const key = process.env.UPLOAD_API_KEY;
  return !!key && req.headers['x-upload-key'] === key;
};

// ── Gerbang session ───────────────────────────────────────────────────────
// Satu titik ini yang menegakkan hak akses semua /api. Level tiap rute diambil
// dari server/kebijakan.js, bukan dari UI, jadi menirukan role di localStorage
// tidak lagi berarti apa-apa.
//
// Role dibaca ulang dari database tiap request. Kalau role ikut disimpan di dalam
// token, admin yang dicabut haknya masih bisa memakai token lamanya sampai
// token itu kedaluwarsa.
const PERINGKAT = { [R_STAF]: 1, [R_REVIEWER]: 2, [R_ADMIN]: 3 };

// Status aktif diambil dari user_list."Status" (AKTIF / TUGAS / NONAKTIF),
// bukan dari user_credentials.active — kolom itu tidak ada di skema
// user_credentials yang dipakai aplikasi ini, hanya ada nip, password_hash,
// created_at, dan updated_at.
const akunNonaktif = status => /^\s*non\s*aktif\s*$/i.test(String(status || ''));

// Identitas untuk jejak audit. Kalau request punya session, identitas selalu
// berasal dari server dan nilai di body diabaikan: kolom uploader dan actor
// dikirim klien, jadi tanpa ini siapa pun bisa mencatat aksi atas nama orang lain.
// Cadangan ke body hanya untuk integrasi API-key yang memang tidak punya session.
const siapa = req => req.pengguna
  ? { id: req.pengguna.id ?? req.pengguna.nip, nama: req.pengguna.nama }
  : {
      id: req.body?.uploader_id ?? req.body?.actor_id ?? '',
      nama: req.body?.uploader ?? req.body?.actor_name ?? '',
    };

app.use(async (req, res, next) => {
  const path = req.originalUrl.split('?')[0];
  if (!path.startsWith('/api')) return next();

  const level = kebutuhan(req.method, path);
  if (level === PUBLIK) return next();
  if (izinkanLewatiUpload(req)) return next();

  // Tanpa rahasia yang sah, jangan menerima token apa pun: memverifikasi tanpa
  // kunci berarti menerima cookie buatan. Gagal tertutup lebih aman.
  const secret = rahasia();
  if (!secret)
    return res.status(500).json({
      error: `Session belum dikonfigurasi: SESSION_SECRET wajib diisi (minimal ${PANJANG_MINIMUM} karakter)`,
    });

  const { muatan, alasan } = verifikasiTokenDetail(bacaCookie(req), secret);
  if (!muatan) {
    // Log alasannya. Tanpa ini semua penyebab 401 kelihatan sama dari sisi
    // klien, jadi "Sesi berakhir" bisa berarti cookie tidak terkirim, secret
    // berganti, atau token kedaluwarsa, dan ketiganya diperbaiki berbeda.
    console.warn(`[auth] 401 ${req.method} ${path} — ${alasan}`);
    return res.status(401).json({ error: 'Sesi berakhir, silakan login kembali' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT c.nip, c.role, u.id, u.username, u.bidang, u."Status"
         FROM user_credentials c
         LEFT JOIN user_list u ON u."NIP" = c.nip
        WHERE c.nip = $1`,
      [muatan.sub]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'Akun tidak ditemukan' });
    if (akunNonaktif(u.Status))
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' });

    req.pengguna = {
      nip: u.nip,
      id: u.id ?? null,
      nama: u.username || u.nip,
      // name ikut dikembalikan karena komponen klien membaca user.name.
      name: u.username || u.nip,
      unit: u.bidang || '—',
      status: u.Status || 'Aktif',
      role: normalisasiRole(u.role),
    };

    if (level === ADMIN && req.pengguna.role !== R_ADMIN)
      return res.status(403).json({ error: 'Hanya admin yang boleh melakukan ini' });
    if (level === REVIEW && PERINGKAT[req.pengguna.role] < PERINGKAT[R_REVIEWER])
      return res.status(403).json({ error: 'Fitur ini untuk reviewer dan admin' });

    next();
  } catch (e) {
    console.error('Gerbang session error:', e.message);
    res.status(500).json({ error: 'Gagal memeriksa sesi' });
  }
});

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

// ── Auto-migration: Bank Data hierarki v4 ──────────────────────────────────
// Struktur baru: Bidang → OPD → IKU (nilai langsung per tahun + sumber/aspek)
//                               → IKK (nilai langsung per tahun + sumber/aspek)
//                + Data Sektoral (indikator langsung di OPD, tanpa aspek)
(async () => {
  try {
    // Tabel indikator IKU/IKK lama tidak dipakai lagi (IKU/IKK kini mengisi nilai langsung).
    // Data lama disimpan sebagai *_legacy supaya tidak bentrok dengan tabel baru.
    for (const t of [
      'bank_data_iku_indikator', 'bank_data_iku_nilai', 'bank_data_iku_triwulan',
      'bank_data_ikk_indikator', 'bank_data_ikk_nilai', 'bank_data_ikk_triwulan',
    ]) {
      try { await pool.query(`ALTER TABLE IF EXISTS ${t} RENAME TO ${t}_legacy`); } catch (e) {}
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank_data_tahun (
        id          SERIAL PRIMARY KEY,
        tahun       INTEGER UNIQUE NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- IKK kini menjadi baris data langsung: nama + sumber_data + aspek + nilai per tahun (target/capaian)
      ALTER TABLE bank_data_ikk ADD COLUMN IF NOT EXISTS sumber_data TEXT;
      ALTER TABLE bank_data_ikk ADD COLUMN IF NOT EXISTS aspek       TEXT;
      CREATE TABLE IF NOT EXISTS bank_data_ikk_nilai (
        id         BIGSERIAL PRIMARY KEY,
        ikk_id     BIGINT NOT NULL REFERENCES bank_data_ikk(id) ON DELETE CASCADE,
        tahun      INTEGER NOT NULL,
        target     TEXT,
        capaian    TEXT,
        UNIQUE (ikk_id, tahun)
      );
      CREATE TABLE IF NOT EXISTS bank_data_ikk_triwulan (
        id           BIGSERIAL PRIMARY KEY,
        ikk_id       BIGINT NOT NULL REFERENCES bank_data_ikk(id) ON DELETE CASCADE,
        tahun        INTEGER NOT NULL,
        target_tw1 TEXT, target_tw2 TEXT, target_tw3 TEXT, target_tw4 TEXT,
        capaian_tw1 TEXT, capaian_tw2 TEXT, capaian_tw3 TEXT, capaian_tw4 TEXT,
        UNIQUE (ikk_id, tahun)
      );
      -- Upgrade DB lama: jika IKK masih berkolom realisasi, rename ke target/capaian
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'bank_data_ikk_nilai' AND column_name = 'realisasi') THEN
          ALTER TABLE bank_data_ikk_nilai RENAME COLUMN capaian TO target;
          ALTER TABLE bank_data_ikk_nilai RENAME COLUMN realisasi TO capaian;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'bank_data_ikk_triwulan' AND column_name = 'realisasi_tw1') THEN
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN capaian_tw1 TO target_tw1;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN capaian_tw2 TO target_tw2;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN capaian_tw3 TO target_tw3;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN capaian_tw4 TO target_tw4;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN realisasi_tw1 TO capaian_tw1;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN realisasi_tw2 TO capaian_tw2;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN realisasi_tw3 TO capaian_tw3;
          ALTER TABLE bank_data_ikk_triwulan RENAME COLUMN realisasi_tw4 TO capaian_tw4;
        END IF;
      END $$;

      -- IKU juga mengisi nilai langsung: target/capaian + sumber_data/aspek
      ALTER TABLE bank_data_iku ADD COLUMN IF NOT EXISTS sumber_data TEXT;
      ALTER TABLE bank_data_iku ADD COLUMN IF NOT EXISTS aspek       TEXT;
      CREATE TABLE IF NOT EXISTS bank_data_iku_nilai (
        id       BIGSERIAL PRIMARY KEY,
        iku_id   BIGINT NOT NULL REFERENCES bank_data_iku(id) ON DELETE CASCADE,
        tahun    INTEGER NOT NULL,
        target   TEXT,
        capaian  TEXT,
        UNIQUE (iku_id, tahun)
      );
      CREATE TABLE IF NOT EXISTS bank_data_iku_triwulan (
        id         BIGSERIAL PRIMARY KEY,
        iku_id     BIGINT NOT NULL REFERENCES bank_data_iku(id) ON DELETE CASCADE,
        tahun      INTEGER NOT NULL,
        target_tw1 TEXT, target_tw2 TEXT, target_tw3 TEXT, target_tw4 TEXT,
        capaian_tw1 TEXT, capaian_tw2 TEXT, capaian_tw3 TEXT, capaian_tw4 TEXT,
        UNIQUE (iku_id, tahun)
      );

      -- Data Sektoral tetap memakai indikator langsung di bawah OPD
      CREATE TABLE IF NOT EXISTS bank_data_sektoral (
        id          BIGSERIAL PRIMARY KEY,
        opd_id      BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
        nama        TEXT   NOT NULL,
        urutan      INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS bank_data_sektoral_indikator (
        id          BIGSERIAL PRIMARY KEY,
        sektoral_id BIGINT NOT NULL REFERENCES bank_data_sektoral(id) ON DELETE CASCADE,
        indikator   TEXT   NOT NULL,
        sumber_data TEXT,
        aspek       TEXT,
        urutan      INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS bank_data_sektoral_nilai (
        id           BIGSERIAL PRIMARY KEY,
        indikator_id BIGINT NOT NULL REFERENCES bank_data_sektoral_indikator(id) ON DELETE CASCADE,
        tahun        INTEGER NOT NULL,
        data         TEXT,
        UNIQUE (indikator_id, tahun)
      );
      CREATE TABLE IF NOT EXISTS bank_data_sektoral_triwulan (
        id           BIGSERIAL PRIMARY KEY,
        indikator_id BIGINT NOT NULL REFERENCES bank_data_sektoral_indikator(id) ON DELETE CASCADE,
        tahun        INTEGER NOT NULL,
        data_tw1 TEXT, data_tw2 TEXT, data_tw3 TEXT, data_tw4 TEXT,
        UNIQUE (indikator_id, tahun)
      );
    `);
    await pool.query(`
      INSERT INTO bank_data_tahun (tahun) VALUES (2024), (2025)
      ON CONFLICT (tahun) DO NOTHING
    `);
    console.log('Migration: bank data v4 ready (IKU & IKK direct data)');
  } catch (e) { console.error('Migration bank data v4 error:', e.message); }
})();

// ── Auto-migration: notifications.user_id TEXT (WhatsApp IDs overflow int32)
(async () => {
  try {
    const col = await pool.query(
      `SELECT data_type FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id'`
    );
    if (col.rows[0]?.data_type === 'integer') {
      // Drop FK first, then alter type
      await pool.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey`);
      await pool.query(`ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT USING user_id::text`);
      console.log('Migration: notifications.user_id -> TEXT');
    }
  } catch (e) { console.error('Migration notifications.user_id error:', e.message); }
})();

// Jalankan berkas migration. PostgreSQL membungkus multi-statement dalam satu
// transaksi implisit, jadi kalau ada satu statement gagal SELURUH file
// rollback. Karena itu error tidak boleh ditelan: tanpa log, tabel utuh
// padahal tidak satupun tabel dibuat.
//
// tanpaFallback: matikan pengecekan "tabel sudah ada" sebagai pengganti sukses.
// Wajib diisi true untuk migration yang bukan membuat tabel (mis. DELETE),
// karena dengan daftar kosong setiap error akan dianggap "sudah ada" dan
// hilang tanpa jejak.
const jalankanMigration = async (nama, wajib = [], tanpaFallback = false) => {
  const file = path.join(__dirname, 'migrations', `${nama}.sql`);
  try {
    await pool.query(fs.readFileSync(file, 'utf8'));
    console.log(`Migration: ${nama} selesai`);
    return true;
  } catch (e) {
    // Sukses kalau tabel yang dibutuhkan sudah ada (migration dijalankan ulang).
    if (!tanpaFallback) {
      try {
        const cek = await pool.query(
          `SELECT count(*)::int AS n FROM information_schema.tables
           WHERE table_schema = current_schema() AND table_name::text = ANY($1::text[])`,
          [wajib]
        );
        if (cek.rows[0].n === wajib.length) {
          console.log(`Migration: ${nama} dilewati, tabel sudah ada`);
          return true;
        }
      } catch (_) {}
    }
    console.error(
      `Migration ${nama} GAGAL: ${e.message}\n` +
      `  kode=${e.code || '-'} posisi=${e.position ?? '-'}\n` +
      `  tidak ada tabel yang berubah. Periksa search_path: ` +
      `select current_schema(); dan pastikan tabel bapperida_dokumen ada di sana.`
    );
    return false;
  }
};

// Tahap 1: doc_shares table
jalankanMigration('tahap_1', ['doc_shares']);

// Seed RKPD 2025, hanya kalau pohon PKS untuk 2025 masih kosong.
//
// Coolify tidak menyediakan psql di dalam image, jadi seed tidak bisa
// dieksekusi manual dari container. File seed sudah idempoten (semua INSERT
// punya ON CONFLICT DO NOTHING), jadi aman kalau dijalankan berkali-kali.
// Set PKS_SKIP_SEED=1 untuk mematikan.
const jalankanSeed = async (siap) => {
  if (!siap) {
    console.log('Seed: dilewati karena migration tahap_2 belum berhasil');
    return;
  }
  try {
    if (process.env.PKS_SKIP_SEED === '1') {
      console.log('Seed: dilewati karena PKS_SKIP_SEED=1');
      return;
    }
    const file = path.join(__dirname, '..', 'db', 'seed_rkpd_2025.sql');
    if (!fs.existsSync(file)) {
      console.error(`Seed: ${file} tidak ada di image. Pastikan Dockerfile punya "COPY db/ ./db/"`);
      return;
    }
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM pks_program WHERE tahun = $1`, [2025]
    );
    if (rows[0].n > 0) {
      console.log(`Seed: dilewati, pks_program 2025 sudah berisi ${rows[0].n} baris`);
      return;
    }
    await pool.query(fs.readFileSync(file, 'utf8'));
    const n = await pool.query(
      `SELECT (SELECT count(*) FROM pks_subkegiatan WHERE tahun = 2025) AS sub,
              (SELECT count(*) FROM kertas_kerja k
                 JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id
                WHERE s.tahun = 2025) AS output`
    );
    console.log(`Seed: RKPD 2025 dimuat (${n.rows[0].sub} sub kegiatan, ${n.rows[0].output} output)`);
  } catch (e) {
    console.error(`Seed GAGAL: ${e.message} (kode=${e.code || '-'}) - tabel tetap kosong, aman`);
  }
};

jalankanMigration('tahap_2', [
  'pks_tahun', 'pks_program', 'pks_kegiatan',
  'pks_subkegiatan', 'kertas_kerja', 'kertas_kerja_periode',
])
  // Tahap 3: buang 90 output hasil seed lama. Harus setelah tahap 2 supaya
  // tabel kertas_kerja sudah ada. Dijalankan tanpa fallback agar error
  // (mis. search_path salah) tetap terlihat di log.
  .then(() => jalankanMigration('tahap_3', ['kertas_kerja'], true))
  // Tahap 4: kolom pengingat deadline pada notifications. Dijalankan tanpa
  // fallback juga, dan bukan seperti tahap_1/2: fallback di runner bernilai
  // "tabel sudah ada -> lewati", yang justru berbahaya untuk migration yang
  // menambah kolom. Kalau ALTER-nya gagal, ketahuan sebagai "dilewati" dan
  // pengingat deadline diam-diam tidak pernah terkirim.
  .then(() => jalankanMigration('tahap_4', ['notifications', 'kertas_kerja', 'kertas_kerja_periode'], true))
  // Tahap 5: backfill bukti dukung yang sudah terunggah tapi tidak pernah
  // tertaut. Jalankan setelah tahap_4 dan sebelum seed.
  //
  // Dijalankan tanpa fallback: berkas ini tidak membuat tabel, jadi pengecekan
  // "tabel sudah ada" tidak berlaku dan UPDATE yang gagal harus kelihatan di
  // log, bukan dianggap lewati. UPDATE-nya sendiri idempoten (hanya menyentuh
  // doc_id IS NULL) dan CREATE INDEX memakai IF NOT EXISTS.
  .then(() => jalankanMigration('tahap_5', ['kertas_kerja_periode', 'bapperida_dokumen'], true))
  .then(() => jalankanMigration('tahap_6', ['bank_data_iku', 'bank_data_ikk', 'bank_data_sektoral_indikator'], true))
  // Tahap 7: tabel standar_harga (SSH/SBU) + kolom pagu/kode_rekening pada
  // pks_subkegiatan. Dijalankan tanpa fallback seperti tahap_4/6: migration
  // ini menambah kolom, jadi kegagalan ALTER harus terlihat di log — fallback
  // "tabel sudah ada -> lewati" akan menutupi ALTER pks_subkegiatan yang gagal.
  .then(() => jalankanMigration('tahap_7', ['standar_harga'], true))
  // Tahap 8: tabel draft_rincian (rencana belanja per sub kegiatan). CREATE
  // TABLE IF NOT EXISTS + index; tetap tanpa fallback agar kegagalan terlihat
  // di log, konsisten dengan tahap_7.
  .then(() => jalankanMigration('tahap_8', ['draft_rincian'], true))
  // Tahap 9: tabel screening_perubahan (+item) dan kolom
  // pks_subkegiatan.realisasi. Sisip setelah tahap_8 dan sebelum seed.
  .then(() => jalankanMigration('tahap_9', ['screening_perubahan', 'screening_perubahan_item'], true))
  // Tahap 10: kolom alur validasi sub kegiatan (status_validasi, catatan_validasi,
  // status_oleh, status_at). Tanpa fallback seperti tahap_9: migration menambah
  // kolom, jadi kegagalan ALTER harus terlihat di log.
  .then(() => jalankanMigration('tahap_10', ['pks_subkegiatan'], true))
  .then(jalankanSeed);

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

    const cred = credResult.rows[0];

    // Jangan bocorkan apakah akun ada sebelum password dicocokkan. NIP tak
    // dikenal dan password salah memakai pesan yang sama.
    const match = await bcrypt.compare(password, cred.password_hash);
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

    // Password sudah cocok, baru boleh menyebut kondisi akun.
    if (akunNonaktif(u.Status))
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' });

    // Token hanya membawa NIP. Role sengaja tidak ikut, supaya dicabutnya hak
    // akses berlaku seketika tanpa menunggu token lama kedaluwarsa.
    let token;
    try {
      token = buatToken(nip);
    } catch (e) {
      console.error('Login: session error:', e.message);
      return res.status(500).json({ error: 'Session belum dikonfigurasi. Hubungi administrator.' });
    }
    pasangCookie(res, token, req);

    res.json({
      message: 'Login berhasil',
      user: {
        id:     u.id,
        name:   u.username,
        nip:    u.NIP,
        role:   normalisasiRole(cred.role),
        unit:   u.bidang || '—',
        status: u.Status || 'Aktif',
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});

// Sesi yang sedang berlaku, dibaca dari cookie. Klien memakai ini untuk memastikan
// role di localStorage masih benar: localStorage bisa disunting, cookie tidak.
app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.pengguna });
});

app.post('/api/auth/logout', (_, res) => {
  lepasCookie(res);
  res.json({ message: 'Logout berhasil' });
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
        -- Nama uploader ikut dikirim karena klien membacanya di tiga tempat:
        -- detail dokumen, dashboard, dan pencarian. uploader_id dipakai sebagai
        -- cadangan karena baris lama bisa menyimpan nama, bukan NIP.
        --
        -- Dipakai subquery, bukan LEFT JOIN, supaya tidak ada satu pun kolom
        -- yang perlu ditutup nama tabel: bapperida_dokumen dan user_list
        -- sama-sama punya id dan bidang, jadi JOIN membuat SELECT ini ambigu.
        COALESCE(
          (SELECT up.username FROM user_list up
            WHERE up."NIP" = bapperida_dokumen.uploader_id LIMIT 1),
          uploader_id, ''
        )                                         AS uploader,
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
  // Di sinilah session sudah dipastikan ada oleh gerbang, kecuali integrator
  // lolos lewat UPLOAD_API_KEY yang sudah divalidasi di izinkanLewatiUpload.
  if (!req.pengguna && !process.env.UPLOAD_API_KEY)
    return res.status(401).json({ error: 'Wajib login' });

  const { title, type, sector, uploader, url, ukuran, bidang, files, pages,
          desc, tags, uploader_id, nomor_dokumen, tanggal_dokumen, tahun,
          fileType, kertas_kerja_periode_id } = req.body;

  // Bukti dukung Kertas Kerja harus lahir sudah terhubung ke periodenya.
  //
  // Sebelumnya tautan dibuat oleh permintaan terpisah dari browser setelah
  // upload selesai. Dua permintaan, dua transaksi terpisah: kalau yang kedua
  // gagal — session habis, jaringan putus, tab ditutup — dokumennya tetap ada
  // di arsip tapi periodenya kosong, dan tidak ada kolom yang bisa menyimpan
  // asal-usulnya. Dokumen seperti itu mustahil ditemukan lagi dari sisi
  // Kertas Kerja. Sekarang tautan ikut dalam transaksi yang sama, jadi dokumen
  // ada berarti tertaut.
  const idPeriode = idDokumenValid(kertas_kerja_periode_id);
  if (kertas_kerja_periode_id != null && idPeriode == null)
    return res.status(400).json({ error: 'kertas_kerja_periode_id tidak valid' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
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
    const doc = result.rows[0];

    // Idempoten: periode yang sudah punya dokumen tidak ditimpa. Unggah ulang
    // karena salah judul tidak boleh menghapus bukti dukung yang sudah benar.
    let tertaut = null;
    const pengunggah = siapa(req);
    if (idPeriode) {
      const up = await client.query(
        `UPDATE kertas_kerja_periode
            SET doc_id = $1,
                uploaded_by = COALESCE($2, uploaded_by),
                uploaded_at = NOW()
          WHERE id = $3 AND doc_id IS NULL
          RETURNING id, kertas_kerja_id, tahun, periode, periode_label`,
        [doc.id, pengunggah.id || null, idPeriode]
      );
      tertaut = up.rows[0] || null;
    }

    await client.query('COMMIT');

    // Insert doc_history
    const pelamar = pengunggah;
    try {
      await pool.query(
        `INSERT INTO doc_history (doc_id, action, from_status, to_status, actor_id, actor_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [doc.id, 'upload', null, 'Menunggu Review', pelamar.id || '', pelamar.nama || 'System']
      );
    } catch (_) {}
    await pool.query(
      `INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)`,
      [pelamar.nama || 'System', 'Upload dokumen', title]
    );
    // Notify all admins about new upload
    try {
      // Disaring lewat user_credentials, bukan user_list: kolom role di
      // user_list tidak sinkron dengan user_credentials (mapRoleToDb menulis
      // 'ADMIN'/'KABID'/'USER' huruf besar), jadi "role = 'Admin'" tidak pernah
      // cocok dan hanya pengunggah yang diberi tahu.
      //
      // Notifikasi memakai NIP sebagai user_id. Nilai di sini yang disimpan
      // user_credentials.nip, jadi harus NIP juga supaya tidak menabrak identitas
      // session.
      const admins = (await queryDB(`SELECT c.nip, c.role FROM user_credentials c`))
        .filter(r => PERINGKAT[normalisasiRole(r.role)] >= PERINGKAT[R_REVIEWER]);
      for (const a of admins) {
        // Menunggu: tanpa await, INSERT bisa berjalan setelah respons terkirim
        // dan hilang kalau proses keburu restart.
        await createNotification(a.nip, 'Dokumen Baru', `"${title}" diunggah oleh ${pelamar.nama || 'System'}.`, 'info', doc.id);
      }
    } catch (_) {}
    // tertaut: null saat tidak ada periode yang dituju. Klien memakai ini untuk
    // tahu apakah masih perlu melakukan permintaan tautan kedua.
    res.json({ message: 'Dokumen berhasil diunggah', doc, tertaut });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Upload error:', err);
    if (err.code === '23503')
      return res.status(409).json({ error: 'Periode Kertas Kerja tidak ditemukan' });
    res.status(500).json({ error: 'Gagal menyimpan dokumen' });
  } finally {
    client.release();
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
  const pelamar = siapa(req);

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
      [status, pelamar.nama || '', note || '', id]
    );

    // Insert history
    await pool.query(
      `INSERT INTO doc_history (doc_id, action, from_status, to_status, actor_id, actor_name, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, status === 'Diarsipkan' ? 'approve' : 'reject', from, status, pelamar.id || '', pelamar.nama || '', note || '']
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
    if (year) { metaFilters.push(`TO_CHAR(d.tanggal, 'YYYY') = $${paramIdx++}`); metaParams.push(year); }
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
          TO_CHAR(d.tanggal, 'YYYY') AS tahun,
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
        ORDER BY (
          CASE
            WHEN d.judul ILIKE $${paramIdx} THEN 10
            WHEN d.nomor_dokumen ILIKE $${paramIdx} THEN 8
            WHEN d."desc" ILIKE $${paramIdx} THEN 5
            WHEN d.tags ILIKE $${paramIdx} THEN 3
            ELSE 0
          END + COALESCE(MAX(ts_rank_cd(c.tsv, websearch_to_tsquery('simple', $${paramIdx}))), 0) * 20
        ) DESC
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
    res.status(500).json({ error: 'Gagal menjalankan pencarian', detail: err.message });
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
  const { url, ukuran, pages, note } = req.body;
  if (!url) return res.status(400).json({ error: 'url wajib diisi' });

  // Identitas pengunggah versi diambil dari session, bukan dari body.
  const pelamar = siapa(req);

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
      [id, pelamar.id || '', pelamar.nama || '', note || `Versi ${newVer}`]
    );

    // Notify admin/reviewer. Disaring di JS memakai normalisasiRole karena
    // user_credentials.role bisa berisi 'Admin' maupun 'ADMIN', dan kolom
    // active tidak ada di tabel ini.
    const titleRes = await client.query(`SELECT judul FROM bapperida_dokumen WHERE id=$1`, [id]);
    const judul = titleRes.rows[0]?.judul || '';
    const notifRes = await client.query(
      `SELECT nip, role FROM user_credentials`
    );
    for (const r of notifRes.rows) {
      if (PERINGKAT[normalisasiRole(r.role)] < PERINGKAT[R_REVIEWER]) continue;
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
  const pelamar = siapa(req);
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
      [id, pelamar.id || '', pelamar.nama || '', `Pemulihan dari v${versionNo}`]
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

// ── Share Links ──────────────────────────────────────────────────────────
app.post('/api/docs/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresIn, customExpiresAt } = req.body;
    const userId = req.headers['x-user-id'] || 'system';

    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const verifCode = `${rawCode.slice(0,4)}-${rawCode.slice(4)}`;

    let expiresAt = null;
    if (expiresIn && expiresIn !== 'none') {
      const durations = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      if (expiresIn === 'custom' && customExpiresAt) {
        expiresAt = new Date(customExpiresAt);
      } else if (durations[expiresIn]) {
        expiresAt = new Date(Date.now() + durations[expiresIn]);
      }
    }

    const result = await pool.query(
      `INSERT INTO doc_shares (doc_id, token, verif_code, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, token, verifCode, expiresAt, userId]
    );

    res.json({ share: result.rows[0] });
  } catch (e) {
    console.error('Create share error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/docs/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM doc_shares WHERE doc_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [id]
    );
    res.json({ shares: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/docs/:id/shares/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    await pool.query(`UPDATE doc_shares SET is_active = FALSE WHERE id = $1`, [shareId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

// ═══ Pohon PKS (Program / Kegiatan / Sub Kegiatan) ═══════════════════════
// Pohon dibuat sendiri di arsip-digital, tidak memakai tabel SIMAPO, supaya
// fitur ini mandiri. Dimensi tahun mengikuti pola bank_data_*_nilai.

// Identifier diambil dari peta konstanta, BUKAN dari input pengguna.
const PKS_LEVEL = {
  program: {
    table: 'pks_program', parentCol: null, label: 'Program',
    fields: ['kode', 'nama', 'urutan'],
  },
  kegiatan: {
    table: 'pks_kegiatan', parentCol: 'program_id', label: 'Kegiatan',
    fields: ['kode', 'nama', 'urutan'],
  },
  subkegiatan: {
    table: 'pks_subkegiatan', parentCol: 'kegiatan_id', label: 'Sub Kegiatan',
    fields: ['kode', 'nama', 'urutan', 'indikator', 'target'],
  },
};

const pksLevel = (req) => PKS_LEVEL[req.params.level];

const hitungUrutanBerikutnya = async (cfg, parentId, tahun) => {
  const where = ['tahun = $1'];
  const params = [tahun];
  if (cfg.parentCol) {
    params.push(parentId);
    where.push(`${cfg.parentCol} = $${params.length}`);
  }
  const rows = await queryDB(
    `SELECT COALESCE(MAX(urutan), 0) AS mx FROM ${cfg.table} WHERE ${where.join(' AND ')}`,
    params
  );
  return (rows[0]?.mx ?? 0) + 1;
};

// Daftarkan tahun ke pks_tahun bila belum ada (dipakai year picker).
const daftarTahun = async (tahun) => {
  await queryDB('INSERT INTO pks_tahun (tahun) VALUES ($1) ON CONFLICT (tahun) DO NOTHING', [tahun]);
};

// ── Daftar tahun ──────────────────────────────────────────────────────────
app.get('/api/pks/tahun', async (_, res) => {
  try {
    const rows = await queryDB(`
      SELECT t.tahun FROM pks_tahun t
      WHERE EXISTS (SELECT 1 FROM pks_program p WHERE p.tahun = t.tahun)
      ORDER BY t.tahun DESC
    `);
    const now = new Date().getFullYear();
    const nums = rows.map(r => r.tahun);
    for (const y of [now + 1, now, now - 1]) {
      if (!nums.includes(y)) nums.push(y);
    }
    // Tahun yang sudah punya program didahulukan supaya klien bisa memakai
    // elemen pertama sebagai default (tahun berjalan belum tentu terisi).
    // Urutan tampilan tidak terpengaruh; dropdown mengurutkan sendiri.
    const unik = [...new Set(nums)];
    res.json([
      ...unik.filter(y => rows.some(r => r.tahun === y)),
      ...unik.filter(y => !rows.some(r => r.tahun === y)),
    ]);
  } catch (err) {
    console.error('Get pks tahun error:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar tahun' });
  }
});

// ── Pohon lengkap + output + periode (satu request untuk accordion) ───────
app.get('/api/pks/tree', async (req, res) => {
  const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
  try {
    const programs = await queryDB(
      'SELECT id, kode, nama, urutan, tahun FROM pks_program WHERE tahun = $1 ORDER BY urutan, kode',
      [tahun]
    );
    const kegiatan = await queryDB(
      'SELECT id, program_id, kode, nama, urutan FROM pks_kegiatan WHERE tahun = $1 ORDER BY urutan, kode',
      [tahun]
    );
    const sub = await queryDB(
      `SELECT id, kegiatan_id, kode, nama, urutan, indikator, target, pagu, kode_rekening,
              realisasi, status_validasi, catatan_validasi, status_oleh, status_at
       FROM pks_subkegiatan WHERE tahun = $1 ORDER BY urutan, kode`,
      [tahun]
    );

    // Output beserta periodenya, digabung dalam satu query agar tidak N+1.
    const kkRows = await queryDB(
      `SELECT k.id, k.subkegiatan_id, k.nama, k.indikator, k.frekuensi,
              k.target_per_tahun, k.bulan_wajib, k.deadline_rule, k.pic_id, k.keterangan,
               COALESCE(ul.username, k.pic_id) AS pic_nama, ul.bidang AS pic_unit,
               p.id AS periode_id, p.periode, p.periode_label,
               TO_CHAR(p.deadline, 'YYYY-MM-DD') AS deadline, p.is_wajib,
               p.doc_id, p.catatan, p.uploaded_by, p.uploaded_at,
               d.judul AS doc_judul, d.status AS doc_status
       FROM kertas_kerja k
       JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id
       -- Nama PIC diselesaikan di server, bukan di klien: /api/users hanya
       -- untuk admin, jadi user biasa tidak punya daftar untuk dipetakan dari
       -- NIP. COALESCE menjaga PIC yang diisi teks bebas tetap tampil apa adanya.
       LEFT JOIN user_list ul ON ul."NIP" = k.pic_id
       LEFT JOIN kertas_kerja_periode p ON p.kertas_kerja_id = k.id AND p.tahun = $1
       LEFT JOIN bapperida_dokumen d ON d.id = p.doc_id
       WHERE s.tahun = $1 AND k.is_active
       ORDER BY k.id, p.periode`,
      [tahun]
    );

// Lipat baris periode menjadi object per output.
    const outputs = new Map();
    for (const r of kkRows) {
      if (!outputs.has(r.id)) {
        outputs.set(r.id, {
          id: r.id, subkegiatan_id: r.subkegiatan_id, nama: r.nama, indikator: r.indikator,
          frekuensi: r.frekuensi, target_per_tahun: r.target_per_tahun,
          bulan_wajib: r.bulan_wajib, deadline_rule: r.deadline_rule,
          pic_id: r.pic_id, pic_nama: r.pic_nama, pic_unit: r.pic_unit,
          keterangan: r.keterangan, periods: [],
        });
      }
      if (r.periode_id != null) {
        outputs.get(r.id).periods.push({
          id: r.periode_id, periode: r.periode, periode_label: r.periode_label,
          deadline: r.deadline, is_wajib: r.is_wajib, doc_id: r.doc_id,
          doc_judul: r.doc_judul, doc_status: r.doc_status,
          catatan: r.catatan, uploaded_by: r.uploaded_by, uploaded_at: r.uploaded_at,
        });
      }
    }

    const outputsBySub = new Map();
    for (const o of outputs.values()) {
      if (!outputsBySub.has(o.subkegiatan_id)) outputsBySub.set(o.subkegiatan_id, []);
      outputsBySub.get(o.subkegiatan_id).push(o);
    }

    const subByKeg = new Map();
    for (const s of sub) {
      subByKeg.set(s.id, { ...s, outputs: outputsBySub.get(s.id) || [] });
    }
    const tree = programs.map(p => ({
      ...p,
      kegiatan: kegiatan
        .filter(k => k.program_id === p.id)
        .map(k => ({
          ...k,
          subkegiatan: sub.filter(s => s.kegiatan_id === k.id).map(s => subByKeg.get(s.id)),
        })),
    }));
    res.json({ tahun, tree });
  } catch (err) {
    console.error('Get pks tree error:', err);
    res.status(500).json({ error: 'Gagal mengambil pohon PKS' });
  }
});

// ── Ringkasan kelengkapan satu tahun ──────────────────────────────────────
app.get('/api/pks/ringkasan/:tahun', async (req, res) => {
  const tahun = parseInt(req.params.tahun, 10);
  if (!tahun) return res.status(400).json({ error: 'Tahun tidak valid' });
  try {
    const r = (await queryDB(`
      SELECT
        COUNT(*) FILTER (WHERE p.is_wajib)                                        AS wajib,
        COUNT(*) FILTER (WHERE p.is_wajib AND p.doc_id IS NOT NULL)               AS terisi,
        COUNT(*) FILTER (WHERE p.is_wajib AND p.doc_id IS NULL
                           AND p.deadline < CURRENT_DATE)                         AS terlambat,
        COUNT(*) FILTER (WHERE p.is_wajib AND p.doc_id IS NULL
                           AND p.deadline BETWEEN CURRENT_DATE
                           AND CURRENT_DATE + 3)                                 AS mauDeadline,
        COUNT(DISTINCT k.id)                                                     AS output,
        COUNT(DISTINCT s.id)                                                     AS subkegiatan
      FROM kertas_kerja_periode p
      JOIN kertas_kerja k ON k.id = p.kertas_kerja_id AND k.is_active
      JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id AND s.tahun = $1
      WHERE p.tahun = $1
    `, [tahun]))[0] || {};
    res.json({ tahun, ...r });
  } catch (err) {
    console.error('Get ringkasan error:', err);
    res.status(500).json({ error: 'Gagal mengambil ringkasan' });
  }
});

// ── Deadline terdekat (badge notifikasi) ─────────────────────────────────
// tahun opsional. Tanpa itu endpoint ini mengembalikan semua tahun, yang
// dipakai notifikasi. Dashboard dan halaman Kertas Kerja mengirim tahun yang
// sedang dipilih supaya daftar deadline tidak bercampur dengan tahun lain.
app.get('/api/pks/deadline-terdekat', async (req, res) => {
  const hari = parseInt(req.query.hari, 10) || 14;
  const tahun = req.query.tahun ? parseInt(req.query.tahun, 10) : null;
  if (req.query.tahun && !tahun) return res.status(400).json({ error: 'Tahun tidak valid' });
  try {
    const rows = await queryDB(`
      SELECT p.id, p.periode_label,
             TO_CHAR(p.deadline, 'YYYY-MM-DD') AS deadline,
             k.nama AS output, s.kode AS sub_kode,
             CASE WHEN p.deadline < CURRENT_DATE THEN true ELSE false END AS lewat
      FROM kertas_kerja_periode p
      JOIN kertas_kerja k ON k.id = p.kertas_kerja_id AND k.is_active
      JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id
      WHERE p.is_wajib AND p.doc_id IS NULL
        AND p.deadline <= CURRENT_DATE + $1::int
        AND ($2::int IS NULL OR p.tahun = $2::int)
      ORDER BY p.deadline ASC
      LIMIT 50
    `, [hari, tahun]);
    res.json(rows);
  } catch (err) {
    console.error('Get deadline terdekat error:', err);
    res.status(500).json({ error: 'Gagal mengambil deadline terdekat' });
  }
});

// ── Pengingat deadline untuk PIC dan reviewer ────────────────────────────
//
// Dipisah dari endpoint di atas supaya perhitungan ambang hanya ada di satu
// tempat: pratinjau manual dan pengiriman terjadwal memakai aturan yang sama.
//
// Ambang bertingkat supaya orang tidak diberi tahu setiap hari: satu periode
// menerima paling banyak tiga pesan (T-7, T-3, lalu lewat). Ubah di
// AMBANG_PENGINGAT kalau ritmenya perlu lain.
//
// Ambang ditulis menaik dan itu disengaja. ambangUntuk() mengembalikan
// threshold terkecil yang masih >= sisa_hari, jadi urutan daftar menentukan
// hasilnya: sisa_hari 3 harus jatuh ke bucket 3 hari, bukan ke 7 hari.
// Dengan [3, 7] satu periode tidak menerima pesan T-7 dan T-3 sekaligus di
// jam yang sama.
const AMBANG_PENGINGAT = [3, 7];
const JANGKAU_CARI = Math.max(...AMBANG_PENGINGAT) + 1;

// Pengaman: kalau nanti ambangnya diperbanyak, satu periode dengan banyak
// penerima tidak boleh membanjiri. dedupe_key tetap satu-satunya penghalang
// duplikasi yang sesungguhnya.
const BATAS_NOTIFIKASI_PER_JALAN = 500;

// Deadline dibaca dari kolomnya, bukan dihitung ulang dari deadline_rule: admin
// boleh menulis ulang deadline per periode, jadi derivasi ulang bisa melenceng.
const cariDeadlineButuhPengingat = async () => queryDB(`
  SELECT p.id AS periode_id,
         p.tahun,
         p.periode,
         p.periode_label,
         TO_CHAR(p.deadline, 'YYYY-MM-DD') AS deadline,
         (p.deadline - CURRENT_DATE) AS sisa_hari,
         k.id AS output_id,
         k.nama AS output,
         s.kode AS sub_kode,
         -- COALESCE, bukan nilai user_list mentah: pic_id boleh berisi teks
         -- bebas kalau PIC tidak punya akun, dan pesan tetap perlu menyebut
         -- namanya.
         COALESCE(ul.username, k.pic_id) AS pic_nama,
         k.pic_id,
         -- Hanya NIP yang punya kredensial bisa menerima notifikasi. PIC yang
         -- namanya diketik bebas tidak punya akun untuk dituju.
         (c.nip IS NOT NULL) AS pic_bisa_login
    FROM kertas_kerja_periode p
    JOIN kertas_kerja k ON k.id = p.kertas_kerja_id AND k.is_active
    JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id
    LEFT JOIN user_list ul ON ul."NIP" = k.pic_id
    LEFT JOIN user_credentials c ON c.nip = k.pic_id
   WHERE p.is_wajib AND p.doc_id IS NULL
     AND p.deadline <= CURRENT_DATE + $1::int
   ORDER BY p.deadline ASC`,
  [JANGKAU_CARI]);

// Bucket deadline untuk satu baris: threshold terkecil yang masih >= sisa_hari.
// Sisa_hari 2 dan 3 sama-sama masuk T-3; sisa_hari 5 dan 7 masuk T-7.
const ambangUntuk = sisaHari => {
  if (sisaHari < 0) return 'lewat';
  for (const a of AMBANG_PENGINGAT) if (sisaHari <= a) return a;
  return null;
};

// Pesan untuk satu periode. Ditulis sebagai fungsi supaya judul dan isi T-3
// dan T-lewat tidak terlihat berbeda tanpa disengaja.
const susunPesan = (b, ambang) => {
  const dasar = `"${b.output}" (${b.sub_kode}) periode ${b.periode_label}`;
  const siapa = b.pic_nama ? `PIC: ${b.pic_nama}.` : 'PIC belum diisi.';
  return ambang === 'lewat'
    ? {
        title: 'Deadline lewat',
        message: `${dasar} sudah lewat pada ${b.deadline}. ${siapa}`,
        type: 'warning',
      }
    : {
        title: `Deadline ${ambang} hari lagi`,
        message: `${dasar} jatuh tempo ${b.deadline}. ${siapa}`,
        type: 'info',
      };
};

const kirimPengingatDeadline = async () => {
  try {
    const baris = await cariDeadlineButuhPengingat();
    const perlu = baris
      .map(b => ({ ...b, ambang: ambangUntuk(Number(b.sisa_hari)) }))
      .filter(b => b.ambang !== null);
    if (!perlu.length) return { terkirim: 0, dilewati: 0 };

    // Reviewer + admin. Disaring di JS dengan normalisasiRole karena
    // user_credentials.role bisa berisi 'Reviewer' maupun 'KABID', dan tabel
    // itu tidak punya kolom active untuk dicek.
    const reviewer = (await queryDB(`SELECT nip, role FROM user_credentials`))
      .filter(r => PERINGKAT[normalisasiRole(r.role)] >= PERINGKAT[R_REVIEWER])
      .map(r => r.nip);

    const pesan = [];
    for (const b of perlu) {
      // Set supaya reviewer yang kebetulan juga jadi PIC tidak menerima dua
      // notifikasi identik untuk periode yang sama.
      const penerima = new Set(reviewer);
      if (b.pic_bisa_login && b.pic_id) penerima.add(b.pic_id);
      const { title, message, type } = susunPesan(b, b.ambang);
      for (const nip of penerima) {
        pesan.push({
          dedupe_key: `${b.periode_id}:${b.ambang}:${nip}`,
          user_id: nip, title, message, type,
          kertas_kerja_id: b.output_id, periode_id: b.periode_id,
        });
      }
      if (pesan.length >= BATAS_NOTIFIKASI_PER_JALAN) break;
    }
    if (!pesan.length) return { terkirim: 0, dilewati: 0 };

    // Satu INSERT untuk semua pesan. ON CONFLICT DO NOTHING membuat
    // pengulangan menjadi no-op tanpa perlu cek-select per pesan, dan
    // rowCount hanya menghitung yang benar-benar baru.
    //
    // Predikat WHERE pada ON CONFLICT wajib ikut ditulis supaya Postgres
    // mengindeks unique index parsial yang dibuat di migration tahap_4.
    const hasil = await pool.query(
      `INSERT INTO notifications
         (user_id, title, message, type, kertas_kerja_id, periode_id, dedupe_key)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[], $7::text[])
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        pesan.map(p => p.user_id), pesan.map(p => p.title),
        pesan.map(p => p.message), pesan.map(p => p.type),
        pesan.map(p => p.kertas_kerja_id), pesan.map(p => p.periode_id),
        pesan.map(p => p.dedupe_key),
      ]
    );
    const terkirim = hasil.rowCount;
    return { terkirim, dilewati: pesan.length - terkirim, ambang: perlu.length };
  } catch (err) {
    // Jangan sampai satu kegagalan menjatuhkan proses: interval akan mencoba
    // lagi pada jalannya berikutnya.
    console.error('Pengingat deadline error:', err.message);
    return { terkirim: 0, error: err.message };
  }
};

// Jalankan pengingat sekarang tanpa menunggu jadwal. Untuk administrator yang
// sedang menunggu notifikasi muncul di lonceng reviewer, atau untuk memastikan
// setelah deploy. Keringanan karena dedupe_key: menjalankannya dua kali tidak
// menghasilkan pesan ganda.
app.post('/api/kertas-kerja/pengingat', async (req, res) => {
  const hasil = await kirimPengingatDeadline();
  res.json({
    ...hasil,
    pesan: hasil.error ? 'Gagal mengirim pengingat' : 'Pengingat deadline diproses',
  });
});

// Dijalankan dari app.listen, bukan dari request: pengingat harus tetap
// terkirim saat tidak ada browser yang terbuka.
const mulaiPengingatDeadline = () => {
  const ms = 60 * 60 * 1000;
  // Tunda jalannya pertama supaya tidak berebut dengan migration tahap_4 yang
  // masih berjalan saat boot.
  setTimeout(() => { kirimPengingatDeadline(); }, 15000);
  setInterval(() => { kirimPengingatDeadline(); }, ms);
  console.log(`Pengingat deadline aktif (setiap ${Math.round(ms / 60000)} menit)`);
};

// ── CRUD tiap level pohon ────────────────────────────────────────────────
app.get('/api/pks/:level', async (req, res) => {
  const cfg = pksLevel(req);
  if (!cfg) return res.status(404).json({ error: 'Level tidak dikenal' });
  const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
  try {
    let sql = `SELECT * FROM ${cfg.table} WHERE tahun = $1`;
    const params = [tahun];
    if (cfg.parentCol && req.query.parent_id) {
      params.push(req.query.parent_id);
      sql += ` AND ${cfg.parentCol} = $${params.length}`;
    }
    sql += ' ORDER BY urutan, kode';
    res.json(await queryDB(sql, params));
  } catch (err) {
    console.error(`Get pks ${req.params.level} error:`, err);
    res.status(500).json({ error: `Gagal mengambil data ${cfg.label}` });
  }
});

app.post('/api/pks/:level', async (req, res) => {
  const cfg = pksLevel(req);
  if (!cfg) return res.status(404).json({ error: 'Level tidak dikenal' });
  const { kode, nama, parent_id, indikator, target } = req.body;
  const tahun = parseInt(req.body.tahun, 10);
  if (!kode || !String(kode).trim()) return res.status(400).json({ error: 'Kode wajib diisi' });
  if (!nama || !String(nama).trim()) return res.status(400).json({ error: 'Nama wajib diisi' });
  if (!tahun) return res.status(400).json({ error: 'Tahun wajib diisi' });
  if (cfg.parentCol && !parent_id) return res.status(400).json({ error: `Parent ${cfg.label} wajib dipilih` });

  try {
    await daftarTahun(tahun);
    const urutan = await hitungUrutanBerikutnya(cfg, parent_id, tahun);
    const cols = ['kode', 'nama', 'urutan', 'tahun'];
    const vals = [String(kode).trim(), String(nama).trim(), urutan, tahun];
    if (cfg.parentCol) { cols.push(cfg.parentCol); vals.push(parent_id); }
    if (cfg.table === 'pks_subkegiatan') {
      cols.push('indikator', 'target');
      vals.push(indikator || null, target || null);
    }
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await queryDB(
      `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${ph}) RETURNING *`, vals
    );
    res.json({ message: `${cfg.label} berhasil ditambahkan`, row: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Kode ${kode} sudah dipakai untuk tahun ${tahun}` });
    }
    console.error(`Create pks ${req.params.level} error:`, err);
    res.status(500).json({ error: `Gagal menambahkan ${cfg.label}` });
  }
});

app.put('/api/pks/:level/:id', async (req, res) => {
  const cfg = pksLevel(req);
  if (!cfg) return res.status(404).json({ error: 'Level tidak dikenal' });
  const { id } = req.params;
  const { kode, nama, parent_id, indikator, target, pagu, kode_rekening, realisasi } = req.body;
  if (!kode || !String(kode).trim()) return res.status(400).json({ error: 'Kode wajib diisi' });
  if (!nama || !String(nama).trim()) return res.status(400).json({ error: 'Nama wajib diisi' });
  try {
    const sets = ['kode = $1', 'nama = $2', 'updated_at = NOW()'];
    const params = [String(kode).trim(), String(nama).trim()];
    if (cfg.parentCol) {
      if (!parent_id) return res.status(400).json({ error: `Parent ${cfg.label} wajib dipilih` });
      params.push(parent_id);
      sets.push(`${cfg.parentCol} = $${params.length}`);
    }
    if (cfg.table === 'pks_subkegiatan') {
      params.push(indikator || null);
      sets.push(`indikator = $${params.length}`);
      params.push(target || null);
      sets.push(`target = $${params.length}`);
      // Screening RKA: pagu & chips rekening. Opsional — tidak dikirim = tidak
      // diubah, jadi pemanggilan lama (hanya kode/nama) tetap berperilaku sama.
      //
      // Selama sub kegiatan menunggu/disetujui, pagu & rekening terkunci
      // (rencana sedang/akan divalidasi). Realisasi di bawah TIDAK dikunci:
      // angka aktual terus berjalan sepanjang tahun.
      if (pagu !== undefined || kode_rekening !== undefined) {
        const st = await statusSub(idAman(id));
        if (st && SUB_TERKUNCI.includes(st)) {
          return res.status(409).json({ error: pesanTerkunci(st) });
        }
      }
      if (pagu !== undefined) {
        const n = pagu === null || pagu === '' ? null : Number(pagu);
        if (n !== null && !Number.isFinite(n)) return res.status(400).json({ error: 'Pagu harus angka' });
        params.push(n);
        sets.push(`pagu = $${params.length}`);
      }
      if (kode_rekening !== undefined) {
        if (!Array.isArray(kode_rekening) || kode_rekening.some(c => typeof c !== 'string')) {
          return res.status(400).json({ error: 'Kode rekening harus berupa array teks' });
        }
        params.push(kode_rekening);
        sets.push(`kode_rekening = $${params.length}`);
      }
      // Screening RKA: realisasi anggaran. Opsional seperti pagu.
      if (realisasi !== undefined) {
        const n = realisasi === null || realisasi === '' ? null : Number(realisasi);
        if (n !== null && !Number.isFinite(n)) return res.status(400).json({ error: 'Realisasi harus angka' });
        params.push(n);
        sets.push(`realisasi = $${params.length}`);
      }
    }
    params.push(id);
    const rows = await queryDB(
      `UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    if (!rows.length) return res.status(404).json({ error: `${cfg.label} tidak ditemukan` });
    res.json({ message: `${cfg.label} berhasil diperbarui`, row: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Kode ${kode} sudah dipakai pada tahun yang sama` });
    }
    console.error(`Update pks ${req.params.level} error:`, err);
    res.status(500).json({ error: `Gagal memperbarui ${cfg.label}` });
  }
});

app.delete('/api/pks/:level/:id', async (req, res) => {
  const cfg = pksLevel(req);
  if (!cfg) return res.status(404).json({ error: 'Level tidak ditemukan' });
  const { id } = req.params;
  try {
    const rows = await queryDB(`DELETE FROM ${cfg.table} WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) return res.status(404).json({ error: `${cfg.label} tidak ditemukan` });
    res.json({ message: `${cfg.label} berhasil dihapus` });
  } catch (err) {
    // Rantai FK memakai ON DELETE RESTRICT: hapus ditolak bila punya anak.
    if (err.code === '23503') {
      return res.status(409).json({
        error: `Tidak bisa dihapus: masih ada data di bawahnya. Hapus yang paling bawah lebih dulu.`
      });
    }
    console.error(`Delete pks ${req.params.level} error:`, err);
    res.status(500).json({ error: `Gagal menghapus ${cfg.label}` });
  }
});

// ═══ Kertas Kerja (output per sub kegiatan) ═════════════════════════════

// ── Periode & deadline ────────────────────────────────────────────────────
// Tanggal dihitung di server agar tahun kabis/leap year ditangani benar.
const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const NAMA_TRIWULAN = ['', 'I', 'II', 'III', 'IV'];

const hariDalamBulan = (tahun, bulan) => new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

const isoDate = (y, m, d) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const tambahHari = (y, m, d, n) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};

// deadline_rule: next_month:N | next_month:last | quarter_end:N
//                | semiannual_end:N | year_end | next_january
const hitungDeadline = (rule, tahun, periode) => {
  const nama = String(rule || 'year_end');
  const [jenis, arg] = nama.split(':');
  const n = parseInt(arg, 10);

  if (jenis === 'next_month') {
    let y = tahun;
    let m = periode + 1;
    if (m > 12) { m = 1; y += 1; }
    const d = arg === 'last'
      ? hariDalamBulan(y, m)
      : Math.min(Number.isFinite(n) ? n : 10, hariDalamBulan(y, m));
    return isoDate(y, m, d);
  }
  if (jenis === 'quarter_end' || jenis === 'semiannual_end') {
    const mEnd = jenis === 'quarter_end' ? periode * 3 : periode * 6;
    const dEnd = hariDalamBulan(tahun, mEnd);
    const r = tambahHari(tahun, mEnd, dEnd, Number.isFinite(n) ? n : 10);
    return isoDate(r.y, r.m, r.d);
  }
  if (jenis === 'next_january') return isoDate(tahun + 1, 1, 31);
  return isoDate(tahun, 12, 31);
};

// Jumlah periode = target_per_tahun. Jadi target 12 berarti 12 dokumen, satu
// per bulan; target 1 berarti satu dokumen untuk setahun. Frekuensi hanya
// menentukan penamaan periode dan aturan deadline, bukan jumlah periodenya.
const rencanaPeriode = (frekuensi, tahun, target) => {
  const f = String(frekuensi || 'Tahunan');
  const n = Math.max(1, Math.min(24, parseInt(target, 10) || 1));

  if (f === 'Bulanan' && n <= 12) {
    return Array.from({ length: n }, (_, i) => ({
      periode: i + 1, label: `${NAMA_BULAN[i + 1]} ${tahun}`,
    }));
  }
  if (f === 'Triwulan' && n <= 4) {
    return Array.from({ length: n }, (_, q) => ({
      periode: q + 1, label: `Triwulan ${NAMA_TRIWULAN[q + 1]} ${tahun}`,
    }));
  }
  if (f === 'Semesteran' && n <= 2) {
    return Array.from({ length: n }, (_, s) => ({
      periode: s + 1, label: `Semester ${s === 0 ? 'I' : 'II'} ${tahun}`,
    }));
  }
  if (f === 'Tahunan' && n === 1) {
    return [{ periode: 1, label: `Tahun ${tahun}` }];
  }
  return Array.from({ length: n }, (_, i) => ({
    periode: i + 1, label: `Periode ${i + 1} ${tahun}`,
  }));
};

// bulan_wajib: '*' = semua, atau daftar '1,3,5,7,9,11'
const hitungBulanWajib = (spec, jumlahPeriode) => {
  const s = String(spec ?? '*').trim();
  if (s === '' || s === '*') {
    return new Set(Array.from({ length: jumlahPeriode }, (_, i) => i + 1));
  }
  return new Set(
    s.split(',').map(x => parseInt(x.trim(), 10))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= jumlahPeriode)
  );
};

// ── Daftar output ─────────────────────────────────────────────────────────
app.get('/api/kertas-kerja', async (req, res) => {
  const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
  try {
    const params = [tahun];
    let sql = `
      SELECT k.*, s.kode AS sub_kode, s.nama AS sub_nama
      FROM kertas_kerja k
      JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id
      WHERE s.tahun = $1 AND k.is_active`;
    if (req.query.subkegiatan_id) {
      params.push(req.query.subkegiatan_id);
      sql += ` AND k.subkegiatan_id = $${params.length}`;
    }
    sql += ' ORDER BY s.urutan, s.kode, k.nama';
    res.json(await queryDB(sql, params));
  } catch (err) {
    console.error('Get kertas kerja error:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar kertas kerja' });
  }
});

// Satu output: insert baris kertas_kerja, lalu bila diminta buat periodenya.
// Dipakai oleh POST /api/kertas-kerja (satu per satu) dan POST /api/kertas-kerja/bulk
// (beberapa sekaligus) supaya keduanya tidak bisa berbeda perilaku.
async function buatOutputDanPeriode(b, tahun, buatPeriode) {
  // Output dan periodenya dibuat dalam satu transaksi. Tanpa itu, kalau
  // INSERT periode gagal di tengah jalan, output-nya sudah terlanjur ada tapi
  // periodenya belum lengkap — dan karena nama output jadi bentrok saat user
  // mencoba ulang, halaman selesai memberi tahu gagal padahal masalahnya bukan
  // di isian user. Transaksi membuat kegagalan berikutnya tidak meninggalkan sisa.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(`
      INSERT INTO kertas_kerja
        (subkegiatan_id, nama, indikator, frekuensi, target_per_tahun,
         bulan_wajib, deadline_rule, pic_id, keterangan, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [b.subkegiatan_id, String(b.nama).trim(), b.indikator || null, b.frekuensi,
       parseInt(b.target_per_tahun, 10) || 1, b.bulan_wajib || '*',
       b.deadline_rule || 'year_end', b.pic_id || null, b.keterangan || null,
       b.created_by || null]
    );
    const kk = ins.rows[0];

    let dibuat = 0;
    const periodeBaru = [];
    if (buatPeriode) {
      const rencana = rencanaPeriode(kk.frekuensi, tahun, kk.target_per_tahun);
      const wajibSet = hitungBulanWajib(kk.bulan_wajib, rencana.length);
      for (const p of rencana) {
        const r = await client.query(`
          INSERT INTO kertas_kerja_periode
            (kertas_kerja_id, tahun, periode, periode_label, deadline, is_wajib)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (kertas_kerja_id, tahun, periode) DO NOTHING
          RETURNING id, deadline`,
          [kk.id, tahun, p.periode, p.label,
           hitungDeadline(kk.deadline_rule, tahun, p.periode), wajibSet.has(p.periode)]
        );
        if (r.rows.length) {
          dibuat += 1;
          periodeBaru.push({ id: r.rows[0].id, periode: p.periode, label: p.label, deadline: r.rows[0].deadline });
        }
      }
    }

    await client.query('COMMIT');
    return { row: kk, dibuat, periodeBaru };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Tambah banyak output sekaligus, satu sub kegiatan, satu tahun.
//
// Setiap output boleh punya frekuensi, target, dan aturan deadline sendiri,
// jadi satu periode bisa punya beberapa laporan dengan deadline berbeda.
// Per-output dilindungi try/catch: satu nama yang bentrok tidak boleh
// menggagalkan output lain yang sudah berhasil.
app.post('/api/kertas-kerja/bulk', async (req, res) => {
  const b = req.body;
  const tahun = parseInt(b.tahun, 10);
  if (!b.subkegiatan_id) return res.status(400).json({ error: 'Sub kegiatan wajib dipilih' });
  if (!tahun) return res.status(400).json({ error: 'Tahun wajib diisi' });
  if (!Array.isArray(b.outputs) || !b.outputs.length)
    return res.status(400).json({ error: 'Tidak ada output untuk ditambahkan' });
  if (b.outputs.length > 50)
    return res.status(400).json({ error: 'Maksimal 50 output sekaligus' });

  const buatPeriode = b.buat_periode !== false;
  const hasil = [];

  for (const [i, o] of b.outputs.entries()) {
    const nama = String(o?.nama || '').trim();
    if (!nama) { hasil.push({ nama: '', ok: false, error: 'Nama output kosong' }); continue; }
    try {
      const r = await buatOutputDanPeriode({
        ...o, nama, subkegiatan_id: b.subkegiatan_id,
        created_by: o.created_by || b.created_by || null,
      }, tahun, buatPeriode);
      hasil.push({ nama, ok: true, id: r.row.id, dibuat: r.dibuat, periodeBaru: r.periodeBaru });
    } catch (err) {
      if (err.code === '23505') {
        hasil.push({ nama, ok: false, error: `Output "${nama}" sudah ada di sub kegiatan ini` });
      } else {
        console.error(`Bulk kertas kerja error (baris ${i + 1}):`, err);
        hasil.push({ nama, ok: false, error: 'Gagal menyimpan output' });
      }
    }
  }

  const sukses = hasil.filter(h => h.ok).length;
  res.json({
    message: `${sukses} dari ${hasil.length} output ditambahkan`,
    sukses, gagal: hasil.length - sukses, hasil, buatPeriode,
  });
});

app.post('/api/kertas-kerja', async (req, res) => {
  const b = req.body;
  const tahun = parseInt(b.tahun, 10);
  if (!b.subkegiatan_id) return res.status(400).json({ error: 'Sub kegiatan wajib dipilih' });
  if (!b.nama || !String(b.nama).trim()) return res.status(400).json({ error: 'Nama output wajib diisi' });
  if (!b.frekuensi) return res.status(400).json({ error: 'Frekuensi wajib dipilih' });
  if (!tahun) return res.status(400).json({ error: 'Tahun wajib diisi' });
  try {
    // Periode sengaja tidak dibuat di sini. Klien yang butuh periode memanggil
    // /generate supaya generate satu kali untuk semua output di form banyak.
    const r = await buatOutputDanPeriode(b, tahun, false);
    res.json({ message: 'Output berhasil ditambahkan', row: r.row });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Output "${b.nama}" sudah ada di sub kegiatan ini` });
    }
    console.error('Create kertas kerja error:', err);
    res.status(500).json({ error: 'Gagal menambahkan output' });
  }
});

app.put('/api/kertas-kerja/:id', async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  if (!b.nama || !String(b.nama).trim()) return res.status(400).json({ error: 'Nama output wajib diisi' });
  try {
    const rows = await queryDB(`
      UPDATE kertas_kerja SET
        nama = $1, indikator = $2, frekuensi = $3, target_per_tahun = $4,
        bulan_wajib = $5, deadline_rule = $6, pic_id = $7, keterangan = $8,
        is_active = $9, updated_at = NOW()
      WHERE id = $10 RETURNING *`,
      [String(b.nama).trim(), b.indikator || null, b.frekuensi || 'Tahunan',
       parseInt(b.target_per_tahun, 10) || 1, b.bulan_wajib || '*',
       b.deadline_rule || 'year_end', b.pic_id || null, b.keterangan || null,
       b.is_active !== false, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Output tidak ditemukan' });
    res.json({ message: 'Output berhasil diperbarui', row: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Output "${b.nama}" sudah ada di sub kegiatan ini` });
    }
    console.error('Update kertas kerja error:', err);
    res.status(500).json({ error: 'Gagal memperbarui output' });
  }
});

app.delete('/api/kertas-kerja/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await queryDB('DELETE FROM kertas_kerja WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Output tidak ditemukan' });
    res.json({ message: 'Output berhasil dihapus' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Tidak bisa dihapus: masih ada periode terkait' });
    }
    console.error('Delete kertas kerja error:', err);
    res.status(500).json({ error: 'Gagal menghapus output' });
  }
});

// ── Generate periode untuk satu tahun (idempoten) ─────────────────────────
app.post('/api/kertas-kerja/:id/generate', async (req, res) => {
  const { id } = req.params;
  const tahun = parseInt(req.body.tahun, 10);
  if (!tahun) return res.status(400).json({ error: 'Tahun wajib diisi' });
  try {
    const kk = (await queryDB('SELECT * FROM kertas_kerja WHERE id = $1', [id]))[0];
    if (!kk) return res.status(404).json({ error: 'Output tidak ditemukan' });

    const rencana = rencanaPeriode(kk.frekuensi, tahun, kk.target_per_tahun);
    const wajibSet = hitungBulanWajib(kk.bulan_wajib, rencana.length);
    let dibuat = 0;
    // Id periode yang benar-benar dibuat dikembalikan, bukan cuma jumlahnya.
    // Klien memakai ini untuk langsung mengunggah ke periode yang baru dibuat:
    // tanpa id-nya, tombol "Unggah" di output yang tadinya belum punya periode
    // tidak punya tujuan dan tidak bisa melakukan apa-apa.
    const baru = [];
    for (const p of rencana) {
      const rows = await queryDB(`
        INSERT INTO kertas_kerja_periode
          (kertas_kerja_id, tahun, periode, periode_label, deadline, is_wajib)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (kertas_kerja_id, tahun, periode) DO NOTHING
        RETURNING id`,
        [id, tahun, p.periode, p.label,
         hitungDeadline(kk.deadline_rule, tahun, p.periode), wajibSet.has(p.periode)]
      );
      if (rows.length) {
        dibuat += 1;
        baru.push({ id: rows[0].id, periode: p.periode, label: p.label, deadline: rows[0].deadline });
      }
    }
    res.json({
      message: `${dibuat} periode baru dibuat untuk ${tahun}`,
      dibuat, rencana: rencana.length, periodeBaru: baru,
    });
  } catch (err) {
    console.error('Generate periode error:', err);
    res.status(500).json({ error: 'Gagal membuat periode' });
  }
});

// ── Re-sync bulan_wajib ke periode yang belum terisi ──────────────────────
app.post('/api/kertas-kerja/:id/sinkron-wajib', async (req, res) => {
  const { id } = req.params;
  const tahun = parseInt(req.body.tahun, 10);
  if (!tahun) return res.status(400).json({ error: 'Tahun wajib diisi' });
  try {
    const kk = (await queryDB('SELECT * FROM kertas_kerja WHERE id = $1', [id]))[0];
    if (!kk) return res.status(404).json({ error: 'Output tidak ditemukan' });
    const jumlah = rencanaPeriode(kk.frekuensi, tahun, kk.target_per_tahun).length;
    const wajibSet = hitungBulanWajib(kk.bulan_wajib, jumlah);
    // Hanya periode yang belum terisi dokumen — progres yang sudah ada tak ditimpa.
    const rows = await queryDB(
      'SELECT periode FROM kertas_kerja_periode WHERE kertas_kerja_id = $1 AND tahun = $2 AND doc_id IS NULL',
      [id, tahun]
    );
    let diubah = 0;
    for (const r of rows) {
      const mau = wajibSet.has(r.periode);
      await queryDB(
        `UPDATE kertas_kerja_periode SET is_wajib = $1
         WHERE kertas_kerja_id = $2 AND tahun = $3 AND periode = $4`,
        [mau, id, tahun, r.periode]
      );
      if (mau) diubah += 1;
    }
    res.json({ message: `${diubah} periode ditandai wajib`, diubah });
  } catch (err) {
    console.error('Sinkron wajib error:', err);
    res.status(500).json({ error: 'Gagal menyinkronkan periode wajib' });
  }
});

// ── Isi periode dengan dokumen (upload) ──────────────────────────────────
app.patch('/api/kertas-kerja/periode/:id', async (req, res) => {
  const { id } = req.params;
  // Staf boleh mengisi dokumen; hanya admin yang boleh menetapkan deadline.
  const { sets, params, galat, status } = susunPatchPeriode(req.body, {
    admin: req.pengguna?.role === R_ADMIN,
    pelaku: req.pengguna?.nip || null,
  });
  if (galat) return res.status(status).json({ error: galat });

  params.push(parseInt(id, 10));
  try {
    const rows = await queryDB(`
      UPDATE kertas_kerja_periode
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, kertas_kerja_id, tahun, periode, periode_label,
                TO_CHAR(deadline, 'YYYY-MM-DD') AS deadline, is_wajib, doc_id, catatan,
                uploaded_by, uploaded_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Periode tidak ditemukan' });
    res.json({ message: 'Periode berhasil diperbarui', row: rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Dokumen tidak ditemukan' });
    console.error('Patch periode error:', err);
    res.status(500).json({ error: 'Gagal memperbarui periode' });
  }
});

// ── Hubungkan dokumen arsip yang sudah ada ke satu periode ───────────────
//
// Jalur ini yang dipakai ketika bukti dukung sudah terunggah lebih dulu lalu
// diunggah ke periode yang salah atau tautan-create-nya gagal. Tanpa endpoint
// ini, satu-satunya cara menutup periode kosong adalah mengunggah ulang, dan
// dokumen lama tetap menggantung di arsip tanpa pemilik.
//
// Berbeda dengan PATCH di atas, di sini dokumen yang ditunjuk harus benar-benar
// ada dan belum dipakai periode lain. Satu dokumen jadi bukti dua periode
// membuat progres output BERBEDA satu dokumen yang sama, jadi itu ditolak.
app.post('/api/kertas-kerja/periode/:id/tautan', async (req, res) => {
  const idPeriode = idDokumenValid(req.params.id);
  if (idPeriode == null) return res.status(400).json({ error: 'Id periode tidak valid' });
  const idDoc = idDokumenValid(req.body?.doc_id);
  if (idDoc == null) return res.status(400).json({ error: 'doc_id tidak valid' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const periode = (await client.query(
      `SELECT id, kertas_kerja_id, tahun, periode, periode_label, doc_id
         FROM kertas_kerja_periode WHERE id = $1 FOR UPDATE`, [idPeriode]
    )).rows[0];
    if (!periode) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Periode tidak ditemukan' });
    }
    if (periode.doc_id === idDoc) {
      await client.query('ROLLBACK');
      return res.json({ message: 'Dokumen sudah terhubung', row: periode, sudah: true });
    }

    const dipakai = (await client.query(
      'SELECT id FROM kertas_kerja_periode WHERE doc_id = $1', [idDoc]
    )).rows[0];
    if (dipakai) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Dokumen ini sudah dipakai periode lain' });
    }

    const doc = (await client.query(
      'SELECT id, judul FROM bapperida_dokumen WHERE id = $1', [idDoc]
    )).rows[0];
    if (!doc) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dokumen tidak ditemukan di arsip' });
    }

    const row = (await client.query(
      `UPDATE kertas_kerja_periode
          SET doc_id = $1, uploaded_by = $2, uploaded_at = NOW()
        WHERE id = $3
        RETURNING id, kertas_kerja_id, tahun, periode, periode_label, doc_id`,
      [idDoc, req.pengguna?.nip || null, idPeriode]
    )).rows[0];

    await client.query('COMMIT');
    res.json({ message: 'Dokumen terhubung ke periode', row, doc });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (err.code === '23503') return res.status(409).json({ error: 'Dokumen tidak ditemukan di arsip' });
    console.error('Tautan periode error:', err);
    res.status(500).json({ error: 'Gagal menghubungkan dokumen' });
  } finally {
    client.release();
  }
});

// ── Dokumen yang belum terhubung ke periode mana pun ──────────────────────
//
// Hanya dokumen yang judulnya persis "<nama output> — <label periode>" karena
// itulah format yang dipakai dialog unggah Kertas Kerja. Pencocokan dibuat di
// server, bukan lewat ILIKE, supaya tidak pernah daredokan otomatis: user yang
// memilih tetap memutuskan dokumen mana yang benar.
app.get('/api/kertas-kerja/jatim', async (req, res) => {
  const tahun = parseInt(req.query.tahun, 10);
  try {
    const params = [];
    let filter = '';
    if (tahun) { params.push(tahun); filter = ' AND p.tahun = $1'; }
    const rows = await queryDB(
      `SELECT p.id AS periode_id, p.tahun, p.periode, p.periode_label, p.deadline,
              p.is_wajib, k.id AS kertas_kerja_id, k.nama AS output_nama
         FROM kertas_kerja_periode p
         JOIN kertas_kerja k ON k.id = p.kertas_kerja_id
        WHERE p.doc_id IS NULL${filter}
        ORDER BY k.nama, p.periode`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Get periode jatim error:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar periode kosong' });
  }
});

// Kandidat dokumen untuk satu periode: judulnya sama persis dengan format
// unggah Kertas Kerja, atau mengandung nama output sebagai awal judul.
app.get('/api/kertas-kerja/periode/:id/kandidat', async (req, res) => {
  const idPeriode = idDokumenValid(req.params.id);
  if (idPeriode == null) return res.status(400).json({ error: 'Id periode tidak valid' });
  try {
    const rows = await queryDB(
      `SELECT d.id, d.judul, d.status,
              TO_CHAR(d.tanggal, 'YYYY-MM-DD') AS tanggal,
              COALESCE(d.uploader_id, '') AS pengunggah,
              (d.judul = $1) AS persis,
              (SELECT count(*)::int FROM kertas_kerja_periode x WHERE x.doc_id = d.id) AS terpakai
         FROM bapperida_dokumen d
        WHERE d.judul = $1 OR d.judul LIKE $2
        ORDER BY d.judul = $1 DESC, d.id DESC
        LIMIT 20`,
      [req.query.judul || '', (req.query.judul || '') + '%']
    );
    res.json(rows);
  } catch (err) {
    console.error('Get kandidat dokumen error:', err);
    res.status(500).json({ error: 'Gagal mencari dokumen' });
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

// ── Bank Data: Hierarki v4 ────────────────────────────────────────────────
// Bidang → OPD → IKU (nilai: target&capaian/tahun + triwulan, sumber/aspek)
//        → OPD → IKK (nilai: target&capaian/tahun + triwulan, sumber/aspek)
//        → OPD → Data Sektoral (setara IKU; indikator: data/tahun + triwulan)
// KEY = level: 'iku' | 'ikk' | 'sektoral'
const BIDANG_BANKDATA = [3, 4, 5]; // hanya bidang bikor (Perekonomian&SDA, Pemerintahan&Pembangunan Manusia, Infrastruktur&Kewilayahan)
const BD_CONF = {
  iku: {
    // IKU kini mengisi nilai langsung: target/capaian per tahun + triwulan
    nilTable: 'bank_data_iku_nilai',  twTable: 'bank_data_iku_triwulan',
    idKey: 'iku_id',  valA: 'target',  valB: 'capaian',
    parentTable: 'bank_data_iku'
  },
  ikk: {
    // IKK kini mengisi nilai langsung: target/capaian per tahun + triwulan (sama seperti IKU)
    nilTable: 'bank_data_ikk_nilai',  twTable: 'bank_data_ikk_triwulan',
    idKey: 'ikk_id',  valA: 'target',  valB: 'capaian',
    parentTable: 'bank_data_ikk'
  },
  sektoral: {
    indTable: 'bank_data_sektoral_indikator',  nilTable: 'bank_data_sektoral_nilai',  twTable: 'bank_data_sektoral_triwulan',
    indParentKey: 'sektoral_id', idKey: 'indikator_id', valA: null, valB: null,
    parentTable: 'bank_data_sektoral'
  }
};

app.get('/api/bankdata/tahun', async (_, res) => {
  try {
    const rows = await queryDB('SELECT id, tahun FROM bank_data_tahun ORDER BY tahun');
    res.json(rows);
  } catch (err) {
    console.error('Get tahun error:', err);
    res.status(500).json({ error: 'Gagal mengambil daftar tahun' });
  }
});

app.post('/api/bankdata/tahun', async (req, res) => {
  const { tahun } = req.body;
  if (!tahun) return res.status(400).json({ error: 'Tahun wajib diisi' });
  try {
    await queryDB('INSERT INTO bank_data_tahun (tahun) VALUES ($1) ON CONFLICT (tahun) DO NOTHING', [tahun]);
    res.json({ message: 'Tahun berhasil ditambahkan' });
  } catch (err) {
    console.error('Add tahun error:', err);
    res.status(500).json({ error: 'Gagal menambahkan tahun' });
  }
});

app.delete('/api/bankdata/tahun/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM bank_data_tahun WHERE id = $1', [id]);
    res.json({ message: 'Tahun berhasil dihapus' });
  } catch (err) {
    console.error('Delete tahun error:', err);
    res.status(500).json({ error: 'Gagal menghapus tahun' });
  }
});

app.get('/api/bankdata', async (_, res) => {
  try {
    const [bidangs, opds, ikus, ikks, nilIkuR, twIkuR, nilIkkR, twIkkR, sektorals, indSektR, nilSektR, twSektR] = await Promise.all([
      queryDB(`SELECT id, nama_bidang AS nama FROM bidang_list WHERE instansi_id = 'bapperida' AND id = ANY($1::int[]) ORDER BY id`, [BIDANG_BANKDATA]),
      queryDB(`SELECT id, bidang_id, nama, urutan FROM bank_data_opd ORDER BY bidang_id, urutan, id`),
      queryDB(`SELECT id, opd_id, nama, sumber_data, aspek, satuan, urutan FROM bank_data_iku ORDER BY opd_id, urutan, id`),
      queryDB(`SELECT id, iku_id, nama, sumber_data, aspek, satuan, urutan FROM bank_data_ikk ORDER BY iku_id, urutan, id`),
      queryDB(`SELECT id, iku_id, tahun, target, capaian FROM bank_data_iku_nilai ORDER BY iku_id, tahun`),
      queryDB(`SELECT * FROM bank_data_iku_triwulan ORDER BY iku_id, tahun`),
      queryDB(`SELECT id, ikk_id, tahun, target, capaian FROM bank_data_ikk_nilai ORDER BY ikk_id, tahun`),
      queryDB(`SELECT * FROM bank_data_ikk_triwulan ORDER BY ikk_id, tahun`),
      queryDB(`SELECT id, opd_id, nama, urutan FROM bank_data_sektoral ORDER BY opd_id, urutan, id`),
      queryDB(`SELECT id, sektoral_id, indikator, sumber_data, aspek, satuan, urutan FROM bank_data_sektoral_indikator ORDER BY sektoral_id, urutan, id`),
      queryDB(`SELECT id, indikator_id, tahun, data FROM bank_data_sektoral_nilai ORDER BY indikator_id, tahun`),
      queryDB(`SELECT * FROM bank_data_sektoral_triwulan ORDER BY indikator_id, tahun`)
    ]);

    // Map nilai: { key -> [rows] } dengan kunci kolom target (ikk_id / indikator_id)
    const nilMap = (arr, key = 'indikator_id') => { const m = new Map(); for (const r of arr) { const k = String(r[key]); (m.get(k) || m.set(k, []).get(k)).push(r); } return m; };
    // triwulan → Map<targetId, Map<tahun, {tw1:{a,b},tw2:{a,b},tw3:{a,b},tw4:{a,b}}>>
    const twMap = (rows, conf, key = 'indikator_id') => {
      const m = new Map();
      for (const r of rows) {
        const k = String(r[key]);
        if (!m.has(k)) m.set(k, new Map());
        const obj = {};
        for (let i = 1; i <= 4; i++) {
          const a = conf.valA ? r[`${conf.valA}_tw${i}`] : r[`data_tw${i}`];
          const b = conf.valB ? r[`${conf.valB}_tw${i}`] : null;
          const cell = {};
          if (a !== null && a !== undefined) cell.a = a;
          if (b !== null && b !== undefined) cell.b = b;
          if (Object.keys(cell).length) obj[`tw${i}`] = cell;
        }
        if (Object.keys(obj).length) m.get(k).set(r.tahun, obj);
      }
      return m;
    };
    const indMap = (rows, parentKey, nil, strip, tw) => {
      const m = new Map();
      for (const r of rows) {
        const pd = String(r[parentKey]);
        const nils = nil.get(String(r.id)) || [];
        const twByYear = tw.get(String(r.id));
        const node = { ...r, nilai: nils.map(n => {
          const o = { id: n.id, tahun: n.tahun };
          if (n[strip.a] !== null && n[strip.a] !== undefined) o[strip.a] = n[strip.a];
          if (strip.b && n[strip.b] !== null && n[strip.b] !== undefined) o[strip.b] = n[strip.b];
          const t = twByYear?.get(n.tahun);
          if (t) o.tw = t;
          return o;
        }) };
        delete node[parentKey];
        delete node.urutan;
        delete node.indikator_id;
        (m.get(pd) || m.set(pd, []).get(pd)).push(node);
      }
      return m;
    };

    const nilIkk = nilMap(nilIkkR, 'ikk_id');
    const twIkk = twMap(twIkkR, BD_CONF.ikk, 'ikk_id');
    const ikkNodes = ikks.map(i => {
      const nils = nilIkk.get(String(i.id)) || [];
      const twByYear = twIkk.get(String(i.id));
      const node = {
        id: i.id, nama: i.nama,
        sumber_data: i.sumber_data ?? null,
        aspek: i.aspek ?? null,
        nilai: nils.map(n => {
          const o = { id: n.id, tahun: n.tahun };
          if (n.target !== null && n.target !== undefined) o.target = n.target;
          if (n.capaian !== null && n.capaian !== undefined) o.capaian = n.capaian;
          const t = twByYear?.get(n.tahun);
          if (t) o.tw = t;
          return o;
        })
      };
      return node;
    });
    const ikkMap = new Map(ikkNodes.map(n => [String(n.id), n]));

    const nilSekt = nilMap(nilSektR);
    const twSekt = twMap(twSektR, BD_CONF.sektoral);
    const indSekt = indMap(indSektR, 'sektoral_id', nilSekt, { a: 'data', b: null }, twSekt);

    // IKU juga data langsung: target/capaian + triwulan + sumber_data/aspek
    const nilIku = nilMap(nilIkuR, 'iku_id');
    const twIku = twMap(twIkuR, BD_CONF.iku, 'iku_id');
    const ikuNodes = ikus.map(i => {
      const nils = nilIku.get(String(i.id)) || [];
      const twByYear = twIku.get(String(i.id));
      return {
        id: i.id, nama: i.nama,
        sumber_data: i.sumber_data ?? null,
        aspek: i.aspek ?? null,
        ikks: [],
        nilai: nils.map(n => {
          const o = { id: n.id, tahun: n.tahun };
          if (n.target !== null && n.target !== undefined) o.target = n.target;
          if (n.capaian !== null && n.capaian !== undefined) o.capaian = n.capaian;
          const t = twByYear?.get(n.tahun);
          if (t) o.tw = t;
          return o;
        })
      };
    });
    const ikuMap = new Map(ikuNodes.map(n => [String(n.id), n]));
    for (const i of ikks) { const p = ikuMap.get(String(i.iku_id)); if (p) p.ikks.push(ikkMap.get(String(i.id))); }

    const sektMap = new Map(sektorals.map(s => [String(s.id), { id: s.id, nama: s.nama, indikator: indSekt.get(String(s.id)) || [] }]));
    const opdMap = new Map(opds.map(o => [String(o.id), { id: o.id, nama: o.nama, ikus: [], sektorals: [] }]));
    for (const i of ikus) { const p = opdMap.get(String(i.opd_id)); if (p) p.ikus.push(ikuMap.get(String(i.id))); }
    for (const s of sektorals) { const p = opdMap.get(String(s.opd_id)); if (p) p.sektorals.push(sektMap.get(String(s.id))); }

    const tree = bidangs.map(b => ({ ...b, opds: [] }));
    for (const o of opds) { const b = tree.find(x => String(x.id) === String(o.bidang_id)); if (b) b.opds.push(opdMap.get(String(o.id))); }

    res.json(tree);
  } catch (err) {
    console.error('Get bankdata tree error:', err);
    res.status(500).json({ error: 'Gagal mengambil data bank data' });
  }
});

// ── OPD ─────────────────────────────────────────────────────────────────
app.post('/api/bankdata/opd', async (req, res) => {
  const { bidang_id, nama } = req.body;
  if (!bidang_id || !nama) return res.status(400).json({ error: 'Bidang dan nama wajib diisi' });
  try {
    const max = await queryDB('SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM bank_data_opd WHERE bidang_id = $1', [bidang_id]);
    const result = await queryDB(
      'INSERT INTO bank_data_opd (bidang_id, nama, urutan) VALUES ($1, $2, $3) RETURNING *',
      [bidang_id, nama.trim(), max[0].next]
    );
    res.json({ message: 'OPD berhasil ditambahkan', opd: result[0] });
  } catch (err) {
    console.error('Create OPD error:', err);
    res.status(500).json({ error: 'Gagal menambahkan OPD' });
  }
});

app.put('/api/bankdata/opd/:id', async (req, res) => {
  const { id } = req.params;
  const { nama } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  try {
    await queryDB('UPDATE bank_data_opd SET nama = $1 WHERE id = $2', [nama.trim(), id]);
    res.json({ message: 'OPD berhasil diperbarui' });
  } catch (err) {
    console.error('Update OPD error:', err);
    res.status(500).json({ error: 'Gagal memperbarui OPD' });
  }
});

app.delete('/api/bankdata/opd/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM bank_data_opd WHERE id = $1', [id]);
    res.json({ message: 'OPD berhasil dihapus' });
  } catch (err) {
    console.error('Delete OPD error:', err);
    res.status(500).json({ error: 'Gagal menghapus OPD' });
  }
});

// ── IKU ──────────────────────────────────────────────────────────────────
app.post('/api/bankdata/iku', async (req, res) => {
  const { opd_id, nama, sumber_data, aspek } = req.body;
  if (!opd_id || !nama) return res.status(400).json({ error: 'OPD dan nama wajib diisi' });
  try {
    const max = await queryDB('SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM bank_data_iku WHERE opd_id = $1', [opd_id]);
    const result = await queryDB(
      'INSERT INTO bank_data_iku (opd_id, nama, sumber_data, aspek, satuan, urutan) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [opd_id, nama.trim(), sumber_data ?? null, aspek ?? null, (req.body.satuan ?? null), max[0].next]
    );
    res.json({ message: 'IKU berhasil ditambahkan', iku: result[0] });
  } catch (err) {
    console.error('Create IKU error:', err);
    res.status(500).json({ error: 'Gagal menambahkan IKU' });
  }
});

app.put('/api/bankdata/iku/:id', async (req, res) => {
  const { id } = req.params;
  const { nama, sumber_data, aspek } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  try {
    await queryDB('UPDATE bank_data_iku SET nama = $1, sumber_data = $2, aspek = $3, satuan = $4 WHERE id = $5', [nama.trim(), sumber_data ?? null, aspek ?? null, (req.body.satuan ?? null), id]);
    res.json({ message: 'IKU berhasil diperbarui' });
  } catch (err) {
    console.error('Update IKU error:', err);
    res.status(500).json({ error: 'Gagal memperbarui IKU' });
  }
});

app.delete('/api/bankdata/iku/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM bank_data_iku WHERE id = $1', [id]);
    res.json({ message: 'IKU berhasil dihapus' });
  } catch (err) {
    console.error('Delete IKU error:', err);
    res.status(500).json({ error: 'Gagal menghapus IKU' });
  }
});

// ── IKK ──────────────────────────────────────────────────────────────────
app.post('/api/bankdata/ikk', async (req, res) => {
  const { iku_id, nama, sumber_data, aspek } = req.body;
  if (!iku_id || !nama) return res.status(400).json({ error: 'IKU dan nama wajib diisi' });
  try {
    const max = await queryDB('SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM bank_data_ikk WHERE iku_id = $1', [iku_id]);
    const result = await queryDB(
      'INSERT INTO bank_data_ikk (iku_id, nama, sumber_data, aspek, satuan, urutan) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [iku_id, nama.trim(), sumber_data ?? null, aspek ?? null, (req.body.satuan ?? null), max[0].next]
    );
    res.json({ message: 'IKK berhasil ditambahkan', ikk: result[0] });
  } catch (err) {
    console.error('Create IKK error:', err);
    res.status(500).json({ error: 'Gagal menambahkan IKK' });
  }
});

app.put('/api/bankdata/ikk/:id', async (req, res) => {
  const { id } = req.params;
  const { nama, sumber_data, aspek } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  try {
    await queryDB('UPDATE bank_data_ikk SET nama = $1, sumber_data = $2, aspek = $3, satuan = $4 WHERE id = $5', [nama.trim(), sumber_data ?? null, aspek ?? null, (req.body.satuan ?? null), id]);
    res.json({ message: 'IKK berhasil diperbarui' });
  } catch (err) {
    console.error('Update IKK error:', err);
    res.status(500).json({ error: 'Gagal memperbarui IKK' });
  }
});

app.delete('/api/bankdata/ikk/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM bank_data_ikk WHERE id = $1', [id]);
    res.json({ message: 'IKK berhasil dihapus' });
  } catch (err) {
    console.error('Delete IKK error:', err);
    res.status(500).json({ error: 'Gagal menghapus IKK' });
  }
});

// ── Data Sektoral (setara IKU) ───────────────────────────────────────────
app.post('/api/bankdata/sektoral', async (req, res) => {
  const { opd_id, nama } = req.body;
  if (!opd_id || !nama) return res.status(400).json({ error: 'OPD dan nama wajib diisi' });
  try {
    const max = await queryDB('SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM bank_data_sektoral WHERE opd_id = $1', [opd_id]);
    const result = await queryDB(
      'INSERT INTO bank_data_sektoral (opd_id, nama, urutan) VALUES ($1, $2, $3) RETURNING *',
      [opd_id, nama.trim(), max[0].next]
    );
    res.json({ message: 'Data Sektoral berhasil ditambahkan', sektoral: result[0] });
  } catch (err) {
    console.error('Create sektoral error:', err);
    res.status(500).json({ error: 'Gagal menambahkan data sektoral' });
  }
});

app.put('/api/bankdata/sektoral/:id', async (req, res) => {
  const { id } = req.params;
  const { nama } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  try {
    await queryDB('UPDATE bank_data_sektoral SET nama = $1 WHERE id = $2', [nama.trim(), id]);
    res.json({ message: 'Data Sektoral berhasil diperbarui' });
  } catch (err) {
    console.error('Update sektoral error:', err);
    res.status(500).json({ error: 'Gagal memperbarui data sektoral' });
  }
});

app.delete('/api/bankdata/sektoral/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await queryDB('DELETE FROM bank_data_sektoral WHERE id = $1', [id]);
    res.json({ message: 'Data Sektoral berhasil dihapus' });
  } catch (err) {
    console.error('Delete sektoral error:', err);
    res.status(500).json({ error: 'Gagal menghapus data sektoral' });
  }
});

// Pastikan tiap OPD punya 1 Data Sektoral default (indikator sektoral flat di OPD)
app.post('/api/bankdata/sektoral/ensure', async (req, res) => {
  const { opd_id } = req.body;
  if (!opd_id) return res.status(400).json({ error: 'OPD wajib diisi' });
  try {
    let rows = await queryDB('SELECT * FROM bank_data_sektoral WHERE opd_id = $1 ORDER BY urutan, id LIMIT 1', [opd_id]);
    if (rows.length === 0) {
      const result = await queryDB(
        'INSERT INTO bank_data_sektoral (opd_id, nama, urutan) VALUES ($1, $2, $3) RETURNING *',
        [opd_id, 'Data Sektoral', 1]
      );
      rows = result;
    }
    res.json({ sektoral: rows[0] });
  } catch (err) {
    console.error('Ensure sektoral error:', err);
    res.status(500).json({ error: 'Gagal menyiapkan data sektoral' });
  }
});

// ── Indikator (generic untuk iku / ikk / sektoral) ───────────────────────
app.post('/api/bankdata/indikator/:level', async (req, res) => {
  const { level } = req.params;
  const conf = BD_CONF[level];
  if (!conf || !conf.indTable) return res.status(400).json({ error: 'Level tidak memakai indikator' });
  const { indikator, sumber_data, aspek, satuan } = req.body;
  const parentId = req.body[conf.indParentKey];
  if (!parentId || !indikator) return res.status(400).json({ error: 'Indikator wajib diisi' });
  try {
    const max = await queryDB(`SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM ${conf.indTable} WHERE ${conf.indParentKey} = $1`, [parentId]);
    const result = await queryDB(
      `INSERT INTO ${conf.indTable} (${conf.indParentKey}, indikator, sumber_data, aspek, satuan, urutan)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [parentId, indikator.trim(), sumber_data ?? null, aspek ?? null, satuan ?? null, max[0].next]
    );
    res.json({ message: 'Indikator berhasil ditambahkan', indikator: result[0] });
  } catch (err) {
    console.error('Create indikator error:', err);
    res.status(500).json({ error: 'Gagal menambahkan indikator' });
  }
});

app.put('/api/bankdata/indikator/:level/:id', async (req, res) => {
  const { level, id } = req.params;
  const conf = BD_CONF[level];
  if (!conf || !conf.indTable) return res.status(400).json({ error: 'Level tidak memakai indikator' });
  const { indikator, sumber_data, aspek, satuan } = req.body;
  if (!indikator) return res.status(400).json({ error: 'Indikator wajib diisi' });
  try {
    await queryDB(
      `UPDATE ${conf.indTable} SET indikator = $1, sumber_data = $2, aspek = $3, satuan = $4 WHERE id = $5`,
      [indikator.trim(), sumber_data ?? null, aspek ?? null, satuan ?? null, id]
    );
    res.json({ message: 'Indikator berhasil diperbarui' });
  } catch (err) {
    console.error('Update indikator error:', err);
    res.status(500).json({ error: 'Gagal memperbarui indikator' });
  }
});

app.delete('/api/bankdata/indikator/:level/:id', async (req, res) => {
  const { level, id } = req.params;
  const conf = BD_CONF[level];
  if (!conf || !conf.indTable) return res.status(400).json({ error: 'Level tidak memakai indikator' });
  try {
    await queryDB(`DELETE FROM ${conf.indTable} WHERE id = $1`, [id]);
    res.json({ message: 'Indikator berhasil dihapus' });
  } catch (err) {
    console.error('Delete indikator error:', err);
    res.status(500).json({ error: 'Gagal menghapus indikator' });
  }
});

// ── Nilai per tahun (generic untuk iku / ikk / sektoral) ─────────────────
// iku = target/capaian, ikk = target/capaian, sektoral = data (via indikator)
app.post('/api/bankdata/nilai/:level', async (req, res) => {
  const { level } = req.params;
  const conf = BD_CONF[level];
  if (!conf) return res.status(400).json({ error: 'Level tidak dikenal' });
  const { target_id, tahun, valA, valB } = req.body;
  if (!target_id || !tahun) return res.status(400).json({ error: 'Data dan tahun wajib diisi' });
  try {
    if (level === 'sektoral') {
      await queryDB(
        `INSERT INTO bank_data_sektoral_nilai (indikator_id, tahun, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (indikator_id, tahun) DO UPDATE SET data = $3`,
        [target_id, tahun, valA ?? null]
      );
    } else {
      await queryDB(
        `INSERT INTO ${conf.nilTable} (${conf.idKey}, tahun, ${conf.valA}, ${conf.valB})
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (${conf.idKey}, tahun) DO UPDATE SET ${conf.valA} = $3, ${conf.valB} = $4`,
        [target_id, tahun, valA ?? null, valB ?? null]
      );
    }
    res.json({ message: 'Nilai berhasil disimpan' });
  } catch (err) {
    console.error('Upsert nilai error:', err);
    res.status(500).json({ error: 'Gagal menyimpan nilai' });
  }
});

app.delete('/api/bankdata/nilai/:level/:id', async (req, res) => {
  const { level, id } = req.params;
  const conf = BD_CONF[level];
  if (!conf) return res.status(400).json({ error: 'Level tidak dikenal' });
  try {
    await queryDB(`DELETE FROM ${conf.nilTable} WHERE id = $1`, [id]);
    res.json({ message: 'Nilai berhasil dihapus' });
  } catch (err) {
    console.error('Delete nilai error:', err);
    res.status(500).json({ error: 'Gagal menghapus nilai' });
  }
});

// ── Triwulan per tahun (generic untuk iku / ikk / sektoral) ──────────────
// body: { target_id, tahun, tw: { tw1:{a,b}, tw2:{a,b}, tw3:{a,b}, tw4:{a,b} } }
// sektoral hanya memakai .a (data), iku & ikk = target/capaian
app.post('/api/bankdata/triwulan/:level', async (req, res) => {
  const { level } = req.params;
  const conf = BD_CONF[level];
  if (!conf) return res.status(400).json({ error: 'Level tidak dikenal' });
  const { target_id, tahun, tw } = req.body;
  if (!target_id || !tahun || !tw) return res.status(400).json({ error: 'Data, tahun, dan triwulan wajib diisi' });
  try {
    const idKey = conf.idKey;
    const cols = [];
    const vals = [];
    for (let i = 1; i <= 4; i++) {
      const c = tw[`tw${i}`];
      if (!c) continue;
      const ka = conf.valA || 'data';
      for (const k of [ka, ...(conf.valB ? [conf.valB] : [])]) {
        const v = c[k] !== undefined && c[k] !== null && String(c[k]).trim() !== '' ? String(c[k]).trim() : null;
        cols.push(`${k}_tw${i}`);
        vals.push(v);
      }
    }
    if (cols.length === 0) return res.status(400).json({ error: 'Tidak ada nilai triwulan' });
    const setCols = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
    const insCols = cols.join(', ');
    const insVals = cols.map((_, i) => `$${i + 3}`).join(', ');
    await queryDB(
      `INSERT INTO ${conf.twTable} (${idKey}, tahun, ${insCols})
       VALUES ($1, $2, ${insVals})
       ON CONFLICT (${idKey}, tahun) DO UPDATE SET ${setCols}`,
      [target_id, tahun, ...vals]
    );
    res.json({ message: 'Triwulan berhasil disimpan' });
  } catch (err) {
    console.error('Upsert triwulan error:', err);
    res.status(500).json({ error: 'Gagal menyimpan triwulan' });
  }
});

app.delete('/api/bankdata/triwulan/:level/:id', async (req, res) => {
  const { level, id } = req.params;
  const conf = BD_CONF[level];
  if (!conf) return res.status(400).json({ error: 'Level tidak dikenal' });
  try {
    await queryDB(`DELETE FROM ${conf.twTable} WHERE id = $1`, [id]);
    res.json({ message: 'Triwulan berhasil dihapus' });
  } catch (err) {
    console.error('Delete triwulan error:', err);
    res.status(500).json({ error: 'Gagal menghapus triwulan' });
  }
});

// ── Standar Harga (SSH/SBU): daftar + ganti data per tahun+jenis ──────────
// Blok terpisah dari PKS: membaca daftar cukup login, mengganti data admin
// (lihat kebijakan.js). q/rekening difilter di JS — kontraknya "q falsy =
// tanpa pencarian", jadi tidak ada LIKE di SQL — dan LIMIT 500 diterapkan
// setelah filter supaya hasil pencarian tidak kepotong di tengah.
app.get('/api/standar-harga', async (req, res) => {
  const { tahun, jenis, q, rekening } = req.query;
  try {
    const rows = await queryDB(
      `SELECT * FROM standar_harga WHERE tahun = $1 AND jenis = $2
       ORDER BY uraian_barang`,
      [tahun, jenis]
    );
    res.json(filterDaftar(rows, { q, rekening }).slice(0, 500));
  } catch (err) {
    console.error('Get standar-harga error:', err);
    res.status(500).json({ error: 'Gagal mengambil standar harga' });
  }
});

app.post('/api/standar-harga/upload', async (req, res) => {
  const { tahun, jenis, items } = req.body;
  const v = validasiUpload(tahun, jenis, items);
  if (!v.ok) return res.status(400).json({ error: v.error });

  // Replace per tahun+jenis. Transaksi seperti pola buatOutputDanPeriode:
  // tanpa itu kegagalan di tengah batch meninggalkan data setelah DELETE
  // sudah terlanjur ter-commit — separuh data dan tidak bisa diulang sendiri.
  const KOLOM = [
    'tahun', 'jenis', 'kode_kelompok', 'uraian_kelompok', 'id_standar_harga',
    'kode_barang', 'uraian_barang', 'spesifikasi', 'satuan', 'harga_satuan',
    'kode_rekening',
  ];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM standar_harga WHERE tahun = $1 AND jenis = $2',
      [tahun, jenis]
    );
    let n = 0;
    for (let i = 0; i < v.items.length; i += 200) {
      const chunk = v.items.slice(i, i + 200);
      const ph = [], vals = [];
      chunk.forEach((it, j) => {
        const mulai = j * KOLOM.length;
        ph.push(`(${KOLOM.map((_, k) => `$${mulai + k + 1}`).join(',')})`);
        // tahun/jenis dari body (sudah divalidasi), bukan dari baris.
        vals.push(tahun, jenis, ...KOLOM.slice(2).map((c) => it[c] ?? null));
      });
      await client.query(
        `INSERT INTO standar_harga (${KOLOM.join(', ')}) VALUES ${ph.join(',')}`,
        vals
      );
      n += chunk.length;
    }
    await client.query('COMMIT');
    res.json({ ok: true, n });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Upload standar-harga error:', err);
    res.status(500).json({ error: 'Gagal mengunggah standar harga' });
  } finally {
    client.release();
  }
});

// ── Draft Rincian: rencana belanja per sub kegiatan ──────────────────────
// Semua staf boleh susun rencana (kebijakan LOGIN — keputusan user
// 2026-10-06). idAman: param transaksional dipaksa integer > 0 supaya tidak
// pernah masuk sebagai string ke query.
const idAman = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ── Kunci alur validasi (Pola SIPD-RI) ───────────────────────────────────
// Selama sub kegiatan "menunggu" (direview Admin) atau "disetujui", rencana
// belanja dan pagu/rekening dikunci: datanya yang sedang divalidasi, jadi
// mengubahnya di tengah jalan membuat statusnya bohong. Admin membuka kunci
// lewat "Kembalikan ke draft" (POST /api/screening/validasi status=draft).
// Realisasi TIDAK ikut dikunci — realisasi adalah angka aktual yang terus
// berjalan sepanjang tahun, bukan bagian rencana yang divalidasi.
const SUB_TERKUNCI = ['menunggu', 'disetujui'];
const pesanTerkunci = (st) =>
  `Sub kegiatan ${st === 'disetujui' ? 'sudah disetujui' : 'sedang menunggu validasi'} — kembalikan ke Draft dulu untuk mengubahnya.`;

// Status validasi sebuah sub kegiatan; null = tidak ada (biarkan route yang
// menentukan 404/FK). Dipakai route draft_rincian dan PUT pks.
const statusSub = async (subkegiatanId) => {
  const r = await queryDB('SELECT status_validasi FROM pks_subkegiatan WHERE id = $1', [subkegiatanId]);
  return r.length ? (r[0].status_validasi || 'draft') : null;
};

// Kunci berdasarkan baris rincian (untuk PUT/DELETE /api/draft-rincian/:id).
// null = lolos (termasuk baris tidak ada — route asli yang mengeluarkan 404).
const statusSubBaris = async (barisId) => {
  const r = await queryDB(
    `SELECT s.status_validasi FROM draft_rincian d
       JOIN pks_subkegiatan s ON s.id = d.subkegiatan_id
      WHERE d.id = $1`, [barisId]);
  return r.length ? (r[0].status_validasi || 'draft') : null;
};

// GET → {items, total} — total = Σ jumlahItem dihitung di server supaya
// ringkasan vs pagu memakai angka yang sama dengan daftar baris.
app.get('/api/draft-rincian', async (req, res) => {
  const sid = idAman(req.query.subkegiatan_id);
  if (!sid) return res.status(404).json({ error: 'subkegiatan_id wajib' });
  try {
    const rows = await queryDB(
      'SELECT * FROM draft_rincian WHERE subkegiatan_id = $1 ORDER BY urutan, id',
      [sid]
    );
    const total = rows.reduce((s, r) => s + jumlahItem(r.volume, r.harga_satuan), 0);
    res.json({ items: rows, total });
  } catch (err) {
    console.error('Get draft-rincian error:', err);
    res.status(500).json({ error: 'Gagal mengambil draft rincian' });
  }
});

// POST → validasiItem; urutan = (max urutan)+1; created_by dari session.
app.post('/api/draft-rincian', async (req, res) => {
  const sid = idAman(req.body.subkegiatan_id);
  if (!sid) return res.status(400).json({ error: 'subkegiatan_id wajib' });
  const v = validasiItem(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  try {
    const st = await statusSub(sid);
    if (st && SUB_TERKUNCI.includes(st)) {
      return res.status(409).json({ error: pesanTerkunci(st) });
    }
    const u = await queryDB(
      'SELECT COALESCE(MAX(urutan), -1) + 1 AS urutan FROM draft_rincian WHERE subkegiatan_id = $1',
      [sid]
    );
    const r = await queryDB(
      `INSERT INTO draft_rincian
        (subkegiatan_id, urutan, uraian, spesifikasi, satuan, volume, harga_satuan,
         kode_rekening, standar_harga_id, harga_standar, catatan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [sid, u[0].urutan, v.item.uraian, v.item.spesifikasi, v.item.satuan,
       v.item.volume, v.item.harga_satuan, v.item.kode_rekening,
       v.item.standar_harga_id, v.item.harga_standar, v.item.catatan,
       req.pengguna?.id ?? null]
    );
    res.json(r[0]);
  } catch (err) {
    console.error('Post draft-rincian error:', err);
    res.status(500).json({ error: 'Gagal menambah baris rencana' });
  }
});

// PUT → validasiItem (subkegiatan_id di luar cakupan — baris sudah ada, id
// yang menentukan). rowCount 0 = baris tidak ada → 404.
app.put('/api/draft-rincian/:id', async (req, res) => {
  const id = idAman(req.params.id);
  if (!id) return res.status(404).json({ error: 'Baris tidak ditemukan' });
  const v = validasiItem(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  try {
    const st = await statusSubBaris(id);
    if (st && SUB_TERKUNCI.includes(st)) {
      return res.status(409).json({ error: pesanTerkunci(st) });
    }
    const r = await queryDB(
      `UPDATE draft_rincian SET
         uraian=$1, spesifikasi=$2, satuan=$3, volume=$4, harga_satuan=$5,
         kode_rekening=$6, standar_harga_id=$7, harga_standar=$8, catatan=$9,
         updated_at=now()
       WHERE id=$10 RETURNING *`,
      [v.item.uraian, v.item.spesifikasi, v.item.satuan, v.item.volume,
       v.item.harga_satuan, v.item.kode_rekening, v.item.standar_harga_id,
       v.item.harga_standar, v.item.catatan, id]
    );
    if (!r.length) return res.status(404).json({ error: 'Baris tidak ditemukan' });
    res.json(r[0]);
  } catch (err) {
    console.error('Put draft-rincian error:', err);
    res.status(500).json({ error: 'Gagal memperbarui baris rencana' });
  }
});

// DELETE → RETURNING id; 0 baris = sudah tidak ada → 404.
app.delete('/api/draft-rincian/:id', async (req, res) => {
  const id = idAman(req.params.id);
  if (!id) return res.status(404).json({ error: 'Baris tidak ditemukan' });
  try {
    const st = await statusSubBaris(id);
    if (st && SUB_TERKUNCI.includes(st)) {
      return res.status(409).json({ error: pesanTerkunci(st) });
    }
    const r = await queryDB('DELETE FROM draft_rincian WHERE id = $1 RETURNING id', [id]);
    if (!r.length) return res.status(404).json({ error: 'Baris tidak ditemukan' });
    res.json({ ok: true, id: r[0].id });
  } catch (err) {
    console.error('Delete draft-rincian error:', err);
    res.status(500).json({ error: 'Gagal menghapus baris rencana' });
  }
});

// ── Screening RKA: perubahan anggaran (inisiasi Admin per tahun) ──────────
// Admin menginisiasi perubahan pada tahun yang ditentukan. Saat inisiasi,
// snapshot pagu + total rencana (Σ draft_rincian) tiap sub kegiatan tahun itu
// disimpan sebagai "sebelum perubahan"; nilai live berikutnya = "sesudah
// perubahan". Realisasi disimpan terpisah: pks_subkegiatan.realisasi lewat
// PUT /api/pks/subkegiatan/:id.
//
// POST diatur ADMIN di kebijakan.js; GET cukup LOGIN (semua staf boleh lihat).
app.post('/api/screening/perubahan', async (req, res) => {
  const tahun = Number(req.body.tahun);
  if (!Number.isInteger(tahun) || tahun < 1970) {
    return res.status(400).json({ error: 'Tahun wajib diisi' });
  }
  const catatan = (req.body.catatan || '').toString().trim().slice(0, 500) || null;
  const oleh = req.pengguna?.name || req.pengguna?.nip || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query(
      `INSERT INTO screening_perubahan (tahun, catatan, created_by)
       VALUES ($1, $2, $3) RETURNING id`,
      [tahun, catatan, oleh]
    );
    // Snapshot sekali jalan per inisiasi. ROUND() di Postgres (half-away-
    // from-zero) identik dengan Math.round klien untuk bilangan ≥ 0 —
    // volume & harga selalu non-negatif.
    const r = await client.query(
      `INSERT INTO screening_perubahan_item
         (perubahan_id, subkegiatan_id, sebelum_pagu, sebelum_rencana)
       SELECT $1, s.id, s.pagu, COALESCE((
         SELECT SUM(ROUND(dr.volume * dr.harga_satuan))
         FROM draft_rincian dr WHERE dr.subkegiatan_id = s.id), 0)
       FROM pks_subkegiatan s
       WHERE s.tahun = $2 AND s.is_active
       RETURNING id`,
      [p.rows[0].id, tahun]
    );
    await client.query('COMMIT');
    res.json({ ok: true, id: p.rows[0].id, n: r.rows.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Post screening perubahan error:', err);
    res.status(500).json({ error: 'Gagal menginisiasi perubahan' });
  } finally {
    client.release();
  }
});

// GET → {riwayat, item}. item = snapshot inisiasi TERAKHIR per sub kegiatan;
// key react-query sama di semua RingkasanPagu → dedup, satu fetch.
app.get('/api/screening/perubahan', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!Number.isInteger(tahun)) return res.status(400).json({ error: 'tahun wajib' });
  try {
    const riwayat = await queryDB(
      `SELECT id, catatan, created_by AS oleh, created_at
         FROM screening_perubahan WHERE tahun = $1
        ORDER BY created_at DESC, id DESC LIMIT 50`,
      [tahun]
    );
    const item = await queryDB(
      `SELECT i.subkegiatan_id, i.sebelum_pagu, i.sebelum_rencana
         FROM screening_perubahan_item i
        WHERE i.perubahan_id = (
          SELECT id FROM screening_perubahan
           WHERE tahun = $1 ORDER BY created_at DESC, id DESC LIMIT 1)`,
      [tahun]
    );
    res.json({ riwayat, item });
  } catch (err) {
    console.error('Get screening perubahan error:', err);
    res.status(500).json({ error: 'Gagal mengambil riwayat perubahan' });
  }
});

// ── Screening RKA: alur validasi sub kegiatan (Pola SIPD-RI) ─────────────
// Draft → Menunggu → Disetujui/Ditolak, dengan pelaku & waktu transisi.
// Ajukan (LOGIN): staf mengirim sub kegiatan untuk direview — dari Draft /
// Ditolak saja, catatan lama dibersihkan.
// Validasi (ADMIN): Disetujui (server memaksa pagu terisi >0 dan total rencana
// ≤ pagu — cekSetujui), Ditolak (catatan wajib), atau kembalikan ke Draft
// (buka kunci). Helper murni di screening.js diuji terpisah.
app.post('/api/screening/ajukan', async (req, res) => {
  const sid = idAman(req.body.subkegiatan_id);
  if (!sid) return res.status(400).json({ error: 'subkegiatan_id wajib' });
  try {
    const s = await queryDB(
      'SELECT id, status_validasi FROM pks_subkegiatan WHERE id = $1', [sid]);
    if (!s.length) return res.status(404).json({ error: 'Sub kegiatan tidak ditemukan' });
    const t = ajukanDari(s[0].status_validasi);
    if (!t.ok) return res.status(t.http).json({ error: t.error });
    const oleh = req.pengguna?.name || req.pengguna?.nip || null;
    const rows = await queryDB(
      `UPDATE pks_subkegiatan
          SET status_validasi = 'menunggu', catatan_validasi = NULL,
              status_oleh = $2, status_at = now(), updated_at = now()
        WHERE id = $1 RETURNING *`,
      [sid, oleh]);
    res.json({ message: 'Diajukan untuk validasi Admin', row: rows[0] });
  } catch (err) {
    console.error('Post screening ajukan error:', err);
    res.status(500).json({ error: 'Gagal mengajukan sub kegiatan' });
  }
});

app.post('/api/screening/validasi', async (req, res) => {
  const sid = idAman(req.body.subkegiatan_id);
  if (!sid) return res.status(400).json({ error: 'subkegiatan_id wajib' });
  const ke = String(req.body.status ?? '').trim();
  const catatan = String(req.body.catatan ?? '').trim().slice(0, 500) || null;
  try {
    const s = await queryDB(
      'SELECT id, status_validasi, pagu FROM pks_subkegiatan WHERE id = $1', [sid]);
    if (!s.length) return res.status(404).json({ error: 'Sub kegiatan tidak ditemukan' });
    const t = validasiStatus(s[0].status_validasi, ke, catatan);
    if (!t.ok) return res.status(t.http).json({ error: t.error });
    if (ke === 'disetujui') {
      // Total rencana dihitung ulang di server — jangan percaya angka klien
      // untuk keputusan persetujuan. ROUND() identik dengan jumlahItem klien.
      const r = await queryDB(
        `SELECT COALESCE(SUM(ROUND(volume * harga_satuan)), 0) AS total
           FROM draft_rincian WHERE subkegiatan_id = $1`, [sid]);
      const c = cekSetujui(s[0].pagu, Number(r[0].total));
      if (!c.ok) return res.status(c.http).json({ error: c.error });
    }
    const oleh = req.pengguna?.name || req.pengguna?.nip || null;
    const rows = await queryDB(
      `UPDATE pks_subkegiatan
          SET status_validasi = $2, catatan_validasi = $3,
              status_oleh = $4, status_at = now(), updated_at = now()
        WHERE id = $1 RETURNING *`,
      [sid, t.ke, catatan, oleh]);
    const pesan = t.ke === 'disetujui' ? 'Disetujui'
      : t.ke === 'ditolak' ? 'Ditolak' : 'Dikembalikan ke Draft';
    res.json({ message: pesan, row: rows[0] });
  } catch (err) {
    console.error('Post screening validasi error:', err);
    res.status(500).json({ error: 'Gagal memvalidasi sub kegiatan' });
  }
});

// ── Notifications ────────────────────────────────────────────────────────
//
// user_id dibaca dari session, bukan dari query atau body. Sebelumnya keduanya
// datang dari klien, jadi user yang sudah login bisa melihat dan menandai
// notifikasi milik orang lain hanya dengan menebak id-nya. Mirror dari
// identitas lain: req.pengguna.nip.
//
// Standar identitas notifikasi adalah NIP, sama dengan req.pengguna.nip,
// doc_history.actor_id, dan user_credentials.nip.
app.get('/api/notifications', async (req, res) => {
  const userId = req.pengguna?.nip;
  if (!userId) return res.status(400).json({ error: 'Sesi tidak memuat NIP' });
  try {
    const rows = await queryDB(
      `SELECT id, title, message, type, doc_id, is_read, created_at,
              kertas_kerja_id, periode_id
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
  const userId = req.pengguna?.nip;
  if (!userId) return res.status(400).json({ error: 'Sesi tidak memuat NIP' });
  try {
    // user_id ikut jadi syarat WHERE, bukan hanya id: tanpa itu notifikasi
    //milik orang lain ikut ditandai terbaca.
    const rows = await queryDB(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal update notifikasi' });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  const userId = req.pengguna?.nip;
  if (!userId) return res.status(400).json({ error: 'Sesi tidak memuat NIP' });
  try {
    // is_read IS NOT FALSE, bukan IS FALSE: kolomnya nullable dan baris NULL
    // akan tersingkir dari UPDATE sehingga tidak pernah ditandai terbaca.
    await queryDB(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read IS NOT TRUE',
      [userId]
    );
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

// ── Public: Token Access ─────────────────────────────────────────────────
app.get('/api/publik', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const result = await pool.query(
      `SELECT s.*, d.judul, d.file_type, d.versi, d."desc", d.tags, d.nomor_dokumen
       FROM doc_shares s
       JOIN bapperida_dokumen d ON d.id = s.doc_id
       WHERE s.token = $1 AND s.is_active = TRUE`,
      [token.toUpperCase()]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Tautan tidak valid atau sudah kedaluwarsa' });
    }

    const share = result.rows[0];
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(404).json({ error: 'Tautan sudah kedaluwarsa' });
    }

    const doc = await pool.query(`SELECT * FROM bapperida_dokumen WHERE id = $1`, [share.doc_id]);
    const d = doc.rows[0] || {};
    res.json({
      doc: {
        id: d.id, judul: d.judul, kategori: d.kategori, tipe: d.tipe, bidang: d.bidang,
        file_type: d.file_type, versi: d.versi || 1, desc: d.desc, tags: d.tags,
        nomor_dokumen: d.nomor_dokumen, ukuran: d.ukuran, pages: d.pages,
        url: d.url, files: d.files,
      },
      share: { token: share.token, verif_code: share.verif_code, expires_at: share.expires_at }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: Verification ────────────────────────────────────────────────
app.get('/api/publik/verify', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Kode verifikasi required' });

    const result = await pool.query(
      `SELECT s.*, d.judul, d.file_type, d.versi, d."desc", d.tags
       FROM doc_shares s
       JOIN bapperida_dokumen d ON d.id = s.doc_id
       WHERE UPPER(s.verif_code) = UPPER($1) AND s.is_active = TRUE`,
      [code.replace(/\s/g, '')]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kode verifikasi tidak valid' });
    }

    const share = result.rows[0];
    const expired = share.expires_at && new Date(share.expires_at) < new Date();

    res.json({
      doc: { id: share.doc_id, judul: share.judul, file_type: share.file_type, versi: share.versi, desc: share.desc, tags: share.tags },
      verified: true,
      expired,
      verified_at: new Date().toISOString(),
      share: { created_at: share.created_at, expires_at: share.expires_at }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
  // Dicek paling awal supaya konfigurasi session yang salah langsung terlihat di
  // log, bukan baru ketahuan setelah pengguna mencoba login.
  periksaKonfigurasiSession();
  periksaPemisahanSecret();
  mulaiPengingatDeadline();
  console.log(`Server berjalan di port ${PORT} [${isProd ? 'production' : 'development'}]`);
});
