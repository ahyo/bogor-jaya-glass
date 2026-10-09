import { cache, byId, save, remove, nextNo } from '../db.js';
import { rp, num, esc, todayStr, fmtDate, options, toast, emptyState, formModal, confirmDlg, debounce, exportCSV, fmtDateTime } from '../utils.js';
import { stockMovements, stockMap, ppnBadge, KATEGORI } from '../calc.js';
import { state, can } from '../state.js';
import { printReport } from '../print.js';
import { historyCard } from './pembelian.js';

const ui = { from: todayStr().slice(0, 8) + '01', to: todayStr(), q: '', kat: '', filter: 'Semua' };

// ---------- Laporan stok ----------
export function renderLaporan(root) {
  root.innerHTML = `
  <div class="page-header">
    <div><h1>Laporan Stok</h1><p>Posisi stok, mutasi masuk/keluar, dan nilai persediaan per periode.</p></div>
    <div class="actions">
      <button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button>
      <button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button>
      <a class="btn btn-primary" href="#/stok/opname"><i data-lucide="clipboard-list"></i> Stok Opname</a>
    </div>
  </div>
  <div class="kpis" id="kpis"></div>
  <div class="card">
    <div class="toolbar">
      <div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari kode, nama, kendaraan…" value="${esc(ui.q)}"></div>
      <select id="kat">${options(KATEGORI.filter((k) => k !== 'Jasa'), ui.kat, 'Semua kategori')}</select>
      <div class="flex"><span class="muted small">Periode</span><input type="date" id="from" value="${ui.from}"><span class="muted small">s/d</span><input type="date" id="to" value="${ui.to}"></div>
    </div>
    <div class="toolbar"><div class="tabs">${['Semua', 'Menipis', 'Habis', 'Ada Mutasi'].map((f) => `<button class="tab ${ui.filter === f ? 'active' : ''}" data-filter="${f}">${f}</button>`).join('')}</div></div>
    <div class="table-wrap" id="tbl"></div>
  </div>`;

  const compute = () => {
    const mv = stockMovements();
    const rows = cache.barang.filter((b) => b.jenis !== 'jasa').map((b) => {
      const m = mv.filter((x) => x.barangId === b.id);
      const awal = m.filter((x) => x.tanggal < ui.from).reduce((a, x) => a + x.masuk - x.keluar, 0);
      const inP = m.filter((x) => x.tanggal >= ui.from && x.tanggal <= ui.to);
      const masuk = inP.reduce((a, x) => a + x.masuk, 0);
      const keluar = inP.reduce((a, x) => a + x.keluar, 0);
      const akhir = awal + masuk - keluar;
      return { b, awal, masuk, keluar, akhir, nilai: akhir * (+b.hargaBeli || 0), nilaiJual: akhir * (+b.hargaJual || 0), mutasi: inP.length };
    });
    const q = ui.q.toLowerCase();
    return rows.filter((r) => {
      if (ui.kat && r.b.kategori !== ui.kat) return false;
      if (q && ![r.b.kode, r.b.nama, r.b.merkMobil].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      if (ui.filter === 'Menipis' && !(r.akhir <= (+r.b.stokMin || 0) && r.akhir > 0)) return false;
      if (ui.filter === 'Habis' && r.akhir > 0) return false;
      if (ui.filter === 'Ada Mutasi' && !r.mutasi) return false;
      return true;
    }).sort((a, b) => a.b.kode.localeCompare(b.b.kode));
  };
  const tableHTML = (rows) => `<table class="table">
    <thead><tr><th>Kode</th><th>Barang</th><th class="r">Stok Awal</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Stok Akhir</th><th class="r">Min</th><th class="r">HPP</th><th class="r">Nilai Persediaan</th><th></th></tr></thead>
    <tbody>${rows.length ? rows.map((r) => `<tr class="clickable" data-href="#/stok/${r.b.id}">
      <td class="mono strong">${esc(r.b.kode)}</td>
      <td><div class="cell-title">${esc(r.b.nama)} ${r.b.kenaPajak ? ppnBadge() : ''}</div><div class="cell-sub">${esc(r.b.kategori)} · ${esc(r.b.merkMobil || '')}</div></td>
      <td class="r">${num(r.awal)}</td><td class="r text-success">${r.masuk ? '+' + num(r.masuk) : '-'}</td><td class="r text-danger">${r.keluar ? '−' + num(r.keluar) : '-'}</td>
      <td class="r"><span class="badge ${r.akhir <= 0 ? 'b-red' : r.akhir <= (+r.b.stokMin || 0) ? 'b-amber' : 'b-green'}">${num(r.akhir)} ${esc(r.b.satuan)}</span></td>
      <td class="r muted">${num(r.b.stokMin)}</td><td class="r">${rp(r.b.hargaBeli)}</td><td class="r strong">${rp(r.nilai)}</td>
      <td class="actions"><i data-lucide="chevron-right" class="muted"></i></td></tr>`).join('') : `<tr><td colspan="10">${emptyState('package-search', 'Tidak ada barang')}</td></tr>`}</tbody>
    <tfoot><tr><td colspan="3">Total (${rows.length} barang)</td><td class="r">${num(rows.reduce((a, r) => a + r.masuk, 0))}</td><td class="r">${num(rows.reduce((a, r) => a + r.keluar, 0))}</td><td class="r">${num(rows.reduce((a, r) => a + r.akhir, 0))}</td><td></td><td></td><td class="r">${rp(rows.reduce((a, r) => a + r.nilai, 0))}</td><td></td></tr></tfoot>
  </table>`;
  const draw = () => {
    const rows = compute();
    const all = cache.barang.filter((b) => b.jenis !== 'jasa' && b.aktif !== false);
    const sm = stockMap();
    root.querySelector('#kpis').innerHTML = `
      <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="boxes"></i></div><div><div class="label">Jenis Barang</div><div class="value">${all.length}</div><div class="sub">${num(all.reduce((a, b) => a + Math.max(0, sm[b.id] || 0), 0))} unit tersedia</div></div></div>
      <div class="card kpi"><div class="kpi-ic ic-green"><i data-lucide="landmark"></i></div><div><div class="label">Nilai Persediaan (HPP)</div><div class="value">${rp(all.reduce((a, b) => a + (sm[b.id] || 0) * (+b.hargaBeli || 0), 0))}</div><div class="sub">Nilai jual ${rp(all.reduce((a, b) => a + (sm[b.id] || 0) * (+b.hargaJual || 0), 0))}</div></div></div>
      <div class="card kpi"><div class="kpi-ic ic-amber"><i data-lucide="alert-triangle"></i></div><div><div class="label">Stok Menipis</div><div class="value">${all.filter((b) => sm[b.id] > 0 && sm[b.id] <= (+b.stokMin || 0)).length}</div></div></div>
      <div class="card kpi"><div class="kpi-ic ic-red"><i data-lucide="package-x"></i></div><div><div class="label">Stok Habis</div><div class="value">${all.filter((b) => (sm[b.id] || 0) <= 0).length}</div></div></div>`;
    root.querySelector('#tbl').innerHTML = tableHTML(rows);
    window.lucide?.createIcons();
    return rows;
  };
  draw();
  root.querySelector('#q').addEventListener('input', debounce((e) => { ui.q = e.target.value; draw(); }, 150));
  root.querySelector('#kat').addEventListener('change', (e) => { ui.kat = e.target.value; draw(); });
  root.querySelector('#from').addEventListener('change', (e) => { ui.from = e.target.value; draw(); });
  root.querySelector('#to').addEventListener('change', (e) => { ui.to = e.target.value; draw(); });
  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) { ui.filter = f.dataset.filter; root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === f)); draw(); return; }
    const tr = e.target.closest('[data-href]');
    if (tr) location.hash = tr.dataset.href;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'csv') exportCSV(`laporan-stok-${ui.from}-${ui.to}.csv`, [['Kode', 'Barang', 'Kategori', 'Satuan', 'Stok Awal', 'Masuk', 'Keluar', 'Stok Akhir', 'Stok Min', 'HPP', 'Nilai Persediaan', 'Kena PPN'],
      ...compute().map((r) => [r.b.kode, r.b.nama, r.b.kategori, r.b.satuan, r.awal, r.masuk, r.keluar, r.akhir, r.b.stokMin, r.b.hargaBeli, r.nilai, r.b.kenaPajak ? 'Ya' : 'Tidak'])]);
    if (act === 'print') printReport('LAPORAN STOK BARANG', `Periode ${fmtDate(ui.from)} – ${fmtDate(ui.to)}`, tableHTML(compute()));
  });
}

