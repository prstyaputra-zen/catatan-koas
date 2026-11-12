# Catatan Koas

Aplikasi catatan klinis pribadi (PWA) untuk iPhone dan laptop. Semua data tersimpan di perangkat (IndexedDB), bisa dicari cepat, dan berjalan tanpa internet setelah dibuka sekali.

## Fitur
- Catatan dengan template: Kasus, Topik, Obat, Prosedur, Bebas; tag dan stase.
- Lampiran foto, video, audio, plus rekam suara langsung. Keterangan lampiran ikut dicari.
- Pencarian instan: awalan kata, toleran salah ketik, dan ~60 kelompok sinonim/singkatan medis (dm = diabetes melitus, ekg = ecg, dll).
- Tautan antar catatan dengan [[Judul]], daftar catatan terkait berdasarkan tag.
- Backup/pulihkan ke satu file .zip (berisi juga file Markdown yang bisa dibuka di Obsidian).
- Tetap jalan offline (service worker), keluar dari editor menyimpan otomatis.
- (0.2) Dokumen PDF, Word, PowerPoint, dan teks disimpan utuh. Isinya diekstrak di perangkat dan ikut dicari, lengkap dengan nomor halaman.
- (0.2) Pembaca PDF bawaan, pratinjau teks Word/PowerPoint, "Buka di…" untuk mengedit di Word/Pages, riwayat versi, dan "Jadikan catatan".

