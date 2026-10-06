REKOMENDASI FITUR ARSIP DIGITAL

Berdasarkan analisa kode (terbaru: linkage periode–dokumen diperbaiki, transaksi tunggal, migration tahap_5, validasi idDokumenValid):

## 1. Quick Wins (Low Effort, High Impact)

1.1 Export Kertas Kerja CSV (ringkasan + detail periode) → read-only, endpoint + tombol
1.2 Ringkasan lebih detail (Selesai/Menunggu/Ditolak/%)
1.3 Badge "Perlu ditautkan" (orphan)
1.4 Validasi nama Output unik per subkegiatan
1.5 Deep-link buka pohon dari notifikasi

## 2. Penting (Medium)

2.1 Repair tautan massal (one-click) – reuse tahap_5 logic
2.2 Audit trail deadline/link/unlink (kertas_kerja_periode_history)
2.3 Bulk generate sinkron lintas output
2.4 Quick View dokumen dari baris periode
2.5 Auto-reminder H-3/H-1 (cron ringan, hindari duplikasi multi-instance)

## 3. Nice-to-have (Advanced)

3.1 Ganti dokumen tanpa unlink (replace)
3.2 PIC View "Tugas Saya"
3.3 Revisi Diminta saat Ditolak
3.4 Lock periode setelah Diarsipkan
3.5 KPI Heatmap bulanan/triwulan

PRIORITAS #1: 1.1 Export CSV + 2.2 Audit Trail
CATATAN: pakai judulDokumenPeriode (server/tautan-periode.js) untuk konsistensi; export/read-only aman; aksi tulis wajib cek role; migration idempoten.

REQ BANK DATA (baru):
- Pada IKU tidak ada Aspek
- Masing-masing Data Sektoral, IKU, IKK tambahkan Satuannya
- Untuk Aspek pengisiannya menggunakan dropdown custom dengan search
- Opsi Aspek saat ini: Daya Saing Daerah, Pelayanan Umum, Geografi dan Demografi, Kesejahteraan Masyarakat

## REQ SCREENING RKA (V1)

- Menu "Screening RKA" di grup Perencanaan (icon filter), terlihat semua role: daftar tahun → pohon Program → Kegiatan → Sub Kegiatan (accordion).
- Sub kegiatan: input pagu + editor chips kode rekening — Admin saja (canManageOutput); non-admin lihat saja. Chips kosong = semua rekening.
- Tabel standar harga (SSH/SBU) per sub: filter otomatis pakai chips rekening tersimpan (rekening=chips.join(','), kosong = semua + notice "Belum ada rekening — menampilkan semua data"), search box debounce 300ms, maks 500 baris.
- Upload Excel (.xlsx/.xls) client-side (paket xlsx): header dipetakan lewat HEADER_MAP di src/uploadStandarHarga.js (WAJIB sinkron dengan server/standar-harga.js), preview 5 baris + jumlah baris, tombol "Ganti data (replace)" + confirm → POST /api/standar-harga/upload = replace-all per (tahun, jenis); Admin saja.
- Kolom tabel: Uraian, Spesifikasi, Satuan, Harga (rupiah), Kode Rekening.
