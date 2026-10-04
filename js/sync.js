// Sinkronisasi antar perangkat lewat folder aplikasi tersembunyi di Google Drive pengguna.
// Semua isi dienkripsi di perangkat (AES-GCM, kunci dari kata sandi sinkron) sebelum diunggah;
// Google hanya melihat file acak beserta ID dan waktu ubah.
import { db } from './db.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const META_NAME = 'sync-meta.json';
const CHUNK = 4 * 1024 * 1024;
const PBKDF2_ITER = 310000;
const CHECK_TEXT = 'catatan-koas-ok';

export class AuthError extends Error {}

// ---------- Login Google (OAuth implicit, kembali ke halaman ini) ----------

export async function getClientId() {
  return (await db.getMeta('gClientId')) || window.CATATAN_CONFIG?.googleClientId || '';
}

export async function startAuth() {
  const clientId = await getClientId();
  if (!clientId) throw new Error('Client ID Google belum diisi');
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await db.setMeta('oauthState', state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL('./', location.href).href,
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  });
  const hint = await db.getMeta('gEmailHint');
  if (hint) params.set('login_hint', hint);
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}

// Dipanggil saat aplikasi dibuka. Mengembalikan null, 'ok', atau pesan galat.
export async function handleAuthRedirect() {
  const h = location.hash;
  if (!/(^#|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h.slice(1));
  history.replaceState(null, '', new URL('./', location.href).pathname + '#/pengaturan');
  const expected = await db.getMeta('oauthState');
  await db.setMeta('oauthState', null);
  if (p.get('error')) return p.get('error') === 'access_denied' ? 'Izin Google Drive tidak diberikan.' : 'Login Google gagal: ' + p.get('error');
  if (!expected || p.get('state') !== expected) return 'Login Google tidak valid (kode keamanan tidak cocok). Coba lagi dari aplikasi.';
  const seconds = parseInt(p.get('expires_in') || '3600', 10);
  await db.setMeta('gToken', { access: p.get('access_token'), exp: Date.now() + (seconds - 120) * 1000 });
  return 'ok';
}

export async function getToken() {
  const t = await db.getMeta('gToken');
  return t && t.exp > Date.now() ? t.access : null;
}

// ---------- Drive REST ----------

async function api(token, url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  if (res.status === 401) {
    await db.setMeta('gToken', null);
    throw new AuthError('Sesi Google berakhir');
  }
  if (!res.ok) {
    let msg = res.status + '';
    try { msg += ' ' + ((await res.json()).error?.message || ''); } catch {}
    throw new Error('Google Drive: ' + msg);
  }
  return res;
}

async function listAll(token, q) {
  const files = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ spaces: 'appDataFolder', fields: 'nextPageToken,files(id,name,appProperties)', pageSize: '1000' });
    if (q) params.set('q', q);
    if (pageToken) params.set('pageToken', pageToken);
    const r = await (await api(token, `${API}/files?${params}`)).json();
    files.push(...(r.files || []));
    pageToken = r.nextPageToken || '';
  } while (pageToken);
  return files;
}

async function download(token, fileId) {
  return (await api(token, `${API}/files/${fileId}?alt=media`)).blob();
}

async function remove(token, fileId) {
  try {
    await api(token, `${API}/files/${fileId}`, { method: 'DELETE' });
  } catch (e) {
    if (!String(e.message).includes('404')) throw e;
  }
}

// Unggah baru (fileId kosong) atau timpa isi file lama. File besar memakai unggahan resumable.
async function upload(token, { fileId, name, appProperties, blob }) {
  const meta = fileId ? { appProperties } : { name, parents: ['appDataFolder'], appProperties };
  const path = `${UPLOAD}/files${fileId ? '/' + fileId : ''}`;
  const method = fileId ? 'PATCH' : 'POST';
  if (blob.size <= 5 * 1024 * 1024) {
    const boundary = 'ck' + Math.random().toString(36).slice(2);
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, blob, `\r\n--${boundary}--`,
    ]);
    const r = await api(token, `${path}?uploadType=multipart&fields=id`, { method, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return (await r.json()).id;
  }
  const init = await api(token, `${path}?uploadType=resumable&fields=id`, {
    method,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream' },
    body: JSON.stringify(meta),
  });
  const loc = init.headers.get('Location');
  if (!loc) throw new Error('Google Drive tidak memberi alamat unggahan');
  const r = await api(token, loc, { method: 'PUT', body: blob });
  return (await r.json()).id;
}

// ---------- Enkripsi ----------

