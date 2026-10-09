// Bootstrap aplikasi: login, layout, router, pencarian global
import { loadAll, cache, byId, getSettings, logActivity } from './db.js';
import { seedIfEmpty } from './seed.js';
import { state, can, releaseUrls } from './state.js';
import { esc, icons, toast, initials, fmtDateLong, debounce, rp } from './utils.js';
import { activeOrders, pelNama, kendaraanLabel, statusBadge } from './calc.js';

const ADM = ['admin'];
const AK = ['admin', 'kasir'];
const ALL = ['admin', 'kasir', 'teknisi'];
const P = {
  dashboard: () => import('./pages/dashboard.js'),
  tugas: () => import('./pages/tugas.js'),
  orders: () => import('./pages/orders.js'),
  detail: () => import('./pages/order-detail.js'),
  pembelian: () => import('./pages/pembelian.js'),
  master: () => import('./pages/master.js'),
  stok: () => import('./pages/stok.js'),
  keuangan: () => import('./pages/keuangan.js'),
  pajak: () => import('./pages/pajak.js'),
  laporan: () => import('./pages/laporan.js'),
  riwayat: () => import('./pages/riwayat.js'),
  pengaturan: () => import('./pages/pengaturan.js'),
};

const ROUTES = [
  { path: 'dashboard', mod: P.dashboard, roles: AK, nav: 'dashboard' },
  { path: 'tugas', mod: P.tugas, roles: ['admin', 'teknisi'], nav: 'tugas' },
  { path: 'orders', mod: P.orders, fn: 'renderList', roles: AK, nav: 'orders' },
  { path: 'orders/new', mod: P.orders, fn: 'renderForm', roles: AK, nav: 'orders' },
  { path: 'orders/:id', mod: P.detail, roles: ALL, nav: 'orders' },
  { path: 'orders/:id/edit', mod: P.orders, fn: 'renderForm', roles: AK, nav: 'orders' },
  { path: 'pembelian', mod: P.pembelian, fn: 'renderList', roles: AK, nav: 'pembelian' },
  { path: 'pembelian/new', mod: P.pembelian, fn: 'renderForm', roles: AK, nav: 'pembelian' },
  { path: 'pembelian/:id', mod: P.pembelian, fn: 'renderDetail', roles: AK, nav: 'pembelian' },
  { path: 'pembelian/:id/edit', mod: P.pembelian, fn: 'renderForm', roles: AK, nav: 'pembelian' },
  { path: 'master/:type', mod: P.master, roles: AK, nav: (p) => 'master/' + p.type },
  { path: 'stok', mod: P.stok, fn: 'renderLaporan', roles: AK, nav: 'stok' },
  { path: 'stok/opname', mod: P.stok, fn: 'renderOpname', roles: AK, nav: 'stok/opname' },
  { path: 'stok/:id', mod: P.stok, fn: 'renderKartu', roles: AK, nav: 'stok' },
  { path: 'kas', mod: P.keuangan, fn: 'renderKas', roles: AK, nav: 'kas' },
  { path: 'jurnal', mod: P.keuangan, fn: 'renderJurnal', roles: ADM, nav: 'jurnal' },
  { path: 'buku-besar', mod: P.keuangan, fn: 'renderBukuBesar', roles: ADM, nav: 'buku-besar' },
  { path: 'laba-rugi', mod: P.keuangan, fn: 'renderLabaRugi', roles: ADM, nav: 'laba-rugi' },
  { path: 'neraca', mod: P.keuangan, fn: 'renderNeraca', roles: ADM, nav: 'neraca' },
  { path: 'pajak', mod: P.pajak, roles: ADM, nav: 'pajak' },
  { path: 'laporan', mod: P.laporan, roles: ADM, nav: 'laporan' },
  { path: 'riwayat', mod: P.riwayat, roles: ADM, nav: 'riwayat' },
  { path: 'pengaturan', mod: P.pengaturan, roles: ADM, nav: 'pengaturan' },
];

