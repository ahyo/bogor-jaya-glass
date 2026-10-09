import { cache, byId, save, remove } from '../db.js';
import { rp, num, esc, options, toast, emptyState, formModal, confirmDlg, debounce, exportCSV, todayStr, fmtDate, modal, initials } from '../utils.js';
import { KATEGORI, stockMap, ppnBadge, statusBadge, payBadge, paid, kendaraanLabel, sisa } from '../calc.js';
import { can } from '../state.js';
import { historyCard } from './pembelian.js';

const CONFIG = {
  barang: {
    store: 'barang', title: 'Barang & Jasa', singular: 'Barang/Jasa', icon: 'package',
    desc: 'Master barang (kaca, kaca film, bahan) dan jasa pemasangan. Tandai barang kena pajak (PPN).',
    filters: [['Semua', () => true], ['Barang', (b) => b.jenis !== 'jasa'], ['Jasa', (b) => b.jenis === 'jasa'], ['Kena PPN', (b) => b.kenaPajak], ['Non-PPN', (b) => !b.kenaPajak], ['Nonaktif', (b) => b.aktif === false]],
    search: (b) => [b.kode, b.nama, b.kategori, b.merkMobil],
    sort: (a, b) => (a.jenis || '').localeCompare(b.jenis || '') || a.kode.localeCompare(b.kode),
    fields: () => [
      { name: 'kode', label: 'Kode', required: true, col: 4, placeholder: 'KD-AVZ' },
      { name: 'nama', label: 'Nama Barang / Jasa', required: true, col: 8 },
      { name: 'jenis', label: 'Jenis', type: 'select', options: [['barang', 'Barang (ada stok)'], ['jasa', 'Jasa (tanpa stok)']], col: 4, def: 'barang' },
      { name: 'kategori', label: 'Kategori', type: 'select', options: KATEGORI, col: 4 },
      { name: 'satuan', label: 'Satuan', col: 4, def: 'pcs' },
      { name: 'merkMobil', label: 'Cocok untuk Kendaraan', col: 12, placeholder: 'cth: Toyota Avanza / Daihatsu Xenia 2012–2021' },
      { name: 'hargaBeli', label: 'Harga Beli (HPP)', type: 'number', col: 6, onlyBarang: true },
      { name: 'hargaJual', label: 'Harga Jual', type: 'number', col: 6, required: true },
      { name: 'stokAwal', label: 'Stok Awal', type: 'number', col: 6, onlyBarang: true, help: 'Stok saat mulai menggunakan sistem' },
      { name: 'stokMin', label: 'Stok Minimum', type: 'number', col: 6, onlyBarang: true, help: 'Peringatan stok menipis' },
      { name: 'kenaPajak', label: 'Barang/Jasa Kena Pajak (PPN)', type: 'toggle', col: 12, help: 'PPN otomatis dihitung pada penjualan & pembelian item ini', def: true },
      { name: 'aktif', label: 'Aktif', type: 'toggle', col: 12, help: 'Nonaktifkan agar tidak muncul di pilihan transaksi', def: true },
    ],
    columns: () => {
      const sm = stockMap();
      return [
        ['Kode', (b) => `<span class="mono strong">${esc(b.kode)}</span>`],
        ['Nama', (b) => `<div class="cell-title">${esc(b.nama)}</div><div class="cell-sub">${esc(b.merkMobil || b.kategori)}</div>`],
        ['Jenis', (b) => `${b.jenis === 'jasa' ? '<span class="badge b-purple">Jasa</span>' : '<span class="badge b-gray">Barang</span>'} <span class="muted small">${esc(b.kategori || '')}</span>`],
        ['Pajak', (b) => (b.kenaPajak ? ppnBadge() : '<span class="badge b-gray">Non-PPN</span>')],
        ['Harga Beli', (b) => (b.jenis === 'jasa' ? '-' : rp(b.hargaBeli)), 'r'],
        ['Harga Jual', (b) => `<b>${rp(b.hargaJual)}</b>`, 'r'],
        ['Stok', (b) => (b.jenis === 'jasa' ? '<span class="muted">—</span>' : `<span class="badge ${sm[b.id] <= 0 ? 'b-red' : sm[b.id] <= (+b.stokMin || 0) ? 'b-amber' : 'b-green'}">${num(sm[b.id])} ${esc(b.satuan)}</span>`), 'r'],
      ];
    },
    rowActions: (b) => (b.jenis !== 'jasa' ? `<a class="btn-icon sm" href="#/stok/${b.id}" title="Kartu stok"><i data-lucide="history"></i></a>` : ''),
    inUse: (id) => cache.orders.some((o) => o.items.some((i) => i.barangId === id)) || cache.pembelian.some((p) => p.items.some((i) => i.barangId === id)) || cache.opname.some((a) => a.barangId === id),
    validate: (d, id) => (cache.barang.some((b) => b.kode.toLowerCase() === d.kode.toLowerCase() && b.id !== id) ? 'Kode sudah digunakan' : null),
    csv: (b, sm) => [b.kode, b.nama, b.jenis, b.kategori, b.merkMobil, b.satuan, b.hargaBeli, b.hargaJual, b.kenaPajak ? 'Ya' : 'Tidak', b.jenis === 'jasa' ? '' : sm[b.id]],
    csvHead: ['Kode', 'Nama', 'Jenis', 'Kategori', 'Kendaraan', 'Satuan', 'Harga Beli', 'Harga Jual', 'Kena PPN', 'Stok'],
  },
  pelanggan: {
    store: 'pelanggan', title: 'Pelanggan', singular: 'Pelanggan', icon: 'users',
    desc: 'Data pelanggan perorangan, perusahaan, dan asuransi beserta riwayat transaksinya.',
    filters: [['Semua', () => true], ['Perorangan', (c) => c.tipe === 'Perorangan'], ['Perusahaan', (c) => c.tipe === 'Perusahaan'], ['Asuransi', (c) => c.tipe === 'Asuransi']],
    search: (c) => [c.nama, c.telp, c.email, c.alamat, ...cache.orders.filter((o) => o.pelangganId === c.id).map((o) => o.kendaraan?.plat)],
    sort: (a, b) => a.nama.localeCompare(b.nama),
    fields: () => [
      { name: 'nama', label: 'Nama', required: true, col: 8 },
      { name: 'tipe', label: 'Tipe', type: 'select', options: ['Perorangan', 'Perusahaan', 'Asuransi'], col: 4 },
      { name: 'telp', label: 'No. HP / WA', col: 6 },
      { name: 'email', label: 'Email', col: 6 },
      { name: 'alamat', label: 'Alamat', type: 'textarea', col: 12 },
      { name: 'npwp', label: 'NPWP', col: 12, help: 'Diisi untuk pelanggan yang membutuhkan faktur pajak' },
    ],
    columns: () => [
      ['Nama', (c) => `<div class="flex"><span class="avatar">${esc(initials(c.nama))}</span><div><div class="cell-title">${esc(c.nama)}</div><div class="cell-sub">${esc(c.alamat || '')}</div></div></div>`],
      ['Tipe', (c) => `<span class="badge ${c.tipe === 'Asuransi' ? 'b-purple' : c.tipe === 'Perusahaan' ? 'b-blue' : 'b-gray'}">${esc(c.tipe || '-')}</span>`],
      ['Kontak', (c) => `${esc(c.telp || '-')}<div class="cell-sub">${esc(c.email || '')}</div>`],
      ['Order', (c) => num(cache.orders.filter((o) => o.pelangganId === c.id && o.status !== 'Batal').length), 'r'],
      ['Total Belanja', (c) => `<b>${rp(cache.orders.filter((o) => o.pelangganId === c.id && o.status === 'Selesai').reduce((a, o) => a + o.total, 0))}</b>`, 'r'],
      ['Piutang', (c) => { const p = cache.orders.filter((o) => o.pelangganId === c.id && o.status !== 'Batal').reduce((a, o) => a + sisa(o), 0); return p ? `<span class="text-danger strong">${rp(p)}</span>` : '<span class="muted">-</span>'; }, 'r'],
    ],
    detail: (c) => {
      const orders = cache.orders.filter((o) => o.pelangganId === c.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const plates = [...new Set(orders.map((o) => o.kendaraan?.plat).filter(Boolean))];
      return `<dl class="info-list mb-2"><dt>Tipe</dt><dd>${esc(c.tipe || '-')}</dd><dt>Telp</dt><dd>${esc(c.telp || '-')}</dd><dt>Email</dt><dd>${esc(c.email || '-')}</dd><dt>Alamat</dt><dd>${esc(c.alamat || '-')}</dd><dt>NPWP</dt><dd>${esc(c.npwp || '-')}</dd>
        <dt>Kendaraan</dt><dd>${plates.map((p) => `<span class="plate">${esc(p)}</span>`).join(' ') || '-'}</dd></dl>
        <h4 class="mb-2">Riwayat Order (${orders.length})</h4>
        ${orders.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>No</th><th>Tanggal</th><th>Kendaraan</th><th class="r">Total</th><th>Bayar</th><th>Status</th></tr></thead><tbody>
        ${orders.map((o) => `<tr class="clickable" data-href="#/orders/${o.id}"><td class="strong">${esc(o.no)}</td><td>${fmtDate(o.tanggal)}</td><td><span class="plate">${esc(o.kendaraan?.plat || '')}</span> ${esc(kendaraanLabel(o.kendaraan))}</td><td class="r">${rp(o.total)}</td><td>${payBadge(o)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">Belum ada order.</p>'}`;
    },
    inUse: (id) => cache.orders.some((o) => o.pelangganId === id),
    csv: (c) => [c.nama, c.tipe, c.telp, c.email, c.alamat, c.npwp],
    csvHead: ['Nama', 'Tipe', 'Telp', 'Email', 'Alamat', 'NPWP'],
  },
  supplier: {
    store: 'supplier', title: 'Supplier', singular: 'Supplier', icon: 'truck',
    desc: 'Pemasok kaca, kaca film, dan bahan pendukung.',
    filters: [['Semua', () => true], ['PKP', (s) => s.pkp], ['Non-PKP', (s) => !s.pkp]],
    search: (s) => [s.nama, s.kontak, s.telp, s.alamat],
    sort: (a, b) => a.nama.localeCompare(b.nama),
    fields: () => [
      { name: 'nama', label: 'Nama Supplier', required: true, col: 8 },
      { name: 'kontak', label: 'Contact Person', col: 4 },
      { name: 'telp', label: 'Telp', col: 6 },
      { name: 'npwp', label: 'NPWP', col: 6 },
      { name: 'alamat', label: 'Alamat', type: 'textarea', col: 12 },
      { name: 'pkp', label: 'Pengusaha Kena Pajak (PKP)', type: 'toggle', col: 12, help: 'Jika tidak PKP, pembelian dari supplier ini tanpa PPN Masukan', def: true },
    ],
    columns: () => [
      ['Nama', (s) => `<div class="cell-title">${esc(s.nama)}</div><div class="cell-sub">${esc(s.alamat || '')}</div>`],
      ['Kontak', (s) => `${esc(s.kontak || '-')}<div class="cell-sub">${esc(s.telp || '')}</div>`],
      ['Pajak', (s) => (s.pkp ? '<span class="badge b-cyan">PKP</span>' : '<span class="badge b-gray">Non-PKP</span>')],
      ['Total Pembelian', (s) => rp(cache.pembelian.filter((p) => p.supplierId === s.id && p.status !== 'Batal').reduce((a, p) => a + p.total, 0)), 'r'],
      ['Hutang', (s) => { const h = cache.pembelian.filter((p) => p.supplierId === s.id && p.status !== 'Batal').reduce((a, p) => a + sisa(p), 0); return h ? `<span class="text-danger strong">${rp(h)}</span>` : '-'; }, 'r'],
    ],
    detail: (s) => {
      const list = cache.pembelian.filter((p) => p.supplierId === s.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      return `<dl class="info-list mb-2"><dt>Kontak</dt><dd>${esc(s.kontak || '-')}</dd><dt>Telp</dt><dd>${esc(s.telp || '-')}</dd><dt>NPWP</dt><dd>${esc(s.npwp || '-')}</dd><dt>Alamat</dt><dd>${esc(s.alamat || '-')}</dd></dl>
      <h4 class="mb-2">Riwayat Pembelian (${list.length})</h4>
      ${list.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>No</th><th>Tanggal</th><th>Item</th><th class="r">Total</th><th>Bayar</th></tr></thead><tbody>
      ${list.map((p) => `<tr class="clickable" data-href="#/pembelian/${p.id}"><td class="strong">${esc(p.no)}</td><td>${fmtDate(p.tanggal)}</td><td class="cell-sub">${esc(p.items.map((i) => i.nama).join(', '))}</td><td class="r">${rp(p.total)}</td><td>${p.status === 'Batal' ? '<span class="badge b-red">Batal</span>' : payBadge(p)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Belum ada pembelian.</p>'}`;
    },
    inUse: (id) => cache.pembelian.some((p) => p.supplierId === id),
    csv: (s) => [s.nama, s.kontak, s.telp, s.alamat, s.npwp, s.pkp ? 'PKP' : 'Non-PKP'],
    csvHead: ['Nama', 'Kontak', 'Telp', 'Alamat', 'NPWP', 'Status'],
  },
  pegawai: {
    store: 'pegawai', title: 'Pegawai', singular: 'Pegawai', icon: 'id-card',
    desc: 'Data teknisi dan staf. Teknisi dapat ditugaskan pada order pemasangan.',
    filters: [['Semua', () => true], ['Teknisi', (p) => p.jabatan === 'Teknisi'], ['Staf', (p) => p.jabatan !== 'Teknisi'], ['Nonaktif', (p) => p.aktif === false]],
    search: (p) => [p.nama, p.jabatan, p.telp],
    sort: (a, b) => a.nama.localeCompare(b.nama),
    fields: () => [
      { name: 'nama', label: 'Nama Lengkap', required: true, col: 8 },
      { name: 'jabatan', label: 'Jabatan', type: 'select', options: ['Teknisi', 'Kasir', 'Admin', 'Manajer', 'Lainnya'], col: 4 },
      { name: 'telp', label: 'No. HP', col: 6 },
      { name: 'tglMasuk', label: 'Tanggal Masuk', type: 'date', col: 6 },
      { name: 'gaji', label: 'Gaji Pokok / Bulan', type: 'number', col: 6 },
      { name: 'alamat', label: 'Alamat', col: 6 },
      { name: 'aktif', label: 'Aktif', type: 'toggle', col: 12, def: true },
    ],
    columns: () => [
      ['Nama', (p) => `<div class="flex"><span class="avatar">${esc(initials(p.nama))}</span><div><div class="cell-title">${esc(p.nama)}</div><div class="cell-sub">${esc(p.telp || '')}</div></div></div>`],
      ['Jabatan', (p) => `<span class="badge ${p.jabatan === 'Teknisi' ? 'b-blue' : 'b-gray'}">${esc(p.jabatan)}</span> ${p.aktif === false ? '<span class="badge b-red">Nonaktif</span>' : ''}`],
      ['Pekerjaan Selesai', (p) => num(cache.orders.filter((o) => o.status === 'Selesai' && o.teknisiIds?.includes(p.id)).length), 'r'],
      ['Aktif', (p) => num(cache.orders.filter((o) => ['Dijadwalkan', 'Dikerjakan'].includes(o.status) && o.teknisiIds?.includes(p.id)).length), 'r'],
      ['Gaji', (p) => rp(p.gaji), 'r'],
    ],
    detail: (p) => {
      const list = cache.orders.filter((o) => o.teknisiIds?.includes(p.id)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      return `<dl class="info-list mb-2"><dt>Jabatan</dt><dd>${esc(p.jabatan)}</dd><dt>Telp</dt><dd>${esc(p.telp || '-')}</dd><dt>Masuk</dt><dd>${fmtDate(p.tglMasuk)}</dd><dt>Akun login</dt><dd>${esc(cache.users.find((u) => u.pegawaiId === p.id)?.username || '-')}</dd></dl>
      <h4 class="mb-2">Riwayat Pekerjaan (${list.length})</h4>
      ${list.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>No</th><th>Tanggal</th><th>Kendaraan</th><th>Status</th></tr></thead><tbody>
      ${list.map((o) => `<tr class="clickable" data-href="#/orders/${o.id}"><td class="strong">${esc(o.no)}</td><td>${fmtDate(o.tanggal)}</td><td><span class="plate">${esc(o.kendaraan?.plat || '')}</span> ${esc(kendaraanLabel(o.kendaraan))}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Belum ada pekerjaan.</p>'}`;
    },
    inUse: (id) => cache.orders.some((o) => o.teknisiIds?.includes(id)) || cache.users.some((u) => u.pegawaiId === id),
    csv: (p) => [p.nama, p.jabatan, p.telp, p.tglMasuk, p.gaji, p.aktif === false ? 'Nonaktif' : 'Aktif'],
    csvHead: ['Nama', 'Jabatan', 'Telp', 'Tgl Masuk', 'Gaji', 'Status'],
  },
};

const ui = {};

export function render(root, { type }, query = {}) {
  const cfg = CONFIG[type];
  if (!cfg) { root.innerHTML = emptyState('file-x', 'Halaman tidak ditemukan'); return; }
  if (type === 'pegawai' && !can('admin')) { root.innerHTML = emptyState('lock', 'Akses terbatas'); return; }
  const st = (ui[type] ||= { q: '', f: 'Semua' });

  root.innerHTML = `
  <div class="page-header">
    <div><h1>${cfg.title}</h1><p>${cfg.desc}</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button><button class="btn btn-primary" data-act="add"><i data-lucide="plus"></i> Tambah ${cfg.singular}</button></div>
  </div>
  <div class="card">
    <div class="toolbar">
      <div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari ${cfg.singular.toLowerCase()}…" value="${esc(st.q)}"></div>
      <div class="tabs">${cfg.filters.map(([f]) => `<button class="tab ${st.f === f ? 'active' : ''}" data-f="${f}">${f}<span class="n">${cache[cfg.store].filter(cfg.filters.find((x) => x[0] === f)[1]).length}</span></button>`).join('')}</div>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr>${cfg.columns().map(([h, , c]) => `<th class="${c || ''}">${h}</th>`).join('')}<th></th></tr></thead><tbody id="rows"></tbody></table></div>
  </div>`;

  const list = () => {
    const q = st.q.toLowerCase();
    const fn = cfg.filters.find((x) => x[0] === st.f)?.[1] || (() => true);
    return cache[cfg.store].filter((x) => fn(x) && (!q || cfg.search(x).some((v) => String(v || '').toLowerCase().includes(q)))).sort(cfg.sort);
  };
  const draw = () => {
    const cols = cfg.columns();
    const l = list();
    root.querySelector('#rows').innerHTML = l.length ? l.map((x) => `<tr class="${cfg.detail ? 'clickable' : ''}" data-id="${x.id}" style="${x.aktif === false ? 'opacity:.6' : ''}">${cols.map(([, f, c]) => `<td class="${c || ''}">${f(x)}</td>`).join('')}
      <td class="actions">${cfg.rowActions?.(x) || ''}<button class="btn-icon sm" data-edit="${x.id}" title="Ubah"><i data-lucide="pencil"></i></button><button class="btn-icon sm danger" data-del="${x.id}" title="Hapus"><i data-lucide="trash-2"></i></button></td></tr>`).join('')
      : `<tr><td colspan="${cols.length + 1}">${emptyState(cfg.icon, `Belum ada data ${cfg.singular.toLowerCase()}`)}</td></tr>`;
    window.lucide?.createIcons();
  };
  draw();

  root.querySelector('#q').addEventListener('input', debounce((e) => { st.q = e.target.value; draw(); }, 150));
  root.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]');
    if (f) { st.f = f.dataset.f; root.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('active', b === f)); draw(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) return openForm(cfg, byId(cfg.store, ed.dataset.edit), draw);
    const del = e.target.closest('[data-del]');
    if (del) {
      const item = byId(cfg.store, del.dataset.del);
      if (cfg.inUse?.(item.id)) {
        if ('aktif' in item || cfg.fields().some((x) => x.name === 'aktif')) {
          if (await confirmDlg(`${item.nama} sudah dipakai di transaksi sehingga tidak dapat dihapus. Nonaktifkan saja?`, { okText: 'Nonaktifkan', danger: false })) {
            item.aktif = false;
            await save(cfg.store, item, { log: { aksi: 'Nonaktifkan' } });
            toast('Data dinonaktifkan');
            draw();
          }
        } else toast('Data sudah dipakai di transaksi, tidak dapat dihapus', 'error');
        return;
      }
      if (!(await confirmDlg(`Hapus ${item.nama}?`, { okText: 'Hapus' }))) return;
      await remove(cfg.store, item.id);
      toast('Data dihapus');
      return draw();
    }
    if (e.target.closest('a')) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') return openForm(cfg, null, draw);
    if (act === 'csv') { const sm = stockMap(); return exportCSV(`${type}-${todayStr()}.csv`, [cfg.csvHead, ...list().map((x) => cfg.csv(x, sm))]); }
    const tr = e.target.closest('tr[data-id]');
    if (tr && cfg.detail) openDetail(cfg, byId(cfg.store, tr.dataset.id), draw);
  });
  if (query.id && byId(cfg.store, query.id) && cfg.detail) openDetail(cfg, byId(cfg.store, query.id), draw);
}

function openDetail(cfg, item, draw) {
  const m = modal({
    title: item.nama, size: 'lg',
    body: cfg.detail(item) + historyCard(cfg.store, item.id).replace('<section class="card">', '<section class="card mt-2">'),
    footer: `<button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-primary" data-edit><i data-lucide="pencil"></i> Ubah</button>`,
  });
  m.el.addEventListener('click', (e) => {
    const h = e.target.closest('[data-href]');
    if (h) { location.hash = h.dataset.href; }
    if (e.target.closest('[data-edit]')) { m.close(); openForm(cfg, item, draw); }
  });
}

function fieldHTML(f, v) {
  const val = v ?? f.def ?? '';
  const wrap = (inner) => `<div class="field col-${f.col || 12} ${f.onlyBarang ? 'only-barang' : ''}">${f.type === 'toggle' ? '' : `<label>${f.label}${f.required ? ' *' : ''}</label>`}${inner}${f.help && f.type !== 'toggle' ? `<div class="help">${f.help}</div>` : ''}</div>`;
  if (f.type === 'select') return wrap(`<select name="${f.name}">${options(f.options, val)}</select>`);
  if (f.type === 'textarea') return wrap(`<textarea name="${f.name}" rows="2">${esc(val)}</textarea>`);
  if (f.type === 'toggle') return wrap(`<label class="toggle"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''}><span class="sw"></span><span class="t-label"><b>${f.label}</b>${f.help ? `<small>${f.help}</small>` : ''}</span></label>`);
  return wrap(`<input name="${f.name}" type="${f.type || 'text'}" ${f.type === 'number' ? 'min="0" step="any"' : ''} value="${esc(val)}" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}">`);
}

function openForm(cfg, item, draw) {
  const fields = cfg.fields();
  formModal({
    title: item ? `Ubah ${cfg.singular}` : `Tambah ${cfg.singular}`, size: 'lg',
    body: `<div class="form-grid">${fields.map((f) => fieldHTML(f, item?.[f.name])).join('')}</div>`,
    onMount: ({ el }) => {
      const jenis = el.querySelector('[name=jenis]');
      if (!jenis) return;
      const sync = () => {
        el.querySelectorAll('.only-barang').forEach((x) => x.classList.toggle('hide', jenis.value === 'jasa'));
        if (jenis.value === 'jasa') el.querySelector('[name=kategori]').value = 'Jasa';
      };
      jenis.addEventListener('change', sync);
      sync();
    },
    onSubmit: async (d) => {
      const err = cfg.validate?.(d, item?.id);
      if (err) { toast(err, 'error'); return false; }
      const changes = item ? fields.filter((f) => String(item[f.name] ?? '') !== String(d[f.name] ?? '')).map((f) => `${f.label}: ${f.type === 'toggle' ? (d[f.name] ? 'Ya' : 'Tidak') : d[f.name]}`).join('; ') : '';
      const obj = item ? Object.assign(item, d) : d;
      await save(cfg.store, obj, { log: { detail: changes } });
      toast(item ? 'Data diperbarui' : 'Data ditambahkan');
      draw();
    },
  });
}
