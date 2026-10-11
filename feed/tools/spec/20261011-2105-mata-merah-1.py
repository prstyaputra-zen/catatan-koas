"""Alur mata merah: tanda bahaya vs konjungtivitis (AFP 2010; AAO PPP 2023)."""
import sys
W, H = 900, 640
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Mata merah: cari tanda bahaya dulu, baru konjungtivitis</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik ringkas untuk layanan primer</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, fill, stroke, title, lines, tc):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    yy = y + 26
    if title:
        t(x + 14, yy, title, 15, 700, tc); yy += 23
    for ln in lines:
        b = ln.startswith('*'); t(x + 14, yy, ln.lstrip('*'), 13, 700 if b else 400); yy += 19
def arrow(x1, y1, x2, y2, lab=None, lx=0, ly=0):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')
    if lab: t(lx, ly, lab, 13, 700, '#374151', 'middle')
box(250, 70, 400, 160, '#f3f4f6', '#6b7280', 'Ada tanda bahaya?', ['Visus turun · nyeri berat / fotofobia', 'Pupil tidak normal (lebar, kecil, tidak rata)', 'Kornea keruh / bercak putih / ulkus', 'Trauma, zat kimia, operasi mata baru-baru ini', 'Pus sangat banyak · pengguna lensa kontak', 'Riwayat herpes, infeksi berulang'], '#111827')
arrow(250, 150, 190, 270, 'Ya', 200, 210)
arrow(650, 150, 710, 270, 'Tidak', 700, 210)
box(20, 274, 340, 270, '#fef2f2', '#dc2626', 'Rujuk segera ke dokter mata', ['*Keratitis: kornea keruh, fotofobia,', '  sekret mukopurulen, bisa hipopion', '*Iritis: pupil kecil, injeksi siliar,', '  nyeri ke alis/pelipis', '*Glaukoma akut: pupil lebar reaktif', '  lemah, bola mata keras, halo, nyeri', '  hebat berdenyut, visus turun tajam', '*Konjungtivitis hiperakut (gonokokus):', '  pus sangat banyak, perlu terapi sistemik', '*Trauma / luka bakar kimia'], '#991b1b')
box(380, 274, 500, 270, '#ecfdf5', '#059669', 'Visus normal: kemungkinan konjungtivitis', [], '#065f46')
cols = [('Virus', ['Sekret encer', 'Sering satu mata', 'lalu mata lain', 'dalam 1-2 hari', 'KGB preaurikular,', 'folikel', 'Menular 10-14 hr']),
        ('Bakteri', ['Sekret purulen', 'ringan-sedang', 'Mata lengket', 'saat bangun', '(prediktor terbaik)', 'Edema kelopak', 'Sering sembuh sendiri']),
        ('Alergi', ['Gatal hebat', 'Dua mata', 'Sekret berserat/', 'encer', 'Papil cobblestone,', 'kemosis', 'Tidak nyeri'])]
for i, (title, lines) in enumerate(cols):
    x = 394 + i * 160
    o.append(f'<rect x="{x}" y="318" width="148" height="214" rx="10" fill="#ffffff" stroke="#6ee7b7" stroke-width="1.5"/>')
    t(x + 74, 342, title, 14, 700, '#065f46', 'middle')
    for k, ln in enumerate(lines):
        t(x + 10, 366 + k * 22, ln, 12.5)
t(20, 576, 'Rujuk juga bila tidak membaik: virus > 7-10 hari, bakteri > 1 minggu, atau sering kambuh / kronis.', 13)
t(20, 598, 'Hindari steroid atau antibiotik topikal tanpa indikasi jelas (AAO).', 13)
t(20, 628, 'Sumber: Cronau H, et al. Am Fam Physician 2010;81(2):137-144; AAO Conjunctivitis Preferred Practice Pattern 2023.', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
