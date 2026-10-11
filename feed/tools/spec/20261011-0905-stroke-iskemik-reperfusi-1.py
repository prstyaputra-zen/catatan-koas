"""Alur waktu reperfusi stroke iskemik akut (PNPK Stroke KMK HK.01.07/MENKES/304/2026)."""
import sys
W, H = 900, 590
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Stroke iskemik akut: jendela waktu reperfusi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · dihitung dari onset / terakhir terlihat normal · sumbu waktu tidak proporsional</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def rect(x, y, w, h, fill, stroke, rx=10):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
# skala: 0 j -> 170, 4,5 j -> 430, 6 j -> 500, 9 j -> 600, 24 j -> 860
X = {0: 170, 4.5: 430, 6: 500, 9: 600, 24: 860}
ya = 330
o.append(f'<line x1="{X[0]}" y1="{ya}" x2="{X[24] + 10}" y2="{ya}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')
for h, x in X.items():
    o.append(f'<line x1="{x}" y1="{ya - 6}" x2="{x}" y2="{ya + 6}" stroke="#374151" stroke-width="2"/>')
    t(x, ya + 24, f'{str(h).replace(".", ",")} jam', 13, 700, '#374151', 'middle')
    o.append(f'<line x1="{x}" y1="86" x2="{x}" y2="{ya}" stroke="#d1d5db" stroke-width="1.2" stroke-dasharray="4 4"/>')
t(X[0], ya + 42, 'onset', 12, 400, '#6b7280', 'middle')
# Trombolisis IV
t(20, 118, 'Trombolisis IV', 15, 700, '#1d4ed8')
rect(X[0], 96, X[4.5] - X[0], 40, '#dbeafe', '#1d4ed8'); t((X[0] + X[4.5]) / 2, 121, 'Direkomendasikan (Kelas I)', 13.5, 700, '#1e3a8a', 'middle')
rect(X[4.5] + 4, 96, X[9] - X[4.5] - 4, 40, '#eff6ff', '#93c5fd'); t((X[4.5] + X[9]) / 2, 114, 'Pertimbangkan bila', 12, 400, '#1e3a8a', 'middle'); t((X[4.5] + X[9]) / 2, 129, 'perfusi: ada penumbra (IIa)', 12, 400, '#1e3a8a', 'middle')
# Trombektomi
t(20, 186, 'Trombektomi', 15, 700, '#7c3aed'); t(20, 204, '(oklusi pembuluh besar)', 12, 400, '#6b7280')
rect(X[0], 164, X[6] - X[0], 40, '#ede9fe', '#7c3aed'); t((X[0] + X[6]) / 2, 189, '0-6 jam (Kelas I)', 13.5, 700, '#4c1d95', 'middle')
rect(X[6] + 4, 164, X[24] - X[6] - 4, 40, '#f5f3ff', '#7c3aed'); t((X[6] + X[24]) / 2, 189, '6-24 jam pada pasien terpilih (Kelas I)', 13.5, 700, '#4c1d95', 'middle')
# Tiba di RS
t(20, 254, 'Saat tiba di IGD', 15, 700, '#b45309')
rect(X[0], 232, 330, 52, '#fffbeb', '#d97706')
t(X[0] + 12, 254, 'CT nonkontras / MRI-DWI ≤ 20 menit', 13.5, 700, '#92400e'); t(X[0] + 12, 274, 'GDS wajib sebelum trombolisis · IGD < 1 jam', 13, 400, '#92400e')
# Kotak obat
rect(20, 384, 420, 150, '#eff6ff', '#1d4ed8')
t(36, 410, 'Dosis trombolitik', 15, 700, '#1e3a8a')
t(36, 438, 'Alteplase 0,9 mg/kgBB (maks. 90 mg):', 14, 700)
t(36, 458, '10% bolus 1 menit, sisanya infus 60 menit', 14)
t(36, 488, 'Tenecteplase 0,25 mg/kgBB (maks. 25 mg):', 14, 700)
t(36, 508, 'bolus IV tunggal', 14)
rect(460, 384, 420, 150, '#fef2f2', '#dc2626')
t(476, 410, 'Tekanan darah & antiplatelet', 15, 700, '#991b1b')
t(476, 438, 'Sebelum rtPA < 185/110; 24 jam sesudah < 180/105', 13.5)
t(476, 458, '(PNPK 2019)', 12, 400, '#6b7280')
t(476, 484, 'Trombektomi: ≤ 180/105 hingga 24 jam', 13.5)
t(476, 510, 'Aspirin 160-325 mg dalam 24-48 jam;', 13.5)
t(476, 528, 'tunda 24 jam bila mendapat trombolisis', 13.5)
t(20, 570, 'Sumber: PNPK Tata Laksana Stroke, KMK HK.01.07/MENKES/304/2026 (menggantikan KMK 394/2019); PNPK Stroke 2019.', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
