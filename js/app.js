import { db } from './db.js';
import { SearchIndex, normalize } from './search.js';
import { createZip, readZip } from './zip.js';

const APP_VERSION = '0.1.0';

const TYPES = {
  kasus: { label: 'Kasus', icon: '🩺', template: 'Identitas (inisial/usia/JK, tanpa nama & No. RM):\nKeluhan utama:\nRPS:\nRPD / RPK / sosial:\nPemeriksaan fisik:\nPemeriksaan penunjang:\nDiagnosis:\nTatalaksana:\nPembelajaran:\n' },
  topik: { label: 'Topik', icon: '📚', template: 'Definisi:\nEtiologi & faktor risiko:\nPatofisiologi:\nGejala & tanda:\nDiagnosis:\nTatalaksana:\nKomplikasi:\nSumber:\n' },
  obat: { label: 'Obat', icon: '💊', template: 'Golongan:\nIndikasi:\nDosis dewasa:\nDosis anak:\nKontraindikasi:\nEfek samping:\nCatatan:\n' },
  prosedur: { label: 'Prosedur', icon: '🛠️', template: 'Indikasi:\nKontraindikasi:\nAlat & bahan:\nLangkah-langkah:\nKomplikasi:\nTips:\n' },
  bebas: { label: 'Bebas', icon: '📝', template: '' },
};

const STASE = ['IPD', 'Bedah', 'Anak', 'Obgyn', 'Saraf', 'Jiwa', 'Kulit', 'Mata', 'THT', 'Anestesi', 'Radiologi', 'Forensik', 'IKM', 'Kardiologi', 'Pulmonologi', 'Rehab Medik', 'Lainnya'];

const state = {
  notes: new Map(),
  mediaMeta: new Map(), // id -> meta (tanpa blob)
  index: new SearchIndex(),
  query: '',
  filterType: '',
  filterStase: '',
  objectUrls: [],
  editor: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const view = () => $('#view');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(0) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}

function objUrl(blob) {
  const u = URL.createObjectURL(blob);
  state.objectUrls.push(u);
  return u;
}

function releaseUrls() {
  state.objectUrls.forEach((u) => URL.revokeObjectURL(u));
  state.objectUrls = [];
}

function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Indeks ----------

function indexNote(note) {
  const media = note.mediaIds.map((id) => state.mediaMeta.get(id)).filter(Boolean);
  state.index.add(note.id, {
    title: note.title,
    tags: note.tags.join(' '),
    stase: note.stase + ' ' + (TYPES[note.type]?.label || ''),
    media: media.map((m) => `${m.caption || ''} ${m.name || ''} ${m.ocrText || ''} ${m.transcript || ''}`).join(' '),
    body: note.body,
  });
}

async function loadAll() {
  const [notes, media] = await Promise.all([db.allNotes(), db.allMediaMeta()]);
  media.forEach((m) => state.mediaMeta.set(m.id, m));
  notes.forEach((n) => {
    n.mediaIds = media.filter((m) => m.noteId === n.id).sort((a, b) => a.created - b.created).map((m) => m.id);
    state.notes.set(n.id, n);
    indexNote(n);
  });
}

// ---------- Teks & sorotan ----------

function highlight(text, terms) {
  if (!terms || !terms.size) return esc(text);
  let out = '';
  let last = 0;
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const n = normalize(m[0]);
    if (terms.has(n)) {
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
  }
  return out + esc(text.slice(last));
}

function snippet(body, terms, len = 160) {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  let pos = -1;
  if (terms && terms.size) {
    for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
      if (terms.has(normalize(m[0]))) { pos = m.index; break; }
    }
  }
  if (pos < 0) return highlight(text.slice(0, len) + (text.length > len ? '…' : ''), terms);
  const start = Math.max(0, pos - 50);
  const piece = (start > 0 ? '…' : '') + text.slice(start, start + len) + (start + len < text.length ? '…' : '');
  return highlight(piece, terms);
}

// Markdown ringan: baris "Label:" ditebalkan, **tebal**, daftar, dan tautan [[Judul catatan]].
function renderBody(body, terms, type) {
  // Label template yang belum diisi tidak perlu ditampilkan.
  const emptyLabels = new Set((TYPES[type]?.template || '').split('\n').map((l) => l.trim()).filter(Boolean));
  const lines = body.split('\n').filter((l) => !emptyLabels.has(l.trim()));
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const listItem = raw.match(/^\s*[-*•]\s+(.*)$/);
    if (listItem && !inList) { html += '<ul>'; inList = true; }
    if (!listItem && inList) { html += '</ul>'; inList = false; }
    let line = listItem ? listItem[1] : raw;
    let h = highlight(line, terms);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\[\[(.+?)\]\]/g, (_, t) => `<a href="#/cari/${encodeURIComponent(t.replace(/<[^>]+>/g, ''))}" class="wikilink">${t}</a>`);
    const label = !listItem && h.match(/^([^:<]{1,60}):(.*)$/);
    if (label) h = `<span class="label">${label[1]}:</span>${label[2]}`;
    html += listItem ? `<li>${h}</li>` : h.trim() ? `<p>${h}</p>` : '<div class="gap"></div>';
  }
  if (inList) html += '</ul>';
  return html;
}

