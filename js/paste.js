// Mengubah jawaban yang disalin dari Claude (Markdown) menjadi catatan Catatan Koas.
import { convertTabRuns } from './table.js';

// Prompt yang disalin ke Claude agar rangkumannya langsung cocok dengan format aplikasi.
export const CLAUDE_PROMPT = `Salin materi dari obrolan kita untuk aplikasi catatan koas-ku, dalam bahasa Indonesia, dengan format persis seperti ini:

Judul: <judul singkat>
Jenis: <Topik / Obat / Prosedur / Kasus>
Stase: <mis. IPD, Bedah, Anak, Obgyn, Saraf>
Tag: <3-6 kata kunci, pisahkan dengan koma>

## <Bagian, mis. Definisi>
<isi bagian>

(ulangi untuk setiap bagian)

Aturan isi:
- Bila jawabanmu di obrolan ini sudah berupa materi lengkap (misalnya disusun dengan skill materi-koas-komprehensif: Definisi, Anatomi dan fisiologi terkait, Patofisiologi, Etiologi dan faktor risiko, Manifestasi klinis/Diagnosis, Tatalaksana, Komplikasi dan kapan merujuk, Analogi, Mnemonik, Poin untuk koas, Singkatan), salin SELURUH materi itu apa adanya, kata demi kata. Jangan meringkas, memendekkan, menulis ulang, menggabungkan, mengubah urutan, atau menghapus bagian mana pun. Pertahankan penomoran langkah, tabel, dosis, label "(mnemonik buatan)", dan bagian Singkatan. Yang kamu tambahkan hanya 4 baris di atas (Judul, Jenis, Stase, Tag), dan setiap judul bagian ditulis dengan "## " di depannya.
- Bila obrolan kita berupa tanya-jawab biasa, rangkum isinya per bagian yang relevan, boleh pakai poin "- ".

Aturan tabel: setiap tabel yang ada di obrolan kita WAJIB ditulis ulang sebagai tabel Markdown lengkap (semua baris dan kolom, isi sel tidak diringkas), jangan diubah menjadi poin atau paragraf. Contoh:
| Obat | Dosis |
|---|---|
| Parasetamol | 10-15 mg/kgBB |

Aturan gambar: bila materi punya gambar atau diagram, tulis SETIAP gambar sebagai kode SVG lengkap di dalam blok \`\`\`svg ... \`\`\` tepat di posisinya dalam materi, dengan satu baris keterangan "Gambar N: <keterangan>" tepat di atas bloknya. SVG: pakai viewBox dengan lebar maksimal 900, latar putih, teks minimal 13 px, tanpa gambar, font, atau link dari luar, tanpa script. Jangan mengganti gambar dengan deskripsi teks.

## Sumber
- <judul sumber> (<link>)
(salin semua sumber dan guideline yang disebut di materi)

Jangan sertakan nama pasien, No. RM, atau NIK.`;

const TYPE_WORDS = {
  topik: 'topik', materi: 'topik', penyakit: 'topik', topic: 'topik',
  obat: 'obat', drug: 'obat', farmakologi: 'obat',
  prosedur: 'prosedur', tindakan: 'prosedur', procedure: 'prosedur',
  kasus: 'kasus', case: 'kasus', bebas: 'bebas',
};

const META = /^\s*(?:\*\*)?(judul|title|jenis|tipe|type|stase|tag|tags|kata kunci)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*?)\s*(?:\*\*)?\s*$/i;

function cleanInline(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                          // gambar
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => (t.trim() === u ? u : `${t.trim()} (${u})`))
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2')         // *miring*
    .replace(/(^|\W)_(?!\s)([^_\n]+?)_(?=\W|$)/g, '$1$2')           // _miring_
    .replace(/__(.+?)__/g, '**$1**')
    .replace(/~~(.+?)~~/g, '$1');
}

// Gambar yang dikirim Claude sebagai kode SVG ikut tersalin bersama teks; aplikasi mengubahnya jadi gambar.
const CAPTION = /^\s*[*_]{0,2}\s*(?:gambar|figure|fig\.?)\s*\d+[a-z]?\s*(?:\*\*)?\s*[:.–—-]/i;
const SVG_MARK = /^\s*@@SVG(\d+)@@\s*$/;

