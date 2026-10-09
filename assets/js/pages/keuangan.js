import { cache, byId, save, remove, nextNo } from '../db.js';
import { rp, num, esc, todayStr, fmtDate, options, toast, emptyState, formModal, confirmDlg, debounce, exportCSV, BULAN } from '../utils.js';
import { COA, akunNama, akunLabel, journal, balances, normalBal, refLink, isDebitNormal } from '../calc.js';
import { state, can } from '../state.js';
import { printReport } from '../print.js';

// ---------- Periode bersama ----------
const P = state.period || (state.period = { from: todayStr().slice(0, 8) + '01', to: todayStr() });
function periodBar(extra = '') {
  return `<div class="toolbar">
    <div class="flex flex-wrap"><span class="muted small strong">Periode</span><input type="date" id="pFrom" value="${P.from}"><span class="muted small">s/d</span><input type="date" id="pTo" value="${P.to}"></div>
    <div class="tabs">
      <button class="tab" data-q="m0">Bulan ini</button><button class="tab" data-q="m1">Bulan lalu</button><button class="tab" data-q="y0">Tahun ini</button><button class="tab" data-q="all">Semua</button>
    </div>${extra}
  </div>`;
}
function bindPeriod(root, onChange) {
  root.querySelector('#pFrom').addEventListener('change', (e) => { P.from = e.target.value; onChange(); });
  root.querySelector('#pTo').addEventListener('change', (e) => { P.to = e.target.value; onChange(); });
  root.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (!q) return;
    const d = new Date();
    if (q === 'm0') { P.from = todayStr(new Date(d.getFullYear(), d.getMonth(), 1)); P.to = todayStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
    if (q === 'm1') { P.from = todayStr(new Date(d.getFullYear(), d.getMonth() - 1, 1)); P.to = todayStr(new Date(d.getFullYear(), d.getMonth(), 0)); }
    if (q === 'y0') { P.from = `${d.getFullYear()}-01-01`; P.to = `${d.getFullYear()}-12-31`; }
    if (q === 'all') { P.from = '2000-01-01'; P.to = '2099-12-31'; }
    root.querySelector('#pFrom').value = P.from;
    root.querySelector('#pTo').value = P.to;
    onChange();
  });
}
const periodText = () => `${fmtDate(P.from)} – ${fmtDate(P.to)}`;
const akunOptions = (sel, filter = () => true) => COA.filter(filter).map((a) => `<option value="${a.kode}" ${a.kode === sel ? 'selected' : ''}>${a.kode} · ${esc(a.nama)}</option>`).join('');

