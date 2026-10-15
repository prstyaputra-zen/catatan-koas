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

## 3. Tulis item (komprehensif, permintaan Prasetya 11 Okt 2026)
Bahasa Indonesia, sekitar 900-1.800 kata. Tujuannya MEMAHAMI, bukan sekadar hafal: jelaskan "mengapa", bukan hanya "apa".
Urutan bagian WAJIB (lewati hanya bila benar-benar tidak relevan, mis. anatomi pada topik psikiatri boleh diganti neurobiologi):
1. `Definisi:` definisi resmi dari sumber + klasifikasi/derajat bila ada.
2. `Anatomi dan fisiologi terkait:` struktur dan fungsi normal yang perlu dipahami dulu (mis. distribusi kalium intra/ekstrasel, lapisan kulit, aliran humor akuos).
3. `Patofisiologi:` rantai sebab-akibat langkah demi langkah dari penyebab sampai gejala. Boleh memakai panah teks "→" dalam poin.
   Hubungkan setiap gejala/tanda utama dengan mekanismenya.
4. `Etiologi dan faktor risiko:` bila relevan.
5. `Manifestasi klinis:` / `Diagnosis:` kriteria, pemeriksaan, temuan khas.
6. `Tatalaksana:` dosis dengan satuan, rute, dan alasan farmakologis singkat ("mengapa obat ini").
7. `Komplikasi:` dan `Kapan merujuk:` bila relevan.
8. `Analogi:` 1-2 analogi sehari-hari yang membuat mekanisme mudah dibayangkan (tulis jelas bahwa ini analogi).
9. `Mnemonik:` 1-3 mnemonik. Utamakan mnemonik yang sudah dikenal luas; bila membuat sendiri, tandai "(mnemonik buatan)".
   Mnemonik harus akurat terhadap isi catatan, tidak boleh memasukkan hal yang tidak ada di sumber.
10. `Poin untuk koas:` 4-6 poin praktis jaga/UKMPPD.
11. `Singkatan:` daftar SEMUA singkatan yang dipakai beserta kepanjangannya (mis. `- TD: tekanan darah`).

Aturan singkatan: setiap singkatan ditulis lengkap saat PERTAMA kali muncul, mis. "tekanan darah (TD)", "elektrokardiogram (EKG)",
lalu juga dicantumkan di bagian `Singkatan:`. Termasuk singkatan umum (IV, IM, BB, IGD) dan nama obat/uji yang disingkat.

Format aplikasi:
- Judul bagian ditulis sebagai baris sendiri yang diakhiri titik dua.
- Poin memakai `- `. Tabel memakai tabel Markdown (`| a | b |` dengan baris `|---|---|`).
- Jangan menulis bagian Sumber atau Guideline di `body`; isi field `sources` dan `guidelines`.
- Taruh `{{gambar:1}}`, `{{gambar:2}}`, ... pada baris sendiri di tempat gambar ke-N ingin muncul. Gambar yang tidak disebut otomatis ditaruh di akhir.
  Utamakan gambar yang menjelaskan anatomi/patofisiologi (mis. skema mekanisme) selain alur tatalaksana; boleh 2 gambar.
- Tanpa identitas pasien. Dosis selalu dengan satuan dan rute; sebut bila mengikuti protokol RS setempat.
- Angka (dosis, batas, kriteria) WAJIB dari sumber yang dibuka. Penjelasan fisiologi/patofisiologi konseptual boleh dari
  buku ajar standar, tetapi tidak boleh bertentangan dengan sumber dan tidak boleh memuat angka yang tidak diverifikasi.

## 3a. Gambar dan guideline (wajib bila relevan)
- Setiap item WAJIB punya minimal satu gambar bila topiknya punya unsur visual: EKG, algoritma/alur tatalaksana,
  kriteria/skor, anatomi sederhana, kurva, atau tabel ringkas bergambar.
- UTAMAKAN gambar sumber asli berlisensi terbuka dari Wikimedia Commons (permintaan Prasetya 15 Okt 2026):
  - Cari berkas lewat API `https://commons.wikimedia.org/w/api.php` dan SELALU kirim header `User-Agent`, mis.
    `CatatanKoas/1.0 (https://github.com/prstyaputra-zen/catatan-koas)`; tanpa itu server menjawab 400/429.
  - Ambil lisensi, penulis, dan URL dari `prop=imageinfo&iiprop=url|extmetadata`. Pakai hanya CC0, domain publik, CC BY,
    atau CC BY-SA. Unduh berkasnya (atau thumbnail lebar ≤ 1200 px lewat `iiurlwidth`) dari `upload.wikimedia.org`
    ke `feed/img/<id>-N.<svg|png|jpg>`.
  - `credit` wajib berisi penulis, lisensi, dan tautan halaman berkas, mis.
    `"Mikael Häggström, CC0, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:..."`.
  - Lihat gambarnya sebelum dipakai dan pastikan isinya cocok dengan sumber yang sudah diverifikasi (label berbahasa Inggris boleh).
  - Masih diblokir dari server rutin: gambar CDN OpenStax, CDC/PHIL, en.wikipedia.org, NCBI, LITFL. Gambar berhak cipta tidak boleh disalin.
- Bila tidak ada gambar Commons yang cocok, gambar DIGAMBAR SENDIRI dengan kode sebagai SVG yang akurat secara klinis
  (`credit` diawali "Digambar Claude berdasarkan ..."):
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
