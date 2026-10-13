"""Jadwal imunisasi program bayi dan baduta (KMK HK.01.07/MENKES/1098/2024)."""
import sys
W, H = 900, 600
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Jadwal imunisasi program bayi dan baduta</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ringkasan skematik KMK HK.01.07/MENKES/1098/2024 · angka dalam kotak = dosis ke-</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
ages = ['0', '1 bln', '2 bln', '3 bln', '4 bln', '9 bln', '10 bln', '12 bln', '18 bln']
rows = [('Hepatitis B (HB0)', '#0891b2', {0: '<24 j'}),
        ('BCG', '#7c3aed', {1: '1'}),
        ('Polio tetes (bOPV)', '#2563eb', {0: '0', 1: '1', 2: '2', 3: '3', 4: '4'}),
        ('DPT-HB-Hib', '#dc2626', {2: '1', 3: '2', 4: '3', 8: '4'}),
        ('PCV (pneumokokus)', '#ea580c', {2: '1', 3: '2', 7: '3'}),
        ('Rotavirus (RV)', '#16a34a', {2: '1', 3: '2', 4: '3'}),
        ('Polio suntik (IPV)', '#1d4ed8', {4: '1', 5: '2'}),
        ('Campak-rubela (MR)', '#db2777', {5: '1', 8: '2'}),
        ('JE (daerah tertentu)', '#6b7280', {6: '1'})]
X0, CW, Y0, RH = 210, 74, 86, 44
for j, a in enumerate(ages):
    x = X0 + j * CW
    o.append(f'<rect x="{x}" y="{Y0}" width="{CW}" height="32" fill="{"#f3f4f6" if j < 7 else "#fef3c7"}" stroke="#e5e7eb"/>')
    t(x + CW / 2, Y0 + 21, a, 13, 700, '#111827', 'middle')
t(X0 + 7.5 * CW, Y0 - 6, 'Baduta', 12, 700, '#92400e', 'middle')
t(X0 + 3 * CW, Y0 - 6, 'Bayi', 12, 700, '#374151', 'middle')
for i, (name, col, doses) in enumerate(rows):
    y = Y0 + 32 + i * RH
    o.append(f'<rect x="20" y="{y}" width="{X0 - 20 + 9 * CW}" height="{RH}" fill="{"#ffffff" if i % 2 else "#fafafa"}" stroke="#f3f4f6"/>')
    t(30, y + 27, name, 13.5, 700, '#111827')
    for j, lab in doses.items():
        cx = X0 + j * CW + CW / 2
        o.append(f'<rect x="{cx - 26}" y="{y + 9}" width="52" height="26" rx="13" fill="{col}"/>')
        t(cx, y + 27, lab, 13, 700, '#ffffff', 'middle')
yb = Y0 + 32 + len(rows) * RH + 26
t(20, yb, 'Usia sekolah (BIAS): kelas 1 MR (Agustus) dan DT (November) · kelas 2 dan 5 Td (November) · kelas 5 dan 6 HPV untuk anak perempuan (Agustus).', 12.5, 400, '#1f2937')
t(20, yb + 22, 'Belum lengkap? Lakukan imunisasi kejar sesuai interval minimal (mis. BCG paling lambat usia 11 bulan; rotavirus selesai sebelum usia 7 bulan).', 12.5, 400, '#1f2937')
t(20, yb + 48, 'Sumber: Kemenkes RI, KMK No. HK.01.07/MENKES/1098/2024 tentang Jenis dan Jadwal Imunisasi Program.', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
