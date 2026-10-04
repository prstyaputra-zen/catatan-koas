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

## Menjalankan
Butuh hosting HTTPS statis (GitHub Pages, Netlify, Cloudflare Pages). Untuk uji lokal: `npx http-server .` lalu buka http://localhost:8080.

## Pihak ketiga
`vendor/pdfjs`: pdf.js (Apache-2.0), dipakai untuk membaca dan menampilkan PDF secara offline.

## Rencana berikutnya
Anotasi/highlight PDF, OCR foto dan transkripsi audio offline, kunci PIN + enkripsi, sinkronisasi iPhone dan laptop.
