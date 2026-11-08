import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { tambahAturan, aturan, aturanSemua, PUBLIK, LOGIN } from './kebijakan.js';
import { verifikasiCaptcha } from './captcha.js';

// Daftarkan hak akses route akun
tambahAturan([
  aturan('POST', PUBLIK, '/api/akun/lupa-password/cek'),
  aturan('POST', PUBLIK, '/api/akun/lupa-password/reset'),
  aturan('GET',  LOGIN,  '/api/akun/profil'),
  aturan('PUT',  LOGIN,  '/api/akun/profil'),
  aturan('POST', LOGIN,  '/api/akun/ganti-password'),
  aturan('GET',  LOGIN,  '/api/akun/riwayat-login'),
]);

export function daftarkanRuteAkun(app, pool, queryDB) {
  // ── 1. Cek NIP untuk Pemulihan Akun (Lupa Password) ──────────────────────
  app.post('/api/akun/lupa-password/cek', async (req, res) => {
    const { nip, captcha_token, captcha_jawaban } = req.body;
    if (!nip || !String(nip).trim()) {
      return res.status(400).json({ error: 'NIP wajib diisi' });
    }

    const isHuman = await verifikasiCaptcha(pool, captcha_token, captcha_jawaban);
    if (!isHuman) {
      return res.status(400).json({
        error: 'Verifikasi keamanan (bukan bot) salah atau telah kedaluwarsa. Silakan coba lagi.',
        captcha_error: true,
      });
    }

    try {
      const { rows } = await pool.query(
        `SELECT u."NIP" AS nip, u.username, u.nomorhp, u.bidang, c.role
           FROM user_credentials c
           JOIN user_list u ON u."NIP" = c.nip
          WHERE c.nip = $1`,
        [nip.trim()]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'NIP tidak ditemukan dalam sistem' });
      }

      const user = rows[0];
      const cleanHp = String(user.nomorhp || '').replace(/\D/g, '');
      if (!cleanHp || cleanHp.length < 8) {
        return res.status(400).json({
          error: 'Akun ini belum memiliki nomor HP terdaftar. Silakan hubungi Administrator untuk mereset kata sandi Anda.',
        });
      }

      // Samarkan nomor HP tanpa membocorkan digit belakang (misal: 0812****)
      const awal = cleanHp.slice(0, 4);
      const hpClue = `${awal}****`;

      // Buat token tantangan reset sesi (berlaku 15 menit)
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        `INSERT INTO sd_password_reset_token (nip, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.nip, token, expiresAt]
      );

      res.json({
        nip: user.nip,
        username: user.username,
        bidang: user.bidang || '—',
        punya_hp: true,
        clue_hp: hpClue,
        token_verifikasi: token,
      });
    } catch (err) {
      console.error('Cek NIP lupa password error:', err);
      res.status(500).json({ error: 'Gagal memverifikasi NIP' });
    }
  });

  // ── 2. Eksekusi Reset Password ──────────────────────────────────────────
  app.post('/api/akun/lupa-password/reset', async (req, res) => {
    const { nip, token_verifikasi, verifikasi_hp, password_baru, konfirmasi_password } = req.body;

    if (!nip || !token_verifikasi || !password_baru) {
      return res.status(400).json({ error: 'Data formulir tidak lengkap' });
    }

    if (password_baru.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    if (konfirmasi_password && password_baru !== konfirmasi_password) {
      return res.status(400).json({ error: 'Konfirmasi password tidak cocok' });
    }

    try {
      // Periksa token reset
      const tokenRes = await pool.query(
        `SELECT * FROM sd_password_reset_token
          WHERE nip = $1 AND token = $2 AND used_at IS NULL AND expires_at > NOW()
          ORDER BY id DESC LIMIT 1`,
        [nip.trim(), token_verifikasi]
      );

      if (!tokenRes.rows.length) {
        return res.status(400).json({ error: 'Tiket reset tidak valid atau sudah kedaluwarsa. Silakan ulangi proses.' });
      }

      // Verifikasi kecocokan nomor HP
      const hpInput = String(verifikasi_hp || '').replace(/\D/g, '');
      if (!/^\d{4}$/.test(hpInput)) {
        return res.status(400).json({ error: 'Verifikasi harus berupa tepat 4 digit terakhir nomor HP Anda' });
      }

      const userRes = await pool.query(
        `SELECT u."NIP" AS nip, u.nomorhp, u.username
           FROM user_list u
          WHERE u."NIP" = $1`,
        [nip.trim()]
      );

      if (!userRes.rows.length) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      }

      const hpDb = String(userRes.rows[0].nomorhp || '').replace(/\D/g, '');
      if (!hpDb || hpDb.length < 8 || !hpDb.endsWith(hpInput)) {
        // Batalkan tiket jika verifikasi salah untuk mencegah brute-force
        await pool.query(`UPDATE sd_password_reset_token SET used_at = NOW() WHERE token = $1`, [token_verifikasi]).catch(() => {});
        return res.status(400).json({ error: 'Verifikasi 4 digit terakhir nomor HP tidak cocok. Tiket reset dibatalkan demi keamanan.' });
      }

      // Hash password baru dengan bcrypt (10 rounds)
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password_baru, salt);

      await pool.query(
        `UPDATE user_credentials
            SET password_hash = $1, updated_at = NOW()
          WHERE nip = $2`,
        [newHash, nip.trim()]
      );

      // Tandai token terpakai
      await pool.query(
        `UPDATE sd_password_reset_token
            SET used_at = NOW()
          WHERE token = $1`,
        [token_verifikasi]
      );

      // Catat log
      await pool.query(
        `INSERT INTO sd_auth_log (nip, status, pesan)
         VALUES ($1, 'reset_password', 'Password direset mandiri melalui formulir lupa password')`,
        [nip.trim()]
      );

      // Bersihkan cache sesi jika ada
      if (app.locals.bersihkanCacheSesi) {
        app.locals.bersihkanCacheSesi();
      }

      res.json({
        success: true,
        message: 'Password berhasil direset. Silakan login menggunakan password baru Anda.',
      });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Gagal mereset password' });
    }
  });

  // ── 3. Ambil Profil Pengguna yang Sedang Login ───────────────────────────
  app.get('/api/akun/profil', async (req, res) => {
    try {
      const nip = req.pengguna.nip;
      const { rows } = await pool.query(
        `SELECT u.id, u."NIP" AS nip, u.username AS nama, u."Jabatan" AS jabatan,
                u.nomorhp, u.bidang, u."Status" AS status, c.role, c.opd_id,
                o.nama AS opd_nama, o.singkatan AS opd_singkatan,
                c.last_login, c.created_at
           FROM user_credentials c
           LEFT JOIN user_list u ON u."NIP" = c.nip
           LEFT JOIN bank_data_opd o ON o.id = c.opd_id
          WHERE c.nip = $1`,
        [nip]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Data profil tidak ditemukan' });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error('Get profil error:', err);
      res.status(500).json({ error: 'Gagal mengambil data profil' });
    }
  });

  // ── 4. Update Profil Pengguna (Nama, Kontak, Jabatan) ────────────────────
  app.put('/api/akun/profil', async (req, res) => {
    const nip = req.pengguna.nip;
    const { nama, nomorhp, jabatan } = req.body;

    try {
      await pool.query(
        `UPDATE user_list
            SET username = COALESCE($1, username),
                nomorhp = COALESCE($2, nomorhp),
                "Jabatan" = COALESCE($3, "Jabatan")
          WHERE "NIP" = $4`,
        [nama?.trim() || null, nomorhp?.trim() || null, jabatan?.trim() || null, nip]
      );

      // Bersihkan cache sesi
      if (app.locals.bersihkanCacheSesi) {
        app.locals.bersihkanCacheSesi();
      }

      res.json({
        success: true,
        message: 'Profil berhasil diperbarui',
      });
    } catch (err) {
      console.error('Update profil error:', err);
      res.status(500).json({ error: 'Gagal memperbarui profil' });
    }
  });

  // ── 5. Ganti Password Sendiri ───────────────────────────────────────────
  app.post('/api/akun/ganti-password', async (req, res) => {
    const nip = req.pengguna.nip;
    const { password_lama, password_baru, konfirmasi_password } = req.body;

    if (!password_lama || !password_baru) {
      return res.status(400).json({ error: 'Password lama dan password baru wajib diisi' });
    }

    if (password_baru.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    if (konfirmasi_password && password_baru !== konfirmasi_password) {
      return res.status(400).json({ error: 'Konfirmasi password baru tidak cocok' });
    }

    try {
      const { rows } = await pool.query(
        `SELECT password_hash FROM user_credentials WHERE nip = $1`,
        [nip]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Akun tidak ditemukan' });
      }

      const match = await bcrypt.compare(password_lama, rows[0].password_hash);
      if (!match) {
        return res.status(400).json({ error: 'Password lama Anda salah' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password_baru, salt);

      await pool.query(
        `UPDATE user_credentials
            SET password_hash = $1, updated_at = NOW()
          WHERE nip = $2`,
        [newHash, nip]
      );

      await pool.query(
        `INSERT INTO sd_auth_log (nip, status, pesan)
         VALUES ($1, 'ganti_password', 'Pengguna mengganti password akun sendiri')`,
        [nip]
      );

      if (app.locals.bersihkanCacheSesi) {
        app.locals.bersihkanCacheSesi();
      }

      res.json({
        success: true,
        message: 'Password berhasil diganti. Silakan gunakan password baru ini pada login berikutnya.',
      });
    } catch (err) {
      console.error('Ganti password error:', err);
      res.status(500).json({ error: 'Gagal mengganti password' });
    }
  });

  // ── 6. Riwayat Login Pengguna ───────────────────────────────────────────
  app.get('/api/akun/riwayat-login', async (req, res) => {
    const nip = req.pengguna.nip;
    try {
      const { rows } = await pool.query(
        `SELECT id, status, pesan, ip_address, created_at
           FROM sd_auth_log
          WHERE nip = $1
          ORDER BY id DESC
          LIMIT 20`,
        [nip]
      );
      res.json(rows);
    } catch (err) {
      console.error('Riwayat login error:', err);
      res.status(500).json({ error: 'Gagal memuat riwayat login' });
    }
  });
}
