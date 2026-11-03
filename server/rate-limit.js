// Pembatas laju (Rate Limiting) in-memory untuk endpoint publik, autentikasi, dan API.
// Menggunakan fixed-window bucket per IP client dengan pembersihan otomatis.

const stores = new Map();

// Bersihkan bucket kedaluwarsa setiap 2 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of stores.entries()) {
    if (now > record.resetTime) {
      stores.delete(key);
    }
  }
}, 120_000);

function dapatkanIP(req) {
  const xForwarded = req.headers['x-forwarded-for'];
  if (xForwarded) {
    const ip = xForwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

export function pembatasLaju(req, res, next) {
  const path = req.originalUrl.split('?')[0];

  // Hanya periksa path /api
  if (!path.startsWith('/api')) {
    return next();
  }

  // Tentukan batas berdasarkan jenis endpoint
  let limit = 200;      // default: 200 request / menit
  let windowMs = 60_000; // 1 menit
  let category = 'general';

  if (path === '/api/auth/login' || path.startsWith('/api/akun/lupa-password')) {
    limit = 20;         // max 20 percobaan login / lupa password
    windowMs = 600_000; // per 10 menit
    category = 'auth';
  } else if (path.startsWith('/api/publik') || path.startsWith('/api/portal') || path.startsWith('/api/v1')) {
    limit = 120;        // max 120 request / menit untuk publik
    windowMs = 60_000;
    category = 'public';
  }

  const ip = dapatkanIP(req);
  const key = `${category}:${ip}`;
  const now = Date.now();

  let record = stores.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    stores.set(key, record);
  } else {
    record.count++;
  }

  const remaining = Math.max(0, limit - record.count);
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (record.count > limit) {
    res.setHeader('Retry-After', resetSeconds);
    return res.status(429).json({
      error: 'Terlalu banyak permintaan (Rate limit terlampaui). Silakan coba lagi dalam beberapa saat.',
      retry_after_seconds: resetSeconds,
    });
  }

  next();
}
