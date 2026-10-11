"""Lokasi predileksi skabies dan langkah terapi (CDC 2024, WHO 2023)."""
import sys
W, H = 900, 650
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Skabies: lokasi khas dan langkah terapi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · titik merah = lokasi predileksi pada dewasa</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
SK = 'fill="#f5e1d3" stroke="#6b4f3a" stroke-width="1.6"'
def body(cx, top, label):
    t(cx, top - 8, label, 14, 700, '#374151', 'middle')
    o.append(f'<circle cx="{cx}" cy="{top + 26}" r="24" {SK}/>')
    o.append(f'<rect x="{cx - 14}" y="{top + 48}" width="28" height="14" {SK}/>')
    o.append(f'<path d="M{cx - 48},{top + 62} L{cx + 48},{top + 62} L{cx + 40},{top + 200} L{cx - 40},{top + 200} Z" {SK}/>')
    # lengan
    o.append(f'<path d="M{cx - 48},{top + 64} L{cx - 74},{top + 160} L{cx - 82},{top + 236} L{cx - 66},{top + 238} L{cx - 56},{top + 164} L{cx - 40},{top + 100} Z" {SK}/>')
    o.append(f'<path d="M{cx + 48},{top + 64} L{cx + 74},{top + 160} L{cx + 82},{top + 236} L{cx + 66},{top + 238} L{cx + 56},{top + 164} L{cx + 40},{top + 100} Z" {SK}/>')
    # tungkai
    o.append(f'<path d="M{cx - 40},{top + 200} L{cx - 4},{top + 200} L{cx - 8},{top + 400} L{cx - 34},{top + 400} Z" {SK}/>')
    o.append(f'<path d="M{cx + 4},{top + 200} L{cx + 40},{top + 200} L{cx + 34},{top + 400} L{cx + 8},{top + 400} Z" {SK}/>')
def dot(x, y): o.append(f'<circle cx="{x}" cy="{y}" r="6.5" fill="#dc2626" stroke="#ffffff" stroke-width="1.5"/>')
def lab(x, y, tx, ty, s, a='start'):
    o.append(f'<line x1="{x}" y1="{y}" x2="{tx}" y2="{ty - 4}" stroke="#9ca3af" stroke-width="1.2"/>')
    t(tx, ty, s, 12.5, 700, '#991b1b', a)
top = 96
cxF, cxB = 170, 430
body(cxF, top, 'Depan'); body(cxB, top, 'Belakang')
# depan
for (x, y, tx, ty, s, a) in [
    (cxF - 74, top + 236, 30, top + 272, 'sela jari', 'start'),
    (cxF - 75, top + 216, 30, top + 232, 'pergelangan', 'start'),
    (cxF - 62, top + 140, 30, top + 140, 'siku', 'start'),
    (cxF - 40, top + 80, 30, top + 92, 'ketiak', 'start'),
    (cxF + 20, top + 104, 262, top + 108, 'puting', 'start'),
    (cxF, top + 186, 262, top + 186, 'pinggang', 'start'),
    (cxF, top + 214, 262, top + 236, 'genitalia', 'start')]:
    dot(x, y); lab(x, y, tx, ty, s, a)
for (x, y, tx, ty, s, a) in [
    (cxB - 24, top + 92, 530, top + 86, 'tulang belikat', 'start'),
    (cxB + 22, top + 92, 530, top + 86, '', 'start'),
    (cxB, top + 214, 530, top + 214, 'bokong', 'start'),
    (cxB - 20, top + 300, 530, top + 300, 'lipatan lutut', 'start')]:
    dot(x, y)
    if s: lab(x, y, tx, ty, s, a)
# panel kanan
def panel(x, y, w, h, fill, stroke, title, lines, tc):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x + 14, y + 26, title, 15, 700, tc)
    for i, ln in enumerate(lines):
        b = ln.startswith('*'); t(x + 14, y + 50 + i * 20, ln.lstrip('*'), 13, 700 if b else 400)
panel(645, 80, 240, 120, '#fef3c7', '#d97706', 'Bayi & anak kecil', ['Ruam juga di kepala, wajah,', 'leher, telapak tangan, dan', 'telapak kaki.', '*Gatal hebat, memberat malam'], '#92400e')
panel(645, 214, 240, 186, '#eff6ff', '#1d4ed8', 'Terapi', ['*Permetrin 5% krim:', 'seluruh tubuh dari leher ke', 'bawah, bilas 8-14 jam; ulang', '±1 minggu bila perlu', '*Ivermectin oral 200 µg/kg:', '2 dosis, jarak 7-14 hari', '(tidak untuk hamil / < 15 kg)'], '#1e3a8a')
panel(645, 414, 240, 170, '#ecfdf5', '#059669', 'Kontak & lingkungan', ['*Obati semua kontak serumah', 'bersamaan, walau tanpa gejala', 'Cuci sprei/baju/handuk', '> 50 °C 10 menit, keringkan', 'panas, atau simpan dalam', 'plastik tertutup ≥ 72 jam'], '#065f46')
t(20, 576, 'Inkubasi infestasi pertama 4-8 minggu (CDC); penderita sudah bisa menularkan sebelum gejala muncul.', 13)
t(20, 598, 'Gatal dapat memberat 1-2 minggu setelah terapi dimulai (WHO).', 13)
t(20, 632, 'Sumber: CDC Scabies (2024): About Scabies & Clinical Care; WHO Fact sheet Scabies (31 Mei 2023).', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
