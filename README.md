# Bogor Jaya Glass — Sistem Manajemen Kaca Mobil

Aplikasi web untuk mengelola penjualan & pemasangan kaca mobil: order, dokumentasi foto/video before–after oleh teknisi, stok, pembelian, akuntansi, dan pajak.

## Fitur
- **Order & Pemasangan** — data pelanggan & kendaraan, item barang/jasa, jadwal, penugasan teknisi, alur status (Baru → Dijadwalkan → Dikerjakan → Selesai), pembayaran/DP, invoice cetak, kirim WhatsApp.
- **Dokumentasi** — upload foto/video *Before / Proses / After* (foto otomatis dikompres + cap waktu & nomor order), slider pembanding before/after, wajib dokumentasi sebelum selesai (bisa diatur).
- **Tugas Teknisi** — tampilan khusus teknisi yang nyaman di HP.
- **Pembelian** — dari supplier, tunai/kredit, pembayaran hutang, update HPP.
- **Persediaan** — laporan stok per periode, kartu stok (history mutasi per barang), stok opname & barang rusak.
- **Master** — barang & jasa (penanda **Kena Pajak/PPN**), pelanggan, supplier, pegawai, dengan riwayat transaksi masing-masing.
- **Keuangan** — kas & biaya, jurnal umum otomatis (double-entry), buku besar, laba rugi, neraca.
- **Pajak** — rekap PPN Keluaran/Masukan per masa, PPh Final UMKM, pencatatan setoran, rincian faktur.
- **Laporan** — penjualan, produk terlaris, kinerja teknisi, pelanggan, umur piutang. Export CSV & cetak.
- **Pencarian global** (tekan `/`) & **Riwayat Aktivitas** (audit log semua perubahan).
- Hak akses: Admin, Kasir, Teknisi. Tema terang/gelap. Backup & restore.

## Akun demo
PIN semua `1234`: `admin` (pemilik), `kasir`, `budi` / `agus` (teknisi).

## Teknis
Aplikasi statis (HTML + CSS + JavaScript ES modules, tanpa build), cocok untuk GitHub Pages.
Data disimpan di **IndexedDB browser** pada perangkat masing-masing — lakukan backup rutin dari menu *Pengaturan → Data & Backup*.
Untuk berbagi data antar perangkat (kasir & HP teknisi) secara real-time, langkah berikutnya adalah menghubungkan ke backend (mis. Supabase/Firebase).

Jalankan lokal: `python3 -m http.server` lalu buka `http://localhost:8000`.
