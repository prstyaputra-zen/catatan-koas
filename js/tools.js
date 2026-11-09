// Kalkulator klinis. Fungsi di sini murni (tanpa DOM) agar mudah diuji.

// Kategori IMT. Batas atas dibandingkan setelah IMT dibulatkan 1 desimal, seperti di tabel aslinya.
export const BMI_SYSTEMS = {
  asia: {
    label: 'Asia-Pasifik (WHO WPRO 2000)',
    short: 'Asia-Pasifik',
    cats: [
      { max: 18.4, name: 'Berat badan kurang', en: 'Underweight', tone: 'under' },
      { max: 22.9, name: 'Normal', en: 'Normal', tone: 'ok' },
      { max: 24.9, name: 'Berat badan lebih (berisiko)', en: 'At risk', tone: 'warn' },
      { max: 29.9, name: 'Obesitas I', en: 'Obese I', tone: 'high' },
      { max: Infinity, name: 'Obesitas II', en: 'Obese II', tone: 'severe' },
    ],
  },
  who: {
    label: 'WHO (internasional)',
    short: 'WHO',
    cats: [
      { max: 15.9, name: 'Sangat kurus (thinness berat)', en: 'Severe thinness', tone: 'severe' },
      { max: 16.9, name: 'Kurus sedang', en: 'Moderate thinness', tone: 'under' },
      { max: 18.4, name: 'Kurus ringan', en: 'Mild thinness', tone: 'under' },
      { max: 24.9, name: 'Normal', en: 'Normal', tone: 'ok' },
      { max: 29.9, name: 'Pre-obesitas', en: 'Pre-obese', tone: 'warn' },
      { max: 34.9, name: 'Obesitas I', en: 'Obese class I', tone: 'high' },
      { max: 39.9, name: 'Obesitas II', en: 'Obese class II', tone: 'severe' },
      { max: Infinity, name: 'Obesitas III', en: 'Obese class III', tone: 'severe' },
    ],
  },
  kemenkes: {
    label: 'Kemenkes RI (P2PTM)',
    short: 'Kemenkes',
    cats: [
      { max: 16.9, name: 'Kurus (kekurangan BB tingkat berat)', tone: 'severe' },
      { max: 18.4, name: 'Kurus (kekurangan BB tingkat ringan)', tone: 'under' },
      { max: 25.0, name: 'Normal', tone: 'ok' },
      { max: 27.0, name: 'Gemuk (kelebihan BB tingkat ringan)', tone: 'warn' },
      { max: Infinity, name: 'Gemuk (kelebihan BB tingkat berat)', tone: 'high' },
    ],
  },
};

// Saran singkat per kategori Asia-Pasifik (acuan utama di Indonesia).
const ADVICE = {
  under: 'Cari penyebab (asupan kurang, infeksi kronis seperti TB, malabsorpsi, hipertiroid, keganasan, gangguan makan). Nilai status gizi lengkap dan pertimbangkan konsultasi gizi.',
  ok: 'Pertahankan pola makan seimbang dan aktivitas fisik minimal 150 menit per minggu.',
  warn: 'Risiko penyakit kardiometabolik mulai meningkat. Anjurkan modifikasi gaya hidup dan skrining tekanan darah, gula darah, serta profil lipid.',
  high: 'Risiko DM tipe 2, hipertensi, dislipidemia, dan PJK meningkat. Target awal penurunan BB 5-10% dalam 6 bulan dengan diet, aktivitas fisik, dan perubahan perilaku. Skrining komorbid.',
  severe: 'Risiko komorbid tinggi. Tata laksana komprehensif (diet, aktivitas fisik, perilaku), skrining komorbid, dan pertimbangkan farmakoterapi atau rujukan sesuai indikasi.',
};

export function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
}

const round1 = (x) => Math.round(x * 10) / 10;

export function categorize(bmi, system) {
  const b = round1(bmi);
  return BMI_SYSTEMS[system].cats.find((c) => b <= c.max);
}

