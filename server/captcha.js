import crypto from 'node:crypto';

/**
 * Pembuat tantangan verifikasi anti-bot berbasis kalkulasi matematika ramah pengguna.
 * Menghasilkan token unik yang disimpan di tabel sd_captcha_session dengan kedaluwarsa 10 menit.
 */
export async function buatCaptcha(pool) {
  // Angka acak sederhana (mudah dihitung manusia, menghentikan bot/skrip otomatis)
  const a = Math.floor(Math.random() * 12) + 3;
  const b = Math.floor(Math.random() * 9) + 1;
  const op = Math.random() > 0.5 ? '+' : '-';
  const hasil = op === '+' ? String(a + b) : String(a - b);
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

  await pool.query(
    `INSERT INTO sd_captcha_session (token, jawaban, expires_at)
     VALUES ($1, $2, $3)`,
    [token, hasil, expiresAt]
  );

  const soal = `${a} ${op} ${b} = ?`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44">
    <rect width="120" height="44" fill="#F8FAFC" rx="10" />
    <line x1="8" y1="13" x2="112" y2="31" stroke="#E2E8F0" stroke-width="1.5" stroke-dasharray="4 2" />
    <line x1="12" y1="33" x2="108" y2="11" stroke="#E2E8F0" stroke-width="1.5" stroke-dasharray="4 2" />
    <text x="60" y="28" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#0F172A" text-anchor="middle" letter-spacing="1.5">${soal}</text>
  </svg>`;

  return {
    token,
    soal,
    svg_base64: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  };
}

/**
 * Memverifikasi jawaban captcha dari pengguna.
 * Sesi captcha langsung dihapus begitu diperiksa untuk mencegah serangan replay.
 */
export async function verifikasiCaptcha(pool, token, jawaban) {
  if (!token || jawaban == null) return false;
  const j = String(jawaban).trim();
  if (!j) return false;

  try {
    const { rows } = await pool.query(
      `SELECT jawaban FROM sd_captcha_session WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return false;

    const cocok = rows[0].jawaban.trim() === j;
    // Tiket langsung dihapus agar tidak bisa dipakai ulang
    await pool.query(`DELETE FROM sd_captcha_session WHERE token = $1`, [token]).catch(() => {});
    return cocok;
  } catch (err) {
    console.error('Verifikasi captcha error:', err.message);
    return false;
  }
}

/**
 * Pembersihan otomatis sesi captcha kadaluarsa setiap 15 menit agar database tetap ramping.
 */
let cleanerInit = false;
export function inisialisasiPembersihCaptcha(pool) {
  if (cleanerInit) return;
  cleanerInit = true;
  setInterval(() => {
    pool.query(`DELETE FROM sd_captcha_session WHERE expires_at < NOW()`).catch(() => {});
  }, 15 * 60 * 1000);
}

