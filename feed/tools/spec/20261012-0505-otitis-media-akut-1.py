"""Otitis media akut: anatomi tuba Eustachius anak vs dewasa dan rantai patofisiologi (ilustrasi skematik)."""
import sys
W, H = 900, 660
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Otitis media akut: mengapa anak lebih sering terkena</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik, tidak sesuai skala</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ah)"/>')

def ear(ox, oy, label, tube_end, tube_w, note):
    # liang telinga luar
    o.append(f'<rect x="{ox}" y="{oy+70}" width="90" height="34" fill="#fde68a" stroke="#b45309" stroke-width="1.5"/>')
    t(ox + 45, oy + 62, 'Liang telinga', 12, 400, '#92400e', 'middle')
    # membran timpani
    o.append(f'<line x1="{ox+90}" y1="{oy+55}" x2="{ox+90}" y2="{oy+120}" stroke="#7c3aed" stroke-width="4"/>')
    t(ox + 90, oy + 140, 'Membran timpani', 12, 700, '#6d28d9', 'middle')
    # telinga tengah
    o.append(f'<rect x="{ox+92}" y="{oy+45}" width="86" height="84" rx="14" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>')
    t(ox + 135, oy + 38, 'Telinga tengah', 12, 700, '#1d4ed8', 'middle')
    # osikel
    for (cx, cy) in [(ox+108, oy+82), (ox+130, oy+72), (ox+152, oy+84)]:
        o.append(f'<circle cx="{cx}" cy="{cy}" r="7" fill="#f9fafb" stroke="#374151" stroke-width="1.5"/>')
    t(ox + 135, oy + 112, 'osikel', 11, 400, '#374151', 'middle')
    # tuba Eustachius
    x1, y1 = ox + 160, oy + 129
    x2, y2 = tube_end
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#f97316" stroke-width="{tube_w}" stroke-linecap="round"/>')
    # nasofaring
    o.append(f'<ellipse cx="{x2+22}" cy="{y2+6}" rx="42" ry="20" fill="#fee2e2" stroke="#dc2626" stroke-width="1.5"/>')
    t(x2 + 22, y2 + 11, 'Nasofaring', 11.5, 700, '#991b1b', 'middle')
    t(ox, oy + 8, label, 15, 700, '#111827')
    for k, ln in enumerate(note):
        t(ox, oy + 220 + k * 18, ln, 12.5)

o.append('<rect x="14" y="70" width="420" height="570" rx="12" fill="#f9fafb" stroke="#d1d5db"/>')
ear(30, 92, 'Anak', (280, 236), 13, ['Tuba lebih pendek, lebih datar (horizontal),', 'dan lebih lebar: sekret dan kuman dari', 'nasofaring mudah naik ke telinga tengah;', 'drainase dari telinga tengah juga kurang baik.'])
ear(30, 380, 'Dewasa', (330, 606), 7, [])
t(225, 405, 'Tuba lebih panjang dan miring:', 12.5, 400, '#1f2937')
t(225, 423, 'drainase lebih baik,', 12.5, 400, '#1f2937')
t(225, 441, 'refluks lebih sulit.', 12.5, 400, '#1f2937')
t(30, 294, 'Tuba Eustachius (oranye): ventilasi, drainase, proteksi', 12.5, 700, '#c2410c')

# rantai patofisiologi
steps = [('#f3f4f6', '#6b7280', 'ISPA virus / alergi', 'Mukosa nasofaring dan tuba edema'),
         ('#ffedd5', '#ea580c', 'Tuba tersumbat', 'Udara telinga tengah diserap, tekanan negatif'),
         ('#dbeafe', '#2563eb', 'Efusi telinga tengah', 'Cairan tertarik keluar dari mukosa'),
         ('#fee2e2', '#dc2626', 'Infeksi bakteri', 'S. pneumoniae, H. influenzae, M. catarrhalis'),
         ('#ede9fe', '#7c3aed', 'Pus menumpuk', 'Membran timpani menonjol (bulging), nyeri, demam'),
         ('#fef3c7', '#d97706', 'Perforasi', 'Pus keluar (otorea), nyeri biasanya berkurang')]
x0, y0, bw, bh, gap = 460, 78, 420, 62, 18
t(x0, y0 - 4, '', 1)
for i, (f, s, a, b) in enumerate(steps):
    y = y0 + i * (bh + gap)
    o.append(f'<rect x="{x0}" y="{y}" width="{bw}" height="{bh}" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x0 + 14, y + 25, a, 15, 700, '#111827')
    t(x0 + 14, y + 47, b, 13)
    if i < len(steps) - 1:
        arrow(x0 + bw / 2, y + bh + 1, x0 + bw / 2, y + bh + gap - 2)
t(x0, 572, 'Diagnosis OMA (AAFP 2019): bulging sedang-berat atau otorea', 12.5, 700, '#111827')
t(x0, 590, 'baru (bukan otitis eksterna); atau bulging ringan + nyeri', 12.5, 400)
t(x0, 608, 'telinga < 48 jam atau eritema membran timpani yang hebat.', 12.5, 400)
t(20, 652, 'Sumber: Gaddey HL, et al. Am Fam Physician 2019;100(6):350-356. Anatomi tuba: konsep buku ajar standar.', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
