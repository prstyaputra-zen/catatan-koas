// Mesin pencarian lokal: indeks kata, awalan, toleran salah ketik, dan sinonim/singkatan medis.

const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'dengan', 'untuk', 'pada', 'ini', 'itu', 'atau',
  'dalam', 'adalah', 'juga', 'akan', 'oleh', 'sebagai', 'karena', 'the', 'of', 'and', 'a', 'an', 'to', 'in',
]);

// Setiap baris adalah satu kelompok istilah yang dianggap sama saat mencari.
export const SYNONYM_GROUPS = [
  ['dm', 'diabetes melitus', 'diabetes mellitus', 'kencing manis', 'diabetes'],
  ['ht', 'hipertensi', 'hypertension', 'darah tinggi', 'htn'],
  ['mi', 'ami', 'infark miokard', 'myocardial infarction', 'serangan jantung'],
  ['acs', 'sindrom koroner akut', 'acute coronary syndrome', 'ska'],
  ['chf', 'hf', 'gagal jantung', 'heart failure', 'gjk'],
  ['ckd', 'pgk', 'penyakit ginjal kronik', 'gagal ginjal kronik', 'chronic kidney disease'],
  ['aki', 'gagal ginjal akut', 'cedera ginjal akut', 'acute kidney injury'],
  ['tb', 'tbc', 'tuberkulosis', 'tuberculosis', 'koch'],
  ['dbd', 'dhf', 'demam berdarah dengue', 'demam berdarah', 'dengue'],
  ['ppok', 'copd', 'penyakit paru obstruktif kronik'],
  ['cap', 'pneumonia komunitas', 'community acquired pneumonia'],
  ['isk', 'uti', 'infeksi saluran kemih', 'urinary tract infection'],
  ['ispa', 'urti', 'infeksi saluran pernapasan akut'],
  ['gerd', 'refluks gastroesofageal', 'refluks asam'],
  ['stroke', 'cva', 'cerebrovascular accident'],
  ['snh', 'stroke non hemoragik', 'stroke iskemik', 'ischemic stroke'],
  ['sh', 'stroke hemoragik', 'hemorrhagic stroke'],
  ['ekg', 'ecg', 'elektrokardiogram', 'electrocardiogram'],
  ['cxr', 'foto toraks', 'rontgen toraks', 'rontgen dada', 'thorax', 'toraks'],
  ['rontgen', 'xray', 'x ray', 'radiografi'],
  ['usg', 'ultrasonografi', 'ultrasound'],
  ['td', 'tekanan darah', 'bp', 'blood pressure', 'tensi'],
  ['hr', 'nadi', 'denyut jantung', 'heart rate'],
  ['rr', 'frekuensi napas', 'laju napas', 'respiratory rate'],
  ['spo2', 'saturasi oksigen', 'saturasi'],
  ['gcs', 'glasgow coma scale'],
  ['kad', 'dka', 'ketoasidosis diabetik', 'diabetic ketoacidosis'],
  ['anc', 'antenatal care', 'pemeriksaan kehamilan'],
  ['hpp', 'pph', 'perdarahan postpartum', 'perdarahan pasca persalinan', 'postpartum hemorrhage'],
  ['kpd', 'prom', 'ketuban pecah dini'],
  ['preeklampsia', 'preeclampsia', 'pre eklampsia'],
  ['sc', 'sectio caesarea', 'seksio sesarea', 'caesar', 'sesar'],
  ['antibiotik', 'antibiotic', 'ab', 'antibiotika'],
  ['oains', 'nsaid', 'antiinflamasi nonsteroid'],
  ['hb', 'hemoglobin'],
  ['dl', 'darah lengkap', 'cbc', 'complete blood count'],
  ['gds', 'gda', 'gula darah sewaktu', 'random blood glucose'],
  ['gdp', 'gula darah puasa', 'fasting blood glucose'],
  ['bab', 'buang air besar', 'defekasi'],
  ['bak', 'buang air kecil', 'miksi'],
  ['sesak', 'sesak napas', 'dispnea', 'dyspnea', 'dypsnea'],
  ['nyeri dada', 'chest pain', 'angina'],
  ['demam', 'febris', 'fever', 'panas'],
  ['batuk', 'cough', 'tussis'],
  ['mual', 'nausea'],
  ['muntah', 'vomitus', 'vomiting', 'emesis'],
  ['diare', 'diarrhea', 'mencret'],
  ['kejang', 'seizure', 'konvulsi', 'convulsion'],
  ['apendisitis', 'appendisitis', 'appendicitis', 'usus buntu'],
  ['fraktur', 'patah tulang', 'fracture'],
  ['luka bakar', 'combustio', 'burn'],
  ['igd', 'ugd', 'er', 'emergency', 'gawat darurat'],
  ['icu', 'ruang intensif', 'intensive care'],
  ['ipd', 'penyakit dalam', 'interna', 'internal medicine'],
  ['obgyn', 'obsgyn', 'obstetri ginekologi', 'kebidanan', 'obstetri', 'kandungan'],
  ['anak', 'pediatri', 'ika', 'pediatric', 'pediatrics'],
  ['bedah', 'surgery', 'operasi'],
  ['saraf', 'neurologi', 'neurology', 'neuro'],
  ['jiwa', 'psikiatri', 'psychiatry'],
  ['kulit', 'dermatologi', 'dermatology', 'kulit kelamin'],
  ['mata', 'oftalmologi', 'ophthalmology'],
  ['tht', 'telinga hidung tenggorok', 'ent'],
];

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(text) {
  const n = normalize(text);
  if (!n) return [];
  return n.split(' ').filter((t) => t && !STOPWORDS.has(t));
}