// ---------- Kartu stok (history per barang) ----------
export function renderKartu(root, { id }) {
  const b = byId('barang', id);
  if (!b || b.jenis === 'jasa') { root.innerHTML = emptyState('package-x', 'Barang tidak ditemukan', '', '<a class="btn btn-ghost" href="#/stok">Kembali</a>'); return; }
  const st = { from: '', to: '', jenis: '' };
  root.innerHTML = `
  <div class="page-header">
    <div><a class="back-link" href="#/stok"><i data-lucide="arrow-left"></i> Laporan Stok</a>
      <div class="flex flex-wrap"><h1>${esc(b.nama)}</h1>${b.kenaPajak ? ppnBadge() : '<span class="badge b-gray">Non-PPN</span>'}${b.aktif === false ? '<span class="badge b-red">Nonaktif</span>' : ''}</div>
      <p><span class="mono">${esc(b.kode)}</span> · ${esc(b.kategori)} · ${esc(b.merkMobil || '')}</p></div>
    <div class="actions">
      <button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak Kartu Stok</button>
      <button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button>
      <button class="btn btn-primary" data-act="adjust"><i data-lucide="sliders-horizontal"></i> Penyesuaian Stok</button>
    </div>
  </div>
  <div class="kpis" id="kpis"></div>
  <div class="grid grid-main">
    <div class="card">
      <div class="card-header"><h3><i data-lucide="history"></i> Kartu Stok (Riwayat Mutasi)</h3></div>
      <div class="toolbar">
        <select id="jenis">${options(['Stok Awal', 'Pembelian', 'Penjualan', 'Opname', 'Rusak', 'Penyesuaian'], '', 'Semua jenis mutasi')}</select>
        <div class="flex"><input type="date" id="from"><span class="muted small">s/d</span><input type="date" id="to"></div>
      </div>
      <div class="table-wrap" id="tbl"></div>
    </div>
    <div class="stack">
      <section class="card"><div class="card-header"><h3><i data-lucide="info"></i> Detail Barang</h3><a class="btn btn-ghost btn-sm" href="#/master/barang">Master</a></div>
        <div class="card-body"><dl class="info-list">
          <dt>Satuan</dt><dd>${esc(b.satuan)}</dd><dt>Harga Beli (HPP)</dt><dd>${rp(b.hargaBeli)}</dd><dt>Harga Jual</dt><dd>${rp(b.hargaJual)}</dd>
          <dt>Margin</dt><dd>${b.hargaJual ? Math.round(((b.hargaJual - b.hargaBeli) / b.hargaJual) * 100) : 0}%</dd>
          <dt>Stok Awal</dt><dd>${num(b.stokAwal)}</dd><dt>Stok Minimum</dt><dd>${num(b.stokMin)}</dd></dl></div></section>
      ${historyCard('barang', b.id)}
    </div>
  </div>`;
  const rowsFor = () => {
    let saldo = 0;
    const all = stockMovements(b.id).map((x) => ({ ...x, saldo: (saldo += x.masuk - x.keluar) }));
    return all.filter((x) => (!st.from || x.tanggal >= st.from) && (!st.to || x.tanggal <= st.to) && (!st.jenis || x.jenis === st.jenis));
  };
  const tableHTML = (rows) => `<table class="table"><thead><tr><th>Tanggal</th><th>No. Ref</th><th>Jenis</th><th>Keterangan</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th></tr></thead>
    <tbody>${rows.length ? [...rows].reverse().map((x) => `<tr ${x.ref ? `class="clickable" data-href="${x.ref}"` : ''}>
      <td class="nowrap">${fmtDate(x.tanggal)}</td><td class="mono">${esc(x.no)}</td>
      <td><span class="badge ${{ Pembelian: 'b-green', Penjualan: 'b-blue', 'Stok Awal': 'b-gray' }[x.jenis] || 'b-amber'}">${esc(x.jenis)}</span></td>
      <td>${esc(x.ket || '')}${x.harga ? `<div class="cell-sub">@ ${rp(x.harga)}</div>` : ''}</td>
      <td class="r text-success">${x.masuk ? '+' + num(x.masuk) : ''}</td><td class="r text-danger">${x.keluar ? '−' + num(x.keluar) : ''}</td><td class="r strong">${num(x.saldo)}</td></tr>`).join('') : `<tr><td colspan="7">${emptyState('history', 'Belum ada mutasi')}</td></tr>`}</tbody></table>`;
  const draw = () => {
    const all = stockMovements(b.id);
    const stok = all.reduce((a, x) => a + x.masuk - x.keluar, 0);
    const masuk = all.filter((x) => x.jenis === 'Pembelian').reduce((a, x) => a + x.masuk, 0);
    const keluar = all.filter((x) => x.jenis === 'Penjualan').reduce((a, x) => a + x.keluar, 0);
    root.querySelector('#kpis').innerHTML = `
      <div class="card kpi"><div class="kpi-ic ${stok <= 0 ? 'ic-red' : stok <= b.stokMin ? 'ic-amber' : 'ic-green'}"><i data-lucide="package"></i></div><div><div class="label">Stok Saat Ini</div><div class="value">${num(stok)} ${esc(b.satuan)}</div><div class="sub">Min ${num(b.stokMin)}</div></div></div>
      <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="landmark"></i></div><div><div class="label">Nilai Persediaan</div><div class="value">${rp(stok * b.hargaBeli)}</div></div></div>
      <div class="card kpi"><div class="kpi-ic ic-cyan"><i data-lucide="arrow-down-to-line"></i></div><div><div class="label">Total Dibeli</div><div class="value">${num(masuk)}</div></div></div>
      <div class="card kpi"><div class="kpi-ic ic-purple"><i data-lucide="arrow-up-from-line"></i></div><div><div class="label">Total Terjual</div><div class="value">${num(keluar)}</div></div></div>`;
    root.querySelector('#tbl').innerHTML = tableHTML(rowsFor());
    window.lucide?.createIcons();
  };
  draw();
  root.querySelector('#jenis').addEventListener('change', (e) => { st.jenis = e.target.value; draw(); });
  root.querySelector('#from').addEventListener('change', (e) => { st.from = e.target.value; draw(); });
  root.querySelector('#to').addEventListener('change', (e) => { st.to = e.target.value; draw(); });
  root.addEventListener('click', (e) => {
    const tr = e.target.closest('[data-href]');
    if (tr) location.hash = tr.dataset.href;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'adjust') adjustDialog(b);
    if (act === 'csv') exportCSV(`kartu-stok-${b.kode}.csv`, [['Tanggal', 'No Ref', 'Jenis', 'Keterangan', 'Masuk', 'Keluar', 'Saldo'], ...rowsFor().map((x) => [x.tanggal, x.no, x.jenis, x.ket, x.masuk, x.keluar, x.saldo])]);
    if (act === 'print') printReport('KARTU STOK', `${b.kode} · ${b.nama}`, tableHTML(rowsFor()));
  });
}

