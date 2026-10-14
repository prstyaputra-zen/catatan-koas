"""Bell's palsy: perjalanan nervus fasialis dan cabangnya, serta perbedaan lesi UMN (stroke) vs LMN (Bell's palsy) (ilustrasi skematik)."""
import sys
W, H = 920, 760
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Bell\'s palsy: jalur nervus fasialis (N. VII) dan letak lesi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik, tidak sesuai skala</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ah)"/>')

t(20, 90, 'A. Perjalanan saraf dan cabangnya', 15, 700, '#111827')
y = 190
# tulang temporal (kanal fasialis)
o.append(f'<rect x="170" y="{y-40}" width="520" height="80" rx="12" fill="#f5f5f4" stroke="#a8a29e" stroke-width="1.5"/>')
t(430, y - 48, 'Kanal fasialis di tulang temporal (pars petrosa)', 12, 700, '#57534e', 'middle')
# batang otak
o.append(f'<rect x="20" y="{y-36}" width="120" height="72" rx="10" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/>')
t(80, y - 8, 'Nukleus', 13, 700, '#111827', 'middle')
t(80, y + 10, 'fasialis (pons)', 12, 400, '#374151', 'middle')
# saraf
o.append(f'<line x1="140" y1="{y}" x2="790" y2="{y}" stroke="#ca8a04" stroke-width="9" stroke-linecap="round"/>')
# segmen labirintin bengkak
o.append(f'<ellipse cx="250" cy="{y}" rx="38" ry="15" fill="#fca5a5" stroke="#dc2626" stroke-width="2.5"/>')
t(250, y + 34, 'Segmen labirintin:', 12, 700, '#b91c1c', 'middle')
t(250, y + 50, 'bagian kanal tersempit,', 12, 400, '#b91c1c', 'middle')
t(250, y + 66, 'saraf bengkak terjepit', 12, 400, '#b91c1c', 'middle')
t(155, y - 12, 'MAI', 11.5, 700, '#374151', 'middle')
# ganglion genikulatum
o.append(f'<circle cx="330" cy="{y}" r="11" fill="#fde047" stroke="#a16207" stroke-width="2"/>')
br = [(352, 'N. petrosus mayor', ['ke kelenjar lakrimal:', 'mata kering']),
      (500, 'N. ke stapedius', ['redam suara keras:', 'hiperakusis']),
      (648, 'Korda timpani', ['pengecapan 2/3 depan', 'lidah, ludah']) ]
for x, name, eff in br:
    o.append(f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y+100}" stroke="#ca8a04" stroke-width="4"/>')
    o.append(f'<rect x="{x-68}" y="{y+100}" width="136" height="78" rx="8" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.5"/>')
    t(x, y + 120, name, 12, 700, '#713f12', 'middle')
    t(x, y + 140, eff[0], 11.5, 400, '#374151', 'middle')
    t(x, y + 157, eff[1], 11.5, 700, '#b91c1c', 'middle')
t(330, y - 20, 'G. genikulatum', 11.5, 700, '#a16207', 'middle')
t(690, y - 50, 'Foramen', 11.5, 700, '#374151', 'middle')
t(690, y - 36, 'stilomastoid', 11.5, 700, '#374151', 'middle')
o.append(f'<line x1="690" y1="{y-28}" x2="690" y2="{y+40}" stroke="#57534e" stroke-width="2" stroke-dasharray="4,3"/>')
# parotis dan 5 cabang
o.append(f'<ellipse cx="820" cy="{y+40}" rx="70" ry="90" fill="#ecfccb" stroke="#65a30d" stroke-width="1.5"/>')
t(820, y + 150, 'Kelenjar parotis', 12, 700, '#3f6212', 'middle')
labs = ['Temporal (frontal)', 'Zigomatik', 'Bukal', 'Marginal mandibula', 'Servikal']
for k, lab in enumerate(labs):
    yy = y - 30 + k * 32
    o.append(f'<line x1="790" y1="{y}" x2="842" y2="{yy}" stroke="#ca8a04" stroke-width="3"/>')
    t(846, yy + 4, lab.split(' ')[0], 11, 700, '#3f6212')
