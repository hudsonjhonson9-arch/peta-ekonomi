import { tambahAturan, aturan, aturanSemua, PUBLIK } from './kebijakan.js';

// Daftarkan hak akses rute portal publik
tambahAturan([
  aturanSemua(PUBLIK, '/api/portal(/[^/]+)*'),
]);

export function daftarkanRutePortal(app, pool, queryDB) {
  // ── 1. Ringkasan Statistik Portal Publik ──────────────────────────────────
  app.get('/api/portal/ringkasan', async (_, res) => {
    try {
      const [
        totalDataset,
        totalOpd,
        totalTopik,
        totalUrusan,
        terbaru,
        populer,
      ] = await Promise.all([
        queryDB(`SELECT COUNT(*)::int AS count FROM bank_dataset WHERE status = 'disetujui' AND klasifikasi = 'terbuka'`),
        queryDB(`SELECT COUNT(DISTINCT opd_id)::int AS count FROM bank_dataset WHERE status = 'disetujui' AND klasifikasi = 'terbuka'`),
        queryDB(`SELECT COUNT(*)::int AS count FROM sd_topik`),
        queryDB(`SELECT COUNT(*)::int AS count FROM sd_urusan`),
        queryDB(`
          SELECT d.id, d.nama, d.deskripsi, d.satuan, d.frekuensi, d.tahun_mulai,
                 o.nama AS opd_nama, o.singkatan AS opd_singkatan,
                 t.nama_topik, u.nama_urusan, d.verified_at
            FROM bank_dataset d
            JOIN bank_data_opd o ON o.id = d.opd_id
            LEFT JOIN sd_topik t ON t.id = d.topik_id
            LEFT JOIN sd_urusan u ON u.id = d.urusan_id
           WHERE d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
           ORDER BY d.verified_at DESC NULLS LAST, d.id DESC
           LIMIT 6
        `),
        queryDB(`
          SELECT d.id, d.nama, d.deskripsi, d.satuan, d.frekuensi,
                 o.nama AS opd_nama, o.singkatan AS opd_singkatan,
                 COALESCE(s.view_count, 0) AS view_count,
                 COALESCE(s.download_count, 0) AS download_count
            FROM bank_dataset d
            JOIN bank_data_opd o ON o.id = d.opd_id
            LEFT JOIN sd_dataset_stat s ON s.dataset_id = d.id
           WHERE d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
           ORDER BY COALESCE(s.view_count, 0) DESC, d.id DESC
           LIMIT 6
        `),
      ]);

      res.json({
        total_dataset: totalDataset[0]?.count || 0,
        total_opd: totalOpd[0]?.count || 0,
        total_topik: totalTopik[0]?.count || 0,
        total_urusan: totalUrusan[0]?.count || 0,
        terbaru,
        populer,
      });
    } catch (err) {
      console.error('Portal ringkasan error:', err);
      res.status(500).json({ error: 'Gagal mengambil statistik portal' });
    }
  });

  // ── 2. Katalog Dataset Publik (dengan filter & pencarian) ─────────────────
  app.get('/api/portal/dataset', async (req, res) => {
    const { q, opd_id, topik_id, urusan_id, bidang_urusan_id, tahun, sort = 'terbaru', page = 1, limit = 12 } = req.query;

    try {
      const conditions = ["d.status = 'disetujui'", "d.klasifikasi = 'terbuka'"];
      const params = [];
      let idx = 1;

      if (q && q.trim()) {
        conditions.push(`(
          d.nama ILIKE $${idx} OR
          d.deskripsi ILIKE $${idx} OR
          d.definisi ILIKE $${idx} OR
          o.nama ILIKE $${idx} OR
          o.singkatan ILIKE $${idx} OR
          t.nama_topik ILIKE $${idx}
        )`);
        params.push(`%${q.trim()}%`);
        idx++;
      }

      if (opd_id) {
        conditions.push(`d.opd_id = $${idx}`);
        params.push(opd_id);
        idx++;
      }

      if (topik_id) {
        conditions.push(`d.topik_id = $${idx}`);
        params.push(topik_id);
        idx++;
      }

      if (urusan_id) {
        conditions.push(`d.urusan_id = $${idx}`);
        params.push(urusan_id);
        idx++;
      }

      if (bidang_urusan_id) {
        conditions.push(`d.bidang_urusan_id = $${idx}`);
        params.push(bidang_urusan_id);
        idx++;
      }

      if (tahun) {
        conditions.push(`EXISTS (SELECT 1 FROM bank_dataset_row r WHERE r.dataset_id = d.id AND r.tahun = $${idx})`);
        params.push(parseInt(tahun, 10));
        idx++;
      }

      let orderClause = 'ORDER BY d.verified_at DESC NULLS LAST, d.id DESC';
      if (sort === 'populer') {
        orderClause = 'ORDER BY COALESCE(s.view_count, 0) DESC, d.id DESC';
      } else if (sort === 'nama-asc') {
        orderClause = 'ORDER BY d.nama ASC';
      } else if (sort === 'nama-desc') {
        orderClause = 'ORDER BY d.nama DESC';
      } else if (sort === 'terlama') {
        orderClause = 'ORDER BY d.verified_at ASC NULLS LAST, d.id ASC';
      }

      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const limitVal = parseInt(limit, 10);

      const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countSql = `
        SELECT COUNT(*)::int AS total
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
          LEFT JOIN sd_topik t ON t.id = d.topik_id
          LEFT JOIN sd_urusan u ON u.id = d.urusan_id
          LEFT JOIN sd_dataset_stat s ON s.dataset_id = d.id
        ${whereStr}
      `;
      const countRes = await pool.query(countSql, params);
      const total = countRes.rows[0]?.total || 0;

      const dataSql = `
        SELECT d.id, d.nama, d.deskripsi, d.definisi, d.satuan, d.sumber_data,
               d.frekuensi, d.tahun_mulai, d.verified_at, d.updated_at,
               o.id AS opd_id, o.nama AS opd_nama, o.singkatan AS opd_singkatan,
               t.id AS topik_id, t.nama_topik,
               u.id AS urusan_id, u.nama_urusan,
               bu.id AS bidang_urusan_id, bu.nama_bidang,
               COALESCE(s.view_count, 0) AS view_count,
               COALESCE(s.download_count, 0) AS download_count,
               (SELECT COUNT(*)::int FROM bank_dataset_row r WHERE r.dataset_id = d.id) AS jumlah_baris,
               (SELECT JSON_AGG(DISTINCT r.tahun ORDER BY r.tahun DESC) FROM bank_dataset_row r WHERE r.dataset_id = d.id) AS daftar_tahun
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
          LEFT JOIN sd_topik t ON t.id = d.topik_id
          LEFT JOIN sd_urusan u ON u.id = d.urusan_id
          LEFT JOIN sd_bidang_urusan bu ON bu.id = d.bidang_urusan_id
          LEFT JOIN sd_dataset_stat s ON s.dataset_id = d.id
        ${whereStr}
        ${orderClause}
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
      console.error('Portal dataset error:', err);
      res.status(500).json({ error: 'Gagal mencari dataset publik' });
    }
  });

  // ── 3. Detail Dataset Publik (dengan view count increment) ────────────────
  app.get('/api/portal/dataset/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const dsRows = await queryDB(`
        SELECT d.*,
               o.nama AS opd_nama, o.singkatan AS opd_singkatan, o.keterangan AS opd_keterangan,
               o.kontak_nama, o.kontak_email, o.kontak_telepon, o.alamat AS opd_alamat,
               t.nama_topik, st.nama_sub_topik,
               u.kode_urusan, u.nama_urusan,
               bu.kode_bidang, bu.nama_bidang,
               s.nama_satuan,
               COALESCE(stat.view_count, 0) AS view_count,
               COALESCE(stat.download_count, 0) AS download_count
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
          LEFT JOIN sd_topik t ON t.id = d.topik_id
          LEFT JOIN sd_sub_topik st ON st.id = d.sub_topik_id
          LEFT JOIN sd_urusan u ON u.id = d.urusan_id
          LEFT JOIN sd_bidang_urusan bu ON bu.id = d.bidang_urusan_id
          LEFT JOIN sd_satuan s ON s.id = d.satuan_id
          LEFT JOIN sd_dataset_stat stat ON stat.dataset_id = d.id
         WHERE d.id = $1 AND d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
      `, [id]);

      if (!dsRows.length) {
        return res.status(404).json({ error: 'Dataset publik tidak ditemukan' });
      }

      // Increment view count secara asinkron
      pool.query(`
        INSERT INTO sd_dataset_stat (dataset_id, view_count, last_viewed)
        VALUES ($1, 1, NOW())
        ON CONFLICT (dataset_id)
        DO UPDATE SET view_count = sd_dataset_stat.view_count + 1, last_viewed = NOW()
      `, [id]).catch(() => {});

      const [fields, rows, lampirans] = await Promise.all([
        queryDB(`SELECT id, dataset_id, nama_field, label, tipe_data, wajib, urutan, pilihan, tampil_grafik
                   FROM bank_dataset_field
                  WHERE dataset_id = $1
                  ORDER BY urutan, id`, [id]),
        queryDB(`SELECT r.id, r.dataset_id, r.tahun, r.periode, r.wilayah_kode, r.data,
                        w.nama_wilayah
                   FROM bank_dataset_row r
                   LEFT JOIN sd_wilayah w ON w.kode_wilayah = r.wilayah_kode
                  WHERE r.dataset_id = $1
                  ORDER BY r.tahun DESC, r.periode, r.wilayah_kode, r.id`, [id]),
        queryDB(`SELECT id, nama_file, nama_asli, url_file, mime_type, ukuran_bytes, keterangan, created_at
                   FROM bank_dataset_lampiran
                  WHERE dataset_id = $1
                  ORDER BY id DESC`, [id]).catch(() => []),
      ]);

      res.json({
        ...dsRows[0],
        fields,
        rows,
        lampirans,
      });
    } catch (err) {
      console.error('Portal dataset detail error:', err);
      res.status(500).json({ error: 'Gagal mengambil detail dataset' });
    }
  });

  // ── 4. Data Peta Per-Dataset ──────────────────────────────────────────────
  app.get('/api/portal/dataset/:id/peta', async (req, res) => {
    const { id } = req.params;
    const { tahun, field } = req.query;

    try {
      const rows = await queryDB(`
        SELECT r.wilayah_kode, w.nama_wilayah, w.tingkat, r.tahun, r.data
          FROM bank_dataset_row r
          LEFT JOIN sd_wilayah w ON w.kode_wilayah = r.wilayah_kode
         WHERE r.dataset_id = $1
           AND r.wilayah_kode IS NOT NULL
           AND r.wilayah_kode != ''
         ORDER BY r.tahun DESC, r.wilayah_kode
      `, [id]);

      // Filter per tahun jika dipilih
      const filtered = tahun ? rows.filter(r => String(r.tahun) === String(tahun)) : rows;

      res.json({
        dataset_id: id,
        tahun: tahun || (rows[0]?.tahun ?? null),
        data_wilayah: filtered.map(r => ({
          kode_wilayah: r.wilayah_kode,
          nama_wilayah: r.nama_wilayah || r.wilayah_kode,
          tingkat: r.tingkat || 'Kecamatan',
          nilai: field && r.data ? r.data[field] : r.data,
          raw_data: r.data,
        })),
      });
    } catch (err) {
      console.error('Portal map data error:', err);
      res.status(500).json({ error: 'Gagal memuat data peta dataset' });
    }
  });

  // ── 5. Unduh Dataset Publik (Excel, JSON, CSV) ───────────────────────────
  app.get('/api/portal/dataset/:id/unduh/:format', async (req, res) => {
    const { id, format } = req.params;

    try {
      const dsRows = await queryDB(`
        SELECT d.*, o.nama AS opd_nama
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
         WHERE d.id = $1 AND d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
      `, [id]);

      if (!dsRows.length) {
        return res.status(404).json({ error: 'Dataset tidak ditemukan' });
      }

      const ds = dsRows[0];
      const [fields, rows] = await Promise.all([
        queryDB(`SELECT nama_field, label, tipe_data FROM bank_dataset_field WHERE dataset_id = $1 ORDER BY urutan, id`, [id]),
        queryDB(`SELECT r.tahun, r.periode, r.wilayah_kode, w.nama_wilayah, r.data
                   FROM bank_dataset_row r
                   LEFT JOIN sd_wilayah w ON w.kode_wilayah = r.wilayah_kode
                  WHERE r.dataset_id = $1
                  ORDER BY r.tahun DESC, r.id`, [id]),
      ]);

      // Catat penambahan download count
      pool.query(`
        INSERT INTO sd_dataset_stat (dataset_id, download_count)
        VALUES ($1, 1)
        ON CONFLICT (dataset_id)
        DO UPDATE SET download_count = sd_dataset_stat.download_count + 1
      `, [id]).catch(() => {});

      const safeName = (ds.nama || 'dataset').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`);
        return res.json({
          metadata: {
            id: ds.id,
            nama: ds.nama,
            opd: ds.opd_nama,
            satuan: ds.satuan,
            frekuensi: ds.frekuensi,
            definisi: ds.definisi,
            sumber_data: ds.sumber_data,
            diexport_pada: new Date().toISOString(),
          },
          fields,
          data: rows.map(r => ({
            tahun: r.tahun,
            periode: r.periode,
            kode_wilayah: r.wilayah_kode,
            nama_wilayah: r.nama_wilayah,
            ...(r.data || {}),
          })),
        });
      }

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
        
        const headers = ['tahun', 'periode', 'kode_wilayah', 'nama_wilayah', ...fields.map(f => f.nama_field)];
        const labels = ['Tahun', 'Periode', 'Kode Wilayah', 'Nama Wilayah', ...fields.map(f => f.label || f.nama_field)];
        
        let csvContent = '\uFEFF' + labels.map(l => `"${String(l).replace(/"/g, '""')}"`).join(',') + '\n';
        
        for (const r of rows) {
          const line = [
            r.tahun ?? '',
            r.periode ?? '',
            r.wilayah_kode ?? '',
            r.nama_wilayah ?? '',
            ...fields.map(f => (r.data ? (r.data[f.nama_field] ?? '') : '')),
          ];
          csvContent += line.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
        }
        return res.send(csvContent);
      }

      // Format Excel diproses di frontend via SheetJS / xlsx atau fallback JSON
      res.json({
        metadata: ds,
        fields,
        rows: rows.map(r => ({
          tahun: r.tahun,
          periode: r.periode,
          wilayah_kode: r.wilayah_kode,
          nama_wilayah: r.nama_wilayah,
          ...(r.data || {}),
        })),
      });
    } catch (err) {
      console.error('Portal download dataset error:', err);
      res.status(500).json({ error: 'Gagal mengunduh dataset' });
    }
  });

  // ── 6. Bandingkan Indikator Publik ────────────────────────────────────────
  app.get('/api/portal/bandingkan/indikator', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT d.id, d.nama, d.satuan, o.nama AS opd_nama,
               (SELECT JSON_AGG(JSON_BUILD_OBJECT('nama', f.nama_field, 'label', f.label, 'tipe', f.tipe_data))
                  FROM bank_dataset_field f
                 WHERE f.dataset_id = d.id AND f.tipe_data IN ('angka', 'desimal')) AS numeric_fields,
               (SELECT JSON_AGG(DISTINCT r.tahun ORDER BY r.tahun)
                  FROM bank_dataset_row r
                 WHERE r.dataset_id = d.id) AS years
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
         WHERE d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
         ORDER BY d.nama
      `);
      res.json(rows.filter(r => r.numeric_fields && r.numeric_fields.length > 0));
    } catch (err) {
      console.error('Get indikator bandingkan error:', err);
      res.status(500).json({ error: 'Gagal mengambil daftar indikator' });
    }
  });

  app.post('/api/portal/bandingkan', async (req, res) => {
    const { items = [] } = req.body; // Array of { dataset_id, field_name }
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Pilih minimal satu indikator untuk dibandingkan' });
    }

    try {
      const hasil = [];
      for (const item of items) {
        const { dataset_id, field_name } = item;
        const dsInfo = await queryDB(`
          SELECT d.id, d.nama, d.satuan, o.nama AS opd_nama, f.label AS field_label
            FROM bank_dataset d
            JOIN bank_data_opd o ON o.id = d.opd_id
            LEFT JOIN bank_dataset_field f ON f.dataset_id = d.id AND f.nama_field = $2
           WHERE d.id = $1
        `, [dataset_id, field_name]);

        if (dsInfo.length) {
          const rows = await queryDB(`
            SELECT r.tahun, r.wilayah_kode, w.nama_wilayah, r.data->>$2 AS nilai
              FROM bank_dataset_row r
              LEFT JOIN sd_wilayah w ON w.kode_wilayah = r.wilayah_kode
             WHERE r.dataset_id = $1
             ORDER BY r.tahun ASC, r.wilayah_kode
          `, [dataset_id, field_name]);

          hasil.push({
            dataset: dsInfo[0],
            series: rows.map(r => ({
              tahun: r.tahun,
              wilayah: r.nama_wilayah || r.wilayah_kode || 'Total',
              nilai: parseFloat(r.nilai) || 0,
            })),
          });
        }
      }

      res.json(hasil);
    } catch (err) {
      console.error('Bandingkan indikator post error:', err);
      res.status(500).json({ error: 'Gagal membandingkan indikator' });
    }
  });

  // ── 7. Jelajah per Kategori / Urusan ──────────────────────────────────────
  app.get('/api/portal/jelajah/urusan', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT u.id, u.kode_urusan, u.nama_urusan,
               COUNT(DISTINCT d.id)::int AS jumlah_dataset,
               JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', bu.id, 'kode', bu.kode_bidang, 'nama', bu.nama_bidang)) FILTER (WHERE bu.id IS NOT NULL) AS bidang_urusan
          FROM sd_urusan u
          LEFT JOIN sd_bidang_urusan bu ON bu.urusan_id = u.id
          LEFT JOIN bank_dataset d ON d.urusan_id = u.id AND d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
         GROUP BY u.id, u.kode_urusan, u.nama_urusan
         ORDER BY u.kode_urusan, u.id
      `);
      res.json(rows);
    } catch (err) {
      console.error('Jelajah urusan error:', err);
      res.status(500).json({ error: 'Gagal memuat kategori urusan' });
    }
  });

  // ── 8. Jelajah per Topik & Sub-Topik ──────────────────────────────────────
  app.get('/api/portal/jelajah/topik', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT t.id, t.nama_topik, COALESCE(t.ikon, 'folder') AS icon, t.urutan,
               COUNT(DISTINCT d.id)::int AS jumlah_dataset,
               JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', st.id, 'nama', st.nama_sub_topik)) FILTER (WHERE st.id IS NOT NULL) AS sub_topik
          FROM sd_topik t
          LEFT JOIN sd_sub_topik st ON st.topik_id = t.id
          LEFT JOIN bank_dataset d ON d.topik_id = t.id AND d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
         GROUP BY t.id, t.nama_topik, t.ikon, t.urutan
         ORDER BY t.urutan, t.id
      `);
      res.json(rows);
    } catch (err) {
      console.error('Jelajah topik error:', err);
      res.status(500).json({ error: 'Gagal memuat topik' });
    }
  });

  // ── 9. Jelajah per Organisasi (OPD) ───────────────────────────────────────
  app.get('/api/portal/jelajah/organisasi', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT o.id, o.nama, o.singkatan, o.keterangan, o.kontak_nama, o.kontak_email, o.kontak_telepon,
               COUNT(d.id)::int AS jumlah_dataset
          FROM bank_data_opd o
          LEFT JOIN bank_dataset d ON d.opd_id = o.id AND d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
         GROUP BY o.id, o.nama, o.singkatan, o.keterangan, o.kontak_nama, o.kontak_email, o.kontak_telepon
         ORDER BY o.nama
      `);
      res.json(rows);
    } catch (err) {
      console.error('Jelajah organisasi error:', err);
      res.status(500).json({ error: 'Gagal memuat daftar organisasi' });
    }
  });

  // ── 10. Visualisasi Interaktif & Animasi Data Makro ───────────────────────
  app.get('/api/portal/visualisasi', async (_, res) => {
    try {
      const [pertumbuhan, perTopik, perUrusan, spmCapaian] = await Promise.all([
        queryDB(`
          SELECT r.tahun, COUNT(DISTINCT r.dataset_id)::int AS dataset_count, COUNT(r.id)::int AS record_count
            FROM bank_dataset_row r
            JOIN bank_dataset d ON d.id = r.dataset_id
           WHERE d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
           GROUP BY r.tahun
           ORDER BY r.tahun ASC
        `),
        queryDB(`
          SELECT COALESCE(t.nama_topik, 'Lainnya') AS topik, COUNT(d.id)::int AS jumlah
            FROM bank_dataset d
            LEFT JOIN sd_topik t ON t.id = d.topik_id
           WHERE d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
           GROUP BY t.nama_topik
           ORDER BY jumlah DESC
        `),
        queryDB(`
          SELECT COALESCE(u.nama_urusan, 'Lainnya') AS urusan, COUNT(d.id)::int AS jumlah
            FROM bank_dataset d
            LEFT JOIN sd_urusan u ON u.id = d.urusan_id
           WHERE d.status = 'disetujui' AND d.klasifikasi = 'terbuka'
           GROUP BY u.nama_urusan
           ORDER BY jumlah DESC
           LIMIT 8
        `),
        queryDB(`
          SELECT u.nama_urusan, AVG(COALESCE(c.capaian, 0))::numeric(5,2) AS rata_capaian
            FROM sd_spm_urusan u
            JOIN sd_spm_layanan l ON l.urusan_id = u.id
            LEFT JOIN sd_spm_capaian c ON c.layanan_id = l.id
           GROUP BY u.id, u.nama_urusan
           ORDER BY u.id
        `).catch(() => []),
      ]);

      res.json({
        pertumbuhan,
        per_topik: perTopik,
        per_urusan: perUrusan,
        spm_capaian: spmCapaian,
      });
    } catch (err) {
      console.error('Portal visualisasi error:', err);
      res.status(500).json({ error: 'Gagal memuat data visualisasi' });
    }
  });

  // ── 11. Status Dataset & Jadwal Pemutakhiran ──────────────────────────────
  app.get('/api/portal/status-dataset', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT d.id, d.nama, d.status, d.frekuensi, d.jadwal_pemutakhiran, d.jadwal_pemutakhiran_akhir,
               o.nama AS opd_nama, o.singkatan AS opd_singkatan,
               d.verified_at,
               (SELECT MAX(tahun) FROM bank_dataset_row r WHERE r.dataset_id = d.id) AS tahun_terakhir
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
         WHERE d.klasifikasi = 'terbuka'
         ORDER BY o.nama, d.nama
      `);
      res.json(rows);
    } catch (err) {
      console.error('Status dataset error:', err);
      res.status(500).json({ error: 'Gagal memuat jadwal status dataset' });
    }
  });
}
