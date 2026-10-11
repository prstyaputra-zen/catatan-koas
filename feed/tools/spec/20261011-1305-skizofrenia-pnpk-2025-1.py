"""Jadwal pemantauan kesehatan fisik pengguna antipsikotik (PNPK Skizofrenia KMK 970/2025, Tabel 6)."""
import sys
W, H = 900, 600
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Pemantauan fisik pasien yang memakai antipsikotik</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik dari Tabel 6 PNPK Tata Laksana Skizofrenia 2025 · ● = periksa</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
cols = ['Awal', 'Tiap bulan\n(6 bln pertama)', '4 bulan', 'Tiap 3 bulan\n(sesudahnya)', 'Tiap tahun']
x0, cw, lw = 20, 134, 190
y0, rh = 78, 52
o.append(f'<rect x="{x0}" y="{y0}" width="{lw + cw * 5}" height="54" fill="#0f766e" rx="8"/>')
t(x0 + 12, y0 + 33, 'Pemeriksaan', 14, 700, '#ffffff')
for i, c in enumerate(cols):
    cx = x0 + lw + cw * i + cw / 2
    parts = c.split('\n')
    if len(parts) == 1:
        t(cx, y0 + 33, parts[0], 14, 700, '#ffffff', 'middle')
    else:
        t(cx, y0 + 25, parts[0], 14, 700, '#ffffff', 'middle'); t(cx, y0 + 43, parts[1], 11.5, 400, '#ccfbf1', 'middle')
rows = [
  ('BB, TB, IMT', ['●', '● IMT', '', '● IMT', ''], ''),
  ('GDP atau HbA1c', ['●', '', '● *', '', ''], ''),
  ('Profil lipid', ['●', '', '● *', '', ''], ''),
  ('Sindrom metabolik', ['●', '', '● *', '', ''], ''),
  ('Gejala prolaktin tinggi', ['●', 'tiap kunjungan s.d. stabil', '', '', '●'], ''),
  ('Gangguan gerak (klinis)', ['●', 'tiap kunjungan', '', '', ''], ''),
]
y = y0 + 54
for k, (name, cells, _) in enumerate(rows):
    fill = '#f0fdfa' if k % 2 == 0 else '#ffffff'
    o.append(f'<rect x="{x0}" y="{y}" width="{lw + cw * 5}" height="{rh}" fill="{fill}"/>')
    t(x0 + 12, y + 31, name, 14, 700)
    span = None
    for i, c in enumerate(cells):
        cx = x0 + lw + cw * i + cw / 2
        if c.startswith('tiap kunjungan'):
            # rentang lintas kolom
            o.append(f'<rect x="{x0 + lw + cw * i + 8}" y="{y + 14}" width="{cw * 3 - 16}" height="24" rx="12" fill="#ccfbf1" stroke="#0f766e"/>')
            t(x0 + lw + cw * i + cw * 1.5, y + 31, c, 12.5, 700, '#115e59', 'middle')
        elif c:
            col = '#0f766e'
            t(cx, y + 31, c, 15 if c == '●' else 12.5, 700, col, 'middle')
    y += rh
o.append(f'<rect x="{x0}" y="{y0}" width="{lw + cw * 5}" height="{y - y0}" fill="none" stroke="#99f6e4" stroke-width="1.5" rx="8"/>')
y += 30
t(20, y, '* Pemeriksaan ulang glukosa, lipid, dan sindrom metabolik: 4 bulan setelah mulai antipsikotik, paling lambat 1 tahun.', 13); y += 22
t(20, y, 'Skala gerak terstruktur (ESRS, AIMS, Barnes): minimal tiap 6 bulan bila risiko tinggi, tiap 12 bulan pada lainnya.', 13)
t(20, y + 22, 'EKG sebelum memulai obat pemanjang QT (mis. klorpromazin, ziprasidon, pimozid) atau bila ada faktor risiko jantung.', 13)
t(20, y + 44, 'Kadar prolaktin diperiksa hanya bila ada indikasi klinis.', 13)
t(20, H - 14, 'Sumber: PNPK Tata Laksana Skizofrenia, KMK HK.01.07/MENKES/970/2025 (Tabel 6).', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
