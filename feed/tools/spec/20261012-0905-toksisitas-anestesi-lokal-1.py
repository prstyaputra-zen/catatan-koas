"""Toksisitas sistemik anestesi lokal: tahapan gejala (kualitatif) dan regimen emulsi lipid 20% (Association of Anaesthetists QRH 3-10, 2023)."""
import sys
W, H = 900, 660
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Toksisitas sistemik anestesi lokal (LAST)</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik. Kiri: urutan gejala saat kadar obat naik (kualitatif, tanpa skala). Kanan: regimen lipid.</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')

# tangga gejala
steps = [('#fef9c3', '#ca8a04', 'Awal (SSP)', ['Kepala ringan, baal sekitar mulut,', 'gangguan lihat/dengar']),
         ('#ffedd5', '#ea580c', 'Eksitasi SSP', ['Gelisah, agitasi, kedutan otot,', 'kejang tonik-klonik']),
         ('#fee2e2', '#dc2626', 'Depresi SSP', ['Penurunan kesadaran, koma,', 'henti napas']),
         ('#fce7f3', '#be185d', 'Kardiovaskular', ['Bradikardia, blok konduksi,', 'aritmia ventrikel, asistol'])]
bx, bw, bh = 30, 340, 74
for i, (f, s, title, lines) in enumerate(steps):
    x = bx + i * 18
    y = 300 + 0 - 0 + (3 - i) * 0
    y = 92 + i * 92
    o.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    t(x + 14, y + 24, title, 15, 700, '#111827')
    for k, ln in enumerate(lines):
        t(x + 14, y + 45 + k * 18, ln, 13)
o.append('<line x1="20" y1="96" x2="20" y2="446" stroke="#6b7280" stroke-width="2" marker-end="url(#ah)"/>')
t(14, 470, 'Kadar obat dalam darah naik (makin ke bawah makin berat)', 12.5, 700, '#4b5563')
t(30, 498, 'Gejala bisa muncul beberapa saat setelah injeksi.', 13)
t(30, 518, 'Henti jantung karena bupivakain lebih sulit diresusitasi.', 13)
o.append('<rect x="20" y="540" width="400" height="86" rx="10" fill="#f3f4f6" stroke="#9ca3af"/>')
t(32, 562, 'Dosis maksimal (dewasa 70 kg, infiltrasi/blok):', 13.5, 700)
t(32, 584, 'Lidokain 300 mg · lidokain + epinefrin 500 mg', 13)
t(32, 604, 'Bupivakain 225 mg (Update in Anaesthesia)', 13)

# algoritma kanan
x0 = 450
def box(y, h, fill, stroke, title, lines):
    o.append(f'<rect x="{x0}" y="{y}" width="430" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x0 + 14, y + 24, title, 15, 700, '#111827')
    for k, ln in enumerate(lines):
        t(x0 + 14, y + 46 + k * 19, ln, 13)
box(78, 106, '#f3f4f6', '#6b7280', '1. Hentikan dan amankan', ['Stop injeksi (ingat pompa infus) · panggil bantuan', 'O₂ 100%, ventilasi adekuat, hindari hiperkarbia', 'Pastikan akses IV · siapkan troli henti jantung'])
arrow(x0 + 215, 186, x0 + 215, 204)
box(206, 126, '#ecfeff', '#0891b2', '2. Emulsi lipid 20% (bukan propofol)', ['Bolus 1,5 mL/kgBB IV dalam 2-3 menit', 'Lalu infus 15 mL/kgBB/jam', 'Menit 5 dan 10: ulang bolus bila sirkulasi', 'belum pulih; infus boleh digandakan 30 mL/kgBB/jam'])
arrow(x0 + 215, 334, x0 + 215, 352)
box(354, 66, '#fff7ed', '#ea580c', 'Batas', ['Maks. kumulatif 12 mL/kgBB (70 kg: 840 mL)'])
arrow(x0 + 215, 422, x0 + 215, 440)
box(442, 106, '#fee2e2', '#dc2626', '3. Henti jantung: RJP terus', ['Epinefrin dosis kecil ≤ 1 µg/kgBB (bukan 1 mg)', 'Hindari vasopresin', 'Pemulihan bisa > 1 jam'])
box(560, 66, '#f5f3ff', '#7c3aed', 'Kejang', ['Benzodiazepin dosis kecil bertahap (pilihan utama)'])
t(20, 650, 'Sumber: Association of Anaesthetists QRH 3-10 Local anaesthetic toxicity v2 (2023); Rajan N, Update in Anaesthesia.', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
