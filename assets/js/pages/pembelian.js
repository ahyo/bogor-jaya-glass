import { cache, byId, save, remove, nextNo } from '../db.js';
import { rp, num, esc, todayStr, fmtDate, options, toast, emptyState, formModal, confirmDlg, debounce, exportCSV, uid, addDays, fmtDateTime } from '../utils.js';
import { payBadge, paid, sisa, supNama, calcItems, lineTotal, ppnBadge, METODE } from '../calc.js';
import { state, can } from '../state.js';
import { printPembelian } from '../print.js';

const ui = { q: '', status: 'Semua' };

export function renderList(root) {
  const hutang = cache.pembelian.filter((p) => p.status !== 'Batal').reduce((a, p) => a + sisa(p), 0);
  const ym = todayStr().slice(0, 7);
  const bulanIni = cache.pembelian.filter((p) => p.status !== 'Batal' && p.tanggal.startsWith(ym));
  root.innerHTML = `
  <div class="page-header">
    <div><h1>Pembelian Barang</h1><p>Catat pembelian stok kaca & bahan dari supplier.</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button><a class="btn btn-primary" href="#/pembelian/new"><i data-lucide="plus"></i> Pembelian Baru</a></div>
  </div>
  <div class="kpis">
    <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="shopping-cart"></i></div><div><div class="label">Pembelian Bulan Ini</div><div class="value">${rp(bulanIni.reduce((a, p) => a + p.total, 0))}</div><div class="sub">${bulanIni.length} transaksi</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-cyan"><i data-lucide="receipt"></i></div><div><div class="label">PPN Masukan Bulan Ini</div><div class="value">${rp(bulanIni.reduce((a, p) => a + p.ppn, 0))}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-red"><i data-lucide="alarm-clock"></i></div><div><div class="label">Hutang ke Supplier</div><div class="value">${rp(hutang)}</div></div></div>
  </div>
  <div class="card">
    <div class="toolbar">
      <div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari no., faktur, supplier, barang…" value="${esc(ui.q)}"></div>
      <div class="tabs">${['Semua', 'Belum Lunas', 'Lunas', 'Batal'].map((s) => `<button class="tab ${ui.status === s ? 'active' : ''}" data-st="${s}">${s}</button>`).join('')}</div>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>No.</th><th>Tanggal</th><th>Supplier</th><th>Item</th><th class="r">PPN</th><th class="r">Total</th><th>Bayar</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </div>`;
  const list = () => {
    const q = ui.q.toLowerCase();
    return cache.pembelian.filter((p) => {
      if (ui.status === 'Batal' && p.status !== 'Batal') return false;
      if (ui.status !== 'Batal' && ui.status !== 'Semua' && (p.status === 'Batal' || (ui.status === 'Lunas') !== (sisa(p) === 0))) return false;
      return !q || [p.no, p.noFaktur, supNama(p.supplierId), ...p.items.map((i) => i.nama)].some((x) => String(x || '').toLowerCase().includes(q));
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt);
  };
  const draw = () => {
    const l = list();
    root.querySelector('#rows').innerHTML = l.length ? l.map((p) => `<tr class="clickable" data-href="#/pembelian/${p.id}">
      <td><div class="cell-title">${esc(p.no)}</div><div class="cell-sub">${esc(p.noFaktur || '')}</div></td>
      <td class="nowrap">${fmtDate(p.tanggal)}</td><td>${esc(supNama(p.supplierId))}</td>
      <td><div class="cell-sub" style="max-width:320px">${esc(p.items.map((i) => `${i.nama} ×${i.qty}`).join(', '))}</div></td>
      <td class="r nowrap">${rp(p.ppn)}</td><td class="r strong nowrap">${rp(p.total)}</td>
      <td>${p.status === 'Batal' ? '<span class="badge b-red">Batal</span>' : payBadge(p)}</td></tr>`).join('') : `<tr><td colspan="7">${emptyState('shopping-cart', 'Belum ada pembelian')}</td></tr>`;
    window.lucide?.createIcons();
  };
  draw();
  root.querySelector('#q').addEventListener('input', debounce((e) => { ui.q = e.target.value; draw(); }, 150));
  root.addEventListener('click', (e) => {
    const st = e.target.closest('[data-st]');
    if (st) { ui.status = st.dataset.st; root.querySelectorAll('[data-st]').forEach((b) => b.classList.toggle('active', b === st)); draw(); return; }
    const tr = e.target.closest('[data-href]');
    if (tr) location.hash = tr.dataset.href;
    if (e.target.closest('[data-act=csv]')) exportCSV(`pembelian-${todayStr()}.csv`, [['No', 'Tanggal', 'No Faktur', 'Supplier', 'DPP', 'PPN', 'Total', 'Dibayar', 'Sisa', 'Status'], ...list().map((p) => [p.no, p.tanggal, p.noFaktur, supNama(p.supplierId), p.dpp, p.ppn, p.total, paid(p), sisa(p), p.status])]);
  });
}

export function renderForm(root, { id }) {
  const editing = id ? byId('pembelian', id) : null;
  if (id && !editing) { root.innerHTML = emptyState('file-x', 'Data tidak ditemukan'); return; }
  const p = editing ? structuredClone(editing) : { tanggal: todayStr(), items: [], pembayaran: [] };
  const items = p.items.map((x) => ({ ...x }));
  if (!items.length) items.push(blank());
  const barangList = cache.barang.filter((b) => b.jenis !== 'jasa' && (b.aktif !== false || items.some((i) => i.barangId === b.id)));

  root.innerHTML = `
  <div class="page-header"><div><a class="back-link" href="${editing ? `#/pembelian/${p.id}` : '#/pembelian'}"><i data-lucide="arrow-left"></i> Kembali</a><h1>${editing ? 'Ubah Pembelian ' + esc(p.no) : 'Pembelian Baru'}</h1><p>Stok barang & PPN Masukan diperbarui otomatis.</p></div></div>
  <form id="f" class="form-layout" novalidate>
    <div class="stack">
      <section class="card"><div class="card-header"><h3><i data-lucide="truck"></i> Informasi Pembelian</h3></div>
        <div class="card-body form-grid">
          <div class="field col-6"><label>Supplier *</label><select name="supplierId" required>${options(cache.supplier.map((s) => [s.id, s.nama + (s.pkp ? ' (PKP)' : '')]), p.supplierId, '— Pilih supplier —')}</select></div>
          <div class="field col-3"><label>Tanggal *</label><input type="date" name="tanggal" value="${p.tanggal}" required></div>
          <div class="field col-3"><label>No. Faktur Supplier</label><input name="noFaktur" value="${esc(p.noFaktur || '')}"></div>
          <div class="field col-12"><label>Catatan</label><input name="catatan" value="${esc(p.catatan || '')}"></div>
        </div>
      </section>
      <section class="card"><div class="card-header"><h3><i data-lucide="package"></i> Barang Dibeli</h3><span class="muted small">PPN Masukan dihitung untuk barang bertanda PPN</span></div>
        <div class="table-wrap"><table class="table items-table">
          <thead><tr><th style="min-width:260px">Barang</th><th style="width:90px">Qty</th><th style="width:160px">Harga Beli</th><th style="width:120px">Diskon</th><th class="r" style="width:140px">Jumlah</th><th style="width:44px"></th></tr></thead>
          <tbody id="items"></tbody></table></div>
        <div class="card-body" style="padding-top:12px"><button type="button" class="btn btn-soft" data-act="add"><i data-lucide="plus"></i> Tambah Barang</button></div>
      </section>
    </div>
    <aside class="form-side">
      <section class="card"><div class="card-header"><h3><i data-lucide="calculator"></i> Ringkasan</h3></div>
        <div class="card-body"><div class="totals" id="totals"></div>
          ${editing ? '' : `<div class="form-grid mt-2">
            <div class="field col-12"><label>Cara Bayar</label><select name="bayar">${options([...METODE, ['Hutang', 'Kredit / Hutang (Tempo)']], 'Transfer Bank')}</select></div>
            <div class="field col-12 hide" id="jtWrap"><label>Jatuh Tempo</label><input type="date" name="jatuhTempo" value="${addDays(todayStr(), 30)}"></div>
          </div>`}
          <label class="toggle mt-2"><input type="checkbox" name="updateHarga" checked><span class="sw"></span><span class="t-label"><b>Perbarui harga beli master</b><small>Gunakan harga ini sebagai HPP barang</small></span></label>
        </div>
        <div class="card-footer"><button class="btn btn-primary btn-block btn-lg" type="submit"><i data-lucide="save"></i> Simpan Pembelian</button></div>
      </section>
    </aside>
  </form>`;
  const tbody = root.querySelector('#items');
  const form = root.querySelector('#f');
  const draw = () => {
    tbody.innerHTML = items.map((it, i) => `<tr data-i="${i}">
      <td><select data-f="barangId"><option value="">— Pilih barang —</option>${barangList.map((b) => `<option value="${b.id}" ${b.id === it.barangId ? 'selected' : ''}>${esc(b.kode)} — ${esc(b.nama)}</option>`).join('')}</select>
        <div class="row-meta">${it.barangId ? (it.kenaPajak ? ppnBadge() : '<span class="badge b-gray">Non-PPN</span>') : ''}</div></td>
      <td><input type="number" data-f="qty" min="1" value="${it.qty}"></td>
      <td><input type="number" data-f="harga" min="0" value="${it.harga}"></td>
      <td><input type="number" data-f="diskon" min="0" value="${it.diskon || 0}"></td>
      <td class="r line-total">${rp(lineTotal(it))}</td>
      <td><button type="button" class="btn-icon sm danger" data-del="${i}"><i data-lucide="trash-2"></i></button></td></tr>`).join('');
    window.lucide?.createIcons();
    totals();
  };
  const totals = () => {
    const c = calcItems(items.filter((i) => i.barangId));
    root.querySelector('#totals').innerHTML = `<div class="row"><span>Subtotal</span><b>${rp(c.subtotal)}</b></div><div class="row"><span>DPP</span><span>${rp(c.dpp)}</span></div><div class="row"><span>PPN Masukan</span><span>${rp(c.ppn)}</span></div><div class="row grand"><span>Total</span><span>${rp(c.total)}</span></div>`;
  };
  draw();
  tbody.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f || f === 'barangId') return;
    const tr = e.target.closest('tr');
    items[+tr.dataset.i][f] = +e.target.value || 0;
    tr.querySelector('.line-total').textContent = rp(lineTotal(items[+tr.dataset.i]));
    totals();
  });
  tbody.addEventListener('change', (e) => {
    if (e.target.dataset.f !== 'barangId') return;
    const i = +e.target.closest('tr').dataset.i;
    const b = byId('barang', e.target.value);
    items[i] = b ? { barangId: b.id, nama: b.nama, satuan: b.satuan, qty: items[i].qty || 1, harga: +b.hargaBeli || 0, diskon: 0, kenaPajak: !!b.kenaPajak, jenis: 'barang' } : blank();
    draw();
  });
  form.bayar?.addEventListener('change', (e) => root.querySelector('#jtWrap').classList.toggle('hide', e.target.value !== 'Hutang'));
  root.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]');
    if (d) { items.splice(+d.dataset.del, 1); if (!items.length) items.push(blank()); draw(); }
    if (e.target.closest('[data-act=add]')) { items.push(blank()); draw(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valid = items.filter((i) => i.barangId && +i.qty > 0);
    if (!form.supplierId.value) return toast('Pilih supplier', 'error');
    if (!valid.length) return toast('Tambahkan minimal satu barang', 'error');
    const sup = byId('supplier', form.supplierId.value);
    // Supplier non-PKP tidak memungut PPN
    const calcList = sup?.pkp === false ? valid.map((i) => ({ ...i, kenaPajak: false })) : valid;
    const c = calcItems(calcList);
    Object.assign(p, { supplierId: form.supplierId.value, tanggal: form.tanggal.value, noFaktur: form.noFaktur.value.trim(), catatan: form.catatan.value.trim(), items: calcList, ...c });
    if (!editing) {
      p.no = nextNo('pembelian', 'PB', p.tanggal);
      p.status = 'Aktif';
      p.createdBy = state.user.nama;
      if (form.bayar.value === 'Hutang') p.jatuhTempo = form.jatuhTempo.value;
      else p.pembayaran = [{ id: uid(), tanggal: p.tanggal, jumlah: c.total, metode: form.bayar.value, oleh: state.user.nama }];
    }
    if (form.updateHarga.checked) for (const it of valid) {
      const b = byId('barang', it.barangId);
      if (b && +b.hargaBeli !== +it.harga) { const old = b.hargaBeli; b.hargaBeli = +it.harga; await save('barang', b, { log: { detail: `Harga beli ${rp(old)} → ${rp(it.harga)} (dari ${p.no})` } }); }
    }
    await save('pembelian', p, { log: { detail: `${supNama(p.supplierId)} · ${rp(p.total)}` } });
    toast('Pembelian disimpan, stok bertambah');
    location.hash = `#/pembelian/${p.id}`;
  });
}

