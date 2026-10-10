#!/usr/bin/env python3
"""Membuat ilustrasi skematik EKG (SVG) untuk feed Auto updates.

Pemakaian:  python3 feed/tools/ekg_svg.py spec.json feed/img/<id>-1.svg

spec.json:
{
  "title": "Judul gambar",
  "note": "Catatan kaki (mis. sumber kriteria)",
  "seconds": 2.4, "hr": 75,
  "strips": [
    {"label": "Normal",
     "waves": {"P": [0.15, 0.10, 0.025], "Q": [-0.1, 0.20, 0.008], "R": [1.1, 0.22, 0.01],
               "S": [-0.25, 0.24, 0.009], "ST": [0, 0.34, 0.06], "T": [0.3, 0.46, 0.045], "U": [0.03, 0.62, 0.03]},
     "notes": [{"text": "Gelombang U kecil", "wave": "U", "beat": 1, "dx": 20, "dy": -40}]}
  ]
}
Setiap gelombang = [amplitudo mV, waktu puncak dari awal siklus (detik), lebar (detik)].
Kertas standar: 25 mm/detik, 10 mm/mV; kotak kecil 1 mm, kotak besar 5 mm.
"""
import json
import math
import sys

PX = 10            # piksel per mm
LEFT = 16
TOP = 56
MV_TOP = 1.5       # batas atas jalur (mV)
MV_BOT = -0.7      # batas bawah jalur (mV)


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def build(spec):
    secs = float(spec.get('seconds', 2.4))
    rr = 60.0 / float(spec.get('hr', 75))
    w_mm = secs * 25
    h_mm = (MV_TOP - MV_BOT) * 10
    sw, sh = w_mm * PX, h_mm * PX
    gap = 46
    strips = spec['strips']
    width = int(LEFT * 2 + sw)
    height = int(TOP + len(strips) * (sh + gap) + 40)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" font-family="Helvetica, Arial, sans-serif">',
           '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1d4ed8"/></marker></defs>',
           f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
           f'<text x="{LEFT}" y="26" font-size="19" font-weight="700" fill="#111827">{esc(spec.get("title", ""))}</text>',
           f'<text x="{LEFT}" y="45" font-size="13" fill="#4b5563">Ilustrasi skematik, bukan rekaman pasien · 25 mm/detik · 10 mm/mV</text>']
    for si, st in enumerate(strips):
        x0 = LEFT
        y0 = TOP + si * (sh + gap) + 22
        out.append(f'<text x="{x0}" y="{y0 - 7}" font-size="15" font-weight="700" fill="#991b1b">{esc(st["label"])}</text>')
        out.append(f'<rect x="{x0}" y="{y0}" width="{sw}" height="{sh}" fill="#fff5f5"/>')
        g = []
        for k in range(int(w_mm) + 1):
            x = x0 + k * PX
            major = k % 5 == 0
            g.append(f'<line x1="{x}" y1="{y0}" x2="{x}" y2="{y0 + sh}" stroke="{"#f2a3a3" if major else "#fbd5d5"}" stroke-width="{1.2 if major else 0.6}"/>')
        for k in range(int(h_mm) + 1):
            y = y0 + k * PX
            major = k % 5 == 0
            g.append(f'<line x1="{x0}" y1="{y}" x2="{x0 + sw}" y2="{y}" stroke="{"#f2a3a3" if major else "#fbd5d5"}" stroke-width="{1.2 if major else 0.6}"/>')
        out.append('<g>' + ''.join(g) + '</g>')
        waves = st['waves']

        def mv(t):
            tc = t % rr
            v = 0.0
            for a, c, s in waves.values():
                for shift in (-rr, 0, rr):
                    v += a * math.exp(-((tc - c - shift) ** 2) / (2 * s * s))
            return v

        def xy(t, v):
            return x0 + t * 25 * PX, y0 + (MV_TOP - v) * 10 * PX

        pts = []
        n = int(secs * 500)
        for i in range(n + 1):
            t = secs * i / n
            x, y = xy(t, mv(t))
            pts.append(f'{x:.1f},{y:.1f}')
        bx, by = xy(0, 0)
        out.append(f'<line x1="{x0}" y1="{by}" x2="{x0 + sw}" y2="{by}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4"/>')
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/>')
        for nt in st.get('notes', []):
            a, c, s = waves[nt['wave']]
            t = nt.get('beat', 1) * rr + c + nt.get('at', 0)
            px, py = xy(t, mv(t))
            tx, ty = px + nt.get('dx', 30), py + nt.get('dy', -40)
            out.append(f'<line x1="{tx}" y1="{ty + (6 if nt.get("dy", -40) < 0 else -14)}" x2="{px}" y2="{py + (-4 if nt.get("dy", -40) < 0 else 4)}" stroke="#1d4ed8" stroke-width="1.6" marker-end="url(#ah)"/>')
            anchor = nt.get('anchor', 'middle')
            out.append(f'<text x="{tx}" y="{ty}" font-size="14" font-weight="700" fill="#1d4ed8" text-anchor="{anchor}" paint-order="stroke" stroke="#ffffff" stroke-width="4">{esc(nt["text"])}</text>')
    if spec.get('note'):
        out.append(f'<text x="{LEFT}" y="{height - 14}" font-size="12" fill="#4b5563">{esc(spec["note"])}</text>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    open(sys.argv[2], 'w', encoding='utf-8').write(build(spec))
    print('OK', sys.argv[2])
