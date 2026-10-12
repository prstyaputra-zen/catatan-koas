"""TB paru: dari droplet ke granuloma/infeksi laten/TB aktif, dan linimasa 2RHZE/4HR (PNPK TB 2019; WHO 2026)."""
import sys
W, H = 900, 660
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">TB paru: perjalanan infeksi dan linimasa pengobatan</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, fill, stroke, title, lines):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x + 12, y + 23, title, 14.5, 700, '#111827')
    for k, ln in enumerate(lines):
        t(x + 12, y + 43 + k * 18, ln, 12.5)
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')
box(20, 72, 250, 84, '#f3f4f6', '#6b7280', 'Droplet nuclei', ['Pasien TB paru batuk, bersin,', 'meludah → kuman melayang', 'di udara dan terhirup'])
arrow(272, 114, 312, 114)
box(316, 72, 260, 84, '#dbeafe', '#2563eb', 'Alveolus', ['Makrofag alveolar menelan', 'kuman, tetapi kuman bisa', 'bertahan hidup di dalamnya'])
arrow(578, 114, 618, 114)
box(622, 72, 258, 84, '#ede9fe', '#7c3aed', 'Imunitas seluler', ['Sel T mengaktifkan makrofag', '→ granuloma (dinding sel', 'radang mengurung kuman)'])
arrow(750, 158, 750, 190)
box(560, 194, 320, 92, '#ecfdf5', '#059669', 'Infeksi laten (sebagian besar)', ['Kuman terkurung, tidak bergejala,', 'tidak menular. Sekitar 1/4 penduduk', 'dunia diperkirakan terinfeksi (WHO)'])
arrow(560, 240, 488, 240)
box(160, 194, 326, 92, '#fee2e2', '#dc2626', 'TB aktif (5-10% yang terinfeksi)', ['Imunitas turun (HIV, DM, malnutrisi)', '→ kuman lepas → nekrosis kaseosa', '→ kavitas, batuk, BB turun, demam'])
t(20, 230, 'Kavitas di', 12.5, 700, '#991b1b'); t(20, 248, 'apeks paru:', 12.5, 700, '#991b1b'); t(20, 266, 'kaya O₂', 12.5, 400, '#991b1b')
# linimasa
t(20, 330, 'Linimasa paduan 2RHZE/4HR (6 bulan, PNPK TB 2019)', 16, 700, '#111827')
x0, x1, y = 40, 860, 380
mw = (x1 - x0) / 6
o.append(f'<rect x="{x0}" y="{y}" width="{mw*2:.0f}" height="46" fill="#fecaca" stroke="#dc2626" stroke-width="2"/>')
o.append(f'<rect x="{x0+mw*2:.0f}" y="{y}" width="{mw*4:.0f}" height="46" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>')
t(x0 + mw, y + 22, 'Fase intensif: R H Z E', 14.5, 700, '#7f1d1d', 'middle')
t(x0 + mw, y + 40, 'setiap hari, 2 bulan', 12.5, 400, '#7f1d1d', 'middle')
t(x0 + mw * 4, y + 22, 'Fase lanjutan: H R', 14.5, 700, '#1e3a8a', 'middle')
t(x0 + mw * 4, y + 40, 'setiap hari, 4 bulan (atau 3x seminggu: 4R3H3)', 12.5, 400, '#1e3a8a', 'middle')
for m in range(7):
    xx = x0 + m * mw
    o.append(f'<line x1="{xx:.0f}" y1="{y+46}" x2="{xx:.0f}" y2="{y+56}" stroke="#374151" stroke-width="1.5"/>')
    t(xx, y + 72, f'Bln {m}', 12, 400, '#374151', 'middle')
marks = [(2, 'middle', 122, ['Akhir bln 2: BTA dahak', '(bila +, ulang bln 3)']), (5, 'end', 122, ['Bln 5: BTA + = gagal']), (6, 'end', 146, ['Akhir pengobatan: BTA + = gagal'])]
for m, anchor, yy, lines in marks:
    xx = x0 + m * mw
    o.append(f'<line x1="{xx:.0f}" y1="{y+80}" x2="{xx:.0f}" y2="{y+yy-14}" stroke="#d97706" stroke-width="2" stroke-dasharray="4 3"/>')
    for k, ln in enumerate(lines):
        t(xx + (6 if anchor == 'end' and m == 5 else 0), y + yy + k * 18, ln, 12.5, 700 if k == 0 else 400, '#92400e', anchor)
box(20, 548, 860, 76, '#f9fafb', '#d1d5db', 'Dosis harian (mg/kgBB, PNPK TB 2019)', ['H 5 (maks. 300 mg) · R 10 (maks. 600 mg) · Z 25 · E 15  ·  Pantau BB tiap bulan, dosis disesuaikan',
     'Piridoksin 25 mg/hari pada kelompok risiko neuropati (hamil, HIV, alkohol, malnutrisi, DM, penyakit hati/ginjal)'])
t(20, 650, 'Sumber: Kemenkes RI, PNPK Tata Laksana Tuberkulosis (KMK HK.01.07/MENKES/755/2019); WHO Tuberculosis fact sheet (2026).', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
