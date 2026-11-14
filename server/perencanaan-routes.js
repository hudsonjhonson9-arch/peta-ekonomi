import { tambahAturan, aturan, aturanSemua, LOGIN, ADMIN } from './kebijakan.js';

tambahAturan([
  aturan('DELETE', ADMIN, '/api/perencanaan/progres/[^/]+'),
  aturanSemua(LOGIN, '/api/perencanaan(/[^/]+)*'),
]);

export const VALID_DOKUMEN_JENIS = ['RKPD', 'RPJMD', 'RPJPD', 'RENJA', 'RENSTRA'];
export const VALID_STATUS = ['todo', 'in_progress', 'review', 'done'];

export function buildPermendagri86Template(dokumenJenis = 'RKPD', tahun = new Date().getFullYear()) {
  const y = Number(tahun) || new Date().getFullYear();
  const prev = y - 1;
  const jenis = VALID_DOKUMEN_JENIS.includes(String(dokumenJenis).toUpperCase())
    ? String(dokumenJenis).toUpperCase()
    : 'RKPD';

  if (jenis === 'RKPD') {
    return [
      {
        tahap_kode: 'RKPD-01',
        urutan: 1,
        nama_tahapan: 'Persiapan Penyusunan RKPD (Tim Penyusun, Orientasi & Agenda Kerja)',
        dasar_pasal: 'Permendagri 86/2017 Pasal 73–76',
        pic_bidang: 'Sekretariat / Bidang PPEP',
        tgl_mulai: `${prev}-11-15`,
        tgl_selesai: `${prev}-12-07`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'SK Tim Penyusun RKPD & Agenda Kerja',
      },
      {
        tahap_kode: 'RKPD-02',
        urutan: 2,
        nama_tahapan: 'Penyusunan Rancangan Awal (Ranwal) RKPD & Analisis Gambaran Umum',
        dasar_pasal: 'Permendagri 86/2017 Pasal 77–81',
        pic_bidang: 'Bidang PPEP',
        tgl_mulai: `${y}-01-02`,
        tgl_selesai: `${y}-01-25`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'Dokumen Rancangan Awal RKPD',
      },
      {
        tahap_kode: 'RKPD-03',
        urutan: 3,
        nama_tahapan: 'Forum Konsultasi Publik Rancangan Awal RKPD',
        dasar_pasal: 'Permendagri 86/2017 Pasal 80',
        pic_bidang: 'Bidang PPEP & Semua Bidang',
        tgl_mulai: `${y}-01-20`,
        tgl_selesai: `${y}-02-10`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'Berita Acara Kesepakatan Forum Konsultasi Publik',
      },
      {
        tahap_kode: 'RKPD-04',
        urutan: 4,
        nama_tahapan: 'Verifikasi Rancangan Renja PD & Penyusunan Rancangan RKPD',
        dasar_pasal: 'Permendagri 86/2017 Pasal 82–88',
        pic_bidang: 'Bidang Teknis & PPEP',
        tgl_mulai: `${y}-02-11`,
        tgl_selesai: `${y}-03-15`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'Dokumen Rancangan RKPD & Hasil Verifikasi Renja PD',
      },
      {
        tahap_kode: 'RKPD-05',
        urutan: 5,
        nama_tahapan: 'Pelaksanaan Musrenbang RKPD (Kecamatan s.d. Kabupaten)',
        dasar_pasal: 'Permendagri 86/2017 Pasal 89–98',
        pic_bidang: 'Semua Bidang',
        tgl_mulai: `${y}-02-15`,
        tgl_selesai: `${y}-03-31`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'Berita Acara Kesepakatan Musrenbang RKPD',
      },
      {
        tahap_kode: 'RKPD-06',
        urutan: 6,
        nama_tahapan: 'Perumusan Rancangan Akhir RKPD & Reviu APIP (Inspektorat)',
        dasar_pasal: 'Permendagri 86/2017 Pasal 99–101',
        pic_bidang: 'Bidang PPEP',
        tgl_mulai: `${y}-04-01`,
        tgl_selesai: `${y}-05-15`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'Rancangan Akhir RKPD & Catatan Hasil Reviu APIP',
      },
      {
        tahap_kode: 'RKPD-07',
        urutan: 7,
        nama_tahapan: 'Fasilitasi Provinsi & Penetapan Perkada (Perbup) RKPD',
        dasar_pasal: 'Permendagri 86/2017 Pasal 102–105',
        pic_bidang: 'Bidang PPEP & Sekretariat',
        tgl_mulai: `${y}-05-16`,
        tgl_selesai: `${y}-06-30`,
        status: 'todo',
        progres_persen: 0,
        target_keluaran: 'Peraturan Kepala Daerah tentang RKPD',
      },
    ];
  }

  if (jenis === 'RPJMD') {
    return [
      { tahap_kode: 'RPJMD-01', urutan: 1, nama_tahapan: 'Penyusunan Rancangan Teknokratik & Persiapan Tim RPJMD', dasar_pasal: 'Permendagri 86/2017 Pasal 42–46', pic_bidang: 'Bidang PPEP', tgl_mulai: `${y}-01-05`, tgl_selesai: `${y}-02-15`, status: 'todo', progres_persen: 0, target_keluaran: 'Dokumen Rancangan Teknokratik RPJMD' },
      { tahap_kode: 'RPJMD-02', urutan: 2, nama_tahapan: 'Penyusunan Rancangan Awal RPJMD & Konsultasi Publik', dasar_pasal: 'Permendagri 86/2017 Pasal 47–51', pic_bidang: 'Semua Bidang', tgl_mulai: `${y}-02-16`, tgl_selesai: `${y}-03-31`, status: 'todo', progres_persen: 0, target_keluaran: 'Ranwal RPJMD & BA Konsultasi Publik' },
      { tahap_kode: 'RPJMD-03', urutan: 3, nama_tahapan: 'Pembahasan & Nota Kesepakatan Ranwal RPJMD dengan DPRD (H+40)', dasar_pasal: 'Permendagri 86/2017 Pasal 49–50', pic_bidang: 'Pimpinan & PPEP', tgl_mulai: `${y}-03-15`, tgl_selesai: `${y}-04-15`, status: 'todo', progres_persen: 0, target_keluaran: 'Nota Kesepakatan DPRD' },
      { tahap_kode: 'RPJMD-04', urutan: 4, nama_tahapan: 'Konsultasi Ranwal RPJMD ke Gubernur / Kemendagri (H+50)', dasar_pasal: 'Permendagri 86/2017 Pasal 52–54', pic_bidang: 'Bidang PPEP', tgl_mulai: `${y}-04-16`, tgl_selesai: `${y}-04-30`, status: 'todo', progres_persen: 0, target_keluaran: 'Surat Hasil Konsultasi Ranwal' },
      { tahap_kode: 'RPJMD-05', urutan: 5, nama_tahapan: 'Musrenbang RPJMD & Perumusan Rancangan Akhir RPJMD', dasar_pasal: 'Permendagri 86/2017 Pasal 61–67', pic_bidang: 'Semua Bidang', tgl_mulai: `${y}-05-01`, tgl_selesai: `${y}-05-31`, status: 'todo', progres_persen: 0, target_keluaran: 'Rancangan Akhir RPJMD & BA Musrenbang' },
      { tahap_kode: 'RPJMD-06', urutan: 6, nama_tahapan: 'Evaluasi Raperda RPJMD & Penetapan Perda (Maks. 6 Bulan)', dasar_pasal: 'Permendagri 86/2017 Pasal 68–72', pic_bidang: 'Sekretariat & PPEP', tgl_mulai: `${y}-06-01`, tgl_selesai: `${y}-06-30`, status: 'todo', progres_persen: 0, target_keluaran: 'Peraturan Daerah tentang RPJMD' },
    ];
  }

  if (jenis === 'RPJPD') {
    return [
      { tahap_kode: 'RPJPD-01', urutan: 1, nama_tahapan: 'Persiapan Penyusunan & Evaluasi RPJPD Periode Sebelumnya', dasar_pasal: 'Permendagri 86/2017 Pasal 18–21', pic_bidang: 'Bidang PPEP', tgl_mulai: `${y}-01-05`, tgl_selesai: `${y}-02-28`, status: 'todo', progres_persen: 0, target_keluaran: 'SK Tim & Laporan Evaluasi RPJPD' },
      { tahap_kode: 'RPJPD-02', urutan: 2, nama_tahapan: 'Penyusunan Rancangan Awal RPJPD & Konsultasi Publik', dasar_pasal: 'Permendagri 86/2017 Pasal 22–26', pic_bidang: 'Bidang PPEP', tgl_mulai: `${y}-03-01`, tgl_selesai: `${y}-04-30`, status: 'todo', progres_persen: 0, target_keluaran: 'Dokumen Ranwal RPJPD' },
      { tahap_kode: 'RPJPD-03', urutan: 3, nama_tahapan: 'Musrenbang RPJPD & Perumusan Rancangan Akhir', dasar_pasal: 'Permendagri 86/2017 Pasal 27–33', pic_bidang: 'Semua Bidang', tgl_mulai: `${y}-05-01`, tgl_selesai: `${y}-06-30`, status: 'todo', progres_persen: 0, target_keluaran: 'BA Musrenbang & Rancangan Akhir RPJPD' },
      { tahap_kode: 'RPJPD-04', urutan: 4, nama_tahapan: 'Pembahasan Raperda, Evaluasi & Penetapan Perda RPJPD', dasar_pasal: 'Permendagri 86/2017 Pasal 34–38', pic_bidang: 'Sekretariat & PPEP', tgl_mulai: `${y}-07-01`, tgl_selesai: `${y}-09-30`, status: 'todo', progres_persen: 0, target_keluaran: 'Peraturan Daerah tentang RPJPD' },
    ];
  }

  if (jenis === 'RENJA') {
    return [
      { tahap_kode: 'RENJA-01', urutan: 1, nama_tahapan: 'Persiapan & Penyusunan Rancangan Awal Renja PD', dasar_pasal: 'Permendagri 86/2017 Pasal 125–129', pic_bidang: 'Subbag Program / PD', tgl_mulai: `${y}-01-10`, tgl_selesai: `${y}-02-15`, status: 'todo', progres_persen: 0, target_keluaran: 'Rancangan Awal Renja PD' },
      { tahap_kode: 'RENJA-02', urutan: 2, nama_tahapan: 'Forum Perangkat Daerah / Lintas PD', dasar_pasal: 'Permendagri 86/2017 Pasal 130–133', pic_bidang: 'Semua Bidang', tgl_mulai: `${y}-02-16`, tgl_selesai: `${y}-03-15`, status: 'todo', progres_persen: 0, target_keluaran: 'Berita Acara Forum PD' },
      { tahap_kode: 'RENJA-03', urutan: 3, nama_tahapan: 'Verifikasi Rancangan Renja PD terhadap Rancangan RKPD', dasar_pasal: 'Permendagri 86/2017 Pasal 134–138', pic_bidang: 'Bidang Teknis Bapperida', tgl_mulai: `${y}-03-16`, tgl_selesai: `${y}-05-15`, status: 'todo', progres_persen: 0, target_keluaran: 'Catatan Hasil Verifikasi Renja PD' },
      { tahap_kode: 'RENJA-04', urutan: 4, nama_tahapan: 'Penetapan Renja PD (Maks. 1 Bulan Pasca Perkada RKPD)', dasar_pasal: 'Permendagri 86/2017 Pasal 139–142', pic_bidang: 'Pimpinan PD', tgl_mulai: `${y}-06-15`, tgl_selesai: `${y}-07-31`, status: 'todo', progres_persen: 0, target_keluaran: 'Dokumen Renja PD Final' },
    ];
  }

  // RENSTRA
  return [
    { tahap_kode: 'RENSTRA-01', urutan: 1, nama_tahapan: 'Persiapan & Penyusunan Rancangan Awal Renstra PD', dasar_pasal: 'Permendagri 86/2017 Pasal 106–112', pic_bidang: 'Subbag Program / PD', tgl_mulai: `${y}-01-15`, tgl_selesai: `${y}-03-15`, status: 'todo', progres_persen: 0, target_keluaran: 'Ranwal Renstra PD' },
    { tahap_kode: 'RENSTRA-02', urutan: 2, nama_tahapan: 'Forum Perangkat Daerah & Verifikasi Kesesuaian RPJMD', dasar_pasal: 'Permendagri 86/2017 Pasal 113–118', pic_bidang: 'Bidang Teknis Bapperida', tgl_mulai: `${y}-03-16`, tgl_selesai: `${y}-05-31`, status: 'todo', progres_persen: 0, target_keluaran: 'BA Forum PD & Hasil Verifikasi' },
    { tahap_kode: 'RENSTRA-03', urutan: 3, nama_tahapan: 'Perumusan Rancangan Akhir & Penetapan Renstra PD', dasar_pasal: 'Permendagri 86/2017 Pasal 119–124', pic_bidang: 'Pimpinan PD', tgl_mulai: `${y}-06-01`, tgl_selesai: `${y}-07-31`, status: 'todo', progres_persen: 0, target_keluaran: 'Perkada / SK Renstra PD' },
  ];
}

