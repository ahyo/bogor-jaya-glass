// Data awal & data demo
import { cache, save, idb, DATA_STORES } from './db.js';
import { calcItems } from './calc.js';
import { todayStr, addDays, uid } from './utils.js';

export function defaultSettings() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6, 1);
  return {
    id: 'app',
    namaUsaha: 'BOGOR JAYA GLASS',
    tagline: 'Spesialis Kaca Mobil & Kaca Film',
    alamat: 'Jl. Raya Pajajaran No. 88, Bogor, Jawa Barat',
    telp: '0251-8300000',
    wa: '081234567890',
    email: 'admin@bogorjayaglass.com',
    npwp: '01.234.567.8-404.000',
    rekening: 'BCA 123-456-7890 a.n. Bogor Jaya Glass',
    pkp: true,
    ppnRate: 11,
    ppnInclusive: false,
    pphFinal: true,
    pphFinalRate: 0.5,
    wajibFoto: true,
    garansiHari: 180,
    tglMulai: todayStr(d),
    catatanInvoice: 'Garansi berlaku untuk kebocoran & pemasangan sesuai masa garansi. Kerusakan akibat benturan/kecelakaan tidak termasuk garansi.',
  };
}

export async function seedIfEmpty() {
  if (cache.settings.length) return false;
  await seedDemo();
  return true;
}

const plain = { log: false };

export async function seedBlank() {
  await save('settings', defaultSettings(), plain);
  await save('users', { id: 'u-admin', nama: 'Administrator', username: 'admin', pin: '1234', role: 'admin', aktif: true }, plain);
}

export async function clearAll() {
  for (const s of [...DATA_STORES, 'media']) await idb.clear(s);
  for (const s of DATA_STORES) cache[s] = [];
}

