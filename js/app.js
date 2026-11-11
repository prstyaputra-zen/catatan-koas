import { db } from './db.js';
import { SearchIndex, normalize, tokenize } from './search.js';
import { createZip, readZip, entryBlob } from './zip.js';
import * as sync from './sync.js';
import { parseClaude, CLAUDE_PROMPT } from './paste.js';
import { BMI_SYSTEMS, parseNum, computeBmi, brocaStatus, fmtKg, bmiSummaryText, fmtNum, fmtTablets, PUYER_DRUGS, computePuyer, puyerRecipe, puyerSummaryText, computeFluid, fluidSummaryText, FLUID_CAP_DAY } from './tools.js';
import { splitBlocks, toMarkdown, tableAt, fromCsv, fromDelimited, looksTabular, tablesFromHtml, readXlsx, convertTabRuns } from './table.js';
import { icon } from './icons.js';
import { DOC_ACCEPT, DOC_LABEL, docTypeOf, extractDocument, openPdf, closePdf, pageMatchRects, renderPdfPageToBlob, extractDocImages } from './docs.js';

const APP_VERSION = '0.16.0';

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
  draft: null,
  anchor: null,           // kunci judul bagian yang dibawa saat berpindah mode Baca/Ubah
  noteNav: null,          // fungsi penyegar daftar isi & rujukan catatan yang sedang dibuka
  filterFresh: false,     // hanya tampilkan catatan "auto updates"
  feedUnread: new Set(),  // id catatan auto updates yang belum dibuka di perangkat ini // catatan hasil "Tempel dari Claude" yang menunggu dibuka di editor
};

const $ = (sel, root = document) => root.querySelector(sel);
const view = () => $('#view');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Waktu ubah selalu maju. Sinkron memakai "yang terbaru menang"; bila jam perangkat lebih lambat dari waktu
// ubah sebelumnya (mis. catatan feed bertanggal di depan), perubahan seperti sematan tidak boleh kalah.
function touch(note) {
  note.updated = Math.max(Date.now(), (note.updated || 0) + 1);
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
    body: plainBody(note.body),
    doc: media.filter((m) => m.kind === 'doc').map((m) => (m.docPages || []).join('\n')).join('\n'),
  });
}

const KIND_ICON = { image: '🖼️', video: '🎬', audio: '🎙️', doc: '📄' };

// Gambar di dalam teks catatan ditulis sebagai ![keterangan](img:<id lampiran>) pada barisnya sendiri.
const IMG_LINE = /^\s*!\[([^\]]*)\]\(img:([\w-]+)\)\s*$/;
const IMG_REF_G = /!\[([^\]]*)\]\(img:([\w-]+)\)/g;
const inlineImageIds = (body) => new Set([...(body || '').matchAll(IMG_REF_G)].map((x) => x[2]));
const plainBody = (body) => (body || '').replace(IMG_REF_G, '$1');

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
    if (migrateFeedTag(n)) { const { mediaIds, ...stored } = n; db.saveNote(stored); }
    state.notes.set(n.id, n);
    indexNote(n);
  });
  state.feedUnread = new Set(((await db.getMeta('feedUnread')) || []).filter((id) => state.notes.has(id)));
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
  const text = stripFormat(plainBody(body)).replace(/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/gm, '').replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, '').replace(/[ \t]*(?<!\\)\|[ \t]*/g, ' · ').replace(/(\s*·)+\s/g, ' · ').replace(/\s+/g, ' ').trim();
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

