import { cache, byId, save, nextNo, getSettings } from '../db.js';
import { rp, num, esc, todayStr, fmtDate, options, toast, emptyState, formModal, debounce, exportCSV, uid, initials, fmtDateTime } from '../utils.js';
import { STATUS, statusBadge, payBadge, paid, pelNama, pegNama, kendaraanLabel, calcItems, lineTotal, teknisiList, stockMap, ppnBadge, METODE } from '../calc.js';
import { state } from '../state.js';

const ui = { tab: 'Semua', q: '', from: '', to: '' };

export function renderList(root) {
  root.innerHTML = `
  <div class="page-header">
    <div><h1>Order & Pemasangan</h1><p>Kelola order penjualan dan pemasangan kaca mobil.</p></div>
    <div class="actions">
      <button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button>
      <a class="btn btn-primary" href="#/orders/new"><i data-lucide="plus"></i> Order Baru</a>
    </div>
  </div>
  <div class="card">
    <div class="toolbar">
      <div class="tabs" id="tabs"></div>
    </div>
    <div class="toolbar">
      <div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari no. order, plat, pelanggan, barang…" value="${esc(ui.q)}"></div>
      <div class="flex"><span class="muted small">Dari</span><input type="date" id="from" value="${ui.from}"><span class="muted small">s/d</span><input type="date" id="to" value="${ui.to}"></div>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>No. Order</th><th>Pelanggan</th><th>Kendaraan</th><th>Teknisi</th><th>Jadwal</th><th class="r">Total</th><th>Bayar</th><th>Status</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>
  </div>`;

  const filtered = () => {
    const q = ui.q.toLowerCase();
    return cache.orders.filter((o) => {
      if (ui.tab !== 'Semua' && o.status !== ui.tab) return false;
      if (ui.from && o.tanggal < ui.from) return false;
      if (ui.to && o.tanggal > ui.to) return false;
      if (!q) return true;
      return [o.no, o.kendaraan?.plat, o.kendaraan?.plat?.replace(/\s/g, ''), kendaraanLabel(o.kendaraan), pelNama(o.pelangganId), o.keluhan, ...o.items.map((i) => i.nama)].some((x) => String(x || '').toLowerCase().includes(q));
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt);
  };
  const drawTabs = () => {
    root.querySelector('#tabs').innerHTML = ['Semua', ...STATUS].map((s) => {
      const n = s === 'Semua' ? cache.orders.length : cache.orders.filter((o) => o.status === s).length;
      return `<button class="tab ${ui.tab === s ? 'active' : ''}" data-tab="${s}">${s}<span class="n">${n}</span></button>`;
    }).join('');
  };
  const drawRows = () => {
    const list = filtered();
    root.querySelector('#rows').innerHTML = list.length ? list.map((o) => `
      <tr class="clickable" data-href="#/orders/${o.id}">
        <td><div class="cell-title">${esc(o.no)}</div><div class="cell-sub">${fmtDate(o.tanggal)}</div></td>
        <td><div class="cell-title">${esc(pelNama(o.pelangganId))}</div><div class="cell-sub">${esc(byId('pelanggan', o.pelangganId)?.telp || '')}</div></td>
        <td><span class="plate">${esc(o.kendaraan?.plat || '-')}</span><div class="cell-sub">${esc(kendaraanLabel(o.kendaraan))}</div></td>
        <td>${o.teknisiIds?.length ? esc(o.teknisiIds.map(pegNama).join(', ')) : '<span class="muted">—</span>'}</td>
        <td class="nowrap">${o.jadwal ? fmtDateTime(o.jadwal) : '<span class="muted">—</span>'}</td>
        <td class="r strong nowrap">${rp(o.total)}</td>
        <td>${o.status === 'Batal' ? '<span class="muted">—</span>' : payBadge(o)}</td>
        <td>${statusBadge(o.status)}</td>
      </tr>`).join('') : `<tr><td colspan="8">${emptyState('search-x', 'Tidak ada order', 'Coba ubah filter atau buat order baru.')}</td></tr>`;
    window.lucide?.createIcons();
  };
  drawTabs();
  drawRows();
  root.querySelector('#q').addEventListener('input', debounce((e) => { ui.q = e.target.value; drawRows(); }, 150));
  root.querySelector('#from').addEventListener('change', (e) => { ui.from = e.target.value; drawRows(); });
  root.querySelector('#to').addEventListener('change', (e) => { ui.to = e.target.value; drawRows(); });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { ui.tab = t.dataset.tab; drawTabs(); drawRows(); return; }
    const tr = e.target.closest('[data-href]');
    if (tr) location.hash = tr.dataset.href;
    if (e.target.closest('[data-act=csv]')) {
      exportCSV(`order-${todayStr()}.csv`, [['No', 'Tanggal', 'Pelanggan', 'Plat', 'Kendaraan', 'Teknisi', 'Status', 'DPP', 'PPN', 'Total', 'Dibayar', 'Sisa'],
        ...filtered().map((o) => [o.no, o.tanggal, pelNama(o.pelangganId), o.kendaraan?.plat, kendaraanLabel(o.kendaraan), o.teknisiIds.map(pegNama).join(', '), o.status, o.dpp, o.ppn, o.total, paid(o), o.total - paid(o)])]);
    }
  });
}

