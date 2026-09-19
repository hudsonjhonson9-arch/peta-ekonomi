# Share Links + QR Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shareable document links with configurable expiry and QR/verification code system for document authenticity verification.

**Architecture:** Token-based approach — new `doc_shares` table stores unique tokens and verification codes. Express endpoints handle CRUD for shares and public access/verification. React modal in document detail generates share links with QR codes via client-side `qrcode` library.

**Tech Stack:** Express.js, PostgreSQL, React, `qrcode` npm (frontend QR generation), Node.js `crypto` (token generation)

## Global Constraints

- Mode: lokal dulu (dev server), belum production deploy
- Semua user login boleh membuat tautan berbagi
- Token: 8-char hex (`crypto.randomBytes(4).toString('hex').toUpperCase()`)
- Verifikasi: 8-char format `XXXX-XXXX`
- Durasi: "1h", "24h", "7d", "30d", "custom"
- QR generate client-side pakai `qrcode` npm
- Tidak ada cleanup job expired shares

## File Structure

| File | Responsibility |
|------|---------------|
| `server/migrations/tahap_1.sql` | Migration: `doc_shares` table |
| `server/index.js` | 5 new API endpoints |
| `src/components/ShareModal.jsx` | Modal berbagi (durasi + list + QR + kode) |
| `src/components/DocPages.jsx` | Add "Bagikan" button + mount ShareModal |
| `src/components/PortalPublik.jsx` | Input kode verifikasi field |

---

### Task 1: Database Migration — doc_shares table

**Files:**
- Create: `server/migrations/tahap_1.sql`
- Modify: `server/index.js` (add auto-migration runner)

**Interfaces:**
- Consumes: existing PostgreSQL database
- Produces: `doc_shares` table with indexes

- [ ] **Step 1: Create migration file**

Create `server/migrations/tahap_1.sql`:

```sql
-- ============================================================
-- Tahap 1: Migrasi untuk fitur berbagi tautan + verifikasi
-- Jalankan: psql -d your_database -f tahap_1.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_shares (
  id            SERIAL PRIMARY KEY,
  doc_id        INT NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  verif_code    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON doc_shares(token);
CREATE INDEX IF NOT EXISTS idx_doc_shares_verif ON doc_shares(verif_code);
```

- [ ] **Step 2: Add auto-migration runner in server/index.js**

Add after the existing tahap_0 migration block (~line 30):

```javascript
// ── Tahap 1: doc_shares table ──
const tahap1 = fs.readFileSync(path.join(__dirname, 'migrations', 'tahap_1.sql'), 'utf8');
await pool.query(tahap1).catch(e => {
  if (e.code === '42710' || e.code === '42P07') return; // already exists
  console.error('tahap_1 error:', e.message);
});
```

- [ ] **Step 3: Run server to verify migration**

Run: `node server/index.js`
Expected: Server starts without errors, `doc_shares` table created

- [ ] **Step 4: Commit**

```bash
git add server/migrations/tahap_1.sql server/index.js
git commit -m "feat(db): add doc_shares table for share links + verification"
```

---

### Task 2: Backend — Share CRUD Endpoints

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Consumes: `doc_shares` table from Task 1
- Produces: 3 endpoints for share management

- [ ] **Step 1: Add create share endpoint**

Add in `server/index.js` after existing doc endpoints:

