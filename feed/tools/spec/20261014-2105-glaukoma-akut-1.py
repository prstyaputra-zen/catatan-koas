"""Glaukoma akut sudut tertutup: aliran humor akuos normal vs blok pupil (iris bombe), serta target obat (ilustrasi skematik)."""
import sys
W, H = 920, 770
o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2563eb"/></marker>',
     '<marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Glaukoma akut sudut tertutup: blok pupil menutup jalan keluar akuos</text>',
     '<text x="20" y="54" font-size="13" fill="#4b5563">Potongan segmen anterior, ilustrasi skematik, tidak sesuai skala</text>']
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def t(x, y, s, size=13.5, w=400, c='#1f2937', a='start'):
    o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{c}" text-anchor="{a}">{esc(s)}</text>')
def flow(d):
    o.append(f'<path d="{d}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#ah)"/>')

def eye(ox, oy, blocked, title):
    o.append(f'<rect x="{ox}" y="{oy}" width="430" height="408" rx="12" fill="#f9fafb" stroke="#d1d5db"/>')
    t(ox + 215, oy + 26, title, 15, 700, '#111827', 'middle')
    cx, cy = ox + 330, oy + 196  # pusat sumbu (kornea di kiri)
    # kornea
    o.append(f'<path d="M{cx},{cy-150} Q{ox+40},{cy} {cx},{cy+150}" fill="none" stroke="#0ea5e9" stroke-width="5"/>')
    t(ox + 60, cy - 110, 'Kornea', 12.5, 700, '#0369a1')
    # sklera/badan siliar atas & bawah
    for s in (-1, 1):
        o.append(f'<path d="M{cx},{cy + s*150} L{cx+80},{cy + s*150} L{cx+80},{cy + s*95} L{cx+10},{cy + s*100} Z" fill="#fecaca" stroke="#dc2626" stroke-width="1.5"/>')
        # trabekular di sudut
        o.append(f'<rect x="{cx-14}" y="{cy + s*150 - (8 if s > 0 else 0)}" width="14" height="8" fill="#a16207"/>')
    t(cx + 40, cy - 120, 'Badan', 11.5, 700, '#b91c1c', 'middle')
    t(cx + 40, cy - 106, 'siliar', 11.5, 700, '#b91c1c', 'middle')
    # lensa
    o.append(f'<ellipse cx="{cx+40}" cy="{cy}" rx="38" ry="78" fill="#fef9c3" stroke="#ca8a04" stroke-width="2"/>')
    t(cx + 40, cy + 5, 'Lensa', 12, 700, '#854d0e', 'middle')
    # iris
    for s in (-1, 1):
        if blocked:
            d = f'M{cx},{cy + s*140} Q{cx-60},{cy + s*90} {cx+2},{cy + s*28}'
        else:
            d = f'M{cx},{cy + s*140} Q{cx-20},{cy + s*90} {cx-4},{cy + s*28}'
        o.append(f'<path d="{d}" fill="none" stroke="#7c2d12" stroke-width="9" stroke-linecap="round"/>')
    t(cx - 70 if blocked else cx - 40, cy - 72, 'Iris', 12.5, 700, '#7c2d12', 'end')
    if not blocked:
        flow(f'M{cx+28},{cy-96} Q{cx+12},{cy-40} {cx+4},{cy-10}')
        flow(f'M{cx-8},{cy-4} Q{cx-80},{cy-40} {cx-14},{cy-138}')
        t(ox + 20, oy + 378, 'Akuos dibuat badan siliar, melewati pupil, keluar lewat', 12, 400, '#1e3a8a')
        t(ox + 20, oy + 396, 'jaringan trabekular dan kanal Schlemm (cokelat).', 12, 400, '#1e3a8a')
    else:
        flow(f'M{cx+28},{cy-96} Q{cx+18},{cy-70} {cx+10},{cy-56}')
        o.append(f'<circle cx="{cx+6}" cy="{cy-34}" r="12" fill="none" stroke="#dc2626" stroke-width="3"/>')
        o.append(f'<line x1="{cx-3}" y1="{cy-43}" x2="{cx+15}" y2="{cy-25}" stroke="#dc2626" stroke-width="3"/>')
        t(cx - 22, cy - 6, 'blok pupil', 12, 700, '#dc2626', 'end')
        for s in (-1, 1):
            o.append(f'<circle cx="{cx-8}" cy="{cy + s*142}" r="9" fill="none" stroke="#dc2626" stroke-width="2.5"/>')
        t(cx - 22, cy - 150, 'sudut tertutup', 12, 700, '#dc2626', 'end')
        t(ox + 20, oy + 378, 'Akuos terperangkap di belakang iris, iris terdorong ke depan', 12, 400, '#7f1d1d')
        t(ox + 20, oy + 396, '(iris bombe) dan menutup sudut: TIO melonjak.', 12, 400, '#7f1d1d')

eye(20, 70, False, 'Normal')
eye(470, 70, True, 'Serangan akut')

# target obat
y0 = 508
t(20, y0, 'Kerja obat pada serangan (StatPearls 2026; RVEEH 2022)', 15, 700, '#111827')
rows = [('#dbeafe', '#2563eb', 'Kurangi produksi akuos', 'asetazolamid 500 mg PO/IV, timolol 0,5%, apraklonidin 1%'),
        ('#ede9fe', '#7c3aed', 'Tarik cairan dari mata', 'manitol IV 1–2 g/kg (bila asetazolamid IV gagal)'),
        ('#dcfce7', '#16a34a', 'Buka sudut', 'pilokarpin 1–2% setelah TIO < 40 mmHg'),
        ('#fef3c7', '#d97706', 'Atasi radang', 'steroid topikal'),
        ('#fee2e2', '#dc2626', 'Terapi definitif', 'iridotomi perifer laser (LPI), juga mata sebelahnya')]
for i, (f, s, a, b) in enumerate(rows):
    y = y0 + 14 + i * 46
    o.append(f'<rect x="20" y="{y}" width="880" height="38" rx="8" fill="{f}" stroke="{s}" stroke-width="1.5"/>')
    t(34, y + 25, a, 13.5, 700, '#111827')
    t(280, y + 25, b, 13, 400, '#374151')
o.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(o) + '\n')