export function daftarkanRutePerencanaan(app, pool, queryDB) {
  queryDB(`
    CREATE TABLE IF NOT EXISTS perencanaan_progres (
      id SERIAL PRIMARY KEY,
      tahun INTEGER NOT NULL,
      dokumen_jenis VARCHAR(24) NOT NULL DEFAULT 'RKPD',
      tahap_kode VARCHAR(32) DEFAULT '',
      urutan INTEGER NOT NULL DEFAULT 1,
      nama_tahapan TEXT NOT NULL,
      dasar_pasal VARCHAR(120) DEFAULT '',
      pic_nama VARCHAR(120) DEFAULT '',
      pic_bidang VARCHAR(120) DEFAULT '',
      tgl_mulai DATE NOT NULL,
      tgl_selesai DATE NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'todo',
      progres_persen INTEGER NOT NULL DEFAULT 0,
      target_keluaran TEXT DEFAULT '',
      dokumen_url TEXT DEFAULT '',
      catatan TEXT DEFAULT '',
      created_by VARCHAR(120) DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `).catch(e => console.error('[Perencanaan] DDL Error:', e.message));

  app.get('/api/perencanaan/progres', async (req, res) => {
    try {
      const tahun = parseInt(req.query.tahun, 10) || new Date().getFullYear();
      const jenis = req.query.dokumen_jenis ? String(req.query.dokumen_jenis).toUpperCase() : null;
      const params = [tahun];
      let sql = `SELECT * FROM perencanaan_progres WHERE tahun = $1`;
      if (jenis && VALID_DOKUMEN_JENIS.includes(jenis)) {
        params.push(jenis);
        sql += ` AND dokumen_jenis = $2`;
      }
      sql += ` ORDER BY urutan ASC, tgl_mulai ASC, id ASC`;
      const items = await queryDB(sql, params);
      res.json({ ok: true, items, tahun, dokumen_jenis: jenis || 'ALL' });
    } catch (e) {
      console.error('[Perencanaan] GET Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal memuat progres perencanaan' });
    }
  });

  app.post('/api/perencanaan/progres/seed-template', async (req, res) => {
    try {
      const tahun = parseInt(req.body?.tahun, 10) || new Date().getFullYear();
      const jenis = String(req.body?.dokumen_jenis || 'RKPD').toUpperCase();
      if (!VALID_DOKUMEN_JENIS.includes(jenis)) {
        return res.status(400).json({ ok: false, message: 'dokumen_jenis tidak valid' });
      }
      const existing = await queryDB(
        `SELECT COUNT(*)::int AS n FROM perencanaan_progres WHERE tahun = $1 AND dokumen_jenis = $2`,
        [tahun, jenis]
      );
      if ((existing[0]?.n || 0) > 0 && !req.body?.force) {
        return res.status(409).json({ ok: false, message: `Tahapan ${jenis} ${tahun} sudah ada.` });
      }
      const rows = buildPermendagri86Template(jenis, tahun);
      const creator = req.session?.user?.nama || req.session?.user?.nip || 'Admin';
      const inserted = [];
      for (const r of rows) {
        const out = await queryDB(
          `INSERT INTO perencanaan_progres
           (tahun, dokumen_jenis, tahap_kode, urutan, nama_tahapan, dasar_pasal, pic_bidang, tgl_mulai, tgl_selesai, status, progres_persen, target_keluaran, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [tahun, jenis, r.tahap_kode, r.urutan, r.nama_tahapan, r.dasar_pasal, r.pic_bidang, r.tgl_mulai, r.tgl_selesai, r.status, r.progres_persen, r.target_keluaran, creator]
        );
        if (out[0]) inserted.push(out[0]);
      }
      res.json({ ok: true, items: inserted });
    } catch (e) {
      console.error('[Perencanaan] Seed Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal memuat template Permendagri 86/2017' });
    }
  });

  app.post('/api/perencanaan/progres', async (req, res) => {
    try {
      const b = req.body || {};
      const tahun = parseInt(b.tahun, 10) || new Date().getFullYear();
      const dokumen_jenis = VALID_DOKUMEN_JENIS.includes(String(b.dokumen_jenis || 'RKPD').toUpperCase())
        ? String(b.dokumen_jenis || 'RKPD').toUpperCase()
        : 'RKPD';
      const nama_tahapan = String(b.nama_tahapan || '').trim();
      if (!nama_tahapan || !b.tgl_mulai || !b.tgl_selesai) {
        return res.status(400).json({ ok: false, message: 'Nama tahapan, tanggal mulai, dan tanggal selesai wajib diisi.' });
      }
      const status = VALID_STATUS.includes(b.status) ? b.status : 'todo';
      const progres_persen = status === 'done'
        ? 100
        : Math.max(0, Math.min(100, parseInt(b.progres_persen, 10) || 0));
      const creator = req.session?.user?.nama || req.session?.user?.nip || 'User';

      const rows = await queryDB(
        `INSERT INTO perencanaan_progres
         (tahun, dokumen_jenis, tahap_kode, urutan, nama_tahapan, dasar_pasal, pic_nama, pic_bidang, tgl_mulai, tgl_selesai, status, progres_persen, target_keluaran, dokumen_url, catatan, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          tahun,
          dokumen_jenis,
          String(b.tahap_kode || ''),
          parseInt(b.urutan, 10) || 1,
          nama_tahapan,
          String(b.dasar_pasal || ''),
          String(b.pic_nama || ''),
          String(b.pic_bidang || ''),
          b.tgl_mulai,
          b.tgl_selesai,
          status,
          progres_persen,
          String(b.target_keluaran || ''),
          String(b.dokumen_url || ''),
          String(b.catatan || ''),
          creator,
        ]
      );
      res.json({ ok: true, item: rows[0] });
    } catch (e) {
      console.error('[Perencanaan] POST Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal menambah tahapan perencanaan' });
    }
  });

  app.put('/api/perencanaan/progres/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const b = req.body || {};
      const status = b.status && VALID_STATUS.includes(b.status) ? b.status : undefined;
      const progres = b.progres_persen !== undefined
        ? Math.max(0, Math.min(100, parseInt(b.progres_persen, 10) || 0))
        : (status === 'done' ? 100 : (status === 'todo' ? 0 : undefined));

      const rows = await queryDB(
        `UPDATE perencanaan_progres SET
           tahap_kode = COALESCE($1, tahap_kode),
           urutan = COALESCE($2, urutan),
           nama_tahapan = COALESCE($3, nama_tahapan),
           dasar_pasal = COALESCE($4, dasar_pasal),
           pic_nama = COALESCE($5, pic_nama),
           pic_bidang = COALESCE($6, pic_bidang),
           tgl_mulai = COALESCE($7, tgl_mulai),
           tgl_selesai = COALESCE($8, tgl_selesai),
           status = COALESCE($9, status),
           progres_persen = COALESCE($10, progres_persen),
           target_keluaran = COALESCE($11, target_keluaran),
           dokumen_url = COALESCE($12, dokumen_url),
           catatan = COALESCE($13, catatan),
           updated_at = NOW()
         WHERE id = $14 RETURNING *`,
        [
          b.tahap_kode ?? null,
          b.urutan !== undefined ? parseInt(b.urutan, 10) : null,
          b.nama_tahapan ?? null,
          b.dasar_pasal ?? null,
          b.pic_nama ?? null,
          b.pic_bidang ?? null,
          b.tgl_mulai ?? null,
          b.tgl_selesai ?? null,
          status ?? null,
          progres ?? null,
          b.target_keluaran ?? null,
          b.dokumen_url ?? null,
          b.catatan ?? null,
          id,
        ]
      );
      if (!rows.length) return res.status(404).json({ ok: false, message: 'Tahapan tidak ditemukan' });
      res.json({ ok: true, item: rows[0] });
    } catch (e) {
      console.error('[Perencanaan] PUT Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal memperbarui tahapan perencanaan' });
    }
  });

  app.delete('/api/perencanaan/progres/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const rows = await queryDB(`DELETE FROM perencanaan_progres WHERE id = $1 RETURNING id`, [id]);
      if (!rows.length) return res.status(404).json({ ok: false, message: 'Tahapan tidak ditemukan' });
      res.json({ ok: true });
    } catch (e) {
      console.error('[Perencanaan] DELETE Error:', e);
      res.status(500).json({ ok: false, message: 'Gagal menghapus tahapan' });
    }
  });
}

