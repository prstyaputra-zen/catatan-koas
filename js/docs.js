// Dokumen (PDF, Word, PowerPoint, teks): deteksi jenis, ekstraksi teks untuk pencarian, dan render PDF.
import { readZip, entryBlob } from './zip.js';

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
  doc: 'other', ppt: 'other', xls: 'other', xlsx: 'other', odt: 'other', pages: 'other', key: 'other',
};

export const DOC_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.rtf,.odt,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain';

export const DOC_LABEL = { pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', text: 'Teks', other: 'Dokumen' };

export function docTypeOf(file) {
  const ext = (file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext && DOC_EXT[ext]) return DOC_EXT[ext];
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.includes('wordprocessingml')) return 'docx';
  if (file.type.includes('presentationml')) return 'pptx';
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
  for (const p of doc.getElementsByTagNameNS(W_NS, 'p')) {
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
    out.push(line);
  }
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

export async function renderPdfPageToBlob(pdf, pageNo, width) {
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
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75));
}

// Mengembalikan { pages: [teks per halaman], pageCount, thumb? }. Tidak pernah melempar galat:
// dokumen yang tidak bisa dibaca tetap disimpan utuh, hanya isinya tidak ikut dicari.
export async function extractDocument(file, docType, onProgress) {
  try {
    if (docType === 'pdf') return await extractPdf(file, onProgress);
    if (docType === 'docx') return await extractDocx(file);
    if (docType === 'pptx') return await extractPptx(file);
    if (docType === 'text') return { pages: [await file.text()], pageCount: null };
  } catch (e) {
    console.warn('Ekstraksi gagal', file.name, e);
    return { pages: [], pageCount: null, error: String(e?.message || e) };
  }
  return { pages: [], pageCount: null };
}
