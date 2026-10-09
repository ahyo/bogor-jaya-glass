// Cetak invoice & laporan
import { byId, getSettings } from './db.js';
import { esc, rp, fmtDate, fmtDateTime, addDays } from './utils.js';
import { paid, pegNama, kendaraanLabel, lineTotal } from './calc.js';

function doPrint(html) {
  const area = document.getElementById('print-area');
  area.innerHTML = html;
  const imgs = [...area.querySelectorAll('img')];
  Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => setTimeout(() => window.print(), 60));
}

function header(s) {
  return `<div class="inv-brand"><img src="assets/img/logo.svg" alt=""><div><h1>${esc(s.namaUsaha)}</h1>
    <div>${esc(s.alamat)}</div><div>Telp ${esc(s.telp)}${s.wa ? ' · WA ' + esc(s.wa) : ''}${s.email ? ' · ' + esc(s.email) : ''}</div>
    ${s.npwp ? `<div>NPWP: ${esc(s.npwp)}</div>` : ''}</div></div>`;
}

export function printInvoice(o) {
  const s = getSettings();
  const pel = byId('pelanggan', o.pelangganId) || {};
  const dibayar = paid(o);
  const k = o.kendaraan || {};
  doPrint(`<div class="invoice">
    <div class="inv-head">${header(s)}<div><h2>INVOICE</h2><div style="text-align:right;margin-top:6px"><b>${esc(o.no)}</b><br>Tanggal: ${fmtDate(o.tanggal)}<br>Status: ${esc(o.status)}</div></div></div>
    <div class="inv-meta">
      <div class="inv-box"><b>Ditagihkan kepada</b>${esc(pel.nama || '-')}<br>${esc(pel.alamat || '')}<br>${esc(pel.telp || '')}${pel.npwp ? '<br>NPWP: ' + esc(pel.npwp) : ''}</div>
      <div class="inv-box"><b>Kendaraan</b>${esc(k.plat || '-')} · ${esc(kendaraanLabel(k))} ${k.warna ? '(' + esc(k.warna) + ')' : ''}<br>
        Teknisi: ${esc((o.teknisiIds || []).map(pegNama).join(', ') || '-')}<br>
        ${o.status === 'Selesai' && o.garansiHari ? `Garansi s/d: <b style="display:inline;color:#0f172a;font-size:12px;letter-spacing:0;text-transform:none">${fmtDate(addDays(o.tglSelesai || o.tanggal, o.garansiHari))}</b>` : ''}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Barang / Jasa</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Diskon</th><th class="r">Jumlah</th></tr></thead>
      <tbody>${o.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.nama)}${it.kenaPajak && o.ppn ? ' <small>(BKP)</small>' : ''}</td><td class="r">${it.qty} ${esc(it.satuan || '')}</td><td class="r">${rp(it.harga)}</td><td class="r">${it.diskon ? rp(it.diskon) : '-'}</td><td class="r">${rp(lineTotal(it))}</td></tr>`).join('')}</tbody>
    </table>
    <table class="inv-total">
      <tr><td>Subtotal</td><td class="r">${rp(o.subtotal)}</td></tr>
      <tr><td>DPP</td><td class="r">${rp(o.dpp)}</td></tr>
      <tr><td>PPN</td><td class="r">${rp(o.ppn)}</td></tr>
      <tr class="g"><td>TOTAL</td><td class="r">${rp(o.total)}</td></tr>
      <tr><td>Dibayar</td><td class="r">${rp(dibayar)}</td></tr>
      <tr><td><b>Sisa Tagihan</b></td><td class="r"><b>${rp(Math.max(0, o.total - dibayar))}</b></td></tr>
    </table>
    ${(o.pembayaran || []).length ? `<div style="font-size:11px;color:#475569">Riwayat pembayaran: ${o.pembayaran.map((p) => `${fmtDate(p.tanggal)} ${esc(p.metode)} ${rp(p.jumlah)}`).join(' · ')}</div>` : ''}
    <div class="inv-foot">
      <div><b>Pembayaran:</b><br>${esc(s.rekening || '-')}<br><br><b>Catatan:</b><br>${esc(s.catatanInvoice || '')}</div>
      <div class="sign">Pelanggan<div class="line">${esc(pel.nama || '')}</div></div>
      <div class="sign">Hormat kami<div class="line">${esc(s.namaUsaha)}</div></div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:10.5px;margin-top:20px">Dicetak ${fmtDateTime(Date.now())}</p>
  </div>`);
}

export function printPembelian(p) {
  const s = getSettings();
  const sup = byId('supplier', p.supplierId) || {};
  doPrint(`<div class="invoice">
    <div class="inv-head">${header(s)}<div><h2>PEMBELIAN</h2><div style="text-align:right;margin-top:6px"><b>${esc(p.no)}</b><br>Tanggal: ${fmtDate(p.tanggal)}<br>Faktur: ${esc(p.noFaktur || '-')}</div></div></div>
    <div class="inv-box"><b>Supplier</b>${esc(sup.nama || '-')}<br>${esc(sup.alamat || '')} ${esc(sup.telp || '')}</div>
    <table><thead><tr><th>#</th><th>Barang</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead>
    <tbody>${p.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.nama)}</td><td class="r">${it.qty}</td><td class="r">${rp(it.harga)}</td><td class="r">${rp(lineTotal(it))}</td></tr>`).join('')}</tbody></table>
    <table class="inv-total"><tr><td>DPP</td><td class="r">${rp(p.dpp)}</td></tr><tr><td>PPN Masukan</td><td class="r">${rp(p.ppn)}</td></tr><tr class="g"><td>TOTAL</td><td class="r">${rp(p.total)}</td></tr><tr><td>Dibayar</td><td class="r">${rp(paid(p))}</td></tr></table>
  </div>`);
}

export function printReport(title, subtitle, html) {
  const s = getSettings();
  doPrint(`<div class="invoice print-report"><div class="inv-head">${header(s)}</div><h2>${esc(title)}</h2><p class="sub">${esc(subtitle)}</p>${html}</div>`);
}
