import { useQuery } from '@tanstack/react-query';

export const api = (url, method = 'GET', body) => fetch(url, {
  method,
  // Session hidup di cookie HttpOnly, jadi cookie harus ikut dikirim.
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

// Polling dan fokus jendela.
//
//.refetchOnWindowFocus default React Query sudah aktif, jadi saat tab dibuka
// lagi data langsung segar tanpa input ulang. Yang belum ada adalah pemuatan
// berkala: selama tab membiarkan terbuka, perubahan dari orang lain (dokumen
// baru, status review yang berubah) tidak pernah terlihat sampai halaman
// di-refresh manual.
//
// 30 detik dipilih supaya daftar tetap terasa hidup tanpa membebani server:
// /api/docs ringan, dan requestnya sudah otomatis berhenti saat tab disembunyikan
// karena refetchInterval dihitung dari waktu browser dan query di-background pada
// saat refetchOnWindowFocus.
export function useDocs(aktif = true) {
  return useQuery({
    queryKey: ['docs'],
    queryFn: () => api('/api/docs'),
    enabled: aktif,
    refetchInterval: aktif ? 30000 : false,
  });
}

export function useLogs(aktif = true) {
  return useQuery({
    queryKey: ['logs'],
    queryFn: () => api('/api/logs'),
    enabled: aktif,
    refetchInterval: aktif ? 60000 : false,
  });
}

export function useUsers(aktif = true) {
  return useQuery({ queryKey: ['users'], queryFn: () => api('/api/users'), enabled: aktif });
}

export function useCategories(aktif = true) {
  return useQuery({ queryKey: ['categories'], queryFn: () => api('/api/kategori-dokumen'), enabled: aktif });
}

export function useSectors(aktif = true) {
  return useQuery({ queryKey: ['sectors'], queryFn: () => api('/api/sektor'), enabled: aktif });
}

export function useBidang(aktif = true) {
  return useQuery({ queryKey: ['bidang'], queryFn: () => api('/api/bidang'), enabled: aktif });
}

export function useIndikator() {
  return useQuery({ queryKey: ['indikator'], queryFn: () => api('/api/indikator') });
}

export function useNotifications(userId) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => api(`/api/notifications?user_id=${userId}`),
    enabled: !!userId,
    refetchInterval: 30000,
  });
}

// ── Kertas Kerja / Output (PKS) ────────────────────────────────────────────

export function usePksTahun() {
  return useQuery({ queryKey: ['pks-tahun'], queryFn: () => api('/api/pks/tahun') });
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
  });
}

export function usePksRingkasan(tahun) {
  return useQuery({
    queryKey: ['pks-ringkasan', tahun],
    queryFn: () => api(`/api/pks/ringkasan/${encodeURIComponent(tahun)}`),
    enabled: !!tahun,
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
  });
}

export function useKertasKerja(subkegiatanId) {
  return useQuery({
    queryKey: ['kertas-kerja', subkegiatanId],
    queryFn: () => api(`/api/kertas-kerja?subkegiatan_id=${encodeURIComponent(subkegiatanId)}`),
    enabled: !!subkegiatanId,
  });
}
