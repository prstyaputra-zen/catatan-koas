"""Dosis janin rata-rata pemeriksaan radiologi (IAEA RPOP, data Inggris) vs ambang efek (CDC 2025; ICRP 84 via IAEA). Skala logaritmik."""
import sys, math
W, H = 900, 640
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Dosis janin pemeriksaan radiologi vs ambang efek</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · sumbu mendatar logaritmik (tiap garis = 10 kali lipat) · dosis rata-rata, mGy</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
X0, X1 = 230, 870
lo, hi = -3, 3   # 0,001 - 1000 mGy
def xv(v): return X0 + (math.log10(v) - lo) / (hi - lo) * (X1 - X0)
Y0, Y1 = 80, 400
# zona ambang
o.append(f'<rect x="{xv(100):.0f}" y="{Y0}" width="{xv(500)-xv(100):.0f}" height="{Y1-Y0}" fill="#fef3c7"/>')
o.append(f'<rect x="{xv(500):.0f}" y="{Y0}" width="{X1-xv(500):.0f}" height="{Y1-Y0}" fill="#fee2e2"/>')
for e in range(lo, hi + 1):
    x = xv(10 ** e)
    o.append(f'<line x1="{x:.0f}" y1="{Y0}" x2="{x:.0f}" y2="{Y1}" stroke="#e5e7eb" stroke-width="1"/>')
    lab = {-3: '0,001', -2: '0,01', -1: '0,1', 0: '1', 1: '10', 2: '100', 3: '1.000'}[e]
    t(x, Y1 + 18, lab, 12, 400, '#4b5563', 'middle')
t((X0 + X1) / 2, Y1 + 38, 'Dosis janin (mGy)', 13, 700, '#374151', 'middle')
data = [('Foto toraks', 0.01, '< 0,01', True), ('CT kepala', 0.005, '< 0,005', True), ('CT toraks', 0.06, '0,06', False),
        ('Foto polos abdomen', 1.4, '1,4', False), ('CT abdomen', 8.0, '8', False), ('CT pelvis', 25, '25', False)]
bh, gap = 30, 20
for i, (name, v, lab, less) in enumerate(data):
    y = Y0 + 18 + i * (bh + gap)
    t(X0 - 10, y + 20, name, 13.5, 700, '#111827', 'end')
    col = '#2563eb' if v < 1 else ('#0891b2' if v < 10 else '#7c3aed')
    o.append(f'<rect x="{X0}" y="{y}" width="{xv(v)-X0:.0f}" height="{bh}" rx="4" fill="{col}"/>')
    t(xv(v) + 8, y + 20, lab, 13, 700, '#111827')
x100, x500 = xv(100), xv(500)
o.append(f'<line x1="{x100:.0f}" y1="{Y0}" x2="{x100:.0f}" y2="{Y1}" stroke="#d97706" stroke-width="2.5" stroke-dasharray="6 4"/>')
o.append(f'<line x1="{x500:.0f}" y1="{Y0}" x2="{x500:.0f}" y2="{Y1}" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="6 4"/>')
t(x100 - 4, Y0 + 14, '100 mGy', 12.5, 700, '#92400e', 'end')
t(x500 + 4, Y0 + 14, '500 mGy', 12.5, 700, '#991b1b')
# keterangan
ky = 470
o.append(f'<rect x="20" y="{ky}" width="860" height="132" rx="10" fill="#f9fafb" stroke="#d1d5db"/>')
t(34, ky + 24, 'Arti ambang (CDC 2025; ICRP 84 dikutip IAEA)', 14.5, 700)
t(34, ky + 46, '< 100 mGy (< 0,1 Gy): efek nonkanker tidak terdeteksi; terminasi kehamilan TIDAK dibenarkan atas dasar risiko radiasi.', 13)
t(34, ky + 66, '100-500 mGy: kemungkinan hambatan pertumbuhan pada minggu 3-13 pascakonsepsi; keputusan sesuai kondisi individu.', 13)
t(34, ky + 86, '> 500 mGy: risiko keguguran, malformasi berat, hambatan pertumbuhan meningkat; disabilitas intelektual berat mungkin', 13)
t(34, ky + 104, '(paling rentan minggu 8-15). Dosis radiologi diagnostik tipikal jauh di bawah 100 mGy (CDC).', 13)
t(20, 628, 'Sumber: IAEA, Radiation protection of pregnant women in radiology (data Sharp dkk. 1998); CDC, Radiation and Pregnancy: Information for Clinicians (2025).', 11.5, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
