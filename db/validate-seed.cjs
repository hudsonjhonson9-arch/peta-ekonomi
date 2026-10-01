// Validasi statis db/seed_rkpd_2025.sql tanpa server Postgres.
// Semua pemindaiantdiabaikan karakter di dalam string literal.
const fs = require("fs");
const sql = fs.readFileSync(__dirname + "/../db/seed_rkpd_2025.sql", "utf8");

let fail = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "GAGAL") + " " + m); if (!c) fail++; };

// Kurung仕様: abaikan kurung di dalam kutip.
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

// ── Ekstrak tupel VALUES, abaikan string, berhenti di ';' tingkat atas ──
function tuplesAfter(marker) {
  const i = sql.indexOf(marker);
  if (i < 0) return null;
  const rows = [];
  let d = 0, inQ = false, cur = null;
  for (let j = i + marker.length; j < sql.length; j++) {
    const c = sql[j];
    if (c === "'") { if (inQ && sql[j + 1] === "'") { if (cur !== null) cur += "''"; j++; continue; } inQ = !inQ; if (cur !== null) cur += "'"; continue; }
    if (inQ) { if (cur !== null) cur += c; continue; }
    // 'ON CONFLICT (...)' di akhir statement bukan baris data.
    if (d === 0 && /^ON\s+CONFLICT/i.test(sql.slice(j, j + 11)) && (j === 0 || sql[j - 1] === "\n")) break;
    if (c === "(") { if (d === 0) { cur = ""; d = 1; continue; } d++; }
    else if (c === ")") { if (d === 0) break; d--; if (d === 0) { rows.push(cur); cur = null; continue; } }
    else if (c === ";" && d === 0) break;
    if (d > 0 && cur !== null) cur += c;
  }
  return rows;
}

