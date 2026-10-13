"""Apendisitis akut: anatomi kuadran kanan bawah, titik McBurney, variasi posisi apendiks, dan rantai patofisiologi (ilustrasi skematik)."""
import sys
W, H = 920, 700
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Apendisitis akut: dari sumbatan lumen sampai perforasi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik, tidak sesuai skala. Tampak depan: sisi kanan pasien ada di kiri gambar.</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ah)"/>')

# panel kiri: anatomi
o.append('<rect x="14" y="70" width="420" height="614" rx="12" fill="#f9fafb" stroke="#d1d5db"/>')
t(30, 96, 'Anatomi kuadran kanan bawah', 15, 700, '#111827')
# kolon asendens dan sekum
o.append('<path d="M120,110 L120,280 Q120,350 175,355 Q235,355 240,295 L240,110" fill="#fde68a" stroke="#b45309" stroke-width="2"/>')
t(180, 135, 'Kolon', 12, 700, '#92400e', 'middle')
t(180, 151, 'asendens', 12, 700, '#92400e', 'middle')
t(180, 330, 'Sekum', 12.5, 700, '#92400e', 'middle')
# ileum terminal
o.append('<path d="M410,240 Q320,255 240,285" fill="none" stroke="#f472b6" stroke-width="18" stroke-linecap="round"/>')
t(408, 228, 'Ileum terminal', 12, 700, '#be185d', 'end')
# apendiks posisi alternatif (garis putus)
alts = [('M205,352 Q235,250 210,190', 'retrosekal', 214, 182, 'start'),
        ('M205,352 Q190,405 170,440', 'subsekal', 120, 462, 'start'),
        ('M210,352 Q300,370 330,420', 'pelvis (ke panggul)', 290, 442, 'start'),
        ('M215,350 Q280,320 320,300', 'pre/postileal', 326, 312, 'start')]
for d, lab, lx, ly, an in alts:
    o.append(f'<path d="{d}" fill="none" stroke="#16a34a" stroke-width="7" stroke-linecap="round" stroke-dasharray="3,7" opacity="0.9"/>')
    t(lx, ly, lab, 12, 700, '#15803d', an)
t(30, 590, 'Hijau putus-putus: kemungkinan posisi ujung apendiks.', 12, 400, '#15803d')
t(30, 607, 'Retrosekal paling sering; pangkalnya tetap di', 12, 400, '#15803d')
t(30, 624, 'ujung sekum, tempat ketiga taenia coli bertemu.', 12, 400, '#15803d')
# umbilikus, SIAS, garis spinoumbilikal, McBurney
ux, uy, ax, ay = 372, 132, 60, 330
o.append(f'<line x1="{ux}" y1="{uy}" x2="{ax}" y2="{ay}" stroke="#6b7280" stroke-width="1.5" stroke-dasharray="6,4"/>')
o.append(f'<circle cx="{ux}" cy="{uy}" r="9" fill="#ffffff" stroke="#111827" stroke-width="2"/>')
t(ux, uy - 16, 'Umbilikus (T10)', 12, 700, '#111827', 'middle')
o.append(f'<circle cx="{ax}" cy="{ay}" r="7" fill="#111827"/>')
t(ax + 4, ay + 26, 'SIAS', 12, 700, '#111827', 'middle')
mx, my = ux + (ax - ux) * 2 / 3, uy + (ay - uy) * 2 / 3
o.append(f'<circle cx="{mx:.0f}" cy="{my:.0f}" r="10" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/>')
arrow(70, 512, mx - 6, my + 10, '#b91c1c')
t(30, 530, 'Titik McBurney (merah): 2/3 jarak dari umbilikus', 12.5, 700, '#b91c1c')
t(30, 547, 'ke SIAS kanan, pada garis spinoumbilikal', 12, 400, '#b91c1c')
# nyeri berpindah
t(30, 652, 'Nyeri awal samar di sekitar umbilikus (viseral, T10),', 12, 700, '#1d4ed8')
t(30, 669, 'lalu menetap di kanan bawah (peritoneum parietal).', 12, 700, '#1d4ed8')

# panel kanan: rantai patofisiologi
steps = [('#f3f4f6', '#6b7280', '1. Lumen tersumbat', 'Fekalit/apendikolit, hiperplasia limfoid, tumor'),
         ('#dbeafe', '#2563eb', '2. Tekanan lumen naik', 'Mukus terus diproduksi, apendiks meregang'),
         ('#e0e7ff', '#4f46e5', '3. Aliran vena & limfe macet', 'Dinding edema; nyeri viseral periumbilikal'),
         ('#ffedd5', '#ea580c', '4. Iskemia + bakteri tumbuh', 'Aerob, lalu campuran aerob-anaerob'),
         ('#fee2e2', '#dc2626', '5. Radang menembus dinding', 'Peritoneum parietal teriritasi: nyeri lokal'),
         ('#fecaca', '#b91c1c', '6. Gangren dan perforasi', 'Abses lokal atau peritonitis difus, sepsis')]
x0, y0, bw, bh, gap = 452, 78, 452, 74, 22
for i, (f, s, a, b) in enumerate(steps):
    y = y0 + i * (bh + gap)
    o.append(f'<rect x="{x0}" y="{y}" width="{bw}" height="{bh}" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x0 + 14, y + 29, a, 15, 700, '#111827')
    t(x0 + 14, y + 53, b, 13, 400, '#374151')
    if i < len(steps) - 1:
        arrow(x0 + bw / 2, y + bh + 1, x0 + bw / 2, y + bh + gap - 2)
t(x0, 676, 'Makin lama tanpa tindakan, makin besar risiko perforasi.', 12.5, 700, '#7f1d1d')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
