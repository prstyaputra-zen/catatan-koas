"""Perdarahan pascasalin: ligatur hidup miometrium (kontraksi vs atonia), 4T, dan bundel MOTIVE WHO (ilustrasi skematik)."""
import sys
W, H = 920, 760
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Perdarahan pascasalin: mengapa rahim harus berkontraksi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik, tidak sesuai skala</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ah)"/>')

def muscle(ox, oy, contracted):
    w, h = 400, 190
    o.append(f'<rect x="{ox}" y="{oy}" width="{w}" height="{h}" rx="10" fill="#fce7f3" stroke="#be185d" stroke-width="1.5"/>')
    # serabut otot silang (dipotong clipPath)
    cid = f'c{ox}{oy}'
    o.append(f'<clipPath id="{cid}"><rect x="{ox}" y="{oy}" width="{w}" height="{h}" rx="10"/></clipPath><g clip-path="url(#{cid})">')
    gap = 26 if contracted else 40
    for k in range(-10, 24):
        x = ox + k * gap
        sw = 5 if contracted else 2
        o.append(f'<line x1="{x}" y1="{oy}" x2="{x + h}" y2="{oy + h}" stroke="#db2777" stroke-width="{sw}" opacity="0.45"/>')
        o.append(f'<line x1="{x}" y1="{oy + h}" x2="{x + h}" y2="{oy}" stroke="#db2777" stroke-width="{sw}" opacity="0.45"/>')
    o.append('</g>')
    # arteri spiral menembus otot
    for k, x in enumerate((ox + 90, ox + 200, ox + 310)):
        wid = 3 if contracted else 12
        o.append(f'<path d="M{x},{oy} q -18,48 0,95 q 18,48 0,95" fill="none" stroke="#dc2626" stroke-width="{wid}" stroke-linecap="round"/>')
        if not contracted:
            for j in range(3):
                o.append(f'<circle cx="{x - 8 + j * 8}" cy="{oy + h + 14 + j * 10}" r="5" fill="#dc2626"/>')
    t(ox + 200, oy + h + (60 if not contracted else 26), 'tempat plasenta lepas (endometrium)', 12, 400, '#6b7280', 'middle')

t(20, 92, 'A. Ligatur hidup di dinding rahim', 15, 700, '#111827')
muscle(20, 112, True)
t(30, 352, 'Rahim berkontraksi: serabut otot yang saling', 12.5, 700, '#15803d')
t(30, 370, 'bersilang menjepit pembuluh, perdarahan berhenti', 12.5, 700, '#15803d')
muscle(20, 410, False)
t(30, 682, 'Atonia uteri (Tone): otot lembek, pembuluh', 12.5, 700, '#b91c1c')
t(30, 700, 'tetap terbuka, darah terus mengalir', 12.5, 700, '#b91c1c')
t(30, 722, 'Aliran darah rahim hamil sekitar 700 mL/menit', 12, 400, '#374151')
t(30, 740, '(tidak hamil sekitar 100 mL/menit).', 12, 400, '#374151')

# panel kanan
x0 = 450
t(x0, 92, 'B. Kapan bertindak (WHO, FIGO, ICM 2025)', 15, 700, '#111827')
o.append(f'<rect x="{x0}" y="104" width="454" height="96" rx="10" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>')
t(x0 + 12, 128, 'Ukur darah secara objektif (kantong drape', 13, 700, '#111827')
t(x0 + 12, 147, 'berskala). Mulai bundel saat darah ≥ 300 mL', 13, 400, '#374151')
t(x0 + 12, 166, 'disertai tanda vital abnormal, atau ≥ 500 mL.', 13, 400, '#374151')
t(x0 + 12, 186, 'Jangan menunggu 500 mL bila ibu sudah tidak stabil.', 12, 700, '#92400e')

t(x0, 230, 'C. Cari penyebab: 4T', 15, 700, '#111827')
ts = [('Tone', 'atonia uteri, sekitar 70%', '#fee2e2', '#dc2626'), ('Trauma', 'robekan jalan lahir, ruptur', '#ffedd5', '#ea580c'),
      ('Tissue', 'sisa plasenta/bekuan', '#ede9fe', '#7c3aed'), ('Thrombin', 'gangguan pembekuan', '#dbeafe', '#2563eb')]
for i, (a, b, f, s) in enumerate(ts):
    x = x0 + (i % 2) * 230
    y = 242 + (i // 2) * 64
    o.append(f'<rect x="{x}" y="{y}" width="222" height="56" rx="9" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x + 10, y + 22, a, 14, 700, '#111827')
    t(x + 10, y + 43, b, 12, 400, '#374151')

t(x0, 400, 'D. Bundel MOTIVE (diberikan bersamaan)', 15, 700, '#111827')
mot = [('M', 'Massage (pijat) uterus'), ('O', 'Oksitosik (uterotonika)'), ('T', 'Tranexamic acid (asam traneksamat)'),
       ('I', 'IV: cairan intravena'), ('V', 'Vagina/jalan lahir diperiksa'), ('E', 'Eskalasi bila tetap berdarah')]
for i, (k, d) in enumerate(mot):
    y = 414 + i * 42
    o.append(f'<rect x="{x0}" y="{y}" width="454" height="36" rx="8" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.5"/>')
    o.append(f'<circle cx="{x0 + 22}" cy="{y + 18}" r="13" fill="#16a34a"/>')
    t(x0 + 22, y + 23, k, 14, 700, '#ffffff', 'middle')
    t(x0 + 46, y + 23, d, 13, 400, '#14532d')
t(x0, 690, 'Eskalasi: tamponade balon, jahitan kompresi,', 12.5, 400, '#374151')
t(x0, 708, 'ligasi arteri, embolisasi, transfusi, histerektomi.', 12.5, 400, '#374151')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
