// Tabel di catatan disimpan sebagai tabel Markdown (| a | b |) agar tetap terbaca di Obsidian
// dan ikut dicari. Modul ini mengurai, membuat, dan mengonversi tabel dari Excel, Word, web, CSV.
import { readZip, entryBlob } from './zip.js';

const SEP_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

export function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

export function isSeparator(line) {
  return SEP_RE.test(line) && line.includes('-') && line.includes('|');
}

function splitRow(line) {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; }
    else if (s[i] === '|') { cells.push(cur.trim()); cur = ''; }
    else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

// Membagi teks menjadi blok: { type: 'text', lines } atau { type: 'table', rows, header }.
// Tabel = minimal 2 baris berawalan & berakhiran "|". Baris pemisah (---) menandai baris judul.
export function splitBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableRow(lines[i + 1])) {
      const tl = [];
      while (i < lines.length && isTableRow(lines[i])) tl.push(lines[i++]);
      const header = tl.length > 1 && isSeparator(tl[1]);
      const rows = tl.filter((l, k) => !(k === 1 && header) && !isSeparator(l)).map(splitRow);
      blocks.push({ type: 'table', rows: normalize(rows), header });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'text') last.lines.push(lines[i]);
    else blocks.push({ type: 'text', lines: [lines[i]] });
    i++;
  }
  return blocks;
}

// Semua baris dibuat sama panjang dan baris/kolom kosong di ujung dibuang.
export function normalize(rows) {
  rows = rows.map((r) => r.map((c) => String(c ?? '').replace(/\s*\n\s*/g, ' ').trim()));
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
  let w = Math.max(0, ...rows.map((r) => r.length));
  while (w > 1 && rows.every((r) => !r[w - 1])) w--;
  let lead = 0;
  while (lead < w - 1 && rows.every((r) => !r[lead])) lead++;
  return rows.map((r) => Array.from({ length: w - lead }, (_, k) => r[k + lead] || ''));
}

const width = (s) => [...s].length;

export function toMarkdown(rows) {
  rows = normalize(rows);
  if (!rows.length || !rows[0].length) return '';
  const esc = (c) => c.replace(/\|/g, '\\|');
  const cells = rows.map((r) => r.map(esc));
  // Kolom dirapikan supaya tabel tetap enak dibaca di kotak teks editor (dibatasi agar tidak terlalu lebar).
  const w = cells[0].map((_, k) => Math.min(24, Math.max(3, ...cells.map((r) => width(r[k])))));
  const line = (r) => '| ' + r.map((c, k) => c + ' '.repeat(Math.max(0, w[k] - width(c)))).join(' | ') + ' |';
  return [line(cells[0]), '| ' + w.map((n) => '-'.repeat(n)).join(' | ') + ' |', ...cells.slice(1).map(line)].join('\n');
}

// Tabel Markdown yang mengandung posisi kursor: { start, end, rows } (start/end = indeks karakter).
export function tableAt(text, pos) {
  const lines = text.split('\n');
  let off = 0;
  let idx = -1;
  const starts = [];
  for (let k = 0; k < lines.length; k++) {
    starts.push(off);
    if (pos >= off && pos <= off + lines[k].length) idx = k;
    off += lines[k].length + 1;
  }
  if (idx < 0 || !isTableRow(lines[idx])) return null;
  let a = idx; let b = idx;
  while (a > 0 && isTableRow(lines[a - 1])) a--;
  while (b < lines.length - 1 && isTableRow(lines[b + 1])) b++;
  if (a === b) return null;
  const block = splitBlocks(lines.slice(a, b + 1).join('\n'))[0];
  return { start: starts[a], end: starts[b] + lines[b].length, rows: block.rows };
}

// ---------- Konversi dari sumber lain ----------

// Teks dari Excel/Numbers/Google Sheets: kolom dipisah tab. Sel bertanda kutip boleh berisi baris baru.
export function fromDelimited(text, delim) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && !cell) q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return normalize(rows);
}

// Menebak pemisah CSV (koma, titik koma ala Excel Indonesia, atau tab).
export function fromCsv(text) {
  const first = text.split('\n').slice(0, 5).join('\n');
  const count = (c) => first.split(c).length - 1;
  const delim = ['\t', ';', ','].sort((x, y) => count(y) - count(x))[0];
  return fromDelimited(text, delim);
}

// Apakah teks tempelan terlihat seperti tabel dari spreadsheet (≥ 2 baris, tiap baris punya tab)?
export function looksTabular(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  return lines.length >= 2 && lines.filter((l) => l.includes('\t')).length >= Math.ceil(lines.length * 0.6);
}

