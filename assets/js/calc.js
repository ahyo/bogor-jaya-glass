// Logika bisnis: perhitungan pajak, stok, jurnal akuntansi
import { cache, byId, getSettings } from './db.js';
import { esc } from './utils.js';

export const COA = [
  { kode: '1101', nama: 'Kas', tipe: 'Aset' },
  { kode: '1102', nama: 'Bank', tipe: 'Aset' },
  { kode: '1103', nama: 'Piutang Usaha', tipe: 'Aset' },
  { kode: '1104', nama: 'Persediaan Barang', tipe: 'Aset' },
  { kode: '1105', nama: 'PPN Masukan', tipe: 'Aset' },
  { kode: '1201', nama: 'Peralatan & Perlengkapan', tipe: 'Aset' },
  { kode: '2101', nama: 'Hutang Usaha', tipe: 'Kewajiban' },
  { kode: '2102', nama: 'PPN Keluaran', tipe: 'Kewajiban' },
  { kode: '2103', nama: 'Hutang Pajak PPh', tipe: 'Kewajiban' },
  { kode: '2104', nama: 'Uang Muka Pelanggan', tipe: 'Kewajiban' },
  { kode: '3101', nama: 'Modal Pemilik', tipe: 'Modal' },
  { kode: '3102', nama: 'Prive', tipe: 'Modal' },
  { kode: '4101', nama: 'Penjualan Barang', tipe: 'Pendapatan' },
  { kode: '4102', nama: 'Pendapatan Jasa Pemasangan', tipe: 'Pendapatan' },
  { kode: '4201', nama: 'Pendapatan Lain-lain', tipe: 'Pendapatan' },
  { kode: '5101', nama: 'Harga Pokok Penjualan', tipe: 'HPP' },
  { kode: '6101', nama: 'Beban Gaji & Upah', tipe: 'Beban' },
  { kode: '6102', nama: 'Beban Sewa', tipe: 'Beban' },
  { kode: '6103', nama: 'Beban Listrik, Air & Internet', tipe: 'Beban' },
  { kode: '6104', nama: 'Beban Transportasi', tipe: 'Beban' },
  { kode: '6105', nama: 'Beban Perlengkapan Kerja', tipe: 'Beban' },
  { kode: '6106', nama: 'Beban Pajak (PPh Final)', tipe: 'Beban' },
  { kode: '6107', nama: 'Beban Pemasaran', tipe: 'Beban' },
  { kode: '6108', nama: 'Beban Komisi Teknisi', tipe: 'Beban' },
  { kode: '6109', nama: 'Beban Selisih & Kerusakan Persediaan', tipe: 'Beban' },
  { kode: '6199', nama: 'Beban Lain-lain', tipe: 'Beban' },
];
export const akunNama = (k) => COA.find((a) => a.kode === k)?.nama || k;
export const akunLabel = (k) => `${k} · ${akunNama(k)}`;
export const isDebitNormal = (k) => ['1', '5', '6'].includes(k[0]) || k === '3102';

export const KATEGORI = ['Kaca Depan', 'Kaca Belakang', 'Kaca Samping', 'Kaca Film', 'Bahan Pendukung', 'Aksesoris', 'Jasa'];
export const METODE = ['Tunai', 'Transfer Bank', 'QRIS', 'Kartu Debit/Kredit'];
export const akunMetode = (m) => (m === 'Tunai' ? '1101' : '1102');
export const STATUS = ['Baru', 'Dijadwalkan', 'Dikerjakan', 'Selesai', 'Batal'];
const STATUS_CLS = { Baru: 'b-gray', Dijadwalkan: 'b-blue', Dikerjakan: 'b-amber', Selesai: 'b-green', Batal: 'b-red' };
const STATUS_IC = { Baru: 'circle-dot', Dijadwalkan: 'calendar-clock', Dikerjakan: 'wrench', Selesai: 'check-circle-2', Batal: 'x-circle' };
export const statusBadge = (s) => `<span class="badge ${STATUS_CLS[s] || 'b-gray'}"><i data-lucide="${STATUS_IC[s] || 'circle'}"></i>${esc(s)}</span>`;
export const TAHAP = { before: { label: 'Before', cls: 'b-amber' }, proses: { label: 'Proses', cls: 'b-blue' }, after: { label: 'After', cls: 'b-green' } };
export const ppnBadge = () => '<span class="badge b-cyan" title="Barang Kena Pajak">PPN</span>';

