import crypto from 'crypto';
import { tambahAturan, aturan, aturanSemua, PUBLIK } from './kebijakan.js';

tambahAturan([
  aturanSemua(PUBLIK, '/feed/berita\\.xml'),
  aturanSemua(PUBLIK, '/sitemap\\.xml'),
  aturanSemua(PUBLIK, '/robots\\.txt'),
  aturanSemua(PUBLIK, '/manifest\\.webmanifest'),
  aturanSemua(PUBLIK, '/api/portal/berita(/[^/]+)*'),
  aturanSemua(PUBLIK, '/api/portal/katalog(/[^/]+)*'),
  aturanSemua(PUBLIK, '/api/portal/captcha(/[^/]+)*'),
]);

export function daftarkanRutePortalKonten(app, pool, queryDB) {
  // ── 1. Captcha Sederhana untuk Form Publik ────────────────────────────────
  app.get('/api/portal/captcha', async (_, res) => {
    try {
      const a = Math.floor(Math.random() * 15) + 1;
      const b = Math.floor(Math.random() * 10) + 1;
      const hasil = String(a + b);
      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

      await pool.query(
        `INSERT INTO sd_captcha_session (token, jawaban, expires_at)
         VALUES ($1, $2, $3)`,
        [token, hasil, expiresAt]
      );

      // Gambar SVG sederhana untuk captcha
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="42" viewBox="0 0 130 42">
        <rect width="130" height="42" fill="#F1F5F9" rx="6" />
        <line x1="10" y1="12" x2="120" y2="30" stroke="#CBD5E1" stroke-width="1.5" />
        <line x1="15" y1="32" x2="115" y2="10" stroke="#CBD5E1" stroke-width="1.5" />
        <text x="65" y="27" font-family="monospace" font-size="20" font-weight="bold" fill="#0F172A" text-anchor="middle" letter-spacing="3">${a} + ${b} = ?</text>
      </svg>`;

      res.json({
        token,
        soal: `${a} + ${b} = ?`,
        svg_base64: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      });
    } catch (err) {
      console.error('Captcha error:', err);
      res.status(500).json({ error: 'Gagal membuat captcha' });
    }
  });

  // Helper verifikasi captcha
  const verifikasiCaptcha = async (token, jawaban) => {
    if (!token || !jawaban) return false;
    const { rows } = await pool.query(
      `SELECT * FROM sd_captcha_session WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return false;
    const match = rows[0].jawaban.trim() === String(jawaban).trim();
    // Hapus sesi captcha yang sudah dipakai
    pool.query(`DELETE FROM sd_captcha_session WHERE token = $1`, [token]).catch(() => {});
    return match;
  };

  // ── 2. Tanya Data (Q&A) dengan Captcha ─────────────────────────────────────
  app.post('/api/portal/qna-kirim', async (req, res) => {
    const { nama, email, nomorhp, pertanyaan, organisasi, captcha_token, captcha_jawaban } = req.body;

    if (!nama || !pertanyaan) {
      return res.status(400).json({ error: 'Nama dan pertanyaan wajib diisi' });
    }

    if (captcha_token) {
      const valid = await verifikasiCaptcha(captcha_token, captcha_jawaban);
      if (!valid) {
        return res.status(400).json({ error: 'Jawaban captcha salah atau sesi telah kedaluwarsa' });
      }
    }

    try {
      await pool.query(
        `INSERT INTO sd_qna (nama, email, nomorhp, organisasi, pertanyaan, status)
         VALUES ($1, $2, $3, $4, $5, 'menunggu')`,
        [nama.trim(), email?.trim() || null, nomorhp?.trim() || null, organisasi?.trim() || null, pertanyaan.trim()]
      );

      res.json({
        success: true,
        message: 'Pertanyaan Anda telah berhasil dikirim. Pengelola Satu Data akan memproses dan merespons pertanyaan Anda.',
      });
    } catch (err) {
      console.error('Portal QnA error:', err);
      res.status(500).json({ error: 'Gagal menyimpan pertanyaan' });
    }
  });

  // ── 3. Berita & Pengumuman ────────────────────────────────────────────────
  app.get('/api/portal/berita', async (req, res) => {
    const { q, kategori, year, month, page = 1, limit = 9 } = req.query;

    try {
      const conditions = ["status = 'diterbitkan'"];
      const params = [];
      let idx = 1;

      if (q && q.trim()) {
        conditions.push(`(judul ILIKE $${idx} OR konten ILIKE $${idx} OR ringkasan ILIKE $${idx})`);
        params.push(`%${q.trim()}%`);
        idx++;
      }

      if (kategori) {
        conditions.push(`kategori = $${idx}`);
        params.push(kategori);
        idx++;
      }

      if (year) {
        conditions.push(`EXTRACT(YEAR FROM created_at) = $${idx}`);
        params.push(parseInt(year, 10));
        idx++;
      }

      if (month) {
        conditions.push(`EXTRACT(MONTH FROM created_at) = $${idx}`);
        params.push(parseInt(month, 10));
        idx++;
      }

      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const limitVal = parseInt(limit, 10);
      const whereStr = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM sd_konten_berita ${whereStr}`, params);
      const total = countRes.rows[0]?.total || 0;

      const dataSql = `
        SELECT id, judul, slug, ringkasan, kategori, gambar_url, penulis,
               view_count, created_at, updated_at
          FROM sd_konten_berita
        ${whereStr}
        ORDER BY created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `;
      const dataRes = await pool.query(dataSql, [...params, limitVal, offset]);

      res.json({
        data: dataRes.rows,
        meta: {
          total,
          page: parseInt(page, 10),
          limit: limitVal,
          total_pages: Math.ceil(total / limitVal),
        },
      });
    } catch (err) {
      console.error('Portal berita list error:', err);
      res.status(500).json({ error: 'Gagal memuat berita' });
    }
  });

  // Berita populer & arsip
  app.get('/api/portal/berita/populer', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT id, judul, slug, ringkasan, gambar_url, view_count, created_at
          FROM sd_konten_berita
         WHERE status = 'diterbitkan'
         ORDER BY view_count DESC, created_at DESC
         LIMIT 5
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat berita populer' });
    }
  });

  app.get('/api/portal/berita/arsip', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT EXTRACT(YEAR FROM created_at)::int AS tahun,
               EXTRACT(MONTH FROM created_at)::int AS bulan,
               COUNT(*)::int AS jumlah
          FROM sd_konten_berita
         WHERE status = 'diterbitkan'
         GROUP BY tahun, bulan
         ORDER BY tahun DESC, bulan DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat arsip berita' });
    }
  });

  // Detail berita per slug
  app.get('/api/portal/berita/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
      const rows = await queryDB(`
        SELECT * FROM sd_konten_berita WHERE slug = $1 OR id::text = $1
      `, [slug]);

      if (!rows.length) {
        return res.status(404).json({ error: 'Berita tidak ditemukan' });
      }

      const berita = rows[0];

      // Increment view count
      pool.query(`
        UPDATE sd_konten_berita
           SET view_count = view_count + 1
         WHERE id = $1
      `, [berita.id]).catch(() => {});

      // Ambil berita terkait (kategori sama)
      const terkait = await queryDB(`
        SELECT id, judul, slug, ringkasan, gambar_url, created_at
          FROM sd_konten_berita
         WHERE kategori = $1 AND id != $2 AND status = 'diterbitkan'
         ORDER BY created_at DESC
         LIMIT 3
      `, [berita.kategori, berita.id]);

      res.json({
        ...berita,
        view_count: (berita.view_count || 0) + 1,
        terkait,
      });
    } catch (err) {
      console.error('Detail berita error:', err);
      res.status(500).json({ error: 'Gagal memuat detail berita' });
    }
  });

  // ── 4. Katalog Dokumen Publik (Produk Hukum, SK Tim, Publikasi Kajian) ───
  app.get('/api/portal/katalog', async (req, res) => {
    const { jenis, q } = req.query; // 'Perencanaan Jangka Panjang', 'Produk Hukum', 'SK Tim Satu Data', 'Publikasi Kajian', etc.

    try {
      let sql = `SELECT * FROM sd_konten_publikasi WHERE tampil_publik = TRUE`;
      const params = [];
      let idx = 1;

      if (jenis && jenis !== 'Semua') {
        sql += ` AND jenis = $${idx}`;
        params.push(jenis);
        idx++;
      }

      if (q && q.trim()) {
        sql += ` AND (judul ILIKE $${idx} OR nomor ILIKE $${idx} OR deskripsi ILIKE $${idx} OR instansi ILIKE $${idx})`;
        params.push(`%${q.trim()}%`);
        idx++;
      }

      sql += ` ORDER BY tahun DESC, id DESC`;
      const rows = await queryDB(sql, params);
      res.json(rows);
    } catch (err) {
      console.error('Katalog publikasi error:', err);
      res.status(500).json({ error: 'Gagal memuat dokumen katalog' });
    }
  });

  // ── 5. RSS Feed Berita (/feed/berita.xml) ──────────────────────────────────
  app.get('/feed/berita.xml', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT id, judul, slug, ringkasan, penulis, created_at
          FROM sd_konten_berita
         WHERE status = 'diterbitkan'
         ORDER BY created_at DESC
         LIMIT 20
      `);

      const host = `${process.env.APP_URL || 'http://localhost:3000'}`;
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Satu Data Kabupaten Sumba Barat - Berita &amp; Artikel</title>
    <link>${host}</link>
    <description>Kanal berita dan publikasi data statistik sektoral BAPPERIDA Kabupaten Sumba Barat</description>
    <language>id-ID</language>
    <atom:link href="${host}/feed/berita.xml" rel="self" type="application/rss+xml" />
`;

      for (const r of rows) {
        const link = `${host}/#/portal/berita/${r.slug || r.id}`;
        xml += `    <item>
      <title><![CDATA[${r.judul}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(r.created_at).toUTCString()}</pubDate>
      <description><![CDATA[${r.ringkasan || ''}]]></description>
      ${r.penulis ? `<author>${r.penulis}</author>` : ''}
    </item>\n`;
      }

      xml += `  </channel>\n</rss>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      console.error('RSS error:', err);
      res.status(500).send('Error generating RSS feed');
    }
  });

  // ── 6. Sitemap XML (/sitemap.xml) ─────────────────────────────────────────
  app.get('/sitemap.xml', async (_, res) => {
    try {
      const host = `${process.env.APP_URL || 'http://localhost:3000'}`;
      const [datasets, news] = await Promise.all([
        queryDB(`SELECT id, updated_at FROM bank_dataset WHERE status = 'disetujui' AND klasifikasi = 'terbuka'`),
        queryDB(`SELECT slug, id, updated_at FROM sd_konten_berita WHERE status = 'diterbitkan'`),
      ]);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${host}/#/portal</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${host}/#/portal/dataset</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${host}/#/portal/visualisasi</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${host}/#/portal/bandingkan</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${host}/#/portal/spm</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;

      for (const d of datasets) {
        xml += `  <url>
    <loc>${host}/#/portal/dataset/${d.id}</loc>
    <lastmod>${new Date(d.updated_at || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
      }

      for (const n of news) {
        xml += `  <url>
    <loc>${host}/#/portal/berita/${n.slug || n.id}</loc>
    <lastmod>${new Date(n.updated_at || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
      }

      xml += `</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err) {
      console.error('Sitemap error:', err);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ── 7. Robots.txt ─────────────────────────────────────────────────────────
  app.get('/robots.txt', (_, res) => {
    const host = `${process.env.APP_URL || 'http://localhost:3000'}`;
    const txt = `User-agent: *
Allow: /
Allow: /api/publik/
Allow: /api/portal/
Disallow: /api/auth/
Disallow: /api/admin/
Disallow: /api/users/

Sitemap: ${host}/sitemap.xml
`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(txt);
  });

  // ── 8. Web App Manifest (PWA) ─────────────────────────────────────────────
  app.get('/manifest.webmanifest', (_, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.json({
      name: 'Portal Satu Data BAPPERIDA Sumba Barat',
      short_name: 'SatuData SB',
      description: 'Portal Resmi Satu Data Statistik Sektoral dan Capaian Pembangunan Kabupaten Sumba Barat',
      start_url: '/#/portal',
      display: 'standalone',
      background_color: '#F8FAFC',
      theme_color: '#059669',
      icons: [
        {
          src: '/logos/logo_sumba_barat.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    });
  });
}
