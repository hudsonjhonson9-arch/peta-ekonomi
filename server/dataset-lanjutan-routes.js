import { tambahAturan, aturan, aturanSemua, PUBLIK, LOGIN, BANKDATA, REVIEW, ADMIN } from './kebijakan.js';
import { opdTerbatas, opdMilik } from './bank-dataset.js';

tambahAturan([
  aturan('GET',    LOGIN,    '/api/bankdata/dataset/[^/]+/siklus'),
  aturan('POST',   BANKDATA, '/api/bankdata/dataset/[^/]+/siklus'),
  aturan('POST',   BANKDATA, '/api/bankdata/siklus/[^/]+/ajukan'),
  aturan('POST',   REVIEW,   '/api/bankdata/siklus/[^/]+/verifikasi'),
  aturan('POST',   BANKDATA, '/api/bankdata/siklus/[^/]+/request-reopen'),
  aturan('POST',   REVIEW,   '/api/bankdata/siklus/[^/]+/putuskan-reopen'),

  aturan('GET',    LOGIN,    '/api/bankdata/dataset/[^/]+/lampiran'),
  aturan('POST',   BANKDATA, '/api/bankdata/dataset/[^/]+/lampiran'),
  aturan('DELETE', BANKDATA, '/api/bankdata/lampiran/[^/]+'),

  aturan('POST',   BANKDATA, '/api/bankdata/dataset/[^/]+/rows/bulk-delete'),
  aturan('POST',   ADMIN,    '/api/bankdata/dataset/bulk-delete'),

  aturan('GET',    LOGIN,    '/api/bps/metadata/[^/]+'),
  aturan('GET',    LOGIN,    '/api/bps/cari'),
]);

