"""Skema regimen MgSO4 IV (Zuspan) dan IM (Pritchard) + pemantauan (WHOPAR RH086, 2020)."""
import sys
W, H = 900, 640
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Magnesium sulfat (MgSO4) pada preeklampsia berat/eklampsia</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · regimen sesuai label produk prakualifikasi WHO · ikuti protokol RS setempat</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def rect(x, y, w, h, fill, stroke, rx=10):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
# Garis waktu
X0, X1 = 150, 870
y_axis = 330
o.append(f'<line x1="{X0}" y1="{y_axis}" x2="{X1}" y2="{y_axis}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')
for x, lab in [(X0, 'Mulai'), (X0 + 150, '+1 jam'), (X0 + 300, '+4 jam'), (X0 + 450, '+8 jam'), (850, 'Selesai')]:
    o.append(f'<line x1="{x}" y1="{y_axis - 6}" x2="{x}" y2="{y_axis + 6}" stroke="#374151" stroke-width="2"/>')
    t(x, y_axis + 24, lab, 12.5, 400, '#374151', 'middle')
o.append(f'<line x1="690" y1="86" x2="690" y2="{y_axis}" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5 5"/>')
o.append(f'<line x1="850" y1="80" x2="850" y2="{y_axis}" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5 5"/>')
t(770, 96, 'lanjut 24 jam', 12.5, 700, '#6b7280', 'middle')
t(690, 80, 'Persalinan / kejang terakhir', 12.5, 700, '#6b7280', 'end')
# Jalur IV
t(20, 136, 'IV (Zuspan)', 15, 700, '#1d4ed8')
rect(X0, 112, 100, 46, '#dbeafe', '#1d4ed8'); t(X0 + 50, 132, '4 g IV', 14, 700, '#1e3a8a', 'middle'); t(X0 + 50, 150, 'dalam 5 menit', 12, 400, '#1e3a8a', 'middle')
rect(X0 + 108, 112, 592, 46, '#eff6ff', '#1d4ed8'); t(X0 + 404, 140, 'Rumatan 1 g/jam infus kontinu', 14, 700, '#1e3a8a', 'middle')
# Jalur IM
t(20, 216, 'IM (Pritchard)', 15, 700, '#7c3aed')
rect(X0, 186, 150, 58, '#ede9fe', '#7c3aed'); t(X0 + 75, 206, '4 g IV (5 menit)', 13, 700, '#4c1d95', 'middle'); t(X0 + 75, 224, '+ 10 g IM', 13, 700, '#4c1d95', 'middle'); t(X0 + 75, 239, '(5 g tiap bokong)', 11.5, 400, '#4c1d95', 'middle')
for k, x in enumerate([X0 + 300, X0 + 450, 770]):
    o.append(f'<circle cx="{x}" cy="215" r="20" fill="#f5f3ff" stroke="#7c3aed" stroke-width="2"/>')
    t(x, 220, '5 g', 12.5, 700, '#4c1d95', 'middle')
t(X0 + 375, 266, '5 g IM tiap 4 jam, bergantian bokong', 13, 400, '#4c1d95', 'middle')
# Kotak bawah
rect(20, 378, 420, 176, '#fffbeb', '#d97706')
t(36, 404, 'Cek SEBELUM tiap dosis / tiap jam infus', 15, 700, '#92400e')
for i, s in enumerate(['Laju napas ≥ 16 x/menit', 'Refleks patela ada', 'Urin ≥ 30 mL/jam (4 jam terakhir)', 'Bila tidak terpenuhi: tunda dosis / hentikan infus']):
    t(44, 434 + i * 28, ('✓ ' if i < 3 else '! ') + s, 14, 700 if i == 3 else 400)
rect(460, 378, 420, 82, '#fef2f2', '#dc2626')
t(476, 404, 'Henti napas: antidot', 15, 700, '#991b1b')
t(476, 430, 'Kalsium glukonat 1 g (10 mL larutan 10%)', 14)
t(476, 450, 'IV pelan dalam 3 menit + bantu napas', 14)
rect(460, 472, 420, 82, '#f0fdf4', '#16a34a')
t(476, 498, 'Kejang berulang (> 15 menit)', 15, 700, '#166534')
t(476, 524, '2 g IV (10 mL larutan 20%) dalam 5 menit', 14)
t(476, 544, 'Lalu lanjutkan rumatan', 14)
t(20, 590, 'Durasi: sampai 24 jam setelah persalinan atau setelah kejang terakhir (pilih yang paling akhir).', 13, 400, '#374151')
t(20, 614, 'Sumber: WHOPAR RH086 Magnesium sulfate 500 mg/mL (WHO, 2020); WHO recommendations pre-eclampsia & eclampsia (2011).', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
