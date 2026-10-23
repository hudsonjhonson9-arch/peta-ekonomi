// Uji 3 sheet rekap (Rekap / Rekap Rekening / Rincian). Jalankan:
//   node src/components/ScreeningRKAExcel.uji.mjs

import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { siapkanScreeningXlsx } from "./ScreeningRKAExcel.js";

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

// Fixture: 2 sub kegiatan — sub A punya 2 rincian (200.000), sub B tanpa
// rincian (pagu 50.000 sebagai nilai fallback).
const programs = [{
  kode: "01", nama: "Program Contoh", totalPagu: 250000,
  kegiatan: [{
    kode: "01.1", nama: "Kegiatan Contoh", totalPagu: 250000,
    subkegiatan: [
      { id: "s1", kode: "01.1.1", nama: "Sub A", pagu: 200000 },
      { id: "s2", kode: "01.1.2", nama: "Sub B", pagu: 50000 },
    ],
  }],
}];
const rincianPerSub = {
  s1: [
    { uraian: "Semen", spesifikasi: "PC", satuan: "sak", volume: 10,
      harga_satuan: 10000, kode_rekening: "5.2.1.1",
      kelompok_belanja: "Belanja Barang" },
    { uraian: "Cat", spesifikasi: "", satuan: "kaleng", volume: 5,
      harga_satuan: 20000, kode_rekening: "5.2.2.1",
      kelompok_belanja: "Belanja Barang" },
  ],
};

const biner = siapkanScreeningXlsx({
  tahun: 2027, programs, rencanaById: {}, rincianPerSub });
const wb = XLSX.read(new Uint8Array(biner), { type: "array" });

console.log("urutan sheet");

uji("3 sheet rekap di depan, screening keempat", () => {
  assert.deepEqual(wb.SheetNames.slice(0, 4),
    ["Rekap", "Rekap Rekening", "Rincian", "Screening RKA"]);
  assert.ok(wb.SheetNames.includes("01.1.1 Sub A"), wb.SheetNames.join(" | "));
});

console.log("Rincian");

uji("kolom L = ROUND(koef x harga x (1+PPN),0) + nilai cache", () => {
  const ws = wb.Sheets["Rincian"];
  assert.equal(ws["L2"].f, "ROUND(H2*J2*(1+K2),0)");
  assert.equal(ws["L2"].v, 100000);
  assert.equal(ws["L3"].v, 100000);
  assert.equal(ws["K2"].v, 0, "PPN = 0");
});

console.log("Rekap");

uji("E5 SUMIFS dari Rincian + nilai cache; tanpa rincian pakai pagu", () => {
  const ws = wb.Sheets["Rekap"];
  assert.match(ws["E5"].f, /^SUMIFS\(Rincian!\$L\$2:\$L\$3,Rincian!\$B\$2:\$B\$3,B5\)$/);
  assert.equal(ws["E5"].v, 200000);
  assert.equal(ws["E6"].v, 50000, "sub tanpa rincian menampilkan pagu");
  assert.equal(ws["E6"].f, undefined);
});

uji("% terhadap total + baris Total ber-SUM", () => {
  const ws = wb.Sheets["Rekap"];
  assert.equal(ws["F5"].v, 0.8);
  assert.match(ws["F5"].f, /E5\/\$E\$7/);
  assert.equal(ws["E7"].f, "SUM(E5:E6)");
  assert.equal(ws["E7"].v, 250000);
});

console.log("Rekap Rekening");

uji("pivot SUMIFS kode rekening x sub + total kolom", () => {
  const ws = wb.Sheets["Rekap Rekening"];
  assert.equal(ws["A6"].v, "5.2.1.1");
  assert.equal(ws["B6"].v, 100000);
  assert.match(ws["B6"].f, /SUMIFS\(Rincian!\$L\$2:\$L\$3,Rincian!\$D\$2:\$D\$3,\$A6,Rincian!\$B\$2:\$B\$3,B\$4\)/);
  assert.equal(ws["C6"].v, 0, "kolom sub B tanpa rekening itu");
  assert.equal(ws["B8"].f, "SUM(B6:B7)");
  assert.equal(ws["B8"].v, 200000);
});

console.log("tanpa rincian");

uji("rincianPerSub null tetap jalan (tanpa L2, tanpa pivot)", () => {
  const b = siapkanScreeningXlsx({ tahun: 2027, programs, rencanaById: {} });
  const w = XLSX.read(new Uint8Array(b), { type: "array" });
  assert.deepEqual(w.SheetNames.slice(0, 3), ["Rekap", "Rekap Rekening", "Rincian"]);
  assert.equal(w.Sheets["Rekap"]["E5"].v, 200000, "fallback pagu");
  assert.equal(w.Sheets["Rincian"]["L2"], undefined);
});

console.log(`\n${lulus} uji lulus${process.exitCode ? ", ADA YANG GAGAL" : ""}`);