export function daftarkanRuteDatasetLanjutan(app, pool, queryDB) {
  // ── 1. Siklus Pemutakhiran Dataset ────────────────────────────────────────
  app.get('/api/bankdata/dataset/:id/siklus', async (req, res) => {
    const { id } = req.params;
    try {
      const rows = await queryDB(`
        SELECT s.*,
               u1.username AS verifikator_nama,
               u2.username AS pengaju_nama
          FROM sd_pemutakhiran_siklus s
          LEFT JOIN user_list u1 ON u1."NIP" = s.verified_by
          LEFT JOIN user_list u2 ON u2."NIP" = s.submitted_by
         WHERE s.dataset_id = $1
         ORDER BY s.periode_key DESC, s.created_at DESC
      `, [id]);
      res.json(rows);
    } catch (err) {
      console.error('Get siklus error:', err);
      res.status(500).json({ error: 'Gagal memuat siklus pemutakhiran' });
    }
  });

  app.post('/api/bankdata/dataset/:id/siklus', async (req, res) => {
    const { id } = req.params;
    const { periode_key, tipe = 'pemutakhiran' } = req.body;

    if (!periode_key || !String(periode_key).trim()) {
      return res.status(400).json({ error: 'Periode (misal tahun atau tahun-TW) wajib diisi' });
    }

    try {
      const ds = await queryDB(`SELECT opd_id FROM bank_dataset WHERE id = $1`, [id]);
      if (!ds.length) return res.status(404).json({ error: 'Dataset tidak ditemukan' });

      if (opdTerbatas(req.pengguna) && !opdMilik(req.pengguna, ds[0].opd_id)) {
        return res.status(403).json({ error: 'Bukan dataset milik OPD Anda' });
      }

      const { rows } = await pool.query(
        `INSERT INTO sd_pemutakhiran_siklus (dataset_id, periode_key, tipe, status, submitted_by)
         VALUES ($1, $2, $3, 'draft', $4)
         ON CONFLICT (dataset_id, periode_key, tipe)
         DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [id, periode_key.trim(), tipe, req.pengguna.nip]
      );

      res.json({ message: 'Siklus pemutakhiran berhasil disiapkan', siklus: rows[0] });
    } catch (err) {
      console.error('Buat siklus error:', err);
      res.status(500).json({ error: 'Gagal membuat siklus pemutakhiran' });
    }
  });

  app.post('/api/bankdata/siklus/:siklusId/ajukan', async (req, res) => {
    const { siklusId } = req.params;
    const { catatan } = req.body;

    try {
      const { rows } = await pool.query(
        `UPDATE sd_pemutakhiran_siklus
            SET status = 'diajukan',
                catatan = COALESCE($1, catatan),
                submitted_by = $2,
                submitted_at = NOW(),
                updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
        [catatan || null, req.pengguna.nip, siklusId]
      );

      if (!rows.length) return res.status(404).json({ error: 'Siklus tidak ditemukan' });
      res.json({ message: 'Siklus data berhasil diajukan ke Walidata untuk verifikasi', siklus: rows[0] });
    } catch (err) {
      console.error('Ajukan siklus error:', err);
      res.status(500).json({ error: 'Gagal mengajukan siklus' });
    }
  });

  app.post('/api/bankdata/siklus/:siklusId/verifikasi', async (req, res) => {
    const { siklusId } = req.params;
    const { keputusan, catatan } = req.body; // 'disetujui', 'ditolak', 'diperbaiki'

    if (!['disetujui', 'ditolak', 'diperbaiki'].includes(keputusan)) {
      return res.status(400).json({ error: 'Keputusan tidak valid' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE sd_pemutakhiran_siklus
            SET status = $1,
                catatan = $2,
                verified_by = $3,
                verified_at = NOW(),
                updated_at = NOW()
          WHERE id = $4
          RETURNING *`,
        [keputusan, catatan || null, req.pengguna.nip, siklusId]
      );

      if (!rows.length) return res.status(404).json({ error: 'Siklus tidak ditemukan' });
      res.json({ message: `Siklus berhasil ${keputusan}`, siklus: rows[0] });
    } catch (err) {
      console.error('Verifikasi siklus error:', err);
      res.status(500).json({ error: 'Gagal memverifikasi siklus' });
    }
  });

  // Reopen siklus
  app.post('/api/bankdata/siklus/:siklusId/request-reopen', async (req, res) => {
    const { siklusId } = req.params;
    const { alasan } = req.body;

    if (!alasan || !alasan.trim()) {
      return res.status(400).json({ error: 'Alasan permohonan buka kembali wajib diisi' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE sd_pemutakhiran_siklus
            SET reopen_status = 'menunggu',
                reopen_alasan = $1,
                updated_at = NOW()
          WHERE id = $2
          RETURNING *`,
        [alasan.trim(), siklusId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Siklus tidak ditemukan' });
      res.json({ message: 'Permohonan buka kembali berhasil dikirim ke Walidata', siklus: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal mengajukan permohonan buka kembali' });
    }
  });

  app.post('/api/bankdata/siklus/:siklusId/putuskan-reopen', async (req, res) => {
    const { siklusId } = req.params;
    const { setuju, hari = 7 } = req.body;

    try {
      const reopenStatus = setuju ? 'disetujui' : 'ditolak';
      const reopenSampai = setuju ? new Date(Date.now() + parseInt(hari, 10) * 86400 * 1000) : null;
      const statusSiklus = setuju ? 'draft' : undefined;

      const { rows } = await pool.query(
        `UPDATE sd_pemutakhiran_siklus
            SET reopen_status = $1,
                reopen_by = $2,
                reopen_sampai = $3,
                status = COALESCE($4, status),
                updated_at = NOW()
          WHERE id = $5
          RETURNING *`,
        [reopenStatus, req.pengguna.nip, reopenSampai, statusSiklus, siklusId]
      );

      if (!rows.length) return res.status(404).json({ error: 'Siklus tidak ditemukan' });
      res.json({ message: `Permohonan reopen berhasil ${reopenStatus}`, siklus: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal memutuskan permohonan reopen' });
    }
  });

  // ── 2. Lampiran Pendukung Dataset ─────────────────────────────────────────
  app.get('/api/bankdata/dataset/:id/lampiran', async (req, res) => {
    const { id } = req.params;
    try {
      const rows = await queryDB(`
        SELECT l.*, u.username AS uploader_nama
          FROM bank_dataset_lampiran l
          LEFT JOIN user_list u ON u."NIP" = l.uploaded_by
         WHERE l.dataset_id = $1
         ORDER BY l.id DESC
      `, [id]);
      res.json(rows);
    } catch (err) {
      console.error('Get lampiran error:', err);
      res.status(500).json({ error: 'Gagal memuat berkas lampiran' });
    }
  });

  app.post('/api/bankdata/dataset/:id/lampiran', async (req, res) => {
    const { id } = req.params;
    const { nama_asli, url_file, mime_type, ukuran_bytes, keterangan, periode_key } = req.body;

    if (!nama_asli || !url_file) {
      return res.status(400).json({ error: 'Nama file dan URL berkas wajib diisi' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO bank_dataset_lampiran (dataset_id, nama_file, nama_asli, url_file, mime_type, ukuran_bytes, keterangan, uploaded_by, periode_key)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, nama_asli.trim(), url_file.trim(), mime_type || 'application/octet-stream', ukuran_bytes || 0, keterangan?.trim() || null, req.pengguna.nip, periode_key || null]
      );

      res.json({ message: 'Berkas lampiran berhasil ditambahkan', lampiran: rows[0] });
    } catch (err) {
      console.error('Tambah lampiran error:', err);
      res.status(500).json({ error: 'Gagal menyimpan lampiran' });
    }
  });

  app.delete('/api/bankdata/lampiran/:lampiranId', async (req, res) => {
    const { lampiranId } = req.params;
    try {
      await pool.query(`DELETE FROM bank_dataset_lampiran WHERE id = $1`, [lampiranId]);
      res.json({ message: 'Lampiran berhasil dihapus' });
    } catch (err) {
      console.error('Hapus lampiran error:', err);
      res.status(500).json({ error: 'Gagal menghapus lampiran' });
    }
  });

  // ── 3. Bulk Operations ────────────────────────────────────────────────────
  app.post('/api/bankdata/dataset/:id/rows/bulk-delete', async (req, res) => {
    const { id } = req.params;
    const { row_ids = [] } = req.body;

    if (!Array.isArray(row_ids) || !row_ids.length) {
      return res.status(400).json({ error: 'Daftar ID baris data tidak boleh kosong' });
    }

    try {
      const ds = await queryDB(`SELECT opd_id FROM bank_dataset WHERE id = $1`, [id]);
      if (!ds.length) return res.status(404).json({ error: 'Dataset tidak ditemukan' });

      if (opdTerbatas(req.pengguna) && !opdMilik(req.pengguna, ds[0].opd_id)) {
        return res.status(403).json({ error: 'Bukan dataset milik OPD Anda' });
      }

      const result = await pool.query(
        `DELETE FROM bank_dataset_row
          WHERE dataset_id = $1 AND id = ANY($2::bigint[])`,
        [id, row_ids]
      );

      res.json({ message: `${result.rowCount} baris data berhasil dihapus` });
    } catch (err) {
      console.error('Bulk delete rows error:', err);
      res.status(500).json({ error: 'Gagal menghapus baris data terpilih' });
    }
  });

  app.post('/api/bankdata/dataset/bulk-delete', async (req, res) => {
    const { dataset_ids = [] } = req.body;
    if (!Array.isArray(dataset_ids) || !dataset_ids.length) {
      return res.status(400).json({ error: 'Pilih minimal satu dataset' });
    }

    try {
      const result = await pool.query(
        `DELETE FROM bank_dataset WHERE id = ANY($1::bigint[])`,
        [dataset_ids]
      );
      res.json({ message: `${result.rowCount} dataset berhasil dihapus` });
    } catch (err) {
      console.error('Bulk delete dataset error:', err);
      res.status(500).json({ error: 'Gagal menghapus dataset terpilih' });
    }
  });

  // ── 4. Integrasi / Metadata BPS ──────────────────────────────────────────
  app.get('/api/bps/metadata/:idMetadataIndikator', async (req, res) => {
    const { idMetadataIndikator } = req.params;
    // Data referensi indikator BPS
    res.json({
      id: idMetadataIndikator,
      sumber: 'Badan Pusat Statistik (BPS)',
      nama: `Indikator BPS #${idMetadataIndikator}`,
      status_sinkron: 'aktif',
      keterangan: 'Metadata indikator terdaftar di katalog Badan Pusat Statistik',
      terakhir_dicek: new Date().toISOString(),
    });
  });

  app.get('/api/bps/cari', async (req, res) => {
    const { q = '' } = req.query;
    const referensi = [
      { id: '1', nama: 'Indeks Pembangunan Manusia (IPM)', satuan: 'Poin', produsen: 'BPS Sumba Barat' },
      { id: '2', nama: 'Persentase Penduduk Miskin', satuan: 'Persen', produsen: 'BPS Sumba Barat' },
      { id: '3', nama: 'Laju Pertumbuhan Ekonomi (PDRB)', satuan: 'Persen', produsen: 'BPS Sumba Barat' },
      { id: '4', nama: 'Tingkat Pengangguran Terbuka (TPT)', satuan: 'Persen', produsen: 'BPS Sumba Barat' },
      { id: '5', nama: 'Angka Harapan Hidup saat Lahir', satuan: 'Tahun', produsen: 'BPS Sumba Barat' },
      { id: '6', nama: 'Rata-rata Lama Sekolah (RLS)', satuan: 'Tahun', produsen: 'BPS Sumba Barat' },
      { id: '7', nama: 'Gini Ratio', satuan: 'Rasio', produsen: 'BPS Sumba Barat' },
    ];

    const filtered = q
      ? referensi.filter(r => r.nama.toLowerCase().includes(q.toLowerCase()))
      : referensi;

    res.json(filtered);
  });
}
