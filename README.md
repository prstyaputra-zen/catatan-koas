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
- (0.9) Ilmu baru otomatis: rutin Claude terjadwal (setiap 4 jam, 05.00-23.00 WIB) menulis rangkuman bersumber guideline/jurnal ke `feed/ilmu.json` (lihat `feed/PANDUAN-RUTIN.md`); aplikasi mengimpornya sebagai catatan #ilmu-baru saat online. Juga: cari di dalam catatan (🔍).

## Sinkron Google Drive
Isi `googleClientId` di `js/config.js` (OAuth Client ID tipe Web application, origin `https://prstyaputra-zen.github.io`, redirect URI `https://prstyaputra-zen.github.io/catatan-koas/`, scope `drive.appdata`), atau tempel di Pengaturan aplikasi.

## Menjalankan
Butuh hosting HTTPS statis (GitHub Pages, Netlify, Cloudflare Pages). Untuk uji lokal: `npx http-server .` lalu buka http://localhost:8080.

## Pihak ketiga
`vendor/pdfjs`: pdf.js (Apache-2.0), dipakai untuk membaca dan menampilkan PDF secara offline.

## Rencana berikutnya
Anotasi/highlight PDF, OCR foto dan transkripsi audio offline, kunci PIN + enkripsi, sinkronisasi iPhone dan laptop.
