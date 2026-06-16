# S-Fin - Portal & Dashboard Penggajian Karyawan

S-Fin adalah aplikasi web portal slip gaji dan dashboard penggajian untuk **PT. Senndyt Sarungtangan Kreatif**. Aplikasi ini dirancang untuk mempermudah HRD/Finance dalam mengelola data gaji bulanan, mencetak slip gaji massal secara rapi, mengirimkan slip gaji via WhatsApp, serta menyediakan halaman akses slip online resmi bagi karyawan.

---

## 🚀 Fitur Utama

- **Dashboard Ringkasan Eksekutif**: Menampilkan statistik total karyawan, total gaji dibayarkan, dan rata-rata gaji bersih per bulan/periode secara dinamis.
- **Impor Berkas Excel Cepat**: Impor data penggajian langsung dari file Excel (`.xlsx` atau `.xls`) dalam hitungan detik.
- **Kustomisasi Periode Gaji**: Menghindari ketidaksinkronan data akibat tanggal penggajian yang mundur/terlambat. Admin dapat mengubah nama periode sebelum data diimpor (misal: gaji Januari baru dibayar Februari).
- **Cetak Massal (Print All ke PDF)**:
  - Mencetak seluruh slip gaji periode tertentu sekaligus dengan satu tombol.
  - Layout cetak dilengkapi dengan garis putus-putus panduan potong kertas (`✂️ POTONG DI SINI`) dan optimasi pemisahan halaman (`page-break`) agar tidak terpotong canggung di tengah slip.
- **Pratinjau & Unduh Slip Individu**:
  - Modal pratinjau slip yang rapi dan detail.
  - Tombol cetak slip individu atau unduh instan sebagai gambar PNG beresolusi tinggi.
- **Kirim Slip via WhatsApp**: Membuat gambar slip otomatis, menyalinnya ke clipboard, dan membuka WhatsApp Web secara langsung dengan pesan yang dipersonalisasi beserta tautan slip gaji online unik karyawan.
- **Kelola Data Bulanan (Clean-up)**: Memantau daftar periode bulan yang tersimpan di database dan menyediakan tombol hapus per bulan agar kapasitas database tidak cepat penuh.
- **Dua Mode Database**:
  - **Online Mode**: Integrasi dengan Supabase Auth dan Supabase Database.
  - **Offline/Local Demo Mode**: Jika kredensial Supabase kosong, aplikasi otomatis beralih ke penyimpanan lokal browser (`localStorage`) sehingga aplikasi tetap 100% fungsional tanpa server eksternal.
- **Manajemen Sesi Aman**: Dukungan opsi "Ingat Saya" (Remember Me) untuk menjaga sesi login tetap aktif (menggunakan `localStorage` vs `sessionStorage`).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite.
- **Database / Backend**: Supabase (PostgreSQL & Supabase Auth).
- **Styling**: Vanilla CSS dengan variabel CSS custom (desain premium bernuansa *glassmorphism* dan *clean-slate*).
- **Libraries**:
  - `xlsx` - Parser file Excel di sisi klien.
  - `html2canvas` - Mengonversi elemen DOM slip gaji menjadi file gambar PNG berkualitas tinggi.
  - `lucide-react` - Ikon modern dan konsisten.
  - `react-router-dom` - Navigasi rute admin dan tautan publik karyawan.

---

## 💻 Kredensial Login Demo (Mode Offline)

Apabila aplikasi berjalan pada **Mode Demo Offline (Penyimpanan Lokal)**, Anda dapat masuk menggunakan kredensial berikut:

- **Username/Email**: `admin@senndyt.com` (atau `admin`)
- **Password**: `palamana` atau `admin123`

---

## 📋 Panduan Format File Excel

Agar proses import berjalan dengan baik, pastikan file Excel penggajian memenuhi kriteria berikut:
1. Memiliki sheet yang mengandung kata **"LAPORAN"** atau **"GAJI"** (atau berada pada sheet pertama).
2. Memiliki kolom wajib pada baris header:
   * **NIK** (Nomor Induk Karyawan)
   * **Nama** (Nama Lengkap Karyawan)
   * **Total Gaji Bersih** (atau *Gaji Bersih* / *Bersih*)
   * *Jabatan* (Opsional, bawaan: KARYAWAN)
   * *WhatsApp* (Opsional, untuk nomor pengiriman)
   * *Rekening* (Opsional, nomor rekening transfer)
3. Baris metadata atas dapat menyertakan tulisan **"Tanggal Cetak"** atau **"Bulan"** untuk deteksi otomatis nama periode awal.

---

## ⚙️ Cara Menjalankan Project Secara Lokal

### 1. Kloning Repositori
```bash
git clone https://github.com/username-anda/s-fin.git
cd s-fin
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (Opsional)
Jika ingin menggunakan basis data cloud Supabase secara online, buat berkas `.env` di root direktori dengan kunci berikut:
```env
VITE_SUPABASE_URL=https://project-id-anda.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
*Skema database awal telah disediakan di file `supabase_schema.sql`.*

### 4. Jalankan Server Pengembang
```bash
npm run dev
```
Aplikasi Anda akan siap diakses di: [http://localhost:5173/](http://localhost:5173/)

### 5. Build Produksi
Untuk mengompilasi dan mengoptimalkan aset untuk siap dideploy:
```bash
npm run build
```

---

## 🌐 Penyebaran (Deployment)

Aplikasi ini siap dideploy ke platform cloud modern seperti **Vercel** atau **Netlify**. Konfigurasi rute Vercel untuk Single Page Application (SPA) telah disiapkan di file [vercel.json](vercel.json).