const te = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Format: "CKS1", lalu potongan [iv 12 byte][panjang uint32][ciphertext]. Dipotong-potong
// agar video besar tidak perlu dienkripsi sekaligus di memori iPhone.
async function encryptBlob(key, blob) {
  const parts = [te.encode('CKS1')];
  for (let off = 0; off < blob.size || off === 0; off += CHUNK) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = await blob.slice(off, off + CHUNK).arrayBuffer();
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
    const len = new DataView(new ArrayBuffer(4));
    len.setUint32(0, ct.length, true);
    parts.push(iv, new Uint8Array(len.buffer), ct);
    if (blob.size === 0) break;
  }
  return new Blob(parts);
}

async function decryptBlob(key, blob, type = '') {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...head) !== 'CKS1') throw new Error('Format file sinkron tidak dikenal');
  const parts = [];
  let off = 4;
  while (off < blob.size) {
    const hdr = await blob.slice(off, off + 16).arrayBuffer();
    const iv = new Uint8Array(hdr, 0, 12);
    const len = new DataView(hdr).getUint32(12, true);
    const ct = await blob.slice(off + 16, off + 16 + len).arrayBuffer();
    parts.push(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)));
    off += 16 + len;
  }
  return new Blob(parts, { type });
}

const encryptJSON = (key, obj) => encryptBlob(key, new Blob([JSON.stringify(obj)]));
const decryptJSON = async (key, blob) => JSON.parse(await (await decryptBlob(key, blob)).text());

// ---------- Kata sandi sinkron ----------

let memoryKey = null;

export async function getKey() {
  if (memoryKey) return memoryKey;
  try { memoryKey = (await db.getMeta('syncKey')) || null; } catch { memoryKey = null; }
  return memoryKey;
}

async function storeKey(key) {
  memoryKey = key;
  try { await db.setMeta('syncKey', key); } catch { /* kunci hanya diingat selama aplikasi terbuka */ }
}

// Apakah Drive ini sudah punya kata sandi sinkron (dibuat dari perangkat lain)?
export async function remoteHasPassword(token) {
  return (await listAll(token, `name = '${META_NAME}'`)).length > 0;
}

// Buat kata sandi baru (perangkat pertama) atau cocokkan dengan yang sudah ada. Melempar galat bila salah.
export async function setupPassword(token, pass) {
  const metas = await listAll(token, `name = '${META_NAME}'`);
  if (metas.length) {
    const meta = JSON.parse(await (await download(token, metas[0].id)).text());
    const key = await deriveKey(pass, unb64(meta.salt));
    try {
      const txt = await (await decryptBlob(key, new Blob([unb64(meta.check)]))).text();
      if (txt !== CHECK_TEXT) throw new Error();
    } catch {
      throw new Error('Kata sandi sinkron salah');
    }
    await storeKey(key);
    return 'joined';
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pass, salt);
  const check = new Uint8Array(await (await encryptBlob(key, new Blob([CHECK_TEXT]))).arrayBuffer());
  await upload(token, { name: META_NAME, appProperties: { t: 'meta' }, blob: new Blob([JSON.stringify({ v: 1, salt: b64(salt), check: b64(check) })], { type: 'application/json' }) });
  await storeKey(key);
  return 'created';
}

export async function disconnect() {
  memoryKey = null;
  await db.setMeta('syncKey', null);
  await db.setMeta('gToken', null);
  await db.setMeta('syncEnabled', false);
}

// ---------- Sinkronisasi ----------

