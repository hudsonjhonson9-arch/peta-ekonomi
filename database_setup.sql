-- ============================================================
-- PETA EKONOMI — PostgreSQL Schema Updates
-- Jalankan di pgAdmin4: Tools → Query Tool → paste → F5
-- ============================================================

-- ── Tabel user_credentials ──────────────────────────────────────────────────
-- Menyimpan password hash secara terpisah, dihubungkan dengan tabel user_list 
-- menggunakan NIP.
CREATE TABLE IF NOT EXISTS user_credentials (
    nip             VARCHAR(100) PRIMARY KEY,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- SEED DATA — User Credentials
-- Password default: "Bidangekonomi2026" (Di-hash dengan bcrypt, salt rounds: 10)
-- Hash untuk "Bidangekonomi2026" adalah: $2b$10$vgAo0ik8CSJ2vaoaM6Lh9OXfn3Tt2Mv/edTx1ZzdmqKD6AGvnhREq
-- Pastikan NIP yang dimasukkan di bawah ini benar-benar ada di tabel `user_list`.
-- ============================================================

-- Contoh insert untuk beberapa NIP (Sesuaikan dengan NIP riil di user_list):
-- INSERT INTO user_credentials (nip, password_hash) VALUES
--     ('NIP_AGUSTINA', '$2b$10$vgAo0ik8CSJ2vaoaM6Lh9OXfn3Tt2Mv/edTx1ZzdmqKD6AGvnhREq'),
--     ('NIP_KABID',    '$2b$10$vgAo0ik8CSJ2vaoaM6Lh9OXfn3Tt2Mv/edTx1ZzdmqKD6AGvnhREq')
-- ON CONFLICT (nip) DO NOTHING;


-- ── Tabel audit_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_name   VARCHAR(100)  NOT NULL,
    action      VARCHAR(100)  NOT NULL,
    doc_title   VARCHAR(300),
    created_at  TIMESTAMP     DEFAULT NOW()
);

-- ============================================================
-- SEED DATA — Audit Logs
-- ============================================================
INSERT INTO audit_logs (user_name, action, doc_title, created_at) VALUES
    ('Maria Lende',    'Upload dokumen',  'Kajian Rantai Pasok Komoditas Unggulan 2024', '2024-09-30 14:22:00'),
    ('Kabid Ekonomi',  'Approve dokumen', 'Kajian Rantai Pasok Komoditas Unggulan 2024', '2024-09-30 16:45:00'),
    ('Dominikus Tamu', 'Upload dokumen',  'Notulen Rapat Koordinasi Ekonomi Q3 2024',    '2024-10-02 09:10:00'),
    ('Agustina Malo',  'Unduh dokumen',   'RPJMD Kabupaten Sumba Barat 2021–2026',        '2024-10-03 08:30:00'),
    ('Kabid Ekonomi',  'Review dokumen',  'Notulen Rapat Koordinasi Ekonomi Q3 2024',    '2024-10-03 10:15:00'),
    ('Yohanes Rangga', 'Upload dokumen',  'Laporan Ketenagakerjaan Sumba Barat 2023',     '2024-01-11 13:00:00'),
    ('Kabid Ekonomi',  'Tolak dokumen',   'Laporan Ketenagakerjaan Sumba Barat 2023',     '2024-01-12 09:00:00');
