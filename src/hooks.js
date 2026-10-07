import { useQuery } from '@tanstack/react-query';

export const api = (url, method = 'GET', body) => fetch(url, {
  method,
  // Session hidup di cookie HttpOnly, jadi cookie harus ikut mengirim.
  credentials: 'same-origin',
  headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => {
  if (r.status === 401) {
    // Sesi sudah tidak berlaku. Buang user lokal supaya UI kembali ke login,
    // bukan menampilkan tombol yang pasti ditolak server.
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('arsip:sesi-berakhir'));
    throw new Error(401);
  }
  if (!r.ok) {
    // Body error dibaca di sini dan pesannya ikut dilempar. Dulu hanya status
    // yang dilempar, jadi pesan server hilang dan semua pesan error dari
    // pesanError() hanya berbunyi "Gagal (kode 500)".
    let pesan = `Gagal (${r.status})`;
    try {
      const body = await r.json();
      if (body && body.error) pesan = body.error;
    } catch { /* body bukan JSON, pakai status saja */ }
    const e = new Error(pesan);
    e.status = r.status;
    throw e;
  }
  return r.json();
});

// Query di bawah dipanggil dari komponen yang tetap terpasang sejak halaman
// login, jadi tanpa `aktif` semuanya menembak endpoint privat sebelum ada
// cookie. Request itu pasti 401 dan cache-nya jadi error yang tidak pernah
// dicoba lagi: React Query hanya mem-fetch ulang saat mount, saat window
// regain focus, atau saat invalidate. Komponennya tidak pernah mount ulang
// saat login berhasil, jadi datanya baru muncul setelah refresh.

// ── Auto-update ─────────────────────────────────────────────────────────────
//
// Semua perubahan data di aplikasi ini datang dari request orang lain: ada
// yang mengunggah dokumen, me-review, mengubah peran, atau mengisi Kertas
// Kerja. Tanpa penarikan data otomatis, perubahan itu tidak akan terlihat
// sampai pengguna pindah halaman atau refresh browser sendiri.
//
// Jadi semua query aktif polling. refetchInterval-nya false saat query
// disabled, supaya halaman yang tidak sedang dipakai tidak menembak endpoint
// privat tanpa perlu — request seperti itu hanya menghasilkan 401.
//
// 30 detik: cukup responsif untuk kerja admin, dan request-nya otomatis
// berhenti saat tab disembunyikan karena React Query menjeda timer query yang
// tidak terlihat.
const POLLING = 30000;

// `aktif` tetap ditentukan oleh hook pemanggil supaya komponen yang sudah terpasang
// sejak halaman login tidak menembak endpoint privat sebelum ada cookie.
export function useDocs(aktif = true) {
  return useQuery({
    queryKey: ['docs'],
    queryFn: () => api('/api/docs'),
    enabled: aktif,
    refetchInterval: aktif ? POLLING : false,
  });
}

export function useLogs(aktif = true) {
  return useQuery({
    queryKey: ['logs'],
    queryFn: () => api('/api/logs'),
    enabled: aktif,
    // Log audit tidak sepenting daftar dokumen, jadi jarang diambil.
    refetchInterval: aktif ? POLLING * 2 : false,
  });
}

export function useUsers(aktif = true) {
  return useQuery({
    queryKey: ['users'], queryFn: () => api('/api/users'),
    enabled: aktif, refetchInterval: aktif ? POLLING : false,
  });
}

export function useCategories(aktif = true) {
  return useQuery({
    queryKey: ['categories'], queryFn: () => api('/api/kategori-dokumen'),
    enabled: aktif, refetchInterval: aktif ? POLLING : false,
  });
}

export function useSectors(aktif = true) {
  return useQuery({
    queryKey: ['sectors'], queryFn: () => api('/api/sektor'),
    enabled: aktif, refetchInterval: aktif ? POLLING : false,
  });
}

export function useBidang(aktif = true) {
  return useQuery({
    queryKey: ['bidang'], queryFn: () => api('/api/bidang'),
    enabled: aktif, refetchInterval: aktif ? POLLING : false,
  });
}

export function useIndikator() {
  return useQuery({
    queryKey: ['indikator'], queryFn: () => api('/api/indikator'),
    refetchInterval: POLLING,
  });
}

export function useNotifications(userId) {
  return useQuery({
    queryKey: ['notifications', userId],
    // Tanpa query string: server mem-filter sendiri dari session.
    queryFn: () => api('/api/notifications'),
    enabled: !!userId,
    refetchInterval: POLLING,
  });
}