- (0.3) Sorotan kuning kata yang dicari di halaman PDF, cari di dalam dokumen dengan tombol lompat.
- (0.4) Sinkron otomatis iPhone dan laptop lewat folder aplikasi tersembunyi di Google Drive, terenkripsi end-to-end (PBKDF2 + AES-GCM) dengan kata sandi sinkron.
- (0.5) "Tempel dari Claude": jawaban/rangkuman yang disalin dari aplikasi Claude dirapikan jadi catatan (judul, jenis, stase, tag, bagian, dan daftar sumber), plus prompt rangkuman siap salin. Tautan di catatan bisa diketuk.
- (0.6) Menu Alat (🧮) dengan kalkulator IMT/BMI: kategori Asia-Pasifik, WHO, dan Kemenkes, skala warna, rentang BB normal, BB ideal Broca, obesitas sentral dari lingkar perut, saran singkat, salin hasil atau jadikan catatan.
- (0.7) Tabel di catatan: buat dan edit lewat editor kisi (▦ Tabel), tempel dari Excel/Numbers/Word/web otomatis jadi tabel, impor dari .xlsx/.csv, tabel di file Word/Excel/CSV yang dilampirkan ikut terbaca dan dicari. Disimpan sebagai tabel Markdown (kompatibel Obsidian).
- (0.8) Gambar di dalam teks catatan: tombol 🖼️ Gambar (kamera/galeri), tempel gambar dari clipboard, seret-lepas di laptop, sisipkan foto lampiran ke teks, potong gambar dari halaman PDF, dan ambil gambar yang tertanam di Word/PowerPoint/Excel. Disimpan sebagai ![keterangan](img:id), diekspor ke format Obsidian.
- (0.9) Auto updates: rutin Claude terjadwal (setiap 4 jam, 05.00-23.00 WIB) menulis rangkuman bersumber guideline/jurnal ke `feed/ilmu.json` (lihat `feed/PANDUAN-RUTIN.md`); aplikasi mengimpornya sebagai catatan #auto-updates saat online. Juga: cari di dalam catatan (🔍).
- (0.15) Navigasi catatan: kartu "Daftar isi" di atas isi dan tombol mengambang ☰ untuk melompat ke judul/sub judul (bagian yang sedang dibaca disorot). Bagian Singkatan, Guideline terkait, dan Sumber menjadi tombol "Rujukan" di akhir catatan yang membuka lembar show/hide. Bilah Baca/Ubah menciut menjadi ikon saat menggulir, mengetik, atau diam 2,5 detik, dan mengembang saat diketuk/disentuh.
- (0.16) Judul catatan dan judul bagian tampil sesuai EYD (huruf kapital di awal kata kecuali kata tugas seperti di, dan, yang, dengan; singkatan seperti eGFR/pH tidak diubah). Singkatan, Guideline Terkait, dan Sumber dikumpulkan di kartu "Rujukan" tepat di bawah Daftar Isi. Perbaikan: sematan tidak lagi hilang setelah sinkron/refresh bila waktu ubah catatan lebih baru daripada jam perangkat.
- (0.18) Tab ✨ AI (ikon di kanan atas): minta catatan baru ke rutin AI (antrean di repo data privat, dikerjakan lebih dulu oleh rutin berikutnya) atau salin prompt untuk aplikasi Claude; riwayat permintaan dengan status dan tautan ke catatannya; daftar revisi yang menunggu; pengaturan Auto updates; Tempel dari Claude. Halaman Jenis dan stase: tambah/ganti nama/sembunyikan/urutkan jenis beserta templatenya, kelola daftar stase, dan atur stase yang ikut giliran rutin AI serta stase fokus. Feed, gambar, permintaan, serta jenis dan stase pindah ke repo privat `catatan-koas-data`; token GitHub cukup diisi sekali dan ikut sinkron Google Drive (terenkripsi) ke perangkat lain.
- (0.17) Coret dan catatan kecil langsung di gambar: ketuk gambar di catatan, pilih ✏️ Coret & catatan, lalu gambar dengan pena (5 warna, tipis/tebal), tambah catatan teks, hapus per coretan, urungkan. Foto asli tidak diubah; coretan disimpan sebagai lapisan terpisah dan ikut sinkron serta backup. Revisi Auto updates kini membawa sematan, coretan (bila file gambarnya sama), tag tambahanmu, dan bagian `## Catatanku`. Bila isi catatan sudah kamu ubah, revisi tidak dipasang diam-diam: muncul pemberitahuan "Revisi tersedia" dengan pratinjau (perubahan per bagian dengan sorotan kata, gambar baru/dihapus, yang tetap dibawa, dan editanmu yang akan hilang), lalu pilih Pakai revisi atau Tetap versiku. Jenis dan stase pilihanmu juga dipertahankan; revisi/impor yang gambarnya gagal diunduh karena koneksi ditunda dan dicoba lagi; bila revisi tanpa `revNote`, pratinjau menampilkan ringkasan otomatis.
- (0.14) Daftar bertingkat: poin yang diberi indentasi tampil sebagai sub-poin (bulatan berbeda dan garis pandu). Di editor, Tab/Shift+Tab atau tombol ⇥/⇤ mengatur tingkat poin, tombol • menjadikan baris poin, dan Enter melanjutkan poin setingkat (Enter di poin kosong naik satu tingkat).
- (0.13) Menu Alat: kalkulator dosis puyer (racikan beberapa obat per BB, jumlah tablet dengan pembulatan ¼/½, peringatan dosis maksimal, resep d.t.d.) dan cairan rumatan Holliday-Segar (mL/hari, mL/jam, tetes/menit makro/mikro, rencana defisit dehidrasi).
- (0.12) Tampilan halaman bersih bergaya editor dokumen: ikon halaman, blok properti (jenis, stase, tag), ikon garis. Judul bagian ("## Judul" atau baris "Label:") bisa dilipat dan diingat per catatan, plus tombol lipat/buka semua. Tombol mode Baca/Ubah mengambang di bawah layar (Ctrl/⌘+E), membawa posisi bagian yang sedang dibaca saat berpindah.
- (0.10) "Ilmu baru" berganti nama menjadi Auto updates (#auto-updates). Setiap update kini bisa membawa gambar/ilustrasi (`feed/img`, mis. skema EKG dari `feed/tools/ekg_svg.py`) dan daftar "Guideline terkait"; item yang direvisi memperbarui catatan selama belum kamu ubah.

## Data privat (Auto updates dan AI)
Feed Auto updates (`feed/ilmu.json`, gambar, panduan rutin), antrean permintaan catatan, serta daftar jenis dan stase ada di repo privat `prstyaputra-zen/catatan-koas-data` (diatur di `js/config.js`, `dataRepo`). Aplikasi membacanya lewat GitHub API dengan fine-grained token (Contents: Read and write, hanya repo itu) yang diisi di tab AI. Token ikut sinkron Google Drive terenkripsi kata sandi sinkron, tidak masuk backup. Rutin AI bekerja di repo data dan mengikuti `feed/PANDUAN-RUTIN.md` di sana.

## Sinkron Google Drive
Isi `googleClientId` di `js/config.js` (OAuth Client ID tipe Web application, origin `https://prstyaputra-zen.github.io`, redirect URI `https://prstyaputra-zen.github.io/catatan-koas/`, scope `drive.appdata`), atau tempel di Pengaturan aplikasi.

## Menjalankan
Butuh hosting HTTPS statis (GitHub Pages, Netlify, Cloudflare Pages). Untuk uji lokal: `npx http-server .` lalu buka http://localhost:8080.

## Pihak ketiga
`vendor/pdfjs`: pdf.js (Apache-2.0), dipakai untuk membaca dan menampilkan PDF secara offline.

## Rencana berikutnya
Anotasi/highlight PDF, OCR foto dan transkripsi audio offline, kunci PIN + enkripsi, sinkronisasi iPhone dan laptop.