const MENU = [
  { group: 'Utama', items: [
    { href: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard', roles: AK },
    { href: 'tugas', icon: 'clipboard-check', label: 'Tugas Pemasangan', roles: ['admin', 'teknisi'], count: () => myTasks().length },
  ] },
  { group: 'Transaksi', items: [
    { href: 'orders', icon: 'car-front', label: 'Order & Pemasangan', roles: AK, count: () => activeOrders().length },
    { href: 'pembelian', icon: 'shopping-cart', label: 'Pembelian Barang', roles: AK },
  ] },
  { group: 'Persediaan', items: [
    { href: 'stok', icon: 'boxes', label: 'Laporan Stok', roles: AK },
    { href: 'stok/opname', icon: 'clipboard-list', label: 'Stok Opname', roles: AK },
  ] },
  { group: 'Master Data', items: [
    { href: 'master/barang', icon: 'package', label: 'Barang & Jasa', roles: AK },
    { href: 'master/pelanggan', icon: 'users', label: 'Pelanggan', roles: AK },
    { href: 'master/supplier', icon: 'truck', label: 'Supplier', roles: AK },
    { href: 'master/pegawai', icon: 'id-card', label: 'Pegawai', roles: ADM },
  ] },
  { group: 'Keuangan', items: [
    { href: 'kas', icon: 'wallet', label: 'Kas & Biaya', roles: AK },
    { href: 'jurnal', icon: 'book-open', label: 'Jurnal Umum', roles: ADM },
    { href: 'buku-besar', icon: 'library', label: 'Buku Besar', roles: ADM },
    { href: 'laba-rugi', icon: 'trending-up', label: 'Laba Rugi', roles: ADM },
    { href: 'neraca', icon: 'scale', label: 'Neraca', roles: ADM },
    { href: 'pajak', icon: 'receipt', label: 'Pajak (PPN & PPh)', roles: ADM },
  ] },
  { group: 'Laporan & Sistem', items: [
    { href: 'laporan', icon: 'bar-chart-3', label: 'Laporan Penjualan', roles: ADM },
    { href: 'riwayat', icon: 'history', label: 'Riwayat Aktivitas', roles: ADM },
    { href: 'pengaturan', icon: 'settings', label: 'Pengaturan', roles: ADM },
  ] },
];

export function myTasks() {
  const pid = state.user?.pegawaiId;
  return activeOrders().filter((o) => o.status !== 'Baru' && (state.user?.role === 'admin' || (pid && o.teknisiIds?.includes(pid))));
}

const homeFor = (role) => (role === 'teknisi' ? 'tugas' : 'dashboard');

// ---------- Login ----------
function renderLogin() {
  const s = getSettings();
  document.getElementById('app').innerHTML = `
  <div class="login">
    <div class="login-hero">
      <div class="brand"><img src="assets/img/logo.svg" alt=""><div><b>${esc(s.namaUsaha)}</b><span>${esc(s.tagline || '')}</span></div></div>
      <div>
        <h1>Kelola penjualan & pemasangan <span>kaca mobil</span> dalam satu sistem.</h1>
        <ul>
          <li><i data-lucide="camera"></i> Dokumentasi foto & video before–after tiap pekerjaan</li>
          <li><i data-lucide="boxes"></i> Stok, pembelian & kartu stok otomatis</li>
          <li><i data-lucide="calculator"></i> Akuntansi, laba rugi, neraca & laporan pajak</li>
          <li><i data-lucide="smartphone"></i> Nyaman dipakai teknisi dari HP</li>
        </ul>
      </div>
      <p style="color:#7f90b5;font-size:12px;position:relative;z-index:1">© ${new Date().getFullYear()} ${esc(s.namaUsaha)}</p>
    </div>
    <div class="login-form">
      <form id="login" autocomplete="on">
        <div><h2>Selamat datang 👋</h2><p class="muted">Masuk untuk melanjutkan ke sistem.</p></div>
        <div class="field"><label>Username</label><input name="username" autocomplete="username" required autocapitalize="none"></div>
        <div class="field"><label>PIN / Password</label><input name="pin" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit"><i data-lucide="log-in"></i> Masuk</button>
        <div class="demo-box"><b>Akun demo</b> (PIN semua <code>1234</code>):<br>
          <code>admin</code> – pemilik · <code>kasir</code> – kasir · <code>budi</code> / <code>agus</code> – teknisi</div>
      </form>
    </div>
  </div>`;
  icons();
  document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const u = cache.users.find((x) => x.username.toLowerCase() === String(f.get('username')).trim().toLowerCase() && x.pin === f.get('pin') && x.aktif !== false);
    if (!u) return toast('Username atau PIN salah', 'error');
    state.user = u;
    try { localStorage.setItem('bjg-session', u.id); } catch (err) { /* abaikan */ }
    await logActivity({ aksi: 'Login', modul: 'users', refId: u.id, refNo: u.username });
    renderShell();
    if (location.hash.replace('#/', '') === '' || location.hash === '#/login') location.hash = '#/' + homeFor(u.role);
    else route();
  });
}