t(20, 400, 'Otot wajah satu sisi (5 cabang) lumpuh pada semua lesi di jalur ini. Gejala tambahan', 12.5, 400, '#374151')
t(20, 418, '(mata kering, hiperakusis, pengecapan) muncul bila lesi berada sebelum cabang tersebut lepas.', 12.5, 400, '#374151')

# panel B: wajah
t(20, 458, 'B. Dahi ikut lumpuh atau tidak?', 15, 700, '#111827')
def face(cx, cy, forehead, title, sub, col):
    o.append(f'<circle cx="{cx}" cy="{cy}" r="95" fill="#fff7ed" stroke="#9a3412" stroke-width="2"/>')
    # sisi kiri wajah pasien = kanan gambar diarsir
    path = f'M{cx},{cy-95} A95,95 0 0,1 {cx},{cy+95} Z'
    if forehead:
        o.append(f'<path d="{path}" fill="{col}" opacity="0.35"/>')
    else:
        o.append(f'<clipPath id="lo{cx}"><rect x="{cx}" y="{cy-30}" width="100" height="130"/></clipPath>')
        o.append(f'<path d="{path}" fill="{col}" opacity="0.35" clip-path="url(#lo{cx})"/>')
    # alis & dahi
    o.append(f'<path d="M{cx-60},{cy-50} q20,-12 40,0" fill="none" stroke="#111827" stroke-width="3"/>')
    o.append(f'<path d="M{cx+20},{cy-50 + (8 if forehead else 0)} q20,{-12 if not forehead else -2} 40,0" fill="none" stroke="#111827" stroke-width="3"/>')
    for k in range(3):
        o.append(f'<line x1="{cx-55}" y1="{cy-78+k*8}" x2="{cx-15}" y2="{cy-78+k*8}" stroke="#9a3412" stroke-width="1.2"/>')
        if not forehead:
            o.append(f'<line x1="{cx+15}" y1="{cy-78+k*8}" x2="{cx+55}" y2="{cy-78+k*8}" stroke="#9a3412" stroke-width="1.2"/>')
    # mata
    o.append(f'<ellipse cx="{cx-40}" cy="{cy-25}" rx="14" ry="5" fill="#111827"/>')
    o.append(f'<ellipse cx="{cx+40}" cy="{cy-25}" rx="14" ry="{9 if forehead else 6}" fill="#ffffff" stroke="#111827" stroke-width="2"/>')
    o.append(f'<circle cx="{cx+40}" cy="{cy-25 - (4 if forehead else 0)}" r="4" fill="#111827"/>')
    # mulut mencong ke sisi sehat
    o.append(f'<path d="M{cx-50},{cy+38} q30,6 50,4 q25,4 45,14" fill="none" stroke="#111827" stroke-width="3"/>')
    t(cx, cy + 122, title, 14, 700, '#111827', 'middle')
    t(cx, cy + 141, sub, 12, 400, '#374151', 'middle')

face(170, 580, False, 'Lesi UMN (mis. stroke)', 'dahi tetap bisa dikerutkan', '#60a5fa')
face(470, 580, True, "Lesi LMN (Bell's palsy)", 'dahi ikut lumpuh, mata tak menutup', '#f87171')
x0 = 610
lines = [('Mengapa berbeda?', True), ('Bagian nukleus untuk wajah atas', False), ('mendapat persarafan dari KEDUA', False),
         ('hemisfer; wajah bawah terutama', False), ('dari hemisfer seberang.', False), ('', False),
         ('Stroke merusak satu jalur atas:', False), ('dahi masih dijaga hemisfer lain.', False), ('', False),
         ('Bell\'s palsy merusak saraf tepi', False), ('itu sendiri: semua cabang satu', False), ('sisi lumpuh, termasuk dahi.', False)]
for k, (s, b) in enumerate(lines):
    t(x0, 500 + k * 19, s, 14 if b else 12.5, 700 if b else 400, '#111827' if b else '#374151')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
