import { useState, useEffect, useMemo, createContext, useContext } from "react";
import { LIGHT, DARK, getTheme, isDarkTheme } from "./theme.js";
import { useDocs, useUsers, useLogs, useCategories, useSectors, useBidang, api } from './hooks.js';
import { queryClient } from './main.jsx';
import useResponsive    from './useResponsive.js';
import LoginPage        from "./components/LoginPage.jsx";
import Sidebar          from "./components/Sidebar.jsx";
import BottomNav        from "./components/BottomNav.jsx";
import Dashboard        from "./components/Dashboard.jsx";
import { DocList, DocDetail } from "./components/DocPages.jsx";
import { pesanError } from "./components/PksAdmin.jsx";
import UploadForm       from "./components/UploadForm.jsx";
import NotificationDropdown from "./components/NotificationDropdown.jsx";
import PublicShare from "./components/PublicShare.jsx";
import * as pdfjsLib    from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

// ponytail: count PDF pages from File object
async function countPdfPages(file) {
  try {
    var data = await file.arrayBuffer();
    var doc = await pdfjsLib.getDocument({ data }).promise;
    var count = doc.numPages;
    doc.destroy();
    return count;
  } catch (_) { return 0; }
}

async function extractPdfText(file, onProgress) {
  try {
    var data = await file.arrayBuffer();
    var doc = await pdfjsLib.getDocument({ data }).promise;
    var maxPages = Math.min(doc.numPages, 500);
    var pages = [];
    var BATCH = 40;
    for (var start = 1; start <= maxPages; start += BATCH) {
      var end = Math.min(start + BATCH, maxPages + 1);
      for (var i = start; i < end; i++) {
        var page = await doc.getPage(i);
        var tc = await page.getTextContent();
        var text = tc.items.map(function (it) { return it.str; }).join(" ").trim();
        if (text.length >= 20) pages.push({ page: i, text: text });
      }
      if (onProgress) onProgress(Math.min(start + BATCH - 1, maxPages), maxPages);
    }
    doc.destroy();
    var isScanned = pages.length === 0 || pages.reduce(function (s, p) { return s + p.text.length; }, 0) / Math.max(pages.length, 1) < 20;
    return { pages: pages, status: isScanned ? "needs_ocr" : "ok" };
  } catch (_) {
    return { pages: [], status: "unsupported" };
  }
}
import { Pencarian, PortalPublik, ManajemenPengguna, AuditTrail, ManajemenKategoriDokumen, ManajemenSektor } from "./components/Pages.jsx";
import PanduanPengguna   from "./components/PanduanPengguna.jsx";
import BankData          from "./components/BankData.jsx";
import BankDataDashboard from "./components/BankDataDashboard.jsx";
import KertasKerja from "./components/KertasKerja.jsx";
import { Icon, Toast }  from "./components/ui.jsx";
import { ROLE_COLOR } from "./data.js";
import { Badge } from "./components/ui.jsx";

const ThemeContext = createContext({ T: LIGHT, isDark: false, theme: "system", setTheme: () => {} });
export { ThemeContext };