// ---------- Tampilan: beranda & pencarian ----------

function renderHome() {
  releaseUrls();
  view().innerHTML = `
    <div class="searchbar">
      <div class="searchbox">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>
        <input id="q" type="search" placeholder="Cari: dm, nyeri dada, metformin…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(state.query)}">
        <button id="clearq" class="iconbtn ${state.query ? '' : 'hidden'}" aria-label="Hapus pencarian">✕</button>
      </div>
      <div class="filters">
        <button class="chip ${state.filterType === '' ? 'on' : ''}" data-type="">Semua</button>
        ${Object.entries(TYPES).map(([k, t]) => `<button class="chip ${state.filterType === k ? 'on' : ''}" data-type="${k}">${t.icon} ${t.label}</button>`).join('')}
        <select id="stasefilter" class="chip ${state.filterStase ? 'on' : ''}" aria-label="Filter stase">
          <option value="">Semua stase</option>
          ${allStase().map((s) => `<option ${s === state.filterStase ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="results" class="results"></div>
    <a href="#/baru" class="fab" aria-label="Catatan baru">＋</a>`;
  const q = $('#q');
  let t;
  q.addEventListener('input', () => {
    state.query = q.value;
    $('#clearq').classList.toggle('hidden', !q.value);
    clearTimeout(t);
    t = setTimeout(renderResults, 40);
  });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = $('#results .card');
      if (first && !matchMedia('(pointer: coarse)').matches) location.hash = first.getAttribute('href');
      else q.blur();
    }
  });
  $('#clearq').onclick = () => { state.query = ''; q.value = ''; q.focus(); $('#clearq').classList.add('hidden'); renderResults(); };
  view().querySelectorAll('.chip[data-type]').forEach((b) => (b.onclick = () => {
    state.filterType = b.dataset.type;
    view().querySelectorAll('.chip[data-type]').forEach((x) => x.classList.toggle('on', x === b));
    renderResults();
  }));
  $('#stasefilter').onchange = (e) => { state.filterStase = e.target.value; e.target.classList.toggle('on', !!e.target.value); renderResults(); };
  if (!matchMedia('(pointer: coarse)').matches) q.focus();
  renderResults();
}

function allStase() {
  const set = new Set(STASE);
  state.notes.forEach((n) => n.stase && set.add(n.stase));
  return [...set];
}

function renderResults() {
  const box = $('#results');
  if (!box) return;
  const started = performance.now();
  let items;
  let terms = null;
  if (state.query.trim()) {
    const r = state.index.search(state.query);
    terms = r.terms;
    items = r.results.map((x) => state.notes.get(x.id)).filter(Boolean);
  } else {
    items = [...state.notes.values()].sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
  }
  if (state.filterType) items = items.filter((n) => n.type === state.filterType);
  if (state.filterStase) items = items.filter((n) => n.stase === state.filterStase);
  const ms = performance.now() - started;

  if (!state.notes.size) {
    box.innerHTML = `
      <div class="empty">
        <div class="big">🩺</div>
        <h2>Belum ada catatan</h2>
        <p>Tekan <b>＋</b> untuk menulis catatan kasus, topik, obat, atau prosedur. Foto, video, dan rekaman suara bisa dilampirkan. Semua tersimpan di perangkat ini dan bisa dicari tanpa internet.</p>
        <button class="btn ghost" id="demo">Coba dengan contoh catatan</button>
      </div>`;
    $('#demo').onclick = loadDemo;
    return;
  }
  const head = state.query.trim()
    ? `<div class="meta-line">${items.length} hasil · ${ms < 1 ? '<1' : ms.toFixed(0)} ms</div>`
    : `<div class="meta-line">${items.length} catatan · terbaru</div>`;
  if (!items.length) {
    box.innerHTML = head + `<div class="empty small"><p>Tidak ada catatan yang cocok dengan “${esc(state.query)}”.</p></div>`;
    return;
  }
  box.innerHTML = head + items.slice(0, 150).map((n) => cardHtml(n, terms)).join('');
  // Muat thumbnail gambar pertama setelah daftar tampil.
  box.querySelectorAll('[data-thumb]').forEach(async (img) => {
    const m = await db.getMedia(img.dataset.thumb);
    if (m && (m.thumb || m.blob) && img.isConnected) img.src = objUrl(m.thumb || m.blob);
  });
}

function cardHtml(n, terms) {
  const t = TYPES[n.type] || TYPES.bebas;
  const media = n.mediaIds.map((id) => state.mediaMeta.get(id)).filter(Boolean);
  const counts = { image: 0, video: 0, audio: 0 };
  media.forEach((m) => counts[m.kind]++);
  const firstImg = media.find((m) => m.kind === 'image');
  const matchedMedia = terms && media.find((m) => [...(normalize(`${m.caption} ${m.name}`).split(' '))].some((w) => terms.has(w)));
  return `
    <a class="card" href="#/catatan/${n.id}">
      <div class="card-main">
        <div class="card-top"><span class="badge t-${n.type}">${t.icon} ${t.label}</span>${n.stase ? `<span class="badge">${esc(n.stase)}</span>` : ''}${n.pinned ? '<span class="pin">📌</span>' : ''}</div>
        <h3>${highlight(n.title || '(tanpa judul)', terms)}</h3>
        <p class="snip">${snippet(n.body, terms)}</p>
        ${matchedMedia ? `<p class="snip media-hit">${matchedMedia.kind === 'audio' ? '🎙️' : matchedMedia.kind === 'video' ? '🎬' : '🖼️'} ${highlight(matchedMedia.caption || matchedMedia.name, terms)}</p>` : ''}
        <div class="card-foot">
          ${n.tags.slice(0, 4).map((x) => `<span class="tag">#${highlight(x, terms)}</span>`).join('')}
          <span class="spacer"></span>
          ${counts.image ? `<span>🖼️ ${counts.image}</span>` : ''}${counts.video ? `<span>🎬 ${counts.video}</span>` : ''}${counts.audio ? `<span>🎙️ ${counts.audio}</span>` : ''}
          <span>${fmtDate(n.updated)}</span>
        </div>
      </div>
      ${firstImg ? `<img class="thumb" alt="" data-thumb="${firstImg.id}">` : ''}
    </a>`;
}

// ---------- Tampilan: detail catatan ----------

async function renderNote(id) {
  releaseUrls();
  const n = state.notes.get(id);
  if (!n) { location.hash = '#/'; return; }
  const t = TYPES[n.type] || TYPES.bebas;
  const terms = state.query.trim() ? state.index.search(state.query).terms : null;
  view().innerHTML = `
    <div class="topbar">
      <a href="#/" class="iconbtn" aria-label="Kembali">‹</a>
      <span class="grow"></span>
      <button class="iconbtn" id="pin" aria-label="Sematkan">${n.pinned ? '📌' : '📍'}</button>
      <a class="btn small" href="#/ubah/${n.id}">Ubah</a>
    </div>
    <article class="note">
      <div class="card-top"><span class="badge t-${n.type}">${t.icon} ${t.label}</span>${n.stase ? `<span class="badge">${esc(n.stase)}</span>` : ''}</div>
      <h1>${highlight(n.title || '(tanpa judul)', terms)}</h1>
      <div class="meta-line">Dibuat ${fmtDate(n.created)} · diubah ${fmtDate(n.updated)}</div>
      ${n.tags.length ? `<div class="tags">${n.tags.map((x) => `<a class="tag" href="#/cari/${encodeURIComponent(x)}">#${esc(x)}</a>`).join('')}</div>` : ''}
      <div class="body">${renderBody(n.body, terms, n.type)}</div>
      <div id="gallery" class="gallery"></div>
      ${relatedHtml(n)}
      <button class="btn danger ghost" id="del">Hapus catatan</button>
    </article>`;
  $('#pin').onclick = async () => {
    n.pinned = !n.pinned;
    const { mediaIds, ...stored } = n;
    await db.saveNote(stored);
    $('#pin').textContent = n.pinned ? '📌' : '📍';
    toast(n.pinned ? 'Disematkan di atas daftar' : 'Sematan dilepas');
  };
  $('#del').onclick = async () => {
    if (!confirm('Hapus catatan ini beserta semua medianya? Tidak bisa dibatalkan.')) return;
    await db.deleteNote(n.id);
    n.mediaIds.forEach((m) => state.mediaMeta.delete(m));
    state.index.remove(n.id);
    state.notes.delete(n.id);
    toast('Catatan dihapus');
    location.hash = '#/';
  };
  const gallery = $('#gallery');
  for (const mid of n.mediaIds) {
    const m = await db.getMedia(mid);
    if (!m || !gallery.isConnected) continue;
    const url = objUrl(m.blob);
    const cap = m.caption ? `<figcaption>${highlight(m.caption, terms)}</figcaption>` : '';
    const el = document.createElement('figure');
    el.className = 'm-' + m.kind;
    if (m.kind === 'image') el.innerHTML = `<img src="${url}" alt="${esc(m.caption || m.name)}" loading="lazy">${cap}`;
    else if (m.kind === 'video') el.innerHTML = `<video src="${url}" controls playsinline preload="metadata"></video>${cap}`;
    else el.innerHTML = `<div class="audio-row"><span>🎙️</span><audio src="${url}" controls preload="metadata"></audio></div>${cap}`;
    if (m.kind === 'image') el.querySelector('img').onclick = () => openLightbox(url, m.caption);
    gallery.appendChild(el);
  }
}

function relatedHtml(n) {
  if (!n.tags.length && !n.stase) return '';
  const tags = new Set(n.tags.map((x) => x.toLowerCase()));
  const scored = [];
  state.notes.forEach((o) => {
    if (o.id === n.id) return;
    const shared = o.tags.filter((x) => tags.has(x.toLowerCase())).length;
    if (shared) scored.push([o, shared]);
  });
  scored.sort((a, b) => b[1] - a[1] || b[0].updated - a[0].updated);
  if (!scored.length) return '';
  return `<h4 class="section">Catatan terkait</h4><div class="related">${scored.slice(0, 6).map(([o]) => `<a href="#/catatan/${o.id}">${TYPES[o.type]?.icon || ''} ${esc(o.title)}</a>`).join('')}</div>`;
}

function openLightbox(url, caption) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${url}" alt="">${caption ? `<p>${esc(caption)}</p>` : ''}<button class="iconbtn" aria-label="Tutup">✕</button>`;
  lb.onclick = () => lb.remove();
  document.body.appendChild(lb);
}

// ---------- Tampilan: pilih jenis & editor ----------

function renderNewPicker() {
  releaseUrls();
  view().innerHTML = `
    <div class="topbar"><a href="#/" class="iconbtn" aria-label="Kembali">‹</a><span class="grow title">Catatan baru</span></div>
    <div class="picker">
      ${Object.entries(TYPES).map(([k, t]) => `<a class="pick" href="#/baru/${k}"><span class="big">${t.icon}</span><b>${t.label}</b><small>${pickHint(k)}</small></a>`).join('')}
    </div>`;
}

function pickHint(k) {
  return { kasus: 'Pasien yang kamu temui', topik: 'Penyakit atau materi', obat: 'Dosis, indikasi, efek samping', prosedur: 'Langkah tindakan', bebas: 'Tanpa template' }[k];
}

async function renderEditor(id, type) {
  releaseUrls();
  const existing = id ? state.notes.get(id) : null;
  if (id && !existing) { location.hash = '#/'; return; }
  const note = existing
    ? { ...existing, tags: [...existing.tags] }
    : { id: uid(), type: type || 'bebas', title: '', body: TYPES[type || 'bebas'].template, tags: [], stase: state.filterStase || '', pinned: false, created: Date.now(), updated: Date.now() };
  const media = existing ? (await db.mediaForNote(id)).sort((a, b) => a.created - b.created).map((m) => ({ ...m, isNew: false, dirty: false })) : [];
  state.editor = { note, media, removed: [], dirty: false, isNew: !existing };

  view().innerHTML = `
    <div class="topbar">
      <button class="iconbtn" id="cancel" aria-label="Batal">✕</button>
      <span class="grow title">${existing ? 'Ubah catatan' : 'Catatan baru'}</span>
      <button class="btn small" id="save">Simpan</button>
    </div>
    <form class="editor" onsubmit="return false">
      <div class="row">
        <select id="e-type" aria-label="Jenis">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === note.type ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}</select>
        <input id="e-stase" list="stase-list" placeholder="Stase" value="${esc(note.stase)}" aria-label="Stase">
        <datalist id="stase-list">${allStase().map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      </div>
      <input id="e-title" class="title-input" placeholder="Judul (mis. STEMI anterior, Metformin)" value="${esc(note.title)}">
      <input id="e-tags" placeholder="Tag, pisahkan dengan koma (mis. kardio, ugd)" value="${esc(note.tags.join(', '))}" autocapitalize="off">
      <textarea id="e-body" placeholder="Tulis catatan… Gunakan [[Judul catatan lain]] untuk menautkan.">${esc(note.body)}</textarea>
      ${note.type === 'kasus' ? '<p class="hint">🔒 Jangan tulis nama, No. RM, NIK, atau alamat pasien. Gunakan inisial dan usia.</p>' : ''}
      <h4 class="section">Lampiran</h4>
      <div class="attach-actions">
        <label class="btn ghost">📷 Foto / video<input type="file" id="f-visual" accept="image/*,video/*" multiple hidden></label>
        <button type="button" class="btn ghost" id="rec">🎙️ Rekam suara</button>
        <label class="btn ghost">📎 File audio<input type="file" id="f-audio" accept="audio/*" multiple hidden></label>
      </div>
      <div id="recorder" class="recorder hidden"><span class="dot"></span><span id="rec-time">00:00</span><button type="button" class="btn small danger" id="rec-stop">Selesai</button></div>
      <div id="e-media" class="e-media"></div>
    </form>`;

  const body = $('#e-body');
  const autoGrow = () => { body.style.height = 'auto'; body.style.height = Math.max(220, body.scrollHeight + 4) + 'px'; };
  body.addEventListener('input', autoGrow);
  requestAnimationFrame(autoGrow);
  view().querySelectorAll('input, textarea, select').forEach((el) => el.addEventListener('input', () => (state.editor.dirty = true)));

  $('#e-type').onchange = (e) => {
    const nt = e.target.value;
    const cur = body.value.trim();
    const oldTpl = TYPES[state.editor.note.type].template.trim();
    if (!cur || cur === oldTpl) { body.value = TYPES[nt].template; autoGrow(); }
    state.editor.note.type = nt;
  };
  $('#cancel').onclick = () => {
    if (state.editor.dirty && !confirm('Buang perubahan yang belum disimpan?')) return;
    state.editor = null;  // dibuang, jadi tidak disimpan otomatis saat pindah halaman
    history.length > 1 ? history.back() : (location.hash = '#/');
  };
  $('#save').onclick = () => saveEditor();
  $('#f-visual').onchange = (e) => addFiles(e.target.files);
  $('#f-audio').onchange = (e) => addFiles(e.target.files);
  $('#rec').onclick = startRecording;
  if (state.editor.isNew) $('#e-title').focus();
  renderEditorMedia();
}

function renderEditorMedia() {
  const box = $('#e-media');
  if (!box) return;
  box.innerHTML = '';
  state.editor.media.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'e-item';
    let preview;
    if (m.kind === 'image') preview = `<img src="${objUrl(m.thumb || m.blob)}" alt="">`;
    else if (m.kind === 'video') preview = `<video src="${objUrl(m.blob)}" muted playsinline preload="metadata"></video>`;
    else preview = `<audio src="${objUrl(m.blob)}" controls preload="metadata"></audio>`;
    row.innerHTML = `
      <div class="e-prev ${m.kind}">${preview}</div>
      <div class="e-info">
        <input placeholder="Keterangan (ikut dicari), mis. EKG ST elevasi V1-V4" value="${esc(m.caption || '')}">
        <small>${m.kind === 'image' ? 'Foto' : m.kind === 'video' ? 'Video' : 'Audio'} · ${fmtSize(m.size)}</small>
      </div>
      <button type="button" class="iconbtn" aria-label="Hapus lampiran">🗑️</button>`;
    row.querySelector('input').oninput = (e) => { m.caption = e.target.value; m.dirty = true; state.editor.dirty = true; };
    row.querySelector('button').onclick = () => {
      if (!m.isNew) state.editor.removed.push(m.id);
      state.editor.media.splice(i, 1);
      state.editor.dirty = true;
      renderEditorMedia();
    };
    box.appendChild(row);
  });
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca')); };
    img.src = url;
  });
}