function logout() {
  try { localStorage.removeItem('bjg-session'); } catch (e) { /* abaikan */ }
  logActivity({ aksi: 'Logout', modul: 'users', refId: state.user.id, refNo: state.user.username });
  state.user = null;
  location.hash = '#/login';
  renderLogin();
}

// ---------- Shell ----------
function renderShell() {
  const s = getSettings();
  const u = state.user;
  document.getElementById('app').innerHTML = `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/${homeFor(u.role)}"><img src="assets/img/logo.svg" alt=""><div><b>${esc(s.namaUsaha)}</b><span>${esc(s.tagline || 'Sistem Manajemen')}</span></div></a>
      <nav class="nav" id="nav"></nav>
      <div class="sidebar-foot">Data tersimpan di perangkat ini · <a href="#/pengaturan" style="color:#7dd3fc">Backup</a></div>
    </aside>
    <div class="backdrop" id="backdrop"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn-icon menu-btn" id="menuBtn" aria-label="Menu"><i data-lucide="menu"></i></button>
        <div class="search-box" id="gsearch">
          <i data-lucide="search"></i>
          <input id="gq" placeholder="${u.role === 'teknisi' ? 'Cari order / plat nomor…' : 'Cari order, plat nomor, barang, pelanggan…'}" autocomplete="off">
          <kbd>/</kbd>
          <div class="search-results hide" id="gres"></div>
        </div>
        <div class="top-actions">
          <button class="btn-icon" id="themeBtn" title="Ganti tema"><i data-lucide="moon"></i></button>
          <button class="user-chip" id="userBtn">
            <span class="avatar">${esc(initials(u.nama))}</span>
            <span class="u-text"><div class="u-name">${esc(u.nama)}</div><div class="u-role">${esc(u.role)}</div></span>
            <i data-lucide="chevron-down" class="u-text"></i>
          </button>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div>
  </div>`;
  renderNav();
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('backdrop');
  const closeSb = () => { sb.classList.remove('open'); bd.classList.remove('show'); };
  document.getElementById('menuBtn').onclick = () => { sb.classList.add('open'); bd.classList.add('show'); };
  bd.onclick = closeSb;
  sb.addEventListener('click', (e) => { if (e.target.closest('a')) closeSb(); });
  document.getElementById('themeBtn').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('bjg-theme', dark ? 'dark' : 'light'); } catch (e) { /* abaikan */ }
    state.rerender();
  };
  document.getElementById('userBtn').onclick = (e) => {
    e.stopPropagation();
    const ex = document.querySelector('.dropdown');
    if (ex) return ex.remove();
    const dd = document.createElement('div');
    dd.className = 'dropdown';
    dd.innerHTML = `<div style="padding:8px 10px 10px;border-bottom:1px solid var(--border);margin-bottom:4px"><b>${esc(u.nama)}</b><div class="muted small">@${esc(u.username)} · ${esc(u.role)}</div></div>
      ${can('admin') ? '<a href="#/pengaturan"><i data-lucide="settings"></i> Pengaturan</a>' : ''}
      <button data-act="pin"><i data-lucide="key-round"></i> Ganti PIN</button>
      <button data-act="logout"><i data-lucide="log-out"></i> Keluar</button>`;
    e.currentTarget.appendChild(dd);
    icons();
    dd.onclick = async (ev) => {
      ev.stopPropagation();
      const a = ev.target.closest('[data-act]')?.dataset.act;
      if (a === 'logout') logout();
      if (a === 'pin') { dd.remove(); (await import('./pages/pengaturan.js')).changePin(); }
      if (ev.target.closest('a')) dd.remove();
    };
  };
  document.addEventListener('click', () => document.querySelector('.dropdown')?.remove());
  setupSearch();
  icons();
}

