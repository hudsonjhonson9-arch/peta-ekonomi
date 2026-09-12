import { useState, useEffect } from "react";
import { useDocs, useUsers, useLogs, useCategories, useSectors, api } from './hooks.js';
import { queryClient } from './main.jsx';
import useResponsive    from './useResponsive.js';
import LoginPage        from "./components/LoginPage.jsx";
import Sidebar          from "./components/Sidebar.jsx";
import BottomNav        from "./components/BottomNav.jsx";
import Dashboard        from "./components/Dashboard.jsx";
import { DocList, DocDetail } from "./components/DocPages.jsx";
import UploadForm       from "./components/UploadForm.jsx";
import { Pencarian, PortalPublik, ManajemenPengguna, AuditTrail, ManajemenKategoriDokumen, ManajemenSektor } from "./components/Pages.jsx";
import PanduanPengguna   from "./components/PanduanPengguna.jsx";
import BankData          from "./components/BankData.jsx";
import { Icon, Toast }  from "./components/ui.jsx";
import { ROLE_COLOR } from "./data.js";
import { Badge } from "./components/ui.jsx";
import { useState as useState2 } from "react";

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState2(false);
  return (
    <div style={{ position: "relative" }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 149 }} />}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8 }}
      >
        <div style={{ width: 30, height: 30, background: "#2563EB", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {user.name[0]}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#333", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name.split(" ")[0]}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 40, right: 0, width: 180,
          background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          border: "1px solid #e8e8e8", padding: "6px 0", zIndex: 150,
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{user.role}</div>
          </div>
          <button
            onClick={onLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c62828" }}
          >
            <Icon name="logout" size={15} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user,      setUser]      = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [page,      setPage]      = useState(() => sessionStorage.getItem("page") || "dashboard");
  const [docs,      setDocs]      = useState([]);
  const [users,     setUsers]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [viewDoc,   setViewDoc]   = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [toast,     setToast]     = useState("");
  const { isMobile, isDesktop } = useResponsive();

  const { data: serverDocs = [] } = useDocs();
  const { data: logsData = [] } = useLogs();
  const { data: usersData = [] } = useUsers();
  const { data: categoriesData = [] } = useCategories();
  const { data: sectorsData = [] } = useSectors();

  // Sync server data into local state, preserving local overrides
  useEffect(() => {
    if (serverDocs.length > 0) {
      setDocs(prev => {
        const map = new Map(serverDocs.map(d => [d.id, d]));
        for (const d of prev) {
          if (map.has(d.id)) {
            map.set(d.id, { ...map.get(d.id), status: d.status });
          } else {
            map.set(d.id, d);
          }
        }
        return [...map.values()];
      });
    }
  }, [serverDocs]);

  useEffect(() => { if (logsData.length > 0) setLogs(logsData); }, [logsData]);
  useEffect(() => { if (usersData.length > 0) setUsers(usersData); }, [usersData]);
  useEffect(() => { if (categoriesData.length > 0) setCategories(categoriesData); }, [categoriesData]);
  useEffect(() => { if (sectorsData.length > 0) setSectors(sectorsData); }, [sectorsData]);

  const handleLogin = loggedUser => {
    localStorage.setItem("user", JSON.stringify(loggedUser));
    setUser(loggedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    sessionStorage.removeItem("page");
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

  const goPage = p => { setPage(p); setViewDoc(null); sessionStorage.setItem("page", p); };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleApprove = doc => {
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: "Diarsipkan", reviewedBy: user.name } : x));
    addLog("Approve dokumen", doc);
    api(`/api/docs/${doc.id}/status`, "PATCH", { status: "Diarsipkan" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['docs'] });
    setViewDoc(null);
    setPage("dokumen");
    showToast("Dokumen berhasil disetujui dan diarsipkan.");
  };

  const handleReject = doc => {
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: "Ditolak" } : x));
    addLog("Tolak dokumen", doc);
    api(`/api/docs/${doc.id}/status`, "PATCH", { status: "Ditolak" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['docs'] });
    setViewDoc(null);
    setPage("dokumen");
    showToast("Dokumen ditolak dan dikembalikan ke pengupload.");
  };

  const handleDownload = doc => {
    addLog("Unduh dokumen", doc);
    window.open(doc.url, "_blank");
  };

  const handlePreview = doc => {
    addLog("Preview dokumen", doc);
    window.open(doc.url, "_blank");
  };

  const handleTogglePublik = doc => {
    const newPublik = !doc.publik;
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, publik: newPublik } : x));
    addLog(newPublik ? "Publikasikan dokumen" : "Batalkan publikasi dokumen", doc);
    api(`/api/docs/${doc.id}/publik`, "PATCH").catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['docs'] });
    showToast(newPublik ? "Dokumen berhasil dipublikasikan ke portal publik." : "Dokumen dihapus dari portal publik.");
  };

  const handleUpload = async (form, onProgress) => {
    if (!form.fileObj) return showToast("Pilih file terlebih dahulu.");

    try {
      var gasUrl = import.meta.env.VITE_GAS_WEBAPP_URL;
      if (!gasUrl) { showToast("GAS_URL belum dikonfigurasi"); return; }

      var reader = new FileReader();
      var base64 = await new Promise(function (resolve, reject) {
        reader.onload  = function () { resolve(reader.result.split(",")[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(form.fileObj);
      });

      var payload = JSON.stringify({
        file:     base64,
        filename: form.fileObj.name,
        mimeType: form.fileObj.type,
        title:    form.title,
        type:     form.type,
        sector:   form.sector,
        year:     form.year,
        uploader: user.name,
      });

      var data = await new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', gasUrl);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        xhr.onload = function () {
          onProgress(100);
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (_) { resolve({}); }
        };
        xhr.onerror = function () { reject(new Error('Network error')); };
        xhr.send(payload);
      });

      var newDoc = {
        id:         Date.now(),
        title:      form.title,
        type:       form.type,
        sector:     form.sector,
        year:       form.year,
        status:     "Menunggu Review",
        uploader:   user.name,
        reviewedBy: "—",
        size:       form.fileObj.size ? (form.fileObj.size / 1048576).toFixed(1) + " MB" : "—",
        pages:      0,
        uploadDate: new Date().toLocaleDateString("id-ID"),
        desc:       form.desc || "—",
        tags:       form.tags ? form.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [],
        url:        data.fileUrl || "",
        publik:     false,
      };
      setDocs(function (d) { return [newDoc].concat(d); });
      addLog("Upload dokumen", newDoc);
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      setPage("dokumen");
      showToast("Dokumen berhasil diunggah dan dikirim untuk review.");
    } catch (err) {
      showToast("Gagal mengunggah: " + err.message);
    }
  };

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!user) return <LoginPage onLogin={handleLogin} />;

  // ── Pending notifications count ────────────────────────────────────────────
  const pendingCount = docs.filter(d => d.status !== "Diarsipkan" && d.status !== "Ditolak").length;

  // ── Active doc from live docs array ───────────────────────────────────────
  const liveDoc = viewDoc ? docs.find(d => d.id === viewDoc.id) || viewDoc : null;

  return (
    <div style={{ display: "flex", width: "100%", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", background: "#f5f7f5" }}>
      {!isMobile && (
        <Sidebar
          active={viewDoc ? "dokumen" : page}
          onNav={(p) => { goPage(p); }}
          user={user}
          onLogout={handleLogout}
          collapsed={collapsed}
        />
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", paddingBottom: isMobile ? 64 : 0 }}>
        {/* Topbar */}
        <div style={{
          background: "#fff", borderBottom: "1px solid #e8e8e8",
          padding: isMobile ? "10px 14px" : "11px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 100, minHeight: 48,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isMobile && (
              <button
                onClick={() => setCollapsed(c => !c)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 6, borderRadius: 6, minWidth: 32, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
                aria-label="Toggle menu"
              >
                <Icon name="menu" size={20} />
              </button>
            )}
            {isMobile && (
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0d2b1a" }}>
                {page === "dashboard" && "Dashboard"}
                {page === "dokumen" && !viewDoc && "Dokumen"}
                {page === "dokumen" && viewDoc && "Detail Dokumen"}
                {page === "upload" && "Upload Dokumen"}
                {page === "pencarian" && "Pencarian"}
                {page === "publik" && "Portal Publik"}
                {page === "pengguna" && "Pengguna"}
                {page === "kategori-dokumen" && "Tipe Dokumen"}
                {page === "sektor" && "Sektor"}
                {page === "audit" && "Audit Trail"}
                {page === "panduan" && "Panduan Pengguna"}
                {page === "bankdata" && "Bank Data"}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14 }}>
            {pendingCount > 0 && (
              <div style={{ position: "relative", cursor: "pointer" }} onClick={() => goPage("dokumen")}>
                <Icon name="bell" size={isMobile ? 17 : 18} style={{ color: "#666" }} />
                <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#c62828", borderRadius: 50, fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {pendingCount}
                </span>
              </div>
            )}
            {!isMobile && (
              <>
                <div style={{ fontSize: 13, color: "#666" }}>
                  Halo, <b>{user.name.split(" ")[0]}</b>
                </div>
                <Badge label={user.role} colors={ROLE_COLOR[user.role]} />
              </>
            )}
            {isMobile && <ProfileMenu user={user} onLogout={handleLogout} />}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: isMobile ? 14 : 24, overflowY: "auto" }}>
          {page === "dashboard" && !viewDoc && (
            <Dashboard docs={docs} onNav={goPage} sectors={sectors} categories={categories} />
          )}
          {page === "dokumen" && !viewDoc && (
            <DocList docs={docs} onView={d => setViewDoc(d)} user={user} categories={categories} sectors={sectors} />
          )}
          {page === "dokumen" && viewDoc && (
            <DocDetail
              doc={liveDoc}
              onBack={() => setViewDoc(null)}
              onApprove={handleApprove}
              onReject={handleReject}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onTogglePublik={handleTogglePublik}
              user={user}
            />
          )}
          {page === "upload" && (
            <UploadForm onSubmit={handleUpload} user={user} categories={categories} sectors={sectors} />
          )}
          {page === "pencarian" && (
            <Pencarian docs={docs} onView={d => { setViewDoc(d); setPage("dokumen"); }} />
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

        {/* Bottom Nav */}
        {isMobile && (
          <BottomNav active={viewDoc ? "dokumen" : page} onNav={goPage} user={user} />
        )}
      </div>

      <Toast msg={toast} onClose={() => setToast("")} />
    </div>
  );
}