// ── Kertas Kerja / Output (PKS) ─────────────────────────────────────────────

export function usePksTahun() {
  return useQuery({
    queryKey: ['pks-tahun'], queryFn: () => api('/api/pks/tahun'),
    refetchInterval: POLLING,
  });
}

export function usePksTree(tahun) {
  return useQuery({
    queryKey: ['pks-tree', tahun],
    queryFn: async () => {
      const r = await api(`/api/pks/tree?tahun=${encodeURIComponent(tahun)}`);
      // Server mengirim { tahun, tree }. Tolak array polos supaya komponen
      // tidak pernah merender objek respons mentah.
      return Array.isArray(r) ? { tahun, tree: r } : r;
    },
    enabled: !!tahun,
    refetchInterval: tahun ? POLLING : false,
  });
}

export function usePksRingkasan(tahun) {
  return useQuery({
    queryKey: ['pks-ringkasan', tahun],
    queryFn: () => api(`/api/pks/ringkasan/${encodeURIComponent(tahun)}`),
    enabled: !!tahun,
    refetchInterval: tahun ? POLLING : false,
  });
}

// tahun: angka untuk menyaring per tahun. null berarti "tunggu tahun siap"
// supaya halaman tidak mengambil deadline semua tahun lalu mengambil ulang.
// Argumen yang dihilangkan (undefined) berarti semua tahun, seperti dulu.
export function usePksDeadlineTerdekat(tahun) {
  return useQuery({
    queryKey: ['pks-deadline', tahun ?? 'semua'],
    queryFn: () => api(
      tahun ? `/api/pks/deadline-terdekat?tahun=${encodeURIComponent(tahun)}` : '/api/pks/deadline-terdekat'
    ),
    enabled: tahun !== null,
    refetchInterval: tahun !== null ? POLLING : false,
  });
}

// ── Standar Harga (SSH/SBU) ─────────────────────────────────────────────────
// q/rekening opsional (falsy = tanpa filter). rekening berupa string dipisah
// koma dari chips sub kegiatan: chips.join(','). Respons server array mentah,
// jadi hook.data = array item.
export const useStandarHarga = ({ tahun, jenis, q, rekening }) => useQuery({
  queryKey: ['standar-harga', tahun, jenis, q || '', rekening || ''],
  queryFn: () => api(`/api/standar-harga?${new URLSearchParams(Object.entries({ tahun, jenis, q: q || undefined, rekening: rekening || undefined }).filter(([,v]) => v))}`),
  enabled: !!tahun && !!jenis,
});

// Kode rekening distinct dari standar_harga (gabungan SSH+SBU) — sumber
// dropdown "Kode rekening" ala SIPD. Respons: array string; FE menggabungkan
// dengan chips kode_rekening sub kegiatan. Data jarang berubah → tanpa polling.
export const useKodeRekening = (tahun) => useQuery({
  queryKey: ['standar-harga-rekening', tahun],
  queryFn: () => api(`/api/standar-harga/rekening?tahun=${encodeURIComponent(tahun)}`),
  enabled: !!tahun,
});

// ── Draft Rincian ───────────────────────────────────────────────────────────
// Respons server {items, total} — total = Σ jumlahItem dihitung server.
export const useDraftRincian = (subkegiatanId) => useQuery({
  queryKey: ['draft-rincian', subkegiatanId],
  queryFn: () => api(`/api/draft-rincian?subkegiatan_id=${subkegiatanId}`),
  enabled: !!subkegiatanId,
});

// ── Screening RKA: perubahan anggaran ───────────────────────────────────────
// {riwayat: [{id, catatan, oleh, created_at}], item: [{subkegiatan_id,
// sebelum_pagu, sebelum_rencana}]} — item = snapshot inisiasi TERAKHIR.
// Key sama untuk semua RingkasanPagu pada tahun yang sama → react-query dedup.
export const usePerubahan = (tahun) => useQuery({
  queryKey: ['screening-perubahan', tahun],
  queryFn: () => api(`/api/screening/perubahan?tahun=${encodeURIComponent(tahun)}`),
  enabled: !!tahun,
  refetchInterval: tahun ? POLLING : false,
});

export function useKertasKerja(subkegiatanId) {
  return useQuery({
    queryKey: ['kertas-kerja', subkegiatanId],
    queryFn: () => api(`/api/kertas-kerja?subkegiatan_id=${encodeURIComponent(subkegiatanId)}`),
    enabled: !!subkegiatanId,
    refetchInterval: subkegiatanId ? POLLING : false,
  });
}