// Membuang bagian SVG yang bisa menjalankan kode atau memuat sumber luar; gambar tetap utuh.
export function sanitizeSvg(svg) {
  let s = String(svg).trim()
    .replace(/<\?xml[^>]*>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(iframe|object|embed|audio|video)[\s\S]*?(<\/\1\s*>|\/>)/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("|')\s*(?!#|data:image\/)[^"']*\1/gi, '')
    .replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(['"]?)\s*(?!#|data:image\/)[^)]*\)/gi, 'none');
  s = s.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
    let a = attrs;
    if (!/\sxmlns\s*=/.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"';
    if (/xlink:/.test(s) && !/xmlns:xlink/.test(a)) a += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
    const vb = a.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const w = a.match(/\swidth\s*=\s*["']([^"']*)["']/i);
    const h = a.match(/\sheight\s*=\s*["']([^"']*)["']/i);
    // Lebar/tinggi persen atau kosong membuat gambar tampil 300x150: pakai ukuran viewBox.
    if (vb && (!w || /%|^\s*$/.test(w[1]))) a = a.replace(/\swidth\s*=\s*["'][^"']*["']/i, '') + ` width="${vb[1]}"`;
    if (vb && (!h || /%|^\s*$/.test(h[1]))) a = a.replace(/\sheight\s*=\s*["'][^"']*["']/i, '') + ` height="${vb[2]}"`;
    return `<svg${a}>`;
  });
  return s;
}

function svgTitle(svg) {
  const m = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
}

function cleanCaption(line) {
  return cleanInline(line.replace(/^\s*#+\s*/, '')).replace(/\*\*/g, '').replace(/^\s*_|_\s*$/g, '').replace(/:\s*$/, '').trim();
}

function isSourceHeading(h) {
  return /^(sumber|referensi|rujukan|daftar pustaka|sources?|references?)$/i.test(h.replace(/[:*]/g, '').trim());
}

function guessType(headings, text) {
  const h = headings.join(' ').toLowerCase();
  if (/dosis|golongan|kontraindikasi|efek samping/.test(h) && /dosis/.test(h + text.toLowerCase().slice(0, 600))) return 'obat';
  if (/langkah|alat (dan|&) bahan|teknik/.test(h)) return 'prosedur';
  if (/keluhan utama|anamnesis|rps\b/.test(h)) return 'kasus';
  return 'topik';
}

// Mengembalikan { title, type, stase, tags, body, sources, images }.
// Setiap gambar SVG ditandai di body sebagai baris "![keterangan](svg:N)" (N = indeks di images).
export function parseClaude(raw, { knownStase = [] } = {}) {
  const images = [];
  const takeSvg = (code) => {
    const svg = code.match(/<svg[\s>][\s\S]*<\/svg\s*>/i);
    if (!svg) return null;
    images.push({ svg: sanitizeSvg(svg[0]), caption: '' });
    return `\n@@SVG${images.length - 1}@@\n`;
  };
  let pre = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
  // Blok kode berisi SVG (```svg, ```xml, ```html, atau tanpa bahasa) dan SVG polos di luar blok kode.
  pre = pre.replace(/^[ \t]*```[\w+-]*[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/gm, (m, code) => {
    if (!/<svg[\s>]/i.test(code)) return m;
    return (/<\/svg\s*>/i.test(code) && takeSvg(code)) || '\n[Gambar tidak lengkap: kode SVG terpotong, minta Claude mengirim ulang gambar ini]\n';
  });
  pre = pre.replace(/<svg[\s>][\s\S]*?<\/svg\s*>/gi, (m) => takeSvg(m));
  // Tabel yang disalin dengan memblok teks (bukan tombol Salin) datang sebagai teks bertab: ubah jadi tabel Markdown.
  const text = convertTabRuns(pre).text.trim();
  const meta = {};
  const headings = [];
  const out = [];
  const sources = [];
  const addSource = (s) => { if (s && !sources.some((x) => x.url === s.url)) sources.push(s); };
  let inCode = false;
  let inSources = false;
  let h1 = '';
  let awaitCaption = -1;   // indeks gambar yang keterangannya mungkin ada di baris sesudahnya

  const lastFilled = () => { for (let i = out.length - 1; i >= 0; i--) if (out[i].trim()) return i; return -1; };
  const svgLine = (n) => `![${images[n].caption.replace(/[[\]]/g, '')}](svg:${n})`;

  for (let line of text.split('\n')) {
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) { out.push(line); continue; }
    const sm = line.match(SVG_MARK);
    if (sm) {
      const n = +sm[1];
      // Keterangan "Gambar 1: ..." tepat di atas gambar dipindah menjadi keterangan gambar.
      const li = lastFilled();
      if (li >= 0 && li >= out.length - 2 && CAPTION.test(out[li])) {
        images[n].caption = cleanCaption(out[li]);
        out.splice(li);
      }
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(svgLine(n));
      out.push('');
      awaitCaption = images[n].caption ? -1 : n;
      continue;
    }
    if (awaitCaption >= 0 && line.trim()) {
      const n = awaitCaption;
      awaitCaption = -1;
      if (CAPTION.test(line)) {
        images[n].caption = cleanCaption(line);
        const i = out.lastIndexOf(`![](svg:${n})`);
        if (i >= 0) out[i] = svgLine(n);
        continue;
      }
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) continue;              // garis pemisah
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)) {     // pemisah tabel
      if (line.includes('|')) out.push(line.trim());
      continue;
    }

    const m = !out.some((l) => l.trim()) && line.match(META);
    if (m && m[2]) {
      const key = m[1].toLowerCase();
      const k = key === 'title' ? 'judul' : /jenis|tipe|type/.test(key) ? 'jenis' : /tag|kata/.test(key) ? 'tag' : key;
      if (!meta[k]) { meta[k] = cleanInline(m[2]).replace(/\*\*/g, '').trim(); continue; }
    }

    line = line.replace(/^\s*>\s?/, '');
    const head = !CAPTION.test(line.replace(/^\s*#+\s*/, '')) && line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (head) {
      const t = cleanInline(head[2]).replace(/\*\*/g, '').replace(/:\s*$/, '').trim();
      if (head[1].length === 1 && !h1 && !out.some((l) => l.trim())) { h1 = t; continue; }
      inSources = isSourceHeading(t);
      if (inSources) continue;
      headings.push(t);
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(t + ':');
      continue;
    }
    // Baris tebal sendirian seperti "**Definisi**" atau "**Definisi:**" juga dianggap judul bagian.
    const boldHead = !CAPTION.test(line) && line.match(/^\s*\*\*([^*]{1,60}?):?\*\*:?\s*$/);
    if (boldHead) {
      const t = boldHead[1].trim();
      inSources = isSourceHeading(t);
      if (inSources) continue;
      headings.push(t);
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(t + ':');
      continue;
    }

    // Tabel Markdown tetap tabel (aplikasi menampilkannya sebagai tabel); hanya format sel yang dirapikan.
    if (/^\s*\|.*\|\s*$/.test(line) && !inSources) {
      for (const lm of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) addSource({ title: lm[1].trim(), url: lm[2] });
      out.push(cleanInline(line.trim()));
      continue;
    }
    // "**Label:** isi" menjadi "Label: isi" agar tampil sebagai label seperti template.
    line = line.replace(/^\s*\*\*([^*:]{1,60}):\*\*\s*/, '$1: ').replace(/^\s*\*\*([^*:]{1,60})\*\*:\s*/, '$1: ');
    // Daftar bernomor tetap bernomor (urutan langkah patofisiologi/tatalaksana penting); hanya poin yang diseragamkan.
    line = line.replace(/^(\s*)\d+\)\s+/, (m, sp) => m.replace(')', '.')).replace(/^(\s*)[*+•]\s+/, '$1- ');

    // Kumpulkan tautan sebagai sumber.
    for (const lm of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) addSource({ title: lm[1].trim(), url: lm[2] });
    let cleaned = cleanInline(line).replace(/\s+$/, '');
    for (const um of cleaned.matchAll(/https?:\/\/[^\s)<>\]]+/g)) {
      const url = um[0].replace(/[.,;:]+$/, '');
      if (!sources.some((x) => x.url === url)) {
        const title = inSources ? cleaned.replace(um[0], '').replace(/^-\s*/, '').replace(/[()\s–-]+$/, '').trim() : '';
        addSource({ title, url });
      }
    }
    if (inSources) {
      // Sumber tanpa tautan (mis. buku) tetap dicatat apa adanya.
      const t = cleaned.replace(/^-\s*/, '').trim();
      if (t && !/https?:\/\//.test(t)) sources.push({ title: t, url: '' });
      continue;
    }
    if (!cleaned.trim() && (!out.length || !out[out.length - 1].trim())) continue;
    out.push(cleaned);
  }

  for (const [n, im] of images.entries()) {
    if (im.caption) continue;
    im.caption = svgTitle(im.svg);
    const i = out.lastIndexOf(`![](svg:${n})`);
    if (i >= 0 && im.caption) out[i] = svgLine(n);
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  let body = out.join('\n');
  if (sources.length) {
    body += (body ? '\n\n' : '') + 'Sumber:\n' + sources.map((s) => `- ${s.title && s.url ? `${s.title} (${s.url})` : s.title || s.url}`).join('\n');
  }

  let title = meta.judul || h1;
  if (!title) {
    const first = out.find((l) => l.trim() && !/:$/.test(l.trim()));
    title = first ? first.replace(/^-\s*/, '').replace(/\*\*/g, '').slice(0, 80).trim() : '';
  }
  title = title.replace(/^rangkuman\s*:\s*/i, '');

  let type = guessType(headings, body);
  if (meta.jenis) type = TYPE_WORDS[meta.jenis.toLowerCase().split(/[\s/,]+/)[0]] || type;

  let stase = meta.stase || '';
  const known = knownStase.find((s) => s.toLowerCase() === stase.toLowerCase());
  if (known) stase = known;

  const tags = (meta.tag || '').split(/[,#;]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  if (!tags.some((t) => t.toLowerCase() === 'claude')) tags.push('claude');

  return { title, type, stase, tags, body, sources, images };
}