// ---------- Perhitungan item & pajak ----------
export function calcItems(items) {
  const s = getSettings();
  const rate = s.pkp ? (+s.ppnRate || 0) / 100 : 0;
  const incl = !!s.ppnInclusive;
  let subtotal = 0, ppnRaw = 0, dppB = 0, hpp = 0, dppKP = 0;
  for (const it of items) {
    const gross = (+it.qty || 0) * (+it.harga || 0) - (+it.diskon || 0);
    subtotal += gross;
    let dpp = gross, tax = 0;
    if (it.kenaPajak && rate) {
      if (incl) { dpp = gross / (1 + rate); tax = gross - dpp; } else tax = gross * rate;
      dppKP += dpp;
    }
    ppnRaw += tax;
    if (it.jenis !== 'jasa') { dppB += dpp; hpp += (+it.qty || 0) * (+it.hpp || 0); }
  }
  const ppn = Math.round(ppnRaw);
  const total = Math.round(incl ? subtotal : subtotal + ppnRaw);
  const dpp = total - ppn;
  const dppBarang = Math.min(dpp, Math.round(dppB));
  return { subtotal: Math.round(subtotal), dpp, dppBarang, dppJasa: dpp - dppBarang, dppKenaPajak: Math.round(dppKP), ppn, total, hpp: Math.round(hpp), rate: rate * 100, incl };
}
export const lineTotal = (it) => (+it.qty || 0) * (+it.harga || 0) - (+it.diskon || 0);

// ---------- Pembayaran ----------
export const paid = (d) => (d.pembayaran || []).reduce((a, p) => a + (+p.jumlah || 0), 0);
export const sisa = (d) => Math.max(0, (d.total || 0) - paid(d));
export function payStatus(d) {
  const p = paid(d);
  if (d.total > 0 && p >= d.total) return { label: 'Lunas', cls: 'b-green' };
  if (p > 0) return { label: 'Sebagian', cls: 'b-amber' };
  return { label: 'Belum Bayar', cls: 'b-red' };
}
export const payBadge = (d) => { const s = payStatus(d); return `<span class="badge ${s.cls}">${s.label}</span>`; };

// ---------- Lookup ----------
export const pelNama = (id) => byId('pelanggan', id)?.nama || '-';
export const supNama = (id) => byId('supplier', id)?.nama || '-';
export const pegNama = (id) => byId('pegawai', id)?.nama || '-';
export const teknisiList = () => cache.pegawai.filter((p) => p.jabatan === 'Teknisi' && p.aktif !== false);
export const kendaraanLabel = (k = {}) => [k.merk, k.model, k.tahun].filter(Boolean).join(' ');

// ---------- Stok ----------
// Mutasi stok semua barang (urut tanggal). Penjualan mengurangi stok bila order tidak Batal.
export function stockMovements(barangId) {
  const s = getSettings();
  const mv = [];
  for (const b of cache.barang) {
    if (b.jenis === 'jasa' || (barangId && b.id !== barangId)) continue;
    if (+b.stokAwal) mv.push({ barangId: b.id, tanggal: s.tglMulai, sort: 0, no: 'SALDO AWAL', jenis: 'Stok Awal', masuk: +b.stokAwal, keluar: 0, ket: 'Stok awal', ref: null });
  }
  for (const p of cache.pembelian) {
    if (p.status === 'Batal') continue;
    for (const it of p.items) if (!barangId || it.barangId === barangId)
      mv.push({ barangId: it.barangId, tanggal: p.tanggal, sort: p.createdAt || 1, no: p.no, jenis: 'Pembelian', masuk: +it.qty, keluar: 0, harga: +it.harga, ket: supNama(p.supplierId), ref: `#/pembelian/${p.id}` });
  }
  for (const o of cache.orders) {
    if (o.status === 'Batal') continue;
    for (const it of o.items) if (it.jenis !== 'jasa' && (!barangId || it.barangId === barangId))
      mv.push({ barangId: it.barangId, tanggal: o.tanggal, sort: o.createdAt || 1, no: o.no, jenis: 'Penjualan', masuk: 0, keluar: +it.qty, harga: +it.harga, ket: `${pelNama(o.pelangganId)} · ${o.kendaraan?.plat || ''}`, ref: `#/orders/${o.id}` });
  }
  for (const a of cache.opname) {
    if (barangId && a.barangId !== barangId) continue;
    mv.push({ barangId: a.barangId, tanggal: a.tanggal, sort: a.createdAt || 1, no: a.no, jenis: a.jenis || 'Opname', masuk: a.selisih > 0 ? a.selisih : 0, keluar: a.selisih < 0 ? -a.selisih : 0, ket: a.keterangan || '', ref: null });
  }
  return mv.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : a.sort - b.sort));
}
export function stockMap(upTo) {
  const m = {};
  for (const b of cache.barang) if (b.jenis !== 'jasa') m[b.id] = 0;
  for (const x of stockMovements()) {
    if (upTo && x.tanggal > upTo) continue;
    m[x.barangId] = (m[x.barangId] || 0) + x.masuk - x.keluar;
  }
  return m;
}