function adjustDialog(b, onDone) {
  const sm = stockMap();
  const cur = sm[b.id] || 0;
  formModal({
    title: `Penyesuaian Stok · ${b.nama}`,
    body: `<div class="alert alert-info"><i data-lucide="info"></i><div>Stok sistem saat ini <b>${num(cur)} ${esc(b.satuan)}</b>. Selisih akan dicatat ke jurnal (Beban Selisih Persediaan) senilai HPP.</div></div>
    <div class="form-grid">
      <div class="field col-6"><label>Tanggal</label><input type="date" name="tanggal" value="${todayStr()}"></div>
      <div class="field col-6"><label>Jenis</label><select name="jenis">${options([['Opname', 'Stok Opname (hitung fisik)'], ['Rusak', 'Barang Rusak / Pecah'], ['Penyesuaian', 'Penyesuaian Lainnya']], 'Opname')}</select></div>
      <div class="field col-12"><label>Stok Fisik (hasil hitung) *</label><input type="number" name="fisik" value="${cur}" required></div>
      <div class="field col-12"><label>Keterangan *</label><input name="keterangan" required placeholder="cth: Kaca pecah saat bongkar muat"></div>
    </div>`,
    onSubmit: async (d) => {
      const selisih = d.fisik - cur;
      if (!selisih) { toast('Tidak ada selisih stok', 'info'); return; }
      await save('opname', { no: nextNo('opname', 'SO', d.tanggal), tanggal: d.tanggal, barangId: b.id, jenis: d.jenis, stokSistem: cur, stokFisik: d.fisik, selisih, hpp: +b.hargaBeli || 0, keterangan: d.keterangan, oleh: state.user.nama },
        { log: { detail: `${b.nama}: ${cur} → ${d.fisik} (${selisih > 0 ? '+' : ''}${selisih})` } });
      toast('Penyesuaian stok disimpan');
      onDone ? onDone() : state.rerender();
    },
  });
}

