// Dokumen (PDF, Word, PowerPoint, Excel, teks): deteksi jenis, ekstraksi teks untuk pencarian, dan render PDF.
import { readZip, entryBlob } from './zip.js';
import { toMarkdown, readXlsx, fromCsv } from './table.js';

const PDFJS_BASE = new URL('../vendor/pdfjs/', import.meta.url).href;
let pdfjsPromise = null;

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_BASE + 'pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs';
      return m;
    });
  }
  return pdfjsPromise;
}

export function closePdf(pdf) {
  try { (pdf?.loadingTask || pdf)?.destroy?.(); } catch {}
}

export async function openPdf(blob) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  return pdfjs.getDocument({
    data,
    standardFontDataUrl: PDFJS_BASE + 'standard_fonts/',
    wasmUrl: PDFJS_BASE + 'wasm/',
    isEvalSupported: false,
  }).promise;
}

const DOC_EXT = {
  pdf: 'pdf',
  docx: 'docx', docm: 'docx', dotx: 'docx',
  pptx: 'pptx', ppsx: 'pptx',
  txt: 'text', md: 'text', csv: 'text', rtf: 'other',
  doc: 'other', ppt: 'other', xls: 'other', xlsx: 'xlsx', xlsm: 'xlsx', odt: 'other', pages: 'other', key: 'other',
};

export const DOC_ACCEPT = '.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.rtf,.odt,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain';

