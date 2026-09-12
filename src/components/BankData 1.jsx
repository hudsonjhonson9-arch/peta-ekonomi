import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";

const TAHUN_LIST = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

export default function BankData({ showToast }) {
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();
  const { data: indikator = [], isLoading } = useQuery({
    queryKey: ['indikator'],
    queryFn: () => fetch('/api/indikator').then(r => r.json())
  });
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [satuan, setSatuan] = useState("");
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const reload = () => queryClient.invalidateQueries({ queryKey: ['indikator'] });

  const handleAdd = async () => {
    if (!nama.trim() || !satuan.trim()) return showToast("Nama dan satuan wajib diisi");
    const res = await fetch('/api/indikator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim(), satuan: satuan.trim() })
    });
    const json = await res.json();
    if (!res.ok) return showToast(json.error);
    setNama(""); setSatuan(""); setShowForm(false);
    reload();
    showToast("Indikator berhasil ditambahkan");
  };

  const handleEdit = async () => {
    if (!nama.trim() || !satuan.trim()) return showToast("Nama dan satuan wajib diisi");
    const res = await fetch(`/api/indikator/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim(), satuan: satuan.trim() })
    });
    if (!res.ok) return showToast((await res.json()).error);
    setEditId(null); setNama(""); setSatuan("");
    reload();
    showToast("Indikator berhasil diperbarui");
  };

  const handleDelete = async (id, nama) => {
    if (!confirm(`Hapus indikator "${nama}" beserta semua nilainya?`)) return;
    const res = await fetch(`/api/indikator/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
    showToast("Indikator berhasil dihapus");
  };

  const handleToggleTampil = async (id, tampil) => {
    const res = await fetch('/api/indikator/tampil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indikator_id: id, tampil })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const handleUpsertNilai = async (indikatorId, tahun, nilai) => {
    const res = await fetch('/api/nilai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indikator_id: indikatorId, tahun, nilai: nilai === "" ? null : Number(nilai) })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const handleDeleteNilai = async (id) => {
    const res = await fetch(`/api/nilai/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "#888", fontSize: 13 }}>Memuat data...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Bank Data</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Kelola indikator dan data statistik pembangunan</div>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setNama(""); setSatuan(""); }}
          style={{ padding: "8px 16px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="plus" size={14} /> Tambah Indikator
        </button>
      </div>

      {(showForm || editId) && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Nama Indikator</div>
            <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: PDRB Per Kapita"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ width: 130 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Satuan</div>
            <input value={satuan} onChange={e => setSatuan(e.target.value)} placeholder="Contoh: %"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={editId ? handleEdit : handleAdd}
            style={{ padding: "9px 18px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {editId ? "Simpan" : "Tambah"}
          </button>
          <button onClick={() => { setShowForm(false); setEditId(null); setNama(""); setSatuan(""); }}
            style={{ padding: "9px 14px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
            Batal
          </button>
        </div>
      )}

      {indikator.map(i => (
        <div key={i.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}
            onClick={() => setExpandedId(expandedId === i.id ? null : i.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="chart" size={16} style={{ color: "#2563EB" }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{i.nama}</span>
                <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>({i.satuan})</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={e => { e.stopPropagation(); handleToggleTampil(i.id, !i.tampil_di_dashboard); }}
                style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
                  background: i.tampil_di_dashboard ? "#EFF6FF" : "#f5f5f5",
                  color: i.tampil_di_dashboard ? "#2e7d32" : "#999" }}>
                {i.tampil_di_dashboard ? "Tampil" : "Sembunyi"}
              </button>
              <button onClick={e => { e.stopPropagation(); setEditId(i.id); setNama(i.nama); setSatuan(i.satuan); setShowForm(false); }}
                style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "#888" }}>
                <Icon name="edit" size={14} />
              </button>
              <button onClick={e => { e.stopPropagation(); handleDelete(i.id, i.nama); }}
                style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "#c62828" }}>
                <Icon name="x" size={14} />
              </button>
              <Icon name="chevronRight" size={14} style={{ color: "#ccc", transform: expandedId === i.id ? "rotate(90deg)" : "", transition: "transform .2s" }} />
            </div>
          </div>

          {expandedId === i.id && (
            <div style={{ borderTop: "1px solid #f0f0f0", padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 12 }}>Nilai per Tahun</div>
              {TAHUN_LIST.map(tahun => {
                const existing = i.nilai.find(n => n.tahun === tahun);
                return (
                  <NilaiRow key={tahun}
                    tahun={tahun}
                    nilai={existing?.nilai ?? ""}
                    nilaiId={existing?.id}
                    indikatorId={i.id}
                    onSave={(val) => handleUpsertNilai(i.id, tahun, val)}
                    onDelete={existing?.id ? () => handleDeleteNilai(existing.id) : null}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}

      {indikator.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 40, border: "1px solid #e8e8e8", textAlign: "center", color: "#888", fontSize: 13 }}>
          Belum ada indikator. Klik "Tambah Indikator" untuk memulai.
        </div>
      )}
    </div>
  );
}

function NilaiRow({ tahun, nilai, onSave, onDelete }) {
  const [val, setVal] = useState(nilai ?? "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    onSave(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 50, fontSize: 13, fontWeight: 600, color: "#444" }}>{tahun}</div>
      <input value={val} onChange={e => setVal(e.target.value)} type="number" step="any" placeholder="Nilai"
        style={{ flex: 1, maxWidth: 200, padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, outline: "none" }} />
      <button onClick={save}
        style={{ padding: "7px 14px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {saved ? "✓ Tersimpan" : "Simpan"}
      </button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: "7px 10px", background: "#ffebee", color: "#c62828", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
          Hapus
        </button>
      )}
    </div>
  );
}
