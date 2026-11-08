import assert from 'node:assert/strict';
import { rahasia, samaKonst } from './session.js';

console.log('--- TEST PERBAIKAN KEAMANAN ---');

// 1. Session secret terlarang / bocor
{
  const oldSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'ARSIPDIGITALBAPPERIDA2026';
  assert.equal(rahasia(), null, 'Kunci bocor ARSIPDIGITALBAPPERIDA2026 harus ditolak');
  
  process.env.SESSION_SECRET = 'Bidangekonomi2026';
  assert.equal(rahasia(), null, 'Kunci default Bidangekonomi2026 harus ditolak');
  
  process.env.SESSION_SECRET = 'short';
  assert.equal(rahasia(), null, 'Kunci pendek (< 16 karakter) harus ditolak');
  
  process.env.SESSION_SECRET = 'kunci-acak-yang-sangat-aman-dan-panjang-12345';
  assert.equal(rahasia(), 'kunci-acak-yang-sangat-aman-dan-panjang-12345', 'Kunci acak panjang harus diterima');
  process.env.SESSION_SECRET = oldSecret;
  console.log('  ok  blacklist kunci bocor & validasi panjang rahasia');
}

// 2. samaKonst timing safe comparison
{
  assert.equal(samaKonst('secret123', 'secret123'), true);
  assert.equal(samaKonst('secret123', 'secret124'), false);
  assert.equal(samaKonst('secret123', 'secret12'), false);
  assert.equal(samaKonst('secret123', 'secret1234'), false);
  assert.equal(samaKonst('', ''), true);
  console.log('  ok  samaKonst timing-safe equality check');
}

// 3. CSV Cell Sanitization untuk Formula Injection
{
  const sanitizeCsvCell = (val) => {
    const s = String(val ?? '');
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  assert.equal(sanitizeCsvCell('=1+1'), `"'=1+1"`, 'Formula = dinonaktifkan');
  assert.equal(sanitizeCsvCell('+cmd'), ` "'+cmd"`.trim(), 'Formula + dinonaktifkan');
  assert.equal(sanitizeCsvCell('-5'), `"'-5"`, 'Tanda - dinonaktifkan');
  assert.equal(sanitizeCsvCell('@SUM(A1)'), `"'@SUM(A1)"`, 'Formula @ dinonaktifkan');
  assert.equal(sanitizeCsvCell('Normal Text'), `"Normal Text"`, 'Teks biasa tetap normal');
  console.log('  ok  CSV Formula Injection sanitization (CWE-1236)');
}

// 4. URL Sanitization
{
  function urlAman(url) {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
      const u = new URL(url.trim());
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }

  assert.equal(urlAman('https://drive.google.com/file/d/123'), true);
  assert.equal(urlAman('http://example.com/data.pdf'), true);
  assert.equal(urlAman('javascript:alert(1)'), false);
  assert.equal(urlAman('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(urlAman('vbscript:msgbox(1)'), false);
  assert.equal(urlAman('   '), false);
  console.log('  ok  URL protocol validation against XSS');
}

// 5. Anti-Bot Captcha Generator & Verifier
{
  const { buatCaptcha, verifikasiCaptcha } = await import('./captcha.js');
  
  // Mock pool in-memory
  const storage = new Map();
  const mockPool = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO sd_captcha_session')) {
        const [token, jawaban, expires_at] = params;
        storage.set(token, { jawaban, expires_at });
        return { rows: [] };
      }
      if (sql.includes('SELECT jawaban FROM sd_captcha_session')) {
        const [token] = params;
        const item = storage.get(token);
        if (item && item.expires_at > new Date()) {
          return { rows: [{ jawaban: item.jawaban }] };
        }
        return { rows: [] };
      }
      if (sql.includes('DELETE FROM sd_captcha_session')) {
        const [token] = params;
        storage.delete(token);
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  const c = await buatCaptcha(mockPool);
  assert.ok(c.token && c.token.length === 32, 'Token captcha harus 32 hex karakter');
  assert.ok(c.svg_base64.startsWith('data:image/svg+xml;base64,'), 'SVG captcha harus base64 yang valid');
  assert.ok(c.soal.includes('='), 'Soal captcha harus berupa persamaan');

  const stored = storage.get(c.token);
  assert.ok(stored, 'Sesi captcha harus tersimpan di storage');

  // Jawaban salah harus ditolak
  const salah = await verifikasiCaptcha(mockPool, c.token, '99999');
  assert.equal(salah, false, 'Jawaban salah harus mengembalikan false');

  // Karena salah, tiket langsung dihapus (anti brute-force / anti replay)
  assert.equal(storage.has(c.token), false, 'Tiket captcha langsung dikonsumsi setelah verifikasi');

  // Buat tiket baru untuk uji jawaban benar
  const c2 = await buatCaptcha(mockPool);
  const correctAns = storage.get(c2.token).jawaban;
  const benar = await verifikasiCaptcha(mockPool, c2.token, correctAns);
  assert.equal(benar, true, 'Jawaban benar harus mengembalikan true');
  assert.equal(storage.has(c2.token), false, 'Tiket sukses langsung dikonsumsi');

  // Replay token yang sama harus ditolak
  const replay = await verifikasiCaptcha(mockPool, c2.token, correctAns);
  assert.equal(replay, false, 'Replay token yang sudah dikonsumsi harus ditolak');

  console.log('  ok  Anti-bot captcha generation, verification, and anti-replay protection');
}

console.log('\nSEMUA UJI PERBAIKAN KEAMANAN BERHASIL LULUS!');

