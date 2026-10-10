# Panduan rutin "Ilmu baru" (dibaca Claude setiap kali rutin berjalan)

Tujuan: setiap 3 jam menambahkan SATU rangkuman ilmu kedokteran baru untuk koas ke `feed/ilmu.json`.
Aplikasi Catatan Koas mengambil file ini dan menjadikannya catatan bertag #ilmu-baru.

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
- Jangan menulis bagian Sumber di `body`; isi field `sources`.
- Tanpa identitas pasien. Dosis selalu dengan satuan dan rute; sebut bila mengikuti protokol RS setempat.

Struktur item (tambahkan di AKHIR array `items`):
```json
{
  "id": "YYYYMMDD-HHMM-slug-singkat",
  "created": "2026-10-10T08:00:00Z",
  "title": "Judul singkat yang jelas",
  "type": "topik | obat | prosedur",
  "stase": "salah satu stase di atas",
  "tags": ["3-6 kata kunci"],
  "body": "...",
  "sources": [{ "title": "Penulis/Organisasi. Judul", "publisher": "Jurnal/penerbit, volume:halaman", "year": 2024, "url": "https://..." }]
}
```
- `created` = waktu sekarang (UTC, ISO 8601). Perbarui juga field `updated` di akar file.
- Simpan paling banyak 300 item terbaru (hapus yang tertua bila lebih).

## 4. Simpan
- Validasi: `python3 -c "import json;json.load(open('feed/ilmu.json'))"` harus berhasil.
- Hanya ubah `feed/ilmu.json`.
- `git config user.name "Prasetya"` dan `git config user.email "337586035+prstyaputra-zen@users.noreply.github.com"` (JANGAN pakai email lain).
- Commit dengan pesan `Ilmu baru: <judul>` lalu `git push origin main`. Bila ditolak karena ada commit baru, `git pull --rebase origin main` lalu push lagi.
