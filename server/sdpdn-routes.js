import crypto from 'crypto';
import { tambahAturan, aturanSemua, PUBLIK } from './kebijakan.js';

// Daftarkan hak akses publik untuk endpoint integrasi SDPDN dan dokumentasi API
tambahAturan([
  aturanSemua(PUBLIK, '/api/v1(/[^/]+)*'),
  aturanSemua(PUBLIK, '/api/documentation(/[^/]+)*'),
]);

export function daftarkanRuteSdpdn(app, pool, queryDB) {
  // Helper: ambil token dari Authorization header, x-api-key, atau query parameter
  const ekstrakBearerToken = (req) => {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
    if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
    if (req.query?.api_token) return String(req.query.api_token).trim();
    return null;
  };

  // Helper verifikasi token Sanctum/API Token
  const verifikasiApiToken = async (req, requiredAbility = 'dataset:read') => {
    const raw = ekstrakBearerToken(req);
    if (!raw) return { authenticated: false, token: null };

    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    try {
      const rows = await queryDB(
        `SELECT id, nama_token, token_prefix, abilities, expires_at, is_active
           FROM sd_api_token
          WHERE token_hash = $1
            AND is_active = true
            AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`,
        [hash]
      );
      if (!rows.length) {
        return { authenticated: false, error: 'Token API tidak valid atau telah kedaluwarsa' };
      }
      const tok = rows[0];
      if (tok.abilities) {
        const allowed = tok.abilities.split(',').map((s) => s.trim());
        if (!allowed.includes('*') && !allowed.includes(requiredAbility) && !allowed.includes('read:dataset')) {
          return { authenticated: false, error: `Token tidak memiliki izin (${requiredAbility})` };
        }
      }
      queryDB('UPDATE sd_api_token SET last_used_at = NOW() WHERE id = $1', [tok.id]).catch(() => {});
      return { authenticated: true, token: tok };
    } catch (e) {
      return { authenticated: false, error: e.message };
    }
  };

  // =========================================================================
  // 1. ENDPOINT LIST DATASET SEKTORAL RESMI SDPDN (/api/v1/dataset-sektoral)
  // =========================================================================
  app.get('/api/v1/dataset-sektoral', async (req, res) => {
    // Verifikasi token bila dikirim, atau izinkan akses terbuka untuk dataset berklasifikasi 'terbuka'
    const auth = await verifikasiApiToken(req);
    if (ekstrakBearerToken(req) && !auth.authenticated) {
      return res.status(401).json({
        message: auth.error || 'Autentikasi token gagal',
        code: 401,
      });
    }

    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 25));
      const offset = (page - 1) * perPage;
      const { tahun, kode_bidang_urusan, topic_slug, subtopic_slug, q } = req.query;

      const whereClauses = ["d.status = 'disetujui'", "d.klasifikasi = 'terbuka'"];
      const params = [];
      let idx = 1;

      if (q && q.trim()) {
        whereClauses.push(`(
          d.nama ILIKE $${idx} OR
          d.deskripsi ILIKE $${idx} OR
          o.nama ILIKE $${idx} OR
          d.kode_indikator ILIKE $${idx}
        )`);
        params.push(`%${q.trim()}%`);
        idx++;
      }

      if (kode_bidang_urusan) {
        whereClauses.push(`bu.kode_bidang = $${idx}`);
        params.push(kode_bidang_urusan);
        idx++;
      }

      if (topic_slug) {
        whereClauses.push(`(tp.slug = $${idx} OR LOWER(tp.nama_topik) = LOWER($${idx}))`);
        params.push(topic_slug);
        idx++;
      }

      if (subtopic_slug) {
        whereClauses.push(`(stp.slug = $${idx} OR LOWER(stp.nama_sub_topik) = LOWER($${idx}))`);
        params.push(subtopic_slug);
        idx++;
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Hitung total data
      const countRes = await queryDB(
        `SELECT COUNT(*)::int AS total
           FROM bank_dataset d
           JOIN bank_data_opd o ON o.id = d.opd_id
           LEFT JOIN sd_bidang_urusan bu ON bu.id = d.bidang_urusan_id
           LEFT JOIN sd_topik tp ON tp.id = d.topik_id
           LEFT JOIN sd_sub_topik stp ON stp.id = d.sub_topik_id
          ${whereSql}`,
        params
      );
      const totalData = countRes[0]?.total || 0;
      const totalPage = Math.max(1, Math.ceil(totalData / perPage));

      // Ambil daftar dataset
      const queryList = `
        SELECT d.id,
               COALESCE(d.kode_indikator, 'IND-5312-' || LPAD(d.id::text, 4, '0')) AS kode_indikator,
               d.nama AS nama_indikator,
               d.deskripsi AS definisi_operasional,
               d.satuan,
               d.frekuensi,
               COALESCE(d.polaritas, 'positif') AS polaritas,
               o.id AS opd_id,
               o.nama AS produsen_data,
               o.singkatan AS produsen_data_singkatan,
               o.kode_opd,
               u.nama_urusan AS urusan,
               bu.nama_bidang AS bidang_urusan,
               bu.kode_bidang AS kode_bidang_urusan,
               tp.nama_topik AS topik,
               stp.nama_sub_topik AS subtopik,
               d.verified_at,
               d.updated_at,
               (
                 SELECT ARRAY_AGG(DISTINCT r.tahun ORDER BY r.tahun ASC)
                   FROM bank_dataset_row r
                  WHERE r.dataset_id = d.id
               ) AS tahun_tersedia
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
          LEFT JOIN sd_urusan u ON u.id = d.urusan_id
          LEFT JOIN sd_bidang_urusan bu ON bu.id = d.bidang_urusan_id
          LEFT JOIN sd_topik tp ON tp.id = d.topik_id
          LEFT JOIN sd_sub_topik stp ON stp.id = d.sub_topik_id
         ${whereSql}
         ORDER BY d.verified_at DESC NULLS LAST, d.id DESC
         LIMIT $${idx} OFFSET $${idx + 1}
      `;
      const dataParams = [...params, perPage, offset];
      const rows = await queryDB(queryList, dataParams);

      // Filter tahun bila ada parameter query tahun
      let formatted = rows.map((r) => ({
        id: r.id,
        kode_indikator: r.kode_indikator,
        nama_indikator: r.nama_indikator,
        definisi_operasional: r.definisi_operasional || null,
        satuan: r.satuan || '-',
        frekuensi: r.frekuensi || 'Tahunan',
        polaritas: r.polaritas,
        produsen_data: r.produsen_data,
        kode_opd: r.kode_opd || null,
        urusan: r.urusan || null,
        bidang_urusan: r.bidang_urusan || null,
        kode_bidang_urusan: r.kode_bidang_urusan || null,
        topik: r.topik || null,
        subtopik: r.subtopik || null,
        tahun_tersedia: Array.isArray(r.tahun_tersedia) ? r.tahun_tersedia : [],
        updated_at: r.updated_at || r.verified_at,
      }));

      if (tahun) {
        const targetYear = parseInt(tahun, 10);
        formatted = formatted.filter((d) => d.tahun_tersedia.includes(targetYear));
      }

      res.json({
        message: 'Berhasil',
        code: 200,
        metadata: {
          total_data: totalData,
          total_page: totalPage,
          page,
          page_size: perPage,
          kabupaten_kota: 'Kabupaten Sumba Barat',
          kode_wilayah: '53.12',
          instansi_walidata: 'BAPPERIDA Kabupaten Sumba Barat',
        },
        data: formatted,
      });
    } catch (err) {
      console.error('SDPDN dataset list error:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server internal', code: 500, error: err.message });
    }
  });

  // =========================================================================
  // 2. ENDPOINT DETAIL DATASET SEKTORAL RESMI SDPDN (/api/v1/dataset-sektoral/:id)
  // =========================================================================
  app.get('/api/v1/dataset-sektoral/:id', async (req, res) => {
    const auth = await verifikasiApiToken(req);
    if (ekstrakBearerToken(req) && !auth.authenticated) {
      return res.status(401).json({ message: auth.error || 'Autentikasi token gagal', code: 401 });
    }

    const { id } = req.params;
    const { tahun, page = 1, per_page = 50 } = req.query;

    try {
      const isNum = /^\d+$/.test(id);
      const dsRows = await queryDB(
        `SELECT d.id,
                COALESCE(d.kode_indikator, 'IND-5312-' || LPAD(d.id::text, 4, '0')) AS kode_indikator,
                d.nama AS nama_indikator,
                d.deskripsi AS definisi_operasional,
                d.satuan,
                d.frekuensi,
                d.klasifikasi,
                COALESCE(d.polaritas, 'positif') AS polaritas,
                o.id AS opd_id,
                o.nama AS produsen_data,
                o.singkatan AS produsen_data_singkatan,
                o.kode_opd,
                u.nama_urusan AS urusan,
                bu.nama_bidang AS bidang_urusan,
                bu.kode_bidang AS kode_bidang_urusan,
                tp.nama_topik AS topik,
                stp.nama_sub_topik AS subtopik,
                d.verified_at,
                d.updated_at
           FROM bank_dataset d
           JOIN bank_data_opd o ON o.id = d.opd_id
           LEFT JOIN sd_urusan u ON u.id = d.urusan_id
           LEFT JOIN sd_bidang_urusan bu ON bu.id = d.bidang_urusan_id
           LEFT JOIN sd_topik tp ON tp.id = d.topik_id
           LEFT JOIN sd_sub_topik stp ON stp.id = d.sub_topik_id
          WHERE ${isNum ? 'd.id = $1' : 'd.kode_indikator = $1'}
            AND d.status = 'disetujui'
            AND d.klasifikasi = 'terbuka'`,
        [id]
      );

      if (!dsRows.length) {
        return res.status(404).json({ message: 'Dataset sektoral tidak ditemukan atau belum dipublikasikan', code: 404 });
      }

      const ds = dsRows[0];

      // Ambil definisi kolom / field
      const fields = await queryDB(
        `SELECT id, nama_field AS nama, tipe_data, satuan, urutan, is_primary
           FROM bank_dataset_field
          WHERE dataset_id = $1
          ORDER BY urutan ASC, id ASC`,
        [ds.id]
      );

      // Ambil baris data
      let rowQuery = `
        SELECT id, tahun, data_json, created_at, updated_at
          FROM bank_dataset_row
         WHERE dataset_id = $1
      `;
      const rowParams = [ds.id];
      if (tahun) {
        rowQuery += ` AND tahun = $2`;
        rowParams.push(parseInt(tahun, 10));
      }
      rowQuery += ` ORDER BY tahun DESC, id ASC`;

      const allRows = await queryDB(rowQuery, rowParams);
      const totalRows = allRows.length;
      const limit = Math.min(200, Math.max(1, parseInt(per_page, 10) || 50));
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const offset = (pageNum - 1) * limit;
      const pagedRows = allRows.slice(offset, offset + limit);

      const fieldList = fields.length
        ? fields
        : [
            { nama: 'tahun', tipe_data: 'integer', satuan: 'tahun', is_primary: true },
            { nama: 'nilai', tipe_data: 'number', satuan: ds.satuan || '-', is_primary: false },
          ];

      const dataFormatted = pagedRows.map((r) => {
        let parsed = {};
        if (typeof r.data_json === 'string') {
          try { parsed = JSON.parse(r.data_json); } catch (_) {}
        } else if (typeof r.data_json === 'object' && r.data_json) {
          parsed = r.data_json;
        }
        return {
          id: r.id,
          tahun: r.tahun,
          ...parsed,
          updated_at: r.updated_at || r.created_at,
        };
      });

      const tahunTersedia = [...new Set(allRows.map((r) => r.tahun))].sort((a, b) => a - b);

      res.json({
        message: 'Berhasil',
        code: 200,
        metadata: {
          total_data: totalRows,
          total_page: Math.max(1, Math.ceil(totalRows / limit)),
          page: pageNum,
          page_size: limit,
          kabupaten_kota: 'Kabupaten Sumba Barat',
          kode_wilayah: '53.12',
        },
        dataset: {
          id: ds.id,
          kode_indikator: ds.kode_indikator,
          nama_indikator: ds.nama_indikator,
          definisi_operasional: ds.definisi_operasional,
          satuan: ds.satuan,
          frekuensi: ds.frekuensi,
          polaritas: ds.polaritas,
          produsen_data: ds.produsen_data,
          kode_opd: ds.kode_opd,
          urusan: ds.urusan,
          bidang_urusan: ds.bidang_urusan,
          kode_bidang_urusan: ds.kode_bidang_urusan,
          topik: ds.topik,
          subtopik: ds.subtopik,
          tahun_tersedia: tahunTersedia,
          updated_at: ds.updated_at,
        },
        field: fieldList,
        data: dataFormatted,
      });
    } catch (err) {
      console.error('SDPDN dataset detail error:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server internal', code: 500, error: err.message });
    }
  });

  // =========================================================================
  // 3. ENDPOINT SPESIFIKASI OPENAPI 3.0 (/api/documentation/json)
  // =========================================================================
  app.get('/api/documentation/json', (_, res) => {
    const openApiSpec = {
      openapi: '3.0.3',
      info: {
        title: 'API Satu Data Kabupaten Sumba Barat (SDPDN Ready)',
        version: '1.0.0',
        description:
          'Spesifikasi API integrasi nasional Satu Data Pembangunan Daerah (SDPDN) dan portal data terbuka BAPPERIDA Kabupaten Sumba Barat.',
        contact: {
          name: 'Walidata BAPPERIDA Kabupaten Sumba Barat',
          url: 'https://bapperida.sumbabaratkab.go.id',
        },
      },
      servers: [
        {
          url: '/api/v1',
          description: 'Server Integrasi API v1 (Lokal / Produksi)',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'Token',
            description: 'Masukkan API Token yang diterbitkan oleh Walidata BAPPERIDA',
          },
        },
        schemas: {
          DatasetSektoral: {
            type: 'object',
            properties: {
              kode_indikator: { type: 'string', example: 'IND-5312-0001' },
              nama_indikator: { type: 'string', example: 'Produk Domestik Regional Bruto (PDRB)' },
              definisi_operasional: { type: 'string', example: 'Jumlah nilai tambah atas barang dan jasa...' },
              satuan: { type: 'string', example: 'Miliar Rupiah' },
              frekuensi: { type: 'string', example: 'Tahunan' },
              polaritas: { type: 'string', example: 'positif' },
              produsen_data: { type: 'string', example: 'BAPPERIDA' },
              kode_bidang_urusan: { type: 'string', example: '1.01' },
              tahun_tersedia: {
                type: 'array',
                items: { type: 'integer' },
                example: [2022, 2023, 2024, 2025],
              },
            },
          },
          MetadataResponse: {
            type: 'object',
            properties: {
              total_data: { type: 'integer', example: 45 },
              total_page: { type: 'integer', example: 2 },
              page: { type: 'integer', example: 1 },
              page_size: { type: 'integer', example: 25 },
              kabupaten_kota: { type: 'string', example: 'Kabupaten Sumba Barat' },
              kode_wilayah: { type: 'string', example: '53.12' },
            },
          },
        },
      },
      paths: {
        '/dataset-sektoral': {
          get: {
            summary: 'Daftar Dataset Sektoral Terbuka (SDPDN)',
            description: 'Mengambil daftar seluruh indikator dan dataset terbuka berstandar Satu Data Indonesia.',
            security: [{ BearerAuth: [] }],
            parameters: [
              { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Nomor halaman' },
              { name: 'per_page', in: 'query', schema: { type: 'integer', default: 25 }, description: 'Jumlah data per halaman' },
              { name: 'tahun', in: 'query', schema: { type: 'integer' }, description: 'Filter tahun ketersediaan data' },
              { name: 'kode_bidang_urusan', in: 'query', schema: { type: 'string' }, description: 'Filter kode bidang urusan' },
              { name: 'topic_slug', in: 'query', schema: { type: 'string' }, description: 'Filter slug topik' },
              { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Kata kunci pencarian' },
            ],
            responses: {
              200: {
                description: 'Daftar dataset berhasil diambil',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'Berhasil' },
                        code: { type: 'integer', example: 200 },
                        metadata: { $ref: '#/components/schemas/MetadataResponse' },
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/DatasetSektoral' },
                        },
                      },
                    },
                  },
                },
              },
              401: { description: 'Token autentikasi tidak valid' },
            },
          },
        },
        '/dataset-sektoral/{id}': {
          get: {
            summary: 'Detail & Baris Nilai Dataset Sektoral',
            description: 'Mengambil detail indikator, daftar atribut field, dan baris nilai per tahun.',
            security: [{ BearerAuth: [] }],
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID Dataset atau Kode Indikator' },
              { name: 'tahun', in: 'query', schema: { type: 'integer' }, description: 'Filter tahun data' },
              { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
              { name: 'per_page', in: 'query', schema: { type: 'integer', default: 50 } },
            ],
            responses: {
              200: { description: 'Detail dataset berhasil diambil' },
              404: { description: 'Dataset tidak ditemukan' },
            },
          },
        },
        '/ping': {
          get: {
            summary: 'Pemeriksaan Koneksi & Validasi Token',
            description: 'Mengecek ketersediaan API dan masa aktif token.',
            security: [{ BearerAuth: [] }],
            responses: {
              200: { description: 'Koneksi berhasil dan token valid' },
            },
          },
        },
      },
    };

    res.json(openApiSpec);
  });
}

