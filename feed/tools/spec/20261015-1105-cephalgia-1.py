"""Cephalgia: mekanisme migren (trigeminovaskular, CGRP) dengan target obat, fase serangan, dan perbandingan tiga nyeri kepala primer (ilustrasi skematik)."""
import sys
W, H = 920, 960
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Cephalgia (nyeri kepala): mekanisme migren dan tiga jenis primer</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik sederhana, tidak sesuai skala anatomi</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, lines, fill, stroke, size=13):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    n = len(lines); y0 = y + h / 2 - (n - 1) * 8 + 5
    for i, s in enumerate(lines):
        t(x + w / 2, y0 + i * 16, s, size, 700 if i == 0 else 400, '#111827', 'middle')
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2.5" marker-end="url(#ak)"/>')

t(20, 88, 'A. Rantai kejadian migren dan target obat', 15, 700, '#111827')
steps = [(20, ['Pemicu', 'stres, hormon, tidur,', 'makan terlewat'], '#fef3c7', '#d97706'),
         (195, ['Cortical', 'spreading depression', '(penyebab aura)'], '#ede9fe', '#7c3aed'),
         (370, ['Sistem trigeminal', 'teraktivasi: CGRP', 'dilepas'], '#fee2e2', '#b91c1c'),
         (545, ['Pembuluh dura melebar,', 'peradangan', 'neurogenik'], '#fee2e2', '#b91c1c'),
         (720, ['Nukleus trigeminal', 'kaudalis, talamus,', 'korteks: nyeri'], '#e0e7ff', '#4f46e5')]
for x, ln, f, s in steps:
    box(x, 108, 165, 78, ln, f, s, 12.5)
for i in range(4):
    arrow(x := steps[i][0] + 165, 147, steps[i + 1][0] - 2, 147)
# target obat
t(20, 222, 'Target obat (StatPearls 2024, NICE CG150):', 13.5, 700, '#111827')
drugs = [(20, 'OAINS, parasetamol', 'menekan nyeri dan prostaglandin', '#dcfce7', '#15803d'),
         (255, 'Triptan', 'agonis 5-HT1B/1D pada pembuluh', '#dcfce7', '#15803d'),
         (490, 'Gepant dan antibodi CGRP', 'memblok CGRP atau reseptornya', '#dcfce7', '#15803d'),
         (725, 'Penyekat beta, topiramat,', 'amitriptilin: pencegahan', '#dbeafe', '#2563eb')]
for x, a, b, f, s in drugs:
    o.append(f'<rect x="{x}" y="234" width="{215 if x < 725 else 175}" height="56" rx="8" fill="{f}" stroke="{s}" stroke-width="1.8"/>')
    t(x + (215 if x < 725 else 175) / 2, 257, a, 12.5, 700, '#111827', 'middle')
    t(x + (215 if x < 725 else 175) / 2, 275, b, 11.5, 400, '#374151', 'middle')
# B fase serangan
t(20, 330, 'B. Fase serangan migren', 15, 700, '#111827')
phases = [(20, 195, '#f3f4f6', '#6b7280', 'Prodrom', ['sekitar 77% pasien', 'hingga 24-48 jam', 'sebelum nyeri']),
          (230, 195, '#ede9fe', '#7c3aed', 'Aura', ['sekitar 25% kasus', 'biasanya <60 menit', 'paling sering visual']),
          (440, 235, '#fee2e2', '#b91c1c', 'Nyeri kepala', ['biasanya 4-72 jam', 'berdenyut, mual,', 'fotofobia, fonofobia']),
          (690, 210, '#f3f4f6', '#6b7280', 'Postdrom', ['lemas, pusing,', 'sulit konsentrasi'])]
for x, w, f, s, name, ln in phases:
    o.append(f'<rect x="{x}" y="346" width="{w}" height="104" rx="9" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x + w / 2, 372, name, 14, 700, '#111827', 'middle')
    for i, l in enumerate(ln):
        t(x + w / 2, 396 + i * 18, l, 12.5, 400, '#374151', 'middle')
for x in (216, 426, 676):
    arrow(x, 398, x + 12, 398)
# C tiga primer
t(20, 492, 'C. Tiga nyeri kepala primer (ICHD-2 menurut AFP 2013; NICE CG150)', 15, 700, '#111827')
cols = [(20, 'Migren', '#fee2e2', '#b91c1c', ['Unilateral atau bilateral', 'Berdenyut, sedang-berat', 'Diperberat aktivitas rutin', '4-72 jam (dewasa)', 'Mual/muntah, atau', 'fotofobia + fonofobia', '≥5 serangan']),
        (320, 'Tension-type (TTH)', '#dbeafe', '#2563eb', ['Bilateral', 'Menekan/mengikat, ringan-sedang', 'Tidak diperberat aktivitas', '30 menit sampai 7 hari', 'Tanpa mual/muntah', 'Maks. satu: foto- atau fonofobia', '≥10 serangan']),
        (620, 'Klaster', '#fef3c7', '#d97706', ['Unilateral: orbita,', 'supraorbita, temporal', 'Sangat berat', '15-180 menit', 'Gejala otonom ipsilateral:', 'mata merah/berair, hidung', 'tersumbat, ptosis, gelisah'])]
for x, name, f, s, ln in cols:
    o.append(f'<rect x="{x}" y="508" width="280" height="212" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x + 140, 534, name, 15, 700, '#111827', 'middle')
    for i, l in enumerate(ln):
        t(x + 14, 562 + i * 22, l, 12.5)
# D red flags
t(20, 758, 'D. Cari tanda bahaya dulu (AFP 2013; NICE CG150) sebelum menyebut nyeri kepala primer', 15, 700, '#b91c1c')
o.append('<rect x="20" y="774" width="880" height="140" rx="10" fill="#fff1f2" stroke="#b91c1c" stroke-width="2"/>')
flags = ['Nyeri kepala pertama atau terburuk seumur hidup', 'Thunderclap: puncak dalam menit', 'Demam dengan kaku kuduk', 'Defisit neurologis, perubahan kesadaran',
         'Dipicu batuk, olahraga, bersin, atau seks', 'Usia >50 tahun, baru, nyeri tekan arteri temporalis', 'Hamil atau pascapersalinan', 'Imunokompromais, kanker, HIV',
         'Papiledema', 'Pola memburuk atau overuse obat']
for i, f in enumerate(flags):
    col = i % 2; row = i // 2
    t(40 + col * 440, 802 + row * 24, '• ' + f, 13)
t(20, 940, 'Dasar: AFP 2013 (Hainer dan Matheson), NICE CG150, StatPearls Migraine Headache (2024). Model mekanisme dari buku ajar neuroanatomi.', 12, 400, '#4b5563')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o))
