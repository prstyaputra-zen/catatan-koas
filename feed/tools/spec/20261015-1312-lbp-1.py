"""LBP: anatomi diskus dan akar saraf, tanda bahaya (KIFS), serta alur tatalaksana awal (ilustrasi skematik)."""
import sys
W, H = 920, 960
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Nyeri punggung bawah: anatomi, tanda bahaya, dan alur awal</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik sederhana, tidak sesuai skala anatomi</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, f, s, r=10):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{f}" stroke="{s}" stroke-width="2"/>')
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2.5" marker-end="url(#ak)"/>')

# A. anatomi (tampak samping)
t(20, 88, 'A. Ruas lumbal, diskus, dan penekanan akar saraf', 15, 700, '#111827')
box(20, 104, 880, 290, '#f8fafc', '#d1d5db', 12)
# ruas dan diskus
for i, y in enumerate([124, 214, 304]):
    o.append(f'<rect x="120" y="{y}" width="150" height="56" rx="10" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>')
    t(195, y + 34, f'Ruas lumbal {i+1}' if i < 2 else 'Ruas berikutnya', 13, 700, '#374151', 'middle')
for y in (180, 270):
    o.append(f'<rect x="120" y="{y}" width="150" height="34" rx="12" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>')
    t(195, y + 22, 'Diskus', 12.5, 700, '#78350f', 'middle')
# herniasi
o.append('<ellipse cx="288" cy="287" rx="26" ry="14" fill="#fecaca" stroke="#b91c1c" stroke-width="2.5"/>')
t(120, 384, 'Diskus menonjol menekan akar', 12.5, 700, '#b91c1c')
# kanal dan akar saraf
o.append('<rect x="320" y="124" width="26" height="236" rx="10" fill="#ccfbf1" stroke="#0f766e" stroke-width="2"/>')
t(333, 116, 'Kanal', 12.5, 700, '#134e4a', 'middle')
o.append('<path d="M346 280 C380 280 396 300 430 320" stroke="#0f766e" stroke-width="5" fill="none"/>')
t(330, 384, 'Akar saraf tertekan: nyeri tungkai, lemah, refleks turun', 12.5, 700, '#0f766e')
# peta nyeri
t(500, 138, 'Letak nyeri menurut akar (AFP 2012)', 14, 700, '#111827')
rows = [('L1-L3', 'menjalar ke pinggul dan atau paha'), ('L4-S1', 'menjalar sampai di bawah lutut'), ('SLR positif < lutut', 'mengarah ke radikulopati L4-S1'), ('Reverse SLR (paha depan)', 'mengarah ke akar L3')]
for i, (a, b) in enumerate(rows):
    t(500, 166 + i * 38, a, 13, 700, '#b91c1c')
    t(500, 184 + i * 38, b, 12.5)
t(500, 330, 'Struktur tulang belakang jarang menimbulkan', 12.5, 400, '#4b5563')
t(500, 348, 'nyeri alih di bawah lutut.', 12.5, 400, '#4b5563')

# B. tanda bahaya
t(20, 432, 'B. Tanda bahaya (mnemonik KIFS, tanda kuat dari AFP 2012)', 15, 700, '#111827')
cards = [('K  Kanker', 'Kanker menyebar ke tulang;', 'berat badan turun tanpa sebab', '#fee2e2', '#b91c1c'),
         ('I  Infeksi', 'Demam, ISK, luka di tulang', 'belakang, operasi lumbal baru', '#fef3c7', '#d97706'),
         ('F  Fraktur', 'Trauma bermakna untuk usia;', 'osteoporosis, steroid lama', '#dbeafe', '#2563eb'),
         ('S  Sindrom kauda ekuina', 'Retensi/inkontinensia, anestesi', 'pelana, defisit memburuk', '#fce7f3', '#be185d')]
for i, (a, b, c, f, s) in enumerate(cards):
    x = 20 + i * 222
    box(x, 450, 208, 96, f, s)
    t(x + 104, 476, a, 13.5, 700, '#111827', 'middle')
    t(x + 104, 502, b, 12, 400, '#374151', 'middle')
    t(x + 104, 520, c, 12, 400, '#374151', 'middle')
t(20, 570, 'Tanda kuat: periksa lanjut segera, curigai rujukan. Kauda ekuina dan infeksi: rujuk segera. Tanda lemah atau sedang: boleh diamati 4-6 minggu.', 12.5, 400, '#374151')

# C. alur
t(20, 610, 'C. Alur awal LBP', 15, 700, '#111827')
box(20, 628, 880, 56, '#e0e7ff', '#4f46e5')
t(36, 652, 'Anamnesis dan periksa neurologis tungkai: ada tanda bahaya atau defisit saraf berat/progresif?', 14, 700, '#312e81')
t(36, 672, 'Pencitraan rutin tidak diperlukan bila tidak ada tanda penyakit serius (ACP 2007; NICE NG59).', 12.5)
arrow(240, 686, 240, 712)
arrow(690, 686, 690, 712)
t(252, 704, 'Ya', 13, 700, '#b91c1c')
t(702, 704, 'Tidak (nonspesifik)', 13, 700, '#166534')
box(20, 714, 430, 150, '#fee2e2', '#b91c1c')
t(36, 740, 'Pemeriksaan lanjut dan rujukan', 14.5, 700, '#7f1d1d')
for i, l in enumerate(['MRI lebih disukai; CT bila MRI tidak bisa.', 'Laboratorium: darah lengkap, LED, CRP bila', 'dicurigai infeksi atau keganasan.', 'Rujuk ke subspesialis tulang belakang.']):
    t(36, 764 + i * 22, l, 12.5)
box(470, 714, 430, 150, '#dcfce7', '#16a34a')
t(486, 740, 'Terapi awal', 14.5, 700, '#14532d')
for i, l in enumerate(['Edukasi: biasanya membaik dalam sebulan.', 'Tetap aktif, jangan tirah baring; panas.', 'NSAID dosis terendah, waktu tersingkat.', 'Hindari steroid sistemik, benzodiazepin, opioid.', 'Nilai ulang 2-4 minggu; rujuk bila berat/menetap.']):
    t(486, 764 + i * 20, l, 12.5)
t(20, 900, 'Dasar: AFP 2008, 2012, 2024, 2025; ACP 2007 dan 2017; NICE NG59 (2016); WHO. Anatomi diskus dan kanal dari buku ajar.', 12, 400, '#4b5563')
t(20, 920, 'Singkatan: ISK = infeksi saluran kemih; SLR = straight leg raise (uji angkat tungkai lurus).', 12, 400, '#4b5563')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o))
