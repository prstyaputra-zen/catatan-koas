"""Alur derajat dehidrasi dan Rencana Terapi A/B/C (MTBS Kemenkes 2015; MSF/WHO 2025)."""
import sys
W, H = 900, 640
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Diare akut pada anak: derajat dehidrasi dan rencana terapi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik ringkas · ikuti buku bagan MTBS dan protokol RS setempat</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def box(x, y, w, h, fill, stroke, lines, title=None, tcol='#111827'):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    yy = y + 26
    if title:
        o.append(f'<text x="{x + 14}" y="{yy}" font-size="16" font-weight="700" fill="{tcol}">{esc(title)}</text>'); yy += 24
    for ln in lines:
        bold = ln.startswith('*')
        t = ln.lstrip('*')
        o.append(f'<text x="{x + 14}" y="{yy}" font-size="13.5" font-weight="{700 if bold else 400}" fill="#1f2937">{esc(t)}</text>'); yy += 20
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')
box(190, 66, 520, 84, '#f3f4f6', '#6b7280', ['Keadaan umum, mata, rasa haus/minum, cubitan kulit perut.', 'Klasifikasi bila ada ≥ 2 tanda dari satu kolom.'], 'Nilai tanda dehidrasi')
cols = [
  (20, '#ecfdf5', '#059669', '#065f46', 'Tanpa dehidrasi', ['Tanda belum cukup untuk', 'kategori lain'], 'Rencana A (di rumah)',
   ['Oralit tiap BAB cair:', '*< 1 th: 50-100 mL', '*1-5 th: 100-200 mL', 'Lanjutkan ASI/makan', 'Zinc 10 hari', 'Kembali bila memburuk']),
  (310, '#fffbeb', '#d97706', '#92400e', 'Dehidrasi ringan/sedang', ['Rewel/gelisah, mata cekung,', 'haus minum lahap,', 'cubitan kembali lambat'], 'Rencana B (oralit di klinik)',
   ['*Oralit 75 mL/kgBB', 'MTBS: dalam 3 jam', 'MSF/WHO: dalam 4 jam', 'Lanjutkan ASI', 'Nilai ulang, lalu pilih', 'rencana A/B/C']),
  (600, '#fef2f2', '#dc2626', '#991b1b', 'Dehidrasi berat', ['Letargis/tidak sadar, mata', 'cekung, tidak bisa/malas', 'minum, cubitan sangat lambat'], 'Rencana C (infus cepat)',
   ['RL 100 mL/kgBB (atau NaCl 0,9%)', '*Bayi < 12 bl: 30 mL/kg 1 jam,', '*  lalu 70 mL/kg 5 jam', '*Anak 1-5 th: 30 mL/kg 30 mnt,', '*  lalu 70 mL/kg 2½ jam', 'Ulangi 30 mL/kg bila nadi lemah']),
]
for x, fill, stroke, tc, title, signs, plan, steps in cols:
    arrow(450, 150, x + 140, 176)
    box(x, 180, 280, 110, fill, stroke, signs, title, tc)
    arrow(x + 140, 290, x + 140, 318)
    box(x, 322, 280, 176, '#ffffff', stroke, steps, plan, tc)
o.append('<text x="20" y="534" font-size="13" fill="#374151">Zinc untuk semua anak diare (kecuali bayi muda) setiap hari selama 10 hari penuh, walau diare sudah berhenti.</text>')
o.append('<text x="20" y="556" font-size="13" fill="#374151">Contoh dosis (tablet 20 mg, panduan WHO/USAID 2005): &lt; 6 bulan ½ tablet/hari, ≥ 6 bulan 1 tablet/hari.</text>')
o.append('<text x="20" y="578" font-size="13" fill="#374151">Rencana C: pantau tanda vital tiap 15-30 menit; beri oralit 5 mL/kg/jam begitu anak bisa minum; nilai ulang dehidrasi.</text>')
o.append('<text x="20" y="612" font-size="12" fill="#6b7280">Sumber: Buku Bagan MTBS Kemenkes RI 2015; MSF Clinical Guidelines, Appendix 14 (2025, diadaptasi dari WHO Pocket Book 2013).</text>')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