function resizeTo(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

// Foto dikecilkan ke 2400 px (masih tajam untuk EKG/rontgen) agar memori iPhone tidak cepat penuh.
async function processImage(file) {
  try {
    const img = await loadImage(file);
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    const blob = big > 2400 || file.size > 1.5e6 ? await resizeTo(img, 2400, 0.86) : file;
    const thumb = await resizeTo(img, 360, 0.7);
    return { blob: blob && blob.size < file.size ? blob : file, thumb };
  } catch {
    return { blob: file, thumb: null };
  }
}

async function addFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  toast('Memproses lampiran…', 10000);
  for (const f of files) {
    const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : null;
    if (!kind) { toast('Jenis file tidak didukung: ' + f.name); continue; }
    if (kind === 'video' && f.size > 300e6) toast('Video besar (' + fmtSize(f.size) + '). Pertimbangkan memotongnya agar memori tidak cepat penuh.', 5000);
    let blob = f;
    let thumb = null;
    if (kind === 'image') ({ blob, thumb } = await processImage(f));
    state.editor.media.push({ id: uid(), noteId: state.editor.note.id, kind, name: f.name, mime: blob.type || f.type, size: blob.size, caption: '', blob, thumb, created: Date.now(), isNew: true });
  }
  state.editor.dirty = true;
  renderEditorMedia();
  toast('Lampiran ditambahkan. Jangan lupa Simpan.');
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Perekaman tidak didukung di browser ini. Gunakan “File audio”.');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast('Izin mikrofon ditolak. Aktifkan di Pengaturan > Safari > Mikrofon.');
    return;
  }
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const started = Date.now();
  const panel = $('#recorder');
  panel.classList.remove('hidden');
  $('#rec').disabled = true;
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    $('#rec-time').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 250);
  rec.onstop = () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    panel.classList.add('hidden');
    $('#rec').disabled = false;
    const type = rec.mimeType || mime || 'audio/mp4';
    const blob = new Blob(chunks, { type });
    const ext = type.includes('webm') ? 'webm' : 'm4a';
    const stamp = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    state.editor.media.push({ id: uid(), noteId: state.editor.note.id, kind: 'audio', name: `Rekaman ${stamp}.${ext}`, mime: type, size: blob.size, caption: '', blob, created: Date.now(), isNew: true });
    state.editor.dirty = true;
    renderEditorMedia();
  };
  $('#rec-stop').onclick = () => rec.state !== 'inactive' && rec.stop();
  rec.start(1000);
}

