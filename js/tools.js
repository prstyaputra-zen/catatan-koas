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
