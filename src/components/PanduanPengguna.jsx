import { useState } from "react";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";

const SECTIONS = [
  { id: "login",     title: "Login",              icon: "users"    },
  { id: "dashboard", title: "Dashboard",           icon: "home"     },
  { id: "dokumen",   title: "Dokumen",             icon: "archive"  },
  { id: "detail",    title: "Detail & Persetujuan", icon: "eye"    },
  { id: "upload",    title: "Upload Dokumen",       icon: "upload"  },
  { id: "pencarian", title: "Pencarian",            icon: "search"  },
  { id: "publik",    title: "Portal Publik",        icon: "world"   },
  { id: "bankdata",  title: "Bank Data",            icon: "chart"   },
  { id: "pengguna",  title: "Manajemen Pengguna",   icon: "users"   },
  { id: "kategori",  title: "Kategori Dokumen",     icon: "tag"     },
  { id: "audit",     title: "Audit Trail",          icon: "history" },
  { id: "trouble",   title: "Troubleshooting",      icon: "x"       },
];

const CONTENT = {
  login: {
    title: "Login",
    desc: "Akses aplikasi Arsip Digital Bapperida dengan NIP dan Password. Halaman login menampilkan daftar akun yang tersedia untuk memudahkan pengisian NIP.",
    steps: [
      "Buka aplikasi melalui browser (URL dari Admin)",
      "Masukkan <b>NIP</b> (Nomor Induk Pegawai) — atau klik salah satu nama akun untuk isi otomatis",
      "Masukkan <b>Password</b> (default: <code>BapperidaSB2026</code>)",
      "Klik tombol <b>Masuk</b>"
    ],
    note: "Password default bisa diganti oleh Admin setelah login pertama. Jika lupa password, hubungi Admin untuk reset.",
    screenshot: "/screenshots/login.png"
  },
  dashboard: {
    title: "Dashboard",
    desc: "Halaman utama setelah login. Menampilkan ringkasan seluruh arsip dokumen perencanaan pembangunan di BAPPERIDA Kabupaten Sumba Barat.",
    steps: [
      "4 kartu statistik: Total Dokumen, Diarsipkan, Menunggu Proses, Ditolak",
      "Grafik batang distribusi dokumen per Jenis (kiri) dan per Sektor (kanan)",
      "Tabel Bank Data (menampilkan indikator yang dipilih Admin)",
      "Daftar 5 dokumen terbaru — klik <b>Lihat semua</b> untuk daftar lengkap",
    ],
    note: "Notifikasi bel di pojok kanan atas menunjukkan jumlah dokumen yang perlu diproses (untuk Reviewer/Admin).",
    screenshot: "/screenshots/dashboard.png"
  },
  dokumen: {
    title: "Dokumen",
    desc: "Halaman daftar semua dokumen dengan filter untuk memudahkan pencarian.",
    steps: [
      "Gunakan filter <b>Jenis</b> untuk menyaring berdasarkan tipe dokumen (RPJMD, Renstra, dll)",
      "Gunakan filter <b>Sektor</b> untuk menyaring berdasarkan sektor pembangunan",
      "Gunakan filter <b>Tahun</b> untuk menyaring berdasarkan tahun dokumen",
      "Gunakan filter <b>Status</b> untuk menyaring status (Menunggu Review, Diarsipkan, Ditolak)",
      "Klik tombol <b>Detail</b> pada dokumen untuk melihat informasi lengkap"
    ],
    table: {
      header: ["Informasi", "Keterangan"],
      rows: [
        ["Judul", "Nama dokumen"],
        ["Jenis", "RPJMD, Renstra, Renja, RKA, dll"],
        ["Sektor", "Pertanian, Pariwisata, UMKM, dll"],
        ["Status", "Diarsipkan / Menunggu Review / Ditolak"],
        ["Uploader", "Nama pengguna yang mengunggah"],
      ]
    },
    note: "Klik <b>Detail</b> untuk melihat informasi lengkap dan melakukan aksi (approve/tolak jika memiliki hak akses).",
    screenshot: "/screenshots/dokumen.png"
  },
  detail: {
    title: "Detail & Persetujuan Dokumen",
    desc: "Halaman detail menampilkan informasi lengkap dokumen dan tombol aksi sesuai role pengguna.",
    steps: [
      "Informasi dokumen: judul, jenis, sektor, tahun, ukuran file",
      "Nama pengupload dan tanggal upload",
      "Status dokumen dengan warna indikator (hijau = Diarsipkan, kuning = Menunggu, merah = Ditolak)",
      "Tombol aksi muncul jika Anda memiliki hak untuk melakukan tindakan"
    ],
    table: {
      header: ["Status", "Staf", "Reviewer", "Admin"],
      rows: [
        ["Menunggu Review", "—", "Setuju / Tolak", "Setuju / Tolak"],
        ["Menunggu Persetujuan", "—", "—", "Setuju / Tolak"],
        ["Diarsipkan", "—", "—", "—"],
        ["Ditolak", "Upload ulang", "—", "—"],
      ]
    },
    screenshot: "/screenshots/detail.png"
  },
  upload: {
    title: "Upload Dokumen",
    desc: "Unggah dokumen perencanaan pembangunan ke repositori. Dokumen akan disimpan ke Google Drive dan metadata-nya tercatat di database.",
    steps: [
      "Klik menu <b>Upload</b> di sidebar",
      "Isi <b>Judul Dokumen</b> (wajib)",
      "Pilih <b>Jenis Dokumen</b> dari daftar (wajib)",
      "Pilih <b>Sektor</b> terkait (wajib)",
      "Pilih <b>File PDF</b> dari komputer (wajib)",
      "Klik tombol <b>Upload</b> — progress bar akan muncul"
    ],
    note: "File dikirim ke Google Drive melalui Google Apps Script. Metadata disimpan di PostgreSQL. Status awal: Menunggu Review.",
    screenshot: "/screenshots/upload.png"
  },
  pencarian: {
    title: "Pencarian",
    desc: "Fitur pencarian teks bebas untuk mencari dokumen di seluruh repositori.",
    steps: [
      "Ketik kata kunci di kolom pencarian",
      "Tekan <b>Enter</b> atau klik tombol <b>Cari</b>",
      "Hasil pencarian muncul secara real-time",
      "Klik hasil untuk melihat detail dokumen"
    ],
    note: "Pencarian mencakup judul, deskripsi, jenis, sektor, uploader, dan tag dokumen.",
    screenshot: "/screenshots/pencarian.png"
  },
  publik: {
    title: "Portal Publik",
    desc: "Halaman khusus untuk menampilkan dokumen yang telah diarsipkan. Dapat diakses tanpa login untuk transparansi publik.",
    steps: [
      "Menampilkan dokumen dengan status Diarsipkan",
      "Tampilan lebih sederhana (tanpa sidebar, tanpa aksi admin)",
      "Berguna untuk transparansi publik dan referensi bersama"
    ],
    screenshot: "/screenshots/publik.png"
  },
  bankdata: {
    title: "Bank Data",
    desc: "Kelola indikator dan data statistik untuk ditampilkan di Dashboard. Fitur ini hanya tersedia untuk Admin.",
    steps: [
      "Klik menu <b>Bank Data</b> di sidebar",
      "Klik <b>Tambah Indikator</b> untuk menambahkan indikator baru (nama + satuan)",
      "Klik baris indikator untuk membuka input nilai per tahun",
      "Klik tombol <b>Tampil/Sembunyi</b> untuk mengatur visibilitas di Dashboard"
    ],
    note: "Data yang di-toggle Tampil akan muncul di tabel Bank Data pada halaman Dashboard untuk semua pengguna.",
    screenshot: "/screenshots/bankdata.png"
  },
  pengguna: {
    title: "Manajemen Pengguna (Admin Only)",
    desc: "Fitur untuk Admin mengelola pengguna sistem. Hanya Admin yang dapat mengakses halaman ini.",
    table: {
      header: ["Fitur", "Keterangan"],
      rows: [
        ["Tambah Pengguna", "Isi NIP, nama, unit, role (Admin/Reviewer/Staf), password"],
        ["Edit Pengguna", "Ubah data pengguna termasuk role"],
        ["Hapus Pengguna", "Hapus pengguna dari sistem"],
        ["Role Admin", "Akses semua fitur termasuk manajemen"],
        ["Role Reviewer", "Dashboard, Dokumen (approve/tolak), Upload, Pencarian"],
        ["Role Staf", "Dashboard, Dokumen (view only), Upload, Pencarian"],
      ]
    },
    note: "Role menentukan menu dan tombol apa yang muncul untuk pengguna tersebut.",
    screenshot: "/screenshots/pengguna.png"
  },
  kategori: {
    title: "Manajemen Kategori Dokumen (Admin Only)",
    desc: "Kelola jenis/jenis dokumen yang tersedia di sistem. Hanya Admin yang dapat mengelola kategori.",
    steps: [
      "Klik <b>Tambah</b> untuk menambahkan kategori baru",
      "Klik ikon pensil untuk mengedit nama kategori",
      "Klik ikon hapus untuk menghapus kategori"
    ],
    note: "Kategori default: RPJMD, Renstra, Renja, RKA, Kajian Ekonomi, Laporan Evaluasi, Data Statistik, Notulen Rapat.",
    screenshot: "/screenshots/kategori.png"
  },
  audit: {
    title: "Audit Trail (Admin Only)",
    desc: "Mencatat semua aktivitas pengguna di sistem untuk keperluan monitoring dan akuntabilitas.",
    table: {
      header: ["Kolom", "Keterangan"],
      rows: [
        ["User", "Nama pengguna yang melakukan aksi"],
        ["Aksi", "Upload, Approve, Tolak, Unduh, Review"],
        ["Dokumen", "Judul dokumen terkait"],
        ["Waktu", "Tanggal dan jam kejadian"],
      ]
    },
    note: "Audit trail diurutkan dari yang terbaru. Cocok untuk keperluan monitoring dan akuntabilitas.",
    screenshot: "/screenshots/audit.png"
  },
  trouble: {
    title: "Tips & Troubleshooting",
    desc: "Solusi untuk masalah umum yang mungkin terjadi saat menggunakan aplikasi.",
    table: {
      header: ["Masalah", "Solusi"],
      rows: [
        ["Lupa password", "Hubungi Admin untuk reset password"],
        ["Upload gagal", "Periksa koneksi internet, pastikan file tidak rusak"],
        ["Dokumen tidak muncul", "Cek filter — mungkin kena filter jenis/sektor/tahun"],
        ["Tidak bisa approve", "Pastikan role Anda adalah Reviewer atau Admin"],
        ["Halaman kosong", "Refresh browser atau logout lalu login ulang"],
        ["Data Bank Data tidak muncul", "Pastikan Admin sudah menambahkan indikator dan mengaktifkan tampil di dashboard"],
      ]
    }
  },
};