// ---------- Jurnal (diturunkan otomatis dari transaksi) ----------
export function journal() {
  const s = getSettings();
  const J = [];
  const add = (tanggal, no, ket, ref, lines) => {
    lines = lines.map((l) => ({ akun: l.akun, d: Math.round(l.d || 0), k: Math.round(l.k || 0) })).filter((l) => l.d || l.k);
    if (lines.length) J.push({ tanggal, no, ket, ref, lines, auto: ref?.type !== 'jurnal' });
  };
  const persAwal = cache.barang.filter((b) => b.jenis !== 'jasa').reduce((a, b) => a + (+b.stokAwal || 0) * (+b.hargaBeli || 0), 0);
  if (persAwal) add(s.tglMulai, 'SALDO-AWAL', 'Saldo awal persediaan barang', { type: 'stok' }, [{ akun: '1104', d: persAwal }, { akun: '3101', k: persAwal }]);

  for (const j of cache.jurnal)
    add(j.tanggal, j.no, j.keterangan, { type: 'jurnal', id: j.id }, j.lines.map((l) => ({ akun: l.akun, d: +l.debit || 0, k: +l.kredit || 0 })));

  for (const p of cache.pembelian) {
    if (p.status === 'Batal') continue;
    const sup = supNama(p.supplierId);
    const ref = { type: 'pembelian', id: p.id };
    add(p.tanggal, p.no, `Pembelian dari ${sup}`, ref, [{ akun: '1104', d: p.dpp }, { akun: '1105', d: p.ppn }, { akun: '2101', k: p.total }]);
    for (const pay of p.pembayaran || []) add(pay.tanggal, p.no, `Pembayaran ke ${sup} (${pay.metode})`, ref, [{ akun: '2101', d: pay.jumlah }, { akun: akunMetode(pay.metode), k: pay.jumlah }]);
  }

  for (const o of cache.orders) {
    if (o.status === 'Batal') continue;
    const pel = pelNama(o.pelangganId);
    const done = o.status === 'Selesai';
    const ref = { type: 'order', id: o.id };
    const tgl = o.tglSelesai || o.tanggal;
    if (done) {
      add(tgl, o.no, `Penjualan ${pel} (${o.kendaraan?.plat || '-'})`, ref, [{ akun: '1103', d: o.total }, { akun: '4101', k: o.dppBarang }, { akun: '4102', k: o.dppJasa }, { akun: '2102', k: o.ppn }]);
      if (o.hpp) add(tgl, o.no, `HPP ${o.no}`, ref, [{ akun: '5101', d: o.hpp }, { akun: '1104', k: o.hpp }]);
    }
    for (const pay of o.pembayaran || [])
      add(pay.tanggal, o.no, `Penerimaan ${pel} (${pay.metode})`, ref, [{ akun: akunMetode(pay.metode), d: pay.jumlah }, { akun: done ? '1103' : '2104', k: pay.jumlah }]);
  }

  for (const t of cache.kas) {
    const kasAkun = t.akunKas || '1101';
    const ref = { type: 'kas', id: t.id };
    if (t.jenis === 'keluar') add(t.tanggal, t.no, t.keterangan, ref, [{ akun: t.akun, d: t.jumlah }, { akun: kasAkun, k: t.jumlah }]);
    else add(t.tanggal, t.no, t.keterangan, ref, [{ akun: kasAkun, d: t.jumlah }, { akun: t.akun, k: t.jumlah }]);
  }

  for (const a of cache.opname) {
    const nilai = Math.abs(a.selisih) * (+a.hpp || 0);
    if (!nilai) continue;
    const nama = byId('barang', a.barangId)?.nama || '';
    const ref = { type: 'opname', id: a.id };
    if (a.selisih < 0) add(a.tanggal, a.no, `${a.jenis}: ${nama}`, ref, [{ akun: '6109', d: nilai }, { akun: '1104', k: nilai }]);
    else add(a.tanggal, a.no, `${a.jenis}: ${nama}`, ref, [{ akun: '1104', d: nilai }, { akun: '6109', k: nilai }]);
  }
  return J.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));
}

// Saldo per akun (debit positif) dalam rentang tanggal
export function balances(from, to, J = journal()) {
  const b = {};
  for (const j of J) {
    if ((from && j.tanggal < from) || (to && j.tanggal > to)) continue;
    for (const l of j.lines) b[l.akun] = (b[l.akun] || 0) + l.d - l.k;
  }
  return b;
}
export const normalBal = (kode, raw) => (isDebitNormal(kode) ? raw : -raw) || 0;

export function refLink(ref) {
  if (!ref) return null;
  if (ref.type === 'order') return `#/orders/${ref.id}`;
  if (ref.type === 'pembelian') return `#/pembelian/${ref.id}`;
  return null;
}

// Jumlah order aktif (untuk badge menu)
export const activeOrders = () => cache.orders.filter((o) => ['Baru', 'Dijadwalkan', 'Dikerjakan'].includes(o.status));
