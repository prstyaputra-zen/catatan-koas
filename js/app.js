import { db } from './db.js';
import { SearchIndex, normalize, tokenize } from './search.js';
import { createZip, readZip, entryBlob } from './zip.js';
import * as sync from './sync.js';
import { parseClaude, CLAUDE_PROMPT } from './paste.js';
import { BMI_SYSTEMS, parseNum, computeBmi, brocaStatus, fmtKg, bmiSummaryText } from './tools.js';
import { splitBlocks, toMarkdown, tableAt, fromCsv, fromDelimited, looksTabular, tablesFromHtml, readXlsx, convertTabRuns } from './table.js';
import { DOC_ACCEPT, DOC_LABEL, docTypeOf, extractDocument, openPdf, closePdf, pageMatchRects } from './docs.js';

const APP_VERSION = '0.7.0';

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
  draft: null, // catatan hasil "Tempel dari Claude" yang menunggu dibuka di editor
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

// Lampiran aktif (versi lama dokumen yang sudah diganti tidak ikut ditampilkan atau dicari).
function currentMedia(note) {
  return note.mediaIds.map((id) => state.mediaMeta.get(id)).filter((m) => m && !m.supersededBy);
}

function indexNote(note) {
  const media = currentMedia(note);
  state.index.add(note.id, {
    title: note.title,
    tags: note.tags.join(' '),
    stase: note.stase + ' ' + (TYPES[note.type]?.label || ''),
    media: media.map((m) => `${m.caption || ''} ${m.name || ''} ${m.ocrText || ''} ${m.transcript || ''}`).join(' '),
    body: note.body,
    doc: media.filter((m) => m.kind === 'doc').map((m) => (m.docPages || []).join('\n')).join('\n'),
  });
}

const KIND_ICON = { image: '🖼️', video: '🎬', audio: '🎙️', doc: '📄' };

function hasTerm(text, terms) {
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) if (terms.has(normalize(m[0]))) return true;
  return false;
}

// Halaman dokumen pertama yang memuat kata yang dicari.
function docHit(media, terms) {
  for (const m of media) {
    if (m.kind !== 'doc' || !m.docPages) continue;
    for (let i = 0; i < m.docPages.length; i++) {
      if (hasTerm(m.docPages[i], terms)) return { m, page: i };
    }
  }
  return null;
}

function pagesWithTerms(m, terms) {
  if (!terms || !terms.size || !m.docPages) return [];
  const out = [];
  m.docPages.forEach((t, i) => hasTerm(t, terms) && out.push(i));
  return out;
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
  // Tabel Markdown diringkas menjadi "sel · sel" agar cuplikan tetap terbaca.
  const text = body.replace(/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/gm, '').replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, '').replace(/[ \t]*(?<!\\)\|[ \t]*/g, ' · ').replace(/(\s*·)+\s/g, ' · ').replace(/\s+/g, ' ').trim();
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
// Isi catatan tanpa label template yang belum diisi.
function visibleBody(body, type) {
  const labels = new Set((TYPES[type]?.template || '').split('\n').map((l) => l.trim()).filter(Boolean));
  const lines = body.split('\n');
  // Label template disembunyikan hanya bila bagiannya kosong (isi di baris bawahnya tetap dianggap isi).
  const isHeading = (l) => labels.has(l.trim()) || /^[^:\-•*]{1,60}:$/.test(l.trim());
  return lines.filter((l, i) => {
    if (!labels.has(l.trim())) return true;
    const next = lines.slice(i + 1).find((x) => x.trim());
    return next !== undefined && !isHeading(next);
  }).join('\n');
}

function inlineHtml(text, terms) {
  let h = highlight(text, terms);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/https?:\/\/[^\s<>"]+[^\s<>".,;:)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener" class="extlink">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}${u.length > 56 ? '…' : ''}</a>`);
  h = h.replace(/\[\[(.+?)\]\]/g, (_, t) => `<a href="#/cari/${encodeURIComponent(t.replace(/<[^>]+>/g, ''))}" class="wikilink">${t}</a>`);
  return h;
}