export default function PanduanPengguna() {
  const { isMobile } = useResponsive();
  const [activeId, setActiveId] = useState("login");
  const section = CONTENT[activeId];
  if (!section) return null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Panduan Pengguna</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          Pusat Dokumen Digital Perencanaan Pembangunan — BAPPERIDA Kabupaten Sumba Barat
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4, flexWrap: "wrap" }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{ padding: "6px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: activeId === s.id ? 600 : 400, whiteSpace: "nowrap",
              background: activeId === s.id ? "#2563EB" : "#f0f0f0", color: activeId === s.id ? "#fff" : "#666" }}>
            <Icon name={s.icon} size={12} style={{ marginRight: 4 }} />{s.title}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24, border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>{section.title}</div>

        {section.desc && (
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>{section.desc}</p>
        )}

        {section.steps && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>Langkah-langkah:</div>
            <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
              {section.steps.map((s, i) => (
                <li key={i} style={{ fontSize: 13, color: "#444", marginBottom: 8, lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: s }} />
              ))}
            </ol>
          </>
        )}

        {section.table && (
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {section.table.header.map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, background: "#f9faf9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", color: "#444" }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section.note && (
          <div style={{ background: "#fff8e1", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#8d6e00", marginBottom: 16, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span>{section.note}</span>
          </div>
        )}

        {section.screenshot && (
          <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", border: "1px solid #e8e8e8" }}>
            <img
              src={section.screenshot}
              alt={section.title}
              style={{ width: "100%", display: "block" }}
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}
