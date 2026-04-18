# Panduan Deploy Website SAKTI ke GitHub Pages (Gratis)

## Yang Dibutuhkan
- Akun GitHub (gratis di github.com)
- File `index.html` ini

---

## Langkah Deploy

### 1. Buat Repository di GitHub
1. Login ke [github.com](https://github.com)
2. Klik tombol **New** atau **+ > New repository**
3. Isi nama repo, contoh: `sakti-pendaftaran`
4. Set ke **Public**
5. Klik **Create repository**

### 2. Upload File
1. Di halaman repo yang baru dibuat, klik **Add file > Upload files**
2. Drag & drop file `index.html`
3. Klik **Commit changes**

### 3. Aktifkan GitHub Pages
1. Masuk ke **Settings** (tab di repo)
2. Scroll ke bagian **Pages** di menu kiri
3. Di **Source**, pilih **Deploy from a branch**
4. Branch: pilih **main**, folder: **/ (root)**
5. Klik **Save**

### 4. Website Siap
Dalam 1-2 menit, website akan live di:
```
https://<username-github-kamu>.github.io/sakti-pendaftaran/
```

---

## Catatan Penting

### Tentang Upload Dokumen
Website ini bersifat **statis** — file yang di-upload **tidak tersimpan ke server** secara otomatis.

Untuk menyimpan dokumen upload ke Google Drive, tambahkan integrasi Google Apps Script:
1. Buat Google Apps Script baru di [script.google.com](https://script.google.com)
2. Deploy sebagai Web App (akses: Anyone)
3. Ganti URL `APPS_SCRIPT_URL` di file `index.html` dengan URL deploy tersebut

### Format Output Excel
- Semua cell di Excel output berformat **text (string)** sesuai permintaan
- Format tanggal SK: `dd-mm-yyyy`
- Peran yang dirangkap dalam kelompok sama dipisah koma dalam satu baris
- Peran lintas kelompok otomatis dideteksi dan diblokir (harus baris berbeda)

---

## Cara Gunakan Website

1. Isi **Kode Satker** dan **Nama Satker**
2. Isi **Data KPA** (nama + NIP + kota + tanggal surat)
3. Tambahkan user satu per satu di tabel:
   - Klik `+ Tambah Baris` untuk user baru
   - Pilih peran dari dropdown, klik `+ Tambah`
   - Jika seseorang punya peran beda kelompok → tambah baris baru untuk orang yang sama
4. Upload dokumen pendukung (SK, dll)
5. Klik **Generate & Download Excel**
6. File Excel siap dikirim ke KPPN bersama SK PDF

---

## Kelompok Peran SAKTI

| Kelompok | Contoh Peran |
|----------|-------------|
| APPROVER | KPA, PPSPM, Approver Aset, Approver Persediaan |
| VALIDATOR | PPK, Validator Aset, Validator Anggaran (BLU) |
| OPERATOR | Semua Operator (Pembayaran, Komitmen, Aset, dll) |
| ADMIN | Admin Satker |

**Aturan rangkap peran:**
- Sesama OPERATOR → boleh 1 baris, dipisah koma
- OPERATOR + APPROVER → wajib 2 baris berbeda
- KPA + Approver Aset → boleh 1 baris (sama-sama APPROVER)
- KPA + PPK → wajib 2 baris (APPROVER vs VALIDATOR)