// Penanda format (**tebal**, *miring*, ~~coret~~, # judul) dibuang untuk cuplikan daftar.
const stripFormat = (t) => t.replace(/^#{1,3}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/~~(.+?)~~/g, '$1').replace(/(^|[^*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])/g, '$1$2');

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
  h = h.replace(/~~(.+?)~~/g, '<s>$1</s>');
  h = h.replace(/(^|[^*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])/g, '$1<em>$2</em>');
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

// Judul bagian yang bisa dilipat: "# Judul" (1), "## Judul" (2), "### Judul" (3),
// atau baris label tanpa isi seperti "Tatalaksana:" (2). Label yang langsung berisi ("Dosis: 500 mg") bukan judul.
function headingOf(line) {
  const t = line.trim();
  const md = t.match(/^(#{1,3})\s+(.+?)\s*#*$/);
  if (md) return { level: md[1].length, text: md[2].replace(/:$/, '').trim() };
  if (/^[^:\-•*|#!\[]{1,60}:$/.test(t)) return { level: 2, text: t.slice(0, -1).trim() };
  return null;
}
const headingKey = (h) => h.text.toLowerCase().replace(/\*\*/g, '').replace(/\s+/g, ' ');

// Judul ditampilkan sesuai EYD: huruf pertama setiap kata kapital, kecuali kata tugas yang tidak di awal.
// Hanya kata yang seluruhnya huruf kecil yang diubah, jadi singkatan (eGFR, pH, MgSO4, kgBB) tetap utuh.
// Teks aslinya tidak diubah; ini hanya tampilan.
const KATA_TUGAS = new Set(('di ke dari dan yang untuk pada dengan atau dalam oleh bagi tentang sebagai terhadap antara '
  + 'tanpa serta per kepada daripada akan agar karena sejak hingga sampai menurut melalui bila jika apabila maupun '
  + 'namun tetapi atas demi para si sang setelah sebelum saat ketika seperti secara pun').split(' '));
const KATA_INGGRIS = new Set('of the and or in on for to with by at vs'.split(' '));
const KATA_TETAP = new Set('dll dsb dkk et al sp spp mg mcg kg ml dl cm mm'.split(' ')); // singkatan/satuan huruf kecil
function judulEYD(text) {
  return String(text).split(/(https?:\/\/\S+)/).map((part, i) => {
    if (i % 2) return part; // tautan dibiarkan apa adanya
    let start = i === 0;
    return part.replace(/(:\s*)|([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’]*)/g, (m, colon, w, off, s) => {
      if (colon) { start = true; return m; }
      const first = start;
      start = false;
      const prev = s[off - 1];
      if (prev && /[\p{N}.]/u.test(prev)) return w; // 2x, i.v.
      const low = w.toLowerCase();
      if (!first && KATA_TUGAS.has(low) && (w === low || w === low[0].toUpperCase() + low.slice(1))) return low;
      if (w !== low || w.length < 2 || KATA_TETAP.has(w) || (!first && KATA_INGGRIS.has(w))) return w;
      return w[0].toUpperCase() + w.slice(1);
    });
  }).join('');
}

// Bagian yang dilipat diingat per catatan di perangkat ini.
const foldKey = (id) => 'ck-fold:' + id;
function loadFolds(id) {
  try { return new Set(JSON.parse(localStorage.getItem(foldKey(id)) || '[]')); } catch { return new Set(); }
}
function saveFolds(id, set) {
  try { set.size ? localStorage.setItem(foldKey(id), JSON.stringify([...set])) : localStorage.removeItem(foldKey(id)); } catch { /* penyimpanan diblokir */ }
}

// Lebar indentasi awal baris; tab dihitung 2 spasi, sama dengan satu langkah indentasi di editor.
const listIndent = (ws) => ws.replace(/\t/g, '  ').length;

function renderBody(body, terms, type, folds = null) {
  let html = '';
  const stack = [];
  const seen = new Map();
  const close = (level) => { while (stack.length && stack[stack.length - 1] >= level) { html += '</div></details>'; stack.pop(); } };
  for (const block of splitBlocks(visibleBody(body, type))) {
    if (block.type === 'table') { html += tableHtml(block.rows, block.header, terms); continue; }
    // Daftar bertingkat: indentasi (spasi atau tab) lebih dalam dari poin sebelumnya menjadi sub-poin.
    const lists = [];
    const endLists = () => { while (lists.length) { html += '</li></ul>'; lists.pop(); } };
    for (const raw of block.lines) {
      const hd = headingOf(raw);
      if (hd) {
        endLists();
        close(hd.level);
        let key = headingKey(hd);
        const n = (seen.get(key) || 0) + 1;
        seen.set(key, n);
        if (n > 1) key += '#' + n;
        const open = !(folds && folds.has(key));
        html += `<details class="sec lv-${hd.level}" data-key="${esc(key)}"${open ? ' open' : ''}><summary><span class="chev" aria-hidden="true">${icon('chevron')}</span><span class="sec-title" role="heading" aria-level="${hd.level + 1}">${inlineHtml(judulEYD(hd.text), terms)}</span></summary><div class="sec-body">`;
        stack.push(hd.level);
        continue;
      }
      const img = raw.match(IMG_LINE);
      if (img) {
        endLists();
        html += `<figure class="inline-img" data-mid="${esc(img[2])}"><span class="img-ph">🖼️</span>${img[1].trim() ? `<figcaption>${inlineHtml(img[1], terms)}</figcaption>` : ''}</figure>`;
        continue;
      }
      const listItem = raw.match(/^([ \t]*)[-*•]\s+(.*)$/);
      if (listItem) {
        const indent = listIndent(listItem[1]);
        while (lists.length > 1 && indent < lists[lists.length - 1]) {
          // Indentasi di antara dua tingkat (tidak rata) dianggap setingkat dengan poin terdalam.
          if (indent > lists[lists.length - 2]) { lists[lists.length - 1] = indent; break; }
          html += '</li></ul>';
          lists.pop();
        }
        if (!lists.length || indent > lists[lists.length - 1]) { html += `<ul class="lv-${Math.min(lists.length, 2)}"><li>`; lists.push(indent); }
        else html += '</li><li>';
        html += inlineHtml(listItem[2], terms);
        continue;
      }
      endLists();
      let h = inlineHtml(raw, terms);
      const label = h.match(/^([^:<]{1,60}):(.*)$/);
      if (label) h = `<span class="label">${label[1]}:</span>${label[2]}`;
      html += h.trim() ? `<p>${h}</p>` : '<div class="gap"></div>';
    }
    endLists();
  }
  close(0);
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
        ${hasFreshNotes() ? `<button class="chip fresh-chip ${state.filterFresh ? 'on' : ''}" data-fresh>✨ Auto updates${state.feedUnread.size ? ` <b class="dot-count">${state.feedUnread.size}</b>` : ''}</button>` : ''}
        <button class="chip ${state.filterType === '' ? 'on' : ''}" data-type="">Semua</button>
        ${Object.entries(TYPES).map(([k, t]) => `<button class="chip ${state.filterType === k ? 'on' : ''}" data-type="${k}">${t.icon} ${t.label}</button>`).join('')}
        <select id="stasefilter" class="chip ${state.filterStase ? 'on' : ''}" aria-label="Filter stase">
          <option value="">Semua stase</option>
          ${allStase().map((s) => `<option ${s === state.filterStase ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="results" class="results"></div>
    <a href="#/baru" class="fab" aria-label="Catatan baru" title="Catatan baru">${icon('plus')}</a>`;
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
  const freshChip = view().querySelector('[data-fresh]');
  if (freshChip) freshChip.onclick = () => { state.filterFresh = !state.filterFresh; freshChip.classList.toggle('on', state.filterFresh); renderResults(); };
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
  if (state.filterFresh) items = items.filter(isFreshNote).sort((a, b) => b.created - a.created);
  if (state.filterType) items = items.filter((n) => n.type === state.filterType);
  if (state.filterStase) items = items.filter((n) => n.stase === state.filterStase);
  const ms = performance.now() - started;

  if (!state.notes.size) {
    box.innerHTML = `
      <div class="empty">
        <div class="big">🩺</div>
        <h2>Belum Ada Catatan</h2>
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
    <a class="card ${state.feedUnread.has(n.id) ? 'unread' : ''}" href="#/catatan/${n.id}">
      <div class="card-main">
        <div class="card-top"><span class="badge t-${n.type}">${t.icon} ${t.label}</span>${n.stase ? `<span class="badge">${esc(n.stase)}</span>` : ''}${n.pinned ? '<span class="pin">📌</span>' : ''}</div>
        <h3>${highlight(n.title ? judulEYD(n.title) : '(tanpa judul)', terms)}</h3>
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
  if (state.feedUnread.delete(id)) db.setMeta('feedUnread', [...state.feedUnread]);
  const t = TYPES[n.type] || TYPES.bebas;
  const terms = state.query.trim() ? state.index.search(state.query).terms : null;
  const folds = loadFolds(n.id);
  view().innerHTML = `
    <div class="topbar">
      <a href="#/" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a>
      <span class="grow crumb">${t.icon} ${esc(n.title ? judulEYD(n.title) : '(tanpa judul)')}</span>
      <button class="iconbtn" id="foldall" aria-label="Lipat semua bagian" title="Lipat / buka semua bagian">${icon('collapse')}</button>
      <button class="iconbtn pinbtn ${n.pinned ? 'on' : ''}" id="pin" aria-label="Sematkan di atas daftar" aria-pressed="${!!n.pinned}" title="Sematkan">${icon('pin')}</button>
    </div>
    <div class="note-find hidden" id="nf">
      <input id="nf-q" type="search" placeholder="Cari di catatan ini" aria-label="Cari di catatan ini" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      <span class="dv-count" id="nf-count"></span>
      <button class="iconbtn" data-nf="prev" aria-label="Hasil sebelumnya">${icon('up')}</button>
      <button class="iconbtn" data-nf="next" aria-label="Hasil berikutnya">${icon('down')}</button>
      <button class="iconbtn" data-nf="close" aria-label="Tutup pencarian">${icon('x')}</button>
    </div>
    <article class="note">
      <div class="page-icon" aria-hidden="true">${t.icon}</div>
      <h1>${highlight(n.title ? judulEYD(n.title) : '(tanpa judul)', terms)}</h1>
      <dl class="props">
        <div><dt>Jenis</dt><dd><span class="badge t-${n.type}">${t.label}</span></dd></div>
        ${n.stase ? `<div><dt>Stase</dt><dd>${esc(n.stase)}</dd></div>` : ''}
        ${n.tags.length ? `<div><dt>Tag</dt><dd class="tags">${n.tags.map((x) => `<a class="tag" href="#/cari/${encodeURIComponent(x)}">#${esc(x)}</a>`).join('')}</dd></div>` : ''}
        <div><dt>Diubah</dt><dd>${fmtDate(n.updated)} <span class="muted">· dibuat ${fmtDate(n.created)}</span></dd></div>
      </dl>
      ${n.id.startsWith('ilmu-') ? '<p class="fresh-note">✨ Dirangkum otomatis oleh Claude dari sumber di kartu Rujukan. Cocokkan dengan sumber aslinya sebelum dipakai untuk pasien.</p>' : ''}
      <nav class="toc-card hidden" id="toc-inline" aria-label="Daftar isi"></nav>
      <section class="ref-card hidden" id="refs" aria-labelledby="refs-title"></section>
      <div class="body">${renderBody(n.body, terms, n.type, folds)}</div>
      <div id="gallery" class="gallery"></div>
      ${relatedHtml(n)}
      <button class="btn danger ghost" id="del">${icon('trash')} Hapus catatan</button>
      <div class="note-fabs">
        <button class="mini-fab hidden" id="totop" aria-label="Kembali ke atas" title="Ke atas">${icon('up')}</button>
        <button class="mini-fab hidden" id="tocbtn" aria-label="Daftar Isi" title="Daftar Isi" aria-haspopup="dialog">${icon('toc')}</button>
        <button class="mini-fab" id="findbtn" aria-label="Cari di catatan ini" title="Cari di catatan ini">${icon('search')}</button>
      </div>
    </article>
    <dialog class="sheet" id="sheet" aria-labelledby="sheet-title">
      <div class="sheet-head"><h2 id="sheet-title"></h2><button type="button" class="iconbtn" data-close aria-label="Tutup">${icon('x')}</button></div>
      <div class="sheet-body"></div>
    </dialog>
    ${modeBarHtml('read')}`;
  $('#pin').onclick = async () => {
    n.pinned = !n.pinned;
    touch(n);
    const { mediaIds, ...stored } = n;
    await db.saveNote(stored);
    scheduleSync();
    $('#pin').classList.toggle('on', n.pinned);
    $('#pin').setAttribute('aria-pressed', String(n.pinned));
    toast(n.pinned ? 'Disematkan di atas daftar' : 'Sematan dilepas');
  };
  bindFolds(n, folds);
  state.noteNav = setupNoteNav(n);
  bindModeBar('read', n.id);
  restoreReadAnchor();
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
  hydrateInlineImages(view(), n);
  bindNoteFind(n, terms);
  const gallery = $('#gallery');
  const inline = inlineImageIds(n.body);
  for (const meta of currentMedia(n)) {
    if (inline.has(meta.id)) continue;
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

// Cari kata di dalam catatan yang sedang dibuka: sorot semua, lompat antar hasil.
function bindNoteFind(n, initialTerms) {
  const bar = $('#nf');
  const input = $('#nf-q');
  const countEl = $('#nf-count');
  const bodyEl = view().querySelector('.note .body');
  const titleEl = view().querySelector('.note h1');
  let marks = [];
  let cur = -1;
  const show = (i) => {
    if (!marks.length) { cur = -1; countEl.textContent = input.value.trim() ? 'Tidak ada' : ''; return; }
    cur = (i + marks.length) % marks.length;
    openAncestors(marks[cur]);
    marks.forEach((el, k) => el.classList.toggle('cur', k === cur));
    countEl.textContent = `${cur + 1}/${marks.length}`;
    marks[cur].scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const apply = (terms, jump = true) => {
    titleEl.innerHTML = highlight(n.title ? judulEYD(n.title) : '(tanpa judul)', terms);
    bodyEl.innerHTML = renderBody(n.body, terms, n.type, loadFolds(n.id));
    hydrateInlineImages(bodyEl, n);
    state.noteNav?.();
    marks = [...view().querySelectorAll('.note h1 mark, .note .body mark')];
    if (jump) show(0); else { cur = -1; countEl.textContent = marks.length ? `${marks.length} hasil` : ''; }
  };
  const open = () => { bar.classList.remove('hidden'); input.focus(); };
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => apply(termsForQuery(input.value)), 150); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); show(cur + (e.shiftKey ? -1 : 1)); }
    if (e.key === 'Escape') bar.querySelector('[data-nf="close"]').click();
  });
  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-nf]')?.dataset.nf;
    if (act === 'next') show(cur + 1);
    else if (act === 'prev') show(cur - 1);
    else if (act === 'close') { bar.classList.add('hidden'); input.value = ''; apply(new Set(), false); }
  });
  $('#findbtn').onclick = () => (bar.classList.contains('hidden') ? open() : input.focus());
  // Tombol ke atas muncul setelah layar digulir cukup jauh.
  const topBtn = $('#totop');
  topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const onScroll = () => {
    if (!document.body.contains(topBtn)) { window.removeEventListener('scroll', onScroll); return; }
    topBtn.classList.toggle('hidden', window.scrollY < 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  // Dibuka dari hasil pencarian: kata yang dicari sudah disorot, langsung tampilkan bilah cari.
  if (initialTerms && initialTerms.size && state.query.trim()) {
    bar.classList.remove('hidden');
    input.value = state.query;
    marks = [...view().querySelectorAll('.note h1 mark, .note .body mark')];
    countEl.textContent = marks.length ? `${marks.length} hasil` : '';
    if (marks.length) requestAnimationFrame(() => show(0));
  }
}

// ---------- Daftar isi dan rujukan ----------
// Bagian rujukan dikeluarkan dari alur baca dan dikumpulkan di kartu Rujukan di bawah Daftar Isi;
// tiap barisnya membuka lembar (show/hide).
const REF_SECTION = /^(daftar singkatan|singkatan|sumber|referensi|rujukan|daftar pustaka|guideline( terkait)?|pedoman terkait)$/i;
const TOC_MIN = 3;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tocOpenKey = 'ck-toc-open';

function openSheet(title, content) {
  const dlg = $('#sheet');
  if (!dlg) return;
  $('#sheet-title').textContent = title;
  const body = dlg.querySelector('.sheet-body');
  body.replaceChildren(...(typeof content === 'string' ? [] : [content]));
  if (typeof content === 'string') body.innerHTML = content;
  body.scrollTop = 0;
  if (!dlg.open) dlg.showModal();
  return dlg;
}

function closeSheet() {
  const dlg = $('#sheet');
  if (dlg?.open) dlg.close();
}

// Lompat ke judul bagian: buka bagian induk yang terlipat, gulir dengan memperhitungkan bilah yang menempel.
function jumpToSection(key) {
  const sec = [...view().querySelectorAll('.note .body details.sec')].find((d) => d.dataset.key === key);
  if (!sec) return;
  openAncestors(sec);
  const sum = sec.firstElementChild;
  const getTop = () => sum.getBoundingClientRect().top + window.scrollY - stickyBottom() - 8;
  sum.focus({ preventScroll: true });
  // Gambar yang baru termuat saat melintas menggeser posisi; setelah gulir halus selesai, sejajarkan ulang.
  if (reducedMotion()) { scrollToAnchor(getTop); return; }
  window.scrollTo({ top: Math.max(0, getTop()), behavior: 'smooth' });
  let settled = false;
  const settle = () => { if (!settled) { settled = true; scrollToAnchor(getTop); } };
  window.addEventListener('scrollend', settle, { once: true });
  setTimeout(settle, 900);
}

const refIcon = (title) => (/singkatan/i.test(title) ? 'abbr' : /guideline|pedoman/i.test(title) ? 'guide' : 'library');

function tocHtml(items, current) {
  return `<ol class="toc-list">${items.map((it) => `<li class="toc-l${it.level}"><button type="button" class="toc-link" data-key="${esc(it.key)}"${it.key === current ? ' aria-current="location"' : ''}>${esc(it.title)}</button></li>`).join('')}</ol>`;
}

// Dipanggil setiap kali isi catatan dirender ulang (mis. oleh pencarian di catatan).
function setupNoteNav(n) {
  const bodyEl = view().querySelector('.note .body');
  const refsEl = $('#refs');
  const inline = $('#toc-inline');
  const fab = $('#tocbtn');
  const dlg = $('#sheet');
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) { closeSheet(); return; }
    const link = e.target.closest('.toc-link');
    if (link) { closeSheet(); jumpToSection(link.dataset.key); }
  });
  inline.addEventListener('click', (e) => { const link = e.target.closest('.toc-link'); if (link) jumpToSection(link.dataset.key); });
  inline.addEventListener('toggle', (e) => { try { localStorage.setItem(tocOpenKey, e.target.open ? '1' : '0'); } catch { /* diblokir */ } }, true);
  let refs = [];
  refsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ref]');
    if (b) openSheet(refs[+b.dataset.ref].title, refs[+b.dataset.ref].node.cloneNode(true));
  });
  let items = [];
  fab.onclick = () => openSheet('Daftar Isi', tocHtml(items, readAnchor()));
  const refresh = () => {
    refs = [];
    for (const d of [...bodyEl.querySelectorAll('details.sec')]) {
      if (!d.isConnected) continue;
      const title = d.querySelector(':scope > summary .sec-title')?.textContent.trim() || '';
      if (!REF_SECTION.test(title)) continue;
      const node = d.querySelector(':scope > .sec-body');
      refs.push({ title, node, count: node.querySelectorAll(':scope > ul > li').length });
      d.remove();
    }
    refsEl.classList.toggle('hidden', !refs.length);
    refsEl.innerHTML = `<h2 class="ref-head" id="refs-title"><span class="toc-ic" aria-hidden="true">${icon('library')}</span>Rujukan</h2>`
      + '<ul class="ref-list">' + refs.map((r, i) => `<li><button type="button" class="ref-row" data-ref="${i}" aria-haspopup="dialog">`
      + `<span class="ref-ic" aria-hidden="true">${icon(refIcon(r.title))}</span>`
      + `<span class="ref-text"><span class="ref-name">${esc(r.title)}</span>${r.count ? `<span class="ref-sub">${r.count} butir</span>` : ''}</span>`
      + `<span class="ref-go" aria-hidden="true">${icon('chevron')}</span></button></li>`).join('') + '</ul>';
    items = [...bodyEl.querySelectorAll('details.sec')].map((d) => ({
      key: d.dataset.key,
      level: +(d.className.match(/lv-(\d)/)?.[1] || 2),
      title: d.querySelector(':scope > summary .sec-title').textContent.trim(),
    }));
    const show = items.length >= TOC_MIN;
    fab.classList.toggle('hidden', !show);
    inline.classList.toggle('hidden', !show);
    if (show) {
      let open = true;
      try { open = localStorage.getItem(tocOpenKey) !== '0'; } catch { /* diblokir */ }
      inline.innerHTML = `<details${open ? ' open' : ''}><summary><span class="toc-ic" aria-hidden="true">${icon('toc')}</span>Daftar Isi <span class="muted">· ${items.length} bagian</span></summary>${tocHtml(items)}</details>`;
    } else inline.innerHTML = '';
  };
  refresh();
  return refresh;
}

// ---------- Bagian yang bisa dilipat ----------

function openAncestors(el) {
  for (let d = el?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
}

function bindFolds(n, folds) {
  const body = view().querySelector('.note .body');
  const btn = $('#foldall');
  const secs = () => [...body.querySelectorAll('details.sec')];
  const sync = () => {
    const all = secs();
    btn.classList.toggle('hidden', !all.length);
    const anyOpen = all.some((d) => d.open);
    btn.innerHTML = icon(anyOpen ? 'collapse' : 'expand');
    btn.setAttribute('aria-label', anyOpen ? 'Lipat semua bagian' : 'Buka semua bagian');
  };
  // Hanya ketukan pengguna yang diingat; bagian yang dibuka otomatis oleh pencarian tidak mengubah simpanan.
  body.addEventListener('click', (e) => {
    const sum = e.target.closest('summary');
    if (!sum || e.target.closest('a')) return;
    const d = sum.parentElement;
    setTimeout(() => {
      d.open ? folds.delete(d.dataset.key) : folds.add(d.dataset.key);
      saveFolds(n.id, folds);
      sync();
    }, 0);
  });
  btn.onclick = () => {
    const all = secs();
    const close = all.some((d) => d.open);
    all.forEach((d) => { d.open = !close; close ? folds.add(d.dataset.key) : folds.delete(d.dataset.key); });
    saveFolds(n.id, folds);
    sync();
  };
  sync();
}

// ---------- Mode Baca / Ubah ----------
// Tombol mode selalu mengambang di bawah layar. Saat berpindah, posisi bagian yang sedang dibaca/ditulis dibawa ikut.

function modeBarHtml(mode) {
  const b = (m, ic, label) => `<button type="button" data-mode="${m}" aria-pressed="${mode === m}" title="${label} (Ctrl/⌘+E)">${icon(ic)}<span>${label}</span></button>`;
  return `<nav class="modebar" aria-label="Mode catatan">${b('read', 'read', 'Baca')}${b('edit', 'edit', 'Ubah')}</nav>`;
}

// Saat tidak dipakai, bilah menciut menjadi ikon mode aktif; ketuk, arahkan kursor, atau fokus keyboard untuk membukanya.
const MODEBAR_IDLE = 2500;
function bindModeBar(mode, id) {
  const bar = view().querySelector('.modebar');
  let timer;
  const collapse = () => { clearTimeout(timer); if (!bar.matches(':hover, :focus-within')) bar.classList.add('compact'); };
  let expandedAt = 0;
  const expand = () => { bar.classList.remove('compact'); expandedAt = Date.now(); clearTimeout(timer); timer = setTimeout(collapse, MODEBAR_IDLE); };
  bar.onclick = (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    if (bar.classList.contains('compact')) { expand(); return; }
    if (b.dataset.mode !== mode) switchMode();
    else expand();
  };
  bar.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') expand(); });
  bar.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') timer = setTimeout(collapse, 600); });
  bar.addEventListener('focusin', expand);
  bar.addEventListener('focusout', () => { timer = setTimeout(collapse, 600); });
  // Menggulir atau mengetik berarti pengguna sedang membaca/menulis: ciutkan agar tidak menutupi isi.
  const busy = () => {
    if (!bar.isConnected) { window.removeEventListener('scroll', busy); return; }
    // Gulir sisa (momentum) tepat setelah bilah diketuk tidak langsung menciutkannya lagi.
    if (!bar.classList.contains('compact') && Date.now() - expandedAt > 800) collapse();
  };
  window.addEventListener('scroll', busy, { passive: true });
  $('#e-body')?.addEventListener('input', busy);
  timer = setTimeout(collapse, MODEBAR_IDLE);
}

async function switchMode() {
  const editing = !!state.editor && !!$('#e-body');
  if (!editing) {
    const id = location.hash.split('/')[2];
    if (!id || !state.notes.has(id)) return;
    state.anchor = readAnchor();
    location.replace('#/ubah/' + id);
    return;
  }
  const ed = state.editor;
  const id = ed.note.id;
  const anchor = editAnchor();
  if (ed.dirty || ed.isNew) {
    if (!(await saveEditor(false))) { toast(ed.isNew ? 'Tulis sesuatu dulu sebelum membaca' : 'Belum bisa disimpan'); return; }
  } else {
    state.editor = null;
  }
  state.anchor = anchor;
  location.replace('#/catatan/' + id);
}

// Batas bawah bilah yang menempel di atas layar, untuk menghitung posisi baca.
function stickyBottom() {
  return Math.max(0, ...['.appbar', '#view .topbar', '#view .body-tools', '#nf:not(.hidden)'].map((sel) => $(sel)?.getBoundingClientRect().bottom || 0));
}

// Judul bagian terakhir yang sudah lewat di bagian atas layar (null = masih di awal catatan).
function readAnchor() {
  const limit = stickyBottom() + 24;
  let key = null;
  for (const d of view().querySelectorAll('.note .body details.sec')) {
    const r = d.firstElementChild.getBoundingClientRect();
    if (!r.height) continue; // di dalam bagian yang terlipat
    if (r.top <= limit) key = d.dataset.key; else break;
  }
  return key;
}

function scrollToAnchor(getTop) {
  let done = false;
  const stop = () => { done = true; };
  const align = () => { if (!done) { const y = getTop(); if (y != null) window.scrollTo(0, Math.max(0, y)); } };
  requestAnimationFrame(align);
  // Gambar yang termuat belakangan menggeser isi; sejajarkan lagi sampai pengguna mulai menggulir.
  ['touchstart', 'wheel', 'keydown'].forEach((ev) => window.addEventListener(ev, stop, { once: true, passive: true }));
  setTimeout(stop, 2000);
  view().addEventListener('load', align, true);
  setTimeout(() => view().removeEventListener('load', align, true), 2100);
}

function restoreReadAnchor() {
  const key = state.anchor;
  state.anchor = null;
  if (!key) return;
  const sec = [...view().querySelectorAll('.note .body details.sec')].find((d) => d.dataset.key === key);
  if (!sec) return;
  openAncestors(sec.parentElement);
  scrollToAnchor(() => sec.getBoundingClientRect().top + window.scrollY - stickyBottom() - 8);
}

// Judul bagian dari setiap baris teks editor, dengan kunci yang sama seperti tampilan baca.
function headingLines(text) {
  const seen = new Map();
  const out = [];
  text.split('\n').forEach((line, i) => {
    const h = headingOf(line);
    if (!h) return;
    let key = headingKey(h);
    const c = (seen.get(key) || 0) + 1;
    seen.set(key, c);
    if (c > 1) key += '#' + c;
    out.push({ i, key });
  });
  return out;
}

// Posisi atas setiap baris di dalam textarea (memperhitungkan baris yang terbungkus).
function textareaLineTops(ta) {
  const cs = getComputedStyle(ta);
  const m = document.createElement('div');
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'tabSize']) m.style[p] = cs[p];
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', width: ta.offsetWidth + 'px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', borderStyle: 'solid' });
  for (const line of ta.value.split('\n')) {
    const d = document.createElement('div');
    d.textContent = line || '​';
    m.appendChild(d);
  }
  document.body.appendChild(m);
  const tops = [...m.children].map((d) => d.offsetTop);
  m.remove();
  return tops;
}

function editAnchor() {
  const ta = $('#e-body');
  if (!ta) return null;
  let idx;
  if (document.activeElement === ta) {
    idx = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
  } else {
    const y = stickyBottom() + 12 - ta.getBoundingClientRect().top;
    if (y < 0) return null;
    const tops = textareaLineTops(ta);
    idx = 0;
    while (idx + 1 < tops.length && tops[idx + 1] <= y) idx++;
  }
  let key = null;
  for (const h of headingLines(ta.value)) { if (h.i <= idx) key = h.key; else break; }
  return key;
}

function restoreEditAnchor() {
  const key = state.anchor;
  state.anchor = null;
  const ta = $('#e-body');
  const h = key && ta && headingLines(ta.value).find((x) => x.key === key);
  if (!h) return;
  const tops = textareaLineTops(ta);
  scrollToAnchor(() => ta.getBoundingClientRect().top + window.scrollY + tops[h.i] - stickyBottom() - 8);
  // Di laptop kursor langsung ditaruh di bagian itu; di iPhone tidak, agar keyboard tidak muncul tiba-tiba.
  if (matchMedia('(pointer: fine)').matches) {
    const pos = ta.value.split('\n').slice(0, h.i + 1).join('\n').length;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos);
  }
}

// Mengisi gambar di dalam teks catatan dari penyimpanan perangkat.
async function hydrateInlineImages(root, note) {
  for (const fig of root.querySelectorAll('figure.inline-img[data-mid]')) {
    const m = note.mediaIds.includes(fig.dataset.mid) ? await db.getMedia(fig.dataset.mid) : null;
    if (!fig.isConnected) return;
    const ph = fig.querySelector('.img-ph');
    if (!m || m.kind !== 'image') { ph.textContent = 'Gambar belum tersedia di perangkat ini'; ph.classList.add('missing'); continue; }
    const url = objUrl(m.blob);
    const cap = fig.querySelector('figcaption')?.textContent || m.caption || '';
    const img = document.createElement('img');
    img.src = url;
    img.alt = cap || m.name || 'Gambar';
    img.loading = 'lazy';
    img.onclick = () => openLightbox(url, cap);
    ph.replaceWith(img);
  }
}

// Menyimpan gambar baru langsung ke catatan (dipakai dari penampil dokumen) dan menaruhnya di akhir teks.
async function saveImagesToNote(note, items) {
  const add = [];
  const refs = [];
  for (const it of items) {
    const { blob, thumb } = await processImage(it.blob);
    const id = uid();
    add.push({ id, noteId: note.id, kind: 'image', name: it.name || 'gambar.jpg', mime: blob.type || 'image/jpeg', size: blob.size, caption: it.caption || '', blob, thumb, created: Date.now() });
    refs.push(`![${(it.caption || '').replace(/[\[\]]/g, '')}](img:${id})`);
  }
  if (!add.length) return;
  // Dikumpulkan di bawah label "Gambar:" agar tidak terbaca sebagai isi bagian terakhir (mis. Sumber).
  const head = /^Gambar:\s*$/m.test(note.body) ? '' : 'Gambar:\n';
  note.body = (note.body.replace(/\s+$/, '') + '\n\n' + head + refs.join('\n\n')).replace(/^\s+/, '');
  touch(note);
  const { mediaIds, ...stored } = note;
  try {
    await db.saveNote(stored, add);
  } catch (e) {
    toast('Gagal menyimpan gambar: ' + (e?.name === 'QuotaExceededError' ? 'memori penuh' : e?.message || e), 6000);
    return;
  }
  add.forEach(({ blob, thumb, ...meta }) => state.mediaMeta.set(meta.id, meta));
  note.mediaIds = [...note.mediaIds, ...add.map((m) => m.id)];
  state.notes.set(note.id, note);
  indexNote(note);
  scheduleSync();
  toast(add.length > 1 ? `${add.length} gambar disimpan ke catatan` : 'Gambar disimpan ke catatan');
}

// Memotong gambar: seret untuk memilih bagian. Mengembalikan Blob JPEG atau null bila batal.
function cropImage(blob, title = 'Pilih bagian gambar') {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const ov = document.createElement('div');
    ov.className = 'cropper';
    ov.innerHTML = `
      <div class="topbar"><button class="iconbtn" data-act="cancel" aria-label="Batal">✕</button><span class="grow title">${esc(title)}</span><button class="btn small" data-act="ok">Simpan</button></div>
      <p class="hint">Seret di gambar untuk memilih bagian yang ingin disimpan.</p>
      <div class="crop-stage"><img src="${url}" alt="" draggable="false"><div class="crop-box"></div></div>
      <div class="row"><button type="button" class="btn small ghost" data-act="all">Seluruh halaman</button></div>`;
    document.body.appendChild(ov);
    const img = ov.querySelector('img');
    const box = ov.querySelector('.crop-box');
    let sel = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }; // pecahan ukuran gambar
    const draw = () => { box.style.cssText = `left:${sel.x * 100}%;top:${sel.y * 100}%;width:${sel.w * 100}%;height:${sel.h * 100}%`; };
    draw();
    const stage = ov.querySelector('.crop-stage');
    let start = null;
    const pt = (e) => {
      const r = img.getBoundingClientRect();
      return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    };
    stage.addEventListener('pointerdown', (e) => { e.preventDefault(); stage.setPointerCapture(e.pointerId); start = pt(e); });
    stage.addEventListener('pointermove', (e) => {
      if (!start) return;
      const p = pt(e);
      sel = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      draw();
    });
    stage.addEventListener('pointerup', () => {
      start = null;
      if (sel.w < 0.02 || sel.h < 0.02) { sel = { x: 0, y: 0, w: 1, h: 1 }; draw(); }
    });
    const done = (v) => { URL.revokeObjectURL(url); ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'cancel') done(null);
      else if (act === 'all') { sel = { x: 0, y: 0, w: 1, h: 1 }; draw(); }
      else if (act === 'ok') {
        const W = img.naturalWidth; const H = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sel.w * W));
        c.height = Math.max(1, Math.round(sel.h * H));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, sel.x * W, sel.y * H, c.width, c.height, 0, 0, c.width, c.height);
        c.toBlob((b) => done(b), 'image/jpeg', 0.9);
      }
    });
  });
}

// Memilih beberapa gambar dari daftar (gambar yang tertanam di dokumen).
function pickImages(items, title) {
  return new Promise((resolve) => {
    const urls = items.map((it) => URL.createObjectURL(it.blob));
    const ov = document.createElement('div');
    ov.className = 'cropper';
    ov.innerHTML = `
      <div class="topbar"><button class="iconbtn" data-act="cancel" aria-label="Batal">✕</button><span class="grow title">${esc(title)}</span><button class="btn small" data-act="ok">Simpan</button></div>
      <div class="row"><span class="hint grow">Ketuk gambar untuk memilih.</span><button type="button" class="btn small ghost" data-act="all">Pilih semua</button></div>
      <div class="img-pick">${items.map((it, i) => `<button type="button" class="pick-img" data-i="${i}"><img src="${urls[i]}" alt="${esc(it.name)}"><span class="check">✓</span></button>`).join('')}</div>`;
    document.body.appendChild(ov);
    const chosen = new Set();
    const sync = () => {
      ov.querySelectorAll('.pick-img').forEach((b) => b.classList.toggle('on', chosen.has(+b.dataset.i)));
      ov.querySelector('[data-act="ok"]').textContent = chosen.size ? `Simpan (${chosen.size})` : 'Simpan';
    };
    const done = (v) => { urls.forEach((u) => URL.revokeObjectURL(u)); ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.i) { const i = +b.dataset.i; chosen.has(i) ? chosen.delete(i) : chosen.add(i); sync(); return; }
      const act = b.dataset.act;
      if (act === 'cancel') done([]);
      else if (act === 'all') { items.forEach((_, i) => chosen.add(i)); sync(); }
      else if (act === 'ok') {
        if (!chosen.size) { toast('Pilih minimal satu gambar'); return; }
        done([...chosen].sort((a, b2) => a - b2).map((i) => items[i]));
      }
    });
  });
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
  return `<h4 class="section">Catatan Terkait</h4><div class="related">${scored.slice(0, 6).map(([o]) => `<a href="#/catatan/${o.id}">${TYPES[o.type]?.icon || ''} ${esc(o.title)}</a>`).join('')}</div>`;
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
        <small>${DOC_LABEL[m.docType] || 'Dokumen'}${m.pageCount ? ` · ${m.pageCount} ${pageUnit(m)}` : ''} · ${fmtSize(m.size)}${versions ? ` · ${versions + 1} versi` : ''}${(m.docPages || []).join('').trim() ? '' : ' · <span class="warn-text">isi tidak bisa dicari</span>'}</small>
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

// Penjelasan mengapa dokumen tidak bisa dicari.
function noTextReason(m) {
  if (m.docType === 'other') return '🔍 Format ini (misalnya .doc, .ppt, .xls lama, atau Pages) tidak bisa dibaca aplikasi, jadi isinya tidak bisa dicari. Simpan ulang sebagai .docx, .pptx, .xlsx, atau PDF, lalu pakai “Simpan versi baru”.';
  if (m.docType === 'pdf') return '🔍 PDF ini tidak memiliki teks yang bisa dibaca, biasanya karena hasil scan atau foto halaman, jadi isinya belum bisa dicari.';
  return '🔍 Teks dokumen ini tidak terbaca, jadi isinya belum bisa dicari.';
}

// Membaca ulang teks dokumen (mis. file lama atau pembacaan sebelumnya gagal) lalu menyimpannya.
async function rereadDocText(note, m) {
  const file = new File([m.blob], m.name || 'dokumen', { type: m.mime || m.blob.type || '' });
  const ex = await extractDocument(file, m.docType);
  const pages = ex.pages || [];
  if (!pages.join('').trim()) {
    toast(m.docType === 'pdf' ? 'Tetap tidak ada teks. PDF ini kemungkinan hasil scan.' : 'Teks tetap tidak terbaca.', 5000);
    return false;
  }
  const patch = { id: m.id, docPages: pages, pageCount: ex.pageCount ?? m.pageCount ?? null };
  touch(note);
  const { mediaIds, ...stored } = note;
  await db.saveNote(stored, [], [patch]);
  state.mediaMeta.set(m.id, { ...state.mediaMeta.get(m.id), ...patch });
  indexNote(note);
  scheduleSync();
  toast('Teks berhasil dibaca. Sekarang bisa dicari.');
  return true;
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
      ${m.docType === 'pdf' ? '<button class="btn small ghost" data-act="grab">✂️ Ambil gambar</button>' : ''}
      ${['docx', 'pptx', 'xlsx'].includes(m.docType) ? '<button class="btn small ghost" data-act="docimgs">🖼️ Gambar di dokumen</button>' : ''}
    </div>
    ${hasText ? '' : `<div class="dv-notext">${noTextReason(m)}${m.docType !== 'other' ? ' <button class="btn small ghost" data-act="reread">Baca ulang teks</button>' : ''}</div>`}
    ${hasText ? `<div class="dv-find">
      <input id="dv-q" type="search" placeholder="Cari di dokumen ini" value="${esc(query)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      <span class="dv-count" id="dv-count"></span>
      <button class="iconbtn" data-act="prev" aria-label="Hasil sebelumnya">⌃</button>
      <button class="iconbtn" data-act="next" aria-label="Hasil berikutnya">⌄</button>
    </div>` : ''}
    <div class="dv-body"></div>
    ${older.length ? `<div class="dv-versions"><h4 class="section">Versi Sebelumnya</h4>${older.map((v) => `<div class="dv-ver"><span>${fmtDate(v.created)} · ${fmtSize(v.size)}</span><button class="btn small ghost" data-ver="${v.id}">Buka</button></div>`).join('')}</div>` : ''}`;
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
    else if (act === 'grab') grabPdfImage();
    else if (act === 'reread') {
      t.disabled = true;
      t.textContent = 'Membaca…';
      const ok = await rereadDocText(note, m);
      if (ok) { close(); openDocViewer(note, m.id, 0, terms); }
      else { t.disabled = false; t.textContent = 'Baca ulang teks'; }
    }
    else if (act === 'docimgs') grabDocImages();
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

  // Ambil gambar dari halaman PDF yang sedang terlihat, lalu simpan ke catatan.
  const grabPdfImage = async () => {
    if (!pdf) return;
    const pageEls = [...body.querySelectorAll('.pdfpage')];
    const mid = window.innerHeight * 0.45;
    const el = pageEls.find((d) => d.getBoundingClientRect().bottom > mid) || pageEls[0];
    const no = +(el?.dataset.no || 1);
    toast('Menyiapkan halaman…');
    const pageBlob = await renderPdfPageToBlob(pdf, no, 2000, 0.92);
    const cropped = await cropImage(pageBlob, `Halaman ${no}`);
    if (!cropped) return;
    await saveImagesToNote(note, [{ blob: cropped, name: `${m.name} hal ${no}.jpg`, caption: `${m.name.replace(/\.[a-z0-9]+$/i, '')}, hal. ${no}` }]);
    close();
    if (location.hash === '#/catatan/' + note.id) renderNote(note.id);
  };
  const grabDocImages = async () => {
    let imgs = [];
    try { imgs = await extractDocImages(m.blob); } catch (e) { console.warn(e); }
    if (!imgs.length) { toast('Tidak ada gambar yang bisa diambil dari dokumen ini'); return; }
    const chosen = await pickImages(imgs, `${imgs.length} gambar di dokumen`);
    if (!chosen.length) return;
    const base = m.name.replace(/\.[a-z0-9]+$/i, '');
    await saveImagesToNote(note, chosen.map((it) => ({ blob: it.blob, name: it.name, caption: base })));
    close();
    if (location.hash === '#/catatan/' + note.id) renderNote(note.id);
  };

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
  touch(note);
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
    <div class="topbar"><a href="#/" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Catatan baru</span></div>
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
    <div class="topbar"><a href="#/" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Alat</span></div>
    <div class="picker">
      <a class="pick" href="#/alat/bmi"><span class="big">⚖️</span><b>Kalkulator IMT / BMI</b><small>Interpretasi Asia-Pasifik, WHO, Kemenkes, BB ideal</small></a>
      <a class="pick" href="#/alat/puyer"><span class="big">💊</span><b>Dosis puyer</b><small>Racikan anak per BB: mg per bungkus, jumlah tablet, resep d.t.d.</small></a>
      <a class="pick" href="#/alat/cairan"><span class="big">💧</span><b>Cairan Holliday-Segar</b><small>Rumatan mL/hari & mL/jam, tetesan per menit, defisit dehidrasi</small></a>
    </div>`;
}

// Tombol salin & jadikan catatan untuk hasil kalkulator.
function bindCalcActions(text, title, tags) {
  $('#c-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); toast('Hasil disalin'); } catch { toast('Gagal menyalin'); }
  };
  $('#c-note').onclick = () => {
    state.draft = { type: 'bebas', title, body: text, tags, stase: '', sources: [] };
    location.hash = '#/baru/bebas';
  };
}
const calcActionsHtml = '<div class="row"><button type="button" class="btn ghost" id="c-copy">📋 Salin hasil</button><button type="button" class="btn ghost" id="c-note">📝 Jadikan catatan</button></div>';
const unitInput = (id, label, unit, ph, val = '') => `<label class="field"><span>${label}</span><span class="unit"><input id="${id}" inputmode="decimal" placeholder="${ph}" value="${val}" autocomplete="off"><i>${unit}</i></span></label>`;

// ---------- Kalkulator puyer ----------
function renderPuyer() {
  releaseUrls();
  const rows = [{ ...PUYER_DRUGS[0], preset: PUYER_DRUGS[0].id }];
  view().innerHTML = `
    <div class="topbar"><a href="#/alat" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Dosis puyer</span></div>
    <form class="editor calc" onsubmit="return false">
      <div class="row">
        ${unitInput('p-w', 'Berat badan', 'kg', '12')}
        <label class="field"><span>Frekuensi</span><select id="p-freq">${[2, 3, 4].map((f) => `<option value="${f}" ${f === 3 ? 'selected' : ''}>${f}× sehari</option>`).join('')}</select></label>
      </div>
      <div class="row">
        ${unitInput('p-days', 'Lama pemberian', 'hari', '3', '3')}
        ${unitInput('p-n', 'Jumlah bungkus', 'bks', 'otomatis')}
      </div>
      <label class="field"><span>Pembulatan jumlah tablet</span><select id="p-round"><option value="0.25">¼ tablet</option><option value="0.5">½ tablet</option><option value="0">Tanpa pembulatan</option></select></label>
      <h4 class="section">Obat dalam Racikan</h4>
      <div id="p-rows" class="drug-rows"></div>
      <button type="button" class="btn ghost" id="p-add">${icon('plus')} Tambah obat</button>
    </form>
    <div id="p-out" class="calc-out"></div>
    <details class="calc-ref">
      <summary>Dosis Acuan & Catatan</summary>
      <table>${PUYER_DRUGS.map((d) => `<tr><td>${esc(d.name)}</td><td>${fmtNum(d.range[0], 2)}${d.range[1] !== d.range[0] ? `–${fmtNum(d.range[1], 2)}` : ''} mg/kg/${d.mode === 'day' ? 'hari' : 'dosis'}${d.maxDose ? `; maks ${fmtNum(d.maxDose)} mg/kali` : ''}${d.maxDayKg ? `; maks ${fmtNum(d.maxDayKg, 2)} mg/kg/hari` : ''}${d.maxDay ? `; maks ${fmtNum(d.maxDay)} mg/hari` : ''}${d.note ? `<br><span class="hint">${esc(d.note)}</span>` : ''}</td></tr>`).join('')}</table>
      <h4>Catatan</h4>
      <ul>
        <li>Angka di atas adalah dosis acuan umum dan bisa diubah. Selalu cocokkan dengan formularium, rekomendasi IDAI, usia, dan fungsi ginjal/hati pasien.</li>
        <li>Jumlah tablet dihitung untuk seluruh bungkus lalu dibulatkan; dosis per bungkus yang tertulis sudah memakai hasil pembulatan.</li>
        <li>d.t.d. (<i>da tales doses</i>): dosis yang ditulis adalah isi tiap bungkus.</li>
      </ul>
    </details>`;

  const rowHtml = (r, i) => `
    <div class="drug-row" data-i="${i}">
      <div class="row">
        <label class="field grow2"><span>Obat</span><select data-k="preset">${PUYER_DRUGS.map((d) => `<option value="${d.id}" ${r.preset === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}<option value="" ${!r.preset ? 'selected' : ''}>Lainnya…</option></select></label>
        ${rows.length > 1 ? `<button type="button" class="iconbtn" data-k="del" aria-label="Hapus obat ini" title="Hapus">${icon('x')}</button>` : ''}
      </div>
      ${!r.preset ? `<label class="field"><span>Nama obat</span><input data-k="name" value="${esc(r.name || '')}" placeholder="Nama obat" autocomplete="off"></label>` : ''}
      <div class="row">
        <label class="field"><span>Dosis</span><span class="unit"><input data-k="dose" inputmode="decimal" value="${Number.isFinite(r.dose) ? r.dose : ''}" autocomplete="off"><i>mg/kg</i></span></label>
        <label class="field"><span>Per</span><select data-k="mode"><option value="dose" ${r.mode === 'dose' ? 'selected' : ''}>dosis (kali)</option><option value="day" ${r.mode === 'day' ? 'selected' : ''}>hari</option></select></label>
        <label class="field"><span>Sediaan</span><span class="unit"><input data-k="strength" inputmode="decimal" value="${Number.isFinite(r.strength) ? r.strength : ''}" autocomplete="off"><i>mg/tab</i></span></label>
      </div>
    </div>`;
  const drawRows = () => { $('#p-rows').innerHTML = rows.map(rowHtml).join(''); };

  const calc = () => {
    const out = $('#p-out');
    const w = parseNum($('#p-w').value);
    const freq = +$('#p-freq').value;
    const days = parseNum($('#p-days').value);
    const nIn = parseNum($('#p-n').value);
    const packets = Number.isFinite(nIn) ? Math.round(nIn) : Math.round(freq * days);
    $('#p-n').placeholder = Number.isFinite(days) ? String(Math.round(freq * days)) : 'otomatis';
    if (!$('#p-w').value.trim()) { out.innerHTML = '<p class="hint">Isi berat badan untuk melihat hasilnya.</p>'; return; }
    const r = computePuyer({ weightKg: w, freq, packets, rounding: +$('#p-round').value, rows });
    if (!r) { out.innerHTML = '<p class="hint">Periksa lagi angkanya (BB 0–150 kg, jumlah bungkus 1–200, dosis dan sediaan terisi).</p>'; return; }
    out.innerHTML = `
      ${r.items.map((it) => `
        <div class="dose-card ${it.warn.length ? 'has-warn' : ''}">
          <div class="dose-name">${esc(it.name)}</div>
          <div class="dose-big">${fmtNum(it.actual, 2)} <small>mg / bungkus</small></div>
          <div class="dose-take">Ambil <b>${fmtTablets(it.tablets)} tablet</b> ${fmtNum(it.strength)} mg untuk ${r.packets} bungkus${r.rounding ? ` <span class="hint">(tepatnya ${fmtNum(it.exact, 2)})</span>` : ''}</div>
          <dl class="bmi-list">
            <div><dt>Dosis aktual</dt><dd>${fmtNum(it.perKgDose, 2)} mg/kg/dosis · ${fmtNum(it.perKgDay, 2)} mg/kg/hari · ${fmtNum(it.daily, 1)} mg/hari</dd></div>
            <div><dt>Target sebelum pembulatan</dt><dd>${fmtNum(it.target, 2)} mg/bungkus${Math.abs(it.deviation) >= 0.5 ? ` (selisih ${it.deviation > 0 ? '+' : ''}${fmtNum(it.deviation, 1)}%)` : ''}</dd></div>
          </dl>
          ${it.warn.map((x) => `<p class="warn-line">⚠️ ${esc(x)}</p>`).join('')}
          ${it.note ? `<p class="hint">${esc(it.note)}</p>` : ''}
        </div>`).join('')}
      <pre class="recipe">${esc(puyerRecipe(r))}</pre>
      ${calcActionsHtml}`;
    bindCalcActions(puyerSummaryText(r), `Puyer ${r.items.map((x) => x.name).join(' + ')} BB ${fmtNum(w)} kg`, ['puyer', 'dosis-anak']);
  };

  $('#p-rows').addEventListener('input', (e) => {
    const i = +e.target.closest('.drug-row').dataset.i;
    const k = e.target.dataset.k;
    if (k === 'dose' || k === 'strength') rows[i][k] = parseNum(e.target.value);
    else if (k === 'name') rows[i].name = e.target.value;
    else if (k === 'mode') rows[i].mode = e.target.value;
    else return;
    calc();
  });
  $('#p-rows').addEventListener('change', (e) => {
    if (e.target.dataset.k !== 'preset') return;
    const i = +e.target.closest('.drug-row').dataset.i;
    const d = PUYER_DRUGS.find((x) => x.id === e.target.value);
    rows[i] = d ? { ...d, preset: d.id } : { preset: '', name: '', mode: 'dose', dose: NaN, strength: NaN };
    drawRows();
    calc();
  });
  $('#p-rows').addEventListener('click', (e) => {
    if (e.target.closest('[data-k="del"]')) { rows.splice(+e.target.closest('.drug-row').dataset.i, 1); drawRows(); calc(); }
  });
  $('#p-add').onclick = () => {
    const d = PUYER_DRUGS.find((x) => !rows.some((r) => r.preset === x.id)) || PUYER_DRUGS[0];
    rows.push({ ...d, preset: d.id });
    drawRows();
    calc();
  };
  ['#p-w', '#p-freq', '#p-days', '#p-n', '#p-round'].forEach((id) => { $(id).addEventListener('input', calc); $(id).addEventListener('change', calc); });
  drawRows();
  calc();
  if (!matchMedia('(pointer: coarse)').matches) $('#p-w').focus();
}

// ---------- Cairan rumatan Holliday-Segar ----------
function renderFluid() {
  releaseUrls();
  view().innerHTML = `
    <div class="topbar"><a href="#/alat" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Cairan Holliday-Segar</span></div>
    <form class="editor calc" onsubmit="return false">
      <div class="row">
        ${unitInput('f-w', 'Berat badan', 'kg', '15')}
        <label class="field"><span>Set infus</span><select id="f-drop"><option value="20">Makro 20 tetes/mL</option><option value="15">Makro 15 tetes/mL</option><option value="60">Mikro 60 tetes/mL</option></select></label>
      </div>
      <label class="field"><span>Defisit dehidrasi (opsional)</span><select id="f-def"><option value="0">Tidak ada (rumatan saja)</option><option value="3">3% (ringan)</option><option value="5">5% (ringan-sedang)</option><option value="7">7%</option><option value="10">10% (berat, setelah syok teratasi)</option></select></label>
    </form>
    <div id="f-out" class="calc-out"></div>
    <details class="calc-ref">
      <summary>Rumus & Catatan</summary>
      <table>
        <tr><td>BB ≤ 10 kg</td><td>100 mL/kg/hari · 4 mL/kg/jam</td></tr>
        <tr><td>BB 10–20 kg</td><td>1.000 mL + 50 mL/kg di atas 10 kg · 40 mL/jam + 2 mL/kg</td></tr>
        <tr><td>BB &gt; 20 kg</td><td>1.500 mL + 20 mL/kg di atas 20 kg · 60 mL/jam + 1 mL/kg</td></tr>
        <tr><td>Tetes/menit</td><td>mL/jam × faktor tetes ÷ 60</td></tr>
        <tr><td>Defisit</td><td>BB × % dehidrasi × 10 mL; ½ dalam 8 jam pertama, ½ dalam 16 jam berikutnya, ditambah rumatan</td></tr>
      </table>
      <h4>Catatan</h4>
      <ul>
        <li>Dibatasi ${fmtNum(FLUID_CAP_DAY, 0)} mL/hari (±100 mL/jam) untuk BB besar.</li>
        <li>Syok/dehidrasi berat: resusitasi dulu (bolus kristaloid 10–20 mL/kg atau Rencana C WHO), bukan rumus ini. Diare akut dehidrasi ringan-sedang: utamakan oralit (Rencana B).</li>
        <li>Untuk rumatan anak, cairan isotonik (mis. RL atau NaCl 0,9% + dekstrosa) dianjurkan untuk mencegah hiponatremia (AAP 2018, NICE NG29).</li>
        <li>Kurangi bila ada risiko retensi cairan (gagal jantung, gagal ginjal, SIADH pada meningitis/pneumonia); tidak untuk neonatus &lt; 28 hari.</li>
      </ul>
    </details>`;
  const calc = () => {
    const out = $('#f-out');
    if (!$('#f-w').value.trim()) { out.innerHTML = '<p class="hint">Isi berat badan untuk melihat hasilnya.</p>'; return; }
    const r = computeFluid({ weightKg: parseNum($('#f-w').value), deficitPct: +$('#f-def').value, dropFactor: +$('#f-drop').value });
    if (!r) { out.innerHTML = '<p class="hint">Periksa lagi berat badannya (0–200 kg).</p>'; return; }
    const tpm = r.dropFactor === 60 ? r.tpmMicro : r.tpmMacro;
    const d = r.deficit;
    out.innerHTML = `
      <div class="dose-card">
        <div class="dose-name">Rumatan</div>
        <div class="dose-big">${fmtNum(r.hour)} <small>mL/jam</small></div>
        <div class="dose-take"><b>${fmtNum(tpm)} tetes/menit</b> (${r.dropFactor} tetes/mL) · ${fmtNum(r.day, 0)} mL/hari${r.capped ? ` <span class="hint">(dibatasi dari ${fmtNum(r.dayRaw, 0)} mL)</span>` : ''}</div>
        <dl class="bmi-list">
          ${r.steps.map((s) => `<div><dt>${s.label}</dt><dd>${fmtNum(s.kg)} kg × ${s.perKg} mL = ${fmtNum(s.kg * s.perKg, 0)} mL</dd></div>`).join('')}
          ${r.dropFactor !== 60 ? `<div><dt>Set mikro (60 tetes/mL)</dt><dd>${fmtNum(r.tpmMicro)} tetes/menit</dd></div>` : ''}
        </dl>
      </div>
      ${d ? `
      <div class="dose-card">
        <div class="dose-name">Rumatan + defisit ${fmtNum(d.pct)}% (${fmtNum(d.ml, 0)} mL)</div>
        <dl class="bmi-list">
          <div><dt>8 jam pertama</dt><dd><b>${fmtNum(d.first)} mL/jam</b> · ${fmtNum(r.dropFactor === 60 ? d.first : d.tpmFirst)} tetes/menit</dd></div>
          <div><dt>16 jam berikutnya</dt><dd><b>${fmtNum(d.next)} mL/jam</b> · ${fmtNum(r.dropFactor === 60 ? d.next : d.tpmNext)} tetes/menit</dd></div>
          <div><dt>Total 24 jam</dt><dd>${fmtNum(d.total, 0)} mL</dd></div>
        </dl>
        ${d.pct >= 10 ? '<p class="warn-line">⚠️ Dehidrasi berat/syok: lakukan resusitasi cairan dulu, lalu nilai ulang sebelum memakai rencana ini.</p>' : ''}
      </div>` : ''}
      ${calcActionsHtml}`;
    bindCalcActions(fluidSummaryText(r), `Cairan Holliday-Segar BB ${fmtNum(r.weightKg)} kg`, ['cairan', 'holliday-segar']);
  };
  ['#f-w', '#f-def', '#f-drop'].forEach((id) => { $(id).addEventListener('input', calc); $(id).addEventListener('change', calc); });
  calc();
  if (!matchMedia('(pointer: coarse)').matches) $('#f-w').focus();
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
    <div class="topbar"><a href="#/alat" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Kalkulator IMT</span></div>
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
      <summary>Tabel Kategori dan Catatan</summary>
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

// ---------- Gambar di dalam teks (editor) ----------

async function addInlineImages(files) {
  files = files.filter((f) => f && f.type.startsWith('image/'));
  if (!files.length || !state.editor) return;
  toast('Memproses gambar…', 10000);
  const refs = [];
  for (const f of files) {
    const { blob, thumb } = await processImage(f);
    const id = uid();
    state.editor.media.push({ id, noteId: state.editor.note.id, kind: 'image', name: f.name || 'gambar.jpg', mime: blob.type || f.type, size: blob.size, caption: '', blob, thumb, created: Date.now(), isNew: true });
    refs.push(`![](img:${id})`);
  }
  if (!state.editor) return;
  insertIntoBody(refs.join('\n\n'));
  state.editor.dirty = true;
  renderEditorMedia();
  toast('Gambar disisipkan. Tulis keterangan di dalam [ ] bila perlu, lalu Simpan.', 4000);
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
  // Gambar yang disalin (screenshot, gambar dari web atau aplikasi lain) langsung disisipkan.
  const imgs = [...(cd.files || [])].filter((f) => f.type.startsWith('image/'));
  if (imgs.length) { e.preventDefault(); addInlineImages(imgs); return; }
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
    <div class="topbar"><a href="#/baru" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Tempel dari Claude</span></div>
    <div class="paste">
      <ol class="steps">
        <li>Di akhir obrolan dengan Claude, kirim prompt ini supaya materinya tersalin utuh dan rapi. <button type="button" class="btn small ghost" id="copyprompt">📋 Salin prompt</button></li>
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
      <div class="pv-meta">${parsed.body.split('\n').filter((l) => /:$/.test(l.trim())).length} bagian · ${parsed.sources.length} sumber${parsed.images.length ? ` · ${parsed.images.length} gambar` : ''}</div>`;
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
  $('#p-next').onclick = async () => {
    if (!parsed) return;
    const draft = parsed;
    if (draft.images.length) {
      $('#p-next').disabled = true;
      toast('Membuat gambar…', 10000);
      draft.inlineMedia = await svgDraftMedia(draft);
      const failed = draft.images.length - draft.inlineMedia.filter(Boolean).length;
      if (failed) toast(`${failed} gambar tidak bisa dibuat (kode SVG rusak atau terpotong). Keterangannya tetap ada di teks.`, 5000);
    }
    state.draft = draft;
    location.hash = '#/baru/' + draft.type;
  };
}

// Kode SVG dari Claude diubah jadi PNG berlatar putih agar tampil, tersinkron, dan terbackup seperti foto biasa.
async function svgToPng(svg) {
  const img = await loadImage(new Blob([svg], { type: 'image/svg+xml' }));
  const w = img.naturalWidth || 900;
  const h = img.naturalHeight || 600;
  const scale = Math.min(3, Math.max(1, 1800 / w), 4000 / h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Gambar tidak bisa dibuat');
  return blob;
}

async function svgDraftMedia(draft) {
  const out = [];
  for (const [n, im] of draft.images.entries()) {
    try {
      const png = await svgToPng(im.svg);
      const file = new File([png], `gambar-${n + 1}.png`, { type: 'image/png' });
      const { blob, thumb } = await processImage(file);
      out.push({ blob, thumb, caption: im.caption, name: file.name });
    } catch {
      out.push(null);
    }
  }
  return out;
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
  if (draft && draft.images && draft.images.length) {
    // Penanda "![..](svg:N)" dari hasil tempel diganti gambar sungguhan; yang gagal dibuat menjadi teks keterangan.
    note.body = note.body.replace(/^!\[([^\]]*)\]\(svg:(\d+)\)$/gm, (m, cap, n) => {
      const im = (draft.inlineMedia || [])[+n];
      if (!im) return cap ? `[Gambar tidak terbaca: ${cap}]` : '[Gambar tidak terbaca]';
      const mid = uid();
      media.push({ id: mid, noteId: note.id, kind: 'image', name: im.name, mime: im.blob.type || 'image/png', size: im.blob.size, caption: '', blob: im.blob, thumb: im.thumb, created: Date.now(), isNew: true });
      return `![${cap}](img:${mid})`;
    });
  }

  view().innerHTML = `
    <div class="topbar">
      <button class="iconbtn" id="cancel" aria-label="Batal" title="Batal">${icon('x')}</button>
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
        <div class="fmt" role="group" aria-label="Format teks">
          <button type="button" class="fmtbtn" data-fmt="bold" aria-label="Tebal" title="Tebal (Ctrl/⌘+B)"><b>B</b></button>
          <button type="button" class="fmtbtn" data-fmt="italic" aria-label="Miring" title="Miring (Ctrl/⌘+I)"><i>I</i></button>
          <button type="button" class="fmtbtn" data-fmt="strike" aria-label="Coret" title="Coret (Ctrl/⌘+Shift+X)"><s>S</s></button>
          <button type="button" class="fmtbtn" data-fmt="bullet" aria-label="Poin" title="Jadikan poin / teks biasa">•</button>
          <button type="button" class="fmtbtn" data-fmt="outdent" aria-label="Naikkan tingkat poin" title="Naikkan tingkat (Shift+Tab)">⇤</button>
          <button type="button" class="fmtbtn" data-fmt="indent" aria-label="Jadikan sub-poin" title="Jadikan sub-poin (Tab)">⇥</button>
          <select id="t-size" class="fmtsel" aria-label="Ukuran teks" title="Ukuran teks baris ini (Ctrl/⌘+Alt+0–3)">
            <option value="0">Teks</option><option value="1">Judul 1</option><option value="2">Judul 2</option><option value="3">Judul 3</option>
          </select>
        </div>
        <button type="button" class="btn small ghost" id="t-table">▦ Tabel</button>
        <label class="btn small ghost">🖼️ Gambar<input type="file" id="f-inline" accept="image/*" multiple hidden></label>
        <label class="btn small ghost">📊 Impor tabel Excel / CSV<input type="file" id="f-table" accept=".csv,.tsv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
      </div>
      <textarea id="e-body" aria-label="Isi catatan" placeholder="Tulis catatan… Baris '## Judul' atau 'Label:' menjadi bagian yang bisa dilipat. [[Judul catatan lain]] untuk menautkan.">${esc(note.body)}</textarea>
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
    </form>
    ${modeBarHtml('edit')}`;

  const body = $('#e-body');
  const autoGrow = () => { body.style.height = 'auto'; body.style.height = Math.max(220, body.scrollHeight + 4) + 'px'; };
  body.addEventListener('input', autoGrow);
  requestAnimationFrame(() => { autoGrow(); restoreEditAnchor(); });
  bindModeBar('edit', note.id);
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
    if (existing) location.replace('#/catatan/' + existing.id);
    else history.length > 1 ? history.back() : (location.hash = '#/');
  };
  $('#save').onclick = () => saveEditor();
  $('#f-visual').onchange = (e) => addFiles(e.target.files);
  $('#f-audio').onchange = (e) => addFiles(e.target.files);
  $('#f-doc').onchange = (e) => addFiles(e.target.files);
  $('#rec').onclick = startRecording;
  $('#t-table').onclick = () => editTableAtCursor();
  const fmtBar = view().querySelector('.fmt');
  // Di laptop fokus & seleksi tetap di kotak teks saat tombol format diklik.
  fmtBar.addEventListener('mousedown', (e) => { if (e.target.closest('.fmtbtn')) e.preventDefault(); });
  fmtBar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fmt]');
    if (!b) return;
    const f = b.dataset.fmt;
    if (f === 'bullet') toggleBullet();
    else if (f === 'indent') indentLines(1);
    else if (f === 'outdent') indentLines(-1);
    else wrapSelection(FMT[f]);
  });
  const size = $('#t-size');
  const syncSize = () => { size.value = String(lineLevel()); };
  ['click', 'keyup', 'input'].forEach((ev) => body.addEventListener(ev, syncSize));
  size.onchange = () => setLineLevel(+size.value);
  body.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    // Tab hanya ditangkap di baris poin, agar navigasi keyboard di luar daftar tetap normal.
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const { ta, start, end } = selectedLines();
      if (ta.value.slice(start, end).split('\n').some((l) => LIST_LINE.test(l))) { e.preventDefault(); indentLines(e.shiftKey ? -1 : 1); }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) { continueList(e); return; }
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    let f = null;
    if (!e.shiftKey && !e.altKey && k === 'b') f = 'bold';
    else if (!e.shiftKey && !e.altKey && k === 'i') f = 'italic';
    else if (e.shiftKey && k === 'x') f = 'strike';
    if (f) { e.preventDefault(); wrapSelection(FMT[f]); return; }
    if (e.altKey && /^Digit[0-3]$/.test(e.code)) { e.preventDefault(); setLineLevel(+e.code.slice(5)); syncSize(); }
  });
  $('#f-table').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importTableFile(f); };
  body.addEventListener('paste', onBodyPaste);
  $('#f-inline').onchange = (e) => { const fs = [...e.target.files]; e.target.value = ''; addInlineImages(fs); };
  body.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  body.addEventListener('drop', (e) => {
    const fs = [...(e.dataTransfer?.files || [])];
    if (!fs.length) return;
    e.preventDefault();
    const imgs = fs.filter((f) => f.type.startsWith('image/'));
    const others = fs.filter((f) => !f.type.startsWith('image/'));
    if (imgs.length) addInlineImages(imgs);
    if (others.length) addFiles(others);
  });
  // Posisi kursor terakhir diingat, karena membuka pemilih file atau editor tabel membuat kotak teks kehilangan fokus.
  const remember = () => { if (state.editor) state.editor.caret = [body.selectionStart, body.selectionEnd]; };
  ['input', 'select', 'click', 'keyup', 'blur'].forEach((ev) => body.addEventListener(ev, remember));
  if (draft) toast('Periksa dan rapikan dulu, lalu ketuk Simpan', 3500);
  else if (state.editor.isNew) $('#e-title').focus();
  renderEditorMedia();
}

// ---------- Format teks di editor (Markdown, kompatibel Obsidian) ----------
const FMT = { bold: '**', italic: '*', strike: '~~' };

function editorSel() {
  const ta = $('#e-body');
  // Di iPhone tombol membuat kotak teks kehilangan fokus; pakai posisi kursor terakhir.
  const [a, b] = document.activeElement === ta ? [ta.selectionStart, ta.selectionEnd] : (state.editor?.caret || [ta.value.length, ta.value.length]);
  return { ta, a, b };
}

// Membungkus/membuka seleksi dengan penanda. Tanpa seleksi: kata di kursor, atau penanda kosong siap diketik.
function wrapSelection(mk) {
  const { ta, a: a0, b: b0 } = editorSel();
  let a = a0, b = b0;
  const v = ta.value;
  if (a === b) {
    const left = v.slice(0, a).match(/[\p{L}\p{N}_-]*$/u)[0].length;
    const right = v.slice(a).match(/^[\p{L}\p{N}_-]*/u)[0].length;
    if (left + right) { a -= left; b += right; }
  }
  // Hindari menyertakan spasi di tepi seleksi (penanda Markdown tidak boleh menempel spasi).
  while (a < b && /\s/.test(v[a])) a++;
  while (b > a && /\s/.test(v[b - 1])) b--;
  const sel = v.slice(a, b);
  // "*" (miring) tidak boleh tertukar dengan "**" (tebal).
  const solo = (x, y) => mk !== '*' || (x !== '*' && y !== '*');
  const inside = sel.length >= 2 * mk.length && sel.startsWith(mk) && sel.endsWith(mk) && solo(sel[1], sel[sel.length - 2]);
  const outside = v.slice(a - mk.length, a) === mk && v.slice(b, b + mk.length) === mk && solo(v[a - 2], v[b + 1]);
  let text, s0, s1;
  if (inside) { text = sel.slice(mk.length, sel.length - mk.length); s0 = a; s1 = a + text.length; }
  else if (outside) { a -= mk.length; b += mk.length; text = sel; s0 = a; s1 = a + sel.length; }
  else { text = mk + sel + mk; s0 = a + mk.length; s1 = s0 + sel.length; }
  ta.focus({ preventScroll: true });
  ta.setRangeText(text, a, b, 'preserve');
  ta.setSelectionRange(s0, s1);
  ta.dispatchEvent(new Event('input'));
  if (state.editor) state.editor.caret = [s0, s1];
}

function currentLine() {
  const { ta, a } = editorSel();
  const start = ta.value.lastIndexOf('\n', a - 1) + 1;
  const nl = ta.value.indexOf('\n', start);
  return { ta, start, end: nl === -1 ? ta.value.length : nl };
}

function lineLevel() {
  const { ta, start, end } = currentLine();
  const m = ta.value.slice(start, end).match(/^(#{1,3})\s/);
  return m ? m[1].length : 0;
}

// Ukuran teks baris di kursor: 0 = teks biasa, 1-3 = judul (bagian yang bisa dilipat).
function setLineLevel(level) {
  const { ta, start, end } = currentLine();
  const line = ta.value.slice(start, end);
  const bare = line.replace(/^#{1,3}\s+/, '');
  const next = level ? '#'.repeat(level) + ' ' + bare.replace(/:\s*$/, '') : bare;
  if (next === line) return;
  ta.focus({ preventScroll: true });
  ta.setRangeText(next, start, end, 'end');
  ta.dispatchEvent(new Event('input'));
  if (state.editor) state.editor.caret = [ta.selectionStart, ta.selectionEnd];
}

// ---------- Daftar bertingkat di editor ----------
const LIST_STEP = '  ';
const LIST_LINE = /^([ \t]*)([-*•])\s+/;

// Baris-baris yang tersentuh seleksi (atau baris kursor).
function selectedLines() {
  const { ta, a, b } = editorSel();
  const start = ta.value.lastIndexOf('\n', a - 1) + 1;
  const nl = ta.value.indexOf('\n', Math.max(b - (b > a && ta.value[b - 1] === '\n' ? 1 : 0), a));
  return { ta, a, b, start, end: nl === -1 ? ta.value.length : nl };
}

function replaceLines(ta, start, end, next, a, b) {
  ta.focus({ preventScroll: true });
  ta.setRangeText(next, start, end, 'preserve');
  ta.setSelectionRange(a, b);
  ta.dispatchEvent(new Event('input'));
  if (state.editor) state.editor.caret = [a, b];
}

// dir +1 = jadikan sub-poin (geser ke kanan), -1 = naikkan satu tingkat. Baris biasa ikut dijadikan poin.
function indentLines(dir) {
  const { ta, a, b, start, end } = selectedLines();
  const lines = ta.value.slice(start, end).split('\n');
  let shiftA = 0, shiftTotal = 0;
  const out = lines.map((line, k) => {
    let next = line;
    if (dir > 0) next = LIST_LINE.test(line) ? LIST_STEP + line : line.trim() ? line.replace(/^([ \t]*)/, '$1- ') : line;
    else next = line.replace(/^(\t| {1,2})/, '');
    if (k === 0) shiftA = next.length - line.length;
    shiftTotal += next.length - line.length;
    return next;
  });
  replaceLines(ta, start, end, out.join('\n'), Math.max(start, a + shiftA), b + shiftTotal);
}

// Jadikan baris poin, atau kembalikan poin menjadi teks biasa.
function toggleBullet() {
  const { ta, a, b, start, end } = selectedLines();
  const lines = ta.value.slice(start, end).split('\n');
  const allList = lines.filter((l) => l.trim()).every((l) => LIST_LINE.test(l));
  let shiftA = 0, shiftTotal = 0;
  const out = lines.map((line, k) => {
    const next = allList ? line.replace(LIST_LINE, '$1') : LIST_LINE.test(line) || !line.trim() ? line : line.replace(/^([ \t]*)/, '$1- ');
    if (k === 0) shiftA = next.length - line.length;
    shiftTotal += next.length - line.length;
    return next;
  });
  replaceLines(ta, start, end, out.join('\n'), Math.max(start, a + shiftA), b + shiftTotal);
}

// Enter di baris poin: buat poin baru setingkat. Enter di poin kosong: naik satu tingkat, atau keluar dari daftar.
function continueList(e) {
  const ta = e.target;
  if (ta.selectionStart !== ta.selectionEnd) return;
  const pos = ta.selectionStart;
  const start = ta.value.lastIndexOf('\n', pos - 1) + 1;
  const line = ta.value.slice(start, pos);
  const m = line.match(LIST_LINE);
  if (!m) return;
  e.preventDefault();
  const nl = ta.value.indexOf('\n', pos);
  const end = nl === -1 ? ta.value.length : nl;
  if (!line.slice(m[0].length).trim() && !ta.value.slice(pos, end).trim()) {
    const up = m[1] ? m[1].replace(/(\t| {1,2})$/, '') + '- ' : '';
    replaceLines(ta, start, end, up, start + up.length, start + up.length);
    return;
  }
  const ins = '\n' + m[1] + '- ';
  ta.setRangeText(ins, pos, pos, 'end');
  ta.dispatchEvent(new Event('input'));
  if (state.editor) state.editor.caret = [ta.selectionStart, ta.selectionEnd];
}

function renderEditorMedia() {
  const box = $('#e-media');
  if (!box) return;
  box.innerHTML = '';
  const inTextIds = inlineImageIds($('#e-body')?.value);
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
        <small>${m.kind === 'doc' ? `${esc(m.name)} · ${m.pageCount ? m.pageCount + ' ' + pageUnit(m) + ' · ' : ''}` : m.kind === 'image' ? 'Foto · ' : m.kind === 'video' ? 'Video · ' : 'Audio · '}${fmtSize(m.size)}${m.kind === 'doc' && m.docType !== 'other' && !(m.docPages || []).join('').trim() ? ' · isi tidak terbaca' : ''}${m.kind === 'image' && inTextIds.has(m.id) ? ' · di dalam teks' : ''}</small>
        ${m.kind === 'image' && !inTextIds.has(m.id) ? '<button type="button" class="linkbtn e-inline">↩︎ Sisipkan ke teks</button>' : ''}
      </div>
      <button type="button" class="iconbtn e-del" aria-label="Hapus lampiran">🗑️</button>`;
    row.querySelector('input').oninput = (e) => { m.caption = e.target.value; m.dirty = true; state.editor.dirty = true; };
    const ins = row.querySelector('.e-inline');
    if (ins) ins.onclick = () => { insertIntoBody(`![${(m.caption || '').replace(/[\[\]]/g, '')}](img:${m.id})`); renderEditorMedia(); };
    row.querySelector('.e-del').onclick = () => {
      const bodyEl = $('#e-body');
      if (bodyEl && inTextIds.has(m.id)) {
        bodyEl.value = bodyEl.value.replace(new RegExp(`\\n*!\\[[^\\]]*\\]\\(img:${m.id}\\)[ \\t]*`, 'g'), '');
        bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
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
  touch(n);
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
  const feedHtml = await feedSectionHtml();
  // Halaman ini dirender asinkron; jangan menimpa tampilan lain bila pengguna sudah pindah.
  if (location.hash !== '#/pengaturan') return;
  view().innerHTML = `
    <div class="topbar"><a href="#/" class="iconbtn" aria-label="Kembali" title="Kembali">${icon('back')}</a><span class="grow title">Pengaturan</span></div>
    <div class="settings">
      <section>
        <h4>Penyimpanan di Perangkat Ini</h4>
        <p>${state.notes.size} catatan · ${state.mediaMeta.size} lampiran${est ? ` · terpakai ${fmtSize(est.usage || 0)}` : ''}</p>
        <p>Penyimpanan permanen: <b>${persisted === null ? 'tidak diketahui' : persisted ? 'aktif ✓' : 'belum aktif'}</b>${standalone ? '' : '. Pasang aplikasi ke layar utama agar iPhone tidak menghapus data saat memori menipis.'}</p>
      </section>
      ${standalone ? '' : `<section class="install">
        <h4>Pasang di iPhone (Sekali Saja)</h4>
        <ol><li>Buka halaman ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambah ke Layar Utama</b>.</li></ol>
        <p>Setelah itu aplikasi terbuka seperti app biasa dan berjalan tanpa internet.</p>
      </section>`}
      ${syncHtml}
      ${feedHtml}
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
  bindFeedSection();
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
      const inline = inlineImageIds(n.body);
      const paths = new Map();
      const tail = [];
      for (const mid of n.mediaIds) {
        const m = await db.getMedia(mid);
        if (!m) continue;
        const path = `media/${m.id}.${extFor(m)}`;
        const { blob, thumb, ...meta } = m;
        mediaList.push({ ...meta, path });
        entries.push({ name: path, data: blob });
        paths.set(m.id, path);
        if (!inline.has(m.id)) tail.push(`![[${path}]]${m.caption ? ' ' + m.caption : ''}`);
      }
      // Gambar di dalam teks diubah ke format Obsidian agar tampil di tempatnya.
      const mdBody = n.body.replace(IMG_REF_G, (all, cap, id) => (paths.has(id) ? `![[${paths.get(id)}]]${cap ? '\n' + cap : ''}` : cap));
      const lines = ['---', `jenis: ${n.type}`, `stase: ${n.stase || ''}`, `tag: [${n.tags.map((t) => JSON.stringify(t)).join(', ')}]`, `dibuat: ${new Date(n.created).toISOString()}`, `diubah: ${new Date(n.updated).toISOString()}`, '---', '', `# ${n.title}`, '', mdBody, '', ...tail];
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
  document.body.dataset.view = page || 'home';
  window.scrollTo(0, 0);
  switch (page) {
    case 'catatan': return renderNote(arg);
    case 'baru': return arg ? renderEditor(null, arg) : renderNewPicker();
    case 'tempel': return renderPaste();
    case 'alat': return arg === 'bmi' ? renderBmi() : arg === 'puyer' ? renderPuyer() : arg === 'cairan' ? renderFluid() : renderTools();
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
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e' && view().querySelector('.modebar')) {
    e.preventDefault();
    switchMode();
    return;
  }
  if (mod && !e.shiftKey && e.key.toLowerCase() === 's' && state.editor && $('#e-body')) {
    e.preventDefault();
    saveEditor();
    return;
  }
  if ((e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
    e.preventDefault();
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    setTimeout(() => $('#q')?.focus(), 0);
  }
});

window.addEventListener('beforeunload', (e) => {
  if (state.editor?.dirty) { e.preventDefault(); e.returnValue = ''; }
});


// ---------- Auto updates ----------
// Claude menulis rangkuman ilmu baru (berdasarkan guideline/buku/jurnal) ke feed/ilmu.json di situs ini secara terjadwal,
// lengkap dengan gambar/ilustrasi (feed/img) dan guideline terkait. Aplikasi memeriksanya saat dibuka dan online,
// lalu menambahkannya sebagai catatan bertag #auto-updates.

const FEED_URL = 'feed/ilmu.json';
const FEED_TAG = 'auto-updates';
const LEGACY_FEED_TAG = 'ilmu-baru';
let feedChecking = false;

const isFreshNote = (n) => n.id.startsWith('ilmu-') || n.tags.includes(FEED_TAG);
const hasFreshNotes = () => [...state.notes.values()].some(isFreshNote);

// Tag lama #ilmu-baru diganti #auto-updates. Waktu "diubah" tidak disentuh agar tidak memicu sinkron ulang.
function migrateFeedTag(n) {
  if (!n.tags?.includes(LEGACY_FEED_TAG)) return false;
  n.tags = [...new Set(n.tags.map((t) => (t === LEGACY_FEED_TAG ? FEED_TAG : t)))];
  return true;
}

const feedRev = (it) => Math.max(1, parseInt(it.rev, 10) || 1);
const feedUpdated = (it) => Date.parse(it.revised) || Date.parse(it.created) || Date.now();

async function fetchFeedImage(img) {
  const url = new URL(String(img.file || img.url || ''), new URL(FEED_URL, location.href)).href;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let blob = await res.blob();
  if (/\.svg(\?|$)/i.test(url) && blob.type !== 'image/svg+xml') blob = new Blob([blob], { type: 'image/svg+xml' });
  return blob;
}

// Mengembalikan { note, media } untuk satu item feed. Gambar yang gagal diambil dilewati.
async function feedItemToNote(it, id) {
  const type = TYPES[it.type] ? it.type : 'topik';
  const rev = feedRev(it);
  const media = [];
  const refs = [];
  const images = (it.images || []).filter((x) => x && (x.file || x.url)).slice(0, 6);
  for (let k = 0; k < images.length; k++) {
    const img = images[k];
    try {
      const raw = await fetchFeedImage(img);
      const { blob, thumb } = await processImage(raw);
      const caption = [img.caption, img.credit].filter(Boolean).join(' · ').slice(0, 300);
      const mid = `${id}-r${rev}-img${k + 1}`;
      const name = String(img.file || img.url).split('/').pop().split('?')[0] || 'gambar';
      media.push({ id: mid, noteId: id, kind: 'image', name, mime: blob.type || raw.type || 'image/png', size: blob.size, caption, blob, thumb, created: feedUpdated(it) + k });
      refs[k] = `![${caption.replace(/[\[\]]/g, '')}](img:${mid})`;
    } catch (e) {
      console.warn('Gambar feed', img, e);
    }
  }
  let body = String(it.body || '').replace(/\s+$/, '');
  // {{gambar:N}} di body diganti gambar ke-N; gambar yang tidak disebut ditaruh di bawah label "Gambar:".
  const placed = new Set();
  body = body.replace(/^[ \t]*\{\{\s*gambar\s*:\s*(\d+)\s*\}\}[ \t]*$/gim, (_, n) => {
    const k = parseInt(n, 10) - 1;
    if (!refs[k]) return '';
    placed.add(k);
    return refs[k];
  }).replace(/\n{3,}/g, '\n\n');
  const rest = refs.filter((r, k) => r && !placed.has(k));
  if (rest.length) body += '\n\nGambar:\n' + rest.join('\n\n');
  const guidelines = (it.guidelines || []).filter((x) => x && (x.title || x.url));
  if (guidelines.length) {
    body += '\n\nGuideline terkait:\n' + guidelines.map((x) => `- ${[x.org, x.title, x.year].filter(Boolean).join(', ')}${x.url ? ` (${x.url})` : ''}`).join('\n');
  }
  const sources = (it.sources || []).filter((x) => x && (x.title || x.url));
  if (sources.length && !/^Sumber:\s*$/m.test(body)) {
    body += '\n\nSumber:\n' + sources.map((x) => `- ${[x.title, x.publisher, x.year].filter(Boolean).join(', ')}${x.url ? ` (${x.url})` : ''}`).join('\n');
  }
  // created/updated diambil dari feed agar dua perangkat yang mengimpor item yang sama menghasilkan catatan identik saat sinkron.
  const note = {
    id, type, title: String(it.title).slice(0, 200), body: body.trim(),
    tags: [...new Set([...(it.tags || []).map(String), FEED_TAG])],
    stase: it.stase || '', pinned: false, created: Date.parse(it.created) || Date.now(), updated: feedUpdated(it),
  };
  return { note, media };
}

async function checkFeed({ manual = false } = {}) {
  if (feedChecking || !navigator.onLine) { if (manual && !navigator.onLine) toast('Perlu internet untuk mengambil auto updates'); return; }
  if (!manual && (await db.getMeta('feedEnabled')) === false) return;
  feedChecking = true;
  try {
    const res = await fetch(`${FEED_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404) { if (manual) toast('Belum ada auto updates baru'); return; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const feed = await res.json();
    const imported = new Set((await db.getMeta('feedImported')) || []);
    const revs = (await db.getMeta('feedRevs')) || {};
    const tomb = new Set(((await db.getMeta('tombstones')) || []).map((x) => x.id));
    let added = 0;
    let revised = 0;
    for (const it of feed.items || []) {
      if (!it || !it.id || !it.title || !it.body) continue;
      const id = 'ilmu-' + String(it.id).replace(/[^\w-]/g, '').slice(0, 60);
      const rev = feedRev(it);
      if (tomb.has(id)) { imported.add(id); continue; } // sudah kamu hapus: tidak ditambahkan lagi
      const existing = state.notes.get(id);
      if (imported.has(id) || existing) {
        imported.add(id);
        const known = revs[id] || { rev: 1, updated: existing ? existing.created : 0 };
        if (!existing || rev <= known.rev) continue;
        // Revisi (mis. tambahan gambar/guideline) hanya dipasang bila catatannya belum kamu ubah.
        if (existing.updated === feedUpdated(it)) { revs[id] = { rev, updated: existing.updated }; continue; } // sudah tiba lewat sinkron
        if (existing.updated !== known.updated) { revs[id] = { rev, updated: known.updated }; continue; }
        const { note, media } = await feedItemToNote(it, id);
        const remove = existing.mediaIds.filter((m) => !media.some((x) => x.id === m));
        await db.saveNote(note, media, [], remove);
        remove.forEach((m) => state.mediaMeta.delete(m));
        media.forEach(({ blob, thumb, ...meta }) => state.mediaMeta.set(meta.id, meta));
        note.mediaIds = media.map((m) => m.id);
        state.notes.set(id, note);
        indexNote(note);
        revs[id] = { rev, updated: note.updated };
        state.feedUnread.add(id);
        revised++;
        continue;
      }
      const { note, media } = await feedItemToNote(it, id);
      await db.saveNote(note, media);
      media.forEach(({ blob, thumb, ...meta }) => state.mediaMeta.set(meta.id, meta));
      note.mediaIds = media.map((m) => m.id);
      state.notes.set(id, note);
      indexNote(note);
      imported.add(id);
      revs[id] = { rev, updated: note.updated };
      state.feedUnread.add(id);
      added++;
    }
    await db.setMeta('feedImported', [...imported]);
    await db.setMeta('feedRevs', revs);
    await db.setMeta('feedUnread', [...state.feedUnread]);
    await db.setMeta('feedChecked', Date.now());
    if (added || revised) {
      const parts = [];
      if (added) parts.push(`${added} catatan baru`);
      if (revised) parts.push(`${revised} catatan diperbarui`);
      toast(`✨ Auto updates: ${parts.join(', ')}`, 4000);
      scheduleSync();
      if (!location.hash || location.hash === '#/') renderHome();
    } else if (manual) toast('Belum ada auto updates baru');
  } catch (e) {
    console.warn('Feed', e);
    if (manual) toast('Gagal memeriksa auto updates: ' + (e?.message || e), 5000);
  } finally {
    feedChecking = false;
  }
}

async function feedSectionHtml() {
  const enabled = (await db.getMeta('feedEnabled')) !== false;
  const checked = await db.getMeta('feedChecked');
  const count = [...state.notes.values()].filter(isFreshNote).length;
  return `<section>
    <h4>✨ Auto updates</h4>
    <p>Setiap 4 jam (05.00-23.00 WIB) Claude merangkum satu topik dari guideline, buku ajar, atau jurnal tepercaya, lengkap dengan sumber, guideline terkait, dan gambar atau ilustrasi yang relevan (mis. contoh EKG). Rangkuman itu otomatis masuk ke catatanmu (tag <b>#${FEED_TAG}</b>) saat aplikasi dibuka dan ada internet.</p>
    <label class="switch-row"><input type="checkbox" id="feed-on" ${enabled ? 'checked' : ''}> Terima auto updates</label>
    <p class="hint">${count} catatan auto updates · terakhir diperiksa ${checked ? fmtDate(checked) + ' ' + new Date(checked).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'belum pernah'}</p>
    <div class="row"><button class="btn ghost" id="feed-check">Periksa sekarang</button></div>
  </section>`;
}

function bindFeedSection() {
  $('#feed-on')?.addEventListener('change', async (e) => {
    await db.setMeta('feedEnabled', e.target.checked);
    toast(e.target.checked ? 'Auto updates aktif' : 'Auto updates dimatikan');
    if (e.target.checked) checkFeed();
  });
  $('#feed-check')?.addEventListener('click', () => checkFeed({ manual: true }));
}

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
  return `<section class="sync"><h4>Sinkron iPhone & Laptop (Google Drive)</h4>${inner}<p class="sync-status" id="g-status"></p></section>`;
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

// Keyboard iPhone menutupi elemen fixed di bawah; tombol mode dinaikkan setinggi keyboard.
function trackKeyboard() {
  const appbarH = () => document.documentElement.style.setProperty('--appbar-h', ($('.appbar')?.offsetHeight || 56) + 'px');
  appbarH();
  window.addEventListener('resize', appbarH);
  const vv = window.visualViewport;
  if (!vv) return;
  const set = () => document.documentElement.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px');
  vv.addEventListener('resize', set);
  vv.addEventListener('scroll', set);
  set();
}

// ---------- Pembaruan aplikasi ----------
// Service worker baru langsung mengambil alih (skipWaiting + clients.claim). Saat itu terjadi, tampilkan ajakan memuat ulang
// agar versi baru terpakai tanpa harus menutup-buka aplikasi dua kali. Tidak memuat ulang otomatis supaya tulisan tidak hilang.
function watchForUpdates() {
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller; // pemasangan pertama kali bukan "pembaruan"
  sw.register('sw.js').then((reg) => {
    // Aplikasi di iPhone sering dilanjutkan, bukan dibuka ulang; periksa pembaruan setiap kali kembali tampil.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  sw.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
}

function showUpdateBanner() {
  if ($('#updbar')) return;
  const bar = document.createElement('div');
  bar.id = 'updbar';
  bar.className = 'updbar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>Versi baru tersedia.</span><button type="button" class="btn small" data-act="reload">Muat ulang</button><button type="button" class="iconbtn" data-act="later" aria-label="Nanti saja" title="Nanti saja">${icon('x')}</button>`;
  bar.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'later') bar.remove();
    if (act !== 'reload') return;
    // Tulisan di editor disimpan dulu agar tidak hilang saat memuat ulang.
    if (state.editor?.dirty && $('#e-body') && !(await saveEditor(false))) return;
    state.editor = null;
    location.reload();
  });
  document.body.appendChild(bar);
}

async function start() {
  trackKeyboard();
  let authResult = null;
  try {
    authResult = await sync.handleAuthRedirect();
  } catch (e) {
    authResult = 'Login Google gagal: ' + (e?.message || e);
  }
  try {
    await loadAll();
  } catch (e) {
    view().innerHTML = `<div class="empty"><h2>Penyimpanan Tidak Bisa Dibuka</h2><p>${esc(e?.message || e)}. Jika memakai mode Private di Safari, buka di tab biasa.</p></div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();
  route();
  await updateSyncBadge();
  $('#syncbtn').onclick = () => runSync({ manual: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { runSync(); checkFeed(); } });
  window.addEventListener('online', () => { runSync(); checkFeed(); });
  checkFeed();
  setInterval(() => document.visibilityState === 'visible' && checkFeed(), 30 * 60 * 1000);
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
    watchForUpdates();
  }
}

start();