export async function seedDemo() {
  const st = defaultSettings();
  await save('settings', st, plain);

  const pegawai = [
    { id: 'p1', nama: 'Budi Santoso', jabatan: 'Teknisi', telp: '081311110001', gaji: 4200000, tglMasuk: '2021-03-01', aktif: true },
    { id: 'p2', nama: 'Agus Prasetyo', jabatan: 'Teknisi', telp: '081311110002', gaji: 4000000, tglMasuk: '2022-07-15', aktif: true },
    { id: 'p3', nama: 'Dedi Kurniawan', jabatan: 'Teknisi', telp: '081311110003', gaji: 3800000, tglMasuk: '2023-02-01', aktif: true },
    { id: 'p4', nama: 'Siti Rahmawati', jabatan: 'Kasir', telp: '081311110004', gaji: 3500000, tglMasuk: '2022-01-10', aktif: true },
  ];
  for (const p of pegawai) await save('pegawai', p, plain);

  const users = [
    { id: 'u-admin', nama: 'Pemilik Usaha', username: 'admin', pin: '1234', role: 'admin', aktif: true },
    { id: 'u-kasir', nama: 'Siti Rahmawati', username: 'kasir', pin: '1234', role: 'kasir', pegawaiId: 'p4', aktif: true },
    { id: 'u-budi', nama: 'Budi Santoso', username: 'budi', pin: '1234', role: 'teknisi', pegawaiId: 'p1', aktif: true },
    { id: 'u-agus', nama: 'Agus Prasetyo', username: 'agus', pin: '1234', role: 'teknisi', pegawaiId: 'p2', aktif: true },
  ];
  for (const u of users) await save('users', u, plain);

  const B = (kode, nama, jenis, kategori, merkMobil, satuan, hargaBeli, hargaJual, stokAwal, stokMin, kenaPajak) =>
    ({ id: 'b-' + kode.toLowerCase(), kode, nama, jenis, kategori, merkMobil, satuan, hargaBeli, hargaJual, stokAwal, stokMin, kenaPajak, aktif: true });
  const barang = [
    B('KD-AVZ', 'Kaca Depan Avanza/Xenia Laminated', 'barang', 'Kaca Depan', 'Toyota Avanza / Daihatsu Xenia 2012–2021', 'pcs', 950000, 1450000, 6, 2, true),
    B('KD-INV', 'Kaca Depan Innova Reborn Laminated', 'barang', 'Kaca Depan', 'Toyota Kijang Innova Reborn 2016+', 'pcs', 1650000, 2350000, 4, 2, true),
    B('KD-BRIO', 'Kaca Depan Honda Brio Laminated', 'barang', 'Kaca Depan', 'Honda Brio / Brio RS 2018+', 'pcs', 850000, 1300000, 5, 2, true),
    B('KD-ERT', 'Kaca Depan Suzuki Ertiga', 'barang', 'Kaca Depan', 'Suzuki Ertiga 2018+', 'pcs', 1000000, 1500000, 3, 2, true),
    B('KD-XPD', 'Kaca Depan Mitsubishi Xpander', 'barang', 'Kaca Depan', 'Mitsubishi Xpander / Cross', 'pcs', 1250000, 1850000, 2, 2, true),
    B('KS-AVZ', 'Kaca Samping Depan Avanza (Kanan/Kiri)', 'barang', 'Kaca Samping', 'Toyota Avanza / Daihatsu Xenia', 'pcs', 350000, 600000, 8, 3, true),
    B('KB-AVZ', 'Kaca Belakang Avanza + Defogger', 'barang', 'Kaca Belakang', 'Toyota Avanza / Daihatsu Xenia', 'pcs', 700000, 1100000, 3, 1, true),
    B('KF-PRM', 'Kaca Film Premium Nano Ceramic (1 mobil)', 'barang', 'Kaca Film', 'Semua tipe (MPV/SUV)', 'set', 1500000, 2500000, 5, 2, true),
    B('KF-STD', 'Kaca Film Standar (1 mobil)', 'barang', 'Kaca Film', 'Semua tipe', 'set', 400000, 750000, 10, 3, false),
    B('SL-URE', 'Lem Urethane Sealant 310ml', 'barang', 'Bahan Pendukung', 'Universal', 'tube', 85000, 150000, 40, 10, false),
    B('KR-MLD', 'Karet Moulding Kaca Depan', 'barang', 'Bahan Pendukung', 'Universal', 'meter', 60000, 120000, 25, 5, false),
    B('JS-PKD', 'Jasa Pasang Kaca Depan', 'jasa', 'Jasa', '', 'unit', 0, 350000, 0, 0, true),
    B('JS-PKS', 'Jasa Pasang Kaca Samping/Belakang', 'jasa', 'Jasa', '', 'unit', 0, 200000, 0, 0, true),
    B('JS-FLM', 'Jasa Pasang Kaca Film', 'jasa', 'Jasa', '', 'unit', 0, 250000, 0, 0, true),
    B('JS-REP', 'Jasa Repair Retak Kaca (Resin)', 'jasa', 'Jasa', '', 'titik', 0, 250000, 0, 0, true),
    B('JS-HS', 'Biaya Home Service', 'jasa', 'Jasa', '', 'kali', 0, 100000, 0, 0, false),
  ];
  for (const b of barang) await save('barang', b, plain);
  const bk = Object.fromEntries(barang.map((b) => [b.kode, b]));

  const pelanggan = [
    { id: 'c1', nama: 'Hendra Wijaya', tipe: 'Perorangan', telp: '081298765001', alamat: 'Perum Bogor Nirwana Residence, Bogor', email: '' },
    { id: 'c2', nama: 'Lestari Puspitasari', tipe: 'Perorangan', telp: '081298765002', alamat: 'Jl. Pandu Raya No. 21, Bogor', email: '' },
    { id: 'c3', nama: 'PT Sinar Logistik Bogor', tipe: 'Perusahaan', telp: '0251-8311122', alamat: 'Kawasan Industri Sentul, Bogor', email: 'fleet@sinarlogistik.co.id', npwp: '02.345.678.9-404.000' },
    { id: 'c4', nama: 'PT Asuransi Mitra Proteksi', tipe: 'Asuransi', telp: '021-5551234', alamat: 'Jl. Sudirman Kav. 10, Jakarta', email: 'klaim@mitraproteksi.co.id', npwp: '03.456.789.0-012.000' },
    { id: 'c5', nama: 'Andi Saputra', tipe: 'Perorangan', telp: '081298765005', alamat: 'Cibinong, Kab. Bogor', email: '' },
    { id: 'c6', nama: 'Dewi Anggraini', tipe: 'Perorangan', telp: '081298765006', alamat: 'Jl. Tajur No. 5, Bogor', email: '' },
  ];
  for (const c of pelanggan) await save('pelanggan', c, plain);

  const supplier = [
    { id: 's1', nama: 'CV Kaca Prima Jakarta', kontak: 'Bpk. Hartono', telp: '021-6251234', alamat: 'Jl. Gunung Sahari, Jakarta', npwp: '04.111.222.3-021.000', pkp: true },
    { id: 's2', nama: 'PT Autoglass Nusantara', kontak: 'Ibu Melati', telp: '021-4601234', alamat: 'Cikarang, Bekasi', npwp: '05.222.333.4-431.000', pkp: true },
    { id: 's3', nama: 'Toko Bahan Kaca Sentosa', kontak: 'Koh Ahong', telp: '0251-8321234', alamat: 'Pasar Anyar, Bogor', pkp: false },
  ];
  for (const s of supplier) await save('supplier', s, plain);

  // Saldo awal
  await save('jurnal', {
    id: 'j-saldo', no: 'JU-SALDO', tanggal: st.tglMulai, keterangan: 'Saldo awal usaha',
    lines: [{ akun: '1101', debit: 15000000, kredit: 0 }, { akun: '1102', debit: 85000000, kredit: 0 }, { akun: '1201', debit: 25000000, kredit: 0 }, { akun: '3101', debit: 0, kredit: 125000000 }],
  }, plain);

  const T = todayStr();
  const ago = (n) => addDays(T, -n);
  const it = (kode, qty = 1) => { const b = bk[kode]; return { barangId: b.id, nama: b.nama, satuan: b.satuan, qty, harga: b.hargaJual, diskon: 0, kenaPajak: b.kenaPajak, jenis: b.jenis, hpp: b.hargaBeli }; };
  const pit = (kode, qty, harga) => { const b = bk[kode]; return { barangId: b.id, nama: b.nama, satuan: b.satuan, qty, harga: harga ?? b.hargaBeli, diskon: 0, kenaPajak: b.kenaPajak, jenis: 'barang' }; };

  // Pembelian
  const pemb = [
    { tgl: ago(150), sup: 's1', items: [pit('KD-AVZ', 6), pit('KD-BRIO', 4)], metode: 'Transfer Bank' },
    { tgl: ago(95), sup: 's2', items: [pit('KD-INV', 3), pit('KD-XPD', 3), pit('KF-PRM', 4)], metode: 'Transfer Bank' },
    { tgl: ago(60), sup: 's3', items: [pit('SL-URE', 30), pit('KR-MLD', 20), pit('KF-STD', 6)], metode: 'Tunai' },
    { tgl: ago(20), sup: 's1', items: [pit('KD-AVZ', 5), pit('KS-AVZ', 6), pit('KB-AVZ', 2)], metode: 'Hutang' },
  ];
  for (const p of pemb) {
    const c = calcItems(p.items);
    const doc = {
      id: uid(), no: nextNoLocal('pembelian', 'PB', p.tgl), tanggal: p.tgl, supplierId: p.sup, noFaktur: 'INV/' + Math.floor(Math.random() * 90000 + 10000),
      items: p.items, ...c, status: 'Aktif', catatan: '',
      pembayaran: p.metode === 'Hutang' ? [] : [{ id: uid(), tanggal: p.tgl, jumlah: c.total, metode: p.metode, oleh: 'Pemilik Usaha' }],
      jatuhTempo: p.metode === 'Hutang' ? addDays(p.tgl, 30) : '',
    };
    await save('pembelian', doc, plain);
  }

  // Order / pemasangan
  const O = [
    [170, 'c1', { plat: 'F 1234 AB', merk: 'Toyota', model: 'Avanza', tahun: '2019', warna: 'Silver' }, [it('KD-AVZ'), it('JS-PKD'), it('SL-URE')], ['p1'], 'Selesai', 'Transfer Bank'],
    [160, 'c3', { plat: 'B 9012 SLB', merk: 'Toyota', model: 'Innova Reborn', tahun: '2020', warna: 'Hitam' }, [it('KD-INV'), it('JS-PKD'), it('SL-URE')], ['p1', 'p2'], 'Selesai', 'Transfer Bank'],
    [140, 'c2', { plat: 'F 7788 LP', merk: 'Honda', model: 'Brio RS', tahun: '2021', warna: 'Merah' }, [it('KF-PRM'), it('JS-FLM')], ['p2'], 'Selesai', 'QRIS'],
    [120, 'c4', { plat: 'B 2345 KLM', merk: 'Honda', model: 'Brio', tahun: '2020', warna: 'Putih' }, [it('KD-BRIO'), it('JS-PKD'), it('SL-URE')], ['p3'], 'Selesai', 'Transfer Bank'],
    [100, 'c5', { plat: 'F 4567 CD', merk: 'Toyota', model: 'Avanza', tahun: '2017', warna: 'Hitam' }, [it('KS-AVZ'), it('JS-PKS')], ['p1'], 'Selesai', 'Tunai'],
    [85, 'c6', { plat: 'F 1122 DW', merk: 'Suzuki', model: 'Ertiga', tahun: '2022', warna: 'Abu-abu' }, [it('KD-ERT'), it('JS-PKD'), it('SL-URE'), it('JS-HS')], ['p2'], 'Selesai', 'Tunai'],
    [70, 'c3', { plat: 'B 9013 SLB', merk: 'Mitsubishi', model: 'Xpander', tahun: '2021', warna: 'Putih' }, [it('KD-XPD'), it('JS-PKD'), it('SL-URE')], ['p1', 'p3'], 'Selesai', 'Transfer Bank'],
    [55, 'c1', { plat: 'F 1234 AB', merk: 'Toyota', model: 'Avanza', tahun: '2019', warna: 'Silver' }, [it('KF-STD'), it('JS-FLM')], ['p3'], 'Selesai', 'Tunai'],
    [40, 'c4', { plat: 'B 3456 MNO', merk: 'Toyota', model: 'Avanza', tahun: '2018', warna: 'Hitam' }, [it('KB-AVZ'), it('JS-PKS')], ['p2'], 'Selesai', 'Transfer Bank'],
    [28, 'c2', { plat: 'F 7788 LP', merk: 'Honda', model: 'Brio RS', tahun: '2021', warna: 'Merah' }, [it('JS-REP', 2)], ['p1'], 'Selesai', 'QRIS'],
    [14, 'c5', { plat: 'F 9900 AS', merk: 'Toyota', model: 'Innova Reborn', tahun: '2018', warna: 'Silver' }, [it('KD-INV'), it('JS-PKD'), it('SL-URE'), it('KR-MLD', 2)], ['p1', 'p2'], 'Selesai', 'Kartu Debit/Kredit'],
    [8, 'c6', { plat: 'F 1122 DW', merk: 'Suzuki', model: 'Ertiga', tahun: '2022', warna: 'Abu-abu' }, [it('KF-PRM'), it('JS-FLM')], ['p3'], 'Selesai', 'Sebagian'],
    [3, 'c3', { plat: 'B 9014 SLB', merk: 'Toyota', model: 'Avanza', tahun: '2022', warna: 'Putih' }, [it('KD-AVZ'), it('JS-PKD'), it('SL-URE')], ['p1'], 'Selesai', 'Belum'],
    [1, 'c1', { plat: 'F 5555 HW', merk: 'Mitsubishi', model: 'Xpander Cross', tahun: '2023', warna: 'Hitam' }, [it('KD-XPD'), it('JS-PKD'), it('SL-URE')], ['p1'], 'Dikerjakan', 'DP'],
    [0, 'c2', { plat: 'F 3210 LS', merk: 'Toyota', model: 'Avanza', tahun: '2020', warna: 'Putih' }, [it('KS-AVZ', 2), it('JS-PKS', 2)], ['p2'], 'Dijadwalkan', 'DP'],
    [0, 'c5', { plat: 'F 8080 AN', merk: 'Honda', model: 'Brio', tahun: '2019', warna: 'Kuning' }, [it('JS-REP')], [], 'Baru', 'Belum'],
  ];
  for (const [n, pel, kendaraan, items, tek, status, bayar] of O) {
    const tgl = ago(n);
    const c = calcItems(items);
    const jadwalD = status === 'Dijadwalkan' ? new Date() : new Date(tgl + 'T09:00:00');
    if (status === 'Dijadwalkan') jadwalD.setHours(14, 0, 0, 0);
    const jadwal = tek.length ? `${todayStr(jadwalD)}T${String(jadwalD.getHours()).padStart(2, '0')}:00` : '';
    const pembayaran = [];
    if (['Transfer Bank', 'Tunai', 'QRIS', 'Kartu Debit/Kredit'].includes(bayar)) pembayaran.push({ id: uid(), tanggal: tgl, jumlah: c.total, metode: bayar, oleh: 'Siti Rahmawati' });
    if (bayar === 'Sebagian' || bayar === 'DP') pembayaran.push({ id: uid(), tanggal: tgl, jumlah: Math.round(c.total * 0.5 / 1000) * 1000, metode: 'Transfer Bank', oleh: 'Siti Rahmawati', catatan: 'Uang muka' });
    const timeline = [{ waktu: new Date(tgl + 'T08:30:00').getTime(), status: 'Dibuat', oleh: 'Siti Rahmawati' }];
    if (tek.length) timeline.push({ waktu: new Date(tgl + 'T08:35:00').getTime(), status: 'Dijadwalkan', oleh: 'Siti Rahmawati' });
    if (['Dikerjakan', 'Selesai'].includes(status)) timeline.push({ waktu: new Date(tgl + 'T09:05:00').getTime(), status: 'Dikerjakan', oleh: pegNamaLocal(tek[0]) });
    if (status === 'Selesai') timeline.push({ waktu: new Date(tgl + 'T12:40:00').getTime(), status: 'Selesai', oleh: pegNamaLocal(tek[0]) });
    await save('orders', {
      id: uid(), no: nextNoLocal('orders', 'WO', tgl), tanggal: tgl, pelangganId: pel, kendaraan, items, ...c,
      teknisiIds: tek, jadwal, status, lokasi: 'Workshop', keluhan: '', catatan: '', garansiHari: st.garansiHari,
      tglSelesai: status === 'Selesai' ? tgl : '', pembayaran, timeline, mediaCount: { before: 0, proses: 0, after: 0 },
      createdAt: new Date(tgl + 'T08:30:00').getTime(),
    }, plain);
  }

  const kas = [
    [175, 'keluar', '6102', '1102', 6000000, 'Sewa ruko 6 bulan (bulan pertama)'],
    [150, 'keluar', '6101', '1102', 15500000, 'Gaji karyawan'],
    [120, 'keluar', '6101', '1102', 15500000, 'Gaji karyawan'],
    [90, 'keluar', '6101', '1102', 15500000, 'Gaji karyawan'],
    [60, 'keluar', '6101', '1102', 15500000, 'Gaji karyawan'],
    [30, 'keluar', '6101', '1102', 15500000, 'Gaji karyawan'],
    [45, 'keluar', '6103', '1101', 850000, 'Listrik & internet bengkel'],
    [15, 'keluar', '6103', '1101', 920000, 'Listrik & internet bengkel'],
    [33, 'keluar', '6107', '1101', 500000, 'Iklan media sosial'],
    [10, 'keluar', '6105', '1101', 375000, 'Sarung tangan, cutter, suction cup'],
  ];
  for (const [n, jenis, akun, akunKas, jumlah, ket] of kas) {
    const tgl = ago(n);
    await save('kas', { id: uid(), no: nextNoLocal('kas', jenis === 'keluar' ? 'BK' : 'BM', tgl), tanggal: tgl, jenis, akun, akunKas, jumlah, keterangan: ket }, plain);
  }
  return true;

  function nextNoLocal(store, prefix, tanggal) {
    const d = new Date(tanggal);
    const base = `${prefix}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
    let max = 0;
    for (const x of cache[store]) if (x.no?.startsWith(base)) max = Math.max(max, +x.no.slice(base.length));
    return base + String(max + 1).padStart(4, '0');
  }
  function pegNamaLocal(id) { return pegawai.find((p) => p.id === id)?.nama || 'Teknisi'; }
}