// Jarak edit Damerau-Levenshtein terbatas; berhenti lebih awal bila melewati batas.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1);
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

const FIELD_WEIGHTS = { title: 6, tags: 4, stase: 3, media: 2, body: 1 };

export class SearchIndex {
  constructor(synonymGroups = SYNONYM_GROUPS) {
    this.postings = new Map(); // term -> Map(docId -> weight)
    this.docTerms = new Map(); // docId -> Set(term)
    this.vocab = null; // daftar istilah terurut, dibangun ulang bila perlu
    this.phraseToGroup = new Map();
    this.groups = synonymGroups.map((g) => g.map((p) => tokenize(p)).filter((t) => t.length));
    this.groups.forEach((g, gi) => g.forEach((toks) => this.phraseToGroup.set(toks.join(' '), gi)));
    this.maxPhrase = Math.max(1, ...this.groups.flat().map((t) => t.length));
  }

  add(id, fields) {
    this.remove(id);
    const terms = new Set();
    for (const [field, text] of Object.entries(fields)) {
      const w = FIELD_WEIGHTS[field] || 1;
      for (const t of tokenize(text)) {
        let m = this.postings.get(t);
        if (!m) { m = new Map(); this.postings.set(t, m); this.vocab = null; }
        m.set(id, (m.get(id) || 0) + w);
        terms.add(t);
      }
    }
    this.docTerms.set(id, terms);
  }

  remove(id) {
    const terms = this.docTerms.get(id);
    if (!terms) return;
    for (const t of terms) {
      const m = this.postings.get(t);
      if (!m) continue;
      m.delete(id);
      if (!m.size) { this.postings.delete(t); this.vocab = null; }
    }
    this.docTerms.delete(id);
  }

  getVocab() {
    if (!this.vocab) this.vocab = [...this.postings.keys()].sort();
    return this.vocab;
  }

  // Istilah indeks yang cocok untuk satu token kueri, dengan faktor bobot.
  expandToken(tok, allowPrefix) {
    const out = new Map();
    if (this.postings.has(tok)) out.set(tok, 1);
    const vocab = this.getVocab();
    if (allowPrefix && tok.length >= 2) {
      let lo = 0, hi = vocab.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (vocab[mid] < tok) lo = mid + 1; else hi = mid; }
      for (let i = lo; i < vocab.length && vocab[i].startsWith(tok); i++) {
        if (!out.has(vocab[i])) out.set(vocab[i], 0.75);
      }
    }
    if (tok.length >= 5 && !/^\d+$/.test(tok)) {
      const max = tok.length >= 8 ? 2 : 1;
      for (const term of vocab) {
        if (out.has(term) || term.length < tok.length - max) continue;
        if (editDistance(tok, term, max) <= max) { out.set(term, 0.45); continue; }
        // Saat mengetik, bandingkan juga dengan awalan istilah panjang ("pnemon" ~ "pneumonia").
        if (allowPrefix && term.length > tok.length && editDistance(tok, term.slice(0, tok.length), max) <= max) {
          out.set(term, 0.35);
        }
      }
    }
    return out;
  }

  // Kueri -> daftar "konsep"; tiap konsep punya beberapa alternatif (sinonim), tiap alternatif = daftar token.
  parseQuery(query) {
    const toks = tokenize(query);
    const concepts = [];
    let i = 0;
    while (i < toks.length) {
      let matched = false;
      for (let len = Math.min(this.maxPhrase, toks.length - i); len >= 1; len--) {
        const phrase = toks.slice(i, i + len).join(' ');
        const gi = this.phraseToGroup.get(phrase);
        if (gi !== undefined) {
          const alts = this.groups[gi].map((t) => ({ tokens: t, exact: true }));
          // Ketikan pengguna sendiri tetap boleh dicocokkan dengan awalan.
          alts.unshift({ tokens: toks.slice(i, i + len), exact: false });
          concepts.push({ alts, last: i + len === toks.length });
          i += len; matched = true; break;
        }
      }
      if (!matched) { concepts.push({ alts: [{ tokens: [toks[i]], exact: false }], last: i === toks.length - 1 }); i++; }
    }
    return concepts;
  }

  search(query, limit = 200) {
    const concepts = this.parseQuery(query);
    if (!concepts.length) return { results: [], terms: new Set() };
    const highlight = new Set();
    let total = null; // docId -> skor
    for (const c of concepts) {
      const conceptScores = new Map();
      for (const alt of c.alts) {
        let altScores = null;
        alt.tokens.forEach((tok, ti) => {
          const allowPrefix = !alt.exact || tok.length >= 3;
          const expanded = this.expandToken(tok, allowPrefix || (c.last && ti === alt.tokens.length - 1));
          const tokScores = new Map();
          for (const [term, factor] of expanded) {
            highlight.add(term);
            for (const [doc, w] of this.postings.get(term)) {
              const s = w * factor;
              if ((tokScores.get(doc) || 0) < s) tokScores.set(doc, s);
            }
          }
          if (altScores === null) altScores = tokScores;
          else {
            const next = new Map();
            for (const [doc, s] of altScores) if (tokScores.has(doc)) next.set(doc, s + tokScores.get(doc));
            altScores = next;
          }
        });
        for (const [doc, s] of altScores || []) {
          if ((conceptScores.get(doc) || 0) < s) conceptScores.set(doc, s);
        }
      }
      if (total === null) total = conceptScores;
      else {
        const next = new Map();
        for (const [doc, s] of total) if (conceptScores.has(doc)) next.set(doc, s + conceptScores.get(doc));
        total = next;
      }
      if (!total.size) break;
    }
    const results = [...total.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score }));
    return { results, terms: highlight };
  }
}
