import { tambahAturan, aturan, aturanSemua, PUBLIK, LOGIN, BANKDATA, REVIEW, ADMIN } from './kebijakan.js';

// Hak akses rute agenda: semua rute agenda dapat diakses oleh pengguna yang sudah login (LOGIN)
// Aksi penghapusan fisik dibatasi untuk ADMIN
tambahAturan([
  aturan('DELETE', ADMIN, '/api/agenda/surat-masuk/[^/]+'),
  aturan('DELETE', ADMIN, '/api/agenda/surat-keluar/[^/]+'),
  aturan('DELETE', ADMIN, '/api/agenda/sppd/[^/]+'),
  aturanSemua(LOGIN, '/api/agenda(/[^/]+)*')
]);

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function formatBulanRomawi(bulan1Based) {
  const idx = Math.max(1, Math.min(12, parseInt(bulan1Based, 10) || 1)) - 1;
  return ROMAWI[idx];
}

export function formatNomorSuratKeluar(kode, noUrut, bulan, tahun) {
  const padUrut = String(noUrut).padStart(4, '0');
  const romawi = formatBulanRomawi(bulan);
  return `${kode || '050'}/${padUrut}/BAPPERIDA/${romawi}/${tahun}`;
}

export function daftarkanRuteAgenda(app, pool, queryDB) {
  // ════════════════════════════════════════════════════════
  // 1. AGENDA SURAT MASUK
  // ════════════════════════════════════════════════════════
  
  // List Surat Masuk
  app.get('/api/agenda/surat-masuk', async (req, res) => {
    try {
      const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
      const q = req.query.q ? `%${req.query.q.trim()}%` : null;
      const status = req.query.status || null;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

      let sql = `
        SELECT sm.*, 
               d.id as disposisi_id, d.status_tindaklanjut, d.diteruskan_kepada, d.batas_waktu
        FROM agenda_surat_masuk sm
        LEFT JOIN agenda_disposisi d ON d.surat_masuk_id = sm.id
        WHERE sm.tahun = $1
      `;
      const params = [tahun];
      let pIdx = 2;

      if (status) {
        sql += ` AND sm.status = $${pIdx++}`;
        params.push(status);
      }
      if (q) {
        sql += ` AND (sm.nomor_agenda ILIKE $${pIdx} OR sm.nomor_surat_asli ILIKE $${pIdx} OR sm.asal_surat ILIKE $${pIdx} OR sm.perihal ILIKE $${pIdx})`;
        params.push(q);
        pIdx++;
      }

      sql += ` ORDER BY sm.id DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
      params.push(limit, offset);

      const items = await queryDB(sql, params);
      const countRes = await queryDB(
        `SELECT COUNT(*)::int as total FROM agenda_surat_masuk WHERE tahun = $1`,
        [tahun]
      );

      res.json({
        ok: true,
        total: countRes[0]?.total || 0,
        items
      });
    } catch (e) {
      console.error('[Agenda] Get Surat Masuk Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal mengambil data surat masuk' });
    }
  });

  // Tambah Surat Masuk
  app.post('/api/agenda/surat-masuk', async (req, res) => {
    try {
      const {
        tahun = new Date().getFullYear(),
        tanggal_terima = new Date().toISOString().split('T')[0],
        nomor_surat_asli,
        tanggal_surat = new Date().toISOString().split('T')[0],
        asal_surat,
        perihal,
        sifat = 'Biasa',
        kode_klasifikasi = '005',
        jumlah_lampiran = '—',
        file_url = null,
        file_name = null
      } = req.body;

      if (!nomor_surat_asli || !asal_surat || !perihal) {
        return res.status(400).json({ ok: false, message: 'Nomor surat, asal surat, dan perihal wajib diisi.' });
      }

      // Hitung nomor agenda berurutan per tahun
      const lastAgenda = await queryDB(
        `SELECT COUNT(*)::int as n FROM agenda_surat_masuk WHERE tahun = $1`,
        [tahun]
      );
      const nextNo = (lastAgenda[0]?.n || 0) + 1;
      const nomor_agenda = `${String(nextNo).padStart(4, '0')}/SM/${tahun}`;

      const userCreator = req.session?.user?.nama || req.session?.user?.nip || 'Admin TU';

      const insertRes = await queryDB(
        `INSERT INTO agenda_surat_masuk 
         (tahun, nomor_agenda, tanggal_terima, nomor_surat_asli, tanggal_surat, asal_surat, perihal, sifat, kode_klasifikasi, jumlah_lampiran, file_url, file_name, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [tahun, nomor_agenda, tanggal_terima, nomor_surat_asli, tanggal_surat, asal_surat, perihal, sifat, kode_klasifikasi, jumlah_lampiran, file_url, file_name, userCreator]
      );

      res.json({ ok: true, item: insertRes[0] });
    } catch (e) {
      console.error('[Agenda] Post Surat Masuk Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal mencatat surat masuk' });
    }
  });

  // Update Surat Masuk
  app.put('/api/agenda/surat-masuk/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const {
        nomor_surat_asli,
        tanggal_surat,
        tanggal_terima,
        asal_surat,
        perihal,
        sifat,
        kode_klasifikasi,
        jumlah_lampiran,
        file_url,
        file_name,
        status
      } = req.body;

      const upRes = await queryDB(
        `UPDATE agenda_surat_masuk
         SET nomor_surat_asli = COALESCE($1, nomor_surat_asli),
             tanggal_surat = COALESCE($2, tanggal_surat),
             tanggal_terima = COALESCE($3, tanggal_terima),
             asal_surat = COALESCE($4, asal_surat),
             perihal = COALESCE($5, perihal),
             sifat = COALESCE($6, sifat),
             kode_klasifikasi = COALESCE($7, kode_klasifikasi),
             jumlah_lampiran = COALESCE($8, jumlah_lampiran),
             file_url = COALESCE($9, file_url),
             file_name = COALESCE($10, file_name),
             status = COALESCE($11, status),
             updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [nomor_surat_asli, tanggal_surat, tanggal_terima, asal_surat, perihal, sifat, kode_klasifikasi, jumlah_lampiran, file_url, file_name, status, id]
      );

      if (!upRes.length) return res.status(404).json({ ok: false, message: 'Surat masuk tidak ditemukan' });
      res.json({ ok: true, item: upRes[0] });
    } catch (e) {
      console.error('[Agenda] Update Surat Masuk Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal memperbarui surat masuk' });
    }
  });

  // Hapus Surat Masuk
  app.delete('/api/agenda/surat-masuk/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await queryDB(`DELETE FROM agenda_surat_masuk WHERE id = $1`, [id]);
      res.json({ ok: true, message: 'Surat masuk berhasil dihapus' });
    } catch (e) {
      console.error('[Agenda] Delete Surat Masuk Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal menghapus surat masuk' });
    }
  });

  // Disposisi Digital
  app.post('/api/agenda/surat-masuk/:id/disposisi', async (req, res) => {
    try {
      const surat_masuk_id = parseInt(req.params.id, 10);
      const {
        tanggal_disposisi = new Date().toISOString().split('T')[0],
        pemberi_disposisi = 'Kepala Badan',
        arahan = [],
        catatan_instruksi = '',
        diteruskan_kepada = [],
        batas_waktu = null,
        status_tindaklanjut = 'Didisposisikan'
      } = req.body;

      // Cek apakah sudah ada disposisi untuk surat ini
      const exist = await queryDB(
        `SELECT id FROM agenda_disposisi WHERE surat_masuk_id = $1`,
        [surat_masuk_id]
      );

      let dRes;
      if (exist.length) {
        dRes = await queryDB(
          `UPDATE agenda_disposisi
           SET tanggal_disposisi = $1,
               pemberi_disposisi = $2,
               arahan = $3::jsonb,
               catatan_instruksi = $4,
               diteruskan_kepada = $5::jsonb,
               batas_waktu = $6,
               status_tindaklanjut = $7,
               updated_at = NOW()
           WHERE surat_masuk_id = $8
           RETURNING *`,
          [tanggal_disposisi, pemberi_disposisi, JSON.stringify(arahan), catatan_instruksi, JSON.stringify(diteruskan_kepada), batas_waktu, status_tindaklanjut, surat_masuk_id]
        );
      } else {
        dRes = await queryDB(
          `INSERT INTO agenda_disposisi
           (surat_masuk_id, tanggal_disposisi, pemberi_disposisi, arahan, catatan_instruksi, diteruskan_kepada, batas_waktu, status_tindaklanjut)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8)
           RETURNING *`,
          [surat_masuk_id, tanggal_disposisi, pemberi_disposisi, JSON.stringify(arahan), catatan_instruksi, JSON.stringify(diteruskan_kepada), batas_waktu, status_tindaklanjut]
        );
      }

      // Update status surat masuk menjadi Didisposisi
      await queryDB(
        `UPDATE agenda_surat_masuk SET status = 'Didisposisi', updated_at = NOW() WHERE id = $1`,
        [surat_masuk_id]
      );

      res.json({ ok: true, disposisi: dRes[0] });
    } catch (e) {
      console.error('[Agenda] Disposisi Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal menyimpan disposisi' });
    }
  });

  // ════════════════════════════════════════════════════════
  // 2. AGENDA SURAT KELUAR
  // ════════════════════════════════════════════════════════
  
  // List Surat Keluar
  app.get('/api/agenda/surat-keluar', async (req, res) => {
    try {
      const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
      const q = req.query.q ? `%${req.query.q.trim()}%` : null;
      const bidang = req.query.bidang || null;
      const status = req.query.status || null;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

      let sql = `SELECT * FROM agenda_surat_keluar WHERE tahun = $1`;
      const params = [tahun];
      let pIdx = 2;

      if (bidang) {
        sql += ` AND bidang_pengonsep = $${pIdx++}`;
        params.push(bidang);
      }
      if (status) {
        sql += ` AND status = $${pIdx++}`;
        params.push(status);
      }
      if (q) {
        sql += ` AND (nomor_surat ILIKE $${pIdx} OR tujuan_surat ILIKE $${pIdx} OR perihal ILIKE $${pIdx})`;
        params.push(q);
        pIdx++;
      }

      sql += ` ORDER BY nomor_urut DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
      params.push(limit, offset);

      const items = await queryDB(sql, params);
      const countRes = await queryDB(
        `SELECT COUNT(*)::int as total FROM agenda_surat_keluar WHERE tahun = $1`,
        [tahun]
      );

      res.json({ ok: true, total: countRes[0]?.total || 0, items });
    } catch (e) {
      console.error('[Agenda] Get Surat Keluar Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal mengambil agenda surat keluar' });
    }
  });

  // Preview Nomor Surat Keluar Berikutnya
  app.get('/api/agenda/surat-keluar/preview-nomor', async (req, res) => {
    try {
      const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
      const kode = req.query.kode || '050';
      const bulan = parseInt(req.query.bulan, 10) || (new Date().getMonth() + 1);

      const maxRes = await queryDB(
        `SELECT COALESCE(MAX(nomor_urut), 0) + 1 as next_urut FROM agenda_surat_keluar WHERE tahun = $1`,
        [tahun]
      );
      const nextUrut = maxRes[0]?.next_urut || 1;
      const nomor_surat = formatNomorSuratKeluar(kode, nextUrut, bulan, tahun);

      res.json({
        ok: true,
        tahun,
        nomor_urut: nextUrut,
        nomor_surat
      });
    } catch (e) {
      console.error('[Agenda] Preview Nomor Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal menghasilkan pratinjau nomor surat' });
    }
  });

  // Booking Nomor Surat Keluar Baru (Atomik via Transaksi)
  app.post('/api/agenda/surat-keluar', async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        tahun = new Date().getFullYear(),
        tanggal_surat = new Date().toISOString().split('T')[0],
        kode_klasifikasi = '050',
        tujuan_surat,
        perihal,
        sifat = 'Biasa',
        bidang_pengonsep,
        penandatangan = 'Kepala Badan',
        surat_masuk_ref_id = null,
        file_draft_url = null,
        file_final_url = null,
        status = 'Draf'
      } = req.body;

      if (!tujuan_surat || !perihal || !bidang_pengonsep) {
        return res.status(400).json({ ok: false, message: 'Tujuan surat, perihal, dan bidang pengonsep wajib diisi.' });
      }

      await client.query('BEGIN');

      // Kunci urutan tahun menggunakan lock tabel agar tidak ada nomor ganda saat paralel
      const urutRes = await client.query(
        `SELECT COALESCE(MAX(nomor_urut), 0) + 1 as next_urut 
         FROM agenda_surat_keluar 
         WHERE tahun = $1`,
        [tahun]
      );
      const nextUrut = urutRes.rows[0]?.next_urut || 1;

      const bulan = new Date(tanggal_surat).getMonth() + 1;
      const nomor_surat = formatNomorSuratKeluar(kode_klasifikasi, nextUrut, bulan, tahun);
      const nomor_agenda = `${String(nextUrut).padStart(4, '0')}/SK/${tahun}`;
      const userCreator = req.session?.user?.nama || req.session?.user?.nip || 'Staf Bidang';

      const insRes = await client.query(
        `INSERT INTO agenda_surat_keluar
         (tahun, nomor_agenda, nomor_surat, kode_klasifikasi, nomor_urut, tanggal_surat, tujuan_surat, perihal, sifat, bidang_pengonsep, penandatangan, surat_masuk_ref_id, file_draft_url, file_final_url, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [tahun, nomor_agenda, nomor_surat, kode_klasifikasi, nextUrut, tanggal_surat, tujuan_surat, perihal, sifat, bidang_pengonsep, penandatangan, surat_masuk_ref_id, file_draft_url, file_final_url, status, userCreator]
      );

      await client.query('COMMIT');
      res.json({ ok: true, item: insRes.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[Agenda] Booking Surat Keluar Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal melakukan booking nomor surat keluar' });
    } finally {
      client.release();
    }
  });

  // Update Status / Berkas Surat Keluar
  app.put('/api/agenda/surat-keluar/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { tujuan_surat, perihal, sifat, bidang_pengonsep, penandatangan, file_draft_url, file_final_url, status } = req.body;

      const upRes = await queryDB(
        `UPDATE agenda_surat_keluar
         SET tujuan_surat = COALESCE($1, tujuan_surat),
             perihal = COALESCE($2, perihal),
             sifat = COALESCE($3, sifat),
             bidang_pengonsep = COALESCE($4, bidang_pengonsep),
             penandatangan = COALESCE($5, penandatangan),
             file_draft_url = COALESCE($6, file_draft_url),
             file_final_url = COALESCE($7, file_final_url),
             status = COALESCE($8, status),
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [tujuan_surat, perihal, sifat, bidang_pengonsep, penandatangan, file_draft_url, file_final_url, status, id]
      );

      if (!upRes.length) return res.status(404).json({ ok: false, message: 'Surat keluar tidak ditemukan' });
      res.json({ ok: true, item: upRes[0] });
    } catch (e) {
      console.error('[Agenda] Update Surat Keluar Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal memperbarui surat keluar' });
    }
  });

  // Batalkan Nomor Surat Keluar (Soft cancel agar urutan nomor tidak hilang)
  app.delete('/api/agenda/surat-keluar/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await queryDB(
        `UPDATE agenda_surat_keluar SET status = 'Dibatalkan', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      res.json({ ok: true, message: 'Nomor surat keluar telah ditandai Dibatalkan' });
    } catch (e) {
      console.error('[Agenda] Cancel Surat Keluar Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal membatalkan surat keluar' });
    }
  });

  // ════════════════════════════════════════════════════════
  // 3. BUKU REGISTER SPPD (DALAM & LUAR DAERAH)
  // ════════════════════════════════════════════════════════
  
  // List Register SPPD
  app.get('/api/agenda/sppd', async (req, res) => {
    try {
      const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
      const jenis = req.query.jenis; // 'DALAM_DAERAH' atau 'LUAR_DAERAH'
      const status = req.query.status || null;
      const q = req.query.q ? `%${req.query.q.trim()}%` : null;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

      let sql = `SELECT * FROM agenda_sppd WHERE tahun = $1`;
      const params = [tahun];
      let pIdx = 2;

      if (jenis) {
        sql += ` AND jenis_sppd = $${pIdx++}`;
        params.push(jenis);
      }
      if (status) {
        sql += ` AND status = $${pIdx++}`;
        params.push(status);
      }
      if (q) {
        sql += ` AND (nomor_spt ILIKE $${pIdx} OR nomor_sppd ILIKE $${pIdx} OR pelaksana_nama ILIKE $${pIdx} OR tempat_tujuan ILIKE $${pIdx} OR maksud_perjalanan ILIKE $${pIdx})`;
        params.push(q);
        pIdx++;
      }

      sql += ` ORDER BY id DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
      params.push(limit, offset);

      const items = await queryDB(sql, params);
      const countRes = await queryDB(
        `SELECT COUNT(*)::int as total FROM agenda_sppd WHERE tahun = $1 ${jenis ? 'AND jenis_sppd = $2' : ''}`,
        jenis ? [tahun, jenis] : [tahun]
      );

      res.json({ ok: true, total: countRes[0]?.total || 0, items });
    } catch (e) {
      console.error('[Agenda] Get SPPD Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal mengambil register SPPD' });
    }
  });

  // Pendaftaran SPT & SPPD Baru
  app.post('/api/agenda/sppd', async (req, res) => {
    try {
      const {
        jenis_sppd = 'DALAM_DAERAH',
        tahun = new Date().getFullYear(),
        nomor_spt,
        nomor_sppd,
        tanggal_spt = new Date().toISOString().split('T')[0],
        pejabat_perintah = 'Kepala Badan',
        pelaksana_nip,
        pelaksana_nama,
        pelaksana_pangkat = '',
        pelaksana_jabatan = '',
        pengikut = [],
        maksud_perjalanan,
        tempat_berangkat = 'Waikabubak',
        tempat_tujuan,
        provinsi_tujuan = null,
        rute_perjalanan = '',
        alat_angkutan = 'Darat',
        tanggal_berangkat,
        tanggal_kembali,
        subkegiatan_id = null,
        subkegiatan_nama = '',
        kode_rekening = '5.1.02.04.01.0001',
        rincian_biaya = {},
        total_biaya = 0,
        file_spt_url = null,
        file_sppd_url = null,
        surat_masuk_ref_id = null
      } = req.body;

      if (!pelaksana_nip || !pelaksana_nama || !maksud_perjalanan || !tempat_tujuan || !tanggal_berangkat || !tanggal_kembali) {
        return res.status(400).json({ ok: false, message: 'Data pelaksana, maksud, tujuan, dan tanggal perjalanan wajib diisi.' });
      }

      // Hitung lama hari perjalanan
      const t1 = new Date(tanggal_berangkat);
      const t2 = new Date(tanggal_kembali);
      const diffTime = Math.abs(t2 - t1);
      const lama_hari = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

      // Nomor Register
      const lastReg = await queryDB(
        `SELECT COUNT(*)::int as n FROM agenda_sppd WHERE tahun = $1 AND jenis_sppd = $2`,
        [tahun, jenis_sppd]
      );
      const nextNo = (lastReg[0]?.n || 0) + 1;
      const kodeSuffix = jenis_sppd === 'DALAM_DAERAH' ? 'SPPD-DD' : 'SPPD-LD';
      const nomor_register = `${String(nextNo).padStart(3, '0')}/${kodeSuffix}/${tahun}`;

      const userCreator = req.session?.user?.nama || req.session?.user?.nip || 'Staf';

      const insRes = await queryDB(
        `INSERT INTO agenda_sppd
         (jenis_sppd, tahun, nomor_register, nomor_spt, nomor_sppd, tanggal_spt, pejabat_perintah,
          pelaksana_nip, pelaksana_nama, pelaksana_pangkat, pelaksana_jabatan, pengikut,
          maksud_perjalanan, tempat_berangkat, tempat_tujuan, provinsi_tujuan, rute_perjalanan,
          alat_angkutan, tanggal_berangkat, tanggal_kembali, lama_hari,
          subkegiatan_id, subkegiatan_nama, kode_rekening, rincian_biaya, total_biaya,
          file_spt_url, file_sppd_url, surat_masuk_ref_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb, $26, $27, $28, $29, $30)
         RETURNING *`,
        [
          jenis_sppd, tahun, nomor_register, nomor_spt || nomor_register, nomor_sppd || nomor_register, tanggal_spt, pejabat_perintah,
          pelaksana_nip, pelaksana_nama, pelaksana_pangkat, pelaksana_jabatan, JSON.stringify(pengikut),
          maksud_perjalanan, tempat_berangkat, tempat_tujuan, provinsi_tujuan, rute_perjalanan,
          alat_angkutan, tanggal_berangkat, tanggal_kembali, lama_hari,
          subkegiatan_id, subkegiatan_nama, kode_rekening, JSON.stringify(rincian_biaya), total_biaya,
          file_spt_url, file_sppd_url, surat_masuk_ref_id, userCreator
        ]
      );

      res.json({ ok: true, item: insRes[0] });
    } catch (e) {
      console.error('[Agenda] Post SPPD Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal mendaftarkan SPPD' });
    }
  });

  // Update SPPD
  app.put('/api/agenda/sppd/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const fields = req.body;

      const upRes = await queryDB(
        `UPDATE agenda_sppd
         SET maksud_perjalanan = COALESCE($1, maksud_perjalanan),
             tempat_tujuan = COALESCE($2, tempat_tujuan),
             tanggal_berangkat = COALESCE($3, tanggal_berangkat),
             tanggal_kembali = COALESCE($4, tanggal_kembali),
             total_biaya = COALESCE($5, total_biaya),
             status = COALESCE($6, status),
             file_spt_url = COALESCE($7, file_spt_url),
             file_sppd_url = COALESCE($8, file_sppd_url),
             file_lhp_url = COALESCE($9, file_lhp_url),
             updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [fields.maksud_perjalanan, fields.tempat_tujuan, fields.tanggal_berangkat, fields.tanggal_kembali, fields.total_biaya, fields.status, fields.file_spt_url, fields.file_sppd_url, fields.file_lhp_url, id]
      );

      if (!upRes.length) return res.status(404).json({ ok: false, message: 'SPPD tidak ditemukan' });
      res.json({ ok: true, item: upRes[0] });
    } catch (e) {
      console.error('[Agenda] Update SPPD Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal memperbarui data SPPD' });
    }
  });

  // Upload LHP (Laporan Hasil Perjalanan Dinas)
  app.post('/api/agenda/sppd/:id/lhp', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { file_lhp_url } = req.body;
      if (!file_lhp_url) return res.status(400).json({ ok: false, message: 'URL berkas LHP wajib diisi' });

      const upRes = await queryDB(
        `UPDATE agenda_sppd SET file_lhp_url = $1, status = 'Laporan Masuk', updated_at = NOW() WHERE id = $2 RETURNING *`,
        [file_lhp_url, id]
      );
      res.json({ ok: true, item: upRes[0] });
    } catch (e) {
      console.error('[Agenda] Upload LHP Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal mengunggah LHP' });
    }
  });

  // Upload SPJ (Tiket, Hotel, dsb)
  app.post('/api/agenda/sppd/:id/spj', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { berkas_spj = [] } = req.body;

      const upRes = await queryDB(
        `UPDATE agenda_sppd SET berkas_spj = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(berkas_spj), id]
      );
      res.json({ ok: true, item: upRes[0] });
    } catch (e) {
      console.error('[Agenda] Upload SPJ Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal menyimpan berkas SPJ' });
    }
  });
}
