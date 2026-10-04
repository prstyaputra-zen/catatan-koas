# Catatan Koas

Aplikasi catatan klinis pribadi (PWA) untuk iPhone dan laptop. Semua data tersimpan di perangkat (IndexedDB), bisa dicari cepat, dan berjalan tanpa internet setelah dibuka sekali.

## Fitur versi 0.1
- Catatan dengan template: Kasus, Topik, Obat, Prosedur, Bebas; tag dan stase.
- Lampiran foto, video, audio, plus rekam suara langsung. Keterangan lampiran ikut dicari.
- Pencarian instan: awalan kata, toleran salah ketik, dan ~60 kelompok sinonim/singkatan medis (dm = diabetes melitus, ekg = ecg, dll).
- Tautan antar catatan dengan [[Judul]], daftar catatan terkait berdasarkan tag.
- Backup/pulihkan ke satu file .zip (berisi juga file Markdown yang bisa dibuka di Obsidian).
- Tetap jalan offline (service worker), keluar dari editor menyimpan otomatis.

## Menjalankan
Butuh hosting HTTPS statis (GitHub Pages, Netlify, Cloudflare Pages). Untuk uji lokal: `npx http-server .` lalu buka http://localhost:8080.

## Rencana berikutnya
OCR foto dan transkripsi audio offline, kunci PIN + enkripsi, sinkronisasi iPhone dan laptop.