function renderNav() {
  const role = state.user.role;
  document.getElementById('nav').innerHTML = MENU.map((g) => {
    const items = g.items.filter((i) => i.roles.includes(role));
    if (!items.length) return '';
    return `<div class="nav-group"><span>${g.group}</span>${items.map((i) => {
      const c = i.count?.();
      return `<a class="nav-item" data-nav="${i.href}" href="#/${i.href}"><i data-lucide="${i.icon}"></i>${i.label}${c ? `<span class="count">${c}</span>` : ''}</a>`;
    }).join('')}</div>`;
  }).join('');
  icons();
}

// ---------- Pencarian global ----------
function setupSearch() {
  const box = document.getElementById('gsearch');
  const q = document.getElementById('gq');
  const res = document.getElementById('gres');
  let results = [];
  let focus = 0;
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    if (term.length < 2) { res.classList.add('hide'); return; }
    results = globalSearch(term);
    focus = 0;
    if (!results.length) { res.innerHTML = `<div class="sr-empty">Tidak ada hasil untuk “${esc(q.value)}”</div>`; }
    else {
      let last = '';
      res.innerHTML = results.map((r, i) => {
        const head = r.group !== last ? `<div class="sr-group">${r.group}</div>` : '';
        last = r.group;
        return `${head}<a class="sr-item ${i === 0 ? 'focus' : ''}" href="${r.href}" data-i="${i}"><span class="sr-ic"><i data-lucide="${r.icon}"></i></span><span class="grow"><b>${r.title}</b><small>${r.sub}</small></span>${r.right || ''}</a>`;
      }).join('');
    }
    res.classList.remove('hide');
    icons();
  };
  q.addEventListener('input', debounce(draw, 120));
  q.addEventListener('focus', draw);
  q.addEventListener('keydown', (e) => {
    const items = [...res.querySelectorAll('.sr-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focus = (focus + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((x, i) => x.classList.toggle('focus', i === focus));
      items[focus]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && items[focus]) {
      location.hash = items[focus].getAttribute('href');
      close();
    } else if (e.key === 'Escape') { close(); q.blur(); }
  });
  const close = () => { res.classList.add('hide'); q.value = ''; };
  res.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(close, 0); });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) res.classList.add('hide'); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      q.focus();
    }
  });
}

