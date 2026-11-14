// Pengirim WhatsApp via OpenWA untuk Agenda Surat & Disposisi (fail-soft).
const LINE = '━━━━━━━━━━━━━━━━━━';

function stripDataUrl(b64) {
  const s = String(b64 || '');
  const idx = s.indexOf('base64,');
  return idx !== -1 ? s.slice(idx + 7) : s;
}

export function parseMediaFromUrl(urlOrData, fallbackFilename = 'lampiran') {
  const raw = String(urlOrData || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const m = /^data:([^;,]+);base64,(.+)$/s.exec(raw);
    if (!m) return null;
    const mime = m[1];
    const ext = (mime.split('/')[1] || 'bin').split('+')[0];
    const filename = fallbackFilename.includes('.') ? fallbackFilename : `${fallbackFilename}.${ext}`;
    return { base64: m[2], mime, filename };
  }
  if (/^https?:\/\//i.test(raw)) {
    return { url: raw };
  }
  return null;
}

export function openwaSender({ url, apiKey, session = 'default', chatId }) {
  const base = String(url || '').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { 'X-Api-Key': apiKey } : {}) };
  let resolvedId = null;

  async function resolveSessionId() {
    if (resolvedId) return resolvedId;
    const r = await fetch(`${base}/api/sessions`, { headers: apiKey ? { 'X-Api-Key': apiKey } : {} });
    if (r.ok) {
      const list = await r.json().catch(() => []);
      const found = Array.isArray(list) ? list.find(s => s.id === session || s.name === session) : null;
      if (found?.id) {
        resolvedId = found.id;
        return resolvedId;
      }
    }
    return session;
  }

  return async ({ text, chatId: ke, media }) => {
    const target = ke || chatId;
    if (!target) throw new Error('chatId OpenWA belum dikonfigurasi');
    const sid = await resolveSessionId();
    let endpoint = 'send-text';
    let body;
    if (media && (media.base64 || media.url)) {
      const mime = String(media.mime || 'application/octet-stream');
      const isImage = mime.startsWith('image/');
      endpoint = isImage ? 'send-image' : 'send-document';
      body = {
        chatId: target,
        ...(media.base64
          ? { base64: stripDataUrl(media.base64), mimetype: mime }
          : { url: media.url }),
        ...(media.filename || !isImage ? { filename: media.filename || 'lampiran' } : {}),
        ...(text ? { caption: text } : {}),
      };
    } else {
      body = { chatId: target, text };
    }
    const r = await fetch(`${base}/api/sessions/${encodeURIComponent(sid)}/messages/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 400 || r.status === 404) resolvedId = null;
      throw new Error(d.message || `OpenWA HTTP ${r.status}`);
    }
    return d;
  };
}

export function createOpenwaFromEnv() {
  if (!process.env.OPENWA_URL) return null;
  const chatId = process.env.OPENWA_AGENDA_GROUP || process.env.OPENWA_KET_GROUP || '';
  if (!chatId) return null;
  return openwaSender({
    url: process.env.OPENWA_URL,
    apiKey: process.env.OPENWA_API_KEY,
    session: process.env.OPENWA_SESSION || 'default',
    chatId,
  });
}

export function buildSuratMasukText(item) {
  const link = item.drive_url || (/^https?:\/\//i.test(item.file_url || '') ? item.file_url : '');
  return `📥 *SURAT MASUK BARU*\n${LINE}\n`
    + `🔢 *No. Agenda* : ${item.nomor_agenda}\n`
    + `📄 *No. Surat*  : ${item.nomor_surat_asli}\n`
    + `📅 *Tgl. Surat* : ${item.tanggal_surat} (Diterima: ${item.tanggal_terima})\n`
    + `🏢 *Asal Surat* : ${item.asal_surat}\n`
    + `⚡ *Sifat*      : ${item.sifat || 'Biasa'}\n`
    + `📝 *Perihal*    :\n${item.perihal}\n`
    + (link ? `📎 *Berkas*     : ${link}\n` : '')
    + `${LINE}\n_Dicatat oleh ${item.created_by || 'Admin TU'} • Agenda Surat BAPPERIDA_`;
}

export function buildDisposisiText({ surat = {}, disposisi = {} }) {
  const dit = Array.isArray(disposisi.diteruskan_kepada)
    ? disposisi.diteruskan_kepada
    : (() => { try { return JSON.parse(disposisi.diteruskan_kepada || '[]'); } catch { return []; } })();
  const arahan = Array.isArray(disposisi.arahan)
    ? disposisi.arahan
    : (() => { try { return JSON.parse(disposisi.arahan || '[]'); } catch { return []; } })();
  const link = surat.drive_url || (/^https?:\/\//i.test(surat.file_url || '') ? surat.file_url : '');
  return `📌 *DISPOSISI SURAT MASUK*\n${LINE}\n`
    + `🔢 *No. Agenda* : ${surat.nomor_agenda || '—'}\n`
    + `📄 *No. Surat*  : ${surat.nomor_surat_asli || '—'}\n`
    + `🏢 *Asal Surat* : ${surat.asal_surat || '—'}\n`
    + `📝 *Perihal*    : ${surat.perihal || '—'}\n\n`
    + `👤 *Dari*       : ${disposisi.pemberi_disposisi || 'Kepala BAPPERIDA'}\n`
    + `📅 *Tanggal*    : ${disposisi.tanggal_disposisi || '—'}\n`
    + (dit.length ? `➡️ *Diteruskan* : ${dit.join(', ')}\n` : '')
    + (arahan.length ? `📋 *Arahan*     : ${arahan.join(', ')}\n` : '')
    + (disposisi.catatan_instruksi ? `💬 *Catatan*    :\n${disposisi.catatan_instruksi}\n` : '')
    + (disposisi.batas_waktu ? `⏰ *Batas Waktu*: ${disposisi.batas_waktu}\n` : '')
    + (link ? `📎 *Berkas*     : ${link}\n` : '')
    + `${LINE}\n_Status: ${disposisi.status_tindaklanjut || 'Didisposisikan'} • Agenda Surat BAPPERIDA_`;
}

export function buildSuratKeluarText(item) {
  const link = [item.file_final_url, item.file_draft_url].find(u => /^https?:\/\//i.test(u || '')) || '';
  return `📤 *SURAT KELUAR BARU*\n${LINE}\n`
    + `🔢 *No. Surat*  : ${item.nomor_surat}\n`
    + `📋 *No. Agenda* : ${item.nomor_agenda}\n`
    + `📅 *Tanggal*    : ${item.tanggal_surat}\n`
    + `🎯 *Tujuan*     : ${item.tujuan_surat}\n`
    + `🏢 *Pengonsep*  : ${item.bidang_pengonsep}\n`
    + `✍️ *TTD*        : ${item.penandatangan || 'Kepala Badan'}\n`
    + `📌 *Status*     : ${item.status || 'Draf'}\n`
    + `📝 *Perihal*    :\n${item.perihal}\n`
    + (link ? `📎 *Berkas*     : ${link}\n` : '')
    + `${LINE}\n_Dicatat oleh ${item.created_by || 'Staf Bidang'} • Agenda Surat BAPPERIDA_`;
}

