import { tambahAturan, aturan, aturanSemua, PUBLIK, ADMIN } from './kebijakan.js';

tambahAturan([
  aturan('GET',  PUBLIK, '/api/portal/pengaturan'),
  aturan('GET',  ADMIN,  '/api/admin/pengaturan'),
  aturan('PUT',  ADMIN,  '/api/admin/pengaturan/draft'),
  aturan('POST', ADMIN,  '/api/admin/pengaturan/terbitkan'),
  aturan('GET',  ADMIN,  '/api/admin/pengaturan/riwayat'),
  aturan('POST', ADMIN,  '/api/admin/pengaturan/riwayat/[^/]+/rollback'),
  aturan('GET',  ADMIN,  '/api/admin/pengaturan/aset'),
  aturan('POST', ADMIN,  '/api/admin/pengaturan/aset'),
  aturan('DELETE', ADMIN, '/api/admin/pengaturan/aset/[^/]+'),
]);

export function daftarkanRutePengaturanSitus(app, pool, queryDB) {
  // ── 1. Setelan Publik Aktif (Published) ───────────────────────────────────
  app.get('/api/portal/pengaturan', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT payload, schema_version, published_at
          FROM site_setting_revisions
         WHERE status = 'published'
         ORDER BY id DESC
         LIMIT 1
      `);

      if (!rows.length) {
        return res.json({
          identitas: {
            nama_portal: 'Portal Satu Data BAPPERIDA Sumba Barat',
            nama_daerah: 'Kabupaten Sumba Barat',
            instansi: 'Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah',
            deskripsi: 'Portal Resmi Satu Data Kabupaten Sumba Barat',
          },
          tema: {
            preset: 'emerald',
            warna_primer: '#059669',
            font: 'Plus Jakarta Sans',
          },
        });
      }

      res.json(rows[0].payload);
    } catch (err) {
      console.error('Get public settings error:', err);
      res.status(500).json({ error: 'Gagal memuat setelan situs' });
    }
  });

  // ── 2. Setelan Admin (Draft / Published Aktif) ────────────────────────────
  app.get('/api/admin/pengaturan', async (_, res) => {
    try {
      // Prioritaskan draft yang belum diterbitkan jika ada
      const draft = await queryDB(`
        SELECT id, status, payload, note, lock_version, updated_at
          FROM site_setting_revisions
         WHERE status = 'draft'
         ORDER BY id DESC
         LIMIT 1
      `);

      const published = await queryDB(`
        SELECT id, status, payload, note, published_at, published_by
          FROM site_setting_revisions
         WHERE status = 'published'
         ORDER BY id DESC
         LIMIT 1
      `);

      res.json({
        draft: draft[0] || null,
        published: published[0] || null,
        aktif: draft[0] || published[0] || null,
      });
    } catch (err) {
      console.error('Get admin settings error:', err);
      res.status(500).json({ error: 'Gagal memuat konfigurasi' });
    }
  });

  // Simpan Draft
  app.put('/api/admin/pengaturan/draft', async (req, res) => {
    const { payload, note } = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload konfigurasi tidak valid' });
    }

    try {
      // Cek apakah sudah ada draft yang aktif
      const existingDraft = await queryDB(`
        SELECT id, lock_version FROM site_setting_revisions WHERE status = 'draft' LIMIT 1
      `);

      let saved;
      if (existingDraft.length) {
        const { rows } = await pool.query(
          `UPDATE site_setting_revisions
              SET payload = $1,
                  note = COALESCE($2, note),
                  lock_version = lock_version + 1,
                  updated_by = $3,
                  updated_at = NOW()
            WHERE id = $4
            RETURNING *`,
          [payload, note || 'Draft diperbarui', req.pengguna.nip, existingDraft[0].id]
        );
        saved = rows[0];
      } else {
        const { rows } = await pool.query(
          `INSERT INTO site_setting_revisions (status, payload, note, created_by, updated_by)
           VALUES ('draft', $1, $2, $3, $3)
           RETURNING *`,
          [payload, note || 'Draft baru', req.pengguna.nip]
        );
        saved = rows[0];
      }

      res.json({ message: 'Draft konfigurasi website berhasil disimpan', revision: saved });
    } catch (err) {
      console.error('Save draft error:', err);
      res.status(500).json({ error: 'Gagal menyimpan draft konfigurasi' });
    }
  });

  // Terbitkan (Publish)
  app.post('/api/admin/pengaturan/terbitkan', async (req, res) => {
    const { note } = req.body;

    try {
      // Ambil draft terkini
      const draft = await queryDB(`
        SELECT * FROM site_setting_revisions WHERE status = 'draft' ORDER BY id DESC LIMIT 1
      `);

      if (!draft.length) {
        return res.status(400).json({ error: 'Tidak ada perubahan draft yang siap diterbitkan' });
      }

      // Arsipkan konfigurasi published sebelumnya
      await pool.query(`UPDATE site_setting_revisions SET status = 'archived' WHERE status = 'published'`);

      // Ubah status draft menjadi published
      const { rows } = await pool.query(
        `UPDATE site_setting_revisions
            SET status = 'published',
                note = COALESCE($1, note),
                published_by = $2,
                published_at = NOW(),
                updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
        [note || 'Diterbitkan ke portal publik', req.pengguna.nip, draft[0].id]
      );

      res.json({ message: 'Konfigurasi website berhasil diterbitkan ke portal publik', published: rows[0] });
    } catch (err) {
      console.error('Publish settings error:', err);
      res.status(500).json({ error: 'Gagal menerbitkan konfigurasi' });
    }
  });

  // Riwayat Revisi
  app.get('/api/admin/pengaturan/riwayat', async (_, res) => {
    try {
      const rows = await queryDB(`
        SELECT r.id, r.status, r.note, r.published_at, r.created_at, r.published_by,
               u.username AS publisher_nama
          FROM site_setting_revisions r
          LEFT JOIN user_list u ON u."NIP" = r.published_by
         WHERE r.status IN ('published', 'archived')
         ORDER BY r.published_at DESC NULLS LAST, r.id DESC
         LIMIT 25
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Gagal mengambil riwayat revisi' });
    }
  });

  // Rollback ke revisi masa lalu
  app.post('/api/admin/pengaturan/riwayat/:revisionId/rollback', async (req, res) => {
    const { revisionId } = req.params;

    try {
      const target = await queryDB(`SELECT * FROM site_setting_revisions WHERE id = $1`, [revisionId]);
      if (!target.length) {
        return res.status(404).json({ error: 'Revisi target tidak ditemukan' });
      }

      // Buat draft baru dari payload revisi masa lalu
      await pool.query(`DELETE FROM site_setting_revisions WHERE status = 'draft'`);

      const { rows } = await pool.query(
        `INSERT INTO site_setting_revisions (status, payload, note, created_by, updated_by)
         VALUES ('draft', $1, $2, $3, $3)
         RETURNING *`,
        [target[0].payload, `Dipulihkan dari Revisi #${revisionId} (${target[0].note || ''})`, req.pengguna.nip]
      );

      res.json({ message: `Berhasil memuat revisi #${revisionId} ke dalam draft. Silakan periksa dan terbitkan.`, draft: rows[0] });
    } catch (err) {
      console.error('Rollback error:', err);
      res.status(500).json({ error: 'Gagal melakukan rollback' });
    }
  });

  // ── 3. Pengelolaan Aset Website ───────────────────────────────────────────
  app.get('/api/admin/pengaturan/aset', async (_, res) => {
    try {
      const rows = await queryDB(`SELECT * FROM site_assets ORDER BY id DESC LIMIT 50`);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memuat daftar aset' });
    }
  });

  app.post('/api/admin/pengaturan/aset', async (req, res) => {
    const { path, original_name, mime, size, width, height } = req.body;

    if (!path || !original_name) {
      return res.status(400).json({ error: 'Path dan nama aset diperlukan' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO site_assets (path, original_name, mime, size, width, height, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [path, original_name, mime || 'image/png', size || 0, width || null, height || null, req.pengguna.nip]
      );
      res.json({ message: 'Aset berhasil dicatat', aset: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menyimpan data aset' });
    }
  });

  app.delete('/api/admin/pengaturan/aset/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query(`DELETE FROM site_assets WHERE id = $1`, [id]);
      res.json({ message: 'Aset berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ error: 'Gagal menghapus aset' });
    }
  });
}
