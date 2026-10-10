import sys
W,H=760,700
o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
 f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
 '<text x="20" y="32" font-size="20" font-weight="700" fill="#111827">Rule of nines: perkiraan luas luka bakar (% TBSA)</text>',
 '<text x="20" y="54" font-size="13" fill="#4b5563">Ilustrasi skematik · angka = total depan + belakang tiap bagian</text>']
C={'head':'#fde68a','arm':'#bfdbfe','trunk':'#fecaca','leg':'#bbf7d0','per':'#e9d5ff'}
def lab(x,y,t,s=15,c='#111827',w='700'):
    o.append(f'<text x="{x}" y="{y}" font-size="{s}" font-weight="{w}" fill="{c}" text-anchor="middle">{t}</text>')
def fig(cx,top,title,head,arm,front,back,leg,per,headr,legh):
    lab(cx,top,title,17,'#991b1b')
    y=top+18
    r=headr
    o.append(f'<circle cx="{cx}" cy="{y+r}" r="{r}" fill="{C["head"]}" stroke="#374151" stroke-width="1.5"/>'); lab(cx,y+r+5,head)
    ty=y+2*r+8; tw,th=110,170
    o.append(f'<rect x="{cx-tw/2}" y="{ty}" width="{tw}" height="{th}" rx="14" fill="{C["trunk"]}" stroke="#374151" stroke-width="1.5"/>')
    lab(cx,ty+60,'Depan',13,'#374151','400'); lab(cx,ty+78,front); lab(cx,ty+112,'Belakang',13,'#374151','400'); lab(cx,ty+130,back)
    aw,ah=34,190
    for sx in (-1,1):
        ax=cx+sx*(tw/2+6+aw/2)
        o.append(f'<rect x="{ax-aw/2}" y="{ty+4}" width="{aw}" height="{ah}" rx="16" fill="{C["arm"]}" stroke="#374151" stroke-width="1.5"/>')
        lab(ax,ty+ah/2+8,arm,14)
    ly=ty+th+6; lw=48
    for sx in (-1,1):
        lx=cx+sx*(lw/2+4)
        o.append(f'<rect x="{lx-lw/2}" y="{ly}" width="{lw}" height="{legh}" rx="18" fill="{C["leg"]}" stroke="#374151" stroke-width="1.5"/>')
        lab(lx,ly+legh/2+5,leg,14)
    o.append(f'<rect x="{cx-14}" y="{ly-4}" width="28" height="22" rx="5" fill="{C["per"]}" stroke="#374151" stroke-width="1.2"/>'); lab(cx,ly+12,per,12)
fig(200,92,'Dewasa','9%','9%','18%','18%','18%','1%',34,230)
fig(560,92,'Anak (contoh usia ±1 tahun)','18%','9%','18%','18%','13,5%','1%',46,206)
o.append(f'<text x="20" y="{H-48}" font-size="13" fill="#374151">Lengan 9% tiap sisi. Perineum 1%. Total 100%. Telapak + jari tangan pasien ≈ 1% TBSA (luka kecil/tersebar).</text>')
o.append(f'<text x="20" y="{H-28}" font-size="13" fill="#374151">Anak: setiap tahun setelah usia 12 bulan, kepala −1% dan tiap tungkai +0,5% (PNPK Luka Bakar 2019).</text>')
o.append(f'<text x="20" y="{H-10}" font-size="12" fill="#6b7280">Hitung hanya luka bakar derajat dua (dermal) dan tiga (full thickness) untuk resusitasi cairan.</text>')
o.append('</svg>')
open(sys.argv[1],'w').write('\n'.join(o)+'\n')
