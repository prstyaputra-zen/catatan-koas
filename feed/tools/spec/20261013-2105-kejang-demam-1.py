"""Kejang demam: mengapa terjadi, klasifikasi sederhana vs kompleks, dan alur penanganan kejang (ilustrasi skematik)."""
import sys
W, H = 920, 760
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Kejang demam: mekanisme, klasifikasi, dan alur penanganan</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik. Dosis mengikuti RCH Melbourne (2025); sesuaikan dengan protokol rumah sakit.</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ah)"/>')
def box(x, y, w, h, f, s, lines, title_size=14):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    for k, (txt, bold) in enumerate(lines):
        t(x + 12, y + 24 + k * 19, txt, title_size if k == 0 else 12.5, 700 if bold else 400, '#111827' if k == 0 else '#374151')

# baris 1: mekanisme
t(20, 88, 'A. Mengapa anak kecil kejang saat demam', 15, 700, '#111827')
y1 = 100
box(20, y1, 200, 92, '#fee2e2', '#dc2626', [('Demam ≥ 38 °C', True), ('sering infeksi virus', False), ('(mis. HHV-6, influenza A)', False)])
box(20, y1 + 104, 200, 72, '#ede9fe', '#7c3aed', [('Otak belum matang', True), ('usia 6 bulan–5 tahun', False)])
box(20, y1 + 188, 200, 72, '#e0e7ff', '#4f46e5', [('Bakat genetik', True), ('riwayat keluarga', False)])
for yy in (y1 + 46, y1 + 140, y1 + 224):
    arrow(222, yy, 282, y1 + 130)
box(286, y1 + 84, 190, 92, '#ffedd5', '#ea580c', [('Neuron mudah', True), ('terangsang', False), ('ambang kejang turun', False)])
arrow(478, y1 + 130, 520, y1 + 130)
box(524, y1 + 84, 160, 92, '#fef3c7', '#d97706', [('Lepas muatan', True), ('listrik serentak', False), ('= kejang umum', False)])
o.append(f'<rect x="700" y="{y1}" width="204" height="260" rx="10" fill="#f9fafb" stroke="#9ca3af" stroke-width="1.5"/>')
t(712, y1 + 24, 'Bukan kejang demam bila:', 13.5, 700, '#b91c1c')
for k, s in enumerate(['infeksi SSP (meningitis,', 'ensefalitis)', 'gangguan elektrolit,', 'hipoglikemia, zat/obat', 'pernah kejang tanpa', 'demam sebelumnya']):
    t(716, y1 + 50 + k * 19, ('• ' if k in (0, 2, 4) else '  ') + s, 12.5)
t(712, y1 + 186, 'Umumnya jinak:', 12.5, 700, '#374151')
t(712, y1 + 205, 'kebanyakan anak tanpa', 12.5, 400, '#374151')
t(712, y1 + 224, 'gangguan saraf jangka', 12.5, 400, '#374151')
t(712, y1 + 243, 'panjang.', 12.5, 400, '#374151')

# baris 2: klasifikasi
y2 = 384
t(20, y2, 'B. Sederhana atau kompleks', 15, 700, '#111827')
box(20, y2 + 12, 430, 112, '#dcfce7', '#16a34a', [('Sederhana: SEMUA syarat', True), ('• kejang umum (tonik-klonik)', False), ('• < 15 menit, pulih penuh < 1 jam', False), ('• tidak berulang dalam penyakit/24 jam yang sama', False)])
box(470, y2 + 12, 434, 112, '#fee2e2', '#dc2626', [('Kompleks: SALAH SATU', True), ('• fokal (satu sisi/satu bagian tubuh)', False), ('• ≥ 15 menit atau sadar lama terganggu', False), ('• berulang dalam 24 jam/penyakit yang sama', False)])

# baris 3: alur penanganan
y3 = 532
t(20, y3, 'C. Saat anak kejang', 15, 700, '#111827')
steps = [('#f3f4f6', '#6b7280', '0 menit', ['Miringkan, amankan,', 'jangan isi mulut,', 'catat jam mulai']),
         ('#dbeafe', '#2563eb', '> 5 menit', ['Benzodiazepin ke-1:', 'midazolam bukal/IN', '0,3 mg/kg (maks 10 mg)']),
         ('#e0e7ff', '#4f46e5', 'Masih kejang', ['Benzodiazepin ke-2', '(maksimal 2 dosis', 'termasuk pra-RS)']),
         ('#fee2e2', '#dc2626', 'Masih kejang', ['Lini kedua IV/IO:', 'levetirasetam 40–60 mg/kg', 'atau fenitoin 20 mg/kg'])]
bw, gap = 202, 24
for i, (f, s, head, ls) in enumerate(steps):
    x = 20 + i * (bw + gap)
    o.append(f'<rect x="{x}" y="{y3 + 14}" width="{bw}" height="120" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x + 12, y3 + 40, head, 15, 700, '#111827')
    for k, ln in enumerate(ls):
        t(x + 12, y3 + 64 + k * 20, ln, 12.5)
    if i < 3:
        arrow(x + bw + 2, y3 + 74, x + bw + gap - 2, y3 + 74)
t(20, y3 + 166, 'Midazolam IV/IM/IO 0,15 mg/kg atau diazepam IV/IO 0,3 mg/kg (maks 10 mg) bila jalur tersedia.', 12.5, 400, '#1d4ed8')
t(20, y3 + 188, 'Antipiretik membuat anak nyaman, tetapi tidak mencegah kejang berulang.', 12.5, 700, '#7f1d1d')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