async function saveEditor(navigate = true) {
  const ed = state.editor;
  const n = ed.note;
  n.type = $('#e-type').value;
  n.stase = $('#e-stase').value.trim();
  n.title = $('#e-title').value.trim();
  n.tags = [...new Set($('#e-tags').value.split(/[,#]/).map((x) => x.trim()).filter(Boolean))];
  n.body = $('#e-body').value.replace(/\s+$/, '');
  if (!n.title && !n.body.trim() && !ed.media.length) { if (navigate) toast('Catatan masih kosong'); return false; }
  if (!n.title) n.title = n.body.split('\n').find((l) => l.trim())?.slice(0, 80) || 'Catatan ' + fmtDate(Date.now());
  n.updated = Date.now();
  const strip = ({ isNew, dirty, ...m }) => m;
  const add = ed.media.filter((m) => m.isNew).map(strip);
  const upd = ed.media.filter((m) => !m.isNew && m.dirty).map((m) => ({ id: m.id, caption: m.caption }));
  const { mediaIds, ...stored } = n;
  try {
    await db.saveNote(stored, add, upd, ed.removed);
  } catch (e) {
    console.error(e);
    toast('Gagal menyimpan: ' + (e?.name === 'QuotaExceededError' ? 'memori penuh' : e?.message || e), 6000);
    return false;
  }
  ed.removed.forEach((id) => state.mediaMeta.delete(id));
  ed.media.forEach((m) => { const { blob, thumb, ...meta } = strip(m); state.mediaMeta.set(m.id, meta); });
  n.mediaIds = ed.media.map((m) => m.id);
  state.notes.set(n.id, n);
  indexNote(n);
  state.editor = null;
  requestPersistence();
  toast('Tersimpan');
  if (navigate) location.replace('#/catatan/' + n.id);
  return true;
}

// ---------- Pengaturan, backup, impor ----------

async function renderSettings() {
  releaseUrls();
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const lastBackup = await db.getMeta('lastBackup');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  view().innerHTML = `
    <div class="topbar"><a href="#/" class="iconbtn" aria-label="Kembali">‹</a><span class="grow title">Pengaturan</span></div>
    <div class="settings">
      <section>
        <h4>Penyimpanan di perangkat ini</h4>
        <p>${state.notes.size} catatan · ${state.mediaMeta.size} lampiran${est ? ` · terpakai ${fmtSize(est.usage || 0)}` : ''}</p>
        <p>Penyimpanan permanen: <b>${persisted === null ? 'tidak diketahui' : persisted ? 'aktif ✓' : 'belum aktif'}</b>${standalone ? '' : '. Pasang aplikasi ke layar utama agar iPhone tidak menghapus data saat memori menipis.'}</p>
      </section>
      ${standalone ? '' : `<section class="install">
        <h4>Pasang di iPhone (sekali saja)</h4>
        <ol><li>Buka halaman ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambah ke Layar Utama</b>.</li></ol>
        <p>Setelah itu aplikasi terbuka seperti app biasa dan berjalan tanpa internet.</p>
      </section>`}
      <section>
        <h4>Backup</h4>
        <p>Terakhir: <b>${lastBackup ? fmtDate(lastBackup) : 'belum pernah'}</b>. Simpan file backup ke laptop, iCloud Drive, atau hard disk. File berisi catatan (juga dalam format Markdown, bisa dibuka di Obsidian) dan semua media.</p>
        <div class="row"><button class="btn" id="export">⬇️ Buat backup</button><label class="btn ghost">⬆️ Pulihkan dari backup<input type="file" id="import" accept=".zip,application/zip" hidden></label></div>
      </section>
      <section>
        <h4>Privasi pasien</h4>
        <p>Semua data hanya ada di perangkat ini, tidak dikirim ke server mana pun. Tetap hindari menyimpan nama, No. RM, NIK, alamat, atau wajah pasien. Minta izin sebelum memotret atau merekam, dan ikuti aturan rumah sakit.</p>
      </section>
      <section>
        <h4>Tentang</h4>
        <p>Catatan Koas versi ${APP_VERSION} · ${navigator.onLine ? 'online' : 'offline'} · siap dipakai tanpa internet setelah dibuka sekali.</p>
      </section>
    </div>`;
  $('#export').onclick = exportBackup;
  $('#import').onchange = (e) => e.target.files[0] && importBackup(e.target.files[0]);
}

function safeName(s) {
  return (s || 'catatan').replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'catatan';
}

function extFor(m) {
  const fromName = (m.name || '').match(/\.([a-z0-9]{2,5})$/i);
  if (fromName && !(m.kind === 'image' && m.mime === 'image/jpeg')) return fromName[1].toLowerCase();
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/wav': 'wav' }[(m.mime || '').split(';')[0]] || 'bin';
}

async function exportBackup() {
  const btn = $('#export');
  btn.disabled = true;
  btn.textContent = 'Menyiapkan…';
  try {
    const notes = [...state.notes.values()].map(({ mediaIds, ...n }) => n);
    const entries = [];
    const mediaList = [];
    const usedNames = new Set();
    for (const n of state.notes.values()) {
      const lines = ['---', `jenis: ${n.type}`, `stase: ${n.stase || ''}`, `tag: [${n.tags.map((t) => JSON.stringify(t)).join(', ')}]`, `dibuat: ${new Date(n.created).toISOString()}`, `diubah: ${new Date(n.updated).toISOString()}`, '---', '', `# ${n.title}`, '', n.body, ''];
      for (const mid of n.mediaIds) {
        const m = await db.getMedia(mid);
        if (!m) continue;
        const path = `media/${m.id}.${extFor(m)}`;
        const { blob, thumb, ...meta } = m;
        mediaList.push({ ...meta, path });
        entries.push({ name: path, data: blob });
        lines.push(`![[${path}]]${m.caption ? ' ' + m.caption : ''}`);
      }
      let base = safeName(n.title);
      let name = base;
      for (let i = 2; usedNames.has(name.toLowerCase()); i++) name = `${base} ${i}`;
      usedNames.add(name.toLowerCase());
      entries.push({ name: `catatan/${name}.md`, data: lines.join('\n') });
    }
    entries.unshift({ name: 'catatan-koas.json', data: JSON.stringify({ app: 'catatan-koas', version: 1, exported: Date.now(), notes, media: mediaList }, null, 1) });
    const zip = await createZip(entries);
    const fname = `backup-catatan-koas-${new Date().toISOString().slice(0, 10)}.zip`;
    const file = new File([zip], fname, { type: 'application/zip' });
    if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ files: [file], title: fname }); } catch (e) { if (e.name === 'AbortError') return; throw e; }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
    await db.setMeta('lastBackup', Date.now());
    toast(`Backup dibuat (${fmtSize(zip.size)})`);
  } catch (e) {
    console.error(e);
    toast('Backup gagal: ' + (e?.message || e), 6000);
  } finally {
    if (btn.isConnected) { btn.disabled = false; btn.textContent = '⬇️ Buat backup'; }
  }
}

async function importBackup(file) {
  try {
    toast('Memulihkan…', 20000);
    const files = await readZip(file);
    const manifest = files.get('catatan-koas.json');
    if (!manifest) throw new Error('Bukan file backup Catatan Koas');
    const data = JSON.parse(await manifest.text());
    let added = 0, updated = 0, skipped = 0;
    const notesToPut = [];
    const keep = new Set();
    for (const n of data.notes) {
      const cur = state.notes.get(n.id);
      if (!cur) added++;
      else if (n.updated > cur.updated) updated++;
      else { skipped++; continue; }
      notesToPut.push(n);
      keep.add(n.id);
    }
    const mediaToPut = [];
    for (const m of data.media) {
      if (!keep.has(m.noteId) || state.mediaMeta.has(m.id)) continue;
      const blob = files.get(m.path);
      if (!blob) continue;
      const { path, ...meta } = m;
      let thumb = null;
      if (m.kind === 'image') { try { thumb = await resizeTo(await loadImage(blob), 360, 0.7); } catch {} }
      mediaToPut.push({ ...meta, blob: new Blob([blob], { type: m.mime }), thumb });
    }
    await db.putRaw(notesToPut, mediaToPut);
    mediaToPut.forEach(({ blob, thumb, ...meta }) => state.mediaMeta.set(meta.id, meta));
    for (const n of notesToPut) {
      n.mediaIds = [...state.mediaMeta.values()].filter((m) => m.noteId === n.id).sort((a, b) => a.created - b.created).map((m) => m.id);
      state.notes.set(n.id, n);
      indexNote(n);
    }
    requestPersistence();
    toast(`Pulih: ${added} baru, ${updated} diperbarui, ${skipped} sudah ada`, 5000);
    renderSettings();
  } catch (e) {
    console.error(e);
    toast('Gagal memulihkan: ' + (e?.message || e), 6000);
  }
}

async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {}
}