// ---------- Form order ----------
export function renderForm(root, { id }) {
  const s = getSettings();
  const editing = id ? byId('orders', id) : null;
  if (id && !editing) { root.innerHTML = emptyState('file-x', 'Order tidak ditemukan'); return; }
  const o = editing ? structuredClone(editing) : { tanggal: todayStr(), kendaraan: {}, teknisiIds: [], items: [], lokasi: 'Workshop', garansiHari: s.garansiHari, pembayaran: [] };
  const items = o.items.map((x) => ({ ...x }));
  if (!items.length) items.push(blankItem());
  const sm = stockMap();
  // stok yang sedang dipakai order ini dikembalikan agar cek stok akurat saat edit
  if (editing && editing.status !== 'Batal') for (const it of editing.items) if (it.jenis !== 'jasa') sm[it.barangId] = (sm[it.barangId] || 0) + +it.qty;
  const barangAktif = cache.barang.filter((b) => b.aktif !== false || items.some((i) => i.barangId === b.id));

  root.innerHTML = `
  <div class="page-header">
    <div><a class="back-link" href="${editing ? `#/orders/${o.id}` : '#/orders'}"><i data-lucide="arrow-left"></i> Kembali</a>
    <h1>${editing ? `Ubah Order ${esc(o.no)}` : 'Order Baru'}</h1><p>Isi data pelanggan, kendaraan, dan item pekerjaan.</p></div>
  </div>
  <form id="f" class="form-layout" novalidate>
    <div class="stack">
      <section class="card">
        <div class="card-header"><h3><i data-lucide="user"></i> Pelanggan & Kendaraan</h3></div>
        <div class="card-body form-grid">
          <div class="field col-8"><label>Pelanggan *</label>
            <div class="input-group"><select name="pelangganId" id="pel" required>${options(cache.pelanggan.map((c) => [c.id, `${c.nama}${c.telp ? ' · ' + c.telp : ''}`]), o.pelangganId, '— Pilih pelanggan —')}</select>
            <button type="button" class="btn btn-ghost" data-act="new-pel" title="Pelanggan baru"><i data-lucide="user-plus"></i></button></div>
          </div>
          <div class="field col-4"><label>Tanggal Order</label><input type="date" name="tanggal" value="${o.tanggal}" required></div>
          <div class="field col-4"><label>Plat Nomor *</label><input name="plat" value="${esc(o.kendaraan.plat || '')}" placeholder="F 1234 AB" style="text-transform:uppercase" required></div>
          <div class="field col-4"><label>Merk</label><input name="merk" value="${esc(o.kendaraan.merk || '')}" placeholder="Toyota" list="merkList"></div>
          <div class="field col-4"><label>Model / Tipe</label><input name="model" value="${esc(o.kendaraan.model || '')}" placeholder="Avanza"></div>
          <div class="field col-4"><label>Tahun</label><input name="tahun" value="${esc(o.kendaraan.tahun || '')}" inputmode="numeric" placeholder="2020"></div>
          <div class="field col-4"><label>Warna</label><input name="warna" value="${esc(o.kendaraan.warna || '')}"></div>
          <div class="field col-4"><label>Lokasi Pengerjaan</label><select name="lokasi">${options(['Workshop', 'Home Service'], o.lokasi)}</select></div>
          <div class="field col-12"><label>Keluhan / Kerusakan</label><textarea name="keluhan" rows="2" placeholder="cth: Kaca depan retak terkena batu, bocor saat hujan">${esc(o.keluhan || '')}</textarea></div>
          <datalist id="merkList">${['Toyota', 'Daihatsu', 'Honda', 'Suzuki', 'Mitsubishi', 'Nissan', 'Wuling', 'Hyundai', 'Mazda', 'Isuzu', 'Kia', 'Chery', 'BMW', 'Mercedes-Benz'].map((m) => `<option value="${m}">`).join('')}</datalist>
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h3><i data-lucide="package"></i> Barang & Jasa</h3><span class="muted small">${s.pkp ? `PPN ${s.ppnRate}% ${s.ppnInclusive ? '(harga sudah termasuk PPN)' : 'ditambahkan untuk barang kena pajak'}` : 'Non-PKP: PPN tidak dipungut'}</span></div>
        <div class="table-wrap"><table class="table items-table">
          <thead><tr><th style="min-width:260px">Barang / Jasa</th><th style="width:90px">Qty</th><th style="width:150px">Harga</th><th style="width:130px">Diskon (Rp)</th><th class="r" style="width:140px">Jumlah</th><th style="width:44px"></th></tr></thead>
          <tbody id="items"></tbody>
        </table></div>
        <div class="card-body" style="padding-top:12px"><button type="button" class="btn btn-soft" data-act="add-item"><i data-lucide="plus"></i> Tambah Item</button></div>
      </section>
    </div>
    <aside class="form-side">
      <section class="card">
        <div class="card-header"><h3><i data-lucide="calendar-clock"></i> Jadwal & Teknisi</h3></div>
        <div class="card-body form-grid">
          <div class="field col-12"><label>Jadwal Pemasangan</label><input type="datetime-local" name="jadwal" value="${esc(o.jadwal || '')}"></div>
          <div class="field col-12"><label>Teknisi</label>
            <div class="chips">${teknisiList().map((t) => `<label class="chip"><input type="checkbox" name="teknisiIds" data-multi="1" value="${t.id}" ${o.teknisiIds.includes(t.id) ? 'checked' : ''}><span class="avatar">${initials(t.nama)}</span>${esc(t.nama)}</label>`).join('') || '<span class="muted small">Belum ada pegawai dengan jabatan Teknisi.</span>'}</div>
          </div>
          <div class="field col-12"><label>Garansi (hari)</label><input type="number" name="garansiHari" min="0" value="${o.garansiHari ?? s.garansiHari}"></div>
          <div class="field col-12"><label>Catatan Internal</label><textarea name="catatan" rows="2">${esc(o.catatan || '')}</textarea></div>
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h3><i data-lucide="calculator"></i> Ringkasan</h3></div>
        <div class="card-body"><div class="totals" id="totals"></div>
        ${editing ? '' : `<div class="form-grid mt-2">
          <div class="field col-6"><label>Uang Muka / Bayar</label><input type="number" name="dp" min="0" value="0"></div>
          <div class="field col-6"><label>Metode</label><select name="dpMetode">${options(METODE, 'Tunai')}</select></div>
        </div>`}
        </div>
        <div class="card-footer"><button class="btn btn-primary btn-block btn-lg" type="submit"><i data-lucide="save"></i> ${editing ? 'Simpan Perubahan' : 'Simpan Order'}</button></div>
      </section>
    </aside>
  </form>`;

  const tbody = root.querySelector('#items');
  const form = root.querySelector('#f');
  const barangOpts = (sel) => `<option value="">— Pilih —</option>
    <optgroup label="Barang">${barangAktif.filter((b) => b.jenis !== 'jasa').map((b) => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.kode)} — ${esc(b.nama)}</option>`).join('')}</optgroup>
    <optgroup label="Jasa">${barangAktif.filter((b) => b.jenis === 'jasa').map((b) => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.kode)} — ${esc(b.nama)}</option>`).join('')}</optgroup>`;
  const rowMeta = (it) => {
    if (!it.barangId) return '';
    const b = byId('barang', it.barangId);
    const st = sm[it.barangId] ?? 0;
    const used = items.filter((x) => x.barangId === it.barangId).reduce((a, x) => a + (+x.qty || 0), 0);
    return `${it.kenaPajak ? ppnBadge() : '<span class="badge b-gray">Non-PPN</span>'}
      ${it.jenis === 'jasa' ? '<span class="badge b-purple">Jasa</span>' : `<span class="badge ${used > st ? 'b-red' : 'b-gray'}">Stok: ${num(st)} ${esc(b?.satuan || '')}</span>`}
      ${b?.merkMobil ? `<span>${esc(b.merkMobil)}</span>` : ''}`;
  };
  const drawItems = () => {
    tbody.innerHTML = items.map((it, i) => `<tr data-i="${i}">
      <td><select data-f="barangId">${barangOpts(it.barangId)}</select><div class="row-meta">${rowMeta(it)}</div></td>
      <td><input type="number" data-f="qty" min="1" step="1" value="${it.qty}"></td>
      <td><input type="number" data-f="harga" min="0" value="${it.harga}"></td>
      <td><input type="number" data-f="diskon" min="0" value="${it.diskon || 0}"></td>
      <td class="r line-total">${rp(lineTotal(it))}</td>
      <td><button type="button" class="btn-icon sm danger" data-del="${i}" title="Hapus"><i data-lucide="trash-2"></i></button></td>
    </tr>`).join('');
    window.lucide?.createIcons();
    drawTotals();
  };
  const drawTotals = () => {
    const c = calcItems(items.filter((i) => i.barangId));
    root.querySelector('#totals').innerHTML = `
      <div class="row"><span>Subtotal</span><b>${rp(c.subtotal)}</b></div>
      <div class="row"><span>DPP</span><span>${rp(c.dpp)}</span></div>
      <div class="row"><span>PPN ${c.rate ? c.rate + '%' : ''}</span><span>${rp(c.ppn)}</span></div>
      <div class="row grand"><span>Total</span><span>${rp(c.total)}</span></div>`;
  };
  drawItems();

  tbody.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f || f === 'barangId') return;
    const tr = e.target.closest('tr');
    const it = items[+tr.dataset.i];
    it[f] = +e.target.value || 0;
    tr.querySelector('.line-total').textContent = rp(lineTotal(it));
    if (f === 'qty') tr.querySelector('.row-meta').innerHTML = rowMeta(it);
    drawTotals();
  });
  tbody.addEventListener('change', (e) => {
    if (e.target.dataset.f !== 'barangId') return;
    const i = +e.target.closest('tr').dataset.i;
    const b = byId('barang', e.target.value);
    items[i] = b ? { barangId: b.id, nama: b.nama, satuan: b.satuan, qty: items[i].qty || 1, harga: +b.hargaJual, diskon: 0, kenaPajak: !!b.kenaPajak, jenis: b.jenis, hpp: +b.hargaBeli || 0 } : blankItem();
    drawItems();
  });
  root.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { items.splice(+del.dataset.del, 1); if (!items.length) items.push(blankItem()); drawItems(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add-item') { items.push(blankItem()); drawItems(); tbody.querySelector('tr:last-child select')?.focus(); }
    if (act === 'new-pel') quickPelanggan((c) => {
      const sel = root.querySelector('#pel');
      sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.nama)}${c.telp ? ' · ' + esc(c.telp) : ''}</option>`);
      sel.value = c.id;
    });
  });
  // Isi data kendaraan dari order terakhir pelanggan
  root.querySelector('#pel').addEventListener('change', (e) => {
    if (form.plat.value) return;
    const last = cache.orders.filter((x) => x.pelangganId === e.target.value).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (last) for (const k of ['plat', 'merk', 'model', 'tahun', 'warna']) form[k].value = last.kendaraan?.[k] || '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.dataset.multi) { (fd[el.name] ||= []); if (el.checked) fd[el.name].push(el.value); } else fd[el.name] = el.value.trim();
    }
    fd.teknisiIds ||= [];
    const valid = items.filter((i) => i.barangId && +i.qty > 0);
    if (!fd.pelangganId) return toast('Pilih pelanggan terlebih dahulu', 'error');
    if (!fd.plat) return toast('Plat nomor wajib diisi', 'error');
    if (!valid.length) return toast('Tambahkan minimal satu barang/jasa', 'error');
    const c = calcItems(valid);
    const user = state.user.nama;
    Object.assign(o, {
      tanggal: fd.tanggal, pelangganId: fd.pelangganId, lokasi: fd.lokasi, keluhan: fd.keluhan, catatan: fd.catatan,
      kendaraan: { plat: fd.plat.toUpperCase(), merk: fd.merk, model: fd.model, tahun: fd.tahun, warna: fd.warna },
      jadwal: fd.jadwal, teknisiIds: fd.teknisiIds, garansiHari: +fd.garansiHari || 0, items: valid, ...c,
    });
    o.mediaCount ||= { before: 0, proses: 0, after: 0 };
    if (!editing) {
      o.no = nextNo('orders', 'WO', o.tanggal);
      o.status = o.jadwal && o.teknisiIds.length ? 'Dijadwalkan' : 'Baru';
      o.timeline = [{ waktu: Date.now(), status: 'Dibuat', oleh: user }];
      if (o.status === 'Dijadwalkan') o.timeline.push({ waktu: Date.now(), status: 'Dijadwalkan', oleh: user, catatan: `Teknisi: ${o.teknisiIds.map(pegNama).join(', ')}` });
      const dp = Math.min(+fd.dp || 0, c.total);
      if (dp > 0) o.pembayaran = [{ id: uid(), tanggal: o.tanggal, jumlah: dp, metode: fd.dpMetode, oleh: user, catatan: dp < c.total ? 'Uang muka' : '' }];
      o.createdBy = user;
    } else {
      const changes = [];
      if (editing.total !== o.total) changes.push(`total ${rp(editing.total)} → ${rp(o.total)}`);
      if (editing.jadwal !== o.jadwal) changes.push(`jadwal ${o.jadwal ? fmtDateTime(o.jadwal) : '-'}`);
      if (editing.teknisiIds.join() !== o.teknisiIds.join()) changes.push(`teknisi: ${o.teknisiIds.map(pegNama).join(', ') || '-'}`);
      if (o.status === 'Baru' && o.jadwal && o.teknisiIds.length) { o.status = 'Dijadwalkan'; o.timeline.push({ waktu: Date.now(), status: 'Dijadwalkan', oleh: user }); }
      o.timeline.push({ waktu: Date.now(), status: 'Diubah', oleh: user, catatan: changes.join('; ') });
    }
    await save('orders', o, { log: { detail: editing ? 'Ubah data order' : `Order baru ${o.kendaraan.plat} · ${rp(o.total)}` } });
    toast(editing ? 'Order diperbarui' : `Order ${o.no} berhasil dibuat`);
    location.hash = `#/orders/${o.id}`;
  });
}

const blankItem = () => ({ barangId: '', nama: '', qty: 1, harga: 0, diskon: 0, kenaPajak: false, jenis: 'barang', hpp: 0 });

export function quickPelanggan(onSaved) {
  formModal({
    title: 'Pelanggan Baru',
    body: `<div class="form-grid">
      <div class="field col-12"><label>Nama *</label><input name="nama" required></div>
      <div class="field col-6"><label>No. HP / WA</label><input name="telp" inputmode="tel"></div>
      <div class="field col-6"><label>Tipe</label><select name="tipe">${options(['Perorangan', 'Perusahaan', 'Asuransi'])}</select></div>
      <div class="field col-12"><label>Alamat</label><input name="alamat"></div>
    </div>`,
    onSubmit: async (d) => {
      const c = await save('pelanggan', d);
      toast('Pelanggan ditambahkan');
      onSaved(c);
    },
  });
}
