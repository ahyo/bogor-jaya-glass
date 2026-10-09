import { cache, byId } from '../db.js';
import { esc, fmtDateTime, options, debounce, exportCSV, todayStr, emptyState, initials } from '../utils.js';

const MODUL = { orders: 'Order', pembelian: 'Pembelian', barang: 'Barang', pelanggan: 'Pelanggan', supplier: 'Supplier', pegawai: 'Pegawai', kas: 'Kas', jurnal: 'Jurnal', opname: 'Stok Opname', users: 'Pengguna', settings: 'Pengaturan' };
const AKSI_CLS = { Tambah: 'b-green', Ubah: 'b-blue', Hapus: 'b-red', Status: 'b-amber', Pembayaran: 'b-green', Login: 'b-gray', Logout: 'b-gray', Batal: 'b-red' };
const ui = { q: '', modul: '', user: '', from: '', to: '' };

const linkFor = (l) => {
  if (l.aksi === 'Hapus') return null;
  if (l.modul === 'orders') return `#/orders/${l.refId}`;
  if (l.modul === 'pembelian') return `#/pembelian/${l.refId}`;
  if (l.modul === 'barang' && byId('barang', l.refId)?.jenis !== 'jasa') return `#/stok/${l.refId}`;
  if (['pelanggan', 'supplier', 'pegawai'].includes(l.modul)) return `#/master/${l.modul}?id=${l.refId}`;
  return null;
};

export function render(root) {
  const users = [...new Set(cache.log.map((l) => l.user))];
  root.innerHTML = `
  <div class="page-header"><div><h1>Riwayat Aktivitas</h1><p>Jejak audit seluruh transaksi & perubahan data: siapa, kapan, dan apa yang diubah.</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button></div></div>
  <div class="card">
    <div class="toolbar">
      <div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari no. dokumen, detail…" value="${esc(ui.q)}"></div>
      <select id="modul">${options(Object.entries(MODUL), ui.modul, 'Semua modul')}</select>
      <select id="user">${options(users, ui.user, 'Semua pengguna')}</select>
      <div class="flex"><input type="date" id="from" value="${ui.from}"><span class="muted small">s/d</span><input type="date" id="to" value="${ui.to}"></div>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Modul</th><th>Dokumen</th><th>Detail</th></tr></thead><tbody id="rows"></tbody></table></div>
    <div class="card-footer muted small" id="info"></div>
  </div>`;
  const list = () => {
    const q = ui.q.toLowerCase();
    return cache.log.filter((l) => {
      const d = todayStr(new Date(l.waktu));
      return (!ui.modul || l.modul === ui.modul) && (!ui.user || l.user === ui.user) && (!ui.from || d >= ui.from) && (!ui.to || d <= ui.to)
        && (!q || `${l.refNo} ${l.detail} ${l.aksi} ${l.user}`.toLowerCase().includes(q));
    }).sort((a, b) => b.waktu - a.waktu);
  };
  const draw = () => {
    const l = list();
    root.querySelector('#rows').innerHTML = l.length ? l.slice(0, 500).map((x) => {
      const link = linkFor(x);
      return `<tr ${link ? `class="clickable" data-href="${link}"` : ''}><td class="nowrap">${fmtDateTime(x.waktu)}</td>
        <td><div class="flex"><span class="avatar" style="width:26px;height:26px;font-size:10px">${esc(initials(x.user))}</span>${esc(x.user)}</div></td>
        <td><span class="badge ${AKSI_CLS[x.aksi] || 'b-purple'}">${esc(x.aksi)}</span></td><td>${esc(MODUL[x.modul] || x.modul)}</td>
        <td class="mono strong">${esc(x.refNo || '-')}</td><td class="cell-sub" style="max-width:380px">${esc(x.detail || '')}</td></tr>`;
    }).join('') : `<tr><td colspan="6">${emptyState('history', 'Belum ada aktivitas')}</td></tr>`;
    root.querySelector('#info').textContent = `${l.length} aktivitas${l.length > 500 ? ' (menampilkan 500 terbaru, gunakan filter/export untuk selengkapnya)' : ''}`;
    window.lucide?.createIcons();
  };
  draw();
  root.querySelector('#q').addEventListener('input', debounce((e) => { ui.q = e.target.value; draw(); }, 150));
  for (const k of ['modul', 'user', 'from', 'to']) root.querySelector('#' + k).addEventListener('change', (e) => { ui[k] = e.target.value; draw(); });
  root.addEventListener('click', (e) => {
    const h = e.target.closest('[data-href]');
    if (h) location.hash = h.dataset.href;
    if (e.target.closest('[data-act=csv]')) exportCSV(`riwayat-aktivitas-${todayStr()}.csv`, [['Waktu', 'Pengguna', 'Aksi', 'Modul', 'Dokumen', 'Detail'], ...list().map((x) => [fmtDateTime(x.waktu), x.user, x.aksi, MODUL[x.modul] || x.modul, x.refNo, x.detail])]);
  });
}