// ---------- Contoh catatan ----------

async function loadDemo() {
  const now = Date.now();
  const demo = [
    { type: 'kasus', stase: 'IPD', title: 'Tn. S, 58 th, STEMI anterior', tags: ['kardio', 'igd'], body: 'Identitas: Tn. S, 58 th, laki-laki\nKeluhan utama: nyeri dada kiri seperti ditindih sejak 2 jam SMRS, menjalar ke lengan kiri, keringat dingin.\nRPD / RPK / sosial: DM tipe 2 dan hipertensi tidak terkontrol, perokok 30 tahun.\nPemeriksaan fisik: TD 150/90, HR 102, RR 22, SpO2 95%.\nPemeriksaan penunjang: EKG ST elevasi V1-V4. Troponin meningkat.\nDiagnosis: STEMI anterior onset 2 jam, Killip I.\nTatalaksana: aspirin 320 mg kunyah, clopidogrel 300 mg, nitrat sublingual, rujuk untuk PCI primer.\nPembelajaran: door-to-balloon < 90 menit. Lihat [[Infark miokard akut]].' },
    { type: 'topik', stase: 'IPD', title: 'Infark miokard akut', tags: ['kardio'], body: 'Definisi: nekrosis miokard akibat iskemia, bagian dari sindrom koroner akut.\nGejala & tanda: nyeri dada tipikal > 20 menit, diaforesis, mual.\nDiagnosis:\n- EKG: ST elevasi ≥ 2 sadapan berdekatan (STEMI)\n- Troponin meningkat\nTatalaksana: MONACO sebagai jembatan, reperfusi (PCI primer atau fibrinolitik).' },
    { type: 'obat', stase: '', title: 'Metformin', tags: ['endokrin', 'obat oral'], body: 'Golongan: biguanid\nIndikasi: diabetes melitus tipe 2, lini pertama.\nDosis dewasa: 500 mg 1-2x sehari bersama makan, titrasi sampai maks 2000-2550 mg/hari.\nKontraindikasi: eGFR < 30, asidosis metabolik, gagal hati berat.\nEfek samping: diare, mual, defisiensi B12, asidosis laktat (jarang).' },
    { type: 'kasus', stase: 'Anak', title: 'An. R, 6 th, DBD derajat II', tags: ['infeksi', 'dengue'], body: 'Keluhan utama: demam tinggi mendadak hari ke-4, mimisan, nyeri perut.\nPemeriksaan fisik: uji torniket positif, petekie di lengan.\nPemeriksaan penunjang: trombosit 65.000, Ht naik 22% dari awal.\nTatalaksana: cairan kristaloid sesuai berat badan, pantau tanda syok dan diuresis tiap jam.' },
    { type: 'prosedur', stase: 'Bedah', title: 'Hecting luka (jahitan simpul tunggal)', tags: ['keterampilan klinis'], body: 'Indikasi: luka robek bersih < 6-8 jam.\nAlat & bahan: needle holder, pinset anatomis, gunting, benang nylon 3-0/4-0, lidokain 2%.\nLangkah-langkah:\n- Cuci tangan, APD, desinfeksi\n- Anestesi infiltrasi lidokain\n- Jahit tegak lurus tepi luka, jarak 0,5-1 cm\n- Simpul di satu sisi, potong benang 0,5 cm\nTips: eversi tepi luka agar bekas jahitan rapi.' },
  ];
  const notes = demo.map((d, i) => ({ id: uid() + i, pinned: false, created: now - (demo.length - i) * 864e5, updated: now - (demo.length - i) * 864e5, ...d }));
  await db.putRaw(notes, []);
  notes.forEach((n) => { n.mediaIds = []; state.notes.set(n.id, n); indexNote(n); });
  toast('Contoh dimuat. Coba cari “dm”, “nyeri dada”, atau “ekg”.', 4000);
  renderResults();
}

