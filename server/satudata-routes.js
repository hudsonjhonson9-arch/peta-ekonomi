import crypto from 'crypto';
import os from 'os';
import { opdTerbatas, opdMilik } from './bank-dataset.js';

export function daftarkanRuteSatuData(app, pool, queryDB) {
  // Data Satu Data selalu ditarik langsung dan real-time dari PostgreSQL agar setiap perubahan langsung tampil seketika
  const sdCache = new Map();
  const getCached = () => null; // Selalu queryDB langsung ke PostgreSQL
  const setCached = () => {};
  const clearCache = () => {};

  // Helper: pastikan OPD milik operator bila role Operator Bank Data
  const pastikanOpdOperator = (req, res, targetOpdId) => {
    if (!opdTerbatas(req.pengguna)) return true;
    if (!req.pengguna?.opd_id) {
      res.status(403).json({ error: 'Akun Operator belum dipetakan ke OPD' });
      return false;
    }
    if (!opdMilik(req.pengguna, targetOpdId)) {
      res.status(403).json({ error: 'Data ini bukan milik OPD Anda' });
      return false;
    }
    return true;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. MASTER DATA SATU DATA (/api/satudata/master/...)
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/satudata/master/ringkasan', async (req, res) => {
    const cacheKey = `sd_master_${req.pengguna?.opd_id || 'all'}`;
    const cached = getCached(cacheKey, 60000);
    if (cached) return res.json(cached);

    try {
      const [
        bidangs,
        opd,
        urusan,
        bidangUrusan,
        hakAksesUrusan,
        topik,
        subTopik,
        satuan,
        daftarData,
        templateField,
        wilayah,
        reopenRequests,
        datasetCounts,
      ] = await Promise.all([
        queryDB(`SELECT id, nama_bidang AS nama FROM bidang_list WHERE instansi_id = 'bapperida' ORDER BY id`),
        queryDB(`
          SELECT o.id, o.bidang_id, o.nama, o.kode_opd, o.singkatan, o.keterangan,
                 COALESCE(o.is_active, TRUE) AS is_active, o.urutan,
                 b.nama_bidang AS bidang_nama,
                 (SELECT COUNT(*)::int FROM bank_dataset d WHERE d.opd_id = o.id) AS jumlah_dataset,
                 (SELECT COUNT(*)::int FROM bank_dataset d WHERE d.opd_id = o.id AND d.status = 'disetujui') AS dataset_disetujui
            FROM bank_data_opd o
            LEFT JOIN bidang_list b ON b.id = o.bidang_id
           ORDER BY o.bidang_id, o.urutan, o.id
        `),
        queryDB(`SELECT * FROM sd_urusan ORDER BY kode_urusan, id`),
        queryDB(`
          SELECT bu.*, u.kode_urusan, u.nama_urusan
            FROM sd_bidang_urusan bu
            JOIN sd_urusan u ON u.id = bu.urusan_id
           ORDER BY bu.kode_bidang, bu.id
        `),
        queryDB(`
          SELECT ha.*, o.nama AS opd_nama, u.kode_urusan, u.nama_urusan,
                 bu.kode_bidang, bu.nama_bidang
            FROM sd_hak_akses_urusan ha
            JOIN bank_data_opd o ON o.id = ha.opd_id
            JOIN sd_urusan u ON u.id = ha.urusan_id
            LEFT JOIN sd_bidang_urusan bu ON bu.id = ha.bidang_urusan_id
           ORDER BY o.nama, u.kode_urusan, bu.kode_bidang
        `),
        queryDB(`SELECT * FROM sd_topik ORDER BY urutan, id`),
        queryDB(`
          SELECT st.*, t.nama_topik
            FROM sd_sub_topik st
            JOIN sd_topik t ON t.id = st.topik_id
           ORDER BY t.urutan, st.urutan, st.id
        `),
        queryDB(`SELECT * FROM sd_satuan ORDER BY nama_satuan`),
        queryDB(`
          SELECT dd.*, o.nama AS opd_nama, o.kode_opd,
                 (SELECT COUNT(*)::int FROM bank_dataset d WHERE d.opd_id = dd.opd_id) AS realisasi_dataset,
                 (SELECT COUNT(*)::int FROM bank_dataset d WHERE d.opd_id = dd.opd_id AND d.status = 'disetujui') AS disetujui_dataset
            FROM sd_daftar_data dd
            JOIN bank_data_opd o ON o.id = dd.opd_id
           ORDER BY dd.tahun DESC, o.nama
        `),
        queryDB(`SELECT * FROM sd_template_field ORDER BY tipe_preset DESC, id`),
        queryDB(`SELECT * FROM sd_wilayah ORDER BY kode_wilayah`),
        queryDB(`
          SELECT r.*, d.nama AS dataset_nama, o.nama AS opd_nama
            FROM sd_reopen_request r
            JOIN bank_dataset d ON d.id = r.dataset_id
            JOIN bank_data_opd o ON o.id = r.opd_id
           ORDER BY (CASE WHEN r.status = 'menunggu' THEN 0 ELSE 1 END), r.created_at DESC
        `),
        queryDB(`SELECT id, opd_id, nama, status, frekuensi, tahun_mulai FROM bank_dataset ORDER BY nama`),
      ]);

      const filteredReopen = opdTerbatas(req.pengguna)
        ? reopenRequests.filter(r => String(r.opd_id) === String(req.pengguna?.opd_id))
        : reopenRequests;

      const resultObj = {
        bidangs,
        opd,
        urusan,
        bidang_urusan: bidangUrusan,
        hakAksesUrusan,
        hak_akses_urusan: hakAksesUrusan,
        topik,
        sub_topik: subTopik,
        satuan,
        daftar_data: daftarData,
        template_field: templateField,
        wilayah,
        reopen_requests: filteredReopen,
        datasets: opdTerbatas(req.pengguna)
          ? datasetCounts.filter(d => String(d.opd_id) === String(req.pengguna?.opd_id))
          : datasetCounts,
      };
      setCached(cacheKey, resultObj);
      res.json(resultObj);
    } catch (err) {
      console.error('Get master satudata ringkasan error:', err);
      res.status(500).json({ error: 'Gagal memuat master data Satu Data' });
    }
  });

  // ── 1A. Master OPD (Lengkap dengan kode_opd, singkatan, keterangan) ──────
  app.post('/api/satudata/master/opd', async (req, res) => {
    const { bidang_id, nama, kode_opd, singkatan, keterangan, is_active = true } = req.body;
    if (!nama || !String(nama).trim()) return res.status(400).json({ error: 'Nama OPD wajib diisi' });
    const bidId = Number(bidang_id) || 3;
    try {
      const max = await queryDB('SELECT COALESCE(MAX(urutan), 0) + 1 AS next FROM bank_data_opd WHERE bidang_id = $1', [bidId]);
      const rows = await queryDB(
        `INSERT INTO bank_data_opd (bidang_id, nama, kode_opd, singkatan, keterangan, is_active, urutan)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          bidId,
          String(nama).trim(),
          kode_opd ? String(kode_opd).trim() : null,
          singkatan ? String(singkatan).trim() : null,
          keterangan ? String(keterangan).trim() : null,
          Boolean(is_active),
          max[0].next,
        ]
      );
      res.json({ message: 'OPD berhasil ditambahkan', opd: rows[0] });
    } catch (err) {
      console.error('Post master OPD error:', err);
      res.status(500).json({ error: 'Gagal menambahkan OPD' });
    }
  });

  app.put('/api/satudata/master/opd/:id', async (req, res) => {
    const { id } = req.params;
    const { bidang_id, nama, kode_opd, singkatan, keterangan, is_active = true } = req.body;
    if (!nama || !String(nama).trim()) return res.status(400).json({ error: 'Nama OPD wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE bank_data_opd
            SET bidang_id = COALESCE($1, bidang_id),
                nama = $2,
                kode_opd = $3,
                singkatan = $4,
                keterangan = $5,
                is_active = $6
          WHERE id = $7 RETURNING *`,
        [
          bidang_id ? Number(bidang_id) : null,
          String(nama).trim(),
          kode_opd ? String(kode_opd).trim() : null,
          singkatan ? String(singkatan).trim() : null,
          keterangan ? String(keterangan).trim() : null,
          Boolean(is_active),
          id,
        ]
      );
      if (!rows.length) return res.status(404).json({ error: 'OPD tidak ditemukan' });
      res.json({ message: 'OPD berhasil diperbarui', opd: rows[0] });
    } catch (err) {
      console.error('Put master OPD error:', err);
      res.status(500).json({ error: 'Gagal memperbarui OPD' });
    }
  });

  app.delete('/api/satudata/master/opd/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM bank_data_opd WHERE id = $1', [req.params.id]);
      res.json({ message: 'OPD berhasil dihapus' });
    } catch (err) {
      console.error('Delete master OPD error:', err);
      res.status(500).json({ error: 'Gagal menghapus OPD' });
    }
  });

  // ── 1B. Master Urusan ────────────────────────────────────────────────────
  app.post('/api/satudata/master/urusan', async (req, res) => {
    const { kode_urusan, nama_urusan, keterangan } = req.body;
    if (!kode_urusan || !nama_urusan) return res.status(400).json({ error: 'Kode dan nama urusan wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_urusan (kode_urusan, nama_urusan, keterangan)
         VALUES ($1, $2, $3) RETURNING *`,
        [String(kode_urusan).trim(), String(nama_urusan).trim(), keterangan ? String(keterangan).trim() : null]
      );
      res.json({ message: 'Urusan berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Kode urusan sudah terdaftar' : 'Gagal menambahkan urusan' });
    }
  });

  app.put('/api/satudata/master/urusan/:id', async (req, res) => {
    const { kode_urusan, nama_urusan, keterangan } = req.body;
    if (!kode_urusan || !nama_urusan) return res.status(400).json({ error: 'Kode dan nama urusan wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_urusan SET kode_urusan = $1, nama_urusan = $2, keterangan = $3 WHERE id = $4 RETURNING *`,
        [String(kode_urusan).trim(), String(nama_urusan).trim(), keterangan ? String(keterangan).trim() : null, req.params.id]
      );
      res.json({ message: 'Urusan berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui urusan' });
    }
  });

  app.delete('/api/satudata/master/urusan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_urusan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Urusan berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus urusan' });
    }
  });

  // ── 1C. Master Bidang Urusan ─────────────────────────────────────────────
  app.post('/api/satudata/master/bidang-urusan', async (req, res) => {
    const { urusan_id, kode_bidang, nama_bidang, keterangan } = req.body;
    if (!urusan_id || !kode_bidang || !nama_bidang) {
      return res.status(400).json({ error: 'Urusan, kode bidang, dan nama bidang wajib diisi' });
    }
    try {
      const rows = await queryDB(
        `INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang, keterangan)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [Number(urusan_id), String(kode_bidang).trim(), String(nama_bidang).trim(), keterangan ? String(keterangan).trim() : null]
      );
      res.json({ message: 'Bidang urusan berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Kode bidang urusan sudah ada' : 'Gagal menambahkan bidang urusan' });
    }
  });

  app.put('/api/satudata/master/bidang-urusan/:id', async (req, res) => {
    const { urusan_id, kode_bidang, nama_bidang, keterangan } = req.body;
    if (!urusan_id || !kode_bidang || !nama_bidang) {
      return res.status(400).json({ error: 'Urusan, kode bidang, dan nama bidang wajib diisi' });
    }
    try {
      const rows = await queryDB(
        `UPDATE sd_bidang_urusan
            SET urusan_id = $1, kode_bidang = $2, nama_bidang = $3, keterangan = $4
          WHERE id = $5 RETURNING *`,
        [Number(urusan_id), String(kode_bidang).trim(), String(nama_bidang).trim(), keterangan ? String(keterangan).trim() : null, req.params.id]
      );
      res.json({ message: 'Bidang urusan berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui bidang urusan' });
    }
  });

  app.delete('/api/satudata/master/bidang-urusan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_bidang_urusan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Bidang urusan berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus bidang urusan' });
    }
  });

  // ── 1D. Hak Akses Urusan per OPD ─────────────────────────────────────────
  app.post('/api/satudata/master/hak-akses-urusan', async (req, res) => {
    const { opd_id, urusan_id, bidang_urusan_id, keterangan } = req.body;
    if (!opd_id || !urusan_id) return res.status(400).json({ error: 'OPD dan Urusan wajib dipilih' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_hak_akses_urusan (opd_id, urusan_id, bidang_urusan_id, keterangan)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (opd_id, urusan_id, COALESCE(bidang_urusan_id, 0)) DO UPDATE
         SET keterangan = EXCLUDED.keterangan
         RETURNING *`,
        [Number(opd_id), Number(urusan_id), bidang_urusan_id ? Number(bidang_urusan_id) : null, keterangan || null]
      );
      res.json({ message: 'Hak akses urusan berhasil disimpan', row: rows[0] });
    } catch (err) {
      console.error('Post hak akses urusan error:', err);
      res.status(500).json({ error: 'Gagal menyimpan hak akses urusan' });
    }
  });

  app.delete('/api/satudata/master/hak-akses-urusan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_hak_akses_urusan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Hak akses urusan berhasil dicabut' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus hak akses urusan' });
    }
  });

  // ── 1E. Master Topik & Sub Topik ─────────────────────────────────────────
  const buatSlug = (teks) => String(teks || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  app.post('/api/satudata/master/topik', async (req, res) => {
    const { nama_topik, slug, ikon = 'layers', deskripsi, urutan = 1, is_active = true } = req.body;
    if (!nama_topik) return res.status(400).json({ error: 'Nama topik wajib diisi' });
    const finalSlug = slug ? buatSlug(slug) : buatSlug(nama_topik);
    try {
      const rows = await queryDB(
        `INSERT INTO sd_topik (nama_topik, slug, ikon, deskripsi, urutan, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [String(nama_topik).trim(), finalSlug, ikon, deskripsi || null, Number(urutan) || 1, Boolean(is_active)]
      );
      res.json({ message: 'Topik berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Topik dengan slug tersebut sudah ada' : 'Gagal menambahkan topik' });
    }
  });

  app.put('/api/satudata/master/topik/:id', async (req, res) => {
    const { nama_topik, slug, ikon = 'layers', deskripsi, urutan = 1, is_active = true } = req.body;
    if (!nama_topik) return res.status(400).json({ error: 'Nama topik wajib diisi' });
    const finalSlug = slug ? buatSlug(slug) : buatSlug(nama_topik);
    try {
      const rows = await queryDB(
        `UPDATE sd_topik
            SET nama_topik = $1, slug = $2, ikon = $3, deskripsi = $4, urutan = $5, is_active = $6
          WHERE id = $7 RETURNING *`,
        [String(nama_topik).trim(), finalSlug, ikon, deskripsi || null, Number(urutan) || 1, Boolean(is_active), req.params.id]
      );
      res.json({ message: 'Topik berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui topik' });
    }
  });

  app.delete('/api/satudata/master/topik/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_topik WHERE id = $1', [req.params.id]);
      res.json({ message: 'Topik berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus topik' });
    }
  });

  app.post('/api/satudata/master/sub-topik', async (req, res) => {
    const { topik_id, nama_sub_topik, slug, deskripsi, urutan = 1, is_active = true } = req.body;
    if (!topik_id || !nama_sub_topik) return res.status(400).json({ error: 'Topik induk dan nama sub topik wajib diisi' });
    const finalSlug = slug ? buatSlug(slug) : buatSlug(nama_sub_topik);
    try {
      const rows = await queryDB(
        `INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [Number(topik_id), String(nama_sub_topik).trim(), finalSlug, deskripsi || null, Number(urutan) || 1, Boolean(is_active)]
      );
      res.json({ message: 'Sub topik berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Sub topik sudah ada pada topik ini' : 'Gagal menambahkan sub topik' });
    }
  });

  app.put('/api/satudata/master/sub-topik/:id', async (req, res) => {
    const { topik_id, nama_sub_topik, slug, deskripsi, urutan = 1, is_active = true } = req.body;
    if (!topik_id || !nama_sub_topik) return res.status(400).json({ error: 'Topik induk dan nama sub topik wajib diisi' });
    const finalSlug = slug ? buatSlug(slug) : buatSlug(nama_sub_topik);
    try {
      const rows = await queryDB(
        `UPDATE sd_sub_topik
            SET topik_id = $1, nama_sub_topik = $2, slug = $3, deskripsi = $4, urutan = $5, is_active = $6
          WHERE id = $7 RETURNING *`,
        [Number(topik_id), String(nama_sub_topik).trim(), finalSlug, deskripsi || null, Number(urutan) || 1, Boolean(is_active), req.params.id]
      );
      res.json({ message: 'Sub topik berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui sub topik' });
    }
  });

  app.delete('/api/satudata/master/sub-topik/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_sub_topik WHERE id = $1', [req.params.id]);
      res.json({ message: 'Sub topik berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus sub topik' });
    }
  });

  // ── 1F. Master Satuan ────────────────────────────────────────────────────
  app.post('/api/satudata/master/satuan', async (req, res) => {
    const { nama_satuan, simbol, keterangan } = req.body;
    if (!nama_satuan) return res.status(400).json({ error: 'Nama satuan wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_satuan (nama_satuan, simbol, keterangan) VALUES ($1, $2, $3) RETURNING *`,
        [String(nama_satuan).trim(), simbol ? String(simbol).trim() : null, keterangan ? String(keterangan).trim() : null]
      );
      res.json({ message: 'Satuan berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Satuan sudah terdaftar' : 'Gagal menambahkan satuan' });
    }
  });

  app.put('/api/satudata/master/satuan/:id', async (req, res) => {
    const { nama_satuan, simbol, keterangan } = req.body;
    if (!nama_satuan) return res.status(400).json({ error: 'Nama satuan wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_satuan SET nama_satuan = $1, simbol = $2, keterangan = $3 WHERE id = $4 RETURNING *`,
        [String(nama_satuan).trim(), simbol ? String(simbol).trim() : null, keterangan ? String(keterangan).trim() : null, req.params.id]
      );
      res.json({ message: 'Satuan berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui satuan' });
    }
  });

  app.delete('/api/satudata/master/satuan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_satuan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Satuan berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus satuan' });
    }
  });

  // ── 1G. Daftar Data (Target SK per OPD & Tahun) ──────────────────────────
  app.post('/api/satudata/master/daftar-data', async (req, res) => {
    const { opd_id, tahun = 2025, jumlah_target_sk = 0, nomor_sk, keterangan } = req.body;
    if (!opd_id) return res.status(400).json({ error: 'OPD wajib dipilih' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_daftar_data (opd_id, tahun, jumlah_target_sk, nomor_sk, keterangan, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (opd_id, tahun) DO UPDATE
            SET jumlah_target_sk = EXCLUDED.jumlah_target_sk,
                nomor_sk = EXCLUDED.nomor_sk,
                keterangan = EXCLUDED.keterangan,
                updated_at = NOW()
         RETURNING *`,
        [Number(opd_id), Number(tahun) || 2025, Math.max(0, Number(jumlah_target_sk) || 0), nomor_sk || null, keterangan || null]
      );
      res.json({ message: 'Target Daftar Data SK berhasil disimpan', row: rows[0] });
    } catch (err) {
      console.error('Post daftar data error:', err);
      res.status(500).json({ error: 'Gagal menyimpan Daftar Data SK' });
    }
  });

  app.delete('/api/satudata/master/daftar-data/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_daftar_data WHERE id = $1', [req.params.id]);
      res.json({ message: 'Target Daftar Data berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus Daftar Data' });
    }
  });

  // ── 1H. Template Field & Grup Field ──────────────────────────────────────
  app.post('/api/satudata/master/template-field', async (req, res) => {
    const { kode, nama_template, tipe_preset = 'grup', deskripsi, fields_json = [] } = req.body;
    if (!nama_template) return res.status(400).json({ error: 'Nama template wajib diisi' });
    const finalKode = kode ? buatSlug(kode).replace(/-/g, '_') : `${tipe_preset}_${buatSlug(nama_template).replace(/-/g, '_')}`;
    try {
      const rows = await queryDB(
        `INSERT INTO sd_template_field (kode, nama_template, tipe_preset, deskripsi, fields_json)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
        [finalKode, String(nama_template).trim(), tipe_preset === 'field' ? 'field' : 'grup', deskripsi || null, JSON.stringify(fields_json || [])]
      );
      res.json({ message: 'Template field berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Kode template sudah ada' : 'Gagal menambahkan template field' });
    }
  });

  app.put('/api/satudata/master/template-field/:id', async (req, res) => {
    const { nama_template, tipe_preset = 'grup', deskripsi, fields_json = [] } = req.body;
    if (!nama_template) return res.status(400).json({ error: 'Nama template wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_template_field
            SET nama_template = $1, tipe_preset = $2, deskripsi = $3, fields_json = $4::jsonb
          WHERE id = $5 RETURNING *`,
        [String(nama_template).trim(), tipe_preset === 'field' ? 'field' : 'grup', deskripsi || null, JSON.stringify(fields_json || []), req.params.id]
      );
      res.json({ message: 'Template field berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui template field' });
    }
  });

  app.delete('/api/satudata/master/template-field/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_template_field WHERE id = $1', [req.params.id]);
      res.json({ message: 'Template field berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus template field' });
    }
  });

  // ── 1I. Master Wilayah ───────────────────────────────────────────────────
  app.post('/api/satudata/master/wilayah', async (req, res) => {
    const { kode_wilayah, nama_wilayah, tingkat = 'Kecamatan', induk_kode, luas_km2, jumlah_penduduk } = req.body;
    if (!kode_wilayah || !nama_wilayah) return res.status(400).json({ error: 'Kode dan nama wilayah wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_wilayah (kode_wilayah, nama_wilayah, tingkat, induk_kode, luas_km2, jumlah_penduduk)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          String(kode_wilayah).trim(),
          String(nama_wilayah).trim(),
          tingkat,
          induk_kode ? String(induk_kode).trim() : null,
          luas_km2 !== '' && luas_km2 != null ? Number(luas_km2) : null,
          jumlah_penduduk !== '' && jumlah_penduduk != null ? Number(jumlah_penduduk) : null,
        ]
      );
      res.json({ message: 'Wilayah berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Kode wilayah sudah terdaftar' : 'Gagal menambahkan wilayah' });
    }
  });

  app.put('/api/satudata/master/wilayah/:id', async (req, res) => {
    const { kode_wilayah, nama_wilayah, tingkat = 'Kecamatan', induk_kode, luas_km2, jumlah_penduduk } = req.body;
    if (!kode_wilayah || !nama_wilayah) return res.status(400).json({ error: 'Kode dan nama wilayah wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_wilayah
            SET kode_wilayah = $1, nama_wilayah = $2, tingkat = $3, induk_kode = $4, luas_km2 = $5, jumlah_penduduk = $6
          WHERE id = $7 RETURNING *`,
        [
          String(kode_wilayah).trim(),
          String(nama_wilayah).trim(),
          tingkat,
          induk_kode ? String(induk_kode).trim() : null,
          luas_km2 !== '' && luas_km2 != null ? Number(luas_km2) : null,
          jumlah_penduduk !== '' && jumlah_penduduk != null ? Number(jumlah_penduduk) : null,
          req.params.id,
        ]
      );
      res.json({ message: 'Wilayah berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui wilayah' });
    }
  });

  app.delete('/api/satudata/master/wilayah/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_wilayah WHERE id = $1', [req.params.id]);
      res.json({ message: 'Wilayah berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus wilayah' });
    }
  });

  // ── 1J. Permintaan Reopen (Buka Gerbang Pemutakhiran) ────────────────────
  app.post('/api/satudata/reopen', async (req, res) => {
    const { dataset_id, periode_tahun, alasan } = req.body;
    if (!dataset_id || !periode_tahun || !alasan || !String(alasan).trim()) {
      return res.status(400).json({ error: 'Dataset, periode tahun, dan alasan wajib diisi' });
    }
    try {
      const ds = await queryDB('SELECT id, opd_id, nama FROM bank_dataset WHERE id = $1', [dataset_id]);
      if (!ds.length) return res.status(404).json({ error: 'Dataset tidak ditemukan' });
      if (!pastikanOpdOperator(req, res, ds[0].opd_id)) return;

      const existing = await queryDB(
        `SELECT id FROM sd_reopen_request WHERE dataset_id = $1 AND periode_tahun = $2 AND status = 'menunggu'`,
        [dataset_id, Number(periode_tahun)]
      );
      if (existing.length) {
        return res.status(409).json({ error: 'Permintaan reopen untuk periode ini sedang menunggu persetujuan' });
      }

      const aktor = req.pengguna?.nama || req.pengguna?.name || req.pengguna?.nip || 'Operator OPD';
      const rows = await queryDB(
        `INSERT INTO sd_reopen_request (dataset_id, opd_id, periode_tahun, alasan, status, diajukan_oleh)
         VALUES ($1, $2, $3, $4, 'menunggu', $5) RETURNING *`,
        [dataset_id, ds[0].opd_id, Number(periode_tahun), String(alasan).trim(), aktor]
      );
      res.json({ message: 'Permintaan buka kembali (reopen) berhasil diajukan', row: rows[0] });
    } catch (err) {
      console.error('Post reopen error:', err);
      res.status(500).json({ error: 'Gagal mengajukan permintaan reopen' });
    }
  });

  app.post('/api/satudata/reopen/:id/putuskan', async (req, res) => {
    const { status, batas_waktu, catatan_admin } = req.body;
    if (!['disetujui', 'ditolak'].includes(status)) {
      return res.status(400).json({ error: 'Keputusan harus disetujui atau ditolak' });
    }
    if (status === 'disetujui' && !batas_waktu) {
      return res.status(400).json({ error: 'Batas waktu pemutakhiran wajib diisi saat menyetujui reopen' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query('SELECT * FROM sd_reopen_request WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!cur.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Permintaan reopen tidak ditemukan' });
      }
      const reqRow = cur.rows[0];
      const aktor = req.pengguna?.nama || req.pengguna?.name || req.pengguna?.nip || 'Admin';

      const upd = await client.query(
        `UPDATE sd_reopen_request
            SET status = $1, batas_waktu = $2, catatan_admin = $3, diputuskan_oleh = $4, decided_at = NOW()
          WHERE id = $5 RETURNING *`,
        [status, status === 'disetujui' ? batas_waktu : null, catatan_admin || null, aktor, req.params.id]
      );

      if (status === 'disetujui') {
        await client.query(
          `UPDATE bank_dataset
              SET status = 'perlu_perbaikan',
                  reopen_until = $1,
                  catatan_verifikasi = $2,
                  updated_at = NOW()
            WHERE id = $3`,
          [batas_waktu, `Reopen disetujui hingga ${batas_waktu}. ${catatan_admin || ''}`.trim(), reqRow.dataset_id]
        );
        await client.query(
          `INSERT INTO bank_dataset_log (dataset_id, aksi, aktor, catatan)
           VALUES ($1, 'reopen', $2, $3)`,
          [reqRow.dataset_id, aktor, `Gerbang pemutakhiran dibuka kembali hingga ${batas_waktu}`]
        );
      }

      await client.query('COMMIT');
      res.json({
        message: status === 'disetujui'
          ? `Permintaan Reopen disetujui hingga ${batas_waktu}`
          : 'Permintaan Reopen ditolak',
        row: upd.rows[0],
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Putuskan reopen error:', err);
      res.status(500).json({ error: 'Gagal memproses keputusan reopen' });
    } finally {
      client.release();
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. STANDAR PELAYANAN MINIMAL / SPM (/api/spm/... & /api/publik/spm)
  // ══════════════════════════════════════════════════════════════════════════

  const ambilDataSpm = async () => {
    const [urusan, layanan, capaian, dokumen, kecamatan] = await Promise.all([
      queryDB(`SELECT * FROM sd_spm_urusan ORDER BY urutan, kode`),
      queryDB(`
        SELECT l.*, u.kode AS kode_urusan, u.nama AS nama_urusan, u.warna
          FROM sd_spm_layanan l
          JOIN sd_spm_urusan u ON u.id = l.spm_urusan_id
         ORDER BY u.urutan, l.urutan, l.id
      `),
      queryDB(`
        SELECT c.*, l.nama_layanan, l.kode_layanan, l.spm_urusan_id,
               u.kode AS kode_urusan, u.nama AS nama_urusan, u.warna
          FROM sd_spm_capaian c
          JOIN sd_spm_layanan l ON l.id = c.layanan_id
          JOIN sd_spm_urusan u ON u.id = l.spm_urusan_id
         ORDER BY c.tahun DESC, u.urutan, l.urutan, c.wilayah_kode
      `),
      queryDB(`
        SELECT d.*,
               COALESCE(d.file_url, a.url) AS file_url,
               a.id AS arsip_id, a.judul AS arsip_judul, a.nomor_dokumen AS arsip_nomor, a.url AS arsip_url
          FROM sd_spm_dokumen d
          LEFT JOIN bapperida_dokumen a ON a.id = d.dokumen_arsip_id
         ORDER BY d.tahun DESC, d.created_at DESC
      `),
      queryDB(`
        SELECT kode_wilayah, nama_wilayah, tingkat, luas_km2, jumlah_penduduk
          FROM sd_wilayah
         WHERE kode_wilayah = '53.12' OR kode_wilayah IN ('53.12.04', '53.12.10', '53.12.11', '53.12.12', '53.12.15', '53.12.18')
         ORDER BY kode_wilayah
      `),
    ]);
    return { urusan, layanan, capaian, dokumen, wilayah: kecamatan };
  };

  app.get('/api/spm', async (_, res) => {
    try {
      const cached = getCached('sd_spm', 60000);
      if (cached) return res.json(cached);
      const data = await ambilDataSpm();
      setCached('sd_spm', data);
      res.json(data);
    } catch (err) {
      console.error('Get SPM error:', err);
      res.status(500).json({ error: 'Gagal memuat data SPM' });
    }
  });

  app.get('/api/publik/spm', async (_, res) => {
    try {
      const cached = getCached('sd_spm', 60000);
      if (cached) return res.json(cached);
      const data = await ambilDataSpm();
      setCached('sd_spm', data);
      res.json(data);
    } catch (err) {
      console.error('Get publik SPM error:', err);
      res.status(500).json({ error: 'Gagal memuat data SPM publik' });
    }
  });

  app.post('/api/spm/urusan', async (req, res) => {
    const { kode, nama, ikon = 'checkCircle', warna = '#2563EB', urutan = 1 } = req.body;
    if (!kode || !nama) return res.status(400).json({ error: 'Kode dan nama urusan SPM wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_spm_urusan (kode, nama, ikon, warna, urutan) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [String(kode).trim(), String(nama).trim(), ikon, warna, Number(urutan) || 1]
      );
      res.json({ message: 'Urusan SPM berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal menambahkan urusan SPM' });
    }
  });

  app.put('/api/spm/urusan/:id', async (req, res) => {
    const { kode, nama, ikon = 'checkCircle', warna = '#2563EB', urutan = 1, is_active = true } = req.body;
    if (!kode || !nama) return res.status(400).json({ error: 'Kode dan nama urusan SPM wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_spm_urusan SET kode = $1, nama = $2, ikon = $3, warna = $4, urutan = $5, is_active = $6 WHERE id = $7 RETURNING *`,
        [String(kode).trim(), String(nama).trim(), ikon, warna, Number(urutan) || 1, Boolean(is_active), req.params.id]
      );
      res.json({ message: 'Urusan SPM berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui urusan SPM' });
    }
  });

  app.delete('/api/spm/urusan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_spm_urusan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Urusan SPM berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus urusan SPM' });
    }
  });

  app.post('/api/spm/layanan', async (req, res) => {
    const { spm_urusan_id, kode_layanan, nama_layanan, satuan = '%', target_nasional = 100, urutan = 1 } = req.body;
    if (!spm_urusan_id || !nama_layanan) return res.status(400).json({ error: 'Urusan SPM dan nama layanan wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, satuan, target_nasional, urutan)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [Number(spm_urusan_id), kode_layanan || null, String(nama_layanan).trim(), satuan, Number(target_nasional) || 100, Number(urutan) || 1]
      );
      res.json({ message: 'Jenis layanan SPM berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal menambahkan jenis layanan SPM' });
    }
  });

  app.put('/api/spm/layanan/:id', async (req, res) => {
    const { spm_urusan_id, kode_layanan, nama_layanan, satuan = '%', target_nasional = 100, urutan = 1, is_active = true } = req.body;
    if (!spm_urusan_id || !nama_layanan) return res.status(400).json({ error: 'Urusan SPM dan nama layanan wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_spm_layanan
            SET spm_urusan_id = $1, kode_layanan = $2, nama_layanan = $3, satuan = $4, target_nasional = $5, urutan = $6, is_active = $7
          WHERE id = $8 RETURNING *`,
        [Number(spm_urusan_id), kode_layanan || null, String(nama_layanan).trim(), satuan, Number(target_nasional) || 100, Number(urutan) || 1, Boolean(is_active), req.params.id]
      );
      res.json({ message: 'Jenis layanan SPM berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui jenis layanan SPM' });
    }
  });

  app.delete('/api/spm/layanan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_spm_layanan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Jenis layanan SPM berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus jenis layanan SPM' });
    }
  });

  app.post('/api/spm/capaian', async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (!items.length) return res.status(400).json({ error: 'Data capaian wajib diisi' });
    const aktor = req.pengguna?.nama || req.pengguna?.name || req.pengguna?.nip || 'Admin';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let saved = 0;
      for (const it of items) {
        if (!it.layanan_id || !it.tahun) continue;
        const target = Number(it.target) || 100;
        const realisasi = Number(it.realisasi) || 0;
        const persen = it.capaian_persen !== undefined && it.capaian_persen !== ''
          ? Number(it.capaian_persen)
          : (target > 0 ? Math.min(100, Number(((realisasi / target) * 100).toFixed(2))) : 0);

        await client.query(
          `INSERT INTO sd_spm_capaian
             (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran, keterangan, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (layanan_id, tahun, wilayah_kode) DO UPDATE
              SET nama_wilayah = EXCLUDED.nama_wilayah,
                  target = EXCLUDED.target,
                  realisasi = EXCLUDED.realisasi,
                  capaian_persen = EXCLUDED.capaian_persen,
                  penerima_layanan = EXCLUDED.penerima_layanan,
                  anggaran = EXCLUDED.anggaran,
                  keterangan = EXCLUDED.keterangan,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = NOW()`,
          [
            Number(it.layanan_id),
            Number(it.tahun),
            String(it.wilayah_kode || '53.12').trim(),
            String(it.nama_wilayah || 'Kabupaten Sumba Barat').trim(),
            target,
            realisasi,
            persen,
            Number(it.penerima_layanan) || 0,
            Number(it.anggaran) || 0,
            it.keterangan || null,
            aktor,
          ]
        );
        saved++;
      }
      await client.query('COMMIT');
      res.json({ message: `${saved} data capaian SPM berhasil disimpan`, saved });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Post capaian SPM error:', err);
      res.status(500).json({ error: 'Gagal menyimpan capaian SPM' });
    } finally {
      client.release();
    }
  });

  app.delete('/api/spm/capaian/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_spm_capaian WHERE id = $1', [req.params.id]);
      res.json({ message: 'Data capaian SPM berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus capaian SPM' });
    }
  });

  app.get('/api/spm/arsip-pilihan', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const params = [];
      let sql = `SELECT id, judul, kategori, nomor_dokumen, tanggal_dokumen, url, files FROM bapperida_dokumen`;
      if (q) {
        sql += ` WHERE judul ILIKE $1 OR nomor_dokumen ILIKE $1 OR kategori ILIKE $1`;
        params.push(`%${q}%`);
      }
      sql += ` ORDER BY id DESC LIMIT 50`;
      const rows = await queryDB(sql, params);
      res.json(rows);
    } catch (err) {
      console.error('Arsip pilihan error:', err);
      res.status(500).json({ error: 'Gagal mencari dokumen arsip' });
    }
  });

  app.post('/api/spm/dokumen', async (req, res) => {
    let { judul, kategori = 'Laporan SPM', tahun = 2025, nomor_dokumen, file_url, deskripsi, dokumen_arsip_id } = req.body;
    const aktor = req.pengguna?.nama || req.pengguna?.name || 'Admin';
    try {
      if (dokumen_arsip_id) {
        const arsipRows = await queryDB('SELECT id, judul, nomor_dokumen, url, tanggal_dokumen FROM bapperida_dokumen WHERE id = $1', [Number(dokumen_arsip_id)]);
        if (arsipRows.length > 0) {
          const a = arsipRows[0];
          if (!judul) judul = a.judul;
          if (!nomor_dokumen && a.nomor_dokumen) nomor_dokumen = a.nomor_dokumen;
          if (!file_url && a.url) file_url = a.url;
          if (!tahun && a.tanggal_dokumen) tahun = new Date(a.tanggal_dokumen).getFullYear();
        }
      }
      if (!judul) return res.status(400).json({ error: 'Judul dokumen SPM wajib diisi' });

      const rows = await queryDB(
        `INSERT INTO sd_spm_dokumen (judul, kategori, tahun, nomor_dokumen, file_url, deskripsi, created_by, dokumen_arsip_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [String(judul).trim(), kategori, Number(tahun) || 2025, nomor_dokumen || null, file_url || null, deskripsi || null, aktor, dokumen_arsip_id ? Number(dokumen_arsip_id) : null]
      );
      res.json({ message: 'Dokumen SPM berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      console.error('Post dokumen SPM error:', err);
      res.status(500).json({ error: 'Gagal menyimpan dokumen SPM' });
    }
  });

  app.delete('/api/spm/dokumen/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_spm_dokumen WHERE id = $1', [req.params.id]);
      res.json({ message: 'Dokumen SPM berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus dokumen SPM' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. KELOLA KONTEN PORTAL (/api/konten/... & /api/publik/konten)
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/konten', async (_, res) => {
    try {
      const cached = getCached('sd_konten', 60000);
      if (cached) return res.json(cached);
      const [berita, publikasi, tautan, changelog] = await Promise.all([
        queryDB(`SELECT * FROM sd_konten_berita ORDER BY tanggal_terbit DESC, id DESC`),
        queryDB(`SELECT * FROM sd_konten_publikasi ORDER BY tahun DESC, id DESC`),
        queryDB(`SELECT * FROM sd_konten_tautan ORDER BY tipe, urutan, id`),
        queryDB(`SELECT * FROM sd_changelog ORDER BY tanggal_rilis DESC, id DESC`),
      ]);
      const result = { berita, publikasi, tautan, changelog };
      setCached('sd_konten', result);
      res.json(result);
    } catch (err) {
      console.error('Get konten error:', err);
      res.status(500).json({ error: 'Gagal memuat data konten' });
    }
  });

  app.get('/api/publik/konten', async (_, res) => {
    try {
      const cached = getCached('sd_publik_konten', 60000);
      if (cached) return res.json(cached);
      const [berita, publikasi, tautan, changelog, faq, qna] = await Promise.all([
        queryDB(`SELECT * FROM sd_konten_berita WHERE status = 'terbit' ORDER BY tanggal_terbit DESC, id DESC LIMIT 20`),
        queryDB(`SELECT * FROM sd_konten_publikasi WHERE tampil_publik = TRUE ORDER BY tahun DESC, id DESC`),
        queryDB(`SELECT * FROM sd_konten_tautan WHERE is_active = TRUE ORDER BY tipe, urutan, id`),
        queryDB(`SELECT * FROM sd_changelog WHERE status = 'released' ORDER BY tanggal_rilis DESC, id DESC`),
        queryDB(`SELECT * FROM sd_faq WHERE is_active = TRUE ORDER BY urutan, id`),
        queryDB(`SELECT id, nama, instansi, pertanyaan, jawaban, created_at, answered_at FROM sd_qna WHERE tampil_publik = TRUE AND status = 'dijawab' ORDER BY answered_at DESC LIMIT 20`),
      ]);
      const result = { berita, publikasi, tautan, changelog, faq, qna };
      setCached('sd_publik_konten', result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat konten publik' });
    }
  });

  // Berita CRUD
  app.post('/api/konten/berita', async (req, res) => {
    const { judul, kategori = 'Satu Data', ringkasan, isi, gambar_url, status = 'terbit', tanggal_terbit } = req.body;
    if (!judul || !isi) return res.status(400).json({ error: 'Judul dan isi berita wajib diisi' });
    const penulis = req.body.penulis || req.pengguna?.nama || req.pengguna?.name || 'Tim Walidata';
    try {
      const rows = await queryDB(
        `INSERT INTO sd_konten_berita (judul, kategori, ringkasan, isi, gambar_url, penulis, status, tanggal_terbit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE)) RETURNING *`,
        [String(judul).trim(), kategori, ringkasan || null, isi, gambar_url || null, penulis, status === 'draft' ? 'draft' : 'terbit', tanggal_terbit || null]
      );
      res.json({ message: 'Berita berhasil disimpan', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menyimpan berita' });
    }
  });

  app.put('/api/konten/berita/:id', async (req, res) => {
    const { judul, kategori = 'Satu Data', ringkasan, isi, gambar_url, status = 'terbit', tanggal_terbit } = req.body;
    if (!judul || !isi) return res.status(400).json({ error: 'Judul dan isi berita wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_konten_berita
            SET judul = $1, kategori = $2, ringkasan = $3, isi = $4, gambar_url = $5,
                status = $6, tanggal_terbit = COALESCE($7::date, tanggal_terbit), updated_at = NOW()
          WHERE id = $8 RETURNING *`,
        [String(judul).trim(), kategori, ringkasan || null, isi, gambar_url || null, status === 'draft' ? 'draft' : 'terbit', tanggal_terbit || null, req.params.id]
      );
      res.json({ message: 'Berita berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui berita' });
    }
  });

  app.delete('/api/konten/berita/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_konten_berita WHERE id = $1', [req.params.id]);
      res.json({ message: 'Berita berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus berita' });
    }
  });

  // Publikasi / Produk Hukum / SK Tim CRUD
  app.post('/api/konten/publikasi', async (req, res) => {
    const { judul, jenis = 'Publikasi Kajian', tahun = 2025, nomor, instansi, file_url, deskripsi, tampil_publik = true } = req.body;
    if (!judul) return res.status(400).json({ error: 'Judul publikasi wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_konten_publikasi (judul, jenis, tahun, nomor, instansi, file_url, deskripsi, tampil_publik)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [String(judul).trim(), jenis, Number(tahun) || 2025, nomor || null, instansi || 'BAPPERIDA Kab. Sumba Barat', file_url || null, deskripsi || null, Boolean(tampil_publik)]
      );
      res.json({ message: 'Katalog publikasi berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menyimpan katalog publikasi' });
    }
  });

  app.put('/api/konten/publikasi/:id', async (req, res) => {
    const { judul, jenis = 'Publikasi Kajian', tahun = 2025, nomor, instansi, file_url, deskripsi, tampil_publik = true } = req.body;
    if (!judul) return res.status(400).json({ error: 'Judul publikasi wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_konten_publikasi
            SET judul = $1, jenis = $2, tahun = $3, nomor = $4, instansi = $5, file_url = $6, deskripsi = $7, tampil_publik = $8
          WHERE id = $9 RETURNING *`,
        [String(judul).trim(), jenis, Number(tahun) || 2025, nomor || null, instansi || null, file_url || null, deskripsi || null, Boolean(tampil_publik), req.params.id]
      );
      res.json({ message: 'Katalog publikasi berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui katalog publikasi' });
    }
  });

  app.delete('/api/konten/publikasi/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_konten_publikasi WHERE id = $1', [req.params.id]);
      res.json({ message: 'Katalog publikasi berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus katalog publikasi' });
    }
  });

  // Tautan Video & Portal Eksternal CRUD
  app.post('/api/konten/tautan', async (req, res) => {
    const { judul, tipe = 'portal_eksternal', url, instansi, deskripsi, urutan = 1, is_active = true } = req.body;
    if (!judul || !url) return res.status(400).json({ error: 'Judul dan URL wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_konten_tautan (judul, tipe, url, instansi, deskripsi, urutan, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [String(judul).trim(), tipe, String(url).trim(), instansi || null, deskripsi || null, Number(urutan) || 1, Boolean(is_active)]
      );
      res.json({ message: 'Tautan konten berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menyimpan tautan konten' });
    }
  });

  app.put('/api/konten/tautan/:id', async (req, res) => {
    const { judul, tipe = 'portal_eksternal', url, instansi, deskripsi, urutan = 1, is_active = true } = req.body;
    if (!judul || !url) return res.status(400).json({ error: 'Judul dan URL wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_konten_tautan
            SET judul = $1, tipe = $2, url = $3, instansi = $4, deskripsi = $5, urutan = $6, is_active = $7
          WHERE id = $8 RETURNING *`,
        [String(judul).trim(), tipe, String(url).trim(), instansi || null, deskripsi || null, Number(urutan) || 1, Boolean(is_active), req.params.id]
      );
      res.json({ message: 'Tautan konten berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui tautan konten' });
    }
  });

  app.delete('/api/konten/tautan/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_konten_tautan WHERE id = $1', [req.params.id]);
      res.json({ message: 'Tautan konten berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus tautan konten' });
    }
  });

  // Changelog CRUD
  app.post('/api/konten/changelog', async (req, res) => {
    const { versi, judul, tipe_rilis = 'minor', ringkasan, perubahan = [], status = 'released', tanggal_rilis } = req.body;
    if (!versi || !judul) return res.status(400).json({ error: 'Versi dan judul changelog wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_changelog (versi, judul, tipe_rilis, ringkasan, perubahan, status, tanggal_rilis)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, COALESCE($7::date, CURRENT_DATE)) RETURNING *`,
        [String(versi).trim(), String(judul).trim(), tipe_rilis, ringkasan || null, JSON.stringify(perubahan || []), status, tanggal_rilis || null]
      );
      res.json({ message: 'Changelog berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Nomor versi sudah digunakan' : 'Gagal menyimpan changelog' });
    }
  });

  app.put('/api/konten/changelog/:id', async (req, res) => {
    const { versi, judul, tipe_rilis = 'minor', ringkasan, perubahan = [], status = 'released', tanggal_rilis } = req.body;
    if (!versi || !judul) return res.status(400).json({ error: 'Versi dan judul changelog wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_changelog
            SET versi = $1, judul = $2, tipe_rilis = $3, ringkasan = $4, perubahan = $5::jsonb,
                status = $6, tanggal_rilis = COALESCE($7::date, tanggal_rilis)
          WHERE id = $8 RETURNING *`,
        [String(versi).trim(), String(judul).trim(), tipe_rilis, ringkasan || null, JSON.stringify(perubahan || []), status, tanggal_rilis || null, req.params.id]
      );
      res.json({ message: 'Changelog berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui changelog' });
    }
  });

  app.delete('/api/konten/changelog/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_changelog WHERE id = $1', [req.params.id]);
      res.json({ message: 'Changelog berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus changelog' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. MONITORING & SISTEM (/api/monitoring/... & Publik QnA / Visitor)
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/monitoring', async (_, res) => {
    try {
      const cached = getCached('sd_monitoring', 20000);
      if (cached) return res.json(cached);

      const t0 = Date.now();
      const [qna, faq, visitors, savedQueries, apiTokens, datasetLogs, docLogs, counts] = await Promise.all([
        queryDB(`SELECT * FROM sd_qna ORDER BY (CASE WHEN status = 'menunggu' THEN 0 ELSE 1 END), created_at DESC`),
        queryDB(`SELECT * FROM sd_faq ORDER BY urutan, id`),
        queryDB(`
          SELECT v.*, d.nama AS dataset_nama
            FROM sd_visitor_log v
            LEFT JOIN bank_dataset d ON d.id = v.dataset_id
           ORDER BY v.created_at DESC LIMIT 200
        `),
        queryDB(`SELECT * FROM sd_saved_query ORDER BY created_at DESC`),
        queryDB(`SELECT id, nama_token, token_prefix, abilities, expires_at, last_used_at, created_by, is_active, created_at FROM sd_api_token ORDER BY created_at DESC`),
        queryDB(`
          SELECT l.*, d.nama AS dataset_nama
            FROM bank_dataset_log l
            LEFT JOIN bank_dataset d ON d.id = l.dataset_id
           ORDER BY l.created_at DESC LIMIT 60
        `),
        queryDB(`SELECT id, doc_id, action, actor_name, note, created_at FROM doc_history ORDER BY created_at DESC LIMIT 60`).catch(() => []),
        queryDB(`
          SELECT
            (SELECT COUNT(*)::int FROM bank_dataset) AS total_dataset,
            (SELECT COUNT(*)::int FROM bank_dataset WHERE status = 'disetujui') AS dataset_disetujui,
            (SELECT COUNT(*)::int FROM bank_dataset_row) AS total_baris_dataset,
            (SELECT COUNT(*)::int FROM bank_data_opd) AS total_opd,
            (SELECT COUNT(*)::int FROM sd_spm_capaian) AS total_capaian_spm,
            (SELECT COUNT(*)::int FROM bapperida_dokumen) AS total_dokumen
        `),
      ]);
      const dbLatencyMs = Date.now() - t0;
      const mem = process.memoryUsage();

      res.json({
        qna,
        faq,
        visitors,
        saved_queries: savedQueries,
        api_tokens: apiTokens,
        dataset_logs: datasetLogs,
        doc_logs: docLogs,
        counts: counts[0] || {},
        health: {
          status: dbLatencyMs > 500 ? 'warning' : 'healthy',
          db_latency_ms: dbLatencyMs,
          uptime_seconds: Math.round(process.uptime()),
          node_version: process.version,
          memory_rss_mb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
          memory_heap_mb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
          os_load: os.loadavg?.() || [0, 0, 0],
          checked_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('Get monitoring error:', err);
      res.status(500).json({ error: 'Gagal memuat data monitoring' });
    }
  });

  // Public Q&A submission
  app.post('/api/publik/qna', async (req, res) => {
    const { nama, email, instansi, pertanyaan } = req.body;
    if (!nama || !email || !pertanyaan) {
      return res.status(400).json({ error: 'Nama, email, dan pertanyaan wajib diisi' });
    }
    try {
      const rows = await queryDB(
        `INSERT INTO sd_qna (nama, email, instansi, pertanyaan, status)
         VALUES ($1, $2, $3, $4, 'menunggu') RETURNING *`,
        [String(nama).trim(), String(email).trim(), instansi ? String(instansi).trim() : null, String(pertanyaan).trim().slice(0, 1500)]
      );
      res.json({ message: 'Pertanyaan Anda telah dikirim ke Tim Walidata', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal mengirim pertanyaan' });
    }
  });

  // Admin answer/update Q&A
  app.put('/api/monitoring/qna/:id', async (req, res) => {
    const { jawaban, tampil_publik = false, status = 'dijawab' } = req.body;
    const aktor = req.pengguna?.nama || req.pengguna?.name || 'Admin Walidata';
    try {
      const rows = await queryDB(
        `UPDATE sd_qna
            SET jawaban = $1,
                tampil_publik = $2,
                status = $3,
                dijawab_oleh = $4,
                answered_at = NOW()
          WHERE id = $5 RETURNING *`,
        [jawaban ? String(jawaban).trim() : null, Boolean(tampil_publik), status, aktor, req.params.id]
      );
      res.json({ message: 'Jawaban Q&A berhasil disimpan', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui Q&A' });
    }
  });

  app.delete('/api/monitoring/qna/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_qna WHERE id = $1', [req.params.id]);
      res.json({ message: 'Pertanyaan berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus pertanyaan' });
    }
  });

  // FAQ CRUD
  app.post('/api/monitoring/faq', async (req, res) => {
    const { pertanyaan, jawaban, urutan = 1, is_active = true } = req.body;
    if (!pertanyaan || !jawaban) return res.status(400).json({ error: 'Pertanyaan dan jawaban FAQ wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_faq (pertanyaan, jawaban, urutan, is_active) VALUES ($1, $2, $3, $4) RETURNING *`,
        [String(pertanyaan).trim(), String(jawaban).trim(), Number(urutan) || 1, Boolean(is_active)]
      );
      res.json({ message: 'FAQ berhasil ditambahkan', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: err.code === '23505' ? 'Pertanyaan FAQ sudah ada' : 'Gagal menambahkan FAQ' });
    }
  });

  app.put('/api/monitoring/faq/:id', async (req, res) => {
    const { pertanyaan, jawaban, urutan = 1, is_active = true } = req.body;
    if (!pertanyaan || !jawaban) return res.status(400).json({ error: 'Pertanyaan dan jawaban FAQ wajib diisi' });
    try {
      const rows = await queryDB(
        `UPDATE sd_faq SET pertanyaan = $1, jawaban = $2, urutan = $3, is_active = $4 WHERE id = $5 RETURNING *`,
        [String(pertanyaan).trim(), String(jawaban).trim(), Number(urutan) || 1, Boolean(is_active), req.params.id]
      );
      res.json({ message: 'FAQ berhasil diperbarui', row: rows[0] });
    } catch (err) {
      res.status(400).json({ error: 'Gagal memperbarui FAQ' });
    }
  });

  app.delete('/api/monitoring/faq/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_faq WHERE id = $1', [req.params.id]);
      res.json({ message: 'FAQ berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus FAQ' });
    }
  });

  // Public Visitor Book / Download Log
  app.post('/api/publik/visitor', async (req, res) => {
    const { nama, email, telepon, instansi, keperluan, dataset_id, aksi = 'kunjungan_portal' } = req.body;
    if (!nama || !keperluan) return res.status(400).json({ error: 'Nama dan keperluan wajib diisi' });
    try {
      const rows = await queryDB(
        `INSERT INTO sd_visitor_log (nama, email, telepon, instansi, keperluan, dataset_id, aksi)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          String(nama).trim(),
          email ? String(email).trim() : null,
          telepon ? String(telepon).trim() : null,
          instansi ? String(instansi).trim() : null,
          String(keperluan).trim(),
          dataset_id ? Number(dataset_id) : null,
          aksi,
        ]
      );
      res.json({ message: 'Data pengunjung berhasil dicatat', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal mencatat data pengunjung' });
    }
  });

  app.delete('/api/monitoring/visitor/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_visitor_log WHERE id = $1', [req.params.id]);
      res.json({ message: 'Catatan pengunjung berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus catatan pengunjung' });
    }
  });

  // Query Builder & Sandingkan Indikator
  app.post('/api/monitoring/query-run', async (req, res) => {
    const { dataset_ids = [], opd_id, status, tahun_mulai, tahun_akhir, wilayah_kode, agregasi = 'none' } = req.body || {};
    try {
      const conds = [];
      const params = [];
      if (Array.isArray(dataset_ids) && dataset_ids.length > 0) {
        params.push(dataset_ids.map(Number).filter(Boolean));
        conds.push(`d.id = ANY($${params.length}::bigint[])`);
      }
      if (opd_id && opd_id !== 'SEMUA') {
        params.push(Number(opd_id));
        conds.push(`d.opd_id = $${params.length}`);
      }
      if (status && status !== 'SEMUA') {
        params.push(String(status));
        conds.push(`d.status = $${params.length}`);
      }

      const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const datasets = await queryDB(
        `SELECT d.*, o.nama AS opd_nama
           FROM bank_dataset d
           JOIN bank_data_opd o ON o.id = d.opd_id
           ${whereSql}
          ORDER BY o.nama, d.nama
          LIMIT 50`,
        params
      );

      if (!datasets.length) return res.json({ datasets: [], rows: [], summary: [] });

      const dsIds = datasets.map(d => d.id);
      const [fields, allRows] = await Promise.all([
        queryDB(`SELECT * FROM bank_dataset_field WHERE dataset_id = ANY($1::bigint[]) ORDER BY dataset_id, urutan, id`, [dsIds]),
        queryDB(`SELECT * FROM bank_dataset_row WHERE dataset_id = ANY($1::bigint[]) ORDER BY tahun, wilayah_kode, id`, [dsIds]),
      ]);

      const filteredRows = allRows.filter(r => {
        if (tahun_mulai && Number(r.tahun) < Number(tahun_mulai)) return false;
        if (tahun_akhir && Number(r.tahun) > Number(tahun_akhir)) return false;
        if (wilayah_kode && wilayah_kode !== 'SEMUA' && String(r.wilayah_kode || '').toLowerCase() !== String(wilayah_kode).toLowerCase()) return false;
        return true;
      });

      const fieldMap = new Map();
      for (const f of fields) {
        const k = String(f.dataset_id);
        if (!fieldMap.has(k)) fieldMap.set(k, []);
        fieldMap.get(k).push(f);
      }

      const dsMap = new Map(datasets.map(d => [String(d.id), { ...d, fields: fieldMap.get(String(d.id)) || [] }]));

      // Hitung ringkasan/agregasi per dataset
      const summary = datasets.map(d => {
        const dRows = filteredRows.filter(r => String(r.dataset_id) === String(d.id));
        const dFields = (fieldMap.get(String(d.id)) || []).filter(f => f.tipe_data === 'angka' || f.tipe_data === 'desimal');
        const mainField = dFields[0]?.nama_field;
        const nums = mainField
          ? dRows.map(r => Number(r.data?.[mainField])).filter(n => Number.isFinite(n))
          : [];
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = nums.length ? Number((sum / nums.length).toFixed(2)) : 0;
        const min = nums.length ? Math.min(...nums) : 0;
        const max = nums.length ? Math.max(...nums) : 0;
        return {
          dataset_id: d.id,
          nama: d.nama,
          opd_nama: d.opd_nama,
          satuan: d.satuan,
          field_utama: dFields[0]?.label || '-',
          jumlah_baris: dRows.length,
          sum: Number(sum.toFixed(2)),
          avg,
          min,
          max,
        };
      });

      const enrichedRows = filteredRows.slice(0, 500).map(r => {
        const ds = dsMap.get(String(r.dataset_id));
        return {
          ...r,
          dataset_nama: ds?.nama || '',
          opd_nama: ds?.opd_nama || '',
          satuan: ds?.satuan || '',
        };
      });

      res.json({
        datasets: Array.from(dsMap.values()),
        rows: enrichedRows,
        total_rows: filteredRows.length,
        agregasi,
        summary,
      });
    } catch (err) {
      console.error('Query builder run error:', err);
      res.status(500).json({ error: 'Gagal menjalankan query indikator' });
    }
  });

  app.post('/api/monitoring/saved-query', async (req, res) => {
    const { nama_query, deskripsi, config_json = {}, is_shared = true } = req.body;
    if (!nama_query) return res.status(400).json({ error: 'Nama query wajib diisi' });
    const aktor = req.pengguna?.nama || req.pengguna?.name || 'Admin';
    try {
      const rows = await queryDB(
        `INSERT INTO sd_saved_query (nama_query, deskripsi, config_json, is_shared, created_by)
         VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *`,
        [String(nama_query).trim(), deskripsi || null, JSON.stringify(config_json), Boolean(is_shared), aktor]
      );
      res.json({ message: 'Query berhasil disimpan', row: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menyimpan query' });
    }
  });

  app.delete('/api/monitoring/saved-query/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_saved_query WHERE id = $1', [req.params.id]);
      res.json({ message: 'Query tersimpan berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus query tersimpan' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. MANAJEMEN API TOKEN & INTEGRASI EKSTERNAL (SDPDN / PUBLIK)
  // ══════════════════════════════════════════════════════════════════════════

  // Daftar semua API Token
  app.get('/api/monitoring/api-token', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT id, nama_token, token_prefix, abilities, expires_at, last_used_at,
               created_by, is_active, keterangan, created_at
          FROM sd_api_token
         ORDER BY created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat daftar API Token' });
    }
  });

  // Buat API Token Baru
  app.post('/api/monitoring/api-token', async (req, res) => {
    const { nama_token, abilities = 'read:dataset,read:spm', expires_at, keterangan } = req.body;
    if (!nama_token || !String(nama_token).trim()) {
      return res.status(400).json({ error: 'Nama token / sistem integrator wajib diisi' });
    }
    const rawToken = `sdi_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = rawToken.slice(0, 12);
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const aktor = req.pengguna?.nama || req.pengguna?.name || 'Admin';

    // Konversi abilities jika berupa array
    const abilitiesStr = Array.isArray(abilities) ? abilities.join(',') : String(abilities || 'read:dataset,read:spm').trim();

    try {
      const rows = await queryDB(
        `INSERT INTO sd_api_token (nama_token, token_prefix, token_hash, abilities, expires_at, created_by, is_active, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING id, nama_token, token_prefix, abilities, expires_at, created_by, is_active, keterangan, created_at`,
        [String(nama_token).trim(), prefix, hash, abilitiesStr, expires_at || null, aktor, keterangan || null]
      );
      clearCache('sd_monitoring');
      res.json({
        message: 'API Token berhasil dibuat. Salin token sekarang karena hanya ditampilkan sekali.',
        token: rawToken,
        row: rows[0],
      });
    } catch (err) {
      console.error('Gagal membuat API token:', err);
      res.status(500).json({ error: 'Gagal membuat API token' });
    }
  });

  // Toggle status aktif/nonaktif API Token
  app.patch('/api/monitoring/api-token/:id/toggle', async (req, res) => {
    try {
      const rows = await queryDB(
        `UPDATE sd_api_token
            SET is_active = NOT is_active
          WHERE id = $1
      RETURNING id, nama_token, is_active`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'API Token tidak ditemukan' });
      clearCache('sd_monitoring');
      res.json({
        message: `Token "${rows[0].nama_token}" sekarang ${rows[0].is_active ? 'Aktif' : 'Dinonaktifkan'}`,
        item: rows[0],
      });
    } catch (err) {
      res.status(500).json({ error: 'Gagal mengubah status token' });
    }
  });

  // Hapus / Cabut API Token
  app.delete('/api/monitoring/api-token/:id', async (req, res) => {
    try {
      await queryDB('DELETE FROM sd_api_token WHERE id = $1', [req.params.id]);
      clearCache('sd_monitoring');
      res.json({ message: 'API Token berhasil dicabut dan dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus API token' });
    }
  });

  // Tes validasi API Token (interactive test endpoint)
  app.post('/api/monitoring/api-token/test', async (req, res) => {
    const token = (req.body?.token || '').trim();
    if (!token) return res.status(400).json({ valid: false, error: 'Token wajib diisi' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      const rows = await queryDB(`
        SELECT id, nama_token, token_prefix, abilities, expires_at, last_used_at, is_active
          FROM sd_api_token
         WHERE token_hash = $1
      `, [hash]);

      if (!rows.length) {
        return res.json({ valid: false, error: 'Token tidak ditemukan atau kunci salah' });
      }

      const tok = rows[0];
      if (!tok.is_active) {
        return res.json({ valid: false, error: 'Token dalam status nonaktif' });
      }
      if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
        return res.json({ valid: false, error: `Token sudah kedaluwarsa sejak ${tok.expires_at}` });
      }

      // Update waktu penggunaan terakhir
      queryDB('UPDATE sd_api_token SET last_used_at = NOW() WHERE id = $1', [tok.id]).catch(() => {});

      res.json({
        valid: true,
        message: 'Token terverifikasi dan aktif',
        token_info: tok,
        tested_at: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ valid: false, error: 'Terjadi kesalahan saat memeriksa token' });
    }
  });

  // Helper validasi Bearer Token untuk endpoint Integrasi / API Publik
  const ambilBearerToken = (req) => {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
    if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
    if (req.query?.api_token) return String(req.query.api_token).trim();
    return null;
  };

  const validasiBearerToken = async (req, res, requiredAbility) => {
    const raw = ambilBearerToken(req);
    if (!raw) {
      res.status(401).json({
        error: 'Autentikasi API diperlukan. Sertakan header Authorization: Bearer <token> atau ?api_token=<token>',
      });
      return false;
    }
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const rows = await queryDB(
      `SELECT * FROM sd_api_token WHERE token_hash = $1 AND is_active = true AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`,
      [hash]
    );
    if (!rows.length) {
      res.status(403).json({ error: 'Token API tidak valid, dinonaktifkan, atau telah kedaluwarsa' });
      return false;
    }
    const tok = rows[0];
    if (requiredAbility && tok.abilities) {
      const allowed = tok.abilities.split(',').map(s => s.trim());
      if (!allowed.includes('*') && !allowed.includes(requiredAbility)) {
        res.status(403).json({ error: `Token tidak memiliki cakupan izin (${requiredAbility})` });
        return false;
      }
    }
    queryDB('UPDATE sd_api_token SET last_used_at = NOW() WHERE id = $1', [tok.id]).catch(() => {});
    req.apiToken = tok;
    return true;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ENDPOINT INTEGRASI API V1 (/api/v1/...)
  // ══════════════════════════════════════════════════════════════════════════

  // Ping & verifikasi token untuk integrator
  app.get('/api/v1/ping', async (req, res) => {
    const valid = await validasiBearerToken(req, res);
    if (!valid) return;
    res.json({
      ok: true,
      service: 'Satu Data BAPPERIDA Kab. Sumba Barat API v1',
      token_name: req.apiToken.nama_token,
      abilities: req.apiToken.abilities,
      timestamp: new Date().toISOString(),
    });
  });

  // Integrasi Dataset: Katalog & Ringkasan Nilai
  app.get('/api/v1/dataset', async (req, res) => {
    const valid = await validasiBearerToken(req, res, 'read:dataset');
    if (!valid) return;
    try {
      const { tahun, opd_id, q, limit = 50, offset = 0 } = req.query;
      const params = [];
      let where = "WHERE (d.status = 'disetujui' OR d.status = 'publik')";

      if (opd_id && opd_id !== 'SEMUA') {
        params.push(opd_id);
        where += ` AND d.opd_id = $${params.length}`;
      }
      if (q) {
        params.push(`%${q.toLowerCase()}%`);
        where += ` AND (LOWER(d.nama) LIKE $${params.length} OR LOWER(d.deskripsi) LIKE $${params.length})`;
      }

      const rows = await queryDB(`
        SELECT d.id, d.kode, d.nama, d.satuan, d.tipe_data, d.status,
               o.nama AS opd_nama, o.singkatan AS opd_singkatan,
               d.created_at, d.updated_at
          FROM bank_dataset d
          LEFT JOIN bank_data_opd o ON o.id = d.opd_id
         ${where}
         ORDER BY d.nama ASC
         LIMIT ${Math.min(parseInt(limit, 10) || 50, 200)}
        OFFSET ${parseInt(offset, 10) || 0}
      `, params);

      res.json({
        total: rows.length,
        data: rows,
        integrator: req.apiToken.nama_token,
      });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat dataset integrasi' });
    }
  });

  // Integrasi Detail Dataset & Baris Nilai
  app.get('/api/v1/dataset/:id', async (req, res) => {
    const valid = await validasiBearerToken(req, res, 'read:dataset');
    if (!valid) return;
    try {
      const dRows = await queryDB(`
        SELECT d.*, o.nama AS opd_nama
          FROM bank_dataset d
          LEFT JOIN bank_data_opd o ON o.id = d.opd_id
         WHERE d.id = $1
      `, [req.params.id]);

      if (!dRows.length) return res.status(404).json({ error: 'Dataset tidak ditemukan' });
      const dataset = dRows[0];

      const records = await queryDB(`
        SELECT r.id, r.tahun, r.periode, r.wilayah_kode, r.data, r.created_by, r.updated_at, r.updated_at AS created_at
          FROM bank_dataset_row r
         WHERE r.dataset_id = $1
         ORDER BY r.tahun DESC
      `, [req.params.id]);

      res.json({
        dataset,
        records,
      });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat detail dataset integrasi' });
    }
  });

  // Integrasi SPM: Capaian & Rekapitulasi per Urusan
  app.get('/api/v1/spm', async (req, res) => {
    const valid = await validasiBearerToken(req, res, 'read:spm');
    if (!valid) return;
    try {
      const data = await ambilDataSpm();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat capaian SPM integrasi' });
    }
  });

  // Integrasi Wilayah: Master Kecamatan & Desa Sumba Barat
  app.get('/api/v1/wilayah', async (req, res) => {
    const valid = await validasiBearerToken(req, res, 'read:wilayah');
    if (!valid) return;
    try {
      const rows = await queryDB(`
        SELECT kode, nama, tingkat, induk_kode, is_active
          FROM sd_wilayah
         WHERE is_active = true
         ORDER BY kode ASC
      `);
      res.json({ wilayah: rows });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat data wilayah integrasi' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. DYNAMIC ROLE & PERMISSION MANAGEMENT (/api/roles/...)
  // ══════════════════════════════════════════════════════════════════════════

  // Metadata Katalog Modul, Hak Akses, dan Menu Sidebar untuk Frontend Matrix
  const METADATA_PERMISSIONS = {
    modules: [
      {
        key: 'arsip',
        label: 'Arsip Digital & Dokumen',
        deskripsi: 'Pengelolaan berkas dan dokumen perencanaan daerah',
        permissions: [
          { key: 'dokumen.read', label: 'Baca & Unduh Dokumen', desc: 'Melihat daftar dan mengunduh berkas PDF arsip' },
          { key: 'dokumen.create', label: 'Upload Dokumen', desc: 'Mengunggah dokumen baru ke repositori arsip' },
          { key: 'dokumen.update', label: 'Edit Dokumen', desc: 'Memperbarui metadata, judul, atau file dokumen' },
          { key: 'dokumen.verify', label: 'Verifikasi Dokumen', desc: 'Menyetujui atau menolak dokumen yang diajukan' },
          { key: 'dokumen.delete', label: 'Hapus Dokumen', desc: 'Menghapus dokumen dari sistem' },
        ],
      },
      {
        key: 'agenda_sppd',
        label: 'Agenda Surat & SPPD',
        deskripsi: 'Pengelolaan agenda surat masuk, surat keluar, penugasan SPT, dan SPPD',
        permissions: [
          { key: 'agenda.read', label: 'Lihat Agenda & SPPD', desc: 'Melihat daftar surat masuk, surat keluar, dan SPPD' },
          { key: 'agenda.create', label: 'Buat Agenda / SPPD', desc: 'Mencatat surat baru atau menerbitkan SPT/SPPD' },
          { key: 'agenda.update', label: 'Edit Agenda / SPPD', desc: 'Memperbarui data agenda, personil, atau rincian biaya' },
          { key: 'agenda.delete', label: 'Hapus Agenda / SPPD', desc: 'Menghapus data agenda atau SPPD dari sistem' },
          { key: 'agenda.wewenang', label: 'Pengaturan Wewenang', desc: 'Mengatur pejabat penandatangan dan paraf hierarki' },
        ],
      },
      {
        key: 'bankdata',
        label: 'Bank Data & Satu Data',
        deskripsi: 'Pengelolaan data statistik sektoral, IKU, dan IKK',
        permissions: [
          { key: 'bankdata.read', label: 'Lihat Dataset & Indikator', desc: 'Membaca katalog dataset dan grafik capaian' },
          { key: 'bankdata.create', label: 'Input Data / Dataset', desc: 'Menambah indikator atau dataset baru' },
          { key: 'bankdata.update', label: 'Edit Data / Target / Realisasi', desc: 'Mengisi nilai realisasi triwulan dan tahunan' },
          { key: 'bankdata.delete', label: 'Hapus Dataset', desc: 'Menghapus entri indikator atau dataset' },
          { key: 'bankdata.import', label: 'Impor Excel Data', desc: 'Mengunggah template data Excel' },
          { key: 'bankdata.export', label: 'Ekspor Data Excel / PDF', desc: 'Mengunduh rekapitulasi data sektoral' },
          { key: 'bankdata.verify', label: 'Verifikasi Dataset (Walidata)', desc: 'Menyetujui rilis data sektoral ke publik' },
          { key: 'reopen.create', label: 'Ajukan Buka Kunci (Reopen)', desc: 'Mengajukan izin buka kunci data yang terkunci' },
          { key: 'reopen.verify', label: 'Persetujuan Reopen', desc: 'Memberikan izin reopen kepada produsen data' },
        ],
      },
      {
        key: 'master_satudata',
        label: 'Master Data Satu Data',
        deskripsi: 'Pengaturan OPD, Urusan, Topik, Satuan, dan Wilayah',
        permissions: [
          { key: 'master_opd.manage', label: 'Kelola Master OPD', desc: 'Menambah dan mengubah unit kerja OPD' },
          { key: 'master_urusan.manage', label: 'Kelola Urusan & Bidang Urusan', desc: 'Pemetaan urusan Permendagri 90' },
          { key: 'master_topik.manage', label: 'Kelola Topik & Sub-Topik', desc: 'Taksonomi pengelompokan dataset' },
          { key: 'master_satuan.manage', label: 'Kelola Satuan Pengukuran', desc: 'Daftar unit satuan metrik' },
          { key: 'master_sk.manage', label: 'Kelola Daftar Data SK', desc: 'Target jumlah data per OPD menurut SK Kepala Daerah' },
          { key: 'master_template.manage', label: 'Kelola Template Field', desc: 'Preset kolom tabel dataset' },
          { key: 'master_wilayah.manage', label: 'Kelola Master Wilayah', desc: 'Struktur kode wilayah Kemendagri' },
        ],
      },
      {
        key: 'spm',
        label: 'Standar Pelayanan Minimal (SPM)',
        deskripsi: 'Monitoring capaian 6 urusan wajib SPM Pemkab Sumba Barat',
        permissions: [
          { key: 'spm.read', label: 'Lihat Capaian SPM & Peta', desc: 'Melihat dashboard capaian per kecamatan' },
          { key: 'spm.update', label: 'Input / Update Capaian SPM', desc: 'Mengisi target, realisasi, dan anggaran layanan SPM' },
          { key: 'spm.verify', label: 'Verifikasi Laporan SPM', desc: 'Mengesahkan laporan triwulan/tahunan SPM' },
          { key: 'spm.export', label: 'Ekspor Rekap SPM', desc: 'Mengunduh data capaian SPM ke Excel' },
        ],
      },
      {
        key: 'konten',
        label: 'Kelola Konten Portal',
        deskripsi: 'Publikasi informasi portal publik Satu Data',
        permissions: [
          { key: 'konten.read', label: 'Lihat Daftar Konten', desc: 'Membaca draft berita, publikasi, dan tautan' },
          { key: 'konten.create', label: 'Buat Konten Baru', desc: 'Menulis artikel berita atau unggah publikasi' },
          { key: 'konten.update', label: 'Edit Konten', desc: 'Mengubah isi artikel dan media publikasi' },
          { key: 'konten.delete', label: 'Hapus Konten', desc: 'Menghapus konten dari portal publik' },
          { key: 'konten.publish', label: 'Publikasikan Konten', desc: 'Menerbitkan draft konten agar tampil di portal publik' },
        ],
      },
      {
        key: 'perencanaan',
        label: 'Perencanaan & Penganggaran',
        deskripsi: 'Kertas kerja PKS, Screening RKA, dan Standar Harga SIPD',
        permissions: [
          { key: 'kertas_kerja.read', label: 'Buka Kertas Kerja PKS', desc: 'Melihat matriks target dan capaian indikator' },
          { key: 'kertas_kerja.update', label: 'Edit Kertas Kerja', desc: 'Mengisi capaian periode dan menautkan arsip' },
          { key: 'perencanaan_progres.read', label: 'Lihat Progres Perencanaan', desc: 'Melihat timeline Gantt/Kanban tahapan RKPD/RPJMD' },
          { key: 'perencanaan_progres.manage', label: 'Kelola Progres Perencanaan', desc: 'Menambah, mengedit status, dan tanggal tahapan perencanaan' },
          { key: 'screening.read', label: 'Buka Screening RKA', desc: 'Melihat hasil pemeriksaan kepatuhan SSH/SBU' },
          { key: 'screening.verify', label: 'Verifikasi Kepatuhan RKA', desc: 'Mengesahkan telaah standar harga RKA' },
          { key: 'standar_harga.manage', label: 'Kelola Standar Harga SIPD', desc: 'Impor dan atur referensi SSH/SBU' },
        ],
      },
      {
        key: 'monitoring_sistem',
        label: 'Monitoring, Role & Keamanan',
        deskripsi: 'Akses sistem, manajemen akun pengguna, API Token, dan role',
        permissions: [
          { key: 'monitoring.read', label: 'Buka Monitoring & Metrik', desc: 'Melihat statistik pengunjung, Q&A, dan health' },
          { key: 'monitoring.export', label: 'Query Builder & Ekspor', desc: 'Menjalankan agregasi lintas dataset dan ekspor' },
          { key: 'api_token.manage', label: 'Kelola API Token Integrasi', desc: 'Membuat dan mencabut API key eksternal' },
          { key: 'roles.manage', label: 'Kelola Role & Hak Akses', desc: 'Mengatur peran dinamis dan matriks wewenang' },
          { key: 'users.manage', label: 'Kelola Pengguna Sistem', desc: 'Menambah, mengedit, dan me-reset akun pengguna' },
          { key: 'audit.read', label: 'Audit Trail Sistem', desc: 'Melihat riwayat aktivitas seluruh pengguna' },
        ],
      },
    ],
    menus: [
      { key: 'dashboard', label: 'Dashboard', group: 'Utama' },
      { key: 'dokumen', label: 'Dokumen', group: 'Arsip Digital' },
      { key: 'upload', label: 'Upload Dokumen', group: 'Arsip Digital' },
      { key: 'pencarian', label: 'Pencarian', group: 'Arsip Digital' },
      { key: 'agenda-surat', label: 'Agenda Surat', group: 'Arsip Digital' },
      { key: 'register-sppd', label: 'Register SPPD & SPT', group: 'Arsip Digital' },
      { key: 'progres-perencanaan', label: 'Progres Perencanaan', group: 'Arsip Digital' },
      { key: 'publik', label: 'Portal Publik', group: 'Arsip Digital' },
      { key: 'kertas-kerja', label: 'Kertas Kerja', group: 'Perencanaan' },
      { key: 'screening', label: 'Screening RKA', group: 'Perencanaan' },
      { key: 'bankdata', label: 'Bank Data', group: 'Perencanaan' },
      { key: 'spm', label: 'Capaian SPM', group: 'Perencanaan' },
      { key: 'pengguna', label: 'Pengguna', group: 'Administrasi' },
      { key: 'kelola-role', label: 'Kelola Role & Akses', group: 'Administrasi' },
      { key: 'master-satudata', label: 'Master Satu Data', group: 'Administrasi' },
      { key: 'kelola-konten', label: 'Kelola Konten', group: 'Administrasi' },
      { key: 'monitoring', label: 'Monitoring Sistem', group: 'Administrasi' },
      { key: 'kategori-dokumen', label: 'Jenis Dokumen', group: 'Administrasi' },
      { key: 'sektor', label: 'Sektor', group: 'Administrasi' },
      { key: 'standar-harga', label: 'Standar Harga', group: 'Administrasi' },
      { key: 'audit', label: 'Audit Trail', group: 'Administrasi' },
      { key: 'panduan', label: 'Panduan', group: 'Referensi' },
    ],
  };

  app.get('/api/roles/permissions/meta', (_, res) => {
    res.json(METADATA_PERMISSIONS);
  });

  // Daftar Semua Role beserta Jumlah Pengguna
  app.get('/api/roles', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT r.id, r.nama, r.slug, r.deskripsi, r.base_level,
               r.opd_scoped, r.is_locked, r.warna_bg, r.warna_text,
               r.allowed_menus, r.permissions, r.created_at, r.updated_at,
               COALESCE(u.user_count, 0)::int AS user_count
          FROM sd_roles r
          LEFT JOIN (
            SELECT LOWER(role) AS role_name, COUNT(*) AS user_count
              FROM user_credentials
             GROUP BY LOWER(role)
          ) u ON LOWER(r.nama) = u.role_name
         ORDER BY r.id ASC
      `);
      res.json(rows);
    } catch (err) {
      console.error('Gagal mengambil daftar roles:', err);
      res.status(500).json({ error: 'Gagal mengambil daftar peran pengguna' });
    }
  });

  // Detail Role beserta Daftar Pengguna yang Memiliki Role Ini
  app.get('/api/roles/:id', async (req, res) => {
    try {
      const roleRows = await queryDB('SELECT * FROM sd_roles WHERE id = $1', [req.params.id]);
      if (!roleRows.length) return res.status(404).json({ error: 'Role tidak ditemukan' });
      const role = roleRows[0];

      const users = await queryDB(`
        SELECT c.nip, u.username AS name, u.bidang, o.nama AS opd_nama, u."Status" AS status
          FROM user_credentials c
          LEFT JOIN user_list u ON u."NIP" = c.nip
          LEFT JOIN bank_data_opd o ON o.id = c.opd_id
         WHERE LOWER(c.role) = LOWER($1)
         ORDER BY u.username ASC
      `, [role.nama]);

      res.json({ ...role, users });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat detail role' });
    }
  });

  // Tambah Role Baru
  app.post('/api/roles', async (req, res) => {
    const {
      nama,
      deskripsi,
      base_level = 'Staf',
      opd_scoped = false,
      warna_bg = '#EFF6FF',
      warna_text = '#2563EB',
      allowed_menus = [],
      permissions = [],
    } = req.body;

    if (!nama || !String(nama).trim()) {
      return res.status(400).json({ error: 'Nama role wajib diisi' });
    }
    const cleanNama = String(nama).trim();
    const slug = cleanNama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
      const check = await queryDB('SELECT id FROM sd_roles WHERE LOWER(nama) = LOWER($1) OR slug = $2', [cleanNama, slug]);
      if (check.length > 0) {
        return res.status(400).json({ error: `Role dengan nama "${cleanNama}" sudah ada` });
      }

      const rows = await queryDB(
        `INSERT INTO sd_roles (nama, slug, deskripsi, base_level, opd_scoped, is_locked, warna_bg, warna_text, allowed_menus, permissions)
         VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8::jsonb, $9::jsonb)
         RETURNING *`,
        [
          cleanNama,
          slug,
          deskripsi || null,
          base_level,
          Boolean(opd_scoped),
          warna_bg || '#EFF6FF',
          warna_text || '#2563EB',
          JSON.stringify(allowed_menus || []),
          JSON.stringify(permissions || []),
        ]
      );

      res.json({ message: 'Role baru berhasil ditambahkan', role: rows[0] });
    } catch (err) {
      console.error('Gagal membuat role:', err);
      res.status(500).json({ error: 'Gagal membuat role baru' });
    }
  });

  // Update Role (Hak Akses, Menu, Warna, Metadata)
  app.put('/api/roles/:id', async (req, res) => {
    const {
      nama,
      deskripsi,
      base_level,
      opd_scoped,
      warna_bg,
      warna_text,
      allowed_menus,
      permissions,
    } = req.body;

    try {
      const roleRows = await queryDB('SELECT * FROM sd_roles WHERE id = $1', [req.params.id]);
      if (!roleRows.length) return res.status(404).json({ error: 'Role tidak ditemukan' });
      const current = roleRows[0];

      // Role yang terkunci (Admin) tidak boleh diubah nama/slug-nya demi stabilitas sistem
      const finalNama = current.is_locked ? current.nama : (nama ? String(nama).trim() : current.nama);
      const finalSlug = current.is_locked ? current.slug : finalNama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const rows = await queryDB(
        `UPDATE sd_roles
            SET nama = $1,
                slug = $2,
                deskripsi = $3,
                base_level = $4,
                opd_scoped = $5,
                warna_bg = $6,
                warna_text = $7,
                allowed_menus = $8::jsonb,
                permissions = $9::jsonb,
                updated_at = NOW()
          WHERE id = $10
      RETURNING *`,
        [
          finalNama,
          finalSlug,
          deskripsi !== undefined ? deskripsi : current.deskripsi,
          base_level || current.base_level,
          opd_scoped !== undefined ? Boolean(opd_scoped) : current.opd_scoped,
          warna_bg || current.warna_bg,
          warna_text || current.warna_text,
          JSON.stringify(allowed_menus !== undefined ? allowed_menus : current.allowed_menus),
          JSON.stringify(permissions !== undefined ? permissions : current.permissions),
          req.params.id,
        ]
      );

      // Jika nama role berubah, perbarui juga string role di user_credentials
      if (!current.is_locked && finalNama !== current.nama) {
        await queryDB('UPDATE user_credentials SET role = $1 WHERE LOWER(role) = LOWER($2)', [finalNama, current.nama]);
      }

      res.json({ message: 'Role & wewenang berhasil diperbarui', role: rows[0] });
    } catch (err) {
      console.error('Gagal memperbarui role:', err);
      res.status(500).json({ error: 'Gagal memperbarui data role' });
    }
  });

  // Hapus Role Kustom
  app.delete('/api/roles/:id', async (req, res) => {
    try {
      const roleRows = await queryDB('SELECT * FROM sd_roles WHERE id = $1', [req.params.id]);
      if (!roleRows.length) return res.status(404).json({ error: 'Role tidak ditemukan' });
      const role = roleRows[0];

      if (role.is_locked) {
        return res.status(400).json({ error: `Role bawaan sistem (${role.nama}) tidak boleh dihapus` });
      }

      // Cek apakah masih ada user yang memakai role ini
      const users = await queryDB('SELECT COUNT(*)::int AS cnt FROM user_credentials WHERE LOWER(role) = LOWER($1)', [role.nama]);
      const userCount = users[0]?.cnt || 0;
      if (userCount > 0) {
        return res.status(400).json({
          error: `Tidak dapat menghapus: masih ada ${userCount} pengguna dengan role ${role.nama}. Pindahkan pengguna ke role lain terlebih dahulu.`,
        });
      }

      await queryDB('DELETE FROM sd_roles WHERE id = $1', [req.params.id]);
      res.json({ message: `Role "${role.nama}" berhasil dihapus` });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus role' });
    }
  });

  // Assign Pengguna ke Role Ini
  app.post('/api/roles/:id/users', async (req, res) => {
    const { nip } = req.body;
    if (!nip) return res.status(400).json({ error: 'NIP pengguna wajib disertakan' });

    try {
      const roleRows = await queryDB('SELECT * FROM sd_roles WHERE id = $1', [req.params.id]);
      if (!roleRows.length) return res.status(404).json({ error: 'Role tidak ditemukan' });
      const role = roleRows[0];

      await queryDB('UPDATE user_credentials SET role = $1 WHERE nip = $2', [role.nama, nip]);
      res.json({ message: `Pengguna berhasil ditugaskan ke peran ${role.nama}` });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menugaskan pengguna ke role' });
    }
  });
}
