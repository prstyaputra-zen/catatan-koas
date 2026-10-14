"""Epistaksis: pleksus Kiesselbach di septum anterior (cabang karotis interna dan eksterna), sumber perdarahan posterior, dan tangga tatalaksana (ilustrasi skematik)."""
import sys
W, H = 920, 780
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Epistaksis: dari mana darah keluar dan cara menghentikannya</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Septum nasi kiri dilihat dari samping (depan = kiri gambar), ilustrasi skematik</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ak)"/>')

# septum
o.append('<path d="M70,330 L150,110 Q250,80 420,110 L560,170 L560,380 L90,380 Z" fill="#fde2e4" stroke="#be123c" stroke-width="2"/>')
t(520, 404, 'Koana (ke nasofaring)', 12, 700, '#9f1239', 'middle')
# pleksus Kiesselbach
kx, ky = 150, 320
o.append(f'<circle cx="{kx}" cy="{ky}" r="38" fill="#fecaca" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="5,3"/>')
art = [  # (start, label, color, label pos, anchor)
    ((300, 100), 'a. etmoidalis anterior', '#7c3aed', (300, 92), 'middle'),
    ((480, 120), 'a. etmoidalis posterior', '#7c3aed', (490, 112), 'middle'),
    ((560, 300), 'a. sfenopalatina', '#2563eb', (488, 290), 'end'),
    ((340, 380), 'a. palatina mayor', '#2563eb', (340, 430), 'middle'),
    ((60, 380), 'a. labialis superior', '#2563eb', (20, 456), 'start')]
for (sx, sy), lab, col, (lx, ly), an in art:
    o.append(f'<path d="M{sx},{sy} Q{(sx+kx)/2 + 10},{(sy+ky)/2 - 20} {kx + (sx-kx)*0.08:.0f},{ky + (sy-ky)*0.08:.0f}" fill="none" stroke="{col}" stroke-width="4"/>')
    t(lx, ly, lab, 12, 700, col, an)
t(kx + 25, ky + 84, 'Pleksus Kiesselbach', 13, 700, '#b91c1c', 'middle')
t(kx + 25, ky + 100, '(area Little)', 12, 400, '#b91c1c', 'middle')
o.append('<circle cx="520" cy="300" r="22" fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-dasharray="5,3"/>')
t(500, 340, 'sumber posterior', 12, 700, '#1d4ed8', 'end')
# legend
o.append('<rect x="600" y="80" width="300" height="140" rx="10" fill="#f9fafb" stroke="#d1d5db"/>')
o.append('<line x1="614" y1="104" x2="640" y2="104" stroke="#7c3aed" stroke-width="4"/>')
t(648, 108, 'cabang karotis INTERNA', 12.5, 700, '#5b21b6')
o.append('<line x1="614" y1="128" x2="640" y2="128" stroke="#2563eb" stroke-width="4"/>')
t(648, 132, 'cabang karotis EKSTERNA', 12.5, 700, '#1e40af')
t(614, 160, 'Sekitar 90% epistaksis berasal', 12.5, 400, '#374151')
t(614, 178, 'dari septum anterior (pleksus', 12.5, 400, '#374151')
t(614, 196, 'Kiesselbach). AFP 2018', 12.5, 400, '#374151')
o.append('<rect x="600" y="236" width="300" height="130" rx="10" fill="#eff6ff" stroke="#93c5fd"/>')
t(614, 260, 'Posterior: a. maksilaris interna,', 12.5, 700, '#1e3a8a')
t(614, 278, 'sfenopalatina, palatina desendens.', 12.5, 400, '#1e3a8a')
t(614, 302, 'Sulit dijangkau, sering perlu', 12.5, 400, '#1e3a8a')
t(614, 320, 'tampon posterior, endoskopi,', 12.5, 400, '#1e3a8a')
t(614, 338, 'ligasi, atau embolisasi.', 12.5, 400, '#1e3a8a')

# tangga tatalaksana
y0 = 490
t(20, y0, 'Tangga tatalaksana (AAO-HNS 2020; AFP 2018)', 15, 700, '#111827')
steps = [('#f3f4f6', '#6b7280', '1', 'Nilai jalan napas, tanda vital, kesadaran'),
         ('#dcfce7', '#16a34a', '2', 'Duduk condong ke depan; tekan sepertiga bawah hidung ≥ 5 menit (AFP: 10–15 menit)'),
         ('#dbeafe', '#2563eb', '3', 'Bersihkan bekuan, rinoskopi anterior, vasokonstriktor topikal (oksimetazolin)'),
         ('#fef3c7', '#d97706', '4', 'Kauter (perak nitrat) setelah anestesi lokal, hanya pada titik perdarahan'),
         ('#ffedd5', '#ea580c', '5', 'Tampon anterior (resorbable bila ada gangguan pembekuan/antikoagulan)'),
         ('#fee2e2', '#dc2626', '6', 'Tetap berdarah/posterior: rujuk THT, tampon posterior, ligasi atau embolisasi')]
for i, (f, s, k, d) in enumerate(steps):
    y = y0 + 14 + i * 44
    o.append(f'<rect x="{20 + i*14}" y="{y}" width="{880 - i*14}" height="36" rx="8" fill="{f}" stroke="{s}" stroke-width="1.5"/>')
    o.append(f'<circle cx="{40 + i*14}" cy="{y+18}" r="12" fill="{s}"/>')
    t(40 + i * 14, y + 23, k, 13, 700, '#ffffff', 'middle')
    t(62 + i * 14, y + 23, d, 13, 400, '#111827')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
