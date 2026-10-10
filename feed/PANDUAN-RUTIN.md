# Panduan rutin "Auto updates" (dibaca Claude setiap kali rutin berjalan)

Tujuan: setiap 4 jam (05.00-23.00 WIB) menambahkan SATU rangkuman ilmu kedokteran baru untuk koas ke `feed/ilmu.json`.
Aplikasi Catatan Koas mengambil file ini dan menjadikannya catatan bertag #auto-updates, lengkap dengan gambar dan guideline terkait.

## 1. Pilih topik
- Baca `feed/ilmu.json`. Jangan mengulang topik yang sudah ada (cek judul dan tag semua item).
- Gilir stase berdasarkan jumlah item: indeks = jumlah item saat ini mod 15 pada daftar
  IPD, Bedah, Anak, Obgyn, Saraf, Jiwa, Kulit, Mata, THT, Anestesi, Kardiologi, Pulmonologi, Radiologi, Forensik, IKM.
- Pilih topik yang sering ditemui koas/UKMPPD (utamakan kompetensi SKDI 4A dan kegawatdaruratan),
  atau pembaruan guideline penting dalam 5 tahun terakhir.

## 2. Riset (wajib, jangan dari ingatan)
- Cari dengan WebSearch, lalu BUKA setiap sumber dengan WebFetch dan ambil angka (dosis, batas, kriteria) langsung dari teksnya.
- Sumber yang boleh dipakai, minimal satu, idealnya dua (satu nasional + satu internasional):
  - Guideline: PNPK Kemenkes, PPK IDI, konsensus perhimpunan (PAPDI, PERKI, IDAI, POGI, PERDOSSI, PDPI, PERKENI, PDSKJI, PERDOSKI, PERDAMI, PERHATI-KL, IKABI), WHO, NICE, CDC, AHA/ACC, ESC, IDSA, KDIGO, GINA, GOLD, ADA, Surviving Sepsis Campaign, ACOG, RCOG, AAP.
  - Ulasan/penelitian di jurnal bereputasi terindeks PubMed (mis. NEJM, Lancet, BMJ, JAMA, Cochrane Library, Annals, jurnal perhimpunan resmi), atau StatPearls/NCBI Bookshelf.
  - Buku ajar standar hanya bila isinya bisa diverifikasi daring.
- DILARANG: Wikipedia, blog, situs berita/kesehatan populer (Alodokter, Halodoc, Healthline, WebMD, dsb.), jurnal predator, materi tanpa penulis/penerbit jelas.
- Utamakan terbitan ≤ 10 tahun; sebutkan tahunnya. Bila ada perbedaan antarsumber, tulis keduanya.
- Bila tidak ada sumber layak yang berhasil dibuka dan diverifikasi, JANGAN menerbitkan apa pun. Akhiri rutin.

## 3. Tulis item
Bahasa Indonesia, 350-700 kata, ringkas dan praktis. Isi `body` memakai format aplikasi:
- Judul bagian ditulis sebagai baris sendiri yang diakhiri titik dua, mis. `Definisi:`, `Diagnosis:`, `Tatalaksana:`.
- Poin memakai `- `. Tabel memakai tabel Markdown (`| a | b |` dengan baris `|---|---|`).
- Akhiri dengan bagian `Poin untuk koas:` (3-5 poin klinis praktis).
- Jangan menulis bagian Sumber atau Guideline di `body`; isi field `sources` dan `guidelines`.
- Taruh `{{gambar:1}}`, `{{gambar:2}}`, ... pada baris sendiri di tempat gambar ke-N ingin muncul (mis. tepat setelah bagian EKG). Gambar yang tidak disebut otomatis ditaruh di akhir.
- Tanpa identitas pasien. Dosis selalu dengan satuan dan rute; sebut bila mengikuti protokol RS setempat.

## 3a. Gambar dan guideline (wajib bila relevan)
- Setiap item WAJIB punya minimal satu gambar bila topiknya punya unsur visual: EKG, algoritma/alur tatalaksana,
  kriteria/skor, anatomi sederhana, kurva, atau tabel ringkas bergambar.
- Server rutin TIDAK bisa mengunduh gambar dari situs luar (Wikimedia, NCBI, LITFL diblokir) dan gambar berhak cipta
  tidak boleh disalin. Karena itu gambar DIGAMBAR SENDIRI dengan kode sebagai SVG yang akurat secara klinis:
  - EKG: tulis spesifikasi JSON di `feed/tools/spec/<id>-N.json` lalu jalankan
    `python3 feed/tools/ekg_svg.py feed/tools/spec/<id>-N.json feed/img/<id>-N.svg`
    (contoh: `feed/tools/spec/20261010-hipokalemia-1.json`; bandingkan normal vs kelainan, beri anotasi panah).
  - Algoritma/diagram: tulis SVG langsung (kotak + panah, teks ≥ 13 px, latar putih, lebar ≤ 900 px, tanpa font/gambar eksternal).
  - Ciri gambar harus sesuai sumber yang sudah diverifikasi; sebut dasarnya di `credit`.
  - Periksa hasilnya dengan merender SVG ke PNG (Playwright) dan lihat gambarnya sebelum commit: label tidak bertumpuk, tidak terpotong.
- Gambar dari URL luar hanya boleh bila lisensinya bebas (CC BY/CC0/domain publik) DAN berhasil dibuka; tulis lisensi di `credit`.
- `guidelines`: 1-3 guideline resmi yang paling relevan (nasional dan/atau internasional), masing-masing dibuka dengan WebFetch untuk
  memastikan judul, tahun, dan tautannya benar. Utamakan tautan DOI atau halaman resmi organisasi.

Struktur item (tambahkan di AKHIR array `items`):
```json
{
  "id": "YYYYMMDD-HHMM-slug-singkat",
  "created": "2026-10-10T08:00:00Z",
  "title": "Judul singkat yang jelas",
  "type": "topik | obat | prosedur",
  "stase": "salah satu stase di atas",
  "tags": ["3-6 kata kunci"],
  "body": "... {{gambar:1}} ...",
  "images": [{ "file": "img/<id>-1.svg", "caption": "Apa yang ditunjukkan gambar", "credit": "Digambar Claude berdasarkan <sumber>" }],
  "guidelines": [{ "org": "PERKI / ESC / WHO ...", "title": "Judul guideline", "year": 2024, "url": "https://doi.org/..." }],
  "sources": [{ "title": "Penulis/Organisasi. Judul", "publisher": "Jurnal/penerbit, volume:halaman", "year": 2024, "url": "https://..." }]
}
```
- `created` = waktu sekarang (UTC, ISO 8601). Perbarui juga field `updated` di akar file.
- Simpan paling banyak 300 item terbaru (hapus yang tertua bila lebih).
- Hapus juga gambar `feed/img/<id>-*` dan spesifikasi `feed/tools/spec/<id>-*` milik item yang dihapus.
- Merevisi item lama (mis. menambah gambar): naikkan `rev` (mulai 2) dan isi `revised` (waktu UTC). Aplikasi memperbarui catatan itu selama belum diubah pengguna.

## 4. Simpan
- Validasi: `python3 -c "import json;json.load(open('feed/ilmu.json'))"` harus berhasil.
- Hanya ubah `feed/ilmu.json`, `feed/img/*`, dan `feed/tools/spec/*`.
- `git config user.name "Prasetya"` dan `git config user.email "337586035+prstyaputra-zen@users.noreply.github.com"` (JANGAN pakai email lain).
- Commit dengan pesan `Auto updates: <judul>` lalu `git push origin main`. Bila ditolak karena ada commit baru, `git pull --rebase origin main` lalu push lagi.
