import { cache, getSettings } from '../db.js';
import { rp, esc, todayStr, fmtDate, BULAN, options, exportCSV, emptyState, toast } from '../utils.js';
import { pelNama, supNama } from '../calc.js';
import { state } from '../state.js';
import { jurnalDialog } from './keuangan.js';
import { printReport } from '../print.js';

let year = new Date().getFullYear();
let detailMonth = todayStr().slice(0, 7);

export function render(root) {
  const s = getSettings();
  const years = [...new Set([new Date().getFullYear(), ...cache.orders.map((o) => +o.tanggal.slice(0, 4))])].sort((a, b) => b - a);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const data = months.map((m) => {
    const sales = cache.orders.filter((o) => o.status === 'Selesai' && (o.tglSelesai || o.tanggal).startsWith(m));
    const buys = cache.pembelian.filter((p) => p.status !== 'Batal' && p.tanggal.startsWith(m));
    const omzet = sales.reduce((a, o) => a + o.dpp, 0);
    const keluaran = sales.reduce((a, o) => a + o.ppn, 0);
    const masukan = buys.reduce((a, p) => a + p.ppn, 0);
    const pph = s.pphFinal ? Math.round((omzet * (+s.pphFinalRate || 0)) / 100) : 0;
    const setorPPN = cache.jurnal.find((j) => j.tag === `PPN-${m}`);
    const setorPPh = cache.jurnal.find((j) => j.tag === `PPH-${m}`);
    return { m, omzet, keluaran, masukan, net: keluaran - masukan, pph, setorPPN, setorPPh, nSales: sales.length };
  });
  const tot = (k) => data.reduce((a, x) => a + x[k], 0);
  const cur = data.find((d) => d.m === todayStr().slice(0, 7));

  root.innerHTML = `
  <div class="page-header">
    <div><h1>Pajak</h1><p>Rekap PPN Keluaran/Masukan dan PPh Final UMKM per masa pajak.</p></div>
    <div class="actions"><select id="year" style="width:auto">${options(years, year)}</select>
      <button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button></div>
  </div>
  <div class="alert alert-info"><i data-lucide="info"></i><div>
    Status: <b>${s.pkp ? `PKP · PPN ${s.ppnRate}% ${s.ppnInclusive ? '(harga termasuk PPN)' : '(ditambahkan ke harga)'}` : 'Non-PKP (PPN tidak dipungut)'}</b>
    ${s.pphFinal ? ` · PPh Final ${s.pphFinalRate}% dari omzet` : ''} · NPWP ${esc(s.npwp || '-')}.
    PPN dihitung hanya untuk barang/jasa yang ditandai <span class="badge b-cyan">PPN</span> di master barang. <a href="#/pengaturan">Ubah pengaturan pajak</a>
  </div></div>
  <div class="kpis">
    <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="trending-up"></i></div><div><div class="label">Omzet Bulan Ini (DPP)</div><div class="value">${rp(cur?.omzet)}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-amber"><i data-lucide="arrow-up-right"></i></div><div><div class="label">PPN Keluaran Bulan Ini</div><div class="value">${rp(cur?.keluaran)}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-cyan"><i data-lucide="arrow-down-left"></i></div><div><div class="label">PPN Masukan Bulan Ini</div><div class="value">${rp(cur?.masukan)}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ${cur?.net > 0 ? 'ic-red' : 'ic-green'}"><i data-lucide="scale"></i></div><div><div class="label">PPN ${cur?.net > 0 ? 'Kurang' : 'Lebih'} Bayar</div><div class="value">${rp(Math.abs(cur?.net || 0))}</div><div class="sub">PPh Final: ${rp(cur?.pph)}</div></div></div>
  </div>
  <div class="card">
    <div class="card-header"><h3><i data-lucide="calendar-range"></i> Rekap Masa Pajak ${year}</h3></div>
    <div class="table-wrap" id="rekap"></div>
  </div>
  <div class="card">
    <div class="card-header"><h3><i data-lucide="file-text"></i> Rincian Faktur</h3><input type="month" id="dm" value="${detailMonth}" style="width:auto"></div>
    <div class="grid grid-2" style="padding:20px" id="detail"></div>
  </div>`;

  const rekapHTML = () => `<table class="table"><thead><tr><th>Masa</th><th class="r">Transaksi</th><th class="r">Omzet (DPP)</th><th class="r">PPN Keluaran</th><th class="r">PPN Masukan</th><th class="r">PPN Kurang/(Lebih) Bayar</th><th>Setor PPN</th>${s.pphFinal ? '<th class="r">PPh Final</th><th>Setor PPh</th>' : ''}</tr></thead>
    <tbody>${data.map((d) => `<tr><td class="strong">${BULAN[+d.m.slice(5) - 1]}</td><td class="r">${d.nSales}</td><td class="r">${rp(d.omzet)}</td><td class="r">${rp(d.keluaran)}</td><td class="r">${rp(d.masukan)}</td>
      <td class="r strong ${d.net > 0 ? 'text-danger' : d.net < 0 ? 'text-success' : ''}">${d.net < 0 ? `(${rp(-d.net)})` : rp(d.net)}</td>
      <td>${d.setorPPN ? `<span class="badge b-green"><i data-lucide="check"></i> ${fmtDate(d.setorPPN.tanggal)}</span>` : d.keluaran || d.masukan ? (d.m < todayStr().slice(0, 7) ? `<button class="btn btn-soft btn-sm" data-setor="PPN" data-m="${d.m}">${d.net > 0 ? 'Catat Setor' : 'Kompensasi'}</button>` : '<span class="muted small">Berjalan</span>') : '<span class="muted">-</span>'}</td>
      ${s.pphFinal ? `<td class="r">${rp(d.pph)}</td><td>${d.setorPPh ? `<span class="badge b-green"><i data-lucide="check"></i> ${fmtDate(d.setorPPh.tanggal)}</span>` : d.pph ? (d.m < todayStr().slice(0, 7) ? `<button class="btn btn-soft btn-sm" data-setor="PPH" data-m="${d.m}">Catat Setor</button>` : '<span class="muted small">Berjalan</span>') : '<span class="muted">-</span>'}</td>` : ''}</tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td><td class="r">${tot('nSales')}</td><td class="r">${rp(tot('omzet'))}</td><td class="r">${rp(tot('keluaran'))}</td><td class="r">${rp(tot('masukan'))}</td><td class="r">${rp(tot('net'))}</td><td></td>${s.pphFinal ? `<td class="r">${rp(tot('pph'))}</td><td></td>` : ''}</tr></tfoot></table>`;
  root.querySelector('#rekap').innerHTML = rekapHTML();

  const drawDetail = () => {
    const m = detailMonth;
    const sales = cache.orders.filter((o) => o.status === 'Selesai' && (o.tglSelesai || o.tanggal).startsWith(m) && o.ppn > 0);
    const buys = cache.pembelian.filter((p) => p.status !== 'Batal' && p.tanggal.startsWith(m) && p.ppn > 0);
    root.querySelector('#detail').innerHTML = `
      <div><h4 class="mb-2">PPN Keluaran (Penjualan)</h4>${sales.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>No</th><th>Pelanggan</th><th class="r">DPP BKP</th><th class="r">PPN</th></tr></thead><tbody>
        ${sales.map((o) => `<tr class="clickable" data-href="#/orders/${o.id}"><td class="mono">${esc(o.no)}</td><td>${esc(pelNama(o.pelangganId))}</td><td class="r">${rp(o.dppKenaPajak ?? o.dpp)}</td><td class="r strong">${rp(o.ppn)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="r">${rp(sales.reduce((a, o) => a + o.ppn, 0))}</td></tr></tfoot></table></div>` : emptyState('file', 'Tidak ada')}</div>
      <div><h4 class="mb-2">PPN Masukan (Pembelian)</h4>${buys.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>No</th><th>Supplier</th><th>Faktur</th><th class="r">PPN</th></tr></thead><tbody>
        ${buys.map((p) => `<tr class="clickable" data-href="#/pembelian/${p.id}"><td class="mono">${esc(p.no)}</td><td>${esc(supNama(p.supplierId))}</td><td>${esc(p.noFaktur || '-')}</td><td class="r strong">${rp(p.ppn)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="r">${rp(buys.reduce((a, p) => a + p.ppn, 0))}</td></tr></tfoot></table></div>` : emptyState('file', 'Tidak ada')}</div>`;
    window.lucide?.createIcons();
  };
  drawDetail();

  root.querySelector('#year').addEventListener('change', (e) => { year = +e.target.value; state.rerender(); });
  root.querySelector('#dm').addEventListener('change', (e) => { detailMonth = e.target.value; drawDetail(); });
  root.addEventListener('click', (e) => {
    const h = e.target.closest('[data-href]');
    if (h) location.hash = h.dataset.href;
    const st = e.target.closest('[data-setor]');
    if (st) {
      const d = data.find((x) => x.m === st.dataset.m);
      const label = `${BULAN[+d.m.slice(5) - 1]} ${d.m.slice(0, 4)}`;
      if (st.dataset.setor === 'PPN') {
        // Tutup PPN Keluaran & Masukan; kurang bayar disetor dari bank, lebih bayar menjadi kompensasi (tetap di PPN Masukan)
        const lines = [{ akun: '2102', debit: d.keluaran, kredit: 0 }];
        if (d.net > 0) lines.push({ akun: '1105', debit: 0, kredit: d.masukan }, { akun: '1102', debit: 0, kredit: d.net });
        else lines.push({ akun: '1105', debit: 0, kredit: d.keluaran });
        jurnalDialog(() => state.rerender(), { tanggal: todayStr(), keterangan: d.net > 0 ? `Setor PPN masa ${label}` : `Kompensasi PPN masa ${label}`, tag: `PPN-${d.m}`, lines: lines.filter((l) => l.debit || l.kredit) });
      } else {
        jurnalDialog(() => state.rerender(), { tanggal: todayStr(), keterangan: `Setor PPh Final masa ${label}`, tag: `PPH-${d.m}`, lines: [{ akun: '6106', debit: d.pph, kredit: 0 }, { akun: '1102', debit: 0, kredit: d.pph }] });
      }
      toast('Periksa jurnal lalu simpan', 'info');
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'csv') exportCSV(`rekap-pajak-${year}.csv`, [['Masa', 'Transaksi', 'Omzet DPP', 'PPN Keluaran', 'PPN Masukan', 'PPN Kurang(Lebih) Bayar', 'PPh Final', 'Setor PPN', 'Setor PPh'],
      ...data.map((d) => [d.m, d.nSales, d.omzet, d.keluaran, d.masukan, d.net, d.pph, d.setorPPN?.tanggal || '', d.setorPPh?.tanggal || ''])]);
    if (act === 'print') printReport('REKAP PAJAK', `Tahun ${year}`, rekapHTML());
  });
}