```javascript
// ── Create share link ──
app.post('/api/docs/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresIn, customExpiresAt } = req.body;
    const userId = req.headers['x-user-id'] || 'system';

    // Generate token & verification code
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const verifCode = `${rawCode.slice(0,4)}-${rawCode.slice(4)}`;

    // Calculate expiry
    let expiresAt = null;
    if (expiresIn && expiresIn !== 'none') {
      const durations = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      if (expiresIn === 'custom' && customExpiresAt) {
        expiresAt = new Date(customExpiresAt);
      } else if (durations[expiresIn]) {
        expiresAt = new Date(Date.now() + durations[expiresIn]);
      }
    }

    const result = await pool.query(
      `INSERT INTO doc_shares (doc_id, token, verif_code, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, token, verifCode, expiresAt, userId]
    );

    res.json({ share: result.rows[0] });
  } catch (e) {
    console.error('Create share error:', e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Add list shares endpoint**

```javascript
// ── List share links for doc ──
app.get('/api/docs/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM doc_shares WHERE doc_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [id]
    );
    res.json({ shares: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 3: Add revoke share endpoint**

```javascript
// ── Revoke share link ──
app.delete('/api/docs/:id/shares/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    await pool.query(`UPDATE doc_shares SET is_active = FALSE WHERE id = $1`, [shareId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 4: Test endpoints with curl**

Run:
```bash
# Create share
curl -X POST http://localhost:3000/api/docs/1/shares -H "Content-Type: application/json" -d "{\"expiresIn\":\"24h\"}"

# List shares
curl http://localhost:3000/api/docs/1/shares
```

Expected: JSON response with share object containing token and verif_code

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat(api): add share CRUD endpoints (create/list/revoke)"
```

---

### Task 3: Backend — Public Token Access + Verification Endpoints

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Consumes: `doc_shares` table from Task 1
- Produces: 2 public endpoints (no auth required)

- [ ] **Step 1: Add public token access endpoint**

Add before the catch-all route (`/{*path}`):

```javascript
// ── Public: access doc via share token ──
app.get('/api/publik', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const result = await pool.query(
      `SELECT s.*, d.judul, d.file_type, d.versi, d."desc", d.tags, d.nomor_dokumen
       FROM doc_shares s
       JOIN bapperida_dokumen d ON d.id = s.doc_id
       WHERE s.token = $1 AND s.is_active = TRUE`,
      [token.toUpperCase()]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Tautan tidak valid atau sudah kedaluwarsa' });
    }

    const share = result.rows[0];
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(404).json({ error: 'Tautan sudah kedaluwarsa' });
    }

    const doc = await pool.query(`SELECT * FROM bapperida_dokumen WHERE id = $1`, [share.doc_id]);
    res.json({
      doc: doc.rows[0],
      share: { token: share.token, verif_code: share.verif_code, expires_at: share.expires_at }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Add public verification endpoint**

```javascript
// ── Public: verify doc via verification code ──
app.get('/api/publik/verify', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Kode verifikasi required' });

    const result = await pool.query(
      `SELECT s.*, d.judul, d.file_type, d.versi, d."desc", d.tags
       FROM doc_shares s
       JOIN bapperida_dokumen d ON d.id = s.doc_id
       WHERE UPPER(s.verif_code) = UPPER($1) AND s.is_active = TRUE`,
      [code.replace(/\s/g, '')]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kode verifikasi tidak valid' });
    }

    const share = result.rows[0];
    const expired = share.expires_at && new Date(share.expires_at) < new Date();

    res.json({
      doc: { id: share.doc_id, judul: share.judul, file_type: share.file_type, versi: share.versi, desc: share.desc, tags: share.tags },
      verified: true,
      expired,
      verified_at: new Date().toISOString(),
      share: { created_at: share.created_at, expires_at: share.expires_at }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 3: Test public endpoints**

Run:
```bash
# Get token from Task 2 response, then:
curl "http://localhost:3000/api/publik?token=YOUR_TOKEN"
curl "http://localhost:3000/api/publik/verify?code=XXXX-XXXX"
```

Expected: Doc data returned, or 404 with error message

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat(api): add public token access + verification endpoints"
```

---

### Task 4: Install qrcode dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: npm registry
- Produces: `qrcode` package available for import

- [ ] **Step 1: Install qrcode**

Run: `npm install qrcode`

- [ ] **Step 2: Verify installation**

Run: `npm ls qrcode`
Expected: `qrcode@x.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add qrcode for QR generation"
```

---

### Task 5: Frontend — ShareModal Component

**Files:**
- Create: `src/components/ShareModal.jsx`

**Interfaces:**
- Consumes: `/api/docs/:id/shares` (POST, GET, DELETE) from Task 2
- Produces: `<ShareModal docId={number} onClose={fn} />` component

- [ ] **Step 1: Create ShareModal component**

Create `src/components/ShareModal.jsx`:

```jsx
import { useState, useEffect } from "react";
import QRCode from "qrcode";

const T = {
  bg: "#0f172a", card: "#1e293b", border: "#334155", text: "#f1f5f9",
  textSecondary: "#94a3b8", primary: "#3b82f6", primaryLight: "rgba(59,130,246,0.1)",
  danger: "#ef4444", radius: 12, shadow: "0 4px 24px rgba(0,0,0,0.25)",
};

const btnBase = {
  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
  border: "none", borderRadius: 8, fontWeight: 600, transition: "all 0.15s",
};

const DURATIONS = [
  { label: "1 Jam", value: "1h" },
  { label: "24 Jam", value: "24h" },
  { label: "7 Hari", value: "7d" },
  { label: "30 Hari", value: "30d" },
];

export default function ShareModal({ docId, docTitle, api, onClose }) {
  const [duration, setDuration] = useState("24h");
  const [customDate, setCustomDate] = useState("");
  const [shares, setShares] = useState([]);
  const [qrImages, setQrImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadShares(); }, []);

  async function loadShares() {
    try {
      const data = await api(`/api/docs/${docId}/shares`);
      setShares(data.shares || []);
    } catch (e) { console.error(e); }
  }

  async function createShare() {
    setLoading(true);
    try {
      const body = duration === "custom" && customDate
        ? { expiresIn: "custom", customExpiresAt: new Date(customDate).toISOString() }
        : { expiresIn: duration };
      await api(`/api/docs/${docId}/shares`, { method: "POST", body: JSON.stringify(body) });
      await loadShares();
    } catch (e) { alert("Gagal membuat tautan: " + e.message); }
    setLoading(false);
  }

  async function revokeShare(shareId) {
    if (!confirm("Hapus tautan ini?")) return;
    await api(`/api/docs/${docId}/shares/${shareId}`, { method: "DELETE" });
    await loadShares();
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function generateQR(share) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/#/publik?token=${share.token}`;
    const verifUrl = `${baseUrl}/#/publik?verify=${share.verif_code}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1, color: { dark: "#f1f5f9", light: "#1e293b" } });
    setQrImages(prev => ({ ...prev, [share.id]: { url: dataUrl, verif: verifUrl } }));
  }

  function formatExpiry(date) {
    if (!date) return "Selamanya";
    return new Date(date).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: T.shadow, border: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Bagikan Dokumen</div>
          <button onClick={onClose} style={{ ...btnBase, background: "transparent", color: T.textSecondary, padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Duration picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 8 }}>Masa Berlaku</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => setDuration(d.value)}
                style={{ ...btnBase, padding: "8px 14px", fontSize: 13, background: duration === d.value ? T.primary : T.bg, color: duration === d.value ? "#fff" : T.textSecondary, border: `1.5px solid ${duration === d.value ? T.primary : T.border}` }}>
                {d.label}
              </button>
            ))}
            <button onClick={() => setDuration("custom")}
              style={{ ...btnBase, padding: "8px 14px", fontSize: 13, background: duration === "custom" ? T.primary : T.bg, color: duration === "custom" ? "#fff" : T.textSecondary, border: `1.5px solid ${duration === "custom" ? T.primary : T.border}` }}>
              Kustom
            </button>
          </div>
          {duration === "custom" && (
            <input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)}
              style={{ marginTop: 8, width: "100%", padding: "8px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13 }} />
          )}
        </div>

        {/* Create button */}
        <button onClick={createShare} disabled={loading}
          style={{ ...btnBase, padding: "10px 20px", fontSize: 14, background: T.primary, color: "#fff", width: "100%", justifyContent: "center", marginBottom: 20, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Membuat..." : "Buat Tautan"}
        </button>

        {/* Active shares list */}
        {shares.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 8 }}>Tautan Aktif</div>
            {shares.map(s => {
              const baseUrl = window.location.origin;
              const link = `${baseUrl}/#/publik?token=${s.token}`;
              return (
                <div key={s.id} style={{ background: T.bg, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textSecondary, wordBreak: "break-all", marginBottom: 4 }}>{link}</div>
                  <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>Kadaluarsa: {formatExpiry(s.expires_at)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copyText(link, s.id)} style={{ ...btnBase, padding: "6px 10px", fontSize: 12, background: T.card, color: copied === s.id ? T.primary : T.textSecondary, border: `1px solid ${T.border}` }}>
                      {copied === s.id ? "Tersalin!" : "Copy"}
                    </button>
                    <button onClick={() => generateQR(s)} style={{ ...btnBase, padding: "6px 10px", fontSize: 12, background: T.card, color: T.textSecondary, border: `1px solid ${T.border}` }}>
                      QR
                    </button>
                    <button onClick={() => revokeShare(s.id)} style={{ ...btnBase, padding: "6px 10px", fontSize: 12, background: "rgba(239,68,68,0.1)", color: T.danger, border: `1px solid ${T.danger}33` }}>
                      Hapus
                    </button>
                  </div>
                  {/* QR Display */}
                  {qrImages[s.id] && (
                    <div style={{ marginTop: 10, textAlign: "center" }}>
                      <img src={qrImages[s.id].url} alt="QR Code" style={{ borderRadius: 8, border: `1px solid ${T.border}` }} />
                      <div style={{ marginTop: 6, fontSize: 12, color: T.textSecondary }}>
                        Kode: <strong style={{ color: T.primary }}>{s.verif_code}</strong>
                      </div>
                      <button onClick={() => copyText(s.verif_code, `code-${s.id}`)} style={{ ...btnBase, padding: "4px 10px", fontSize: 11, background: T.card, color: copied === `code-${s.id}` ? T.primary : T.textSecondary, border: `1px solid ${T.border}`, marginTop: 4 }}>
                        {copied === `code-${s.id}` ? "Tersalin!" : "Copy Kode"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {shares.length === 0 && (
          <div style={{ textAlign: "center", color: T.textSecondary, fontSize: 13, padding: 20 }}>
            Belum ada tautan aktif
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npm run build 2>&1 | Select-String -Pattern "error|built"`
Expected: ✓ built

- [ ] **Step 3: Commit**

```bash
git add src/components/ShareModal.jsx
git commit -m "feat(ui): add ShareModal component with QR + verification code"
```

---

### Task 6: Integrate ShareModal into DocPages

**Files:**
- Modify: `src/components/DocPages.jsx`

**Interfaces:**
- Consumes: `<ShareModal />` from Task 5
- Produces: "Bagikan" button in document detail + modal trigger

- [ ] **Step 1: Add import and state for ShareModal**

In `DocPages.jsx`, add import at top:

```javascript
import ShareModal from "./ShareModal";
```

Add state near other state declarations:

```javascript
const [showShareModal, setShowShareModal] = useState(false);
const [shareDocId, setShareDocId] = useState(null);
const [shareDocTitle, setShareDocTitle] = useState("");
```

- [ ] **Step 2: Add "Bagikan" button in document detail**

Find the document detail section (where edit/approve/reject buttons are). Add a "Bagikan" button:

```jsx
{/* Share button */}
{doc.status === "Diarsipkan" && (
  <button
    onClick={() => { setShareDocId(doc.id); setShareDocTitle(doc.judul); setShowShareModal(true); }}
    style={{ ...btnBase, padding: "8px 14px", fontSize: 13, background: T.primary, color: "#fff", borderRadius: 10 }}
  >
    <Icon name="share" size={14} /> Bagikan
  </button>
)}
```

- [ ] **Step 3: Add ShareModal rendering**

Before the closing `</div>` of the component, add:

```jsx
{showShareModal && (
  <ShareModal
    docId={shareDocId}
    docTitle={shareDocTitle}
    api={api}
    onClose={() => setShowShareModal(false)}
  />
)}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | Select-String -Pattern "error|built"`
Expected: ✓ built

- [ ] **Step 5: Commit**

```bash
git add src/components/DocPages.jsx
git commit -m "feat(ui): add Bagikan button in doc detail + mount ShareModal"
```

---

### Task 7: Add Verification Input to PortalPublik

**Files:**
- Modify: `src/components/PortalPublik.jsx`

**Interfaces:**
- Consumes: `/api/publik/verify?code=...` from Task 3
- Produces: Verification input field + result display

- [ ] **Step 1: Add verification state and handler**

In `PortalPublik.jsx`, add state:

```javascript
const [verifCode, setVerifCode] = useState("");
const [verifResult, setVerifResult] = useState(null);
const [verifLoading, setVerifLoading] = useState(false);
const [verifError, setVerifError] = useState("");
```

Add verification function:

```javascript
async function handleVerify() {
  if (!verifCode.trim()) return;
  setVerifLoading(true);
  setVerifError("");
  setVerifResult(null);
  try {
    const res = await fetch(`/api/publik/verify?code=${encodeURIComponent(verifCode.trim())}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verifikasi gagal");
    setVerifResult(data);
  } catch (e) {
    setVerifError(e.message);
  }
  setVerifLoading(false);
}
```

- [ ] **Step 2: Add verification UI in portal**

Add the verification input section in the portal JSX (before or after the existing doc list):

```jsx
{/* Verifikasi Dokumen */}
<div style={{ background: "#1e293b", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid #334155" }}>
  <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
    Verifikasi Dokumen
  </div>
  <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
    Masukkan kode verifikasi untuk memeriksa keaslian dokumen
  </div>
  <div style={{ display: "flex", gap: 8 }}>
    <input
      value={verifCode}
      onChange={e => setVerifCode(e.target.value)}
      placeholder="Contoh: A3K9-M2X7"
      maxLength={9}
      style={{ flex: 1, padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 14, fontFamily: "monospace", letterSpacing: 2 }}
      onKeyDown={e => e.key === "Enter" && handleVerify()}
    />
    <button onClick={handleVerify} disabled={verifLoading}
      style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", opacity: verifLoading ? 0.6 : 1 }}>
      {verifLoading ? "Memeriksa..." : "Verifikasi"}
    </button>
  </div>

  {verifError && (
    <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
      {verifError}
    </div>
  )}

  {verifResult && (
    <div style={{ marginTop: 12, padding: "14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>✓</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>Dokumen Terverifikasi</span>
      </div>
      <div style={{ fontSize: 13, color: "#f1f5f9", marginBottom: 4 }}>{verifResult.doc?.judul}</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>Tipe: {verifResult.doc?.file_type} · Versi: {verifResult.doc?.versi}</div>
      {verifResult.share?.expires_at && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          Berlaku hingga: {new Date(verifResult.share.expires_at).toLocaleString("id-ID")}
        </div>
      )}
      {verifResult.expired && (
        <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Catatan: Tautan ini sudah kedaluwarsa</div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | Select-String -Pattern "error|built"`
Expected: ✓ built

- [ ] **Step 4: Commit**

```bash
git add src/components/PortalPublik.jsx
git commit -m "feat(ui): add verification code input in PortalPublik"
```

---

### Task 8: End-to-End Test

**Files:**
- No file changes

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working feature

- [ ] **Step 1: Start server and verify**

Run: `node server/index.js`
Expected: Server starts, no errors

- [ ] **Step 2: Open browser test**

Navigate to `http://localhost:3000`

1. Login → go to Dokumen → click a doc → click "Bagikan"
2. Pick duration "24 Jam" → click "Buat Tautan"
3. Verify: token + verif_code shown, QR code visible
4. Copy link → open in incognito → verify doc loads
5. Copy code → go to Portal Publik → paste code → click "Verifikasi"
6. Verify: "Dokumen Terverifikasi" shows

- [ ] **Step 3: Test expiry**

Create a share with "1 Jam" → check it works → manually set `expires_at` to past in DB → verify it shows expired message

- [ ] **Step 4: Test revoke**

Revoke a share → try accessing the link → verify 404

- [ ] **Step 5: Commit test results (if any test files created)**

```bash
git add -A
git commit -m "test: verify share links + QR verification end-to-end"
```