function globalSearch(term) {
  const has = (...v) => v.some((x) => String(x || '').toLowerCase().includes(term));
  const out = [];
  const tek = state.user.role === 'teknisi';
  const orders = cache.orders.filter((o) => has(o.no, o.kendaraan?.plat, o.kendaraan?.plat?.replace(/\s/g, ''), o.kendaraan?.merk, o.kendaraan?.model, pelNama(o.pelangganId), o.keluhan, ...o.items.map((i) => i.nama)))
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  for (const o of orders) out.push({ group: 'Order & Pemasangan', icon: 'car-front', href: `#/orders/${o.id}`, title: `${esc(o.no)} · ${esc(o.kendaraan?.plat || '')}`, sub: `${esc(pelNama(o.pelangganId))} · ${esc(kendaraanLabel(o.kendaraan))}`, right: statusBadge(o.status) });
  if (tek) return out;
  for (const b of cache.barang.filter((b) => has(b.kode, b.nama, b.merkMobil, b.kategori)).slice(0, 6))
    out.push({ group: 'Barang & Jasa', icon: b.jenis === 'jasa' ? 'wrench' : 'package', href: b.jenis === 'jasa' ? '#/master/barang' : `#/stok/${b.id}`, title: `${esc(b.kode)} · ${esc(b.nama)}`, sub: `${esc(b.kategori)} · ${rp(b.hargaJual)}${b.jenis !== 'jasa' ? ' · lihat kartu stok' : ''}` });
  for (const c of cache.pelanggan.filter((c) => has(c.nama, c.telp, c.email)).slice(0, 5))
    out.push({ group: 'Pelanggan', icon: 'user', href: `#/master/pelanggan?id=${c.id}`, title: esc(c.nama), sub: `${esc(c.tipe || '')} · ${esc(c.telp || '')}` });
  for (const p of cache.pembelian.filter((p) => has(p.no, p.noFaktur, byId('supplier', p.supplierId)?.nama, ...p.items.map((i) => i.nama))).slice(0, 5))
    out.push({ group: 'Pembelian', icon: 'shopping-cart', href: `#/pembelian/${p.id}`, title: esc(p.no), sub: `${esc(byId('supplier', p.supplierId)?.nama || '')} · ${rp(p.total)}` });
  for (const s of cache.supplier.filter((s) => has(s.nama, s.kontak, s.telp)).slice(0, 4))
    out.push({ group: 'Supplier', icon: 'truck', href: '#/master/supplier', title: esc(s.nama), sub: esc(s.telp || '') });
  return out;
}

// ---------- Router ----------
function match(hash) {
  const [pathPart, queryPart] = hash.replace(/^#\/?/, '').split('?');
  const parts = pathPart.split('/').filter(Boolean);
  for (const r of ROUTES) {
    const rp_ = r.path.split('/');
    if (rp_.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rp_.length; i++) {
      if (rp_[i].startsWith(':')) params[rp_[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (rp_[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { r, params, query: Object.fromEntries(new URLSearchParams(queryPart || '')) };
  }
  return null;
}

let routeSeq = 0;
async function route() {
  if (!state.user) return renderLogin();
  const m = match(location.hash);
  if (!m) { location.hash = '#/' + homeFor(state.user.role); return; }
  if (!m.r.roles.includes(state.user.role)) { toast('Anda tidak memiliki akses ke halaman tersebut', 'error'); location.hash = '#/' + homeFor(state.user.role); return; }
  const seq = ++routeSeq;
  const navKey = typeof m.r.nav === 'function' ? m.r.nav(m.params) : m.r.nav;
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));
  const view = document.getElementById('view');
  const mod = await m.r.mod();
  if (seq !== routeSeq) return;
  const keepScroll = view.dataset.path === location.hash;
  const y = window.scrollY;
  releaseUrls();
  const root = document.createElement('div');
  view.replaceChildren(root);
  view.dataset.path = location.hash;
  state.rerender = () => route();
  try {
    await mod[m.r.fn || 'render'](root, m.params, m.query);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="card"><div class="card-body"><div class="alert alert-danger"><i data-lucide="alert-triangle"></i><div><b>Terjadi kesalahan.</b> ${esc(err.message)}</div></div></div></div>`;
  }
  renderNav();
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));
  icons();
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

// ---------- Init ----------
async function init() {
  try {
    await loadAll();
    const seeded = await seedIfEmpty();
    const sid = (() => { try { return localStorage.getItem('bjg-session'); } catch (e) { return null; } })();
    const u = sid && byId('users', sid);
    if (u && u.aktif !== false) {
      state.user = u;
      renderShell();
      if (!location.hash || location.hash === '#/login') location.hash = '#/' + homeFor(u.role);
      else route();
    } else renderLogin();
    if (seeded) setTimeout(() => toast('Data demo telah dimuat. Anda dapat mengosongkannya di Pengaturan.', 'info'), 600);
  } catch (err) {
    console.error(err);
    document.getElementById('app').innerHTML = `<div style="padding:40px;font-family:sans-serif"><h2>Gagal memuat aplikasi</h2><p>${esc(err.message)}</p><p>Pastikan browser mendukung IndexedDB dan tidak dalam mode private.</p></div>`;
  }
}
window.addEventListener('hashchange', () => { document.querySelector('.modal-overlay')?.remove(); route(); });
init();
