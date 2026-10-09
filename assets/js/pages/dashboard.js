import { cache } from '../db.js';
import { rp, num, esc, todayStr, fmtDateLong, fmtTime, BULAN, sum, emptyState, initials } from '../utils.js';
import { stockMap, balances, statusBadge, paid, pelNama, pegNama, kendaraanLabel, activeOrders, STATUS } from '../calc.js';
import { state } from '../state.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function render(root) {
  const T = todayStr();
  const ym = T.slice(0, 7);
  const done = cache.orders.filter((o) => o.status === 'Selesai');
  const doneMonth = done.filter((o) => (o.tglSelesai || o.tanggal).slice(0, 7) === ym);
  const omzet = sum(doneMonth, (o) => o.dpp);
  const laba = sum(doneMonth, (o) => o.dpp - (o.hpp || 0));
  const aktif = activeOrders();
  const piutang = sum(cache.orders.filter((o) => o.status !== 'Batal'), (o) => Math.max(0, o.total - paid(o)));
  const bal = balances(null, T);
  const kas = (bal['1101'] || 0) + (bal['1102'] || 0);
  const sm = stockMap();
  const low = cache.barang.filter((b) => b.jenis !== 'jasa' && b.aktif !== false && (sm[b.id] || 0) <= (+b.stokMin || 0));
  const todayJobs = cache.orders.filter((o) => o.jadwal?.slice(0, 10) === T && o.status !== 'Batal').sort((a, b) => a.jadwal.localeCompare(b.jadwal));
  const recent = [...cache.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  root.innerHTML = `
  <div class="page-header">
    <div><h1>Halo, ${esc(state.user.nama.split(' ')[0])} 👋</h1><p>${fmtDateLong(T)} · Ringkasan usaha bulan ${BULAN[new Date().getMonth()]}</p></div>
    <div class="actions">
      <a class="btn btn-ghost" href="#/pembelian/new"><i data-lucide="shopping-cart"></i> Pembelian</a>
      <a class="btn btn-primary" href="#/orders/new"><i data-lucide="plus"></i> Order Baru</a>
    </div>
  </div>
  <div class="kpis">
    ${kpi('Pendapatan Bulan Ini', rp(omzet), `${doneMonth.length} pekerjaan selesai`, 'trending-up', 'ic-blue')}
    ${kpi('Laba Kotor Bulan Ini', rp(laba), omzet ? `Margin ${Math.round((laba / omzet) * 100)}%` : '-', 'piggy-bank', 'ic-green')}
    ${kpi('Order Aktif', num(aktif.length), `${todayJobs.length} jadwal hari ini`, 'car-front', 'ic-amber')}
    ${kpi('Saldo Kas & Bank', rp(kas), `Piutang ${rp(piutang)}`, 'wallet', 'ic-purple')}
  </div>
  <div class="grid grid-main">
    <div class="stack">
      <div class="card">
        <div class="card-header"><h3><i data-lucide="bar-chart-3"></i> Pendapatan vs Pengeluaran (6 bulan)</h3></div>
        <div class="card-body"><div class="chart-box"><canvas id="c1"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i data-lucide="list"></i> Order Terbaru</h3><a href="#/orders" class="btn btn-ghost btn-sm">Lihat semua</a></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>No. Order</th><th>Pelanggan</th><th>Kendaraan</th><th class="r">Total</th><th>Status</th></tr></thead>
          <tbody>${recent.map((o) => `<tr class="clickable" data-href="#/orders/${o.id}">
            <td><div class="cell-title">${esc(o.no)}</div><div class="cell-sub">${o.tanggal}</div></td>
            <td>${esc(pelNama(o.pelangganId))}</td>
            <td><span class="plate">${esc(o.kendaraan?.plat || '-')}</span><div class="cell-sub">${esc(kendaraanLabel(o.kendaraan))}</div></td>
            <td class="r strong">${rp(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-header"><h3><i data-lucide="calendar-clock"></i> Jadwal Hari Ini</h3><span class="badge b-blue">${todayJobs.length}</span></div>
        ${todayJobs.length ? `<ul class="list">${todayJobs.map((o) => `<li><a class="li-link" href="#/orders/${o.id}">
          <span class="time-pill">${fmtTime(o.jadwal)}</span>
          <span class="grow"><b>${esc(o.kendaraan?.plat)} · ${esc(kendaraanLabel(o.kendaraan))}</b><small>${esc(o.teknisiIds.map(pegNama).join(', ') || 'Belum ada teknisi')}</small></span>
          ${statusBadge(o.status)}</a></li>`).join('')}</ul>` : emptyState('calendar-check', 'Tidak ada jadwal hari ini')}
      </div>
      <div class="card">
        <div class="card-header"><h3><i data-lucide="pie-chart"></i> Status Order</h3></div>
        <div class="card-body"><div class="chart-box sm"><canvas id="c2"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i data-lucide="alert-triangle"></i> Stok Menipis</h3><a href="#/stok" class="btn btn-ghost btn-sm">Laporan stok</a></div>
        ${low.length ? `<ul class="list">${low.map((b) => `<li><a class="li-link" href="#/stok/${b.id}"><span class="grow"><b>${esc(b.nama)}</b><small>${esc(b.kode)} · min ${b.stokMin}</small></span><span class="badge ${sm[b.id] <= 0 ? 'b-red' : 'b-amber'}">${num(sm[b.id])} ${esc(b.satuan)}</span></a></li>`).join('')}</ul>` : emptyState('package-check', 'Semua stok aman')}
      </div>
    </div>
  </div>`;

  root.addEventListener('click', (e) => { const tr = e.target.closest('[data-href]'); if (tr) location.hash = tr.dataset.href; });
  drawCharts(root);
}

function kpi(label, value, sub, icon, cls) {
  return `<div class="card kpi"><div class="kpi-ic ${cls}"><i data-lucide="${icon}"></i></div><div><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div></div>`;
}

function drawCharts(root) {
  if (!window.Chart) return;
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  const pendapatan = months.map((m) => sum(cache.orders.filter((o) => o.status === 'Selesai' && (o.tglSelesai || o.tanggal).startsWith(m)), (o) => o.dpp));
  const pengeluaran = months.map((m) => sum(cache.kas.filter((k) => k.jenis === 'keluar' && k.tanggal.startsWith(m)), (k) => k.jumlah) + sum(cache.pembelian.filter((p) => p.status !== 'Batal' && p.tanggal.startsWith(m)), (p) => p.total));
  const text = css('--muted');
  const grid = css('--border');
  Chart.defaults.font.family = '"Plus Jakarta Sans", sans-serif';
  Chart.defaults.color = text;
  new Chart(root.querySelector('#c1'), {
    type: 'bar',
    data: {
      labels: months.map((m) => BULAN[+m.slice(5) - 1].slice(0, 3)),
      datasets: [
        { label: 'Pendapatan', data: pendapatan, backgroundColor: css('--primary'), borderRadius: 6, maxBarThickness: 28 },
        { label: 'Pengeluaran', data: pengeluaran, backgroundColor: '#f59e0b', borderRadius: 6, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rp(c.raw)}` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: grid }, border: { display: false }, ticks: { callback: (v) => (v >= 1e6 ? v / 1e6 + ' jt' : num(v)) } } },
    },
  });
  const counts = STATUS.map((s) => cache.orders.filter((o) => o.status === s).length);
  new Chart(root.querySelector('#c2'), {
    type: 'doughnut',
    data: { labels: STATUS, datasets: [{ data: counts, backgroundColor: ['#94a3b8', css('--primary'), '#f59e0b', '#16a34a', '#ef4444'], borderWidth: 2, borderColor: css('--surface') }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } } },
  });
}
