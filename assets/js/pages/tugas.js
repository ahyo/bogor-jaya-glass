import { cache } from '../db.js';
import { esc, fmtDateTime, todayStr, emptyState, fmtDate } from '../utils.js';
import { statusBadge, pelNama, pegNama, kendaraanLabel } from '../calc.js';
import { state } from '../state.js';
import { myTasks } from '../app.js';

let tab = 'aktif';

export function render(root) {
  const T = todayStr();
  const pid = state.user.pegawaiId;
  const isAdmin = state.user.role === 'admin';
  const tasks = myTasks().sort((a, b) => (a.jadwal || '9').localeCompare(b.jadwal || '9'));
  const done = cache.orders.filter((o) => o.status === 'Selesai' && (isAdmin || o.teknisiIds?.includes(pid))).sort((a, b) => (b.selesaiAt || 0) - (a.selesaiAt || 0) || b.tanggal.localeCompare(a.tanggal));
  const doneMonth = done.filter((o) => (o.tglSelesai || o.tanggal).startsWith(T.slice(0, 7)));
  const groups = [
    ['Sedang Dikerjakan', tasks.filter((o) => o.status === 'Dikerjakan')],
    ['Jadwal Hari Ini', tasks.filter((o) => o.status === 'Dijadwalkan' && o.jadwal?.slice(0, 10) <= T)],
    ['Mendatang', tasks.filter((o) => o.status === 'Dijadwalkan' && (!o.jadwal || o.jadwal.slice(0, 10) > T))],
  ];

  root.innerHTML = `
  <div class="page-header">
    <div><h1>Tugas Pemasangan</h1><p>${isAdmin ? 'Semua pekerjaan aktif teknisi' : 'Pekerjaan yang ditugaskan kepada Anda'}</p></div>
  </div>
  <div class="kpis">
    <div class="card kpi"><div class="kpi-ic ic-amber"><i data-lucide="wrench"></i></div><div><div class="label">Sedang Dikerjakan</div><div class="value">${groups[0][1].length}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="calendar-clock"></i></div><div><div class="label">Jadwal Hari Ini</div><div class="value">${groups[1][1].length}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-green"><i data-lucide="check-circle-2"></i></div><div><div class="label">Selesai Bulan Ini</div><div class="value">${doneMonth.length}</div></div></div>
  </div>
  <div class="tabs mb-2" style="display:inline-flex"><button class="tab ${tab === 'aktif' ? 'active' : ''}" data-tab="aktif">Aktif <span class="n">${tasks.length}</span></button><button class="tab ${tab === 'riwayat' ? 'active' : ''}" data-tab="riwayat">Riwayat Selesai <span class="n">${done.length}</span></button></div>
  ${tab === 'aktif'
    ? (tasks.length ? groups.filter((g) => g[1].length).map(([title, list]) => `<h3 class="mb-2 mt-2" style="font-size:15px">${title}</h3><div class="task-grid mb-2">${list.map(card).join('')}</div>`).join('')
      : `<div class="card">${emptyState('party-popper', 'Tidak ada tugas aktif', 'Tugas baru akan muncul di sini saat dijadwalkan oleh admin/kasir.')}</div>`)
    : `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Kendaraan</th><th>Pekerjaan</th><th>Selesai</th><th>Dokumentasi</th></tr></thead><tbody>
      ${done.slice(0, 100).map((o) => `<tr class="clickable" data-href="#/orders/${o.id}"><td class="strong">${esc(o.no)}</td><td><span class="plate">${esc(o.kendaraan?.plat || '')}</span><div class="cell-sub">${esc(kendaraanLabel(o.kendaraan))}</div></td>
        <td>${esc(o.items.map((i) => i.nama).join(', '))}</td><td class="nowrap">${fmtDate(o.tglSelesai || o.tanggal)}</td>
        <td><span class="badge b-amber">B ${o.mediaCount?.before || 0}</span> <span class="badge b-green">A ${o.mediaCount?.after || 0}</span></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('inbox', 'Belum ada riwayat')}</td></tr>`}
      </tbody></table></div></div>`}`;

  root.onclick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; render(root); window.lucide?.createIcons(); return; }
    const h = e.target.closest('[data-href]');
    if (h && !e.target.closest('a')) location.hash = h.dataset.href;
  };
}

function card(o) {
  const mc = o.mediaCount || {};
  const late = o.status === 'Dijadwalkan' && o.jadwal && o.jadwal < new Date().toISOString().slice(0, 16) && o.jadwal.slice(0, 10) < todayStr();
  return `<div class="card task-card">
    <div class="t-head"><div><div class="t-car"><span class="plate">${esc(o.kendaraan?.plat || '-')}</span></div><div class="muted small mt-1">${esc(o.no)}</div></div>${statusBadge(o.status)}</div>
    <div class="t-row"><i data-lucide="car-front"></i><b>${esc(kendaraanLabel(o.kendaraan) || '-')}</b>${o.kendaraan?.warna ? `<span class="muted">· ${esc(o.kendaraan.warna)}</span>` : ''}</div>
    <div class="t-row"><i data-lucide="user"></i>${esc(pelNama(o.pelangganId))}</div>
    <div class="t-row"><i data-lucide="calendar-clock"></i>${o.jadwal ? fmtDateTime(o.jadwal) : 'Belum dijadwalkan'} ${late ? '<span class="badge b-red">Terlambat</span>' : ''}</div>
    <div class="t-row"><i data-lucide="map-pin"></i>${esc(o.lokasi || 'Workshop')}</div>
    <div class="t-row"><i data-lucide="users"></i>${esc(o.teknisiIds.map(pegNama).join(', '))}</div>
    <div class="t-row" style="align-items:flex-start"><i data-lucide="package"></i><span>${esc(o.items.map((i) => `${i.nama} ×${i.qty}`).join(', '))}</span></div>
    ${o.keluhan ? `<div class="alert alert-info" style="margin:0"><i data-lucide="message-square"></i><div>${esc(o.keluhan)}</div></div>` : ''}
    <div class="t-media"><span class="badge ${mc.before ? 'b-amber' : 'b-gray'}"><i data-lucide="camera"></i> Before ${mc.before || 0}</span><span class="badge ${mc.proses ? 'b-blue' : 'b-gray'}">Proses ${mc.proses || 0}</span><span class="badge ${mc.after ? 'b-green' : 'b-gray'}">After ${mc.after || 0}</span></div>
    <div class="t-actions"><a class="btn ${o.status === 'Dikerjakan' ? 'btn-success' : 'btn-primary'}" href="#/orders/${o.id}"><i data-lucide="${o.status === 'Dikerjakan' ? 'camera' : 'play'}"></i> ${o.status === 'Dikerjakan' ? 'Dokumentasi & Selesaikan' : 'Buka & Mulai'}</a></div>
  </div>`;
}