function tableHtml(rows, header, terms) {
  const cell = (c, tag) => `<${tag}>${inlineHtml(c, terms)}</${tag}>`;
  const head = header ? `<thead><tr>${rows[0].map((c) => cell(c, 'th')).join('')}</tr></thead>` : '';
  const bodyRows = (header ? rows.slice(1) : rows).map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="note-table">${head}<tbody>${bodyRows}</tbody></table></div>`;
}

function renderBody(body, terms, type) {
  let html = '';
  for (const block of splitBlocks(visibleBody(body, type))) {
    if (block.type === 'table') { html += tableHtml(block.rows, block.header, terms); continue; }
    let inList = false;
    for (const raw of block.lines) {
      const listItem = raw.match(/^\s*[-*•]\s+(.*)$/);
      if (listItem && !inList) { html += '<ul>'; inList = true; }
      if (!listItem && inList) { html += '</ul>'; inList = false; }
      let h = inlineHtml(listItem ? listItem[1] : raw, terms);
      const label = !listItem && h.match(/^([^:<]{1,60}):(.*)$/);
      if (label) h = `<span class="label">${label[1]}:</span>${label[2]}`;
      html += listItem ? `<li>${h}</li>` : h.trim() ? `<p>${h}</p>` : '<div class="gap"></div>';
    }
    if (inList) html += '</ul>';
  }
  return html;
}

// Teks dokumen (pratinjau Word/Excel/teks): paragraf biasa, tabel Markdown tampil sebagai tabel.
function docTextHtml(text, terms) {
  return splitBlocks(text).map((b) => (b.type === 'table'
    ? tableHtml(b.rows, b.header, terms)
    : b.lines.map((l) => (l.trim() ? `<p>${highlight(l, terms)}</p>` : '')).join(''))).join('');
}

// Satuan halaman dokumen untuk label.
function pageUnit(m, cap = false) {
  const u = m.docType === 'pptx' ? 'slide' : m.docType === 'xlsx' ? 'sheet' : 'hal';
  return cap ? { slide: 'Slide', sheet: 'Sheet', hal: 'Halaman' }[u] : u;
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
  const media = currentMedia(n);
  const counts = { image: 0, video: 0, audio: 0, doc: 0 };
  media.forEach((m) => counts[m.kind]++);
  const firstImg = media.find((m) => m.kind === 'image') || media.find((m) => m.kind === 'doc' && m.hasThumb);
  const matchedMedia = terms && media.find((m) => hasTerm(`${m.caption || ''} ${m.name || ''}`, terms));
  const bodyHit = terms && (hasTerm(n.title, terms) || hasTerm(n.body, terms));
  const dh = terms && !bodyHit && !matchedMedia ? docHit(media, terms) : null;
  return `
    <a class="card" href="#/catatan/${n.id}">
      <div class="card-main">
        <div class="card-top"><span class="badge t-${n.type}">${t.icon} ${t.label}</span>${n.stase ? `<span class="badge">${esc(n.stase)}</span>` : ''}${n.pinned ? '<span class="pin">📌</span>' : ''}</div>
        <h3>${highlight(n.title || '(tanpa judul)', terms)}</h3>
        <p class="snip">${snippet(visibleBody(n.body, n.type), terms)}</p>
        ${matchedMedia ? `<p class="snip media-hit">${KIND_ICON[matchedMedia.kind]} ${highlight(matchedMedia.caption || matchedMedia.name, terms)}</p>` : ''}
        ${dh ? `<p class="snip media-hit doc-hit"><b>📄 ${esc(dh.m.name)}${dh.m.pageCount ? ` · hal. ${dh.page + 1}` : ''}</b> ${snippet(dh.m.docPages[dh.page], terms, 120)}</p>` : ''}
        <div class="card-foot">
          ${n.tags.slice(0, 4).map((x) => `<span class="tag">#${highlight(x, terms)}</span>`).join('')}
          <span class="spacer"></span>
          ${counts.image ? `<span>🖼️ ${counts.image}</span>` : ''}${counts.video ? `<span>🎬 ${counts.video}</span>` : ''}${counts.audio ? `<span>🎙️ ${counts.audio}</span>` : ''}${counts.doc ? `<span>📄 ${counts.doc}</span>` : ''}
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
    n.updated = Date.now();
    const { mediaIds, ...stored } = n;
    await db.saveNote(stored);
    scheduleSync();
    $('#pin').textContent = n.pinned ? '📌' : '📍';
    toast(n.pinned ? 'Disematkan di atas daftar' : 'Sematan dilepas');
  };
  $('#del').onclick = async () => {
    if (!confirm('Hapus catatan ini beserta semua medianya? Tidak bisa dibatalkan.')) return;
    await db.deleteNote(n.id);
    await addTombstone(n.id);
    scheduleSync();
    n.mediaIds.forEach((m) => state.mediaMeta.delete(m));
    state.index.remove(n.id);
    state.notes.delete(n.id);
    toast('Catatan dihapus');
    location.hash = '#/';
  };
  const gallery = $('#gallery');
  for (const meta of currentMedia(n)) {
    if (meta.kind === 'doc') {
      if (!gallery.isConnected) return;
      gallery.appendChild(docFigure(n, meta, terms));
      continue;
    }
    const m = await db.getMedia(meta.id);
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

// ---------- Dokumen: kartu di catatan & penampil ----------

function docFigure(note, m, terms) {
  const el = document.createElement('figure');
  el.className = 'm-doc';
  const hits = pagesWithTerms(m, terms);
  const versions = olderVersions(m.id).length;
  el.innerHTML = `
    <button type="button" class="doc-card">
      <span class="doc-thumb">${m.hasThumb ? '<img alt="">' : `<span class="doc-icon d-${m.docType}">${DOC_LABEL[m.docType] || 'Dok'}</span>`}</span>
      <span class="doc-info">
        <b>${highlight(m.name, terms)}</b>
        <small>${DOC_LABEL[m.docType] || 'Dokumen'}${m.pageCount ? ` · ${m.pageCount} ${pageUnit(m)}` : ''} · ${fmtSize(m.size)}${versions ? ` · ${versions + 1} versi` : ''}</small>
        ${m.caption ? `<small class="cap">${highlight(m.caption, terms)}</small>` : ''}
        ${hits.length ? `<small class="hits">Ditemukan di ${m.pageCount ? 'hal. ' + hits.slice(0, 8).map((i) => i + 1).join(', ') + (hits.length > 8 ? '…' : '') : 'isi dokumen'}</small>` : ''}
      </span>
    </button>`;
  el.querySelector('.doc-card').onclick = () => openDocViewer(note, m.id, hits[0] ?? 0, terms);
  if (m.hasThumb) {
    db.getMedia(m.id).then((full) => {
      const img = el.querySelector('img');
      if (full?.thumb && img) img.src = objUrl(full.thumb);
    });
  }
  return el;
}

async function shareOrDownload(m) {
  const file = new File([m.blob], m.name, { type: m.mime || 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = m.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function countTerms(text, terms) {
  let n = 0;
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) if (terms.has(normalize(m[0]))) n++;
  return n;
}

// Kata yang disorot untuk kueri: hasil perluasan indeks (sinonim, awalan, salah ketik) plus kata kueri itu sendiri.
function termsForQuery(q) {
  if (!q.trim()) return new Set();
  return new Set([...state.index.search(q).terms, ...tokenize(q)]);
}

async function openDocViewer(note, mediaId, startPage = 0, terms = null) {
  const m = await db.getMedia(mediaId);
  if (!m) return;
  const isCurrent = !m.supersededBy;
  const older = isCurrent ? olderVersions(m.id) : [];
  const hasText = (m.docPages || []).join('').trim().length > 0;
  let query = terms && terms.size ? state.query : '';
  terms = terms || new Set();
  const ov = document.createElement('div');
  ov.className = 'docviewer';
  ov.innerHTML = `
    <div class="dv-bar">
      <button class="iconbtn" data-act="close" aria-label="Tutup">✕</button>
      <div class="dv-title"><b>${esc(m.name)}</b><small>${DOC_LABEL[m.docType] || 'Dokumen'}${m.pageCount ? ` · ${m.pageCount} ${pageUnit(m)}` : ''} · ${fmtSize(m.size)}${isCurrent ? '' : ` · versi lama, ${fmtDate(m.created)}`}</small></div>
      ${m.docType === 'pdf' ? '<button class="iconbtn" data-act="zoomout" aria-label="Perkecil">−</button><button class="iconbtn" data-act="zoomin" aria-label="Perbesar">＋</button>' : ''}
    </div>
    <div class="dv-actions">
      <button class="btn small" data-act="open">${m.docType === 'docx' ? 'Edit di Word / Pages' : 'Buka di…'}</button>
      ${isCurrent ? '<label class="btn small ghost">Simpan versi baru<input type="file" hidden data-act="newver"></label>' : ''}
      ${hasText ? '<button class="btn small ghost" data-act="tonote">Jadikan catatan</button>' : ''}
    </div>
    ${hasText ? `<div class="dv-find">
      <input id="dv-q" type="search" placeholder="Cari di dokumen ini" value="${esc(query)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      <span class="dv-count" id="dv-count"></span>
      <button class="iconbtn" data-act="prev" aria-label="Hasil sebelumnya">⌃</button>
      <button class="iconbtn" data-act="next" aria-label="Hasil berikutnya">⌄</button>
    </div>` : ''}
    <div class="dv-body"></div>
    ${older.length ? `<div class="dv-versions"><h4 class="section">Versi sebelumnya</h4>${older.map((v) => `<div class="dv-ver"><span>${fmtDate(v.created)} · ${fmtSize(v.size)}</span><button class="btn small ghost" data-ver="${v.id}">Buka</button></div>`).join('')}</div>` : ''}`;
  document.body.appendChild(ov);
  document.body.classList.add('noscroll');
  const body = ov.querySelector('.dv-body');
  const countEl = ov.querySelector('#dv-count');
  const newVerInput = ov.querySelector('[data-act="newver"]');
  if (newVerInput) newVerInput.accept = DOC_ACCEPT;
  let pdf = null;
  let observer = null;
  let zoom = 1;
  let matches = []; // { page, k }: kemunculan ke-k di halaman itu
  let cur = -1;
  // Diisi oleh mode PDF atau mode teks di bawah.
  let applyTerms = () => {};
  let showMatch = () => {};
  let setZoom = () => {};

  const close = () => {
    observer?.disconnect();
    closePdf(pdf);
    ov.remove();
    document.body.classList.remove('noscroll');
    window.removeEventListener('hashchange', close);
  };
  window.addEventListener('hashchange', close);

  const updateCount = () => {
    if (!countEl) return;
    countEl.textContent = !query.trim() ? '' : matches.length ? `${cur + 1}/${matches.length}` : 'Tidak ada';
  };
  const goTo = (i) => {
    if (!matches.length) { updateCount(); return; }
    cur = (i + matches.length) % matches.length;
    updateCount();
    showMatch(matches[cur]);
  };
  const recompute = () => {
    matches = [];
    if (terms.size) (m.docPages || []).forEach((t, page) => {
      const n = countTerms(t, terms);
      for (let k = 0; k < n; k++) matches.push({ page, k });
    });
    cur = -1;
    applyTerms();
  };

  ov.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act],[data-ver]');
    if (!t) return;
    if (t.dataset.ver) { close(); return openDocViewer(note, t.dataset.ver, 0, terms); }
    const act = t.dataset.act;
    if (act === 'close') close();
    else if (act === 'open') shareOrDownload(m);
    else if (act === 'tonote') { close(); docToNote(note, m); }
    else if (act === 'zoomin' || act === 'zoomout') setZoom(act === 'zoomin' ? 1.5 : 1 / 1.5);
    else if (act === 'next') goTo(cur + 1);
    else if (act === 'prev') goTo(cur - 1);
  });
  newVerInput?.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    close();
    await saveNewVersion(note, m, f);
  });
  const qInput = ov.querySelector('#dv-q');
  let qTimer;
  qInput?.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      query = qInput.value;
      terms = termsForQuery(query);
      recompute();
      goTo(0);
    }, 200);
  });
  qInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goTo(cur + (e.shiftKey ? -1 : 1)); qInput.blur(); }
  });

  if (m.docType === 'pdf') {
    body.innerHTML = '<p class="dv-loading">Membuka PDF…</p>';
    try {
      pdf = await openPdf(m.blob);
    } catch (err) {
      body.innerHTML = `<p class="dv-loading">PDF tidak bisa ditampilkan (${esc(err?.message || err)}). Gunakan “Buka di…”.</p>`;
      return;
    }
    if (!ov.isConnected) { closePdf(pdf); return; }
    const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
    body.innerHTML = '';
    body.classList.add('pdf');
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const d = document.createElement('div');
      d.className = 'pdfpage';
      d.dataset.no = i;
      d.style.aspectRatio = `${first.width} / ${first.height}`;
      d.innerHTML = `<span class="pno">${i}</span>`;
      body.appendChild(d);
      pages.push(d);
    }
    const rendering = new Map();
    const rectCache = new Map(); // nomor halaman -> posisi sorotan untuk kata yang sedang dicari
    let pending = null; // hasil yang ingin disorot setelah halamannya selesai digambar

    const focusPending = (d) => {
      if (!pending || pending.page + 1 !== +d.dataset.no) return;
      const els = d.querySelectorAll('.hl');
      if (!els.length) return;
      body.querySelectorAll('.hl.cur').forEach((x) => x.classList.remove('cur'));
      const el = els[Math.min(pending.k, els.length - 1)];
      el.classList.add('cur');
      el.scrollIntoView({ block: 'center', inline: 'center' });
      pending = null;
    };
    const drawHighlights = async (d) => {
      const no = +d.dataset.no;
      d.querySelectorAll('.hl').forEach((x) => x.remove());
      if (!terms.size || !matches.some((mt) => mt.page === no - 1)) return;
      const termsAtStart = terms;
      let rects = rectCache.get(no);
      if (!rects) {
        const page = await pdf.getPage(no);
        rects = await pageMatchRects(page, (w) => termsAtStart.has(normalize(w)));
        if (termsAtStart !== terms) return; // kueri berubah saat menghitung
        rectCache.set(no, rects);
      }
      d.querySelectorAll('.hl').forEach((x) => x.remove());
      for (const r of rects) {
        const hl = document.createElement('span');
        hl.className = 'hl';
        hl.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%`;
        d.appendChild(hl);
      }
      focusPending(d);
    };
    const render = async (d) => {
      const no = +d.dataset.no;
      if (rendering.has(no)) return;
      const task = (async () => {
        const page = await pdf.getPage(no);
        const base = page.getViewport({ scale: 1 });
        d.style.aspectRatio = `${base.width} / ${base.height}`;
        const scale = (d.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width);
        c.height = Math.round(vp.height);
        await page.render({ canvasContext: c.getContext('2d'), canvas: c, viewport: vp }).promise;
        if (!rendering.has(no)) return;
        d.querySelector('canvas')?.remove();
        d.prepend(c);
        if (!d.querySelector('.hl')) await drawHighlights(d);
        else focusPending(d);
      })().catch(() => {});
      rendering.set(no, task);
    };
    const unrender = (d) => {
      rendering.delete(+d.dataset.no);
      const c = d.querySelector('canvas');
      if (c) { c.width = 0; c.height = 0; c.remove(); }
    };
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? render(en.target) : unrender(en.target)));
    }, { root: body, rootMargin: '1200px 0px' });
    pages.forEach((d) => observer.observe(d));

    applyTerms = () => {
      rectCache.clear();
      pages.forEach((d) => (rendering.has(+d.dataset.no) ? drawHighlights(d) : d.querySelectorAll('.hl').forEach((x) => x.remove())));
    };
    showMatch = (mt) => {
      pending = mt;
      const d = pages[mt.page];
      if (!d) return;
      d.scrollIntoView({ block: 'start' });
      focusPending(d);
    };
    setZoom = (f) => {
      zoom = Math.min(4, Math.max(1, zoom * f));
      body.style.setProperty('--zoom', zoom);
      pages.forEach((d) => { if (rendering.has(+d.dataset.no)) { unrender(d); render(d); } });
    };
    recompute();
    const firstOnPage = matches.findIndex((mt) => mt.page >= startPage);
    if (firstOnPage >= 0) requestAnimationFrame(() => goTo(firstOnPage));
    else requestAnimationFrame(() => pages[startPage]?.scrollIntoView({ block: 'start' }));
  } else {
    const parts = m.docPages || [];
    if (!hasText) {
      body.innerHTML = `<p class="dv-loading">Pratinjau tidak tersedia untuk file ini. File asli tersimpan utuh. Gunakan “Buka di…” untuk membukanya di aplikasi lain.</p>`;
      return;
    }
    applyTerms = () => {
      body.innerHTML = `<p class="dv-note">Pratinjau teks. Format asli (tabel, gambar, gaya) tetap utuh di file.</p>` +
        parts.map((t, i) => `<section class="dv-page" data-no="${i}">${parts.length > 1 ? `<h4 class="section">${m.docType === 'pptx' ? 'Slide' : m.docType === 'xlsx' ? 'Sheet' : 'Bagian'} ${i + 1}</h4>` : ''}${docTextHtml(t, terms)}</section>`).join('');
      // Di mode teks, setiap <mark> adalah satu hasil, urut sesuai dokumen.
      matches = [...body.querySelectorAll('mark')].map((el, k) => ({ page: 0, k, el }));
    };
    showMatch = (mt) => {
      body.querySelectorAll('mark.cur').forEach((x) => x.classList.remove('cur'));
      mt.el.classList.add('cur');
      mt.el.scrollIntoView({ block: 'center' });
    };
    recompute();
    if (matches.length) requestAnimationFrame(() => goTo(0));
  }
  updateCount();
}

async function saveNewVersion(note, old, file) {
  const docType = docTypeOf(file) || old.docType;
  const nm = await buildDocMedia(file, docType, note.id);
  nm.caption = old.caption || '';
  const { isNew, dirty, ...stored } = nm;
  note.updated = Date.now();
  const { mediaIds, ...storedNote } = note;
  try {
    await db.saveNote(storedNote, [stored], [{ id: old.id, supersededBy: nm.id }]);
  } catch (e) {
    toast('Gagal menyimpan versi baru: ' + (e?.message || e), 6000);
    return;
  }
  const { blob, thumb, ...meta } = stored;
  state.mediaMeta.set(nm.id, meta);
  const oldMeta = state.mediaMeta.get(old.id);
  if (oldMeta) oldMeta.supersededBy = nm.id;
  note.mediaIds.push(nm.id);
  indexNote(note);
  toast('Versi baru disimpan. Versi lama tetap bisa dibuka.', 4000);
  scheduleSync();
  renderNote(note.id);
}

async function docToNote(parent, m) {
  const pages = m.docPages || [];
  const text = pages.length > 1
    ? pages.map((t, i) => `[${pageUnit(m, true)} ${i + 1}]\n${t}`).join('\n\n')
    : pages[0] || '';
  const now = Date.now();
  const n = {
    id: uid(), type: 'bebas', title: m.name.replace(/\.[a-z0-9]+$/i, ''),
    body: `Sumber: [[${parent.title}]] (${m.name})\n\n${text}`,
    tags: [...parent.tags], stase: parent.stase, pinned: false, created: now, updated: now,
  };
  await db.saveNote(n);
  n.mediaIds = [];
  state.notes.set(n.id, n);
  indexNote(n);
  toast('Catatan baru dibuat dari dokumen. Silakan edit.', 4000);
  scheduleSync();
  location.hash = '#/ubah/' + n.id;
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
      <a class="pick pick-claude" href="#/tempel"><span class="big">✨</span><b>Tempel dari Claude</b><small>Jadikan obrolan dengan Claude catatan baru</small></a>
    </div>`;
}

function pickHint(k) {
  return { kasus: 'Pasien yang kamu temui', topik: 'Penyakit atau materi', obat: 'Dosis, indikasi, efek samping', prosedur: 'Langkah tindakan', bebas: 'Tanpa template' }[k];
}

// ---------- Alat: kalkulator klinis ----------

function renderTools() {
  releaseUrls();
  view().innerHTML = `
    <div class="topbar"><a href="#/" class="iconbtn" aria-label="Kembali">‹</a><span class="grow title">Alat</span></div>
    <div class="picker">
      <a class="pick" href="#/alat/bmi"><span class="big">⚖️</span><b>Kalkulator IMT / BMI</b><small>Interpretasi Asia-Pasifik, WHO, Kemenkes, BB ideal</small></a>
    </div>`;
}

// Skala warna IMT Asia-Pasifik untuk penanda posisi.
const BMI_SCALE = { min: 14, max: 36, stops: [[18.5, 'under'], [23, 'ok'], [25, 'warn'], [30, 'high'], [36, 'severe']] };

function bmiScaleHtml(bmi) {
  const span = BMI_SCALE.max - BMI_SCALE.min;
  let prev = BMI_SCALE.min;
  const segs = BMI_SCALE.stops.map(([to, tone]) => {
    const w = ((to - prev) / span) * 100; prev = to;
    return `<span class="seg tone-${tone}" style="width:${w}%"></span>`;
  }).join('');
  const pos = Math.min(100, Math.max(0, ((bmi - BMI_SCALE.min) / span) * 100));
  const ticks = [18.5, 23, 25, 30].map((t) => `<span class="tick" style="left:${((t - BMI_SCALE.min) / span) * 100}%">${String(t).replace('.', ',')}</span>`).join('');
  return `<div class="bmi-scale"><div class="bar">${segs}<span class="marker" style="left:${pos}%"></span></div><div class="ticks">${ticks}</div></div>`;
}

function renderBmi() {
  releaseUrls();
  view().innerHTML = `
    <div class="topbar"><a href="#/alat" class="iconbtn" aria-label="Kembali">‹</a><span class="grow title">Kalkulator IMT</span></div>
    <form class="editor calc" onsubmit="return false">
      <div class="row">
        <label class="field"><span>Tinggi badan</span><span class="unit"><input id="b-h" inputmode="decimal" placeholder="165" autocomplete="off"><i>cm</i></span></label>
        <label class="field"><span>Berat badan</span><span class="unit"><input id="b-w" inputmode="decimal" placeholder="60" autocomplete="off"><i>kg</i></span></label>
      </div>
      <div class="row">
        <label class="field"><span>Jenis kelamin (opsional)</span><select id="b-sex"><option value="">–</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
        <label class="field"><span>Lingkar perut (opsional)</span><span class="unit"><input id="b-waist" inputmode="decimal" placeholder="85" autocomplete="off"><i>cm</i></span></label>
      </div>
    </form>
    <div id="b-out" class="calc-out"><p class="hint">Isi tinggi dan berat badan untuk melihat hasilnya.</p></div>
    <details class="calc-ref">
      <summary>Tabel kategori dan catatan</summary>
      ${Object.values(BMI_SYSTEMS).map((sys) => {
        let lo = null;
        const rows = sys.cats.map((c) => {
          const f = (x) => x.toFixed(1).replace('.', ',');
          const range = lo === null ? `< ${f(round1Next(c.max))}` : c.max === Infinity ? `≥ ${f(lo)}` : `${f(lo)} – ${f(c.max)}`;
          lo = round1Next(c.max);
          return `<tr><td>${range}</td><td>${esc(c.name)}</td></tr>`;
        }).join('');
        return `<h4>${esc(sys.label)}</h4><table>${rows}</table>`;
      }).join('')}
      <h4>Catatan</h4>
      <ul>
        <li>Tidak untuk anak dan remaja &lt; 18 tahun (pakai kurva IMT/U WHO atau CDC), ibu hamil, atlet berotot, serta pasien dengan edema atau asites.</li>
        <li>BB ideal Broca modifikasi = (TB − 100) − 10%. Tanpa pengurangan 10% pada pria &lt; 160 cm dan wanita &lt; 150 cm.</li>
        <li>Obesitas sentral (kriteria Asia/IDF): lingkar perut ≥ 90 cm pada pria dan ≥ 80 cm pada wanita.</li>
      </ul>
    </details>`;
  const ids = ['#b-h', '#b-w', '#b-sex', '#b-waist'];
  const calc = () => {
    const input = { heightCm: parseNum($('#b-h').value), weightKg: parseNum($('#b-w').value), sex: $('#b-sex').value, waistCm: parseNum($('#b-waist').value) };
    const out = $('#b-out');
    if (!$('#b-h').value.trim() || !$('#b-w').value.trim()) { out.innerHTML = '<p class="hint">Isi tinggi dan berat badan untuk melihat hasilnya.</p>'; return; }
    const r = computeBmi(input);
    if (!r) { out.innerHTML = '<p class="hint">Periksa lagi angkanya (tinggi 50–250 cm, berat 2–400 kg).</p>'; return; }
    const a = r.cats.asia;
    out.innerHTML = `
      <div class="bmi-main tone-${a.tone}-soft">
        <div class="bmi-num">${r.bmiText}<small> kg/m²</small></div>
        <div class="bmi-cat">${esc(a.name)}</div>
        <div class="hint">Kategori Asia-Pasifik</div>
      </div>
      ${bmiScaleHtml(r.bmi)}
      <dl class="bmi-list">
        <div><dt>WHO</dt><dd>${esc(r.cats.who.name)}</dd></div>
        <div><dt>Kemenkes</dt><dd>${esc(r.cats.kemenkes.name)}</dd></div>
        <div><dt>BB normal untuk TB ini</dt><dd>${fmtKg(r.normalRange[0])} – ${fmtKg(r.normalRange[1])} kg${r.toNormal ? ` <span class="hint">(${r.toNormal > 0 ? 'kurang' : 'lebih'} ${fmtKg(Math.abs(r.toNormal))} kg)</span>` : ''}</dd></div>
        ${r.broca ? `<div><dt>BB ideal (Broca)</dt><dd>${fmtKg(r.broca)} kg · ${Math.round(r.brocaPct)}% BBI, ${esc(brocaStatus(r.brocaPct))}</dd></div>` : ''}
        ${r.waist ? `<div><dt>Lingkar perut</dt><dd>${r.waist.central ? '<b>Obesitas sentral</b>' : 'Normal'} (batas ${r.waist.cut} cm)</dd></div>` : ''}
      </dl>
      <p class="advice">${esc(r.advice)}</p>
      <div class="row"><button type="button" class="btn ghost" id="b-copy">📋 Salin hasil</button><button type="button" class="btn ghost" id="b-note">📝 Jadikan catatan</button></div>`;
    const text = bmiSummaryText(input, r);
    $('#b-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(text); toast('Hasil disalin'); } catch { toast('Gagal menyalin'); }
    };
    $('#b-note').onclick = () => {
      state.draft = { type: 'bebas', title: `IMT ${r.bmiText} (${a.name})`, body: text + '\n\nInterpretasi:\n' + r.advice, tags: ['imt', 'bmi'], stase: '', sources: [] };
      location.hash = '#/baru/bebas';
    };
  };
  ids.forEach((id) => { $(id).addEventListener('input', calc); $(id).addEventListener('change', calc); });
  if (!matchMedia('(pointer: coarse)').matches) $('#b-h').focus();
}

// Batas bawah kategori berikutnya (mis. 18.4 -> 18.5) untuk tabel.
function round1Next(max) {
  return Math.round((max + 0.1) * 10) / 10;
}

// ---------- Tabel di editor ----------

// Menyisipkan teks di posisi kursor (atau mengganti rentang), dengan baris kosong di sekitar tabel.
function insertIntoBody(text, start, end, block = true) {
  const body = $('#e-body');
  if (start == null) [start, end] = bodyCaret();
  const before = body.value.slice(0, start);
  const after = body.value.slice(end);
  const pre = block && before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const post = block && after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  body.value = before + pre + text + post + after;
  const caret = (before + pre + text).length;
  body.setSelectionRange(caret, caret);
  if (state.editor) state.editor.caret = [caret, caret];
  body.dispatchEvent(new Event('input', { bubbles: true }));
}

function bodyCaret() {
  const body = $('#e-body');
  const c = state.editor?.caret;
  if (c && c[0] != null && c[0] <= body.value.length) return [c[0], Math.min(c[1] ?? c[0], body.value.length)];
  return [body.value.length, body.value.length];
}

function editTableAtCursor() {
  const body = $('#e-body');
  const [caretStart] = bodyCaret();
  const found = tableAt(body.value, caretStart);
  if (found) {
    openTableEditor(found.rows, {
      editing: true,
      onSave: (md) => insertIntoBody(md, found.start, found.end, false),
      onDelete: () => insertIntoBody('', found.start, found.end, false),
    });
  } else {
    const [start, end] = bodyCaret();
    openTableEditor([['Kolom 1', 'Kolom 2', 'Kolom 3'], ['', '', ''], ['', '', '']], { onSave: (md) => insertIntoBody(md, start, end) });
  }
}

const GRID_LIMIT = 3000; // sel; tabel lebih besar langsung disisipkan tanpa editor kisi

async function importTableFile(file) {
  const [start, end] = bodyCaret();
  let sheets;
  try {
    sheets = /\.xls[xm]$/i.test(file.name) || file.type.includes('spreadsheetml')
      ? await readXlsx(file)
      : [{ name: file.name, rows: fromCsv(await file.text()) }];
  } catch (e) {
    console.warn(e);
    toast('File tidak bisa dibaca. Simpan sebagai .xlsx atau .csv lalu coba lagi.', 5000);
    return;
  }
  sheets = sheets.filter((sh) => sh.rows.length);
  if (!sheets.length) { toast('Tidak ada tabel di file ini'); return; }
  const big = sheets[0].rows.length * sheets[0].rows[0].length > GRID_LIMIT;
  if (big && sheets.length === 1) {
    insertIntoBody(toMarkdown(sheets[0].rows), start, end);
    toast(`Tabel ${sheets[0].rows.length} baris disisipkan`);
    return;
  }
  openTableEditor(sheets[0].rows, { sheets, onSave: (md) => insertIntoBody(md, start, end) });
}

function onBodyPaste(e) {
  const cd = e.clipboardData;
  if (!cd) return;
  const text = cd.getData('text/plain') || '';
  const html = cd.getData('text/html') || '';
  let out = null;
  let count = 0;
  if (looksTabular(text)) {
    out = toMarkdown(fromDelimited(text.replace(/\n+$/, ''), '\t'));
    count = 1;
  } else if (text.includes('\t')) {
    ({ text: out, count } = convertTabRuns(text));
  }
  if (!count && /<table/i.test(html)) {
    // Tabel dari halaman web yang teks biasanya tidak memakai tab.
    const tables = tablesFromHtml(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('table').forEach((t) => t.remove());
    if (tables.length && !doc.body.textContent.trim()) { out = tables.map(toMarkdown).join('\n\n'); count = tables.length; }
  }
  if (!count || !out) return;
  e.preventDefault();
  insertIntoBody(out, undefined, undefined, true);
  toast(count > 1 ? `${count} tabel dikonversi` : 'Tabel dikonversi. Ketuk tabel lalu ▦ Tabel untuk mengedit.', 3500);
}

// Editor kisi: baris pertama adalah judul kolom.
function openTableEditor(initialRows, { editing = false, sheets = null, onSave, onDelete } = {}) {
  let rows = initialRows.map((r) => [...r]);
  const ov = document.createElement('div');
  ov.className = 'tbl-editor';
  ov.innerHTML = `
    <div class="tbl-panel" role="dialog" aria-label="Edit tabel">
      <div class="topbar">
        <button class="iconbtn" data-act="cancel" aria-label="Batal">✕</button>
        <span class="grow title">${editing ? 'Edit tabel' : 'Tabel baru'}</span>
        <button class="btn small" data-act="save">${editing ? 'Simpan' : 'Sisipkan'}</button>
      </div>
      ${sheets && sheets.length > 1 ? `<select class="tbl-sheet" aria-label="Pilih sheet">${sheets.map((sh, i) => `<option value="${i}">${esc(sh.name)} (${sh.rows.length} baris)</option>`).join('')}</select>` : ''}
      <p class="hint">Baris pertama menjadi judul kolom. Tempel sel dari Excel atau Numbers ke kotak mana pun untuk mengisi banyak sel sekaligus.</p>
      <div class="tbl-scroll"><table class="tbl-grid"></table></div>
      <div class="row tbl-actions">
        <button type="button" class="btn small ghost" data-act="addrow">＋ Baris</button>
        <button type="button" class="btn small ghost" data-act="addcol">＋ Kolom</button>
        ${editing ? '<button type="button" class="btn small ghost danger-text" data-act="delete">Hapus tabel</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('modal-open');
  const grid = ov.querySelector('.tbl-grid');

  const readGrid = () => {
    grid.querySelectorAll('input').forEach((inp) => { rows[+inp.dataset.r][+inp.dataset.c] = inp.value; });
  };
  const draw = (focus) => {
    const cols = Math.max(1, ...rows.map((r) => r.length));
    rows = rows.map((r) => Array.from({ length: cols }, (_, k) => r[k] ?? ''));
    grid.innerHTML = `<thead><tr><th></th>${rows[0].map((_, c) => `<th><button type="button" class="tbl-x" data-delcol="${c}" aria-label="Hapus kolom ${c + 1}" ${cols < 2 ? 'disabled' : ''}>✕</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr class="${ri === 0 ? 'tbl-head' : ''}"><th><button type="button" class="tbl-x" data-delrow="${ri}" aria-label="Hapus baris ${ri + 1}" ${rows.length < 2 ? 'disabled' : ''}>✕</button></th>${r.map((c, ci) => `<td><input data-r="${ri}" data-c="${ci}" value="${esc(c)}" ${ri === 0 ? 'placeholder="Judul"' : ''} autocomplete="off"></td>`).join('')}</tr>`).join('')}</tbody>`;
    if (focus) grid.querySelector(`input[data-r="${focus[0]}"][data-c="${focus[1]}"]`)?.focus();
  };
  draw();

  const close = () => { ov.remove(); document.body.classList.remove('modal-open'); };
  ov.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    readGrid();
    if (t.dataset.delrow) { rows.splice(+t.dataset.delrow, 1); draw(); return; }
    if (t.dataset.delcol) { rows.forEach((r) => r.splice(+t.dataset.delcol, 1)); draw(); return; }
    const act = t.dataset.act;
    if (act === 'addrow') { rows.push(rows[0].map(() => '')); draw([rows.length - 1, 0]); }
    else if (act === 'addcol') { rows.forEach((r, i) => r.push(i === 0 ? `Kolom ${r.length + 1}` : '')); draw([1, rows[0].length - 1]); }
    else if (act === 'cancel') close();
    else if (act === 'delete') { if (confirm('Hapus tabel ini dari catatan?')) { close(); onDelete?.(); } }
    else if (act === 'save') {
      const md = toMarkdown(rows);
      if (!md) { toast('Tabel masih kosong'); return; }
      close();
      onSave(md);
    }
  });
  ov.querySelector('.tbl-sheet')?.addEventListener('change', (e) => { rows = sheets[+e.target.value].rows.map((r) => [...r]); draw(); });
  // Enter pindah ke baris berikutnya (menambah baris bila perlu), seperti di spreadsheet.
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.dataset.r) return;
    e.preventDefault();
    readGrid();
    const r = +e.target.dataset.r + 1;
    if (r >= rows.length) rows.push(rows[0].map(() => ''));
    draw([r, +e.target.dataset.c]);
  });
  // Tempel blok sel dari spreadsheet: mengisi mulai dari sel yang sedang aktif.
  grid.addEventListener('paste', (e) => {
    const inp = e.target;
    if (!inp.dataset?.r) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    const html = e.clipboardData?.getData('text/html') || '';
    let block = null;
    if (/[\t\n]/.test(text.replace(/\n+$/, ''))) block = fromDelimited(text.replace(/\n+$/, ''), text.includes('\t') ? '\t' : '\u0000');
    else if (/<table/i.test(html)) block = tablesFromHtml(html)[0];
    if (!block || (block.length < 2 && (block[0]?.length || 0) < 2)) return;
    e.preventDefault();
    readGrid();
    const r0 = +inp.dataset.r; const c0 = +inp.dataset.c;
    block.forEach((br, i) => {
      while (rows.length <= r0 + i) rows.push(rows[0].map(() => ''));
      br.forEach((v, j) => { rows[r0 + i][c0 + j] = v; });
    });
    draw([r0, c0]);
    toast(`${block.length} baris ditempel`);
  });
}

// ---------- Tempel dari Claude ----------

function renderPaste() {
  releaseUrls();
  view().innerHTML = `
    <div class="topbar"><a href="#/baru" class="iconbtn" aria-label="Kembali">‹</a><span class="grow title">Tempel dari Claude</span></div>
    <div class="paste">
      <ol class="steps">
        <li>Di akhir obrolan dengan Claude, kirim prompt rangkuman ini supaya hasilnya rapi. <button type="button" class="btn small ghost" id="copyprompt">📋 Salin prompt</button></li>
        <li>Di aplikasi Claude, ketuk <b>Salin</b> (Copy) di bawah jawabannya.</li>
        <li>Kembali ke sini dan tempel. Jawaban biasa tanpa format juga bisa.</li>
      </ol>
      <div class="row"><button type="button" class="btn" id="pastebtn">📥 Tempel</button><span class="hint grow">atau tahan lalu pilih Tempel di kotak bawah</span></div>
      <textarea id="p-text" class="paste-box" placeholder="Tempel jawaban Claude di sini…"></textarea>
      <div id="p-preview" class="paste-preview hidden"></div>
      <p class="hint">🔒 Periksa lagi isinya. Jawaban AI bisa keliru, cocokkan dengan guideline atau buku sebelum dipakai.</p>
      <button type="button" class="btn" id="p-next" disabled>Lanjut ke editor</button>
    </div>`;
  const box = $('#p-text');
  let parsed = null;
  const update = () => {
    const raw = box.value;
    parsed = raw.trim() ? parseClaude(raw, { knownStase: allStase() }) : null;
    $('#p-next').disabled = !parsed;
    const pv = $('#p-preview');
    pv.classList.toggle('hidden', !parsed);
    if (!parsed) return;
    const t = TYPES[parsed.type] || TYPES.bebas;
    pv.innerHTML = `<div class="pv-title">${t.icon} ${esc(parsed.title || '(tanpa judul)')}</div>
      <div class="pv-meta">${esc(t.label)}${parsed.stase ? ' · ' + esc(parsed.stase) : ''} · ${parsed.tags.map((x) => '#' + esc(x)).join(' ')}</div>
      <div class="pv-meta">${parsed.body.split('\n').filter((l) => /:$/.test(l.trim())).length} bagian · ${parsed.sources.length} sumber</div>`;
  };
  box.addEventListener('input', update);
  $('#pastebtn').onclick = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt.trim()) { toast('Clipboard kosong. Salin jawaban Claude dulu.'); return; }
      box.value = txt;
      update();
    } catch {
      box.focus();
      toast('Tahan di kotak teks lalu pilih Tempel', 3500);
    }
  };
  $('#copyprompt').onclick = async () => {
    try { await navigator.clipboard.writeText(CLAUDE_PROMPT); toast('Prompt disalin. Tempel di obrolan Claude.'); }
    catch { box.value = CLAUDE_PROMPT; box.select(); toast('Salin teks prompt dari kotak, lalu hapus'); }
  };
  $('#p-next').onclick = () => {
    if (!parsed) return;
    state.draft = parsed;
    location.hash = '#/baru/' + parsed.type;
  };
}

async function renderEditor(id, type) {
  releaseUrls();
  const existing = id ? state.notes.get(id) : null;
  if (id && !existing) { location.hash = '#/'; return; }
  const draft = !existing && state.draft;
  state.draft = null;
  const note = existing
    ? { ...existing, tags: [...existing.tags] }
    : draft ? { id: uid(), type: draft.type, title: draft.title, body: draft.body, tags: draft.tags, stase: draft.stase, pinned: false, created: Date.now(), updated: Date.now() }
    : { id: uid(), type: type || 'bebas', title: '', body: TYPES[type || 'bebas'].template, tags: [], stase: state.filterStase || '', pinned: false, created: Date.now(), updated: Date.now() };
  // Blob tidak dimuat di sini agar membuka editor tetap cepat walau lampirannya besar.
  const all = existing ? currentAndArchived(existing) : { current: [], archived: [] };
  const media = all.current.map((m) => ({ ...m, isNew: false, dirty: false }));
  state.editor = { note, media, archived: all.archived.map((m) => m.id), removed: [], dirty: !!draft, isNew: !existing };

  view().innerHTML = `
    <div class="topbar">
      <button class="iconbtn" id="cancel" aria-label="Batal">✕</button>
      <span class="grow title">${existing ? 'Ubah catatan' : draft ? 'Periksa hasil tempel' : 'Catatan baru'}</span>
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
      <div class="body-tools">
        <button type="button" class="btn small ghost" id="t-table">▦ Tabel</button>
        <label class="btn small ghost">📊 Impor tabel Excel / CSV<input type="file" id="f-table" accept=".csv,.tsv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
      </div>
      <textarea id="e-body" placeholder="Tulis catatan… Gunakan [[Judul catatan lain]] untuk menautkan.">${esc(note.body)}</textarea>
      ${note.type === 'kasus' ? '<p class="hint">🔒 Jangan tulis nama, No. RM, NIK, atau alamat pasien. Gunakan inisial dan usia.</p>' : ''}
      <h4 class="section">Lampiran</h4>
      <div class="attach-actions">
        <label class="btn ghost">📷 Foto / video<input type="file" id="f-visual" accept="image/*,video/*" multiple hidden></label>
        <button type="button" class="btn ghost" id="rec">🎙️ Rekam suara</button>
        <label class="btn ghost">📎 File audio<input type="file" id="f-audio" accept="audio/*" multiple hidden></label>
        <label class="btn ghost">📄 PDF / Word<input type="file" id="f-doc" accept="${DOC_ACCEPT}" multiple hidden></label>
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
  $('#f-doc').onchange = (e) => addFiles(e.target.files);
  $('#rec').onclick = startRecording;
  $('#t-table').onclick = () => editTableAtCursor();
  $('#f-table').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importTableFile(f); };
  body.addEventListener('paste', onBodyPaste);
  // Posisi kursor terakhir diingat, karena membuka pemilih file atau editor tabel membuat kotak teks kehilangan fokus.
  const remember = () => { if (state.editor) state.editor.caret = [body.selectionStart, body.selectionEnd]; };
  ['input', 'select', 'click', 'keyup', 'blur'].forEach((ev) => body.addEventListener(ev, remember));
  if (draft) toast('Periksa dan rapikan dulu, lalu ketuk Simpan', 3500);
  else if (state.editor.isNew) $('#e-title').focus();
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
    if (m.kind === 'doc') preview = `<span class="doc-icon d-${m.docType}">${DOC_LABEL[m.docType] || 'Dok'}</span>`;
    else if (m.blob || m.thumb) {
      if (m.kind === 'image') preview = `<img src="${objUrl(m.thumb || m.blob)}" alt="">`;
      else if (m.kind === 'video') preview = `<video src="${objUrl(m.blob)}" muted playsinline preload="metadata"></video>`;
      else preview = `<audio src="${objUrl(m.blob)}" controls preload="metadata"></audio>`;
    } else {
      preview = `<span class="e-load" data-id="${m.id}">${KIND_ICON[m.kind]}</span>`;
    }
    row.innerHTML = `
      <div class="e-prev ${m.kind}">${preview}</div>
      <div class="e-info">
        <input placeholder="Keterangan (ikut dicari), mis. EKG ST elevasi V1-V4" value="${esc(m.caption || '')}">
        <small>${m.kind === 'doc' ? `${esc(m.name)} · ${m.pageCount ? m.pageCount + ' ' + pageUnit(m) + ' · ' : ''}` : m.kind === 'image' ? 'Foto · ' : m.kind === 'video' ? 'Video · ' : 'Audio · '}${fmtSize(m.size)}${m.kind === 'doc' && m.docType !== 'other' && !(m.docPages || []).join('').trim() ? ' · isi tidak terbaca' : ''}</small>
      </div>
      <button type="button" class="iconbtn" aria-label="Hapus lampiran">🗑️</button>`;
    row.querySelector('input').oninput = (e) => { m.caption = e.target.value; m.dirty = true; state.editor.dirty = true; };
    row.querySelector('button').onclick = () => {
      if (!m.isNew) {
        state.editor.removed.push(m.id, ...olderVersions(m.id).map((v) => v.id));
        state.editor.archived = state.editor.archived.filter((id) => !state.editor.removed.includes(id));
      }
      state.editor.media.splice(i, 1);
      state.editor.dirty = true;
      renderEditorMedia();
    };
    box.appendChild(row);
  });
  box.querySelectorAll('.e-load').forEach(async (el) => {
    const m = await db.getMedia(el.dataset.id);
    if (!m || !el.isConnected) return;
    if (m.kind === 'image') el.outerHTML = `<img src="${objUrl(m.thumb || m.blob)}" alt="">`;
    else if (m.kind === 'video') el.outerHTML = `<video src="${objUrl(m.blob)}" muted playsinline preload="metadata"></video>`;
    else el.outerHTML = `<audio src="${objUrl(m.blob)}" controls preload="metadata"></audio>`;
  });
}