// heightCm, weightKg wajib; sex 'L' | 'P' | ''; waistCm opsional.
export function computeBmi({ heightCm, weightKg, sex = '', waistCm = NaN }) {
  const h = heightCm / 100;
  if (!(heightCm >= 50 && heightCm <= 250) || !(weightKg >= 2 && weightKg <= 400)) return null;
  const bmi = weightKg / (h * h);
  const asia = categorize(bmi, 'asia');
  const result = {
    bmi,
    bmiText: round1(bmi).toFixed(1).replace('.', ','),
    cats: { asia, who: categorize(bmi, 'who'), kemenkes: categorize(bmi, 'kemenkes') },
    advice: ADVICE[asia.tone],
    // Rentang BB normal menurut Asia-Pasifik (IMT 18,5-22,9).
    normalRange: [18.5 * h * h, 22.9 * h * h],
    toNormal: 0,
  };
  const [lo, hi] = result.normalRange;
  if (weightKg < lo) result.toNormal = lo - weightKg;
  else if (weightKg > hi) result.toNormal = hi - weightKg;
  // BB ideal Broca modifikasi: (TB-100) - 10%; tanpa pengurangan 10% bila pria < 160 cm atau wanita < 150 cm.
  if (sex === 'L' || sex === 'P') {
    const base = heightCm - 100;
    const noCut = (sex === 'L' && heightCm < 160) || (sex === 'P' && heightCm < 150);
    result.broca = noCut ? base : base * 0.9;
    result.brocaNoCut = noCut;
    result.brocaPct = (weightKg / result.broca) * 100;
  }
  // Obesitas sentral (kriteria Asia / IDF): lingkar perut ≥ 90 cm pria, ≥ 80 cm wanita.
  if (waistCm > 0 && (sex === 'L' || sex === 'P')) {
    const cut = sex === 'L' ? 90 : 80;
    result.waist = { cut, central: waistCm >= cut };
  }
  return result;
}

export function brocaStatus(pct) {
  if (pct < 90) return 'BB kurang (< 90% BBI)';
  if (pct <= 110) return 'BB normal (90-110% BBI)';
  if (pct <= 120) return 'BB lebih (110-120% BBI)';
  return 'Obesitas (> 120% BBI)';
}

const kg = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
export { kg as fmtKg };

export function bmiSummaryText(input, r) {
  const lines = [
    `TB ${String(input.heightCm).replace('.', ',')} cm, BB ${String(input.weightKg).replace('.', ',')} kg${input.sex ? `, ${input.sex === 'L' ? 'laki-laki' : 'perempuan'}` : ''}${input.waistCm > 0 ? `, lingkar perut ${String(input.waistCm).replace('.', ',')} cm` : ''}`,
    `IMT: ${r.bmiText} kg/m²`,
    `Asia-Pasifik: ${r.cats.asia.name}`,
    `WHO: ${r.cats.who.name}`,
    `Kemenkes: ${r.cats.kemenkes.name}`,
    `BB normal (IMT 18,5-22,9): ${kg(r.normalRange[0])}-${kg(r.normalRange[1])} kg`,
  ];
  if (r.broca) lines.push(`BB ideal (Broca): ${kg(r.broca)} kg, BB aktual ${Math.round(r.brocaPct)}% BBI, ${brocaStatus(r.brocaPct)}`);
  if (r.waist) lines.push(`Lingkar perut: ${r.waist.central ? 'obesitas sentral' : 'normal'} (batas ${r.waist.cut} cm)`);
  return lines.join('\n');
}

// ---------- Format angka Indonesia ----------
export function fmtNum(x, maxDec = 1) {
  if (!Number.isFinite(x)) return '–';
  const f = 10 ** maxDec;
  return String(Math.round(x * f) / f).replace('.', ',');
}

// Pecahan tablet: 2,25 -> "2¼".
export function fmtTablets(t) {
  const whole = Math.floor(t + 1e-9);
  const q = Math.round((t - whole) * 4);
  const frac = ['', '¼', '½', '¾'][q] || '';
  if (q === 4) return String(whole + 1);
  return frac ? (whole ? `${whole}${frac}` : frac) : String(whole);
}

export function roman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

