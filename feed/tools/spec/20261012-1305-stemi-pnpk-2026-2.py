"""Alur reperfusi IMA-EST (PNPK Tata Laksana SKA, KMK HK.01.07/MENKES/876/2026)."""
import sys
W, H = 900, 640
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">IMA-EST: memilih strategi reperfusi</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik berdasarkan PNPK Tata Laksana Sindrom Koroner Akut 2026</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, fill, stroke, title, lines):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x + 14, y + 25, title, 15, 700, '#111827')
    for k, ln in enumerate(lines):
        t(x + 14, y + 47 + k * 19, ln, 13)
def arrow(x1, y1, x2, y2, lab=None, lx=0, ly=0):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>')
    if lab: t(lx, ly, lab, 13, 700, '#374151', 'middle')
box(220, 70, 460, 104, '#f3f4f6', '#6b7280', 'Kontak medis pertama (KMP)', ['EKG 12 sandapan dibaca < 10 menit', 'Elevasi ST persisten di 2 sandapan bersebelahan', 'atau LBBB baru, dengan gejala ≤ 12 jam → reperfusi'])
arrow(330, 176, 200, 226, 'KMP→IKP < 120 menit', 150, 214)
arrow(570, 176, 700, 226, 'IKP < 120 menit tidak mungkin', 760, 214)
box(20, 230, 380, 120, '#ecfdf5', '#059669', 'IKP primer', ['Antiplatelet ganda: aspirin + ticagrelor', 'atau prasugrel (klopidogrel bila tidak ada)', 'Antikoagulan selama prosedur', '(enoksaparin lebih dipilih daripada UFH)'])
box(480, 230, 400, 120, '#eff6ff', '#2563eb', 'Fibrinolitik dalam 30 menit dari KMP', ['Utamakan agen spesifik fibrin', '(tenekteplase, alteplase) > streptokinase', 'Tenekteplase: ½ dosis bila usia ≥ 75 tahun', 'Tambah aspirin + klopidogrel + antikoagulan'])
arrow(680, 352, 680, 400)
box(480, 402, 400, 74, '#fff7ed', '#ea580c', 'Nilai 60-90 menit setelah fibrinolitik', ['Resolusi ST ≥ 50% dan klinis stabil?'])
arrow(560, 478, 470, 520, 'Tidak', 500, 506)
arrow(800, 478, 800, 520, 'Ya', 818, 504)
box(220, 524, 360, 86, '#fee2e2', '#dc2626', 'IKP penyelamatan (rescue) segera', ['Juga bila hemodinamik/listrik tidak stabil,', 'iskemia memburuk, atau nyeri menetap'])
box(600, 524, 280, 86, '#f5f3ff', '#7c3aed', 'Angiografi ± IKP', ['dalam 2-24 jam setelah', 'fibrinolisis berhasil'])
t(20, 632, 'Sumber: Kemenkes RI, PNPK Tata Laksana Sindrom Koroner Akut (KMK HK.01.07/MENKES/876/2026).', 12, 400, '#6b7280')
o.append('</svg>')
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(o) + '\n')