function currentAndArchived(note) {
  const all = note.mediaIds.map((id) => state.mediaMeta.get(id)).filter(Boolean);
  return { current: all.filter((m) => !m.supersededBy), archived: all.filter((m) => m.supersededBy) };
}

// Versi-versi lama sebuah dokumen, terbaru dulu.
function olderVersions(id) {
  const out = [];
  let cur = id;
  for (;;) {
    const prev = [...state.mediaMeta.values()].find((m) => m.supersededBy === cur);
    if (!prev) return out;
    out.push(prev);
    cur = prev.id;
  }
}

async function buildDocMedia(file, docType, noteId) {
  const label = DOC_LABEL[docType];
  toast(`Membaca isi ${label}: ${file.name}…`, 60000);
  const ex = await extractDocument(file, docType, (i, total) => {
    if (i % 5 === 0 || i === total) toast(`Membaca ${file.name}: hal. ${i}/${total}`, 60000);
  });
  if (ex.error) toast(`${file.name} disimpan utuh, tapi isinya tidak bisa dibaca untuk pencarian.`, 5000);
  return {
    id: uid(), noteId, kind: 'doc', docType, name: file.name,
    mime: file.type || 'application/octet-stream', size: file.size, caption: '',
    blob: file, thumb: ex.thumb || null, hasThumb: !!ex.thumb,
    docPages: ex.pages, pageCount: ex.pageCount, created: Date.now(), isNew: true,
  };
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
    const docType = docTypeOf(f);
    const kind = docType ? 'doc' : f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : null;
    if (!kind) { toast('Jenis file tidak didukung: ' + f.name); continue; }
    if (kind === 'doc') {
      state.editor.media.push(await buildDocMedia(f, docType, state.editor.note.id));
      continue;
    }
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
  n.mediaIds = [...ed.media.map((m) => m.id), ...ed.archived];
  state.notes.set(n.id, n);
  indexNote(n);
  state.editor = null;
  requestPersistence();
  toast('Tersimpan');
  scheduleSync();
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
  const syncHtml = await syncSectionHtml();
  // Halaman ini dirender asinkron; jangan menimpa tampilan lain bila pengguna sudah pindah.
  if (location.hash !== '#/pengaturan') return;
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
      ${syncHtml}
      <section>
        <h4>Backup</h4>
        <p>Terakhir: <b>${lastBackup ? fmtDate(lastBackup) : 'belum pernah'}</b>. Simpan file backup ke laptop, iCloud Drive, atau hard disk. File berisi catatan (juga dalam format Markdown, bisa dibuka di Obsidian) dan semua media.</p>
        <div class="row"><button class="btn" id="export">⬇️ Buat backup</button><label class="btn ghost">⬆️ Pulihkan dari backup<input type="file" id="import" accept=".zip,application/zip" hidden></label></div>
      </section>
      <section>
        <h4>Privasi pasien</h4>
        <p>Data tersimpan di perangkat ini. Jika sinkron aktif, salinannya dienkripsi dengan kata sandi sinkronmu sebelum disimpan di Google Drive, sehingga Google tidak bisa membaca isinya. Tetap hindari menyimpan nama, No. RM, NIK, alamat, atau wajah pasien. Minta izin sebelum memotret atau merekam, dan ikuti aturan rumah sakit.</p>
      </section>
      <section>
        <h4>Tentang</h4>
        <p>Catatan Koas versi ${APP_VERSION} · ${navigator.onLine ? 'online' : 'offline'} · siap dipakai tanpa internet setelah dibuka sekali.</p>
      </section>
    </div>`;
  bindSyncSection();
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
    const manifest = await entryBlob(files.get('catatan-koas.json'));
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
      const blob = await entryBlob(files.get(m.path));
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
    scheduleSync();
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
    case 'tempel': return renderPaste();
    case 'alat': return arg === 'bmi' ? renderBmi() : renderTools();
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


// ---------- Sinkronisasi Google Drive ----------

let syncing = false;
let syncTimer = null;

async function addTombstone(id) {
  const list = (await db.getMeta('tombstones')) || [];
  list.push({ id, at: Date.now() });
  await db.setMeta('tombstones', list);
}

async function reloadAll() {
  state.notes.clear();
  state.mediaMeta.clear();
  state.index = new SearchIndex();
  await loadAll();
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => runSync(), 4000);
}

async function updateSyncBadge(status) {
  const btn = $('#syncbtn');
  if (!btn) return;
  const enabled = await db.getMeta('syncEnabled');
  btn.classList.toggle('hidden', !enabled);
  if (!enabled) return;
  if (!status) status = (await sync.getToken()) ? 'ok' : 'pending';
  btn.dataset.status = status;
  btn.title = { ok: 'Sinkron', busy: 'Sedang sinkron…', pending: 'Ketuk untuk sinkron', error: 'Sinkron gagal, ketuk untuk coba lagi' }[status];
}

async function runSync({ manual = false } = {}) {
  if (syncing || !(await db.getMeta('syncEnabled'))) return;
  if (state.editor) { if (manual) toast('Simpan catatan dulu, lalu sinkron.'); else scheduleSync(); return; }
  if (!navigator.onLine) { if (manual) toast('Tidak ada internet. Sinkron otomatis saat online lagi.'); return; }
  if (!(await sync.getToken())) {
    await updateSyncBadge('pending');
    if (manual) { await db.setMeta('syncAfterAuth', true); await sync.startAuth(); }
    return;
  }
  syncing = true;
  await updateSyncBadge('busy');
  try {
    const st = await sync.syncNow((t) => { if (manual && t) toast(t, 60000); });
    if (st.down || st.deleted) {
      await reloadAll();
      if (!state.editor && !document.querySelector('.docviewer')) route();
    }
    await updateSyncBadge('ok');
    if (manual) {
      const parts = [];
      if (st.up) parts.push(`${st.up} terkirim`);
      if (st.down) parts.push(`${st.down} diterima`);
      if (st.deleted) parts.push(`${st.deleted} dihapus`);
      toast(parts.length ? 'Sinkron selesai: ' + parts.join(', ') : 'Sudah sinkron');
    }
    if (location.hash === '#/pengaturan' && !state.editor) renderSettings();
  } catch (e) {
    console.error(e);
    if (e instanceof sync.AuthError) {
      await updateSyncBadge('pending');
      if (manual) { await db.setMeta('syncAfterAuth', true); await sync.startAuth(); }
    } else {
      await updateSyncBadge('error');
      if (manual) toast('Sinkron gagal: ' + (e?.message || e), 6000);
    }
  } finally {
    syncing = false;
  }
}

async function syncSectionHtml() {
  const clientId = await sync.getClientId();
  const enabled = await db.getMeta('syncEnabled');
  const key = await sync.getKey();
  const token = await sync.getToken();
  const last = await db.getMeta('lastSync');
  let inner;
  if (!clientId) {
    inner = `
      <p>Agar catatan di iPhone dan laptop otomatis sama, sambungkan ke Google Drive. Isinya dienkripsi dengan kata sandimu sebelum diunggah.</p>
      <p>Langkah awal: tempel <b>Client ID Google</b> dari panduan Claude.</p>
      <div class="row"><input id="g-client" class="field" placeholder="xxxx.apps.googleusercontent.com" autocapitalize="off" spellcheck="false"><button class="btn" id="g-client-save">Simpan</button></div>`;
  } else if (enabled && key) {
    inner = `
      <p>Tersambung ke Google Drive. Terakhir sinkron: <b>${last ? new Date(last).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'belum pernah'}</b>.</p>
      <p>Sinkron berjalan otomatis saat aplikasi dibuka dan setelah kamu menyimpan. Jika login Google sudah kedaluwarsa (setiap sekitar 1 jam), ketuk tombol di bawah atau ikon ⟳ di atas.</p>
      <div class="row"><button class="btn" id="g-sync">⟳ Sinkron sekarang</button><button class="btn ghost" id="g-off">Putuskan</button></div>`;
  } else if (!token) {
    inner = `
      <p>Sambungkan ke Google Drive agar catatan, foto, dan dokumen sama di semua perangkat. Data disimpan di folder aplikasi tersembunyi di Drive-mu, terenkripsi.</p>
      <div class="row"><button class="btn" id="g-connect">Hubungkan Google Drive</button></div>
      <details><summary>Ganti Client ID</summary><div class="row"><input id="g-client" class="field" value="${esc(clientId)}" autocapitalize="off" spellcheck="false"><button class="btn ghost" id="g-client-save">Simpan</button></div></details>`;
  } else {
    let hasRemote = null;
    try { hasRemote = await sync.remoteHasPassword(token); } catch (e) { hasRemote = null; }
    inner = hasRemote === null
      ? `<p>Google Drive tidak bisa dihubungi. Periksa internet lalu buka halaman ini lagi.</p>`
      : hasRemote
        ? `<p>Drive ini sudah dipakai perangkat lain. Masukkan <b>kata sandi sinkron</b> yang kamu buat di sana.</p>
           <div class="row"><input id="g-pass" class="field" type="password" placeholder="Kata sandi sinkron" autocomplete="current-password"><button class="btn" id="g-pass-save">Sambungkan</button></div>`
        : `<p>Buat <b>kata sandi sinkron</b> (minimal 8 karakter). Kata sandi ini mengenkripsi catatanmu di Drive dan diperlukan saat menyambungkan perangkat lain. Jika lupa, data di Drive tidak bisa dibuka, tapi data di perangkat tetap aman.</p>
           <div class="row"><input id="g-pass" class="field" type="password" placeholder="Kata sandi baru" autocomplete="new-password"><input id="g-pass2" class="field" type="password" placeholder="Ulangi kata sandi" autocomplete="new-password"><button class="btn" id="g-pass-save">Buat & sinkron</button></div>`;
  }
  return `<section class="sync"><h4>Sinkron iPhone & laptop (Google Drive)</h4>${inner}<p class="sync-status" id="g-status"></p></section>`;
}

function bindSyncSection() {
  const status = (t) => { const el = $('#g-status'); if (el) el.textContent = t; };
  $('#g-client-save') && ($('#g-client-save').onclick = async () => {
    const v = $('#g-client').value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) { toast('Client ID biasanya berakhiran .apps.googleusercontent.com'); return; }
    await db.setMeta('gClientId', v);
    renderSettings();
  });
  $('#g-connect') && ($('#g-connect').onclick = () => sync.startAuth().catch((e) => toast(e.message)));
  $('#g-sync') && ($('#g-sync').onclick = () => runSync({ manual: true }));
  $('#g-off') && ($('#g-off').onclick = async () => {
    if (!confirm('Putuskan sinkronisasi di perangkat ini? Catatan di perangkat dan di Drive tetap ada.')) return;
    await sync.disconnect();
    await updateSyncBadge();
    renderSettings();
  });
  $('#g-pass-save') && ($('#g-pass-save').onclick = async () => {
    const pass = $('#g-pass').value;
    const pass2 = $('#g-pass2');
    if (pass.length < 8) { toast('Kata sandi minimal 8 karakter'); return; }
    if (pass2 && pass2.value !== pass) { toast('Kedua kata sandi tidak sama'); return; }
    const btn = $('#g-pass-save');
    btn.disabled = true;
    status('Menyiapkan enkripsi…');
    try {
      const token = await sync.getToken();
      if (!token) throw new sync.AuthError('Login Google kedaluwarsa');
      await sync.setupPassword(token, pass);
      await db.setMeta('syncEnabled', true);
      await updateSyncBadge();
      status('');
      await runSync({ manual: true });
      renderSettings();
    } catch (e) {
      status('');
      btn.disabled = false;
      if (e instanceof sync.AuthError) { toast('Login Google kedaluwarsa, hubungkan lagi.'); renderSettings(); }
      else toast(e?.message || String(e), 5000);
    }
  });
}

function updateOnline() {
  $('#net').textContent = navigator.onLine ? '' : 'offline';
  $('#net').classList.toggle('hidden', navigator.onLine);
}

async function start() {
  let authResult = null;
  try {
    authResult = await sync.handleAuthRedirect();
  } catch (e) {
    authResult = 'Login Google gagal: ' + (e?.message || e);
  }
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
  await updateSyncBadge();
  $('#syncbtn').onclick = () => runSync({ manual: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runSync(); });
  window.addEventListener('online', () => runSync());
  if (authResult === 'ok') {
    if (await db.getMeta('syncAfterAuth')) {
      await db.setMeta('syncAfterAuth', false);
      runSync({ manual: true });
    } else {
      toast('Google Drive tersambung');
    }
  } else if (authResult) {
    toast(authResult, 6000);
  } else {
    runSync();
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
