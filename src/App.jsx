import { useState, useEffect } from "react";
import LoginPage        from "./components/LoginPage.jsx";
import Sidebar          from "./components/Sidebar.jsx";
import Dashboard        from "./components/Dashboard.jsx";
import { DocList, DocDetail } from "./components/DocPages.jsx";
import UploadForm       from "./components/UploadForm.jsx";
import { Pencarian, PortalPublik, ManajemenPengguna, AuditTrail, ManajemenKategoriDokumen } from "./components/Pages.jsx";
import { Icon, Toast }  from "./components/ui.jsx";
import { INITIAL_DOCS, INITIAL_USERS, INITIAL_LOGS, ROLE_COLOR } from "./data.js";
import { Badge } from "./components/ui.jsx";

export default function App() {
  const [user,      setUser]      = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [page,      setPage]      = useState("dashboard");
  const [docs,      setDocs]      = useState(INITIAL_DOCS);
  const [users,     setUsers]     = useState(INITIAL_USERS);
  const [logs,      setLogs]      = useState(INITIAL_LOGS);
  const [categories, setCategories] = useState([]);
  const [viewDoc,   setViewDoc]   = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [toast,     setToast]     = useState("");

  const fetchUsers = () => {
    fetch("/api/users").then(r => r.json()).then(setUsers).catch(console.error);
  };

  const fetchCategories = () => {
    fetch("/api/kategori-dokumen").then(r => r.json()).then(setCategories).catch(console.error);
  };

  useEffect(() => {
    if (!user) return; // Fetch data only after login
    fetch("/api/docs").then(r => r.json()).then(setDocs).catch(console.error);
    fetch("/api/logs").then(r => r.json()).then(setLogs).catch(console.error);
    fetchUsers();
    fetchCategories();
  }, [user]);

  const handleLogin = loggedUser => {
    localStorage.setItem("user", JSON.stringify(loggedUser));
    setUser(loggedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
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

  const goPage = p => { setPage(p); setViewDoc(null); };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleApprove = doc => {
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: "Diarsipkan", reviewedBy: user.name } : x));
    addLog("Approve dokumen", doc);
    setViewDoc(null);
    setPage("dokumen");
    showToast("Dokumen berhasil disetujui dan diarsipkan.");
  };

  const handleReject = doc => {
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, status: "Ditolak" } : x));
    addLog("Tolak dokumen", doc);
    setViewDoc(null);
    setPage("dokumen");
    showToast("Dokumen ditolak dan dikembalikan ke pengupload.");
  };

  const openOrDownloadDataUrl = (dataUrl, fileName, shouldDownload = false) => {
    if (!dataUrl) {
      alert("File tidak tersedia atau URL kosong.");
      return;
    }
    
    let base64Part = dataUrl;
    let mimeType = "application/pdf";
    
    if (dataUrl.startsWith("data:")) {
      const parts = dataUrl.split(",");
      const meta = parts[0].split(";");
      mimeType = meta[0].replace("data:", "");
      base64Part = parts[1];
    }
    
    try {
      const byteCharacters = atob(base64Part);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      
      if (shouldDownload) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.open(blobUrl, "_blank");
      }
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      console.error("Error processing file URL:", error);
      window.open(dataUrl, "_blank");
    }
  };

  const handleDownload = doc => {
    addLog("Unduh dokumen", doc);
    showToast(`Mengunduh "${doc.title}"...`);
    
    let ext = ".pdf";
    if (doc.url && doc.url.includes("wordprocessingml")) ext = ".docx";
    else if (doc.url && doc.url.includes("spreadsheetml")) ext = ".xlsx";
    else if (doc.url && doc.url.includes("image/jpeg")) ext = ".jpg";
    else if (doc.url && doc.url.includes("image/png")) ext = ".png";
    
    const fileName = doc.title.toLowerCase().endsWith(ext) ? doc.title : `${doc.title}${ext}`;
    openOrDownloadDataUrl(doc.url, fileName, true);
  };

  const handlePreview = doc => {
    addLog("Preview dokumen", doc);
    openOrDownloadDataUrl(doc.url, doc.title, false);
  };

  const handleUpload = async form => {
    if (!form.fileObj) return showToast("Pilih file terlebih dahulu.");

    try {
      var reader = new FileReader();
      var base64 = await new Promise(function (resolve, reject) {
        reader.onload  = function () { resolve(reader.result.split(",")[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(form.fileObj);
      });

      var res = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          file:     base64,
          filename: form.fileObj.name,
          mimeType: form.fileObj.type,
          title:    form.title,
          type:     form.type,
          sector:   form.sector,
          year:     form.year,
          uploader: user.name,
        }),
      });

      var data = { message: "OK", fileUrl: "" };
      try { data = await res.json(); } catch (_) {}

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
      };
      setDocs(function (d) { return [newDoc].concat(d); });
      addLog("Upload dokumen", newDoc);
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
      <Sidebar
        active={viewDoc ? "dokumen" : page}
        onNav={goPage}
        user={user}
        onLogout={handleLogout}
        collapsed={collapsed}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "11px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 4, borderRadius: 6 }}
          >
            <Icon name="menu" size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {pendingCount > 0 && (
              <div style={{ position: "relative", cursor: "pointer" }} onClick={() => goPage("dokumen")}>
                <Icon name="bell" size={18} style={{ color: "#666" }} />
                <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#c62828", borderRadius: 50, fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {pendingCount}
                </span>
              </div>
            )}
            <div style={{ fontSize: 13, color: "#666" }}>
              Halo, <b>{user.name.split(" ")[0]}</b>
            </div>
            <Badge label={user.role} colors={ROLE_COLOR[user.role]} />
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {page === "dashboard" && !viewDoc && (
            <Dashboard docs={docs} onNav={goPage} />
          )}
          {page === "dokumen" && !viewDoc && (
            <DocList docs={docs} onView={d => setViewDoc(d)} user={user} categories={categories} />
          )}
          {page === "dokumen" && viewDoc && (
            <DocDetail
              doc={liveDoc}
              onBack={() => setViewDoc(null)}
              onApprove={handleApprove}
              onReject={handleReject}
              onDownload={handleDownload}
              onPreview={handlePreview}
              user={user}
            />
          )}
          {page === "upload" && (
            <UploadForm onSubmit={handleUpload} user={user} categories={categories} />
          )}
          {page === "pencarian" && (
            <Pencarian docs={docs} onView={d => { setViewDoc(d); setPage("dokumen"); }} />
          )}
          {page === "publik" && (
            <PortalPublik docs={docs} onDownload={handleDownload} />
          )}
          {page === "pengguna" && user.role === "Admin" && (
            <ManajemenPengguna users={users} onReload={fetchUsers} showToast={showToast} />
          )}
          {page === "kategori-dokumen" && user.role === "Admin" && (
            <ManajemenKategoriDokumen categories={categories} onReload={fetchCategories} showToast={showToast} />
          )}
          {page === "audit" && user.role === "Admin" && (
            <AuditTrail logs={logs} />
          )}
        </div>
      </div>

      <Toast msg={toast} onClose={() => setToast("")} />
    </div>
  );
}
