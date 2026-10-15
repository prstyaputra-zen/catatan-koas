"""Neuralgia trigeminal: tiga divisi saraf trigeminus dan titik kompresi, rantai mekanisme, serta tangga terapi (ilustrasi skematik)."""
import sys
W, H = 920, 900
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Neuralgia trigeminal: lokasi, mekanisme, dan tangga terapi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik sederhana, tidak sesuai skala anatomi</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, f, s, r=10):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{f}" stroke="{s}" stroke-width="2"/>')
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2.5" marker-end="url(#ak)"/>')

# A. saraf
t(20, 88, 'A. Saraf trigeminus (N. V) dan area wajah yang dipersarafi', 15, 700, '#111827')
box(20, 104, 880, 300, '#f8fafc', '#d1d5db', 12)
# batang otak
o.append('<rect x="60" y="140" width="130" height="190" rx="20" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/>')
t(125, 168, 'Batang otak', 13, 700, '#374151', 'middle')
t(125, 186, '(pons)', 12.5, 400, '#374151', 'middle')
# akar saraf
o.append('<path d="M190 250 C230 250 250 250 290 250" stroke="#0f766e" stroke-width="7" fill="none"/>')
# arteri menekan
o.append('<ellipse cx="240" cy="226" rx="34" ry="14" fill="#fecaca" stroke="#b91c1c" stroke-width="2.5"/>')
t(240, 231, 'Arteri', 12.5, 700, '#7f1d1d', 'middle')
arrow(240, 198, 240, 210)
t(262, 186, 'menekan akar saraf', 12.5, 700, '#b91c1c', 'middle')
t(255, 280, 'zona masuk akar', 12.5, 700, '#0f766e', 'middle')
# ganglion
o.append('<ellipse cx="340" cy="250" rx="42" ry="30" fill="#ccfbf1" stroke="#0f766e" stroke-width="2.5"/>')
t(340, 247, 'Ganglion', 12.5, 700, '#134e4a', 'middle')
t(340, 263, 'Gasseri', 12.5, 700, '#134e4a', 'middle')
# tiga cabang
for y, nm, f, s in [(160, 'V1 oftalmik', '#dbeafe', '#2563eb'), (250, 'V2 maksilar', '#fef3c7', '#d97706'), (340, 'V3 mandibular', '#dcfce7', '#16a34a')]:
    o.append(f'<path d="M382 250 C420 250 430 {y} 470 {y}" stroke="{s}" stroke-width="5" fill="none"/>')
    box(470, y - 24, 190, 48, f, s)
    t(565, y - 3, nm, 13.5, 700, '#111827', 'middle')
for y, tx in [(160, 'dahi, mata'), (250, 'pipi, hidung, bibir atas'), (340, 'rahang bawah, bibir bawah')]:
    t(565, y + 14, tx, 12, 400, '#374151', 'middle')
t(690, 140, 'Fakta kunci', 14, 700, '#111827')
for i, l in enumerate(['Paling sering V2 dan V3;', 'V1 jarang.', 'Nyeri satu sisi wajah,', 'biasanya tidak melewati', 'garis tengah.', 'Pemicu: sentuhan ringan', '(mencuci muka, makan,', 'bicara, angin).']):
    t(690, 164 + i * 20, l, 12.5)

# B. rantai
t(20, 440, 'B. Rantai mekanisme (teori kompresi vaskular)', 15, 700, '#111827')
steps = [('Arteri menekan', 'akar saraf V', '#fee2e2', '#b91c1c'), ('Selubung mielin', 'rusak (demielinisasi)', '#fef3c7', '#d97706'),
         ('Hubungan pendek', 'antarserabut (ephaptic)', '#fef3c7', '#d97706'), ('Sentuhan ringan', 'dibaca sebagai nyeri', '#ede9fe', '#7c3aed'),
         ('Nyeri seperti', 'sengatan listrik', '#fee2e2', '#b91c1c')]
for i, (a, b, f, s) in enumerate(steps):
    x = 20 + i * 178
    box(x, 460, 160, 70, f, s)
    t(x + 80, 490, a, 13, 700, '#111827', 'middle')
    t(x + 80, 510, b, 12.5, 400, '#374151', 'middle')
    if i < 4: arrow(x + 162, 495, x + 176, 495)
t(20, 556, 'Nyeri tajam, unilateral, berlangsung sepersekian detik hingga 2 menit, berulang. Bila nyeri menetap atau ada defisit saraf, curigai penyebab lain.', 12.5, 400, '#374151')

# C. tangga terapi
t(20, 596, 'C. Tangga terapi (AAN-EFNS 2008)', 15, 700, '#111827')
box(20, 612, 880, 70, '#dcfce7', '#16a34a')
t(36, 638, 'Lini pertama: karbamazepin', 14.5, 700, '#14532d')
t(36, 660, 'Sebagian besar pasien merespons 200-800 mg/hari; mulai rendah, naikkan bertahap; pantau natrium dan efek samping.', 12.5)
arrow(460, 684, 460, 702)
box(20, 704, 880, 70, '#fef3c7', '#d97706')
t(36, 730, 'Bila gagal atau tidak tahan: oksakarbazepin, baklofen, atau lamotrigin', 14.5, 700, '#78350f')
t(36, 752, 'Oksakarbazepin 600-1.800 mg/hari; baklofen 10-80 (AFP) atau 40-80 mg/hari (EFNS); lamotrigin 400 mg/hari sebagai tambahan.', 12.5)
arrow(460, 776, 460, 794)
box(20, 796, 880, 60, '#fee2e2', '#b91c1c')
t(36, 822, 'Refrakter atau efek samping tak tertahankan: bedah', 14.5, 700, '#7f1d1d')
t(36, 842, 'Dekompresi mikrovaskular (MVD), tindakan perkutan, atau gamma knife; rujuk ke bedah saraf.', 12.5)
t(20, 884, 'Dasar: AFP 2008 dan 2009, panduan EFNS 2008, SPS NHS (karbamazepin). Model anatomi dari buku ajar neuroanatomi.', 12, 400, '#4b5563')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o))