export const DOC_LABEL = { pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', xlsx: 'Excel', text: 'Teks', other: 'Dokumen' };

export function docTypeOf(file) {
  const ext = (file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext && DOC_EXT[ext]) return DOC_EXT[ext];
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.includes('wordprocessingml')) return 'docx';
  if (file.type.includes('presentationml')) return 'pptx';
  if (file.type.includes('spreadsheetml')) return 'xlsx';
  if (file.type === 'application/msword') return 'other';
  if (file.type.startsWith('text/')) return 'text';
  return null;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

async function zipText(files, name) {
  const b = await entryBlob(files.get(name));
  return b ? b.text() : '';
}

function wordParagraphs(xmlText) {
  const doc = parseXml(xmlText);
  const out = [];
  const paraText = (p) => {
    let line = '';
    const walk = (node) => {
      for (const c of node.childNodes) {
        if (c.namespaceURI === W_NS && c.localName === 't') line += c.textContent;
        else if (c.namespaceURI === W_NS && c.localName === 'tab') line += '\t';
        else if (c.namespaceURI === W_NS && (c.localName === 'br' || c.localName === 'cr')) line += '\n';
        else if (c.namespaceURI === W_NS && c.localName === 'p') continue; // paragraf bersarang diproses sendiri
        else if (c.nodeType === 1) walk(c);
      }
    };
    walk(p);
    return line;
  };
  // Tabel Word menjadi tabel Markdown; isi sel yang berparagraf digabung dengan spasi.
  const tableRows = (tbl) => [...tbl.childNodes].filter((n) => n.localName === 'tr').map((tr) =>
    [...tr.childNodes].filter((n) => n.localName === 'tc').flatMap((tc) => {
      const text = [...tc.getElementsByTagNameNS(W_NS, 'p')].map(paraText).filter((t) => t.trim()).join(' ');
      const span = parseInt(tc.getElementsByTagNameNS(W_NS, 'gridSpan')[0]?.getAttributeNS(W_NS, 'val'), 10) || 1;
      return [text, ...Array(span - 1).fill('')];
    }));
  const visit = (node) => {
    for (const c of node.childNodes) {
      if (c.namespaceURI !== W_NS) { if (c.nodeType === 1) visit(c); continue; }
      if (c.localName === 'p') out.push(paraText(c));
      else if (c.localName === 'tbl') { const md = toMarkdown(tableRows(c)); if (md) out.push('', md, ''); }
      else visit(c);
    }
  };
  visit(doc.documentElement);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractDocx(blob) {
  const files = await readZip(blob);
  const parts = [await zipText(files, 'word/document.xml')];
  for (const extra of ['word/footnotes.xml', 'word/endnotes.xml']) {
    if (files.has(extra)) parts.push(await zipText(files, extra));
  }
  const text = parts.filter(Boolean).map(wordParagraphs).filter(Boolean).join('\n\n');
  return { pages: [text], pageCount: null };
}

async function extractPptx(blob) {
  const files = await readZip(blob);
  const slides = [...files.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  const pages = [];
  for (const name of slides) {
    const doc = parseXml(await zipText(files, name));
    const lines = [...doc.getElementsByTagNameNS(A_NS, 'p')].map((p) =>
      [...p.getElementsByTagNameNS(A_NS, 't')].map((t) => t.textContent).join(''));
    pages.push(lines.filter((l) => l.trim()).join('\n'));
  }
  return { pages, pageCount: pages.length };
}

async function extractPdf(blob, onProgress) {
  const pdf = await openPdf(blob);
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let text = '';
    for (const item of tc.items) {
      if (!('str' in item)) continue;
      text += item.str + (item.hasEOL ? '\n' : item.str && !item.str.endsWith(' ') ? ' ' : '');
    }
    pages.push(text.replace(/[ \t]+\n/g, '\n').trim());
    page.cleanup();
    onProgress?.(i, pdf.numPages);
  }
  let thumb = null;
  try {
    thumb = await renderPdfPageToBlob(pdf, 1, 360);
  } catch {}
  closePdf(pdf);
  return { pages, pageCount: pages.length, thumb };
}

export async function renderPdfPageToBlob(pdf, pageNo, width, quality = 0.75) {
  const page = await pdf.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

const IMG_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };

// Gambar yang tertanam di file Word / PowerPoint / Excel (folder media di dalam ZIP-nya).
// Format vektor Office (EMF/WMF) dilewati karena tidak bisa ditampilkan browser.
export async function extractDocImages(blob) {
  const files = await readZip(blob);
  const out = [];
  for (const [name, entry] of files) {
    const mm = name.match(/^(?:word|ppt|xl)\/media\/([^/]+)\.([a-z0-9]+)$/i);
    if (!mm || !IMG_MIME[mm[2].toLowerCase()]) continue;
    const b = await entryBlob(entry);
    if (!b || b.size < 2000) continue; // ikon/garis kecil tidak berguna
    out.push({ name: `${mm[1]}.${mm[2]}`, blob: new Blob([b], { type: IMG_MIME[mm[2].toLowerCase()] }) });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
}

// Mengembalikan { pages: [teks per halaman], pageCount, thumb? }. Tidak pernah melempar galat:
// dokumen yang tidak bisa dibaca tetap disimpan utuh, hanya isinya tidak ikut dicari.
export async function extractDocument(file, docType, onProgress) {
  try {
    if (docType === 'pdf') return await extractPdf(file, onProgress);
    if (docType === 'docx') return await extractDocx(file);
    if (docType === 'pptx') return await extractPptx(file);
    if (docType === 'xlsx') {
      const sheets = await readXlsx(file);
      return { pages: sheets.map((sh) => `${sh.name}\n\n${toMarkdown(sh.rows)}`), pageCount: sheets.length };
    }
    if (docType === 'text') {
      const t = await file.text();
      return { pages: [/\.csv$/i.test(file.name || '') ? toMarkdown(fromCsv(t)) || t : t], pageCount: null };
    }
  } catch (e) {
    console.warn('Ekstraksi gagal', file.name, e);
    return { pages: [], pageCount: null, error: String(e?.message || e) };
  }
  return { pages: [], pageCount: null };
}

// Posisi kata yang cocok di satu halaman PDF, dalam pecahan lebar/tinggi halaman (0..1),
// agar sorotan tetap pas di semua tingkat zoom. Urutannya mengikuti urutan teks halaman.
let measureCtx = null;
export async function pageMatchRects(page, isMatch) {
  const pdfjs = await loadPdfjs();
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  measureCtx ||= document.createElement('canvas').getContext('2d');
  const rects = [];
  for (const item of tc.items) {
    if (!item.str) continue;
    const words = [...item.str.matchAll(/[\p{L}\p{N}]+/gu)].filter((w) => isMatch(w[0]));
    if (!words.length) continue;
    const tx = pdfjs.Util.transform(vp.transform, item.transform);
    const fontH = Math.hypot(tx[2], tx[3]);
    if (!fontH || Math.abs(tx[1]) > Math.abs(tx[0])) continue; // teks miring/vertikal dilewati
    measureCtx.font = `${Math.max(8, fontH)}px ${item.fontName && tc.styles[item.fontName]?.fontFamily || 'sans-serif'}`;
    const full = measureCtx.measureText(item.str).width || 1;
    const totalW = item.width || full;
    for (const w of words) {
      const x0 = (measureCtx.measureText(item.str.slice(0, w.index)).width / full) * totalW;
      const ww = (measureCtx.measureText(w[0]).width / full) * totalW;
      rects.push({
        x: (tx[4] + x0 - 1) / vp.width,
        y: (tx[5] - fontH * 0.82) / vp.height,
        w: (ww + 2) / vp.width,
        h: (fontH * 1.08) / vp.height,
      });
    }
  }
  return rects;
}