// ---------- Kalkulator puyer ----------
// Dosis acuan umum anak. Semua angka bisa diubah di layar; selalu cocokkan dengan formularium/IDAI dan kondisi pasien.
// mode 'dose' = mg/kg/dosis, 'day' = mg/kg/hari (dibagi frekuensi).
export const PUYER_DRUGS = [
  // Ditinjau Nov 2026 terhadap Medscape, BNF/BNFc, NZF (Healthify), EMA/MHRA, MedCentral, MIMS.
  { id: 'pct', name: 'Parasetamol', mode: 'dose', dose: 10, range: [10, 15], freq: 3, strength: 500, maxDose: 1000, maxDayKg: 60, maxDay: 4000,
    note: 'Tiap 4-6 jam, maks 5 kali/hari. Batas 75 mg/kg/hari hanya untuk 48 jam pertama, selanjutnya 60 mg/kg/hari (NZF, BNFc).' },
  { id: 'ibu', name: 'Ibuprofen', mode: 'dose', dose: 5, range: [5, 10], freq: 3, strength: 200, maxDose: 400, maxDayKg: 40, maxDay: 1200,
    note: 'Tiap 6-8 jam. BNFc membatasi 30 mg/kg/hari. Tidak untuk bayi < 3 bulan, dehidrasi, atau curiga demam berdarah.' },
  { id: 'amx', name: 'Amoksisilin', mode: 'day', dose: 40, range: [25, 50], freq: 3, strength: 500, maxDose: 1000, maxDay: 4000,
    note: 'Dosis tinggi 80-90 mg/kg/hari (maks 4 g/hari) untuk indikasi tertentu, mis. OMA atau pneumonia komunitas.' },
  { id: 'ctm', name: 'Klorfeniramin (CTM)', mode: 'day', dose: 0.35, range: [0.35, 0.35], freq: 3, strength: 4, maxDose: 2, maxDay: 12,
    note: 'Usia 2-5 th: 1 mg tiap 4-6 jam, maks 6 mg/hari. Usia 6-11 th: 2 mg tiap 4-6 jam, maks 12 mg/hari. Tidak untuk < 2 tahun.' },
  { id: 'amb', name: 'Ambroksol', mode: 'day', dose: 1.2, range: [1.2, 1.6], freq: 3, strength: 30, maxDay: 90,
    note: 'Acuan usia: < 2 th 7,5 mg 2x; 2-5 th 7,5 mg 3x; 6-12 th 15 mg 2-3x sehari (MIMS).' },
  { id: 'dom', name: 'Domperidon', mode: 'dose', dose: 0.25, range: [0.25, 0.25], freq: 3, strength: 10, maxDose: 10, maxDayKg: 0.75, maxDay: 30,
    note: 'EMA/MHRA: tidak lagi direkomendasikan untuk anak < 12 tahun atau BB < 35 kg karena tidak terbukti efektif. Bila tetap dipakai: maks 0,75 mg/kg/hari, sesingkat mungkin.' },
];

// Satu puyer bisa berisi beberapa obat (racikan). Setiap obat dihitung terpisah, lalu dibulatkan per jumlah tablet total.
// rows: [{ name, mode, dose, strength, maxDose, maxDayKg, maxDay, range }]; rounding: 0 (tanpa), 0.25, 0.5 tablet.
export function computePuyer({ weightKg, freq, packets, rounding = 0.25, rows }) {
  if (!(weightKg > 0 && weightKg <= 150) || !(freq >= 1 && freq <= 6) || !(packets >= 1 && packets <= 200)) return null;
  const items = rows.filter((r) => r.dose > 0 && r.strength > 0).map((r) => {
    const target = r.mode === 'day' ? (weightKg * r.dose) / freq : weightKg * r.dose;  // mg per bungkus
    const warn = [];
    let perPacket = target;
    const capped = !!(r.maxDose && perPacket > r.maxDose);
    if (capped) { perPacket = r.maxDose; warn.push(`Dibatasi dosis maksimal ${fmtNum(r.maxDose)} mg per kali.`); }
    const exact = (perPacket * packets) / r.strength;
    let tablets = rounding ? Math.round(exact / rounding) * rounding : exact;
    if (rounding && tablets < rounding) tablets = rounding;
    const actual = (tablets * r.strength) / packets;
    const daily = actual * freq;
    const perKgDose = actual / weightKg;
    const perKgDay = daily / weightKg;
    if (r.maxDayKg && perKgDay > r.maxDayKg + 1e-9) warn.push(`Melebihi ${fmtNum(r.maxDayKg, 2)} mg/kg/hari (jadi ${fmtNum(perKgDay, 2)}).`);
    if (r.maxDay && daily > r.maxDay + 1e-9) warn.push(`Melebihi dosis harian maksimal ${fmtNum(r.maxDay)} mg (jadi ${fmtNum(daily)} mg).`);
    if (r.range && r.range[0] && !capped) {
      const v = r.mode === 'day' ? perKgDay : perKgDose;
      const [lo, hi] = r.range;
      if (v < lo * 0.9) warn.push(`Di bawah dosis acuan (${fmtNum(lo, 2)}${hi !== lo ? `-${fmtNum(hi, 2)}` : ''} mg/kg/${r.mode === 'day' ? 'hari' : 'dosis'}).`);
      if (v > hi * 1.1) warn.push(`Di atas dosis acuan (${fmtNum(lo, 2)}${hi !== lo ? `-${fmtNum(hi, 2)}` : ''} mg/kg/${r.mode === 'day' ? 'hari' : 'dosis'}).`);
    }
    const deviation = target ? ((actual - target) / target) * 100 : 0;
    return { name: r.name || 'Obat', note: r.preset ? r.note : '', strength: r.strength, target, perPacket, exact, tablets, actual, daily, perKgDose, perKgDay, deviation, warn };
  });
  return items.length ? { weightKg, freq, packets, rounding, items } : null;
}

