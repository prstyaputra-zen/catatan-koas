"""Parkinson: sirkuit ganglia basalis (jalur langsung dan tidak langsung) normal vs kehilangan dopamin, dan perjalanan gejala (ilustrasi skematik)."""
import sys
W, H = 920, 900
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs>'
     '<marker id="ag" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#15803d"/></marker>'
     '<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#b91c1c"/></marker>'
     '<marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker>'
     '</defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Penyakit Parkinson: mengapa gerakan menjadi lambat</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik sederhana, tidak sesuai skala anatomi</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def box(x, y, w, h, lines, fill, stroke, bold0=True, size=13):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    n = len(lines); y0 = y + h / 2 - (n - 1) * 8 + 5
    for i, s in enumerate(lines):
        t(x + w / 2, y0 + i * 16, s, size, 700 if (i == 0 and bold0) else 400, '#111827', 'middle')
def line(x1, y1, x2, y2, kind, width=2.5, dash=False):
    col = {'g': '#15803d', 'r': '#b91c1c', 'k': '#374151'}[kind]
    d = ' stroke-dasharray="5 4"' if dash else ''
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{width}"{d} marker-end="url(#a{kind})"/>')

t(20, 88, 'A. Sirkuit ganglia basalis', 15, 700, '#111827')
t(20, 108, 'Hijau = merangsang, merah = menghambat. Garis tebal = sinyal kuat, garis putus = sinyal lemah.', 12.5, 400, '#4b5563')

def panel(ox, title, pd):
    t(ox + 205, 136, title, 14.5, 700, '#b91c1c' if pd else '#15803d', 'middle')
    o.append(f'<rect x="{ox}" y="146" width="410" height="420" rx="12" fill="{"#fff7f7" if pd else "#f7fdf9"}" stroke="#d1d5db" stroke-width="1.5"/>')
    box(ox + 120, 160, 170, 44, ['Korteks motorik', 'merencanakan gerak'], '#e0e7ff', '#4f46e5')
    box(ox + 120, 250, 170, 44, ['Striatum', '(putamen)'], '#fef3c7', '#d97706')
    box(ox + 12, 236, 92, 72, ['SNpc', 'penghasil', 'dopamin'], '#fde2e2' if pd else '#dcfce7', '#b91c1c' if pd else '#15803d', size=12)
    # dopamin ke striatum
    line(ox + 104, 272, ox + 118, 272, 'k', 4 if not pd else 1.5, pd)
    t(ox + 58, 326, 'neuron hilang' if pd else 'dopamin normal', 12, 700, '#b91c1c' if pd else '#15803d', 'middle')
    # korteks -> striatum
    line(ox + 205, 204, ox + 205, 248, 'g')
    # jalur langsung (kanan) dan tidak langsung (kiri)
    box(ox + 30, 350, 120, 44, ['GPe'], '#f3f4f6', '#6b7280')
    box(ox + 30, 425, 120, 44, ['STN'], '#f3f4f6', '#6b7280')
    box(ox + 220, 425, 170, 44, ['GPi / SNr', 'pintu rem gerak'], '#fee2e2', '#b91c1c')
    box(ox + 220, 505, 170, 44, ['Talamus', 'kembali ke korteks'], '#e0f2fe', '#0284c7')
    # striatum -> GPi (langsung)
    line(ox + 270, 294, ox + 300, 423, 'r', 1.5 if pd else 3.5, pd)
    t(ox + 304, 345, 'langsung (D1)', 12, 700, '#374151', 'start')
    t(ox + 304, 361, 'lemah' if pd else 'aktif', 12, 700, '#b91c1c' if pd else '#15803d', 'start')
    # striatum -> GPe (tidak langsung)
    line(ox + 140, 294, ox + 100, 348, 'r', 4 if pd else 2)
    t(ox + 170, 330, 'tidak langsung', 12, 700, '#374151', 'start')
    t(ox + 170, 346, '(D2): ' + ('berlebih' if pd else 'seimbang'), 12, 700, '#b91c1c' if pd else '#15803d', 'start')
    # GPe -| STN
    line(ox + 90, 394, ox + 90, 423, 'r', 1.5 if pd else 2.5, pd)
    # STN -> GPi
    line(ox + 150, 447, ox + 218, 447, 'g', 4 if pd else 2)
    # GPi -| talamus
    line(ox + 305, 469, ox + 305, 503, 'r', 5 if pd else 2)
    # talamus -> korteks
    dash = ' stroke-dasharray="5 4"' if pd else ''
    o.append(f'<path d="M{ox+390},{527} C{ox+405},{527} {ox+405},{182} {ox+292},{182}" fill="none" stroke="#15803d" stroke-width="{1.5 if pd else 3.5}"{dash} marker-end="url(#ag)"/>')
    t(ox + 205, 585, ('Rem gerak terlalu kuat: talamus tertekan,' if pd else 'Rem gerak seimbang: talamus bebas'), 13, 700, '#b91c1c' if pd else '#15803d', 'middle')
    t(ox + 205, 603, ('gerakan lambat, kecil, sulit dimulai' if pd else 'mengaktifkan korteks, gerakan lancar'), 13, 400, '#374151', 'middle')

panel(25, 'Normal', False)
panel(485, 'Parkinson (dopamin turun)', True)

# B. Perjalanan gejala
y0 = 650
t(20, y0, 'B. Perjalanan penyakit', 15, 700, '#111827')
o.append(f'<line x1="40" y1="{y0+60}" x2="880" y2="{y0+60}" stroke="#374151" stroke-width="3" marker-end="url(#ak)"/>')
stages = [(40, 300, '#ede9fe', '#7c3aed', 'Prodromal (hingga 10-15 tahun)', ['Hiposmia/anosmia, konstipasi,', 'gangguan perilaku tidur REM,', 'depresi']),
          (350, 250, '#fef3c7', '#d97706', 'Diagnosis motorik', ['Bradikinesia + tremor istirahat', 'dan/atau rigiditas; awalnya', 'satu sisi (asimetris)']),
          (610, 270, '#fee2e2', '#b91c1c', 'Lanjut', ['Fluktuasi motorik, diskinesia,', 'instabilitas postural, jatuh,', 'demensia, psikosis'])]
for x, w, fill, stroke, title, lines in stages:
    o.append(f'<rect x="{x}" y="{y0+22}" width="{w-10}" height="76" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
    t(x + (w - 10) / 2, y0 + 48, title, 13.5, 700, '#111827', 'middle')
    o.append(f'<rect x="{x}" y="{y0+106}" width="{w-10}" height="66" rx="8" fill="#ffffff" stroke="{stroke}" stroke-width="1.2"/>')
    for i, s in enumerate(lines):
        t(x + 10, y0 + 126 + i * 17, s, 12.5)
t(475, y0 + 72, 'saat ini >50-80% neuron', 12, 700, '#b91c1c', 'middle')
t(475, y0 + 88, 'dopamin sudah hilang', 12, 700, '#b91c1c', 'middle')
t(20, H - 22, 'Dasar: StatPearls Parkinson Disease (2025), AFP 2020, kriteria klinis MDS 2015. Model sirkuit dari buku ajar neuroanatomi.', 12, 400, '#4b5563')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(x for x in o if x))