// ---------- Router ----------

async function route() {
  const inEditor = location.hash.startsWith('#/ubah') || location.hash.startsWith('#/baru/');
  // Keluar dari editor (mis. geser kembali di iPhone) tanpa menekan Simpan: simpan otomatis.
  if (state.editor && !inEditor) {
    if (state.editor.dirty && $('#e-body')) await saveEditor(false);
    state.editor = null;
  }
  const [page, arg] = (location.hash.slice(2) || '').split('/');
  window.scrollTo(0, 0);
  switch (page) {
    case 'catatan': return renderNote(arg);
    case 'baru': return arg ? renderEditor(null, arg) : renderNewPicker();
    case 'ubah': return renderEditor(arg);
    case 'pengaturan': return renderSettings();
    case 'cari':
      state.query = decodeURIComponent(arg || '');
      history.replaceState(null, '', '#/');
      return renderHome();
    default: return renderHome();
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
    e.preventDefault();
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    setTimeout(() => $('#q')?.focus(), 0);
  }
});

window.addEventListener('beforeunload', (e) => {
  if (state.editor?.dirty) { e.preventDefault(); e.returnValue = ''; }
});

function updateOnline() {
  $('#net').textContent = navigator.onLine ? '' : 'offline';
  $('#net').classList.toggle('hidden', navigator.onLine);
}

async function start() {
  try {
    await loadAll();
  } catch (e) {
    view().innerHTML = `<div class="empty"><h2>Penyimpanan tidak bisa dibuka</h2><p>${esc(e?.message || e)}. Jika memakai mode Private di Safari, buka di tab biasa.</p></div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
