"""Vertigo: kanal semisirkularis dan BPPV (kanalitiasis), langkah manuver Epley sisi kanan, serta pendekatan waktu-pemicu dan HINTS (ilustrasi skematik)."""
import sys, math
W, H = 920, 980
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Vertigo: BPPV, manuver Epley, dan pendekatan penyebab</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik sederhana, tidak sesuai skala anatomi</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2.5" marker-end="url(#ak)"/>')

# A. kanal
t(20, 88, 'A. Telinga dalam dan BPPV kanal posterior (kanalitiasis)', 15, 700, '#111827')
o.append('<rect x="20" y="104" width="880" height="270" rx="12" fill="#f8fafc" stroke="#d1d5db" stroke-width="1.5"/>')
# utrikulus
o.append('<ellipse cx="170" cy="250" rx="62" ry="38" fill="#fef3c7" stroke="#d97706" stroke-width="2.5"/>')
t(170, 246, 'Utrikulus', 13, 700, '#92400e', 'middle')
t(170, 264, '(makula: otokonia)', 12, 400, '#92400e', 'middle')
# tiga kanal (cincin)
rings = [(330, 160, 'Anterior', '#bfdbfe', '#2563eb'), (330, 312, 'Lateral', '#bfdbfe', '#2563eb'), (500, 250, 'Posterior', '#fecaca', '#b91c1c')]
for cx, cy, name, f, s in rings[:2]:
    o.append(f'<circle cx="{cx}" cy="{cy}" r="46" fill="none" stroke="{s}" stroke-width="12"/>')
    o.append(f'<circle cx="{cx}" cy="{cy}" r="46" fill="none" stroke="#ffffff" stroke-width="4"/>')
    t(cx, cy + 5, name, 12.5, 700, '#1e3a8a', 'middle')
cx, cy = 500, 250
o.append(f'<circle cx="{cx}" cy="{cy}" r="62" fill="none" stroke="#b91c1c" stroke-width="14"/>')
o.append(f'<circle cx="{cx}" cy="{cy}" r="62" fill="none" stroke="#fef2f2" stroke-width="5"/>')
t(cx, cy + 5, 'Posterior', 13, 700, '#7f1d1d', 'middle')
# partikel di kanal posterior
for ang in (200, 215, 230):
    px = cx + 62 * math.cos(math.radians(ang)); py = cy + 62 * math.sin(math.radians(ang))
    o.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5.5" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>')
# ampula + kupula
o.append(f'<rect x="{cx+52}" y="{cy-12}" width="24" height="24" rx="6" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>')
o.append(f'<line x1="{cx+64}" y1="{cy+12}" x2="{cx+66}" y2="{cy+92}" stroke="#7c3aed" stroke-width="1.5"/>')
t(cx - 10, cy + 106, 'Ampula + kupula (sel rambut)', 13, 700, '#5b21b6')
# panah dari utrikulus ke kanal
arrow(232, 252, 436, 252)
t(334, 243, 'otokonia lepas', 12, 700, '#92400e', 'middle')
# legenda kanan
t(650, 138, 'Mengapa vertigo?', 14, 700, '#111827')
lines = ['Partikel (titik oranye) bergerak di kanal', 'saat posisi kepala berubah.', 'Kupula terdorong: sinyal gerak palsu,', 'muncul vertigo dan nistagmus.', 'Singkat (<1 menit setelah nistagmus', 'muncul), lalu mereda.']
for i, l in enumerate(lines): t(650, 162 + i * 20, l, 12.5)
t(650, 306, 'Kanal posterior: 85-95% kasus;', 12.5, 700, '#b91c1c')
t(650, 326, 'kanal lateral: 5-15% (AAO-HNS 2017)', 12.5, 700, '#b91c1c')

# B. Epley
t(20, 410, 'B. Manuver Epley (telinga kanan yang sakit; StatPearls BPPV 2025)', 15, 700, '#111827')
steps = [('1. Duduk', 'kepala menoleh 45°', 'ke telinga sakit', -45, '#e0e7ff'),
         ('2. Berbaring cepat', 'kepala menggantung', '20-30°, tahan 20-30 dtk', -45, '#fee2e2'),
         ('3. Menoleh 90°', 'ke sisi sehat,', 'tahan ±20 dtk', 45, '#fef3c7'),
         ('4. Miring ke sisi sehat', 'wajah hampir ke bawah,', 'tahan 20-30 dtk', 135, '#fef3c7'),
         ('5. Duduk', 'kembali tegak', '', 0, '#dcfce7')]
for i, (a, b, c, rot, f) in enumerate(steps):
    x = 20 + i * 178
    o.append(f'<rect x="{x}" y="426" width="168" height="200" rx="10" fill="{f}" stroke="#6b7280" stroke-width="1.8"/>')
    t(x + 84, 450, a, 13, 700, '#111827', 'middle')
    hx, hy = x + 84, 520
    if i in (1, 2):
        o.append(f'<rect x="{x+18}" y="{hy+30}" width="132" height="14" rx="4" fill="#9ca3af"/>')
        hy = 506
    o.append(f'<g transform="translate({hx},{hy}) rotate({rot})"><circle r="30" fill="#fde68a" stroke="#92400e" stroke-width="2.5"/><polygon points="-7,-28 7,-28 0,-44" fill="#fde68a" stroke="#92400e" stroke-width="2.5"/></g>')
    t(x + 84, 582, b, 12.5, 400, '#111827', 'middle')
    t(x + 84, 600, c, 12.5, 400, '#111827', 'middle')
    if i < 4: arrow(x + 168, 526, x + 178, 526)
t(20, 650, 'Segitiga di atas lingkaran menunjukkan arah hidung. Sisi kiri dilakukan sebagai bayangan cermin. Tidak perlu pembatasan postur sesudahnya (AAO-HNS 2017).', 12, 400, '#4b5563')

# C. pola waktu
t(20, 690, 'C. Waktu dan pemicu menentukan penyebab (AFP 2017)', 15, 700, '#111827')
cols = [(20, 'Episodik dipicu', 'detik-jam, dipicu gerak kepala', 'BPPV', '#dcfce7', '#15803d'),
        (320, 'Episodik spontan', 'detik-hari, tanpa pemicu', 'Meniere, migren vestibular', '#fef3c7', '#d97706'),
        (620, 'Kontinu akut', 'hari-minggu', 'Vestibular neuritis atau stroke', '#fee2e2', '#b91c1c')]
for x, a, b, c, f, s in cols:
    o.append(f'<rect x="{x}" y="706" width="280" height="96" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x + 140, 732, a, 14, 700, '#111827', 'middle')
    t(x + 140, 754, b, 12.5, 400, '#374151', 'middle')
    t(x + 140, 782, c, 13, 700, s, 'middle')
# HINTS
t(20, 840, 'HINTS pada vertigo kontinu akut (oleh pemeriksa berpengalaman)', 15, 700, '#111827')
o.append('<rect x="20" y="856" width="430" height="90" rx="10" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>')
t(235, 880, 'Perifer', 14, 700, '#15803d', 'middle')
t(36, 902, 'Head impulse: ada sakade korektif', 12.5)
t(36, 920, 'Nistagmus searah horizontal', 12.5)
t(36, 938, 'Test of skew: tidak ada deviasi vertikal', 12.5)
o.append('<rect x="470" y="856" width="430" height="90" rx="10" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/>')
t(685, 880, 'Sentral (curiga stroke)', 14, 700, '#b91c1c', 'middle')
t(486, 902, 'Head impulse normal (tanpa sakade)', 12.5)
t(486, 920, 'Nistagmus vertikal/torsional atau berubah arah', 12.5)
t(486, 938, 'Ada deviasi vertikal (skew)', 12.5)
t(20, 970, 'Dasar: AAO-HNS BPPV 2017, AFP 2017, StatPearls BPPV 2025 dan vestibular neuronitis 2023. Model kanal dari buku ajar anatomi telinga.', 12, 400, '#4b5563')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o))