export function renderDetail(root, { id }) {
  const p = byId('pembelian', id);
  if (!p) { root.innerHTML = emptyState('file-x', 'Data tidak ditemukan'); return; }
  const sup = byId('supplier', p.supplierId) || {};
  root.innerHTML = `
  <div class="page-header">
    <div><a class="back-link" href="#/pembelian"><i data-lucide="arrow-left"></i> Kembali</a>
      <div class="flex flex-wrap"><h1>${esc(p.no)}</h1>${p.status === 'Batal' ? '<span class="badge b-red">Batal</span>' : payBadge(p)}</div>
      <p>${esc(sup.nama || '-')} · ${fmtDate(p.tanggal)}${p.noFaktur ? ' · Faktur ' + esc(p.noFaktur) : ''}</p></div>
    <div class="actions">
      ${p.status !== 'Batal' && sisa(p) > 0 ? '<button class="btn btn-success" data-act="pay"><i data-lucide="banknote"></i> Bayar Hutang</button>' : ''}
      <button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button>
      ${p.status !== 'Batal' ? `<a class="btn btn-ghost" href="#/pembelian/${p.id}/edit"><i data-lucide="pencil"></i> Ubah</a><button class="btn btn-ghost" data-act="cancel"><i data-lucide="x-circle"></i> Batalkan</button>` : ''}
      ${can('admin') ? '<button class="btn-icon danger" data-act="delete" title="Hapus"><i data-lucide="trash-2"></i></button>' : ''}
    </div>
  </div>
  <div class="grid grid-main">
    <div class="stack">
      <section class="card"><div class="card-header"><h3><i data-lucide="package"></i> Barang</h3></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Barang</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Diskon</th><th class="r">Jumlah</th></tr></thead>
        <tbody>${p.items.map((it) => `<tr><td><a href="#/stok/${it.barangId}" class="cell-title">${esc(it.nama)}</a> ${it.kenaPajak ? ppnBadge() : ''}</td><td class="r">${it.qty} ${esc(it.satuan || '')}</td><td class="r">${rp(it.harga)}</td><td class="r">${it.diskon ? rp(it.diskon) : '-'}</td><td class="r strong">${rp(lineTotal(it))}</td></tr>`).join('')}</tbody></table></div>
        <div class="card-body" style="display:flex;justify-content:flex-end"><div class="totals" style="width:min(300px,100%)">
          <div class="row"><span>DPP</span><span>${rp(p.dpp)}</span></div><div class="row"><span>PPN Masukan</span><span>${rp(p.ppn)}</span></div><div class="row grand"><span>Total</span><span>${rp(p.total)}</span></div></div></div>
      </section>
      <section class="card"><div class="card-header"><h3><i data-lucide="credit-card"></i> Pembayaran</h3>${p.jatuhTempo && sisa(p) ? `<span class="badge ${p.jatuhTempo < todayStr() ? 'b-red' : 'b-amber'}">Jatuh tempo ${fmtDate(p.jatuhTempo)}</span>` : ''}</div>
        ${(p.pembayaran || []).length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Metode</th><th>Oleh</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>
        ${p.pembayaran.map((x) => `<tr><td>${fmtDate(x.tanggal)}</td><td>${esc(x.metode)}</td><td>${esc(x.oleh || '-')}</td><td class="r strong">${rp(x.jumlah)}</td><td class="actions">${can('admin') ? `<button class="btn-icon sm danger" data-delpay="${x.id}"><i data-lucide="trash-2"></i></button>` : ''}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">Sisa hutang</td><td class="r">${rp(sisa(p))}</td><td></td></tr></tfoot></table></div>` : `<div class="card-body muted">Belum ada pembayaran. Hutang <b class="text-danger">${rp(p.total)}</b>.</div>`}
      </section>
    </div>
    <div class="stack">
      <section class="card"><div class="card-header"><h3><i data-lucide="truck"></i> Supplier</h3></div><div class="card-body"><dl class="info-list">
        <dt>Nama</dt><dd>${esc(sup.nama || '-')}</dd><dt>Kontak</dt><dd>${esc(sup.kontak || '-')}</dd><dt>Telp</dt><dd>${esc(sup.telp || '-')}</dd><dt>Status</dt><dd>${sup.pkp ? '<span class="badge b-cyan">PKP</span>' : '<span class="badge b-gray">Non-PKP</span>'}</dd>
        <dt>Dicatat oleh</dt><dd>${esc(p.createdBy || '-')}</dd><dt>Dibuat</dt><dd>${fmtDateTime(p.createdAt)}</dd></dl>
        ${p.catatan ? `<p class="mt-2 muted">${esc(p.catatan)}</p>` : ''}</div></section>
      ${historyCard('pembelian', p.id)}
    </div>
  </div>`;
  root.addEventListener('click', async (e) => {
    const dp = e.target.closest('[data-delpay]');
    if (dp) {
      if (!(await confirmDlg('Hapus pembayaran ini?'))) return;
      p.pembayaran = p.pembayaran.filter((x) => x.id !== dp.dataset.delpay);
      await save('pembelian', p, { log: { aksi: 'Hapus Pembayaran' } });
      return state.rerender();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'print') printPembelian(p);
    if (act === 'pay') formModal({
      title: 'Bayar Hutang Supplier',
      body: `<div class="form-grid"><div class="field col-6"><label>Tanggal</label><input type="date" name="tanggal" value="${todayStr()}"></div><div class="field col-6"><label>Metode</label><select name="metode">${options(METODE, 'Transfer Bank')}</select></div><div class="field col-12"><label>Jumlah *</label><input type="number" name="jumlah" value="${sisa(p)}" required></div></div>`,
      onSubmit: async (d) => {
        if (d.jumlah <= 0 || d.jumlah > sisa(p)) { toast('Jumlah tidak valid', 'error'); return false; }
        p.pembayaran.push({ id: uid(), ...d, oleh: state.user.nama });
        await save('pembelian', p, { log: { aksi: 'Pembayaran', detail: `${d.metode} ${rp(d.jumlah)}` } });
        toast('Pembayaran dicatat');
        state.rerender();
      },
    });
    if (act === 'cancel' && (await confirmDlg('Batalkan pembelian ini? Stok & jurnal terkait akan dibatalkan.'))) {
      p.status = 'Batal';
      await save('pembelian', p, { log: { aksi: 'Batal' } });
      state.rerender();
    }
    if (act === 'delete' && (await confirmDlg(`Hapus permanen ${p.no}?`, { okText: 'Hapus' }))) {
      await remove('pembelian', p.id);
      toast('Pembelian dihapus');
      location.hash = '#/pembelian';
    }
  });
}

// Kartu riwayat aktivitas untuk dokumen tertentu
export function historyCard(modul, refId) {
  const logs = cache.log.filter((l) => l.modul === modul && l.refId === refId).sort((a, b) => b.waktu - a.waktu);
  if (!logs.length) return '';
  return `<section class="card"><div class="card-header"><h3><i data-lucide="history"></i> Riwayat Perubahan</h3></div>
    <div class="card-body"><ul class="timeline">${logs.slice(0, 15).map((l) => `<li><div class="t-title">${esc(l.aksi)}</div><div class="t-meta">${fmtDateTime(l.waktu)} · ${esc(l.user)}</div>${l.detail ? `<div class="t-note">${esc(l.detail)}</div>` : ''}</li>`).join('')}</ul></div></section>`;
}

const blank = () => ({ barangId: '', nama: '', qty: 1, harga: 0, diskon: 0, kenaPajak: false, jenis: 'barang' });
