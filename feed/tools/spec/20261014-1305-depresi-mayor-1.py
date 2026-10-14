"""Gangguan depresi mayor: sinaps serotonin dan cara kerja SSRI, serta 9 gejala kriteria DSM-5 (ilustrasi skematik)."""
import sys
W, H = 920, 720
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Gangguan depresi mayor: sinaps, cara kerja SSRI, dan 9 gejala</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik; hipotesis monoamin hanyalah salah satu bagian dari penyebab yang multifaktorial</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, c='#374151'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2" marker-end="url(#ah)"/>')

def synapse(ox, oy, title, ssri):
    o.append(f'<rect x="{ox}" y="{oy}" width="210" height="330" rx="12" fill="#f9fafb" stroke="#d1d5db"/>')
    t(ox + 105, oy + 24, title, 14, 700, '#111827', 'middle')
    # neuron prasinaps
    o.append(f'<path d="M{ox+60},{oy+40} L{ox+150},{oy+40} L{ox+150},{oy+120} Q{ox+105},{oy+160} {ox+60},{oy+120} Z" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>')
    t(ox + 105, oy + 70, 'Prasinaps', 12, 700, '#1d4ed8', 'middle')
    # vesikel
    for (dx, dy) in [(80, 95), (105, 105), (130, 95)]:
        o.append(f'<circle cx="{ox+dx}" cy="{oy+dy}" r="8" fill="#fef3c7" stroke="#d97706"/>')
    # transporter (SERT)
    o.append(f'<rect x="{ox+138}" y="{oy+118}" width="22" height="14" rx="3" fill="#a78bfa" stroke="#6d28d9"/>')
    t(ox + 168, oy + 130, 'SERT', 11, 700, '#6d28d9')
    if ssri:
        o.append(f'<line x1="{ox+134}" y1="{oy+114}" x2="{ox+164}" y2="{oy+136}" stroke="#dc2626" stroke-width="3"/>')
        o.append(f'<line x1="{ox+164}" y1="{oy+114}" x2="{ox+134}" y2="{oy+136}" stroke="#dc2626" stroke-width="3"/>')
        t(ox + 150, oy + 152, 'SSRI', 11.5, 700, '#dc2626', 'middle')
    # celah sinaps serotonin
    n = 11 if ssri else 4
    import random
    random.seed(3 if ssri else 5)
    for k in range(n):
        x = ox + 70 + random.random() * 70
        y = oy + 168 + random.random() * 40
        o.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="4" fill="#f59e0b"/>')
    if not ssri:
        arrow(ox + 128, oy + 180, ox + 146, oy + 138, '#6d28d9')
    # pascasinaps
    o.append(f'<path d="M{ox+50},{oy+225} Q{ox+105},{oy+215} {ox+160},{oy+225} L{ox+160},{oy+290} L{ox+50},{oy+290} Z" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>')
    for dx in (70, 95, 120, 145):
        o.append(f'<rect x="{ox+dx-6}" y="{oy+216}" width="12" height="10" rx="2" fill="#16a34a"/>')
    t(ox + 105, oy + 260, 'Pascasinaps', 12, 700, '#15803d', 'middle')
    t(ox + 105, oy + 314, ('serotonin di celah lebih lama' if ssri else 'serotonin cepat diambil kembali'), 11.5, 400, '#374151', 'middle')

t(20, 90, 'A. Hipotesis monoamin dan SSRI', 15, 700, '#111827')
synapse(20, 100, 'Tanpa obat', False)
synapse(250, 100, 'Dengan SSRI', True)
t(20, 462, 'SSRI menghambat SERT (pompa pengambilan kembali serotonin),', 12.5, 400, '#374151')
t(20, 480, 'sehingga serotonin bertahan lebih lama di celah sinaps.', 12.5, 400, '#374151')
t(20, 504, 'Efek kimia terjadi cepat, tetapi perbaikan mood butuh waktu:', 12.5, 700, '#b45309')
t(20, 522, 'NICE: manfaat diharapkan terasa dalam 4 minggu.', 12.5, 700, '#b45309')
t(20, 552, 'Faktor lain (StatPearls): genetik (konkordansi kembar', 12.5, 400, '#374151')
t(20, 570, 'monozigot tinggi), trauma masa kecil, peristiwa hidup,', 12.5, 400, '#374151')
t(20, 588, 'GABA dan glutamat, kelainan tiroid, perubahan sirkuit otak.', 12.5, 400, '#374151')

# panel kanan: 9 gejala
x0 = 486
t(x0, 90, 'B. Kriteria DSM-5: ≥ 5 dari 9 gejala', 15, 700, '#111827')
t(x0, 110, 'hampir setiap hari, ≥ 2 minggu, mengganggu fungsi', 12.5, 400, '#374151')
core = [('Mood depresi', 'sedih, kosong, putus asa'), ('Anhedonia', 'hilang minat atau rasa senang')]
for i, (a, b) in enumerate(core):
    y = 124 + i * 62
    o.append(f'<rect x="{x0}" y="{y}" width="418" height="54" rx="9" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>')
    t(x0 + 12, y + 22, a, 14, 700, '#111827')
    t(x0 + 12, y + 42, b, 12, 400, '#374151')
t(x0 + 406, 154, 'wajib salah satu', 11.5, 700, '#b91c1c', 'end')
others = [('S', 'Sleep', 'tidur terganggu (insomnia/hipersomnia)'), ('G', 'Guilt', 'rasa bersalah, tidak berharga'),
          ('E', 'Energy', 'lelah, energi turun'), ('C', 'Concentration', 'sulit konsentrasi/memutuskan'),
          ('A', 'Appetite', 'nafsu makan/berat badan berubah'), ('P', 'Psychomotor', 'agitasi atau retardasi'),
          ('S', 'Suicide', 'pikiran tentang kematian/bunuh diri')]
for i, (k, en, d) in enumerate(others):
    y = 258 + i * 50
    o.append(f'<rect x="{x0}" y="{y}" width="418" height="42" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>')
    o.append(f'<circle cx="{x0 + 22}" cy="{y + 21}" r="13" fill="#2563eb"/>')
    t(x0 + 22, y + 26, k, 13, 700, '#ffffff', 'middle')
    t(x0 + 44, y + 26, en, 13, 700, '#1e3a8a')
    t(x0 + 160, y + 26, d, 12, 400, '#374151')
t(x0, 620, 'Mnemonik lazim SIG E CAPS: S-I(nterest)-G-E-C-A-P-S,', 12.5, 700, '#1e3a8a')
t(x0, 638, 'ditambah mood depresi.', 12.5, 700, '#1e3a8a')
t(20, 680, 'Selalu tanyakan pikiran bunuh diri pada setiap kunjungan.', 13.5, 700, '#b91c1c')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