// Aturan: per catatan, versi dengan waktu ubah terbaru menang. Penghapusan dicatat sebagai
// "nisan" (tombstone) agar tidak muncul kembali dari perangkat lain.
export async function syncNow(onProgress = () => {}) {
  const token = await getToken();
  if (!token) throw new AuthError('Perlu login Google');
  const key = await getKey();
  if (!key) throw new Error('Kata sandi sinkron belum diisi');

  onProgress('Memeriksa Google Drive…');
  const files = await listAll(token);
  const rNotes = new Map();
  const rMedia = new Map();
  const rThumbs = new Map();
  for (const f of files) {
    const a = f.appProperties || {};
    if (a.t === 'n') rNotes.set(a.id, { fileId: f.id, u: +a.u || 0, del: a.del === '1' });
    else if (a.t === 'm') rMedia.set(a.id, { fileId: f.id, noteId: a.noteId });
    else if (a.t === 'th') rThumbs.set(a.id, { fileId: f.id, noteId: a.noteId });
  }
  const notes = new Map((await db.allNotes()).map((n) => [n.id, n]));
  const metas = await db.allMediaMeta();
  const mediaByNote = new Map();
  metas.forEach((m) => { if (!mediaByNote.has(m.noteId)) mediaByNote.set(m.noteId, []); mediaByNote.get(m.noteId).push(m); });
  const tombstones = new Map(((await db.getMeta('tombstones')) || []).map((t) => [t.id, t.at]));

  const stats = { up: 0, down: 0, deleted: 0, skipped: 0 };

  const deleteRemoteMediaOf = async (noteId, keepIds = new Set()) => {
    for (const [id, r] of rMedia) if (r.noteId === noteId && !keepIds.has(id)) { await remove(token, r.fileId); rMedia.delete(id); }
    for (const [id, r] of rThumbs) if (r.noteId === noteId && !keepIds.has(id)) { await remove(token, r.fileId); rThumbs.delete(id); }
  };

  const pushNote = async (n) => {
    const media = mediaByNote.get(n.id) || [];
    for (const meta of media) {
      if (rMedia.has(meta.id)) continue;
      const full = await db.getMedia(meta.id);
      if (!full?.blob) continue;
      onProgress(`Mengunggah ${meta.name || 'lampiran'}…`);
      const fileId = await upload(token, { name: 'm-' + meta.id, appProperties: { t: 'm', id: meta.id, noteId: n.id }, blob: await encryptBlob(key, full.blob) });
      rMedia.set(meta.id, { fileId, noteId: n.id });
      if (full.thumb && !rThumbs.has(meta.id)) {
        const tid = await upload(token, { name: 'th-' + meta.id, appProperties: { t: 'th', id: meta.id, noteId: n.id }, blob: await encryptBlob(key, full.thumb) });
        rThumbs.set(meta.id, { fileId: tid, noteId: n.id });
      }
    }
    await deleteRemoteMediaOf(n.id, new Set(media.map((m) => m.id)));
    const r = rNotes.get(n.id);
    const blob = await encryptJSON(key, { note: n, media });
    // del: null menghapus tanda nisan bila catatan ini "dihidupkan" kembali.
    const appProperties = { t: 'n', id: n.id, u: String(n.updated), del: null };
    const fileId = await upload(token, { fileId: r?.fileId, name: 'n-' + n.id, appProperties: r ? appProperties : { t: 'n', id: n.id, u: String(n.updated) }, blob });
    rNotes.set(n.id, { fileId, u: n.updated, del: false });
    stats.up++;
  };

  const pullNote = async (id, r) => {
    const payload = await decryptJSON(key, await download(token, r.fileId));
    const incoming = [];
    for (const meta of payload.media || []) {
      const existing = await db.getMedia(meta.id);
      if (existing) { incoming.push({ ...existing, ...meta }); continue; }
      const rm = rMedia.get(meta.id);
      if (!rm) { stats.skipped++; return; } // perangkat lain belum selesai mengunggah; coba lagi nanti
      onProgress(`Mengunduh ${meta.name || 'lampiran'}…`);
      const blob = await decryptBlob(key, await download(token, rm.fileId), meta.mime || '');
      let thumb = null;
      const rt = rThumbs.get(meta.id);
      if (rt) thumb = await decryptBlob(key, await download(token, rt.fileId), 'image/jpeg');
      incoming.push({ ...meta, blob, thumb });
    }
    const keep = new Set(incoming.map((m) => m.id));
    const stale = (mediaByNote.get(id) || []).filter((m) => !keep.has(m.id)).map((m) => m.id);
    await db.putRaw([payload.note], incoming);
    if (stale.length) await db.deleteMedia(stale);
    stats.down++;
  };

  // 1. Perubahan dan penghapusan dari perangkat ini.
  for (const [id, at] of tombstones) {
    const r = rNotes.get(id);
    if (r && !r.del && at >= r.u) {
      onProgress('Menghapus catatan di Drive…');
      await deleteRemoteMediaOf(id);
      await upload(token, { fileId: r.fileId, appProperties: { t: 'n', id, u: String(at), del: '1' }, blob: await encryptJSON(key, { deleted: true }) });
      rNotes.set(id, { ...r, u: at, del: true });
      stats.deleted++;
    }
  }
  for (const n of notes.values()) {
    const r = rNotes.get(n.id);
    if (!r || n.updated > r.u) {
      onProgress(`Mengunggah “${n.title}”…`);
      await pushNote(n);
    }
  }
  // 2. Perubahan dari perangkat lain.
  for (const [id, r] of rNotes) {
    const local = notes.get(id);
    if (r.del) {
      if (local && local.updated <= r.u) { await db.deleteNote(id); stats.deleted++; }
      continue;
    }
    if (tombstones.has(id) && tombstones.get(id) >= r.u) continue;
    if (!local || r.u > local.updated) {
      onProgress('Mengunduh catatan…');
      await pullNote(id, r);
    }
  }
  await db.setMeta('tombstones', []);
  await db.setMeta('lastSync', Date.now());
  onProgress('');
  return stats;
}
