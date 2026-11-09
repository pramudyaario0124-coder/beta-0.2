# Klip Studio Beta 0.2

Editor video PWA mobile-first dengan workspace gelap, preview, timeline klip, panel tools, trim, split dasar, filter/warna, teks, kecepatan, dan ekspor WebM.

## Instalasi / GitHub Pages
1. Ekstrak ZIP ini.
2. Upload seluruh isi folder ke root repository, bukan folder pembungkus ZIP.
3. Replace `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, dan `README.md`; tambahkan `icon.svg`.
4. Aktifkan GitHub Pages dari branch `main`, folder `/ (root)`.
5. Buka URL Pages melalui Chrome Android. Gunakan menu browser **Install app / Tambahkan ke layar utama** bila tersedia.

## Batasan beta
- Timeline berisi beberapa klip video dalam satu urutan, belum multi-layer seperti CapCut.
- Split adalah pemisahan klip sederhana pada posisi playhead.
- Ekspor menggunakan MediaRecorder dan menghasilkan WebM, bukan MP4 native.
- Musik latar belum dicampur ke hasil ekspor.
- Proyek belum disimpan sebagai file project permanen; media tetap berada di sesi browser.
- Performa dan dukungan codec bergantung pada perangkat dan browser. Uji dulu dengan klip pendek 720p.
