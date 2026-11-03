import { tambahAturan, aturan, aturanSemua, PUBLIK, LOGIN, BANKDATA, REVIEW, ADMIN } from './kebijakan.js';

tambahAturan([
  aturan('POST',   ADMIN,    '/api/spm/capaian/import'),
  aturan('PUT',    ADMIN,    '/api/spm/capaian/[^/]+'),
  aturan('PUT',    ADMIN,    '/api/spm/dokumen/[^/]+'),
  aturan('GET',    REVIEW,   '/api/dashboard/walidata'),
  aturan('GET',    BANKDATA, '/api/dashboard/produsen'),
  aturan('POST',   PUBLIK,   '/api/portal/visit'),
  aturan('GET',    ADMIN,    '/api/monitoring/page-visits'),
  aturan('DELETE', LOGIN,    '/api/notifications/semua'),
  aturan('DELETE', LOGIN,    '/api/notifications/[^/]+'),
]);

export function daftarkanRuteAdminLanjutan(app, pool, queryDB) {
  // ── 1. Impor Capaian SPM dari Excel ───────────────────────────────────────
  app.post('/api/spm/capaian/import', async (req, res) => {
    const { items = [], tahun } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Tidak ada baris data yang diimpor' });
    }

    try {
      let sukses = 0;
      for (const it of items) {
        // Cari ID layanan dari kode atau nama jika belum berupa ID
        let layananId = it.layanan_id;
        if (!layananId && it.kode_layanan) {
          const l = await queryDB(`SELECT id FROM sd_spm_layanan WHERE kode_layanan = $1`, [it.kode_layanan]);
          if (l.length) layananId = l[0].id;
        }

        if (layananId) {
          const thn = it.tahun || tahun || new Date().getFullYear();
          await pool.query(
            `INSERT INTO sd_spm_capaian (layanan_id, tahun, target, capaian, target_persen, realisasi_persen, catatan)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (layanan_id, tahun)
             DO UPDATE SET target = EXCLUDED.target,
                           capaian = EXCLUDED.capaian,
                           target_persen = EXCLUDED.target_persen,
                           realisasi_persen = EXCLUDED.realisasi_persen,
                           catatan = EXCLUDED.catatan,
                           updated_at = NOW()`,
            [layananId, thn, it.target ?? null, it.capaian ?? null, it.target_persen ?? null, it.realisasi_persen ?? null, it.catatan || null]
          );
          sukses++;
        }
      }

      res.json({ message: `Berhasil mengimpor ${sukses} data capaian SPM` });
    } catch (err) {
      console.error('Impor capaian SPM error:', err);
      res.status(500).json({ error: 'Gagal memproses impor capaian SPM' });
    }
  });

  // Edit capaian SPM
  app.put('/api/spm/capaian/:id', async (req, res) => {
    const { id } = req.params;
    const { target, capaian, target_persen, realisasi_persen, catatan } = req.body;

    try {
      const { rows } = await pool.query(
        `UPDATE sd_spm_capaian
            SET target = COALESCE($1, target),
                capaian = COALESCE($2, capaian),
                target_persen = COALESCE($3, target_persen),
                realisasi_persen = COALESCE($4, realisasi_persen),
                catatan = COALESCE($5, catatan),
                updated_at = NOW()
          WHERE id = $6
          RETURNING *`,
        [target, capaian, target_persen, realisasi_persen, catatan || null, id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Data capaian tidak ditemukan' });
      res.json({ message: 'Capaian SPM berhasil diperbarui', capaian: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui capaian SPM' });
    }
  });

  // Edit dokumen SPM
  app.put('/api/spm/dokumen/:id', async (req, res) => {
    const { id } = req.params;
    const { judul, tahun, jenis, url_file, keterangan } = req.body;

    try {
      const { rows } = await pool.query(
        `UPDATE sd_spm_dokumen
            SET judul = COALESCE($1, judul),
                tahun = COALESCE($2, tahun),
                jenis = COALESCE($3, jenis),
                url_file = COALESCE($4, url_file),
                keterangan = COALESCE($5, keterangan)
          WHERE id = $6
          RETURNING *`,
        [judul, tahun, jenis, url_file, keterangan, id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Dokumen SPM tidak ditemukan' });
      res.json({ message: 'Dokumen SPM berhasil diperbarui', dokumen: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui dokumen SPM' });
    }
  });

  // ── 2. Dashboard Berbasis Role (Walidata & Produsen Data) ──────────────────
  app.get('/api/dashboard/walidata', async (_, res) => {
    try {
      const [antrian, statistikStatus, opdStatistik, reopenMenunggu] = await Promise.all([
        // Antrian verifikasi dataset
        queryDB(`
          SELECT d.id, d.nama, d.status, d.submitted_at, d.created_at,
                 o.nama AS opd_nama, o.singkatan AS opd_singkatan,
                 (SELECT COUNT(*)::int FROM bank_dataset_row r WHERE r.dataset_id = d.id) AS baris_count
            FROM bank_dataset d
            JOIN bank_data_opd o ON o.id = d.opd_id
           WHERE d.status IN ('diajukan', 'perlu_perbaikan')
           ORDER BY d.submitted_at ASC NULLS LAST, d.created_at ASC
        `),
        // Statistik status semua dataset
        queryDB(`
          SELECT status, COUNT(*)::int AS count
            FROM bank_dataset
           GROUP BY status
        `),
        // Keterisian per OPD
        queryDB(`
          SELECT o.id, o.nama, o.singkatan,
                 COUNT(d.id)::int AS total_dataset,
                 COUNT(CASE WHEN d.status = 'disetujui' THEN 1 END)::int AS disetujui,
                 COUNT(CASE WHEN d.status = 'diajukan' THEN 1 END)::int AS menunggu_verval,
                 COUNT(CASE WHEN d.status = 'draft' THEN 1 END)::int AS draft
            FROM bank_data_opd o
            LEFT JOIN bank_dataset d ON d.opd_id = o.id
           GROUP BY o.id, o.nama, o.singkatan
           ORDER BY total_dataset DESC, o.nama
        `),
        // Permintaan reopen yang masih menunggu
        queryDB(`
          SELECT r.*, d.nama AS dataset_nama, o.nama AS opd_nama
            FROM sd_reopen_request r
            JOIN bank_dataset d ON d.id = r.dataset_id
            JOIN bank_data_opd o ON o.id = r.opd_id
           WHERE r.status = 'menunggu'
           ORDER BY r.created_at ASC
        `),
      ]);

      res.json({
        antrian_verifikasi: antrian,
        statistik_status: statistikStatus,
        keterisian_opd: opdStatistik,
        reopen_menunggu: reopenMenunggu,
      });
    } catch (err) {
      console.error('Dashboard walidata error:', err);
      res.status(500).json({ error: 'Gagal memuat dashboard Walidata' });
    }
  });

  app.get('/api/dashboard/produsen', async (req, res) => {
    const opdId = req.pengguna.opd_id;
    if (!opdId) {
      return res.status(400).json({ error: 'Akun Anda belum ditautkan ke OPD' });
    }

    try {
      const [opdInfo, datasets, jadwalMendekati] = await Promise.all([
        queryDB(`SELECT * FROM bank_data_opd WHERE id = $1`, [opdId]),
        queryDB(`
          SELECT d.id, d.nama, d.status, d.frekuensi, d.catatan_verifikasi, d.verified_at,
                 d.jadwal_pemutakhiran, d.jadwal_pemutakhiran_akhir,
                 (SELECT COUNT(*)::int FROM bank_dataset_row r WHERE r.dataset_id = d.id) AS baris_count
            FROM bank_dataset d
           WHERE d.opd_id = $1
           ORDER BY d.updated_at DESC
        `, [opdId]),
        queryDB(`
          SELECT id, nama, frekuensi, jadwal_pemutakhiran, jadwal_pemutakhiran_akhir
            FROM bank_dataset
           WHERE opd_id = $1
             AND (jadwal_pemutakhiran >= CURRENT_DATE OR jadwal_pemutakhiran_akhir >= CURRENT_DATE)
           ORDER BY COALESCE(jadwal_pemutakhiran, jadwal_pemutakhiran_akhir) ASC
           LIMIT 5
        `, [opdId]),
      ]);

      res.json({
        opd: opdInfo[0] || null,
        datasets,
        jadwal_mendekati: jadwalMendekati,
      });
    } catch (err) {
      console.error('Dashboard produsen error:', err);
      res.status(500).json({ error: 'Gagal memuat dashboard Produsen' });
    }
  });

  // ── 3. Pelacakan Kunjungan Halaman (Page Visits) ───────────────────────────
  app.post('/api/portal/visit', async (req, res) => {
    const { path, referrer } = req.body;
    if (!path) return res.json({ ok: true });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';

    try {
      await pool.query(
        `INSERT INTO sd_page_visits (path, ip_address, user_agent, referrer, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [path, ip, ua.slice(0, 255), (referrer || '').slice(0, 255), req.pengguna?.nip || null]
      );
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  app.get('/api/monitoring/page-visits', async (_, res) => {
    try {
      const [topHalaman, trenHarian, logTerbaru] = await Promise.all([
        queryDB(`
          SELECT path, COUNT(*)::int AS visits, COUNT(DISTINCT ip_address)::int AS unique_ips
            FROM sd_page_visits
           GROUP BY path
           ORDER BY visits DESC
           LIMIT 15
        `),
        queryDB(`
          SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS tanggal, COUNT(*)::int AS visits
            FROM sd_page_visits
           WHERE created_at >= NOW() - INTERVAL '14 days'
           GROUP BY tanggal
           ORDER BY tanggal ASC
        `),
        queryDB(`
          SELECT id, path, ip_address, referrer, created_at
            FROM sd_page_visits
           ORDER BY id DESC
           LIMIT 50
        `),
      ]);

      res.json({
        top_halaman: topHalaman,
        tren_harian: trenHarian,
        log_terbaru: logTerbaru,
      });
    } catch (err) {
      console.error('Get page visits error:', err);
      res.status(500).json({ error: 'Gagal memuat data kunjungan halaman' });
    }
  });

  // ── 4. Notifikasi: Hapus per Item & Hapus Semua ────────────────────────────
  app.delete('/api/notifications/semua', async (req, res) => {
    const nip = req.pengguna.nip;
    try {
      await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [nip]);
      res.json({ message: 'Semua notifikasi berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus notifikasi' });
    }
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    const { id } = req.params;
    const nip = req.pengguna.nip;
    try {
      await pool.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [id, nip]);
      res.json({ message: 'Notifikasi berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus notifikasi' });
    }
  });
}
