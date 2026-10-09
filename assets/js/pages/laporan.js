import { cache } from '../db.js';
import { rp, num, esc, todayStr, fmtDate, exportCSV, emptyState } from '../utils.js';
import { pelNama, pegNama, kendaraanLabel, paid, lineTotal } from '../calc.js';
import { state } from '../state.js';
import { printReport } from '../print.js';

const P = state.period || (state.period = { from: todayStr().slice(0, 8) + '01', to: todayStr() });
let tab = 'ringkasan';

export function render(root) {
  root.innerHTML = `
  <div class="page-header"><div><h1>Laporan Penjualan</h1><p>Analisis penjualan, produk terlaris, kinerja teknisi, dan pelanggan.</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button></div></div>
  <div class="card">
    <div class="toolbar"><div class="flex flex-wrap"><span class="muted small strong">Periode</span><input type="date" id="from" value="${P.from}"><span class="muted small">s/d</span><input type="date" id="to" value="${P.to}"></div></div>
    <div class="underline-tabs" style="padding:0 12px;margin:0">${[['ringkasan', 'Ringkasan'], ['detail', 'Detail Penjualan'], ['produk', 'Produk & Jasa'], ['teknisi', 'Kinerja Teknisi'], ['pelanggan', 'Pelanggan'], ['piutang', 'Piutang']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="body"></div>
  </div>`;

  const sales = () => cache.orders.filter((o) => o.status === 'Selesai' && (o.tglSelesai || o.tanggal) >= P.from && (o.tglSelesai || o.tanggal) <= P.to);
  const build = () => {
    const S = sales();
    if (tab === 'ringkasan') {
      const omzet = S.reduce((a, o) => a + o.dpp, 0), hpp = S.reduce((a, o) => a + (o.hpp || 0), 0);
      const jasa = S.reduce((a, o) => a + o.dppJasa, 0), barang = S.reduce((a, o) => a + o.dppBarang, 0);
      const byDay = {};
      S.forEach((o) => { const d = o.tglSelesai || o.tanggal; byDay[d] = (byDay[d] || 0) + o.dpp; });
      return { csv: [['Keterangan', 'Nilai'], ['Jumlah transaksi', S.length], ['Penjualan barang', barang], ['Pendapatan jasa', jasa], ['Omzet (DPP)', omzet], ['PPN', S.reduce((a, o) => a + o.ppn, 0)], ['HPP', hpp], ['Laba kotor', omzet - hpp]],
        html: `<div class="kpis" style="padding:20px 20px 0">
          <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="receipt"></i></div><div><div class="label">Transaksi Selesai</div><div class="value">${S.length}</div><div class="sub">Rata-rata ${rp(S.length ? omzet / S.length : 0)}</div></div></div>
          <div class="card kpi"><div class="kpi-ic ic-green"><i data-lucide="trending-up"></i></div><div><div class="label">Omzet (DPP)</div><div class="value">${rp(omzet)}</div><div class="sub">PPN ${rp(S.reduce((a, o) => a + o.ppn, 0))}</div></div></div>
          <div class="card kpi"><div class="kpi-ic ic-purple"><i data-lucide="wrench"></i></div><div><div class="label">Barang / Jasa</div><div class="value" style="font-size:16px">${rp(barang)}</div><div class="sub">Jasa ${rp(jasa)}</div></div></div>
          <div class="card kpi"><div class="kpi-ic ic-amber"><i data-lucide="piggy-bank"></i></div><div><div class="label">Laba Kotor</div><div class="value">${rp(omzet - hpp)}</div><div class="sub">Margin ${omzet ? Math.round(((omzet - hpp) / omzet) * 100) : 0}%</div></div></div>
        </div><div class="card-body"><div class="chart-box"><canvas id="chart"></canvas></div></div>`, chart: byDay };
    }
    if (tab === 'detail') {
      const rows = S.sort((a, b) => (a.tglSelesai || a.tanggal).localeCompare(b.tglSelesai || b.tanggal));
      return { csv: [['No', 'Tgl Selesai', 'Pelanggan', 'Plat', 'Kendaraan', 'DPP Barang', 'DPP Jasa', 'PPN', 'Total', 'HPP', 'Laba Kotor'], ...rows.map((o) => [o.no, o.tglSelesai || o.tanggal, pelNama(o.pelangganId), o.kendaraan?.plat, kendaraanLabel(o.kendaraan), o.dppBarang, o.dppJasa, o.ppn, o.total, o.hpp, o.dpp - (o.hpp || 0)])],
        html: `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Tanggal</th><th>Pelanggan</th><th>Kendaraan</th><th class="r">DPP</th><th class="r">PPN</th><th class="r">Total</th><th class="r">Laba Kotor</th></tr></thead><tbody>
        ${rows.map((o) => `<tr class="clickable" data-href="#/orders/${o.id}"><td class="mono">${esc(o.no)}</td><td>${fmtDate(o.tglSelesai || o.tanggal)}</td><td>${esc(pelNama(o.pelangganId))}</td><td><span class="plate">${esc(o.kendaraan?.plat || '')}</span></td><td class="r">${rp(o.dpp)}</td><td class="r">${rp(o.ppn)}</td><td class="r strong">${rp(o.total)}</td><td class="r">${rp(o.dpp - (o.hpp || 0))}</td></tr>`).join('') || `<tr><td colspan="8">${emptyState('inbox', 'Tidak ada penjualan')}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td class="r">${rp(rows.reduce((a, o) => a + o.dpp, 0))}</td><td class="r">${rp(rows.reduce((a, o) => a + o.ppn, 0))}</td><td class="r">${rp(rows.reduce((a, o) => a + o.total, 0))}</td><td class="r">${rp(rows.reduce((a, o) => a + o.dpp - (o.hpp || 0), 0))}</td></tr></tfoot></table></div>` };
    }
    if (tab === 'produk') {
      const m = {};
      S.forEach((o) => o.items.forEach((it) => { const x = (m[it.barangId] ||= { nama: it.nama, jenis: it.jenis, qty: 0, nilai: 0, hpp: 0 }); x.qty += +it.qty; x.nilai += lineTotal(it); x.hpp += (+it.hpp || 0) * +it.qty; }));
      const rows = Object.values(m).sort((a, b) => b.nilai - a.nilai);
      const max = rows[0]?.nilai || 1;
      return { csv: [['Item', 'Jenis', 'Qty', 'Nilai', 'HPP', 'Laba'], ...rows.map((r) => [r.nama, r.jenis, r.qty, r.nilai, r.hpp, r.nilai - r.hpp])],
        html: `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Barang / Jasa</th><th class="r">Qty</th><th class="r">Nilai Penjualan</th><th class="r">Laba Kotor</th><th style="width:20%"></th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="cell-title">${esc(r.nama)} ${r.jenis === 'jasa' ? '<span class="badge b-purple">Jasa</span>' : ''}</td><td class="r">${num(r.qty)}</td><td class="r strong">${rp(r.nilai)}</td><td class="r">${rp(r.nilai - r.hpp)}</td><td><div class="bar-mini"><span style="width:${(r.nilai / max) * 100}%"></span></div></td></tr>`).join('') || `<tr><td colspan="6">${emptyState('inbox', 'Tidak ada data')}</td></tr>`}</tbody></table></div>` };
    }
    if (tab === 'teknisi') {
      const rows = cache.pegawai.filter((p) => p.jabatan === 'Teknisi').map((p) => {
        const jobs = S.filter((o) => o.teknisiIds?.includes(p.id));
        const jasa = jobs.reduce((a, o) => a + o.dppJasa / (o.teknisiIds.length || 1), 0);
        const durs = jobs.filter((o) => o.mulaiAt && o.selesaiAt).map((o) => (o.selesaiAt - o.mulaiAt) / 3600000);
        const docs = jobs.filter((o) => o.mediaCount?.before && o.mediaCount?.after).length;
        return { p, n: jobs.length, jasa, avg: durs.length ? durs.reduce((a, x) => a + x, 0) / durs.length : 0, docs, aktif: cache.orders.filter((o) => ['Dijadwalkan', 'Dikerjakan'].includes(o.status) && o.teknisiIds?.includes(p.id)).length };
      }).sort((a, b) => b.n - a.n);
      return { csv: [['Teknisi', 'Pekerjaan Selesai', 'Nilai Jasa (dibagi rata)', 'Rata-rata Durasi (jam)', 'Dokumentasi Lengkap', 'Tugas Aktif'], ...rows.map((r) => [r.p.nama, r.n, Math.round(r.jasa), r.avg.toFixed(1), r.docs, r.aktif])],
        html: `<div class="table-wrap"><table class="table"><thead><tr><th>Teknisi</th><th class="r">Pekerjaan Selesai</th><th class="r">Nilai Jasa*</th><th class="r">Rata-rata Durasi</th><th class="r">Dokumentasi Lengkap</th><th class="r">Tugas Aktif</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="cell-title">${esc(r.p.nama)}</td><td class="r strong">${r.n}</td><td class="r">${rp(r.jasa)}</td><td class="r">${r.avg ? r.avg.toFixed(1) + ' jam' : '-'}</td><td class="r"><span class="badge ${r.n && r.docs === r.n ? 'b-green' : 'b-amber'}">${r.docs}/${r.n}</span></td><td class="r">${r.aktif}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted small" style="padding:12px 20px">* Nilai jasa dibagi rata bila satu order dikerjakan beberapa teknisi.</p>` };
    }
    if (tab === 'pelanggan') {
      const m = {};
      S.forEach((o) => { const x = (m[o.pelangganId] ||= { n: 0, total: 0 }); x.n++; x.total += o.total; });
      const rows = Object.entries(m).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
      return { csv: [['Pelanggan', 'Transaksi', 'Total'], ...rows.map((r) => [pelNama(r.id), r.n, r.total])],
        html: `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Pelanggan</th><th class="r">Transaksi</th><th class="r">Total Belanja</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr class="clickable" data-href="#/master/pelanggan?id=${r.id}"><td>${i + 1}</td><td class="cell-title">${esc(pelNama(r.id))}</td><td class="r">${r.n}</td><td class="r strong">${rp(r.total)}</td></tr>`).join('') || `<tr><td colspan="4">${emptyState('inbox', 'Tidak ada data')}</td></tr>`}</tbody></table></div>` };
    }
    // piutang (tidak tergantung periode)
    const rows = cache.orders.filter((o) => o.status !== 'Batal' && o.total - paid(o) > 0).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const age = (d) => Math.floor((Date.now() - new Date(d + 'T00:00:00')) / 86400000);
    return { csv: [['No', 'Tanggal', 'Pelanggan', 'Status', 'Total', 'Dibayar', 'Sisa', 'Umur (hari)'], ...rows.map((o) => [o.no, o.tanggal, pelNama(o.pelangganId), o.status, o.total, paid(o), o.total - paid(o), age(o.tanggal)])],
      html: `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Tanggal</th><th>Pelanggan</th><th>Status</th><th class="r">Total</th><th class="r">Dibayar</th><th class="r">Sisa</th><th class="r">Umur</th></tr></thead><tbody>
      ${rows.map((o) => { const a = age(o.tanggal); return `<tr class="clickable" data-href="#/orders/${o.id}"><td class="mono">${esc(o.no)}</td><td>${fmtDate(o.tanggal)}</td><td>${esc(pelNama(o.pelangganId))}</td><td>${esc(o.status)}</td><td class="r">${rp(o.total)}</td><td class="r">${rp(paid(o))}</td><td class="r strong text-danger">${rp(o.total - paid(o))}</td><td class="r"><span class="badge ${a > 30 ? 'b-red' : a > 14 ? 'b-amber' : 'b-gray'}">${a} hari</span></td></tr>`; }).join('') || `<tr><td colspan="8">${emptyState('check-circle-2', 'Tidak ada piutang')}</td></tr>`}</tbody>
      <tfoot><tr><td colspan="6">Total piutang</td><td class="r">${rp(rows.reduce((a, o) => a + o.total - paid(o), 0))}</td><td></td></tr></tfoot></table></div>` };
  };
  let chart;
  const draw = () => {
    const r = build();
    root.querySelector('#body').innerHTML = r.html;
    window.lucide?.createIcons();
    if (r.chart && window.Chart) {
      const days = Object.keys(r.chart).sort();
      chart?.destroy();
      chart = new Chart(root.querySelector('#chart'), {
        type: 'line',
        data: { labels: days.map((d) => fmtDate(d)), datasets: [{ label: 'Omzet', data: days.map((d) => r.chart[d]), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), backgroundColor: 'rgba(29,100,242,.12)', fill: true, tension: 0.35, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => rp(c.raw) } } }, scales: { y: { ticks: { callback: (v) => (v >= 1e6 ? v / 1e6 + ' jt' : num(v)) } } } },
      });
    }
    return r;
  };
  draw();
  root.querySelector('#from').addEventListener('change', (e) => { P.from = e.target.value; draw(); });
  root.querySelector('#to').addEventListener('change', (e) => { P.to = e.target.value; draw(); });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === t)); draw(); return; }
    const h = e.target.closest('[data-href]');
    if (h) location.hash = h.dataset.href;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'csv') exportCSV(`laporan-${tab}-${P.from}-${P.to}.csv`, build().csv);
    if (act === 'print') { const r = build(); printReport(`LAPORAN ${tab.toUpperCase()}`, `${fmtDate(P.from)} – ${fmtDate(P.to)}`, `<table>${r.csv.map((row, i) => `<tr>${row.map((c) => (i ? `<td class="${typeof c === 'number' ? 'r' : ''}">${typeof c === 'number' ? num(c) : esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>`); }
  });
}
