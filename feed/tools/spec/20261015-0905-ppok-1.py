"""PPOK: saluran napas normal vs PPOK (hilangnya recoil dan penyempitan saluran napas kecil), rantai patofisiologi, dan alur eksaserbasi (ilustrasi skematik)."""
import sys
W, H = 920, 930
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">PPOK: mengapa udara masuk mudah tetapi sulit keluar</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik sederhana, tidak sesuai skala anatomi</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, lines, fill, stroke, size=12.5):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    n = len(lines); y0 = y + h / 2 - (n - 1) * 8 + 5
    for i, s in enumerate(lines):
        t(x + w / 2, y0 + i * 16, s, size, 700 if i == 0 else 400, '#111827', 'middle')
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2.5" marker-end="url(#ak)"/>')

t(20, 88, 'A. Saluran napas kecil dan alveolus', 15, 700, '#111827')
def lung(ox, title, copd):
    o.append(f'<rect x="{ox}" y="104" width="430" height="300" rx="12" fill="{"#fff7f7" if copd else "#f7fdf9"}" stroke="#d1d5db" stroke-width="1.5"/>')
    t(ox + 215, 130, title, 14.5, 700, '#b91c1c' if copd else '#15803d', 'middle')
    # saluran napas kecil (tabung)
    gap = 26 if copd else 56
    top = 150 + (28 if copd else 0)
    o.append(f'<rect x="{ox+30}" y="{top}" width="150" height="{gap}" rx="6" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/>')
    if copd:
        o.append(f'<rect x="{ox+30}" y="{top-22}" width="150" height="22" fill="#fcd34d" stroke="#d97706" stroke-width="1.5"/>')
        o.append(f'<rect x="{ox+30}" y="{top+gap}" width="150" height="22" fill="#fcd34d" stroke="#d97706" stroke-width="1.5"/>')
        t(ox + 105, top + gap + 40, 'dinding menebal, mukus', 12, 700, '#92400e', 'middle')
        t(ox + 105, top + gap + 56, 'jalan udara menyempit', 12, 700, '#92400e', 'middle')
    else:
        t(ox + 105, top + gap + 28, 'saluran napas kecil terbuka', 12, 700, '#1d4ed8', 'middle')
    # alveolus
    if copd:
        # satu kantong besar (emfisema), udara terperangkap
        o.append(f'<ellipse cx="{ox+320}" cy="250" rx="90" ry="72" fill="#fecaca" stroke="#b91c1c" stroke-width="2.5"/>')
        t(ox + 320, 246, 'alveolus rusak', 13, 700, '#7f1d1d', 'middle')
        t(ox + 320, 264, 'menyatu (emfisema)', 13, 700, '#7f1d1d', 'middle')
        t(ox + 320, 342, 'udara terperangkap', 13, 700, '#b91c1c', 'middle')
        t(ox + 215, 372, 'recoil elastik hilang: udara sulit keluar', 13, 700, '#b91c1c', 'middle')
        t(ox + 215, 392, 'paru hiperinflasi, sesak, FEV1/FVC turun', 12.5, 400, '#374151', 'middle')
    else:
        for cx, cy in ((290, 195), (350, 195), (260, 250), (320, 250), (380, 250), (290, 305), (350, 305)):
            o.append(f'<circle cx="{ox+cx}" cy="{cy}" r="26" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>')
        t(ox + 215, 372, 'recoil elastik baik: udara keluar dengan lancar', 13, 700, '#15803d', 'middle')
        t(ox + 215, 392, 'FEV1/FVC normal', 12.5, 400, '#374151', 'middle')
    arrow(ox + 12, 160 + (28 if copd else 14), ox + 28, 160 + (28 if copd else 14)) if False else None
lung(20, 'Normal', False)
lung(470, 'PPOK', True)

t(20, 440, 'B. Rantai patofisiologi', 15, 700, '#111827')
chain = [(20, ['Asap rokok,', 'biomassa, polusi'], '#fef3c7', '#d97706'),
         (195, ['Inflamasi kronik,', 'stres oksidatif'], '#fee2e2', '#b91c1c'),
         (370, ['Emfisema +', 'saluran napas', 'kecil menyempit'], '#fee2e2', '#b91c1c'),
         (545, ['Air trapping,', 'hiperinflasi,', 'V/Q tidak seimbang'], '#ede9fe', '#7c3aed'),
         (720, ['Sesak, hipoksemia,', 'hiperkapnia,', 'kor pulmonale'], '#e0e7ff', '#4f46e5')]
for x, ln, f, s in chain:
    box(x, 456, 165, 78, ln, f, s)
for i in range(4):
    arrow(chain[i][0] + 165, 495, chain[i + 1][0] - 2, 495)
t(20, 556, 'Penyumbat utama obstruksi ringan-sedang: saluran napas kecil (<2 mm). Eksaserbasi dicetuskan terutama infeksi (virus ±70-80%).', 12.5, 400, '#4b5563')

t(20, 600, 'C. Eksaserbasi akut (dosis rujukan StatPearls 2026; PNPK 2019 tidak memuat dosis steroid dan antibiotik)', 15, 700, '#111827')
def card(x, title, fill, stroke, lines):
    o.append(f'<rect x="{x}" y="618" width="430" height="232" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x + 215, 648, title, 14, 700, '#111827', 'middle')
    for i, (ind, l) in enumerate(lines):
        t(x + 16 + ind, 686 + i * 28, l, 13)
card(20, 'Rawat jalan (ringan)', '#dcfce7', '#15803d', [(0, '• SABA ditingkatkan (± SAMA)'), (0, '• Prednison 40 mg oral/hari selama 5 hari'), (0, '• Antibiotik 5-7 hari bila dahak purulen'), (12, 'dan sesak atau volume dahak naik'), (0, '• Evaluasi tanda gagal napas')])
card(470, 'Rawat inap (sedang-berat)', '#fee2e2', '#b91c1c', [(0, '• Target SpO2 88-92% (sungkup Venturi)'), (0, '• Albuterol + ipratropium nebulisasi'), (0, '• Metilprednisolon 40-80 mg IV tiap 8-12 jam'), (12, 'atau prednison 40 mg oral 5 hari'), (0, '• NIV bila pH <7,35 atau PaCO2 >45 mmHg')])
t(20, 880, 'Hindari oksigen 100% saat nebulisasi pada hipoksemia kronik (PNPK 2019).', 13, 700, '#b91c1c')
t(20, 912, 'Dasar: PNPK PPOK (KMK 687/2019) dan StatPearls COPD (2026). Model gambar saluran napas dari buku ajar fisiologi pernapasan.', 12, 400, '#4b5563')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o))
