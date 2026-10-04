// Mengubah jawaban yang disalin dari Claude (Markdown) menjadi catatan Catatan Koas.

// Prompt yang disalin ke Claude agar rangkumannya langsung cocok dengan format aplikasi.
export const CLAUDE_PROMPT = `Buatkan rangkuman dari obrolan kita untuk aplikasi catatan koas-ku, dalam bahasa Indonesia, dengan format persis seperti ini:

Judul: <judul singkat>
Jenis: <Topik / Obat / Prosedur / Kasus>
Stase: <mis. IPD, Bedah, Anak, Obgyn, Saraf>
Tag: <3-6 kata kunci, pisahkan dengan koma>

## <Bagian, mis. Definisi>
<isi ringkas, boleh pakai poin "- ">

(ulangi untuk setiap bagian yang relevan)

## Sumber
- <judul sumber> (<link>)

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

// Mengembalikan { title, type, stase, tags, body, sources }.
export function parseClaude(raw, { knownStase = [] } = {}) {
  const text = String(raw || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
  const meta = {};
  const headings = [];
  const out = [];
  const sources = [];
  const addSource = (s) => { if (s && !sources.some((x) => x.url === s.url)) sources.push(s); };
  let inCode = false;
  let inSources = false;
  let h1 = '';

  for (let line of text.split('\n')) {
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) { out.push(line); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) continue;              // garis pemisah
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)) continue; // pemisah tabel

    const m = !out.some((l) => l.trim()) && line.match(META);
    if (m && m[2]) {
      const key = m[1].toLowerCase();
      const k = key === 'title' ? 'judul' : /jenis|tipe|type/.test(key) ? 'jenis' : /tag|kata/.test(key) ? 'tag' : key;
      if (!meta[k]) { meta[k] = cleanInline(m[2]).replace(/\*\*/g, '').trim(); continue; }
    }

    line = line.replace(/^\s*>\s?/, '');
    const head = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
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
    const boldHead = line.match(/^\s*\*\*([^*]{1,60}?):?\*\*:?\s*$/);
    if (boldHead) {
      const t = boldHead[1].trim();
      inSources = isSourceHeading(t);
      if (inSources) continue;
      headings.push(t);
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(t + ':');
      continue;
    }

    // Tabel Markdown: sel digabung dengan " · ".
    if (/^\s*\|.*\|\s*$/.test(line)) line = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join(' · ');
    // "**Label:** isi" menjadi "Label: isi" agar tampil sebagai label seperti template.
    line = line.replace(/^\s*\*\*([^*:]{1,60}):\*\*\s*/, '$1: ').replace(/^\s*\*\*([^*:]{1,60})\*\*:\s*/, '$1: ');
    line = line.replace(/^(\s*)\d+[.)]\s+/, (_, sp) => sp + '- ').replace(/^(\s*)[*+•]\s+/, '$1- ');

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

  return { title, type, stase, tags, body, sources };
}
