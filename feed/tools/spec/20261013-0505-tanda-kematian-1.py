"""Linimasa perubahan pascamati (StatPearls: Zubair & Menezes 2026; Shrestha dkk. 2023). Skematik, nilai kira-kira daerah tropis."""
import sys
W, H = 900, 560
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Linimasa perubahan pascamati (perkiraan)</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · rentang berbeda antarsumber dan sangat dipengaruhi suhu lingkungan, pakaian, dan tubuh</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
X0, X1 = 210, 880
HMAX = 72
def xh(h): return X0 + h / HMAX * (X1 - X0)
Y0 = 80
rows = 5
RH = 74
for h in [0, 6, 12, 24, 36, 48, 72]:
    x = xh(h)
    o.append(f'<line x1="{x:.0f}" y1="{Y0}" x2="{x:.0f}" y2="{Y0+rows*RH}" stroke="#e5e7eb"/>')
    t(x, Y0 + rows * RH + 18, f'{h} jam', 12, 400, '#4b5563', 'middle')
def seg(row, a, b, col, lab='', dash=False):
    y = Y0 + row * RH + 30
    extra = ' stroke="#374151" stroke-dasharray="4 3" fill-opacity="0.35"' if dash else ''
    o.append(f'<rect x="{xh(a):.0f}" y="{y}" width="{xh(b)-xh(a):.0f}" height="22" rx="4" fill="{col}"{extra}/>')
    if lab: t((xh(a) + xh(b)) / 2, y + 16, lab, 11.5, 700, '#111827', 'middle')
names = [('Lebam mayat', 'livor mortis'), ('Kaku mayat', 'rigor mortis'), ('Penurunan suhu', 'algor mortis'), ('Pembusukan awal', 'hijau di fosa iliaka kanan'), ('Pembengkakan', 'bloating, marbling')]
for i, (a, b) in enumerate(names):
    t(X0 - 12, Y0 + i * RH + 40, a, 14, 700, '#111827', 'end')
    t(X0 - 12, Y0 + i * RH + 58, b, 12, 400, '#6b7280', 'end')
    o.append(f'<line x1="20" y1="{Y0+(i+1)*RH}" x2="{X1}" y2="{Y0+(i+1)*RH}" stroke="#f3f4f6"/>')
seg(0, 0.5, 2, '#c4b5fd', '')
t(xh(1.2), Y0 + 24, 'muncul ½-2 jam', 11.5, 700, '#5b21b6', 'start')
seg(0, 2, 8, '#a78bfa')
seg(0, 8, 72, '#7c3aed', 'menetap (fixed): 6-8 jam* atau > 12 jam**')
seg(1, 1, 4, '#fdba74')
seg(1, 4, 12, '#fb923c')
seg(1, 12, 24, '#ea580c', 'bertahan ± 12 jam')
seg(1, 24, 36, '#fed7aa', 'hilang ± 36 jam**')
ry = Y0 + RH + 24
t(xh(1), ry, 'mulai di wajah 1-4 jam*, lengkap 6-12 jam', 11.5, 700, '#9a3412', 'start')
seg(2, 0, 24, '#93c5fd')
t(xh(24) + 8, Y0 + 2 * RH + 46, 'turun bertahap sampai sama dengan suhu lingkungan (± 18-24 jam*)', 11.5, 700, '#1e3a8a')
seg(3, 12, 24, '#86efac', '', True)
seg(3, 24, 72, '#22c55e', '24-72 jam (iklim sedang)*')
t(xh(12), Y0 + 3 * RH + 24, '12-24 jam bila panas*', 11.5, 700, '#166534', 'start')
seg(4, 24, 48, '#a3a3a3', '24-48 jam*')
t(20, Y0 + rows * RH + 50, '* Zubair & Menezes, StatPearls (2026)   ** Shrestha dkk., StatPearls (2023). Kaku mayat terlambat hilang pada suhu dingin, lebih cepat pada suhu panas.', 12, 400, '#374151')
t(20, Y0 + rows * RH + 72, 'Jangan memperkirakan saat kematian dari satu tanda saja; gabungkan beberapa tanda dan kondisi lingkungan.', 12.5, 700, '#991b1b')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