// ---------- Stok opname ----------
export function renderOpname(root) {
  const sm = stockMap();
  const barang = cache.barang.filter((b) => b.jenis !== 'jasa' && b.aktif !== false).sort((a, b) => a.kode.localeCompare(b.kode));
  const hist = [...cache.opname].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt);
  root.innerHTML = `
  <div class="page-header">
    <div><h1>Stok Opname</h1><p>Hitung fisik stok gudang, catat barang rusak/pecah, dan sesuaikan stok sistem.</p></div>
  </div>
  <div class="card">
    <div class="card-header"><h3><i data-lucide="clipboard-list"></i> Lembar Hitung Fisik</h3>
      <div class="flex"><input type="date" id="tgl" value="${todayStr()}"><button class="btn btn-primary" data-act="saveAll"><i data-lucide="save"></i> Simpan Selisih</button></div></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Kode</th><th>Barang</th><th class="r">Stok Sistem</th><th style="width:140px">Stok Fisik</th><th class="r">Selisih</th><th class="r">Nilai Selisih</th></tr></thead>
      <tbody>${barang.map((b) => `<tr data-id="${b.id}"><td class="mono strong">${esc(b.kode)}</td><td>${esc(b.nama)}<div class="cell-sub">${esc(b.satuan)}</div></td>
        <td class="r">${num(sm[b.id])}</td><td><input type="number" data-fisik value="${sm[b.id] || 0}" style="text-align:right"></td>
        <td class="r strong" data-sel>0</td><td class="r" data-nil>-</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="card-body"><div class="field"><label>Keterangan opname</label><input id="ket" value="Stok opname rutin"></div></div>
  </div>
  <div class="card">
    <div class="card-header"><h3><i data-lucide="history"></i> Riwayat Penyesuaian Stok</h3></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Tanggal</th><th>Barang</th><th>Jenis</th><th class="r">Sistem → Fisik</th><th class="r">Selisih</th><th class="r">Nilai</th><th>Keterangan</th><th>Oleh</th><th></th></tr></thead>
    <tbody>${hist.length ? hist.map((a) => `<tr><td class="mono">${esc(a.no)}</td><td class="nowrap">${fmtDate(a.tanggal)}</td><td><a href="#/stok/${a.barangId}">${esc(byId('barang', a.barangId)?.nama || '-')}</a></td>
      <td><span class="badge ${a.jenis === 'Rusak' ? 'b-red' : 'b-amber'}">${esc(a.jenis)}</span></td><td class="r">${num(a.stokSistem)} → ${num(a.stokFisik)}</td>
      <td class="r strong ${a.selisih < 0 ? 'text-danger' : 'text-success'}">${a.selisih > 0 ? '+' : ''}${num(a.selisih)}</td><td class="r">${rp(a.selisih * a.hpp)}</td><td>${esc(a.keterangan || '')}</td><td>${esc(a.oleh || '')}</td>
      <td class="actions">${can('admin') ? `<button class="btn-icon sm danger" data-del="${a.id}"><i data-lucide="trash-2"></i></button>` : ''}</td></tr>`).join('') : `<tr><td colspan="10">${emptyState('clipboard-check', 'Belum ada penyesuaian stok')}</td></tr>`}</tbody></table></div>
  </div>`;

  root.addEventListener('input', (e) => {
    if (!e.target.matches('[data-fisik]')) return;
    const tr = e.target.closest('tr');
    const b = byId('barang', tr.dataset.id);
    const sel = (+e.target.value || 0) - (sm[b.id] || 0);
    tr.querySelector('[data-sel]').innerHTML = `<span class="${sel < 0 ? 'text-danger' : sel > 0 ? 'text-success' : ''}">${sel > 0 ? '+' : ''}${num(sel)}</span>`;
    tr.querySelector('[data-nil]').textContent = sel ? rp(sel * b.hargaBeli) : '-';
  });
  root.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!(await confirmDlg('Hapus penyesuaian ini? Stok akan kembali seperti sebelumnya.'))) return;
      await remove('opname', del.dataset.del);
      return state.rerender();
    }
    if (!e.target.closest('[data-act=saveAll]')) return;
    const tgl = root.querySelector('#tgl').value;
    const ket = root.querySelector('#ket').value.trim() || 'Stok opname';
    const changes = [...root.querySelectorAll('tbody tr[data-id]')].map((tr) => ({ b: byId('barang', tr.dataset.id), fisik: +tr.querySelector('[data-fisik]').value || 0 })).filter((x) => x.fisik !== (sm[x.b.id] || 0));
    if (!changes.length) return toast('Tidak ada selisih stok', 'info');
    if (!(await confirmDlg(`Simpan ${changes.length} penyesuaian stok?`, { danger: false, okText: 'Simpan' }))) return;
    for (const c of changes) {
      const cur = sm[c.b.id] || 0;
      await save('opname', { no: nextNo('opname', 'SO', tgl), tanggal: tgl, barangId: c.b.id, jenis: 'Opname', stokSistem: cur, stokFisik: c.fisik, selisih: c.fisik - cur, hpp: +c.b.hargaBeli || 0, keterangan: ket, oleh: state.user.nama },
        { log: { detail: `${c.b.nama}: ${cur} → ${c.fisik}` } });
    }
    toast(`${changes.length} penyesuaian stok disimpan`);
    state.rerender();
  });
}
