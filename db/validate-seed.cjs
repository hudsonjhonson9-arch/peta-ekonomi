// Validasi statis db/seed_rkpd_2025.sql tanpa server Postgres.
//
// Dua aturan penting:
//  1. Semua pemindaian mengabaikan karakter di dalam string literal.
//  2. Tidak ada asumsi bentuk statement. Kolom wajib, lebar tupel, dan urutan
//     kolom diturunkan dari server/migrations/tahap_2.sql dan dari VALUES di
//     seed itu sendiri. Versi sebelumnya meng-hardcode teks INSERT, sehingga
//     seed yang kehilangan kolom `nama` tetap lolos 24 pemeriksaan.
const fs = require("fs");
const sql = fs.readFileSync(__dirname + "/../db/seed_rkpd_2025.sql", "utf8");
const mig = fs.readFileSync(__dirname + "/../server/migrations/tahap_2.sql", "utf8");

let fail = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "GAGAL") + " " + m); if (!c) fail++; };
const unq = s => s.trim().replace(/^'|'$/g, "").replace(/''/g, "'");

// ── 1. Keseimbangan kurung & kutip ────────────────────────────────────────
let depth = 0, minDepth = 0, parenInString = 0, inQ = false;
for (let i = 0; i < sql.length; i++) {
  const c = sql[i];
  if (c === "'") {
    if (inQ && sql[i + 1] === "'") { i++; continue; }
    inQ = !inQ; continue;
  }
  if (inQ) { if (c === "(" || c === ")") parenInString++; continue; }
  if (c === "(") depth++;
  else if (c === ")") { depth--; minDepth = Math.min(minDepth, depth); }
}
ok(depth === 0 && minDepth === 0, `kurung di luar string seimbang (akhir ${depth}, min ${minDepth})`);
ok(parenInString % 2 === 0, `kurung di dalam string seimbang (${parenInString})`);
const sq = (sql.match(/'/g) || []).length;
ok(sq % 2 === 0, `kutip tunggal/genap (${sq})`);

// ── 2. Kolom wajib dari migration (NOT NULL tanpa DEFAULT) ────────────────
function definisiTabel(migSQL) {
  const tabel = {};
  const re = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(/g;
  let m;
  while ((m = re.exec(migSQL))) {
    const nama = m[1];
    let d = 1, j = re.lastIndex;
    while (j < migSQL.length && d > 0) {
      const c = migSQL[j];
      // Komentar baris '--' boleh memuat kutip; kalau dilewati, status
      // "dalam string" jadi kacau dan kurung constraint tidak terhitung.
      if (c === "-" && migSQL[j + 1] === "-") {
        const eol = migSQL.indexOf("\n", j);
        j = eol < 0 ? migSQL.length : eol;
        continue;
      }
      if (c === "'") {
        if (migSQL[j + 1] === "'") { j += 2; continue; }
        // j+1 menunjuk karakter sesudah kutip pembuka. Loop berakhir saat
        // m[j+1] === "'", jadi kutip penutup ada di k+1 dan karakter pertama
        // sesudah string di k+2. Kalau hanya j++, kutip penutup dibaca lagi
        // sebagai pembuka dan seluruh kurung setelahnya ikut ter-swallow.
        let k = j;
        while (k < migSQL.length && migSQL[k + 1] !== "'") k++;
        j = k + 2;
        continue;
      }
      else if (c === "(") d++;
      else if (c === ")") d--;
      j++;
    }
    const body = migSQL.slice(re.lastIndex, j - 1);
    const kolom = {};
    for (const baris of body.split("\n")) {
      const b = baris.trim().replace(/,$/, "");
      if (!b) continue;
      if (/^(PRIMARY KEY|UNIQUE|FOREIGN KEY|CONSTRAINT|CHECK|EXCLUDE)\b/i.test(b)) continue;
      const km = b.match(/^(\w+)\s+([A-Za-z]+[\s\S]*)$/);
      if (!km) continue;
      kolom[km[1]] = { tipe: km[2] };
    }
    tabel[nama] = kolom;
  }
  return tabel;
}
const tabel = definisiTabel(mig);
const wajibDari = tbl => {
  const k = tabel[tbl];
  if (!k) return null;
  return Object.entries(k)
    .filter(([, v]) => /\bNOT\s+NULL\b/i.test(v.tipe) && !/\bDEFAULT\b/i.test(v.tipe))
    .map(([n]) => n);
};

// ── 3. Parser statement INSERT generik ────────────────────────────────────
function tupelSejak(i) {
  const rows = [];
  let d = 0, inQ = false, cur = null;
  for (let j = i; j < sql.length; j++) {
    const c = sql[j];
    if (c === "'") {
      if (inQ && sql[j + 1] === "'") { if (cur !== null) cur += "''"; j++; continue; }
      inQ = !inQ; if (cur !== null) cur += "'";
      continue;
    }
    if (inQ) { if (cur !== null) cur += c; continue; }
    if (d === 0 && /^ON\s+CONFLICT/i.test(sql.slice(j, j + 11))) break;
    if (c === "(") { if (d === 0) { cur = ""; d = 1; continue; } d++; }
    else if (c === ")") { if (d === 0) break; d--; if (d === 0) { rows.push(cur); cur = null; continue; } }
    else if (c === ";" && d === 0) break;
    if (d > 0 && cur !== null) cur += c;
  }
  return rows;
}
function pecahKolom(body) {
  const out = [];
  let d = 0, inQ = false, cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'") { if (inQ && body[i + 1] === "'") { cur += "''"; i++; continue; } inQ = !inQ; cur += "'"; continue; }
    if (inQ) { cur += c; continue; }
    if (c === "(") d++;
    if (c === ")") d--;
    if (c === "," && d === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

const statements = [];
{
  const re = /INSERT INTO (\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(sql))) {
    const mulai = m.index;
    const akhir = sql.indexOf(";", mulai);
    const akhirStmt = akhir < 0 ? sql.length : akhir;
    const stmt = sql.slice(mulai, akhirStmt);
    const kolom = m[2].split(",").map(s => s.trim()).filter(Boolean);
    // Posisi harus ABSOLUT terhadap sql, karena tupelSejak() memindai sql.
    let alias = null, tupel = [], dariValues = false;
    const vAbs = sql.indexOf("VALUES", mulai);
    if (vAbs >= 0 && vAbs < akhirStmt) {
      dariValues = true;
      tupel = tupelSejak(vAbs + "VALUES".length).map(pecahKolom);
    }
    const aAbs = sql.indexOf(") AS d(", mulai);
    if (aAbs >= 0 && aAbs < akhirStmt) {
      alias = sql.slice(aAbs + ") AS d(".length, sql.indexOf(")", aAbs + ") AS d(".length))
        .split(",").map(s => s.trim());
      if (!dariValues) {
        const fv = sql.indexOf("FROM (VALUES", mulai);
        if (fv >= 0 && fv < akhirStmt) {
          dariValues = true;
          tupel = tupelSejak(fv + "FROM (VALUES".length).map(pecahKolom);
        }
      }
    }
    statements.push({ tabel: m[1], kolom, alias, tupel, dariValues, stmt });
  }
}
const cari = t => statements.find(s => s.tabel === t);

// ── 4. Structural: setiap INSERT harushya menyediakan semua kolom wajib ────
for (const s of statements) {
  const wajib = wajibDari(s.tabel);
  if (!wajib) { ok(false, `tabel ${s.tabel} ada di seed tapi tidak ada di migration`); continue; }
  const kurang = wajib.filter(k => !s.kolom.includes(k));
  ok(kurang.length === 0,
    `INSERT ${s.tabel}: semua kolom NOT NULL tanpa DEFAULT tersedia` +
    (kurang.length ? ` - kurang: ${kurang.join(", ")}` : ` (${wajib.join(", ")})`));
}

// Lebar tupel harus sama dengan lebar daftar alias (atau daftar kolom bila
// tanpa alias) - inilah yang menangkap pergeseran kolom di VALUES.
for (const s of statements) {
  if (!s.dariValues || !s.tupel.length) continue;
  const lebar = (s.alias || s.kolom).length;
  const salah = s.tupel.filter(t => t.length !== lebar);
  ok(salah.length === 0,
    `INSERT ${s.tabel}: setiap tupel = ${lebar} kolom` +
    (s.alias ? ` (alias d: ${s.alias.join(",")})` : "") +
    (salah.length ? ` - ${salah.length} tupel salah` : ""));
}

// Nilai alias harus pasif: tidak boleh ada NULL/kosong untuk kolom teks wajib.
for (const s of statements) {
  if (!s.alias) continue;
  for (const namaKolom of wajibDari(s.tabel)) {
    const ix = s.alias.indexOf(namaKolom);
    if (ix < 0) continue;
    const kosong = s.tupel.filter(t => !unq(t[ix] || "").trim());
    ok(kosong.length === 0,
      `INSERT ${s.tabel}: kolom alias d.${namaKolom} tidak kosong` +
      (kosong.length ? ` - ${kosong.length} kosong` : ` (${s.tupel.length} baris)`));
  }
}

// ── 5. Jumlah baris yang diharapkan ───────────────────────────────────────
// Output (kertas_kerja) sengaja tidak lagi di-seed: output beserta deadline-nya
// ditentukan admin lewat UI. Data lama berisi barang/jasa, bukan dokumen.
const expect = { pks_tahun: 1, pks_program: 4, pks_kegiatan: 13, pks_subkegiatan: 36 };
for (const [t, n] of Object.entries(expect)) {
  const s = cari(t);
  ok(s && s.tupel.length === n, `${t}: ${s ? s.tupel.length : 0} tupel (harap ${n})`);
}
ok(!cari("kertas_kerja"), "seed tidak membuat output (kertas_kerja) - ditentukan admin");
ok(!/INSERT\s+INTO\s+kertas_kerja/i.test(sql), "tidak ada INSERT INTO kertas_kerja di seed");
ok(/SENGAJA TIDAK DI-SEED/.test(sql), "seed menjelaskan kenapa output tidak di-seed");

const prog = cari("pks_program").tupel;
const keg  = cari("pks_kegiatan").tupel;
const sub  = cari("pks_subkegiatan").tupel;
const ix = (s, nama) => (s.alias || s.kolom).indexOf(nama);
const ambil = (s, tup, nama) => unq(tup[ix(s, nama)] || "");

// Kode unik per tabel.
const u = a => new Set(a).size === a.length;
ok(u(prog.map(t => unq(t[0]))), "kode program unik");
ok(u(keg.map(t => unq(t[0]))), "kode kegiatan unik");
ok(u(sub.map(t => unq(t[0]))), "kode sub kegiatan unik");

// Sub kegiatan: indikator & target wajib terisi dan diawali angka.
const sSub = cari("pks_subkegiatan");
const kosongSub = sub.filter(t => !ambil(sSub, t, "indikator") || !ambil(sSub, t, "target"));
ok(kosongSub.length === 0, `semua sub kegiatan punya indikator & target (${kosongSub.length} kosong)`);
const tanpaAngka = sub.filter(t => !/^\s*\d+/.test(ambil(sSub, t, "target")));
ok(tanpaAngka.length === 0, `semua target diawali angka (${tanpaAngka.length} tidak)`);

// ── 6. Idempotensi: file dijalankan ulang tiap boot, tiap INSERT wajib ON CONFLICT.
const tanpaKonflik = statements.filter(s => !/ON CONFLICT/i.test(s.stmt)).map(s => s.tabel);
ok(tanpaKonflik.length === 0,
  `semua ${statements.length} INSERT punya ON CONFLICT (idempoten)` + (tanpaKonflik.length ? ` - tanpa: ${tanpaKonflik.join(", ")}` : ""));

// ON CONFLICT harus menyasar indeks UNIQUE yang benar-benar ada di migration.
const punyaUnik = kolom => {
  const esc = kolom.replace(/[()]/g, c => "\\" + c);
  if (new RegExp(`UNIQUE\\s*\\(\\s*${esc.split(",").join("\\s*,\\s*")}\\s*\\)`).test(mig)) return true;
  return kolom.split(",").every(k => new RegExp(`\\b${k.trim()}\\s+[A-Za-z]+[^,]*\\bUNIQUE\\b`).test(mig));
};
ok(punyaUnik("kode, tahun"), "ON CONFLICT (kode, tahun) cocok dengan UNIQUE di migration");
ok(punyaUnik("subkegiatan_id, nama"), "ON CONFLICT (subkegiatan_id, nama) cocok dengan UNIQUE di migration");
ok(punyaUnik("tahun"), "ON CONFLICT (tahun) cocok dengan UNIQUE di migration");

console.log(fail ? `\n${fail} pemeriksaan GAGAL` : "\nSEMUA PEMERIKSAAN LULUS (statis)");
process.exit(fail ? 1 : 0);