// ---------- Kas & Biaya ----------
export function renderKas(root) {
  const bal = balances(null, todayStr());
  root.innerHTML = `
  <div class="page-header">
    <div><h1>Kas & Biaya</h1><p>Catat biaya operasional, pemasukan lain, setoran modal, dan transfer kas–bank.</p></div>
    <div class="actions">
      <button class="btn btn-ghost" data-act="transfer"><i data-lucide="arrow-left-right"></i> Transfer</button>
      <button class="btn btn-ghost" data-act="masuk"><i data-lucide="arrow-down-left"></i> Pemasukan</button>
      <button class="btn btn-primary" data-act="keluar"><i data-lucide="arrow-up-right"></i> Catat Pengeluaran</button>
    </div>
  </div>
  <div class="kpis">
    <div class="card kpi"><div class="kpi-ic ic-green"><i data-lucide="banknote"></i></div><div><div class="label">Saldo Kas Tunai</div><div class="value">${rp(bal['1101'])}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-blue"><i data-lucide="landmark"></i></div><div><div class="label">Saldo Bank</div><div class="value">${rp(bal['1102'])}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-amber"><i data-lucide="hand-coins"></i></div><div><div class="label">Piutang Usaha</div><div class="value">${rp(Math.max(0, bal['1103'] || 0))}</div></div></div>
    <div class="card kpi"><div class="kpi-ic ic-red"><i data-lucide="file-warning"></i></div><div><div class="label">Hutang Usaha</div><div class="value">${rp(-(bal['2101'] || 0))}</div></div></div>
  </div>
  <div class="card">
    <div class="underline-tabs" style="padding:0 12px;margin:0"><button class="tab active" data-tab="trx">Transaksi Kas</button><button class="tab" data-tab="mutasi">Mutasi Kas & Bank</button></div>
    ${periodBar('<div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari keterangan…"></div>')}
    <div class="table-wrap" id="tbl"></div>
  </div>`;
  let tab = 'trx', q = '';
  const draw = () => {
    if (tab === 'trx') {
      const list = cache.kas.filter((k) => k.tanggal >= P.from && k.tanggal <= P.to && (!q || `${k.keterangan} ${akunNama(k.akun)} ${k.no}`.toLowerCase().includes(q))).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt);
      root.querySelector('#tbl').innerHTML = `<table class="table"><thead><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th>Akun</th><th>Kas/Bank</th><th class="r">Masuk</th><th class="r">Keluar</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((k) => `<tr><td class="mono">${esc(k.no)}</td><td class="nowrap">${fmtDate(k.tanggal)}</td><td class="cell-title">${esc(k.keterangan)}</td><td><span class="badge b-gray">${esc(akunLabel(k.akun))}</span></td><td>${akunNama(k.akunKas)}</td>
          <td class="r text-success strong">${k.jenis === 'masuk' ? rp(k.jumlah) : ''}</td><td class="r text-danger strong">${k.jenis === 'keluar' ? rp(k.jumlah) : ''}</td>
          <td class="actions"><button class="btn-icon sm" data-edit="${k.id}"><i data-lucide="pencil"></i></button>${can('admin') ? `<button class="btn-icon sm danger" data-del="${k.id}"><i data-lucide="trash-2"></i></button>` : ''}</td></tr>`).join('') : `<tr><td colspan="8">${emptyState('wallet', 'Belum ada transaksi kas pada periode ini')}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="5">Total</td><td class="r">${rp(list.filter((k) => k.jenis === 'masuk').reduce((a, k) => a + k.jumlah, 0))}</td><td class="r">${rp(list.filter((k) => k.jenis === 'keluar').reduce((a, k) => a + k.jumlah, 0))}</td><td></td></tr></tfoot></table>`;
    } else {
      const J = journal();
      const open = balances(null, prevDay(P.from), J);
      let saldo = (open['1101'] || 0) + (open['1102'] || 0);
      const rows = [];
      for (const j of J) {
        if (j.tanggal < P.from || j.tanggal > P.to) continue;
        for (const l of j.lines) if (l.akun === '1101' || l.akun === '1102') { saldo += l.d - l.k; rows.push({ j, l, saldo }); }
      }
      const filtered = rows.filter((r) => !q || `${r.j.ket} ${r.j.no}`.toLowerCase().includes(q));
      root.querySelector('#tbl').innerHTML = `<table class="table"><thead><tr><th>Tanggal</th><th>No</th><th>Keterangan</th><th>Akun</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th></tr></thead>
        <tbody><tr class="group-row"><td colspan="6">Saldo awal</td><td class="r">${rp((open['1101'] || 0) + (open['1102'] || 0))}</td></tr>
        ${[...filtered].reverse().map((r) => { const link = refLink(r.j.ref); return `<tr ${link ? `class="clickable" data-href="${link}"` : ''}><td class="nowrap">${fmtDate(r.j.tanggal)}</td><td class="mono">${esc(r.j.no)}</td><td>${esc(r.j.ket)}</td><td>${akunNama(r.l.akun)}</td><td class="r text-success">${r.l.d ? rp(r.l.d) : ''}</td><td class="r text-danger">${r.l.k ? rp(r.l.k) : ''}</td><td class="r strong">${rp(r.saldo)}</td></tr>`; }).join('')}</tbody></table>`;
    }
    window.lucide?.createIcons();
  };
  draw();
  bindPeriod(root, draw);
  root.querySelector('#q').addEventListener('input', debounce((e) => { q = e.target.value.toLowerCase(); draw(); }, 150));
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === t)); draw(); return; }
    const h = e.target.closest('[data-href]');
    if (h) location.hash = h.dataset.href;
    const ed = e.target.closest('[data-edit]');
    if (ed) { const k = byId('kas', ed.dataset.edit); return kasDialog(k.jenis, k); }
    const del = e.target.closest('[data-del]');
    if (del && (await confirmDlg('Hapus transaksi kas ini?'))) { await remove('kas', del.dataset.del); toast('Transaksi dihapus'); return state.rerender(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'keluar' || act === 'masuk') kasDialog(act);
    if (act === 'transfer') transferDialog();
  });
}
const prevDay = (d) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - 1); return todayStr(x); };

function kasDialog(jenis, k) {
  const keluar = jenis === 'keluar';
  const filter = keluar ? (a) => ['6', '5', '3', '2', '1'].includes(a.kode[0]) && !['1101', '1102', '1104'].includes(a.kode) : (a) => ['4', '3', '2', '1'].includes(a.kode[0]) && !['1101', '1102', '1104'].includes(a.kode);
  formModal({
    title: (k ? 'Ubah ' : '') + (keluar ? 'Pengeluaran / Biaya' : 'Pemasukan Lain'),
    body: `<div class="form-grid">
      <div class="field col-6"><label>Tanggal *</label><input type="date" name="tanggal" value="${k?.tanggal || todayStr()}" required></div>
      <div class="field col-6"><label>${keluar ? 'Dibayar dari' : 'Diterima ke'}</label><select name="akunKas">${options([['1101', 'Kas Tunai'], ['1102', 'Bank']], k?.akunKas || '1101')}</select></div>
      <div class="field col-12"><label>Akun ${keluar ? 'Biaya' : 'Pendapatan/Sumber'} *</label><select name="akun" required>${akunOptions(k?.akun || (keluar ? '6199' : '4201'), filter)}</select>
        <div class="help">${keluar ? 'Gunakan 3102 Prive untuk pengambilan pribadi pemilik, 2103 untuk setor PPh.' : 'Gunakan 3101 Modal Pemilik untuk setoran modal.'}</div></div>
      <div class="field col-12"><label>Jumlah *</label><input type="number" name="jumlah" min="1" value="${k?.jumlah || ''}" required></div>
      <div class="field col-12"><label>Keterangan *</label><input name="keterangan" value="${esc(k?.keterangan || '')}" required placeholder="${keluar ? 'cth: Bayar listrik bulan Oktober' : 'cth: Penjualan kaca bekas'}"></div>
    </div>`,
    onSubmit: async (d) => {
      if (d.jumlah <= 0) { toast('Jumlah tidak valid', 'error'); return false; }
      const obj = k ? Object.assign(k, d) : { ...d, jenis, no: nextNo('kas', keluar ? 'BK' : 'BM', d.tanggal), oleh: state.user.nama };
      await save('kas', obj, { log: { detail: `${akunNama(d.akun)} · ${rp(d.jumlah)} · ${d.keterangan}` } });
      toast('Transaksi kas disimpan');
      state.rerender();
    },
  });
}

function transferDialog() {
  formModal({
    title: 'Transfer Kas ↔ Bank',
    body: `<div class="form-grid">
      <div class="field col-6"><label>Tanggal</label><input type="date" name="tanggal" value="${todayStr()}"></div>
      <div class="field col-6"><label>Arah</label><select name="arah">${options([['kb', 'Kas → Bank (setor)'], ['bk', 'Bank → Kas (tarik tunai)']], 'kb')}</select></div>
      <div class="field col-12"><label>Jumlah *</label><input type="number" name="jumlah" min="1" required></div>
    </div>`,
    onSubmit: async (d) => {
      const kb = d.arah === 'kb';
      await save('kas', { tanggal: d.tanggal, jenis: 'keluar', akunKas: kb ? '1101' : '1102', akun: kb ? '1102' : '1101', jumlah: d.jumlah, keterangan: kb ? 'Setor tunai ke bank' : 'Tarik tunai dari bank', no: nextNo('kas', 'TR', d.tanggal), oleh: state.user.nama });
      toast('Transfer dicatat');
      state.rerender();
    },
  });
}

// ---------- Jurnal Umum ----------
export function renderJurnal(root) {
  root.innerHTML = `
  <div class="page-header">
    <div><h1>Jurnal Umum</h1><p>Jurnal otomatis dari penjualan, pembelian, kas, dan stok. Tambahkan jurnal manual untuk penyesuaian.</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button><button class="btn btn-primary" data-act="add"><i data-lucide="plus"></i> Jurnal Manual</button></div>
  </div>
  <div class="card">${periodBar('<div class="search"><i data-lucide="search"></i><input id="q" placeholder="Cari no / keterangan…"></div>')}<div class="table-wrap" id="tbl"></div></div>`;
  let q = '';
  const list = () => journal().filter((j) => j.tanggal >= P.from && j.tanggal <= P.to && (!q || `${j.no} ${j.ket}`.toLowerCase().includes(q)));
  const tableHTML = (L) => {
    let td = 0, tk = 0;
    const body = L.map((j) => {
      const link = refLink(j.ref);
      return j.lines.map((l, i) => { td += l.d; tk += l.k; return `<tr ${i === 0 ? 'style="border-top:2px solid var(--border)"' : ''}>
        <td class="nowrap">${i === 0 ? fmtDate(j.tanggal) : ''}</td>
        <td>${i === 0 ? `${link ? `<a href="${link}" class="mono">${esc(j.no)}</a>` : `<span class="mono">${esc(j.no)}</span>`}` : ''}</td>
        <td>${i === 0 ? `${esc(j.ket)} ${j.auto ? '<span class="badge b-gray">Otomatis</span>' : `<span class="badge b-purple">Manual</span>${can('admin') && j.ref?.id && j.ref.id !== 'j-saldo' ? ` <button class="btn-icon sm danger" data-deljur="${j.ref.id}"><i data-lucide="trash-2"></i></button>` : ''}`}` : ''}</td>
        <td style="${l.k ? 'padding-left:36px' : ''}">${esc(akunLabel(l.akun))}</td><td class="r">${l.d ? num(l.d) : ''}</td><td class="r">${l.k ? num(l.k) : ''}</td></tr>`; }).join('');
    }).join('');
    return `<table class="table compact"><thead><tr><th>Tanggal</th><th>No</th><th>Keterangan</th><th>Akun</th><th class="r">Debit</th><th class="r">Kredit</th></tr></thead>
      <tbody>${body || `<tr><td colspan="6">${emptyState('book-open', 'Tidak ada jurnal pada periode ini')}</td></tr>`}</tbody>
      <tfoot><tr><td colspan="4">Total ${td === tk ? '<span class="badge b-green">Seimbang</span>' : '<span class="badge b-red">Tidak seimbang</span>'}</td><td class="r">${num(td)}</td><td class="r">${num(tk)}</td></tr></tfoot></table>`;
  };
  const draw = () => { root.querySelector('#tbl').innerHTML = tableHTML(list()); window.lucide?.createIcons(); };
  draw();
  bindPeriod(root, draw);
  root.querySelector('#q').addEventListener('input', debounce((e) => { q = e.target.value.toLowerCase(); draw(); }, 150));
  root.addEventListener('click', async (e) => {
    const dj = e.target.closest('[data-deljur]');
    if (dj && (await confirmDlg('Hapus jurnal manual ini?'))) { await remove('jurnal', dj.dataset.deljur); toast('Jurnal dihapus'); return draw(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') jurnalDialog(draw);
    if (act === 'print') printReport('JURNAL UMUM', periodText(), tableHTML(list()));
    if (act === 'csv') exportCSV(`jurnal-${P.from}-${P.to}.csv`, [['Tanggal', 'No', 'Keterangan', 'Kode Akun', 'Nama Akun', 'Debit', 'Kredit'], ...list().flatMap((j) => j.lines.map((l) => [j.tanggal, j.no, j.ket, l.akun, akunNama(l.akun), l.d, l.k]))]);
  });
}

export function jurnalDialog(onDone, preset) {
  const lines = preset?.lines || [{ akun: '', debit: 0, kredit: 0 }, { akun: '', debit: 0, kredit: 0 }];
  const m = formModal({
    title: 'Jurnal Manual', size: 'lg',
    body: `<div class="form-grid mb-2">
      <div class="field col-4"><label>Tanggal *</label><input type="date" name="tanggal" value="${preset?.tanggal || todayStr()}" required></div>
      <div class="field col-8"><label>Keterangan *</label><input name="keterangan" value="${esc(preset?.keterangan || '')}" required></div></div>
      <div class="table-wrap"><table class="table items-table"><thead><tr><th>Akun</th><th style="width:150px">Debit</th><th style="width:150px">Kredit</th><th style="width:40px"></th></tr></thead><tbody id="jl"></tbody>
      <tfoot><tr><td>Total <span id="bal"></span></td><td class="r" id="td"></td><td class="r" id="tk"></td><td></td></tr></tfoot></table></div>
      <button type="button" class="btn btn-soft btn-sm mt-1" data-addline><i data-lucide="plus"></i> Tambah Baris</button>`,
    onMount: ({ el }) => {
      const tb = el.querySelector('#jl');
      const draw = () => {
        tb.innerHTML = lines.map((l, i) => `<tr data-i="${i}"><td><select data-k="akun"><option value="">— Pilih akun —</option>${akunOptions(l.akun)}</select></td>
          <td><input type="number" data-k="debit" value="${l.debit || ''}" min="0"></td><td><input type="number" data-k="kredit" value="${l.kredit || ''}" min="0"></td>
          <td><button type="button" class="btn-icon sm danger" data-rm="${i}"><i data-lucide="x"></i></button></td></tr>`).join('');
        window.lucide?.createIcons();
        tot();
      };
      const tot = () => {
        const d = lines.reduce((a, l) => a + (+l.debit || 0), 0), k = lines.reduce((a, l) => a + (+l.kredit || 0), 0);
        el.querySelector('#td').textContent = num(d);
        el.querySelector('#tk').textContent = num(k);
        el.querySelector('#bal').innerHTML = d === k && d > 0 ? '<span class="badge b-green">Seimbang</span>' : '<span class="badge b-red">Belum seimbang</span>';
      };
      tb.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; lines[+e.target.closest('tr').dataset.i][k] = k === 'akun' ? e.target.value : +e.target.value || 0; tot(); });
      tb.addEventListener('change', (e) => { if (e.target.dataset.k === 'akun') lines[+e.target.closest('tr').dataset.i].akun = e.target.value; });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-addline]')) { lines.push({ akun: '', debit: 0, kredit: 0 }); draw(); }
        const rm = e.target.closest('[data-rm]');
        if (rm && lines.length > 2) { lines.splice(+rm.dataset.rm, 1); draw(); }
      });
      draw();
    },
    onSubmit: async (d) => {
      const valid = lines.filter((l) => l.akun && (l.debit || l.kredit));
      const td = valid.reduce((a, l) => a + (+l.debit || 0), 0), tk = valid.reduce((a, l) => a + (+l.kredit || 0), 0);
      if (valid.length < 2 || td !== tk || !td) { toast('Jurnal harus seimbang (debit = kredit) dan minimal 2 baris', 'error'); return false; }
      await save('jurnal', { no: nextNo('jurnal', 'JU', d.tanggal), tanggal: d.tanggal, keterangan: d.keterangan, lines: valid, tag: preset?.tag, oleh: state.user.nama }, { log: { detail: `${d.keterangan} · ${rp(td)}` } });
      toast('Jurnal disimpan');
      onDone?.();
    },
  });
  return m;
}

// ---------- Buku Besar ----------
export function renderBukuBesar(root, params, query = {}) {
  let akun = query.akun || '1101';
  root.innerHTML = `
  <div class="page-header"><div><h1>Buku Besar</h1><p>Rincian mutasi dan saldo per akun.</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button><button class="btn btn-ghost" data-act="csv"><i data-lucide="download"></i> Export</button></div></div>
  <div class="card">${periodBar(`<select id="akun" style="min-width:260px">${akunOptions(akun)}</select>`)}<div class="table-wrap" id="tbl"></div></div>`;
  const rows = () => {
    const J = journal();
    const open = normalBal(akun, balances(null, prevDay(P.from), J)[akun] || 0);
    let saldo = open;
    const out = [];
    for (const j of J) {
      if (j.tanggal < P.from || j.tanggal > P.to) continue;
      for (const l of j.lines) if (l.akun === akun) { saldo += isDebitNormal(akun) ? l.d - l.k : l.k - l.d; out.push({ j, l, saldo }); }
    }
    return { open, out, saldo };
  };
  const tableHTML = ({ open, out, saldo }) => `<table class="table"><thead><tr><th>Tanggal</th><th>No</th><th>Keterangan</th><th class="r">Debit</th><th class="r">Kredit</th><th class="r">Saldo</th></tr></thead>
    <tbody><tr class="group-row"><td colspan="5">Saldo awal · ${esc(akunLabel(akun))}</td><td class="r">${rp(open)}</td></tr>
    ${out.map((r) => { const link = refLink(r.j.ref); return `<tr ${link ? `class="clickable" data-href="${link}"` : ''}><td class="nowrap">${fmtDate(r.j.tanggal)}</td><td class="mono">${esc(r.j.no)}</td><td>${esc(r.j.ket)}</td><td class="r">${r.l.d ? num(r.l.d) : ''}</td><td class="r">${r.l.k ? num(r.l.k) : ''}</td><td class="r strong">${rp(r.saldo)}</td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td colspan="3">Saldo akhir</td><td class="r">${num(out.reduce((a, r) => a + r.l.d, 0))}</td><td class="r">${num(out.reduce((a, r) => a + r.l.k, 0))}</td><td class="r">${rp(saldo)}</td></tr></tfoot></table>`;
  const draw = () => { root.querySelector('#tbl').innerHTML = tableHTML(rows()); };
  draw();
  bindPeriod(root, draw);
  root.querySelector('#akun').addEventListener('change', (e) => { akun = e.target.value; draw(); });
  root.addEventListener('click', (e) => {
    const h = e.target.closest('[data-href]');
    if (h) location.hash = h.dataset.href;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'print') printReport('BUKU BESAR', `${akunLabel(akun)} · ${periodText()}`, tableHTML(rows()));
    if (act === 'csv') { const r = rows(); exportCSV(`buku-besar-${akun}.csv`, [['Tanggal', 'No', 'Keterangan', 'Debit', 'Kredit', 'Saldo'], ['', '', 'Saldo awal', '', '', r.open], ...r.out.map((x) => [x.j.tanggal, x.j.no, x.j.ket, x.l.d, x.l.k, x.saldo])]); }
  });
}

// ---------- Laba Rugi ----------
export function renderLabaRugi(root) {
  root.innerHTML = `
  <div class="page-header"><div><h1>Laporan Laba Rugi</h1><p>Pendapatan, HPP, dan beban operasional pada periode terpilih.</p></div>
    <div class="actions"><button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button></div></div>
  <div class="card">${periodBar()}<div id="rep"></div></div>`;
  const build = () => {
    const b = balances(P.from, P.to);
    const sec = (prefix) => COA.filter((a) => a.kode.startsWith(prefix)).map((a) => ({ a, v: normalBal(a.kode, b[a.kode] || 0) })).filter((x) => x.v);
    const pend = sec('4'), hpp = sec('5'), beban = sec('6');
    const tP = pend.reduce((a, x) => a + x.v, 0), tH = hpp.reduce((a, x) => a + x.v, 0), tB = beban.reduce((a, x) => a + x.v, 0);
    const kotor = tP - tH, bersih = kotor - tB;
    const rows = (list) => list.map((x) => `<tr class="indent"><td>${x.a.kode} · ${esc(x.a.nama)}</td><td class="r">${rp(x.v)}</td></tr>`).join('') || '<tr class="indent"><td class="muted">—</td><td></td></tr>';
    return `<div class="report-head"><h2>LAPORAN LABA RUGI</h2><p>${periodText()}</p></div>
    <div class="table-wrap"><table class="table report-table">
      <tr class="section-row"><td colspan="2">Pendapatan</td></tr>${rows(pend)}<tr class="total-row"><td>Total Pendapatan</td><td class="r">${rp(tP)}</td></tr>
      <tr class="section-row"><td colspan="2">Harga Pokok Penjualan</td></tr>${rows(hpp)}<tr class="total-row"><td>Total HPP</td><td class="r">${rp(tH)}</td></tr>
      <tr class="total-row"><td>LABA KOTOR <span class="muted small">(margin ${tP ? Math.round((kotor / tP) * 100) : 0}%)</span></td><td class="r">${rp(kotor)}</td></tr>
      <tr class="section-row"><td colspan="2">Beban Operasional</td></tr>${rows(beban)}<tr class="total-row"><td>Total Beban</td><td class="r">${rp(tB)}</td></tr>
      <tr class="total-row" style="font-size:16px"><td>LABA (RUGI) BERSIH</td><td class="r ${bersih < 0 ? 'text-danger' : 'text-success'}">${rp(bersih)}</td></tr>
    </table></div>`;
  };
  const draw = () => { root.querySelector('#rep').innerHTML = build(); };
  draw();
  bindPeriod(root, draw);
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act=print]')) printReport('', '', build()); });
}

// ---------- Neraca ----------
export function renderNeraca(root) {
  root.innerHTML = `
  <div class="page-header"><div><h1>Neraca</h1><p>Posisi aset, kewajiban, dan ekuitas per tanggal.</p></div>
    <div class="actions"><input type="date" id="asof" value="${P.to}" style="width:auto"><button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Cetak</button></div></div>
  <div class="card" id="rep"></div>`;
  const build = () => {
    const asof = root.querySelector('#asof').value;
    const b = balances(null, asof);
    const sec = (p) => COA.filter((a) => a.kode.startsWith(p)).map((a) => ({ a, v: normalBal(a.kode, b[a.kode] || 0) })).filter((x) => x.v);
    const aset = sec('1'), kew = sec('2'), modal = sec('3');
    const laba = -['4', '5', '6'].reduce((s, p) => s + COA.filter((a) => a.kode.startsWith(p)).reduce((t, a) => t + (b[a.kode] || 0), 0), 0);
    const tA = aset.reduce((s, x) => s + x.v, 0), tK = kew.reduce((s, x) => s + x.v, 0);
    const tM = modal.reduce((s, x) => s + (x.a.kode === '3102' ? -x.v : x.v), 0) + laba;
    const rows = (l, neg) => l.map((x) => `<tr class="indent"><td>${x.a.kode} · ${esc(x.a.nama)}</td><td class="r">${rp(neg && x.a.kode === '3102' ? -x.v : x.v)}</td></tr>`).join('');
    return `<div class="report-head"><h2>NERACA</h2><p>Per ${fmtDate(asof)}</p></div>
    <div class="grid grid-2" style="padding:0 20px 20px">
      <div class="table-wrap"><table class="table report-table"><tr class="section-row"><td colspan="2">Aset</td></tr>${rows(aset)}<tr class="total-row"><td>TOTAL ASET</td><td class="r">${rp(tA)}</td></tr></table></div>
      <div class="table-wrap"><table class="table report-table">
        <tr class="section-row"><td colspan="2">Kewajiban</td></tr>${rows(kew) || '<tr class="indent"><td class="muted">—</td><td></td></tr>'}<tr class="total-row"><td>Total Kewajiban</td><td class="r">${rp(tK)}</td></tr>
        <tr class="section-row"><td colspan="2">Ekuitas</td></tr>${rows(modal, true)}<tr class="indent"><td>Laba ditahan & berjalan</td><td class="r">${rp(laba)}</td></tr><tr class="total-row"><td>Total Ekuitas</td><td class="r">${rp(tM)}</td></tr>
        <tr class="total-row"><td>TOTAL KEWAJIBAN & EKUITAS</td><td class="r">${rp(tK + tM)}</td></tr>
      </table></div>
    </div>
    <div style="padding:0 20px 20px">${Math.round(tA) === Math.round(tK + tM) ? '<div class="alert alert-success" style="margin:0"><i data-lucide="check-circle-2"></i><div>Neraca seimbang.</div></div>' : `<div class="alert alert-danger" style="margin:0"><i data-lucide="alert-triangle"></i><div>Selisih ${rp(tA - tK - tM)}</div></div>`}</div>`;
  };
  const draw = () => { root.querySelector('#rep').innerHTML = build(); window.lucide?.createIcons(); };
  draw();
  root.querySelector('#asof').addEventListener('change', draw);
  root.addEventListener('click', (e) => { if (e.target.closest('[data-act=print]')) printReport('', '', build()); });
}