function ProfileMenu({ user, onLogout }) {
  const { T } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 149 }} />}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8 }}
      >
        <div style={{ width: 30, height: 30, background: T.primary, borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {user.name[0]}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name.split(" ")[0]}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 40, right: 0, width: 180,
          background: T.card, borderRadius: 10, boxShadow: T.shadowLg,
          border: `1px solid ${T.border}`, padding: "6px 0", zIndex: 150,
        }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{user.name}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{user.role}</div>
          </div>
          <button
            onClick={onLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.danger }}
          >
            <Icon name="logout" size={15} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // localStorage hanya petunjuk tampilan supaya tidak berkedip saat refresh.
  // Nilainya tidak dipercaya untuk hak akses: server yang memutuskan, dan
  // role di sini dicocokkan ulang dengan /api/auth/me di bawah.
  const [user,      setUser]      = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [cekSesi,   setCekSesi]   = useState(true);
  const [page,      setPage]      = useState(() => /^#dokumen\/\d+/.test(window.location.hash) ? "dokumen" : (sessionStorage.getItem("page") || "dashboard"));
  const [docs,      setDocs]      = useState([]);
  const [users,     setUsers]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [bidangs, setBidangs] = useState([]);
  const [viewDoc,   setViewDoc]   = useState(null);
  // Dokumen yang dibuka dibaca dari hash (#dokumen/ID) supaya tetap terbuka setelah refresh
  const [pendingDocId, setPendingDocId] = useState(() => { const m = window.location.hash.match(/^#dokumen\/(\d+)/); return m ? m[1] : null; });
  // Halaman publik tautan berbagi dibaca sekali saat mount (hash ditimpa oleh routing internal)
  const [publicParams] = useState(() => {
    const m = window.location.hash.match(/^#\/publik\?(.*)$/);
    if (!m) return null;
    const sp = new URLSearchParams(m[1]);
    const token = sp.get("token"), verify = sp.get("verify");
    return token || verify ? { token, verify } : null;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "1");
  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
      return next;
    });
  };
  const [toast,     setToast]     = useState("");
  const [theme, setThemeState] = useState(() => localStorage.getItem("theme") || "system");
  const T = useMemo(() => getTheme(theme), [theme]);
  const isDark = useMemo(() => isDarkTheme(theme), [theme]);

  const setTheme = (v) => {
    setThemeState(v);
    localStorage.setItem("theme", v);
    document.documentElement.setAttribute("data-theme", isDarkTheme(v) ? "dark" : "light");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const { isMobile, isDesktop } = useResponsive();

  // Query privat baru boleh jalan setelah sesi benar-benar terkonfirmasi.
  // cekSesi masih true selama /api/auth/me berjalan, jadi user dari
  // localStorage saja belum cukup: cookie-nya bisa sudah hilang.
  const siap = !!user && !cekSesi;
  // Log audit dan daftar pengguna hanya dipakai halaman yang sudah dibatasi
  // Admin (AuditTrail, ManajemenPengguna). Tanpa gate ini setiap user biasa
  // tetap men polled dua endpoint itu dan menerima 403 tiap 30-60 detik —
  // sia-sia, dan hereof penuh 403 menutupi 403 yang penting.
  const siapAdmin = siap && user.role === "Admin";

  const { data: serverDocs = [], isLoading: docsLoading } = useDocs(siap);
  const { data: logsData } = useLogs(siapAdmin);
  const { data: usersData } = useUsers(siapAdmin);
  const { data: categoriesData = [] } = useCategories(siap);
  const { data: sectorsData = [] } = useSectors(siap);
  const { data: bidangData = [] } = useBidang(siap);

  // Sync server data into local state, preserving local overrides
  useEffect(() => {
    if (serverDocs.length === 0) return;
    setDocs(prev => {
      const map = new Map(serverDocs.map(d => [d.id, d]));
      // Untuk id yang sudah dikenal server, objek server dipakai utuh.
      //
      // Entri optimistik hasil upload perlu DICOCOKKAN, bukan sekadar
      // dipertahankan. Id-nya dibuat lokal dengan Date.now(), sedangkan server
      // memakai id baris bapperida_dokumen. Kalau lokal selalu kept karena id-nya
      // tidak ada di server, begitu /api/docs menyusul dokumen yang sama sudah
      // ada dua kali: satu dari server, satu lagi dari entri optimistik yang
      // tidak pernahsuperseded. Url dipakai sebagai kunci pencocokan karena
      // keduanya berasal dari GAS dan nilainya sama.
      //
      // Entri optimistik yang belum punya pasangan di server (request masih
      // jalan) tetap disimpan supaya UI responsif.
      const urlServer = new Set(serverDocs.map(d => d.url).filter(Boolean));
      const pending = prev.filter(d => {
        if (map.has(d.id)) return false;
        // Entri yang bukan hasil upload optimistik tetap dipertahankan.
        if (!d.__optimis) return true;
        // Sudah ada padanannya di server -> entri lokal ini usang, buang.
        return !(d.url && urlServer.has(d.url));
      });
      // Entri optimistik yang belum ada di server (request masih jalan)
      // dikembalikan di depan, tidak dimasukkan ke map, supaya tidak masuk
      // dua kali ke hasil akhir.
      return [...pending, ...map.values()];
    });
  }, [serverDocs]);

  // Query-nya bisa mati untuk user biasa dan bisa membalas objek { error } kalau
  // sesinya ditolak, jadi bentuk responsnya dinormalkan dulu.
  useEffect(() => { if (Array.isArray(logsData) && logsData.length) setLogs(logsData); }, [logsData]);
  useEffect(() => { if (Array.isArray(usersData) && usersData.length) setUsers(usersData); }, [usersData]);
  useEffect(() => { if (categoriesData.length > 0) setCategories(categoriesData); }, [categoriesData]);
  useEffect(() => { if (sectorsData.length > 0) setSectors(sectorsData); }, [sectorsData]);
  useEffect(() => { if (bidangData.length > 0) setBidangs(bidangData); }, [bidangData]);

  // Cocokkan user di localStorage dengan cookie session yang sebenarnya.
  // Kalau cookie sudah hilang atau kedaluwarsa, localStorage akan
  // menampilkan UI admin sampai request pertama ditolak.
  useEffect(() => {
    let batal = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(d => {
        if (batal) return;
        // Role ikut diperbarui dari server, jadi perubahan role di database
        // langsung terlihat tanpa perlu logout lalu login.
        setUser(d.user);
        localStorage.setItem("user", JSON.stringify(d.user));
      })
      .catch(() => {
        if (batal) return;
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => { if (!batal) setCekSesi(false); });
    return () => { batal = true; };
  }, []);

  // API mengembalikan 401 saat session habis di tengah pemakaian.
  useEffect(() => {
    const keluar = () => {
      localStorage.removeItem("user");
      queryClient.clear();
      setUser(null);
      setPage("dashboard");
      setViewDoc(null);
    };
    window.addEventListener("arsip:sesi-berakhir", keluar);
    return () => window.removeEventListener("arsip:sesi-berakhir", keluar);
  }, []);

  const handleLogin = loggedUser => {
    localStorage.setItem("user", JSON.stringify(loggedUser));
    // Cache dibuang sebelum user baru aktif. staleTime 30 detik membuat data
    // sesi sebelumnya masih dianggap segar, jadi tanpa ini reviewer yang login
    // menyusul admin dalam 30 detik akan melihat cache milik admin.
    queryClient.clear();
    setUser(loggedUser);
  };

  const handleLogout = async () => {
    // Server harus ikut melepas cookie; menghapus localStorage saja
    // meninggalkan cookie hidup sampai kedaluwarsa.
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
    catch (_) {}
    localStorage.removeItem("user");
    sessionStorage.removeItem("page");
    queryClient.clear();
    setUser(null);
    setPage("dashboard");
    setViewDoc(null);
  };

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const addLog = (action, doc) => {
    setLogs(l => [{
      id: Date.now(),
      user: user.name,
      action,
      doc: doc.title,
      time: new Date().toLocaleString("id-ID"),
    }, ...l]);
  };

  const goPage = (p, pushState = true) => {
    setPage(p);
    setViewDoc(null);
    setPendingDocId(null);
    sessionStorage.setItem("page", p);
    if (pushState) history.pushState({ page: p }, "", `#${p}`);
  };

  const openDoc = (d) => {
    setPage("dokumen");
    setViewDoc(d);
    sessionStorage.setItem("page", "dokumen");
    history.pushState({ page: "dokumen", docId: d.id }, "", `#dokumen/${d.id}`);
  };

  const closeDoc = () => {
    setViewDoc(null);
    history.replaceState({ page: "dokumen" }, "", "#dokumen");
  };

  // browser back/forward
  useEffect(() => {
    const onPop = (e) => {
      const p = e.state?.page || "dashboard";
      setPage(p);
      sessionStorage.setItem("page", p);
      if (e.state?.docId) setPendingDocId(String(e.state.docId));
      else { setViewDoc(null); setPendingDocId(null); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // push initial state on mount (jangan timpa hash halaman publik / dokumen)
  useEffect(() => {
    if (publicParams) return;
    const m = window.location.hash.match(/^#dokumen\/(\d+)/);
    if (m) { history.replaceState({ page: "dokumen", docId: m[1] }, "", window.location.hash); return; }
    const p = sessionStorage.getItem("page") || "dashboard";
    history.replaceState({ page: p }, "", `#${p}`);
  }, []);

  // buka dokumen dari hash begitu daftar dokumen sudah dimuat
  useEffect(() => {
    if (!pendingDocId || docs.length === 0) return;
    const d = docs.find(x => String(x.id) === String(pendingDocId));
    if (d) setViewDoc(d);
    setPendingDocId(null);
  }, [pendingDocId, docs]);

  // bersihkan hash #dokumen/ID bila tidak ada dokumen yang terbuka
  useEffect(() => {
    if (!viewDoc && !pendingDocId && /^#dokumen\/\d+/.test(window.location.hash)) {
      history.replaceState({ page }, "", `#${page}`);
    }
  }, [viewDoc, pendingDocId, page]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  // ── Upload dari Kertas Kerja ──────────────────────────────────────────────
  // Unggah dokumen untuk satu periode lewat dialog. Jalurnya sengaja memakai
  // handleUpload yang sama dengan halaman Upload, jadi GAS + Google Drive hanya
  // ada satu implementasi.
  //
  // returnPage sengaja "kertas-kerja": user sudah berada di halaman itu, jadi
  // selesaiUpload hanya memanggil setPage dengan nilai yang sama dan tidak ada
  // perpindahan halaman. Dokumen yang baru diunggah ditautkan ke periodenya di
  // selesaiUpload.
  const handleUnggahPeriode = (form, onProgress, uploadOpts = {}) =>
    handleUpload(form, onProgress, { returnPage: "kertas-kerja", ...uploadOpts });

  // Dipanggil setelah GAS selesai menyimpan dokumen. Kalau upload dipicu dari
  // Kertas Kerja, tautkan doc_id ke periodenya dan kembali ke halaman asal —
  // jangan lempar user ke daftar dokumen.
  const selesaiUpload = async (docsBaru, pesan, opts = {}) => {
    // __optimis menandai entri yang belum berasal dari /api/docs. Effect sync
    // memakainya untuk membuang entri lokal begitu baris aslinya sudah ada di
    // server; tanpa penanda ini entri itu tidak pernah terbuang dan dokumen
    // tampil dua kali.
    const baru = docsBaru.map(d => ({ ...d, __optimis: true }));
    setDocs(d => baru.concat(d));
    baru.forEach(d => addLog("Upload dokumen", d));
    queryClient.invalidateQueries({ queryKey: ['docs'] });

    if (opts.periodeId != null && !opts.noLink) {
      const dok = docsBaru[0];
      const realId = Number.isInteger(opts.docId) ? opts.docId
        : (dok && Number.isInteger(dok.id) && dok.id > 0 && dok.id < 1e12 ? dok.id : null);
      if (realId != null) {
        try {
          // uploaded_by tidak dikirim: server memakai identitas dari session,
          // jadi nama di audit tidak bisa dipalsukan dari sisi klien.
          await api(`/api/kertas-kerja/periode/${opts.periodeId}`, "PATCH", {
            doc_id: realId
          });
          queryClient.invalidateQueries({ queryKey: ['pks-tree'] });
          queryClient.invalidateQueries({ queryKey: ['pks-ringkasan'] });
          queryClient.invalidateQueries({ queryKey: ['pks-deadline'] });
          showToast("Dokumen diunggah dan ditautkan ke periode Kertas Kerja.");
        } catch (_) {
          showToast("Dokumen terunggah, tetapi gagal ditautkan ke periode. Buka Kertas Kerja lalu unggah ulang lewat tombol di baris periode.");
        }
      } else {
        showToast("Dokumen terunggah, tetapi id-nya tidak bisa ditautkan otomatis. Perbarui periodenya manual.");
      }
    } else {
      showToast(pesan);
    }

    setPage(opts.returnPage || "dokumen");
  };

  // Approve, tolak, dan publikasi diperbaiki di sini.
  //
  // Tiga hal yang dulu salah di ketiganya. Toast sukses dikirim sebelum
  // request selesai, sehingga PATCH yang ditolak server tetap dilaporkan
  // berhasil. Error ditelan dengan .catch(() => {}), jadi tidak ada jalan
  // lain untuk user tahu. Dan invalidateQueries dipanggil bersamaan dengan
  // PATCH: refetch bisa mendahului perubahan di server dan mengembalikan
  // status lama, lalu tidak ada yang memanggil ulang.
  const handleApprove = async (doc, note) => {
    // Nilai asal disimpan supaya bisa dikembalikan apa adanya kalau server
    // menolak. Update optimistis tanpa rollback pernah membuat dokumen appear
    // sudah diarsipkan padahal PATCH-nya ditolak.
    const statusAsli = doc.status;
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: "Diarsipkan", reviewedBy: user.name } : x));
    setViewDoc(null);
    setPage("dokumen");
    try {
      await api(`/api/docs/${doc.id}/status`, "PATCH", {
        status: "Diarsipkan", note: note || "",
        actor_id: user.nip || "", actor_name: user.name
      });
      addLog("Approve dokumen", doc);
      showToast("Dokumen berhasil disetujui dan diarsipkan.");
    } catch (err) {
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: statusAsli } : x));
      showToast(await pesanError(err, "Gagal menyetujui dokumen"));
    } finally {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
    }
  };

  const handleReject = async (doc, note) => {
    const statusAsli = doc.status;
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: "Ditolak" } : x));
    setViewDoc(null);
    setPage("dokumen");
    try {
      await api(`/api/docs/${doc.id}/status`, "PATCH", {
        status: "Ditolak", note: note || "",
        actor_id: user.nip || "", actor_name: user.name
      });
      addLog("Tolak dokumen", doc);
      showToast("Dokumen ditolak dan dikembalikan ke pengupload.");
    } catch (err) {
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: statusAsli } : x));
      showToast(await pesanError(err, "Gagal menolak dokumen"));
    } finally {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
    }
  };

  const handleDownload = doc => {
    addLog("Unduh dokumen", doc);
    window.open(doc.url, "_blank");
  };

  const handlePreview = doc => {
    addLog("Preview dokumen", doc);
    window.open(doc.url, "_blank");
  };

  const handleTogglePublik = async doc => {
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, publik: !x.publik } : x));
    try {
      // Server yang menentukan nilai akhir. Endpoint ini memakai
      // NOT COALESCE(publik, false), jadi toggle bisa terbalik kalau tampilan
      // lokal sudah basi. Jawaban server yang dipakai, bukan tebakan lokal.
      const res = await api(`/api/docs/${doc.id}/publik`, "PATCH");
      const baru = !!res.publik;
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, publik: baru } : x));
      addLog(baru ? "Publikasikan dokumen" : "Batalkan publikasi dokumen", doc);
      showToast(baru
        ? "Dokumen berhasil dipublikasikan ke portal publik."
        : "Dokumen dihapus dari portal publik.");
    } catch (err) {
      // Kembalikan ke nilai semula: yang dioptimis tadi sudah menebak.
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, publik: !x.publik } : x));
      showToast(await pesanError(err, "Gagal mengubah publikasi"));
    } finally {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
    }
  };

  const handleDelete = async doc => {
    if (!window.confirm(`Hapus dokumen "${doc.title}"?`)) return;
    try {
      const res = await api(`/api/docs/${doc.id}`, "DELETE", { user: user.name });
      // Clean up Drive files (all versions)
      try {
        var GAS_URL = "https://script.google.com/macros/s/AKfycbyjrDE_5NnsTsKSyRvEwLLMJH3lWeGsg7jpM44btardExAFX1Vxvp246pazjQdH4UL5/exec";
        var urls = res.allUrls || [doc.url];
        for (var u of urls) {
          if (!u) continue;
          var xhr = new XMLHttpRequest();
          xhr.open('POST', GAS_URL, true);
          xhr.timeout = 30000;
          xhr.send(JSON.stringify({ action: "deleteFile", fileId: u }));
        }
      } catch (_) { /* Drive cleanup best-effort */ }
      setDocs(d => d.filter(x => x.id !== doc.id));
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      setViewDoc(null);
      setPage("dokumen");
      showToast("Dokumen berhasil dihapus.");
    } catch (err) {
      showToast(await pesanError(err, "Gagal menghapus dokumen"));
    }
  };

  const handleBulkAction = async (action, ids) => {
    const label = { archive: "mengarsipkan", publish: "memublikasikan", delete: "menghapus" }[action];
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${ids.length} dokumen?`)) return;
    try {
      const res = await api("/api/docs/bulk", "POST", { action, ids, user: user.name });
      if (action === "delete") {
        setDocs(d => d.filter(x => !ids.includes(x.id)));
      } else if (action === "archive") {
        setDocs(d => d.map(x => ids.includes(x.id) ? { ...x, status: "Diarsipkan" } : x));
      } else {
        setDocs(d => d.map(x => ids.includes(x.id) ? { ...x, publik: true } : x));
      }
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      showToast(`${res.affected} dokumen berhasil ${label}.`);
    } catch (err) {
      showToast(await pesanError(err, `Gagal ${label} dokumen`));
    }
  };

  const handleEdit = async (doc, updates) => {
    try {
      const res = await api(`/api/docs/${doc.id}`, "PUT", { ...updates, user: user.name });
      if (res.doc) {
        setDocs(d => d.map(x => x.id === doc.id ? { ...x, ...res.doc } : x));
      }
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      showToast("Dokumen berhasil diperbarui.");
      return true;
    } catch (err) {
      showToast(await pesanError(err, "Gagal memperbarui dokumen"));
      return false;
    }
  };

  const handleUpload = async (form, onProgress, uploadOpts = {}) => {
    var GAS_URL = "https://script.google.com/macros/s/AKfycbyjrDE_5NnsTsKSyRvEwLLMJH3lWeGsg7jpM44btardExAFX1Vxvp246pazjQdH4UL5/exec";
    var DIRECT_THRESHOLD = 30 * 1024 * 1024;
    var CHUNK_SIZE = 5 * 1024 * 1024;

    // ponytail: XHR avoids fetch redirect issue with GAS webapp
    function gasPost(payload) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', GAS_URL);
        xhr.timeout = 300000;
        xhr.onload = function () {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (_) { reject(new Error('GAS response bukan JSON: ' + xhr.responseText.substring(0, 100))); }
        };
        xhr.onerror = function () { reject(new Error('Network error ke GAS')); };
        xhr.ontimeout = function () { reject(new Error('Timeout ke GAS')); };
        xhr.send(JSON.stringify(payload));
      });
    }

    // Google Drive URL mode — skip GAS upload, save directly to server
    if (form.fileUrl) {
      onProgress(100);
      try {
        var payload = {
          title: form.title, type: form.type, sector: form.sector, year: form.year,
          uploader: user.name, url: form.fileUrl, ukuran: "—", bidang: form.bidang || "",
          pages: 0, desc: form.desc || "", tags: form.tags || "",
          uploader_id: user.nip || "", nomor_dokumen: form.nomor_dokumen || "",
          tanggal_dokumen: form.tanggal_dokumen || "", fileType: form.fileType || "",
        };
        var srvRes = await api('/api/docs', 'POST', payload);
        var newDoc = { ...srvRes.doc, tags: payload.tags ? payload.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [] };
        await selesaiUpload(
          [newDoc],
          "Dokumen berhasil ditambahkan via Google Drive link.",
          { ...uploadOpts, returnPage: uploadOpts.returnPage || "dokumen" }
        );
        return true;
      } catch (err) {
        showToast("Gagal menyimpan dokumen: " + (err.message || err));
        return false;
      }
    }

    if (!form.fileObjs || !form.fileObjs.length) {
      showToast("Pilih file terlebih dahulu.");
      return false;
    }

    var groupMode = form.fileObjs.length > 1;
    var folderId = null;
    var folderUrl = null;

    try {
      var totalFiles = form.fileObjs.length;
      var allDocs = [];
      // Id asli dari GAS. allDocs memakai id lokal biar UI responsif, jadi
      // untuk tautan Kertas Kerja harus ambil docId ini, bukan allDocs[].id.
      var idAsli = null;
      var groupFiles = [];

      if (groupMode) {
        var folderRes = await gasPost({ action: "createFolder", folderName: form.title });
        if (folderRes.error || !folderRes.folderId) throw new Error(folderRes.error || "Gagal membuat folder Drive");
        folderId = folderRes.folderId;
        folderUrl = folderRes.folderUrl;
      }

      for (var fi = 0; fi < totalFiles; fi++) {
        var fobj = form.fileObjs[fi];
        var fileTitle = totalFiles > 1 ? form.title + " — " + fobj.name : form.title;
        onProgress(Math.round((fi / totalFiles) * 100));

        var pageCount = 0;
        if (/\.pdf$/i.test(fobj.name)) pageCount = await countPdfPages(fobj);

        var result;
        if (fobj.size <= DIRECT_THRESHOLD) {
          // ── Direct mode (base64, file < 30MB) ─────────────────────────────
          var base64 = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onprogress = function (e) { if (e.lengthComputable) onProgress(Math.round(((fi + e.loaded / e.total) / totalFiles) * 100)); };
            reader.onload = function () { resolve(reader.result.split(",")[1]); };
            reader.onerror = function () { reject(new Error('Gagal membaca file')); };
            reader.readAsDataURL(fobj);
          });

          result = await gasPost({
            action:   "direct",
            file:     base64,
            filename: fobj.name,
            mimeType: fobj.type,
            title:    fileTitle,
            type:     form.type,
            sector:   form.sector,
            year:     form.year,
            uploader: user.name,
            bidang:   form.bidang || "",
            pages:    pageCount,
            desc:     form.desc || "",
            tags:     form.tags || "",
            uploader_id: user.nip || "",
            nomor_dokumen: form.nomor_dokumen || "",
            tanggal_dokumen: form.tanggal_dokumen || "",
            fileType: form.fileType || "",
            folderId: groupMode ? folderId : undefined,
            group:    groupMode,
          });
        } else {
          // ── Resumable mode (chunked, file > 30MB) ─────────────────────────
          var initResult = await gasPost({
            action:   "initiate",
            filename: fobj.name,
            mimeType: fobj.type || "application/octet-stream",
            fileSize: fobj.size,
            folderId: groupMode ? folderId : undefined,
          });

          if (!initResult.uploadUrl) throw new Error(initResult.error || "Gagal init resumable session");

          var uploadUrl = initResult.uploadUrl;
          var total = fobj.size;
          var start = 0;
          var driveFileId = null;

          function sliceToBase64(blob) {
            return new Promise(function (resolve, reject) {
              var r = new FileReader();
              r.onload = function () { resolve(r.result.split(",")[1]); };
              r.onerror = function () { reject(new Error('Gagal membaca chunk')); };
              r.readAsDataURL(blob);
            });
          }

          // ponytail: chunks uploaded THROUGH GAS (UrlFetchApp) — direct browser
          // PUT to googleapis.com fails CORS on the final chunk (no ACAO header)
          while (start < total) {
            var end = Math.min(start + CHUNK_SIZE, total);
            var chunkB64 = await sliceToBase64(fobj.slice(start, end));

            // ponytail: GAS echo-token occasionally expires mid-upload and the
            // 302 redirect falls through to doGet() (plain text, not JSON). A
            // resumable session is idempotent for overlapping ranges, so a
            // bound retry is safe.
            var chunkResult = null;
            for (var attempt = 0; attempt < 3 && !chunkResult; attempt++) {
              try {
                chunkResult = await gasPost({
                  action:      "chunk",
                  uploadUrl:   uploadUrl,
                  chunkBase64: chunkB64,
                  start:       start,
                  end:         end,
                  totalSize:   total,
                  mimeType:    fobj.type || "application/octet-stream",
                });
              } catch (_) {
                if (attempt === 2) throw _;
              }
            }

            if (chunkResult.status === 200 || chunkResult.status === 201) {
              driveFileId = chunkResult.fileId;
              break;
            } else if (chunkResult.status !== 308) {
              throw new Error(chunkResult.error || ("Chunk gagal: HTTP " + chunkResult.status));
            }

            onProgress(Math.round((end / total) * 80));
            start = end;
          }

          if (!driveFileId) throw new Error("Gagal mendapatkan file ID dari Drive");

          result = await gasPost({
            action:   "finalize",
            fileId:   driveFileId,
            title:    fileTitle,
            type:     form.type,
            sector:   form.sector,
            year:     form.year,
            uploader: user.name,
            bidang:   form.bidang || "",
            pages:    pageCount,
            desc:     form.desc || "",
            tags:     form.tags || "",
            uploader_id: user.nip || "",
            nomor_dokumen: form.nomor_dokumen || "",
            tanggal_dokumen: form.tanggal_dokumen || "",
            fileType: form.fileType || "",
            group: groupMode,
          });
        }

        if (result.error) throw new Error(result.error);

        if (groupMode) {
          groupFiles.push({ name: fobj.name, url: result.fileUrl, size: fobj.size });
          continue;
        }

        if (result.docId) idAsli = Number(result.docId);

        allDocs.push({
          // Id asli dari server dipakai kalau GAS sudah melaporkannya. Id
          // lokal Date.now() hanya jadi cadangan: begitu /api/docs menyusul,
          // entri ini harus punya id yang sama supaya effect sync tahu itu
          // dokumen yang sama dan bukan dokumen baru. Tanpa itu satu upload
          // tampil dua kali.
          id:         result.docId ? Number(result.docId) : Date.now() + fi,
          title:      fileTitle,
          type:       form.type,
          sector:     form.sector,
          year:       form.year,
          status:     "Menunggu Review",
          uploader:   user.name,
          reviewedBy: "—",
          size:       result.size || "—",
          pages:      pageCount,
          uploadDate: new Date().toLocaleDateString("id-ID"),
          desc:       form.desc || "—",
          tags:       form.tags ? form.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [],
          url:        result.fileUrl || "",
          publik:     false,
          bidang:     form.bidang || "",
        });

        // Auto-index PDF content in background (non-blocking)
        if (/\.pdf$/i.test(fobj.name) && result.docId) {
          (async function () {
            try {
              var extracted = await extractPdfText(fobj);
              if (extracted.pages.length > 0) {
                await fetch("/api/docs/" + result.docId + "/content", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ version_no: 1, pages: extracted.pages, status: extracted.status }),
                });
              }
            } catch (_) { /* index silently */ }
          })();
        }
      }

      if (groupMode) {
        var reg = await gasPost({
          action:    "registerFolder",
          title:     form.title,
          type:      form.type,
          sector:    form.sector,
          year:      form.year,
          uploader:  user.name,
          bidang:    form.bidang || "",
          folderUrl: folderUrl,
          files:     groupFiles,
          desc:      form.desc || "",
          tags:      form.tags || "",
          uploader_id: user.nip || "",
          nomor_dokumen: form.nomor_dokumen || "",
          tanggal_dokumen: form.tanggal_dokumen || "",
          fileType: form.fileType || "",
        });
        if (reg.error) throw new Error(reg.error);

        var folderDoc = {
          // Sama seperti file tunggal: pakai id baris server kalau GAS
          // melaporkannya, supaya tidak terhitung sebagai dokumen kedua.
          id:         reg.docId ? Number(reg.docId) : Date.now(),
          title:      form.title,
          type:       form.type,
          sector:     form.sector,
          year:       form.year,
          status:     "Menunggu Review",
          uploader:   user.name,
          reviewedBy: "—",
          size:       reg.ukuran || "—",
          pages:      0,
          uploadDate: new Date().toLocaleDateString("id-ID"),
          desc:       form.desc || "—",
          tags:       form.tags ? form.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [],
          url:        reg.url || folderUrl,
          publik:     false,
          bidang:     form.bidang || "",
          files:      groupFiles,
        };
        // Folder multi-file memakai id lokal, bukan id baris bapperida_dokumen,
        // jadi tidak bisa ditautkan otomatis ke satu periode.
        await selesaiUpload(
          [folderDoc],
          "Folder " + form.title + " (" + groupFiles.length + " file) berhasil diunggah dan dikirim untuk review.",
          { ...uploadOpts, noLink: true, returnPage: uploadOpts.returnPage || "dokumen" }
        );
        return true;
      }

      if (allDocs.length > 0) {
        await selesaiUpload(
          allDocs,
          allDocs.length + " dokumen berhasil diunggah dan dikirim untuk review.",
          { ...uploadOpts, docId: idAsli, returnPage: uploadOpts.returnPage || "dokumen" }
        );
      }
      return true;
    } catch (err) {
      showToast("Gagal mengunggah: " + err.message);
      return false;
    }
  };

  // ── Halaman publik tautan berbagi (tanpa login): #/publik?token=… atau ?verify=… ──
  if (publicParams) {
    return (
      <ThemeContext.Provider value={{ T, isDark, theme, setTheme }}>
        <PublicShare token={publicParams.token} verify={publicParams.verify} />
      </ThemeContext.Provider>
    );
  }

// ── Not logged in ─────────────────────────────────────────────────────────
// Tunggu /api/auth/me selesai dulu, supaya Admin tidak sempat melihat halaman
// admin walau localStorage masih menyimpan user lama.
if (!user) {
  if (cekSesi) return null;
  return <LoginPage onLogin={handleLogin} />;
}

  // ── Pending notifications count ────────────────────────────────────────────
  const pendingCount = docs.filter(d => d.status !== "Diarsipkan" && d.status !== "Ditolak").length;

  // ── Active doc from live docs array ───────────────────────────────────────
  const liveDoc = viewDoc ? docs.find(d => d.id === viewDoc.id) || viewDoc : null;

  return (
    <ThemeContext.Provider value={{ T, isDark, theme, setTheme }}>
      <div style={{ display: "flex", width: "100%", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: T.bg }}>
        {!isMobile && (
          <Sidebar
            active={viewDoc ? "dokumen" : page}
            onNav={(p) => { goPage(p); }}
            user={user}
            onLogout={handleLogout}
            collapsed={collapsed}
            logs={logs}
          />
        )}

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", paddingBottom: isMobile ? 64 : 0 }}>
          {/* Topbar */}
          <div style={{
            background: T.card, borderBottom: `1px solid ${T.border}`,
            padding: isMobile ? "10px 14px" : "11px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "sticky", top: 0, zIndex: 100, minHeight: 48,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!isMobile && (
                <button
                  onClick={toggleCollapsed}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.textSecondary, padding: 6, borderRadius: 6, minWidth: 32, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Toggle menu"
                >
                  <Icon name="menu" size={20} />
                </button>
              )}
              {isMobile && (
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                  {page === "dashboard" && "Dashboard"}
                  {page === "dokumen" && !viewDoc && "Dokumen"}
                  {page === "dokumen" && viewDoc && "Detail Dokumen"}
                  {page === "upload" && "Upload Dokumen"}
                  {page === "pencarian" && "Pencarian"}
                  {page === "publik" && "Portal Publik"}
                  {page === "pengguna" && "Pengguna"}
                   {page === "kategori-dokumen" && "Jenis Dokumen"}
                  {page === "sektor" && "Sektor"}
                  {page === "audit" && "Audit Trail"}
                  {page === "panduan" && "Panduan Pengguna"}
                  {page === "bankdata" && "Bank Data"}
                  {page === "kertas-kerja" && "Kertas Kerja"}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14 }}>
              {pendingCount > 0 && (
                <div style={{ position: "relative", cursor: "pointer" }} onClick={() => goPage("dokumen")} title="Dokumen perlu review">
                  <Icon name="layers" size={isMobile ? 17 : 18} style={{ color: "#f59e0b" }} />
                  <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#f59e0b", borderRadius: 50, fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {pendingCount}
                  </span>
                </div>
              )}
              <NotificationDropdown userId={user.id} />
              {!isMobile && (
                <>
                  <div style={{ fontSize: 13, color: T.textSecondary }}>
                    Halo, <b>{user.name.split(" ")[0]}</b>
                  </div>
                  <Badge label={user.role} colors={ROLE_COLOR[user.role]} />
                </>
              )}
              {isMobile && <ProfileMenu user={user} onLogout={handleLogout} />}
            </div>
          </div>

          {/* Main */}
          <div style={{ flex: 1, padding: isMobile ? "10px 14px 14px" : "14px 24px 24px", overflowY: "auto" }}>
            {page === "dashboard" && !viewDoc && (
              <Dashboard docs={docs} onNav={goPage} sectors={sectors} categories={categories} />
            )}
            {page === "dokumen" && !viewDoc && (
              <DocList docs={docs} onView={openDoc} onNav={goPage} user={user} categories={categories} sectors={sectors} bidangs={bidangs} loading={docsLoading} onBulkAction={handleBulkAction} />
            )}
            {page === "dokumen" && viewDoc && (
              <DocDetail
                doc={liveDoc}
                onBack={closeDoc}
                onApprove={handleApprove}
                onReject={handleReject}
                onDownload={handleDownload}
                onPreview={handlePreview}
                onTogglePublik={handleTogglePublik}
                onDelete={handleDelete}
                onEdit={handleEdit}
                user={user}
                categories={categories}
                sectors={sectors}
                bidangs={bidangs}
                docs={docs}
                showToast={showToast}
              />
            )}
            {page === "upload" && (
              <UploadForm
                onSubmit={(form, onProgress) => handleUpload(form, onProgress, { returnPage: "dokumen" })}
                user={user} categories={categories} sectors={sectors} bidangs={bidangs}
              />
            )}
            {page === "pencarian" && (
              <Pencarian docs={docs} onView={openDoc} />
            )}
            {page === "publik" && (
              <PortalPublik docs={docs} onDownload={handleDownload} />
            )}
            {page === "panduan" && (
              <PanduanPengguna />
            )}
            {page === "bankdata" && user.role === "Admin" && (
              <BankData showToast={showToast} />
            )}
            {page === "bankdata" && user.role !== "Admin" && (
              <BankDataReadOnly />
            )}
            {page === "kertas-kerja" && (
              <KertasKerja
                user={user}
                showToast={showToast}
                categories={categories}
                sectors={sectors}
                bidangs={bidangs}
                onUnggahPeriode={handleUnggahPeriode}
              />
            )}
            {page === "pengguna" && user.role === "Admin" && (
              <ManajemenPengguna users={users} onReload={() => queryClient.invalidateQueries({ queryKey: ['users'] })} showToast={showToast} />
            )}
            {page === "kategori-dokumen" && user.role === "Admin" && (
              <ManajemenKategoriDokumen categories={categories} onReload={() => queryClient.invalidateQueries({ queryKey: ['categories'] })} showToast={showToast} />
            )}
            {page === "sektor" && user.role === "Admin" && (
              <ManajemenSektor sectors={sectors} onReload={() => queryClient.invalidateQueries({ queryKey: ['sectors'] })} showToast={showToast} />
            )}
            {page === "audit" && user.role === "Admin" && (
              <AuditTrail logs={logs} />
            )}
          </div>

          {/* FAB: + hanya di halaman Dokumen & Pencarian */}
          {!viewDoc && (page === "dokumen" || page === "pencarian") && (
            <button
              onClick={() => goPage("upload")}
              style={{
                position: "fixed",
                bottom: isMobile ? 80 : 24,
                right: 24,
                width: 56,
                height: 56,
                borderRadius: 28,
                background: T.primary,
                color: "#fff",
                border: "none",
                boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
                fontSize: 28,
                cursor: "pointer",
                zIndex: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >+</button>
          )}

          {/* Bottom Nav */}
          {isMobile && (
            <BottomNav active={viewDoc ? "dokumen" : page} onNav={goPage} user={user} />
          )}
        </div>

        <Toast msg={toast} onClose={() => setToast("")} />
      </div>
    </ThemeContext.Provider>
  );
}

function BankDataReadOnly() {
  const { T } = useContext(ThemeContext);
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Bank Data</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Data sektoral dan indikator kinerja per OPD di BAPPERIDA
        </div>
      </div>
      <BankDataDashboard emptyMessage="Belum ada data bank data. Hubungi admin untuk melengkapi data." />
    </div>
  );
}