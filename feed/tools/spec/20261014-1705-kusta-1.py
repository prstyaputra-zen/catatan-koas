"""Kusta: spektrum Ridley-Jopling vs imunitas seluler, letak reaksi tipe 1 dan 2, serta saraf tepi yang sering menebal (ilustrasi skematik)."""
import sys
W, H = 920, 780
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker>',
     '<linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#16a34a"/><stop offset="1" stop-color="#e5e7eb"/></linearGradient>',
     '<linearGradient id="g2" x1="0" x2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Kusta: spektrum imun, reaksi, dan saraf yang diperiksa</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik berdasarkan PNPK Tata Laksana Kusta 2019, CDC 2025, dan WHO 2026</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')

t(20, 90, 'A. Spektrum Ridley-Jopling', 15, 700, '#111827')
x0, x1 = 120, 900
t(20, 128, 'Imunitas', 12.5, 700, '#15803d')
t(20, 144, 'seluler', 12.5, 700, '#15803d')
o.append(f'<rect x="{x0}" y="112" width="{x1-x0}" height="26" rx="6" fill="url(#g1)"/>')
t(x0 + 8, 130, 'kuat', 12, 700, '#ffffff')
t(x1 - 8, 130, 'lemah', 12, 700, '#374151', 'end')
t(20, 176, 'Jumlah', 12.5, 700, '#b91c1c')
t(20, 192, 'kuman', 12.5, 700, '#b91c1c')
o.append(f'<rect x="{x0}" y="160" width="{x1-x0}" height="26" rx="6" fill="url(#g2)"/>')
t(x0 + 8, 178, 'sedikit', 12, 700, '#374151')
t(x1 - 8, 178, 'banyak', 12, 700, '#ffffff', 'end')
types = ['TT', 'BT', 'BB', 'BL', 'LL']
desc = [['lesi sedikit,', 'batas tegas,', 'mati rasa jelas'], ['mirip TT,', 'lesi lebih', 'banyak'], ['campuran,', 'tengah', 'menyembuh'],
        ['lesi asimetris,', 'batas tegas,', 'banyak'], ['lesi banyak,', 'batas samar,', 'infiltrasi difus']]
cw = (x1 - x0) / 5
for i, ty in enumerate(types):
    cx = x0 + cw * i + cw / 2
    o.append(f'<rect x="{x0 + cw*i + 6:.0f}" y="204" width="{cw-12:.0f}" height="118" rx="9" fill="#f9fafb" stroke="#9ca3af"/>')
    t(cx, 228, ty, 17, 700, '#111827', 'middle')
    for k, d in enumerate(desc[i]):
        t(cx, 250 + k * 18, d, 12, 400, '#374151', 'middle')
# reaksi
rx0, rx1 = x0 + cw * 1 + 6, x0 + cw * 4 - 6
o.append(f'<rect x="{rx0:.0f}" y="334" width="{rx1-rx0:.0f}" height="34" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>')
t((rx0 + rx1) / 2, 356, 'Reaksi tipe 1 (reversal): hanya spektrum borderline (BT, BB, BL)', 12.5, 700, '#92400e', 'middle')
ex0, ex1 = x0 + cw * 3 + 6, x1 - 6
o.append(f'<rect x="{ex0:.0f}" y="376" width="{ex1-ex0:.0f}" height="34" rx="8" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>')
t((ex0 + ex1) / 2, 398, 'Tipe 2 (ENL): BL dan LL', 12.5, 700, '#991b1b', 'middle')
o.append(f'<rect x="{x0+6}" y="418" width="{cw*2-12:.0f}" height="30" rx="8" fill="#dcfce7" stroke="#16a34a"/>')
t(x0 + cw, 438, 'WHO PB: 1–5 lesi, BTA negatif', 12.5, 700, '#166534', 'middle')
o.append(f'<rect x="{x0 + cw*2 + 6:.0f}" y="418" width="{cw*3-12:.0f}" height="30" rx="8" fill="#ffe4e6" stroke="#e11d48"/>')
t(x0 + cw * 3.5, 438, 'WHO MB: > 5 lesi, atau saraf terlibat, atau BTA positif', 12.5, 700, '#9f1239', 'middle')
t(x0, 466, 'Pengelompokan PB/MB pada gambar hanya perkiraan; yang menentukan adalah kriteria WHO di atas.', 11.5, 400, '#6b7280')

# panel bawah kiri: tanda kardinal
t(20, 506, 'B. Tanda kardinal (cukup satu)', 15, 700, '#111827')
cards = [('1', 'Bercak putih/kemerahan yang mati rasa'), ('2', 'Saraf tepi menebal + gangguan fungsi'), ('3', 'BTA positif pada kerokan jaringan kulit')]
for i, (k, d) in enumerate(cards):
    y = 520 + i * 54
    o.append(f'<rect x="20" y="{y}" width="410" height="46" rx="9" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>')
    o.append(f'<circle cx="44" cy="{y+23}" r="14" fill="#2563eb"/>')
    t(44, y + 28, k, 14, 700, '#ffffff', 'middle')
    t(68, y + 28, d, 13, 400, '#1e3a8a')
t(20, 704, 'Uji rasa raba: ujung kapas. Nyeri: ujung jarum.', 12.5, 400, '#374151')
t(20, 722, 'Suhu: tabung air hangat vs dingin.', 12.5, 400, '#374151')
t(20, 746, 'Mati rasa = luka tanpa disadari = cacat.', 13, 700, '#b91c1c')

# panel bawah kanan: tubuh dan saraf
bx = 640
t(470, 506, 'C. Saraf tepi yang sering menebal', 15, 700, '#111827')
o.append(f'<circle cx="{bx}" cy="550" r="22" fill="#fff7ed" stroke="#9a3412" stroke-width="2"/>')
o.append(f'<line x1="{bx}" y1="572" x2="{bx}" y2="660" stroke="#9a3412" stroke-width="4"/>')
o.append(f'<line x1="{bx}" y1="590" x2="{bx-60}" y2="650" stroke="#9a3412" stroke-width="4"/>')
o.append(f'<line x1="{bx}" y1="590" x2="{bx+60}" y2="650" stroke="#9a3412" stroke-width="4"/>')
o.append(f'<line x1="{bx}" y1="660" x2="{bx-36}" y2="760" stroke="#9a3412" stroke-width="4"/>')
o.append(f'<line x1="{bx}" y1="660" x2="{bx+36}" y2="760" stroke="#9a3412" stroke-width="4"/>')
pts = [((bx + 20, 562), 'Aurikularis magnus', (bx + 90, 548)), ((bx - 18, 548), 'Fasialis, trigeminus', (470, 540)),
       ((bx - 34, 618), 'Ulnaris (siku)', (470, 600)), ((bx - 52, 640), 'Medianus, radialis', (470, 640)),
       ((bx - 22, 706), 'Peroneus komunis (lutut)', (470, 690)), ((bx + 33, 752), 'Tibialis posterior (mata kaki)', (bx + 70, 742))]
for (px, py), lab, (lx, ly) in pts:
    o.append(f'<circle cx="{px}" cy="{py}" r="7" fill="#dc2626" stroke="#7f1d1d"/>')
    end_x = lx + (len(lab) * 6.6 if lx < bx else -4)
    o.append(f'<line x1="{px}" y1="{py}" x2="{end_x:.0f}" y2="{ly-4}" stroke="#9ca3af" stroke-width="1"/>')
    t(lx, ly, lab, 12, 700, '#7f1d1d')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
