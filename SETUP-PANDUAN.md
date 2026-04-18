# PANDUAN SETUP — SAKTI KPPN Jayapura (Versi Aman)

## Apa yang Sudah Berubah?

Website sekarang AMAN:
- ✅ Login divalidasi di server (bukan browser)
- ✅ Password di-hash SHA-256 + salt (tidak bisa dibaca walau Sheets dibuka)
- ✅ Sesi token 8 jam, otomatis expired
- ✅ Data tersimpan di Google Spreadsheet (bukan browser lokal)
- ✅ File tersimpan di Google Drive
- ✅ Manajemen user langsung dari panel admin
- ✅ Proteksi hapus: verifikasi password lewat server

---

## LANGKAH SETUP (Wajib sebelum pakai)

### Langkah 1 — Buat Google Spreadsheet
1. Buka [sheets.google.com](https://sheets.google.com)
2. Buat Spreadsheet baru, beri nama: **SAKTI KPPN Jayapura**
3. Salin **ID Spreadsheet** dari alamat URL:
   - Contoh URL: `https://docs.google.com/spreadsheets/d/XXXXX/edit`
   - ID-nya adalah bagian **XXXXX**

### Langkah 2 — Buat Folder Google Drive
1. Buka [drive.google.com](https://drive.google.com)
2. Buat folder baru, beri nama: **Dokumen SAKTI KPPN Jayapura**
3. Buka folder tersebut, salin **ID Folder** dari alamat URL:
   - Contoh URL: `https://drive.google.com/drive/folders/YYYYY`
   - ID-nya adalah bagian **YYYYY**

### Langkah 3 — Buat Google Apps Script
1. Buka [script.google.com](https://script.google.com)
2. Klik **Proyek baru**
3. Hapus semua kode yang sudah ada di editor
4. Salin semua isi file `apps-script.gs`, lalu tempelkan di editor
5. Isi bagian konfigurasi di paling atas kode:
   ```javascript
   const CONFIG = {
     FOLDER_ID:      'YYYYY',   // ← ID Folder Drive dari Langkah 2
     SPREADSHEET_ID: 'XXXXX',   // ← ID Spreadsheet dari Langkah 1
     ...
   };
   ```
6. **Jalankan fungsi `initSpreadsheet` satu kali:**
   - Klik dropdown nama fungsi di toolbar atas → pilih **initSpreadsheet**
   - Klik tombol ▶ **Jalankan**
   - Izinkan akses Google ketika muncul permintaan izin
   - Tunggu hingga selesai (muncul pesan berhasil di bawah)

### Langkah 4 — Deploy sebagai Aplikasi Web
1. Klik menu **Deploy** → **Deployment baru**
2. Klik ikon ⚙️ di samping "Pilih jenis" → pilih **Aplikasi web**
3. Isi kolom berikut:
   - Deskripsi: `SAKTI KPPN Jayapura v2`
   - Jalankan sebagai: **Saya** (akun Google kamu)
   - Siapa yang memiliki akses: **Semua orang** *(wajib, agar website bisa terhubung)*
4. Klik **Deploy**
5. **Salin URL** yang muncul — bentuknya seperti ini:
   `https://script.google.com/macros/s/.../exec`

### Langkah 5 — Tempel URL ke 3 File HTML
Di ketiga file (`index.html`, `upload.html`, `admin.html`), cari baris ini:
```
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw.../exec';
```
Ganti URL lama dengan URL baru hasil Langkah 4.

### Langkah 6 — Upload ke GitHub
Push semua file ke repository GitHub seperti biasa. Website siap digunakan!

---

## Akun Login Bawaan
| Username | Password  | Role    |
|----------|-----------|---------|
| admin    | kppn2024  | Admin   |
| kppn1    | sakti123  | Petugas |

> ⚠️ **Segera ganti password setelah pertama kali login** melalui menu Pengaturan!

---

## Catatan Keamanan
- Password tidak pernah disimpan dalam bentuk asli — selalu dalam bentuk hash
- Token sesi tersimpan sementara di browser dan otomatis terhapus saat browser ditutup
- Hanya **Admin** yang bisa: hapus data, tambah/hapus user, lihat kode OTP
- **Petugas** hanya bisa: lihat daftar pendaftaran, proses OTP, ganti password sendiri
