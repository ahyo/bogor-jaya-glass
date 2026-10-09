import { cache, byId, save, remove, idb, getSettings, logActivity } from '../db.js';
import { rp, esc, fmtDate, fmtDateTime, todayStr, nowLocal, addDays, modal, formModal, confirmDlg, toast, options, emptyState, uid, initials, waLink, download, fileSize } from '../utils.js';
import { statusBadge, payBadge, paid, sisa, pelNama, pegNama, kendaraanLabel, lineTotal, teknisiList, TAHAP, METODE, ppnBadge } from '../calc.js';
import { state, can, trackUrl } from '../state.js';
import { printInvoice } from '../print.js';

const STEPS = ['Baru', 'Dijadwalkan', 'Dikerjakan', 'Selesai'];

export async function render(root, { id }) {
  const o = byId('orders', id);
  if (!o) { root.innerHTML = emptyState('file-x', 'Order tidak ditemukan', '', '<a class="btn btn-ghost" href="#/orders">Kembali</a>'); return; }
  const s = getSettings();
  const media = (await idb.byIndex('media', 'orderId', id)).sort((a, b) => a.waktu - b.waktu);
  // sinkronkan jumlah media
  const mc = { before: 0, proses: 0, after: 0 };
  media.forEach((m) => { mc[m.tahap] = (mc[m.tahap] || 0) + 1; });
  if (JSON.stringify(mc) !== JSON.stringify(o.mediaCount || {})) { o.mediaCount = mc; await save('orders', o, { log: false }); }
  for (const m of media) m.url = trackUrl(URL.createObjectURL(m.blob));

  const pel = byId('pelanggan', o.pelangganId) || {};
  const tek = state.user.role === 'teknisi';
  const showMoney = !tek;
  const idx = STEPS.indexOf(o.status);
  const garansiSampai = o.status === 'Selesai' && o.garansiHari ? addDays(o.tglSelesai || o.tanggal, o.garansiHari) : null;
  const k = o.kendaraan || {};
  const history = cache.orders.filter((x) => x.id !== o.id && (x.kendaraan?.plat === k.plat || x.pelangganId === o.pelangganId)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  root.innerHTML = `
  <div class="page-header">
    <div>
      <a class="back-link" href="${tek ? '#/tugas' : '#/orders'}"><i data-lucide="arrow-left"></i> Kembali</a>
      <div class="flex flex-wrap"><h1>${esc(o.no)}</h1>${statusBadge(o.status)} ${showMoney && o.status !== 'Batal' ? payBadge(o) : ''}</div>
      <p>${esc(pelNama(o.pelangganId))} · <span class="plate">${esc(k.plat || '-')}</span> ${esc(kendaraanLabel(k))}</p>
    </div>
    <div class="actions">
      ${primaryAction(o)}
      ${showMoney ? `<button class="btn btn-ghost" data-act="print"><i data-lucide="printer"></i> Invoice</button>` : ''}
      ${showMoney && pel.telp ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="${waLink(pel.telp, waText(o, pel))}"><i data-lucide="message-circle"></i> WhatsApp</a>` : ''}
      ${can('admin', 'kasir') && (o.status !== 'Selesai' || can('admin')) && o.status !== 'Batal' ? `<a class="btn btn-ghost" href="#/orders/${o.id}/edit"><i data-lucide="pencil"></i> Ubah</a>` : ''}
      ${can('admin', 'kasir') ? `<button class="btn-icon" data-act="more" title="Lainnya"><i data-lucide="more-vertical"></i></button>` : ''}
    </div>
  </div>

  ${o.status === 'Batal' ? `<div class="alert alert-danger"><i data-lucide="x-circle"></i><div><b>Order dibatalkan.</b> ${esc(o.alasanBatal || '')}</div></div>` : `
  <div class="card mb-2"><div class="stepper">${STEPS.map((st, i) => `<div class="step ${i < idx || o.status === 'Selesai' ? 'done' : i === idx ? 'current' : ''}"><span class="dot">${i < idx || o.status === 'Selesai' ? '<i data-lucide="check"></i>' : i + 1}</span><span>${st}</span></div>`).join('')}</div></div>`}

  ${s.wajibFoto && ['Dijadwalkan', 'Dikerjakan'].includes(o.status) && (!mc.before || (o.status === 'Dikerjakan' && !mc.after)) ? `<div class="alert alert-warning"><i data-lucide="camera"></i><div><b>Dokumentasi wajib.</b> ${!mc.before ? 'Unggah foto/video <b>BEFORE</b> sebelum mulai bekerja.' : 'Unggah foto/video <b>AFTER</b> sebelum menandai pekerjaan selesai.'}</div></div>` : ''}

  <div class="grid grid-main">
    <div class="stack">
      <section class="card">
        <div class="card-header"><h3><i data-lucide="camera"></i> Dokumentasi Pekerjaan</h3>
          <div class="flex">${mc.before && mc.after ? `<button class="btn btn-soft btn-sm" data-act="compare"><i data-lucide="columns-2"></i> Bandingkan Before/After</button>` : ''}</div></div>
        <div class="card-body"><div class="media-cols">
          ${Object.entries(TAHAP).map(([t, cfg]) => `<div class="media-col">
            <div class="media-col-head"><span class="badge ${cfg.cls}">${cfg.label}</span><span class="muted small">${mc[t] || 0} file</span></div>
            <div class="media-grid">
              ${media.filter((m) => m.tahap === t).map((m) => `<button class="media-tile" data-media="${m.id}" title="${esc(m.nama)}">
                ${m.tipe === 'video' ? `<video src="${m.url}#t=0.1" muted preload="metadata" playsinline></video><span class="play"><i data-lucide="play-circle"></i></span>` : `<img src="${m.url}" alt="${esc(cfg.label)}" loading="lazy">`}
              </button>`).join('')}
              ${o.status !== 'Batal' ? `<label class="media-upload"><input type="file" accept="image/*,video/*" multiple data-upload="${t}" hidden><i data-lucide="camera"></i><span>Foto / Video</span></label>` : ''}
            </div>
          </div>`).join('')}
        </div>
        <p class="muted small mt-1"><i data-lucide="info" style="width:14px;height:14px;vertical-align:-2px"></i> Foto otomatis diberi cap waktu & nomor order. Video maks. 200 MB per file.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h3><i data-lucide="package"></i> Rincian Barang & Jasa</h3></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Item</th><th class="r">Qty</th>${showMoney ? '<th class="r">Harga</th><th class="r">Diskon</th><th class="r">Jumlah</th>' : ''}</tr></thead>
          <tbody>${o.items.map((it) => `<tr><td><div class="cell-title">${esc(it.nama)}</div><div class="flex" style="margin-top:3px">${it.jenis === 'jasa' ? '<span class="badge b-purple">Jasa</span>' : '<span class="badge b-gray">Barang</span>'}${it.kenaPajak ? ppnBadge() : ''}</div></td>
            <td class="r nowrap">${it.qty} ${esc(it.satuan || '')}</td>
            ${showMoney ? `<td class="r nowrap">${rp(it.harga)}</td><td class="r nowrap">${it.diskon ? rp(it.diskon) : '-'}</td><td class="r strong nowrap">${rp(lineTotal(it))}</td>` : ''}</tr>`).join('')}</tbody>
        </table></div>
        ${showMoney ? `<div class="card-body" style="display:flex;justify-content:flex-end"><div class="totals" style="width:min(320px,100%)">
          <div class="row"><span>Subtotal</span><span>${rp(o.subtotal)}</span></div>
          <div class="row"><span>DPP</span><span>${rp(o.dpp)}</span></div>
          <div class="row"><span>PPN</span><span>${rp(o.ppn)}</span></div>
          <div class="row grand"><span>Total</span><span>${rp(o.total)}</span></div>
        </div></div>` : ''}
      </section>

      ${showMoney ? `<section class="card">
        <div class="card-header"><h3><i data-lucide="credit-card"></i> Pembayaran</h3>
          ${o.status !== 'Batal' && sisa(o) > 0 ? `<button class="btn btn-success btn-sm" data-act="pay"><i data-lucide="plus"></i> Terima Pembayaran</button>` : ''}</div>
        ${(o.pembayaran || []).length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Tanggal</th><th>Metode</th><th>Catatan</th><th>Oleh</th><th class="r">Jumlah</th><th></th></tr></thead>
          <tbody>${o.pembayaran.map((p) => `<tr><td>${fmtDate(p.tanggal)}</td><td>${esc(p.metode)}</td><td>${esc(p.catatan || '-')}</td><td>${esc(p.oleh || '-')}</td><td class="r strong">${rp(p.jumlah)}</td>
            <td class="actions">${can('admin') ? `<button class="btn-icon sm danger" data-delpay="${p.id}" title="Hapus"><i data-lucide="trash-2"></i></button>` : ''}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">Sisa tagihan</td><td class="r ${sisa(o) ? 'text-danger' : 'text-success'}">${rp(sisa(o))}</td><td></td></tr></tfoot>
        </table></div>` : `<div class="card-body muted">Belum ada pembayaran. Sisa tagihan <b class="text-danger">${rp(o.total)}</b>.</div>`}
      </section>` : ''}
    </div>

    <div class="stack">
      <section class="card">
        <div class="card-header"><h3><i data-lucide="info"></i> Informasi</h3></div>
        <div class="card-body"><dl class="info-list">
          <dt>Tanggal Order</dt><dd>${fmtDate(o.tanggal)}</dd>
          <dt>Pelanggan</dt><dd>${esc(pel.nama || '-')}</dd>
          ${pel.telp ? `<dt>No. HP</dt><dd><a href="tel:${esc(pel.telp)}">${esc(pel.telp)}</a></dd>` : ''}
          <dt>Kendaraan</dt><dd>${esc(kendaraanLabel(k) || '-')}</dd>
          <dt>Warna</dt><dd>${esc(k.warna || '-')}</dd>
          <dt>Lokasi</dt><dd>${esc(o.lokasi || 'Workshop')}</dd>
          <dt>Jadwal</dt><dd>${o.jadwal ? fmtDateTime(o.jadwal) : '-'}</dd>
          <dt>Teknisi</dt><dd>${esc(o.teknisiIds.map(pegNama).join(', ') || '-')}</dd>
          ${o.mulaiAt ? `<dt>Mulai</dt><dd>${fmtDateTime(o.mulaiAt)}</dd>` : ''}
          ${o.selesaiAt ? `<dt>Selesai</dt><dd>${fmtDateTime(o.selesaiAt)}</dd>` : ''}
          ${garansiSampai ? `<dt>Garansi s/d</dt><dd><span class="badge ${garansiSampai >= todayStr() ? 'b-green' : 'b-gray'}">${fmtDate(garansiSampai)}</span></dd>` : ''}
        </dl>
        ${o.keluhan ? `<div class="mt-2"><div class="muted small strong">KELUHAN</div><p>${esc(o.keluhan)}</p></div>` : ''}
        ${o.catatan ? `<div class="mt-2"><div class="muted small strong">CATATAN</div><p>${esc(o.catatan)}</p></div>` : ''}
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h3><i data-lucide="history"></i> Riwayat Proses</h3><button class="btn btn-ghost btn-sm" data-act="note"><i data-lucide="message-square-plus"></i> Catatan</button></div>
        <div class="card-body"><ul class="timeline">${[...(o.timeline || [])].reverse().map((t) => `<li><div class="t-title">${esc(t.status)}</div><div class="t-meta">${fmtDateTime(t.waktu)} · ${esc(t.oleh || '')}</div>${t.catatan ? `<div class="t-note">${esc(t.catatan)}</div>` : ''}</li>`).join('')}</ul></div>
      </section>
      ${history.length ? `<section class="card">
        <div class="card-header"><h3><i data-lucide="car"></i> Riwayat Kendaraan & Pelanggan</h3></div>
        <ul class="list">${history.slice(0, 8).map((h) => `<li><a class="li-link" href="#/orders/${h.id}"><span class="grow"><b>${esc(h.no)} · <span class="plate">${esc(h.kendaraan?.plat || '')}</span></b><small>${fmtDate(h.tanggal)} · ${esc(h.items.map((i) => i.nama).join(', ').slice(0, 70))}</small></span>${statusBadge(h.status)}</a></li>`).join('')}</ul>
      </section>` : ''}
    </div>
  </div>`;

  // ---------- Events ----------
  root.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-upload]');
    if (!inp || !inp.files.length) return;
    await uploadFiles(o, inp.dataset.upload, [...inp.files]);
    state.rerender();
  });

  root.addEventListener('click', async (e) => {
    const mt = e.target.closest('[data-media]');
    if (mt) return openMedia(o, media, mt.dataset.media);
    const dp = e.target.closest('[data-delpay]');
    if (dp) {
      if (!(await confirmDlg('Hapus pembayaran ini?'))) return;
      const p = o.pembayaran.find((x) => x.id === dp.dataset.delpay);
      o.pembayaran = o.pembayaran.filter((x) => x.id !== dp.dataset.delpay);
      o.timeline.push({ waktu: Date.now(), status: 'Pembayaran dihapus', oleh: state.user.nama, catatan: `${p.metode} ${rp(p.jumlah)}` });
      await save('orders', o, { log: { aksi: 'Hapus Pembayaran', detail: `${p.metode} ${rp(p.jumlah)}` } });
      toast('Pembayaran dihapus');
      return state.rerender();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'print') printInvoice(o);
    if (act === 'pay') payDialog(o);
    if (act === 'compare') compareDialog(media);
    if (act === 'schedule') scheduleDialog(o);
    if (act === 'start') {
      if (s.wajibFoto && !mc.before && !(await confirmDlg('Belum ada foto/video BEFORE. Tetap mulai pengerjaan?', { okText: 'Tetap Mulai', danger: false }))) return;
      await setStatus(o, 'Dikerjakan');
    }
    if (act === 'finish') finishDialog(o, mc);
    if (act === 'reopen') {
      if (!(await confirmDlg('Buka kembali order ini? Penjualan akan dikeluarkan dari laporan sampai ditandai selesai lagi.', { danger: false }))) return;
      o.tglSelesai = '';
      o.selesaiAt = null;
      await setStatus(o, 'Dikerjakan', 'Dibuka kembali');
    }
    if (act === 'note') {
      formModal({
        title: 'Tambah Catatan Proses', body: '<div class="field"><label>Catatan *</label><textarea name="catatan" required rows="3"></textarea></div>',
        onSubmit: async (d) => { o.timeline.push({ waktu: Date.now(), status: 'Catatan', oleh: state.user.nama, catatan: d.catatan }); await save('orders', o, { log: { aksi: 'Catatan', detail: d.catatan } }); state.rerender(); },
      });
    }
    if (act === 'more') moreMenu(e.target.closest('[data-act]'), o);
  });
}

function primaryAction(o) {
  if (o.status === 'Baru' && can('admin', 'kasir')) return `<button class="btn btn-primary" data-act="schedule"><i data-lucide="calendar-plus"></i> Jadwalkan</button>`;
  if (o.status === 'Dijadwalkan') return `<button class="btn btn-primary" data-act="start"><i data-lucide="play"></i> Mulai Pengerjaan</button>`;
  if (o.status === 'Dikerjakan') return `<button class="btn btn-success" data-act="finish"><i data-lucide="check-circle-2"></i> Selesaikan</button>`;
  if (o.status === 'Selesai' && can('admin')) return `<button class="btn btn-ghost" data-act="reopen"><i data-lucide="rotate-ccw"></i> Buka Kembali</button>`;
  return '';
}

async function setStatus(o, status, catatan = '') {
  const prev = o.status;
  o.status = status;
  if (status === 'Dikerjakan' && !o.mulaiAt) o.mulaiAt = Date.now();
  if (status === 'Selesai') { o.selesaiAt = Date.now(); o.tglSelesai = todayStr(); }
  o.timeline.push({ waktu: Date.now(), status, oleh: state.user.nama, catatan });
  await save('orders', o, { log: { aksi: 'Status', detail: `${prev} → ${status}${catatan ? ' · ' + catatan : ''}` } });
  toast(`Status diubah menjadi ${status}`);
  state.rerender();
}

function scheduleDialog(o) {
  formModal({
    title: 'Jadwalkan Pemasangan',
    body: `<div class="form-grid">
      <div class="field col-12"><label>Jadwal *</label><input type="datetime-local" name="jadwal" required value="${esc(o.jadwal || nowLocal())}"></div>
      <div class="field col-12"><label>Teknisi *</label><div class="chips">${teknisiList().map((t) => `<label class="chip"><input type="checkbox" name="teknisiIds" data-multi="1" value="${t.id}" ${o.teknisiIds.includes(t.id) ? 'checked' : ''}><span class="avatar">${initials(t.nama)}</span>${esc(t.nama)}</label>`).join('')}</div></div>
    </div>`,
    onSubmit: async (d) => {
      if (!d.teknisiIds?.length) { toast('Pilih minimal satu teknisi', 'error'); return false; }
      o.jadwal = d.jadwal;
      o.teknisiIds = d.teknisiIds;
      await setStatus(o, 'Dijadwalkan', `${fmtDateTime(d.jadwal)} · ${d.teknisiIds.map(pegNama).join(', ')}`);
    },
  });
}

function finishDialog(o, mc) {
  const s = getSettings();
  const missing = s.wajibFoto && (!mc.before || !mc.after);
  if (missing && !can('admin')) return toast('Unggah minimal 1 foto/video BEFORE dan AFTER terlebih dahulu', 'error');
  formModal({
    title: 'Selesaikan Pekerjaan', submitText: 'Tandai Selesai',
    body: `${missing ? '<div class="alert alert-warning"><i data-lucide="alert-triangle"></i><div>Dokumentasi before/after belum lengkap. Sebagai admin Anda tetap dapat melanjutkan.</div></div>' : ''}
      <div class="alert alert-info"><i data-lucide="info"></i><div>Penjualan akan dicatat ke jurnal & laporan pajak pada tanggal hari ini. Garansi ${o.garansiHari || 0} hari dimulai hari ini.</div></div>
      <div class="field"><label>Catatan hasil pekerjaan</label><textarea name="catatan" rows="3" placeholder="cth: Kaca terpasang rapi, sudah tes semprot air, tidak bocor"></textarea></div>`,
    onSubmit: async (d) => { await setStatus(o, 'Selesai', d.catatan); },
  });
}

function payDialog(o) {
  formModal({
    title: `Terima Pembayaran · ${o.no}`,
    body: `<div class="alert alert-info"><i data-lucide="wallet"></i><div>Total ${rp(o.total)} · Sudah dibayar ${rp(paid(o))} · <b>Sisa ${rp(sisa(o))}</b></div></div>
    <div class="form-grid">
      <div class="field col-6"><label>Tanggal *</label><input type="date" name="tanggal" value="${todayStr()}" required></div>
      <div class="field col-6"><label>Metode *</label><select name="metode">${options(METODE, 'Tunai')}</select></div>
      <div class="field col-12"><label>Jumlah *</label><input type="number" name="jumlah" min="1" value="${sisa(o)}" required></div>
      <div class="field col-12"><label>Catatan</label><input name="catatan" placeholder="cth: Pelunasan, ref transfer"></div>
    </div>`,
    onSubmit: async (d) => {
      if (d.jumlah <= 0) { toast('Jumlah tidak valid', 'error'); return false; }
      if (d.jumlah > sisa(o)) { toast(`Jumlah melebihi sisa tagihan (${rp(sisa(o))})`, 'error'); return false; }
      o.pembayaran ||= [];
      o.pembayaran.push({ id: uid(), ...d, oleh: state.user.nama });
      o.timeline.push({ waktu: Date.now(), status: 'Pembayaran diterima', oleh: state.user.nama, catatan: `${d.metode} ${rp(d.jumlah)}` });
      await save('orders', o, { log: { aksi: 'Pembayaran', detail: `${d.metode} ${rp(d.jumlah)}` } });
      toast('Pembayaran dicatat');
      state.rerender();
    },
  });
}

function moreMenu(btn, o) {
  document.querySelector('.dropdown')?.remove();
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  dd.innerHTML = `
    ${!['Selesai', 'Batal'].includes(o.status) ? '<button data-m="cancel"><i data-lucide="x-circle"></i> Batalkan Order</button>' : ''}
    <a href="#/orders/new"><i data-lucide="plus"></i> Order Baru</a>
    ${can('admin') ? '<button data-m="delete" style="color:var(--danger)"><i data-lucide="trash-2"></i> Hapus Permanen</button>' : ''}`;
  btn.style.position = 'relative';
  btn.appendChild(dd);
  window.lucide?.createIcons();
  dd.onclick = async (e) => {
    e.stopPropagation();
    const m = e.target.closest('[data-m]')?.dataset.m;
    dd.remove();
    if (m === 'cancel') {
      formModal({
        title: 'Batalkan Order', submitText: 'Batalkan Order',
        body: '<div class="field"><label>Alasan pembatalan *</label><textarea name="alasan" required></textarea></div>',
        onSubmit: async (d) => { o.alasanBatal = d.alasan; await setStatus(o, 'Batal', d.alasan); },
      });
    }
    if (m === 'delete') {
      if (!(await confirmDlg(`Hapus order ${o.no} beserta seluruh foto/video? Tindakan ini tidak dapat dibatalkan.`, { okText: 'Hapus Permanen' }))) return;
      for (const k of await idb.keysByIndex('media', 'orderId', o.id)) await idb.del('media', k);
      await remove('orders', o.id, { log: { detail: `${o.kendaraan?.plat} · ${rp(o.total)}` } });
      toast('Order dihapus');
      location.hash = '#/orders';
    }
  };
}

// ---------- Media ----------
async function uploadFiles(o, tahap, files) {
  toast(`Memproses ${files.length} file…`, 'info');
  let ok = 0;
  for (const f of files) {
    const isVid = f.type.startsWith('video');
    if (!isVid && !f.type.startsWith('image')) { toast(`${f.name}: format tidak didukung`, 'error'); continue; }
    if (isVid && f.size > 200 * 1024 * 1024) { toast(`${f.name} terlalu besar (maks 200 MB)`, 'error'); continue; }
    try {
      const blob = isVid ? f : await stampImage(f, `${o.no} · ${o.kendaraan?.plat || ''} · ${TAHAP[tahap].label.toUpperCase()}`);
      await idb.put('media', { id: uid(), orderId: o.id, tahap, tipe: isVid ? 'video' : 'image', blob, nama: f.name, mime: blob.type || f.type, size: blob.size, waktu: Date.now(), oleh: state.user.nama, userId: state.user.id });
      ok++;
    } catch (err) {
      console.error(err);
      toast(`Gagal menyimpan ${f.name}: ${err.message}`, 'error');
    }
  }
  if (!ok) return;
  o.mediaCount ||= { before: 0, proses: 0, after: 0 };
  o.mediaCount[tahap] = (o.mediaCount[tahap] || 0) + ok;
  o.timeline.push({ waktu: Date.now(), status: `Upload dokumentasi ${TAHAP[tahap].label}`, oleh: state.user.nama, catatan: `${ok} file` });
  await save('orders', o, { log: { aksi: 'Upload Media', detail: `${ok} file ${TAHAP[tahap].label}` } });
  toast(`${ok} file ${TAHAP[tahap].label} tersimpan`);
}

// Kompres foto + cap waktu (bukti dokumentasi)
async function stampImage(file, label) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file).catch(() => null); }
  if (!bmp) return file;
  const max = 1920;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const fs = Math.max(14, Math.round(c.width / 48));
  const text = `${getSettings().namaUsaha} · ${label} · ${fmtDateTime(Date.now())}`;
  ctx.font = `600 ${fs}px "Plus Jakarta Sans", sans-serif`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0, c.height - fs * 2, Math.min(c.width, w + fs * 1.4), fs * 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, fs * 0.7, c.height - fs * 0.65);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  return blob || file;
}

function openMedia(o, media, id) {
  const m = media.find((x) => x.id === id);
  if (!m) return;
  const canDel = can('admin', 'kasir') || m.userId === state.user.id;
  const md = modal({
    title: `${TAHAP[m.tahap].label} · ${o.no}`, size: 'lg',
    body: `<div class="lightbox-media">${m.tipe === 'video' ? `<video src="${m.url}" controls autoplay playsinline></video>` : `<img src="${m.url}" alt="">`}</div>
      <div class="flex between mt-1 flex-wrap"><span class="muted small">${esc(m.nama)} · ${fileSize(m.size || 0)} · ${fmtDateTime(m.waktu)} · oleh ${esc(m.oleh || '-')}</span></div>`,
    footer: `${canDel && o.status !== 'Selesai' || can('admin') ? '<button class="btn btn-ghost" data-del style="color:var(--danger);margin-right:auto"><i data-lucide="trash-2"></i> Hapus</button>' : ''}
      <button class="btn btn-ghost" data-dl><i data-lucide="download"></i> Unduh</button><button class="btn btn-primary" data-close>Tutup</button>`,
  });
  md.el.querySelector('[data-dl]').onclick = () => download(`${o.no}-${m.tahap}-${m.nama}`, m.blob);
  const del = md.el.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    if (!(await confirmDlg('Hapus file dokumentasi ini?'))) return;
    await idb.del('media', m.id);
    o.mediaCount[m.tahap] = Math.max(0, (o.mediaCount[m.tahap] || 1) - 1);
    o.timeline.push({ waktu: Date.now(), status: `Dokumentasi ${TAHAP[m.tahap].label} dihapus`, oleh: state.user.nama, catatan: m.nama });
    await save('orders', o, { log: { aksi: 'Hapus Media', detail: `${TAHAP[m.tahap].label} · ${m.nama}` } });
    md.close();
    toast('File dihapus');
    state.rerender();
  };
}

function compareDialog(media) {
  const befores = media.filter((m) => m.tahap === 'before' && m.tipe === 'image');
  const afters = media.filter((m) => m.tahap === 'after' && m.tipe === 'image');
  if (!befores.length || !afters.length) {
    // ada video: tampilkan berdampingan
    const b = media.find((m) => m.tahap === 'before');
    const a = media.find((m) => m.tahap === 'after');
    const el = (m) => (m.tipe === 'video' ? `<video src="${m.url}" controls playsinline style="width:100%;border-radius:10px"></video>` : `<img src="${m.url}" style="width:100%;border-radius:10px">`);
    modal({ title: 'Before / After', size: 'xl', body: `<div class="grid grid-2"><div><span class="badge b-amber mb-2">Before</span>${el(b)}</div><div><span class="badge b-green mb-2">After</span>${el(a)}</div></div>` });
    return;
  }
  let bi = 0, ai = 0;
  const md = modal({
    title: 'Bandingkan Before / After', size: 'xl',
    body: `<div class="ba-slider" id="ba">
        <img id="baA" src="${afters[0].url}" alt="After"><img id="baB" src="${befores[0].url}" alt="Before" style="clip-path:inset(0 50% 0 0)">
        <div class="ba-line" style="left:50%"></div><span class="ba-tag" style="left:12px">BEFORE</span><span class="ba-tag" style="right:12px">AFTER</span>
        <input type="range" min="0" max="100" value="50" aria-label="Geser pembanding">
      </div>
      <div class="grid grid-2 mt-1">
        <div><div class="muted small strong">Pilih foto Before</div><div class="thumb-row" data-side="b">${befores.map((m, i) => `<img src="${m.url}" data-i="${i}" class="${i === 0 ? 'sel' : ''}">`).join('')}</div></div>
        <div><div class="muted small strong">Pilih foto After</div><div class="thumb-row" data-side="a">${afters.map((m, i) => `<img src="${m.url}" data-i="${i}" class="${i === 0 ? 'sel' : ''}">`).join('')}</div></div>
      </div>`,
  });
  const el = md.el;
  el.querySelector('input[type=range]').addEventListener('input', (e) => {
    const v = e.target.value;
    el.querySelector('#baB').style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    el.querySelector('.ba-line').style.left = v + '%';
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('.thumb-row img');
    if (!t) return;
    const side = t.parentElement.dataset.side;
    t.parentElement.querySelectorAll('img').forEach((x) => x.classList.toggle('sel', x === t));
    if (side === 'b') { bi = +t.dataset.i; el.querySelector('#baB').src = befores[bi].url; } else { ai = +t.dataset.i; el.querySelector('#baA').src = afters[ai].url; }
  });
}

function waText(o, pel) {
  const s = getSettings();
  const lines = [
    `Halo ${pel.nama},`, '',
    `Berikut rincian order Anda di *${s.namaUsaha}*:`,
    `No: *${o.no}*`,
    `Kendaraan: ${o.kendaraan?.plat} – ${kendaraanLabel(o.kendaraan)}`,
    `Status: *${o.status}*`,
    o.jadwal && o.status === 'Dijadwalkan' ? `Jadwal: ${fmtDateTime(o.jadwal)}` : null,
    '', ...o.items.map((i) => `• ${i.nama} x${i.qty}`), '',
    `Total: *${rp(o.total)}*`,
    `Sudah dibayar: ${rp(paid(o))}`,
    sisa(o) ? `Sisa: *${rp(sisa(o))}*` : 'Status: *LUNAS*',
    s.rekening ? `\nPembayaran: ${s.rekening}` : null,
    '', 'Terima kasih 🙏',
  ];
  return lines.filter((l) => l !== null).join('\n');
}