// Split isi satu tupel pada koma level-1, abaikan string.
function cols(body) {
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
const parse = marker => (tuplesAfter(marker) || []).map(cols);
const unq = s => s.replace(/^'|'$/g, "").replace(/''/g, "'");

const prog = parse("INSERT INTO pks_program (kode, nama, urutan, tahun) VALUES");
const keg  = parse("INSERT INTO pks_kegiatan (kode, program_id, urutan, tahun)\nSELECT d.kode, p.id, d.urutan, d.tahun FROM (VALUES");
const sub  = parse("INSERT INTO pks_subkegiatan (kode, kegiatan_id, nama, urutan, tahun, indikator, target)\nSELECT d.kode, k.id, d.nama, d.urutan, d.tahun, d.indikator, d.target FROM (VALUES");
const kk   = parse("INSERT INTO kertas_kerja\n  (subkegiatan_id, nama, indikator, frekuensi, target_per_tahun, bulan_wajib, deadline_rule, keterangan, created_by)\nSELECT s.id, d.nama, d.indikator, d.frekuensi, d.target_per_tahun, '*', d.deadline_rule, d.keterangan, 'seed ' || d.tahun::text FROM (VALUES");

ok(prog.length === 4, `program: ${prog.length} tupel (harap 4)`);
ok(keg.length === 13, `kegiatan: ${keg.length} tupel (harap 13)`);
ok(sub.length === 36, `sub kegiatan: ${sub.length} tupel (harap 36)`);
ok(kk.length === 90, `kertas kerja: ${kk.length} tupel (harap 90)`);

ok(prog.every(t => t.length === 4), "setiap tupel program = 4 kolom");
ok(keg.every(t => t.length === 4), "setiap tupel kegiatan = 4 kolom");
ok(sub.every(t => t.length === 7), "setiap tupel sub kegiatan = 7 kolom");
ok(kk.every(t => t.length === 8), "setiap tupel kertas kerja = 8 kolom");

const pK = prog.map(t => unq(t[0]));
const kK = keg.map(t => unq(t[0]));
const sK = sub.map(t => unq(t[0]));
const u = a => new Set(a).size === a.length;
ok(u(pK), "kode program unik");
ok(u(kK), "kode kegiatan unik");
ok(u(sK), "kode sub kegiatan unik");

// Indikator & target sub kegiatan tidak boleh NULL/kosong.
const kosong = sub.filter(t => !unq(t[5]).trim() || !unq(t[6]).trim());
ok(kosong.length === 0, `semua sub kegiatan punya indikator & target (${kosong.length} kosong)`);

// Target harus angka di depan.
const tanpaAngka = sub.filter(t => !/^\s*\d+/.test(unq(t[6])));
ok(tanpaAngka.length === 0, `semua target diawali angka (${tanpaAngka.length} tidak)`);

// Nilai kertas kerja harus sesuai CHECK.
const badFreq = kk.filter(t => !["Bulanan", "Triwulan", "Semesteran", "Tahunan", "Lainnya"].includes(unq(t[2])));
ok(badFreq.length === 0, `frekuensi kertas kerja valid (${badFreq.length} salah)`);
const badTarget = kk.filter(t => !/^\d+$/.test(t[3].trim()) || parseInt(t[3], 10) < 1);
ok(badTarget.length === 0, `target_per_tahun positif (${badTarget.length} salah)`);
const badDL = kk.filter(t => !/^(next_month:(5|10|15|20|25|last)|quarter_end:(5|10)|semiannual_end:(5|10)|year_end|next_january)$/.test(unq(t[4])));
ok(badDL.length === 0, `deadline_rule dikenal server (${badDL.length} salah)`);
ok(unq(kk[0] ? "x" : "x") !== "" && /\'\*\', d\.deadline_rule/.test(sql), "bulan_wajib ditulis literal '*' di SELECT (tidak per baris)");

// Idempotensi: file ini dijalankan ulang setiap boot, jadi tiap INSERT wajib
// punya ON CONFLICT. Tanpa itu boot kedua gagal dan error-nya menipu.
const inserts = [...sql.matchAll(/INSERT INTO (\w+)/g)].map(m => m[1]);
const tanpaKonflik = inserts.filter(tbl => {
  const i = sql.indexOf(`INSERT INTO ${tbl}`);
  const stmt = sql.slice(i, sql.indexOf(";", i));
  return !/ON CONFLICT/i.test(stmt);
});
ok(tanpaKonflik.length === 0,
  `semua ${inserts.length} INSERT punya ON CONFLICT (idempoten)` + (tanpaKonflik.length ? ` - tanpa: ${tanpaKonflik.join(", ")}` : ""));
// Konflik harus menyasar indeks UNIQUE yang benar-benar ada di migration.
// UNIQUE bisa ditulis sebagai constraint tabel (UNIQUE (a, b)) atau inline kolom
// (tahun INTEGER UNIQUE) - dua-duanya sah untuk ON CONFLICT.
const mig = require("fs").readFileSync(__dirname + "/../server/migrations/tahap_2.sql", "utf8");
const punyaUnik = kolom => {
  const esc = kolom.replace(/[()]/g, c => "\\" + c);
  if (new RegExp(`UNIQUE\\s*\\(\\s*${esc.split(",").join("\\s*,\\s*")}\\s*\\)`).test(mig)) return true;
  return kolom.split(",").every(k =>
    new RegExp(`\\b${k.trim()}\\s+[A-Za-z]+[^,]*\\bUNIQUE\\b`).test(mig));
};
ok(punyaUnik("kode, tahun"), "ON CONFLICT (kode, tahun) cocok dengan UNIQUE di migration");
ok(punyaUnik("subkegiatan_id, nama"), "ON CONFLICT (subkegiatan_id, nama) cocok dengan UNIQUE di migration");
ok(punyaUnik("tahun"), "ON CONFLICT (tahun) cocok dengan UNIQUE di migration");

console.log(fail ? `\n${fail} pemeriksaan GAGAL` : "\nSEMUA PEMERIKSAAN LULUS (statis)");
process.exit(fail ? 1 : 0);
