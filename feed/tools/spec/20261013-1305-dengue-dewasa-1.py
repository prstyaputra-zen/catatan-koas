"""Perjalanan infeksi dengue: fase demam, kritis, pemulihan (PNPK Dengue Dewasa 2020; WHO 2025). Kurva kualitatif."""
import sys
W, H = 900, 604
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Perjalanan infeksi dengue: kapan bahaya datang</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · kurva kualitatif (tanpa skala) · hari sakit perkiraan</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
X0, X1, Y0, Y1 = 70, 880, 110, 330
def xd(d): return X0 + (d - 1) / 9 * (X1 - X0)
o.append(f'<rect x="{X0}" y="{Y0}" width="{xd(3)-X0:.0f}" height="{Y1-Y0}" fill="#fef2f2"/>')
o.append(f'<rect x="{xd(3):.0f}" y="{Y0}" width="{xd(7)-xd(3):.0f}" height="{Y1-Y0}" fill="#fff7ed"/>')
o.append(f'<rect x="{xd(7):.0f}" y="{Y0}" width="{X1-xd(7):.0f}" height="{Y1-Y0}" fill="#ecfdf5"/>')
t((X0 + xd(3)) / 2, Y0 - 10, 'Fase demam (± 3 hari, 2-7)', 13.5, 700, '#991b1b', 'middle')
t((xd(3) + xd(7)) / 2, Y0 - 10, 'Fase kritis (bebas demam, hari 3-7)', 13.5, 700, '#9a3412', 'middle')
t((xd(7) + X1) / 2, Y0 - 10, 'Fase pemulihan (reabsorpsi)', 13.5, 700, '#166534', 'middle')
for d in range(1, 11):
    x = xd(d)
    o.append(f'<line x1="{x:.0f}" y1="{Y1}" x2="{x:.0f}" y2="{Y1+6}" stroke="#374151"/>')
    t(x, Y1 + 22, f'H{d}', 12, 400, '#374151', 'middle')
t((X0 + X1) / 2, Y1 + 42, 'Hari sakit', 13, 700, '#374151', 'middle')
def curve(pts, col, w=3, dash=''):
    d = 'M' + ' L'.join(f'{xd(a):.1f},{Y1 - b * (Y1 - Y0):.1f}' for a, b in pts)
    o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linejoin="round" {dash}/>')
curve([(1, .85), (1.5, .92), (2, .88), (2.5, .9), (3, .8), (3.5, .45), (4, .3), (5, .28), (6, .27), (8, .27), (10, .27)], '#dc2626')
curve([(1, .45), (2, .46), (3, .5), (4, .7), (5, .75), (6, .62), (7, .5), (8, .46), (10, .45)], '#2563eb')
curve([(1, .7), (2, .6), (3, .45), (4, .22), (5, .15), (6, .25), (7, .45), (8, .6), (10, .7)], '#7c3aed', 3, 'stroke-dasharray="7 5"')
t(xd(1.6), Y1 - .96 * (Y1 - Y0), 'Suhu', 13, 700, '#dc2626')
t(xd(5.1), Y1 - .8 * (Y1 - Y0), 'Hematokrit naik (kebocoran plasma)', 13, 700, '#2563eb')
t(xd(4.6), Y1 - .09 * (Y1 - Y0), 'Trombosit turun', 13, 700, '#7c3aed')
# panel bawah
def box(x, y, w, h, fill, stroke, title, lines):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x + 12, y + 22, title, 14, 700, '#111827')
    for k, ln in enumerate(lines):
        t(x + 12, y + 42 + k * 18, ln, 12.5)
box(20, 400, 270, 150, '#fef2f2', '#dc2626', 'Fase demam', ['Demam tinggi, nyeri kepala,', 'nyeri retro-orbita, otot, sendi', 'NS1 paling berguna s.d. ± hari 3', 'Parasetamol 10 mg/kgBB/dosis', '(jarak ≥ 6 jam, maks. 4 g/hari)', 'Hindari aspirin dan OAINS'])
box(304, 400, 300, 150, '#fff7ed', '#ea580c', 'Fase kritis: waspada syok', ['Kebocoran plasma 24-48 jam', 'Ht naik ≥ 20%, efusi, asites,', 'hipoalbuminemia', 'Tanda bahaya: muntah terus, nyeri', 'perut hebat, letargi/gelisah, perdarahan,', 'akral dingin, oliguria'])
box(618, 400, 262, 150, '#ecfdf5', '#059669', 'Fase pemulihan', ['Cairan kembali ke pembuluh', 'Ruam konvalesens ± 2-3 hari', 'setelah bebas demam', 'Hentikan infus bila stabil;', 'waspadai kelebihan cairan', '(sesak, edema paru)'])
t(20, 590, 'Sumber: Kemenkes RI, PNPK Tata Laksana Infeksi Dengue pada Dewasa (KMK HK.01.07/MENKES/9845/2020); WHO Dengue fact sheet (2025).', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
