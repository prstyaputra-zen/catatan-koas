"""Periksa hasil Gemini lalu salin HANYA item baru dan gambarnya ke checkout bersih.

Dipakai oleh .github/workflows/auto-updates-gemini.yml (job "terbitkan"), yang berjalan di mesin
terpisah dari Gemini. Argumen: <folder hasil Gemini> <folder repo bersih>. Keluar dengan kode 0
tanpa mengubah apa pun bila tidak ada item baru; keluar dengan kode != 0 bila hasil tidak lolos.
"""
import json
import os
import re
import shutil
import sys

hasil, repo = sys.argv[1], sys.argv[2]
FEED = 'feed/ilmu.json'
MAKS_ITEM = 300
MAKS_GAMBAR = 3 * 1024 * 1024
EKSTENSI = ('.svg', '.png', '.jpg', '.jpeg', '.webp')
BERBAHAYA = re.compile(r'<\s*script|javascript:|<\s*iframe|<\s*object|<\s*embed|<\s*foreignObject|\son[a-z]+\s*=', re.I)


def gagal(pesan):
    sys.exit('DITOLAK: ' + pesan)


lama = json.load(open(os.path.join(repo, FEED), encoding='utf-8'))
try:
    baru = json.load(open(os.path.join(hasil, FEED), encoding='utf-8'))
except (OSError, ValueError) as e:
    gagal(f'feed/ilmu.json dari Gemini tidak valid: {e}')

li, bi = lama['items'], baru.get('items')
if not isinstance(bi, list):
    gagal('items bukan daftar')
if len(bi) == len(li) and bi == li:
    print('Tidak ada item baru.')
    sys.exit(0)

# Item lama tidak boleh diubah: harus sama persis dengan ekor daftar lama (boleh terpangkas di depan bila > 300).
item = bi[-1]
sisa = bi[:-1]
boleh = {len(li)} | ({MAKS_ITEM - 1} if len(li) >= MAKS_ITEM else set())
if len(sisa) not in boleh or sisa != li[len(li) - len(sisa):]:
    gagal('item lama ikut berubah atau jumlah item tidak wajar')

if not isinstance(item, dict):
    gagal('item baru bukan objek')
iid = str(item.get('id', ''))
if not re.fullmatch(r'\d{8}-\d{4}-[a-z0-9-]{3,60}', iid):
    gagal(f'id tidak sesuai pola: {iid!r}')
if any(x.get('id') == iid for x in li):
    gagal('id sudah ada')
for k in ('created', 'title', 'type', 'stase', 'tags', 'body', 'sources'):
    if not item.get(k):
        gagal(f'field {k} kosong')

teks = json.dumps(item, ensure_ascii=False)
if BERBAHAYA.search(teks):
    gagal('ada skrip atau atribut berbahaya di item')
for s in list(item.get('sources', [])) + list(item.get('guidelines', [])):
    if not isinstance(s, dict) or not str(s.get('url', '')).startswith('https://'):
        gagal(f'sumber/guideline tanpa tautan https: {s!r}')

salin = []
for im in item.get('images', []) or []:
    f = str(im.get('file', ''))
    nama = f[len('img/'):] if f.startswith('img/') else ''
    if not (nama.startswith(iid + '-') and nama.lower().endswith(EKSTENSI) and '/' not in nama and '..' not in nama):
        gagal(f'nama gambar tidak diizinkan: {f!r}')
    sumber = os.path.join(hasil, 'feed', 'img', nama)
    if not os.path.isfile(sumber) or os.path.islink(sumber):
        gagal(f'gambar tidak ada: {f}')
    if os.path.getsize(sumber) > MAKS_GAMBAR:
        gagal(f'gambar terlalu besar: {f}')
    data = open(sumber, 'rb').read()
    if nama.lower().endswith('.svg'):
        if BERBAHAYA.search(data.decode('utf-8', 'replace')) or re.search(rb'(href|src)\s*=\s*["\']\s*(https?:|//|data:text)', data, re.I):
            gagal(f'SVG berisi skrip atau tautan luar: {f}')
    elif not (data[:3] == b'\xff\xd8\xff' or data[:8] == b'\x89PNG\r\n\x1a\n' or (data[:4] == b'RIFF' and data[8:12] == b'WEBP')):
        gagal(f'isi gambar tidak sesuai format: {f}')
    salin.append((sumber, os.path.join(repo, 'feed', 'img', nama)))

spec_dir = os.path.join(hasil, 'feed', 'tools', 'spec')
if os.path.isdir(spec_dir):
    for nama in os.listdir(spec_dir):
        p = os.path.join(spec_dir, nama)
        if nama.startswith(iid + '-') and nama.endswith('.json') and os.path.isfile(p) and not os.path.islink(p):
            json.load(open(p, encoding='utf-8'))
            salin.append((p, os.path.join(repo, 'feed', 'tools', 'spec', nama)))

# Terapkan: tambahkan item ke feed lama (bukan menyalin file Gemini utuh), pangkas ke 300, salin gambar.
lama['items'] = (li + [item])[-MAKS_ITEM:]
lama['updated'] = item['created']
open(os.path.join(repo, FEED), 'w', encoding='utf-8').write(json.dumps(lama, ensure_ascii=False, indent=1) + '\n')
for a, b in salin:
    shutil.copyfile(a, b)
print('OK:', item['title'])