// Tabel HTML (dari Word, halaman web, Google Docs). Sel gabungan (colspan) diulang kosong.
export function tablesFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('table')].filter((t) => !t.parentElement.closest('table')).map((t) => {
    const rows = [];
    for (const tr of t.querySelectorAll('tr')) {
      if (tr.closest('table') !== t) continue;
      const row = [];
      for (const td of tr.children) {
        if (!/^T[DH]$/.test(td.tagName)) continue;
        row.push(td.innerText ?? td.textContent);
        for (let k = 1; k < (parseInt(td.getAttribute('colspan'), 10) || 1); k++) row.push('');
      }
      rows.push(row.map((c) => String(c || '').replace(/\s+/g, ' ').trim()));
    }
    return normalize(rows);
  }).filter((r) => r.length);
}

// ---------- Excel (.xlsx) ----------

const S_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function fmtNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  // Hilangkan galat pecahan biner (0.30000000000000004) dan pakai koma desimal.
  return String(parseFloat(n.toPrecision(12))).replace('.', ',');
}

// Mengembalikan [{ name, rows }] untuk setiap sheet.
export async function readXlsx(blob) {
  const files = await readZip(blob);
  const text = async (name) => { const e = files.get(name); return e ? (await entryBlob(e)).text() : ''; };
  const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
  const shared = [];
  const ss = await text('xl/sharedStrings.xml');
  if (ss) {
    for (const si of xml(ss).getElementsByTagNameNS(S_NS, 'si')) {
      // Teks berformat (rich text) punya beberapa <t>; fonetik (<rPh>) dilewati.
      shared.push([...si.getElementsByTagNameNS(S_NS, 't')].filter((t) => t.parentNode.localName !== 'rPh').map((t) => t.textContent).join(''));
    }
  }
  const wb = xml(await text('xl/workbook.xml'));
  const rels = xml(await text('xl/_rels/workbook.xml.rels'));
  const target = {};
  for (const r of rels.getElementsByTagName('Relationship')) target[r.getAttribute('Id')] = r.getAttribute('Target');
  const sheets = [];
  for (const s of wb.getElementsByTagNameNS(S_NS, 'sheet')) {
    let path = target[s.getAttributeNS(R_NS, 'id')] || '';
    path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, '');
    const doc = xml(await text(path));
    const rows = [];
    for (const row of doc.getElementsByTagNameNS(S_NS, 'row')) {
      const r = parseInt(row.getAttribute('r'), 10) - 1;
      const cells = rows[r] = rows[r] || [];
      let next = 0;
      for (const c of row.getElementsByTagNameNS(S_NS, 'c')) {
        const ref = c.getAttribute('r');
        const k = ref ? colIndex(ref) : next;
        next = k + 1;
        const t = c.getAttribute('t');
        const v = c.getElementsByTagNameNS(S_NS, 'v')[0]?.textContent ?? '';
        let val;
        if (t === 's') val = shared[parseInt(v, 10)] ?? '';
        else if (t === 'inlineStr') val = [...c.getElementsByTagNameNS(S_NS, 't')].map((x) => x.textContent).join('');
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') val = v;
        else val = v === '' ? '' : fmtNumber(v);
        cells[k] = val;
      }
    }
    const filled = normalize(Array.from(rows, (r) => r || []));
    // Baris kosong di awal sheet dibuang.
    while (filled.length && filled[0].every((c) => !c)) filled.shift();
    if (filled.length) sheets.push({ name: s.getAttribute('name') || `Sheet ${sheets.length + 1}`, rows: filled });
  }
  return sheets;
}

// Teks tempelan campuran (mis. dari Word): deretan ≥ 2 baris yang berisi tab diubah menjadi tabel Markdown,
// baris lainnya dibiarkan. Mengembalikan { text, count }.
export function convertTabRuns(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let count = 0;
  for (let i = 0; i < lines.length;) {
    if (lines[i].includes('\t') && lines[i + 1]?.includes('\t')) {
      const run = [];
      while (i < lines.length && lines[i].includes('\t')) run.push(lines[i++]);
      const md = toMarkdown(run.map((l) => l.split('\t')));
      if (md) {
        if (out.length && out[out.length - 1].trim()) out.push('');
        out.push(md);
        if (i < lines.length && lines[i].trim()) out.push('');
        count++;
      }
      continue;
    }
    out.push(lines[i++]);
  }
  return { text: out.join('\n'), count };
}