export function puyerRecipe(r) {
  const lines = ['R/'];
  r.items.forEach((it) => lines.push(`  ${it.name} ${fmtNum(it.actual, 2)} mg`));
  lines.push(`  m.f. pulv. d.t.d. No. ${roman(r.packets)}`);
  lines.push(`  S ${r.freq} dd pulv I`);
  return lines.join('\n');
}

export function puyerSummaryText(r) {
  const lines = [`BB ${fmtNum(r.weightKg)} kg, ${r.freq}x sehari, ${r.packets} bungkus`];
  for (const it of r.items) {
    lines.push(`${it.name}: ${fmtNum(it.actual, 2)} mg/bungkus (${fmtNum(it.perKgDose, 2)} mg/kg/dosis, ${fmtNum(it.perKgDay, 2)} mg/kg/hari); ambil ${fmtTablets(it.tablets)} tablet ${fmtNum(it.strength)} mg untuk ${r.packets} bungkus`);
    it.warn.forEach((w) => lines.push(`  ⚠ ${w}`));
  }
  lines.push('', puyerRecipe(r));
  return lines.join('\n');
}

// ---------- Cairan rumatan Holliday-Segar ----------
// Harian 100/50/20 mL/kg (10 kg pertama / 10 kg kedua / sisanya); per jam 4-2-1 mL/kg. Dibatasi 2.400 mL/hari (~100 mL/jam).
export const FLUID_CAP_DAY = 2400;

export function computeFluid({ weightKg, deficitPct = 0, dropFactor = 20 }) {
  if (!(weightKg > 0 && weightKg <= 200)) return null;
  const w = weightKg;
  const dayRaw = w <= 10 ? 100 * w : w <= 20 ? 1000 + 50 * (w - 10) : 1500 + 20 * (w - 20);
  const hourRaw = w <= 10 ? 4 * w : w <= 20 ? 40 + 2 * (w - 10) : 60 + (w - 20);
  const capped = dayRaw > FLUID_CAP_DAY;
  const day = Math.min(dayRaw, FLUID_CAP_DAY);
  const hour = Math.min(hourRaw, FLUID_CAP_DAY / 24);
  const tpm = (mlh) => (mlh * dropFactor) / 60;
  const r = {
    weightKg: w, dayRaw, day, hourRaw, hour, capped, dropFactor,
    tpmMacro: tpm(hour), tpmMicro: hour, // set mikro 60 tetes/mL: tpm = mL/jam
    steps: [
      { label: '10 kg pertama', kg: Math.min(w, 10), perKg: 100 },
      { label: '10 kg kedua', kg: Math.max(0, Math.min(w, 20) - 10), perKg: 50 },
      { label: 'Sisa di atas 20 kg', kg: Math.max(0, w - 20), perKg: 20 },
    ].filter((s) => s.kg > 0),
  };
  // Defisit dehidrasi: BB x % x 10 mL. Separuh di 8 jam pertama, separuh di 16 jam berikutnya, ditambah rumatan.
  if (deficitPct > 0 && deficitPct <= 15) {
    const deficit = w * deficitPct * 10;
    const first = (deficit / 2 + hour * 8) / 8;
    const next = (deficit / 2 + hour * 16) / 16;
    r.deficit = { pct: deficitPct, ml: deficit, first, next, total: deficit + day, tpmFirst: tpm(first), tpmNext: tpm(next) };
  }
  return r;
}

export function fluidSummaryText(r) {
  const lines = [
    `BB ${fmtNum(r.weightKg)} kg`,
    `Rumatan Holliday-Segar: ${fmtNum(r.day, 0)} mL/hari${r.capped ? ` (dibatasi dari ${fmtNum(r.dayRaw, 0)})` : ''}`,
    `Kecepatan (4-2-1): ${fmtNum(r.hour)} mL/jam = ${fmtNum(r.tpmMacro)} tpm makro (${r.dropFactor} tetes/mL) = ${fmtNum(r.tpmMicro)} tpm mikro`,
  ];
  if (r.deficit) {
    const d = r.deficit;
    lines.push(`Defisit dehidrasi ${fmtNum(d.pct)}%: ${fmtNum(d.ml, 0)} mL`);
    lines.push(`8 jam pertama: ${fmtNum(d.first)} mL/jam (${fmtNum(d.tpmFirst)} tpm makro)`);
    lines.push(`16 jam berikutnya: ${fmtNum(d.next)} mL/jam (${fmtNum(d.tpmNext)} tpm makro)`);
    lines.push(`Total 24 jam: ${fmtNum(d.total, 0)} mL`);
  }
  return lines.join('\n');
}
