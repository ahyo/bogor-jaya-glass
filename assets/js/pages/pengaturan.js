import { cache, save, remove, idb, getSettings, logActivity, DATA_STORES, byId } from '../db.js';
import { esc, toast, formModal, confirmDlg, options, download, todayStr, readFileAsDataURL, dataURLtoBlob, fileSize, initials, fmtDateTime } from '../utils.js';
import { state } from '../state.js';
import { clearAll, seedDemo, seedBlank } from '../seed.js';

let tab = 'profil';

export function render(root) {
  const s = getSettings();
  root.innerHTML = `
  <div class="page-header"><div><h1>Pengaturan</h1><p>Profil usaha, pajak, pengguna, dan pencadangan data.</p></div></div>
  <div class="underline-tabs">${[['profil', 'building-2', 'Profil Usaha'], ['pajak', 'receipt', 'Pajak'], ['operasional', 'sliders-horizontal', 'Operasional'], ['users', 'users', 'Pengguna'], ['data', 'database', 'Data & Backup']]
    .map(([k, i, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}"><i data-lucide="${i}"></i> ${l}</button>`).join('')}</div>
  <div id="body"></div>`;
  const body = root.querySelector('#body');
  const T = {
    profil: () => `<form class="card" data-form="profil"><div class="card-body form-grid">
      <div class="field col-6"><label>Nama Usaha</label><input name="namaUsaha" value="${esc(s.namaUsaha)}" required></div>
      <div class="field col-6"><label>Tagline</label><input name="tagline" value="${esc(s.tagline || '')}"></div>
      <div class="field col-12"><label>Alamat</label><textarea name="alamat" rows="2">${esc(s.alamat || '')}</textarea></div>
      <div class="field col-4"><label>Telepon</label><input name="telp" value="${esc(s.telp || '')}"></div>
      <div class="field col-4"><label>WhatsApp</label><input name="wa" value="${esc(s.wa || '')}"></div>
      <div class="field col-4"><label>Email</label><input name="email" value="${esc(s.email || '')}"></div>
      <div class="field col-6"><label>Rekening Pembayaran (tampil di invoice)</label><input name="rekening" value="${esc(s.rekening || '')}"></div>
      <div class="field col-6"><label>Tanggal Mulai Pembukuan</label><input type="date" name="tglMulai" value="${s.tglMulai}"><div class="help">Tanggal saldo awal persediaan.</div></div>
      <div class="field col-12"><label>Catatan di Invoice</label><textarea name="catatanInvoice" rows="2">${esc(s.catatanInvoice || '')}</textarea></div>
    </div><div class="card-footer"><button class="btn btn-primary"><i data-lucide="save"></i> Simpan</button></div></form>`,
    pajak: () => `<form class="card" data-form="pajak"><div class="card-body form-grid">
      <div class="field col-6"><label>NPWP Usaha</label><input name="npwp" value="${esc(s.npwp || '')}"></div>
      <div class="field col-6"></div>
      <div class="field col-12"><label class="toggle"><input type="checkbox" name="pkp" ${s.pkp ? 'checked' : ''}><span class="sw"></span><span class="t-label"><b>Pengusaha Kena Pajak (PKP)</b><small>Jika aktif, PPN dipungut untuk barang/jasa yang ditandai "Kena Pajak" di master barang.</small></span></label></div>
      <div class="field col-6"><label>Tarif PPN (%)</label><input type="number" name="ppnRate" step="0.01" value="${s.ppnRate}"><div class="help">Tarif efektif umum 11% (12% × DPP nilai lain 11/12).</div></div>
      <div class="field col-6"><label>Metode Harga</label><select name="ppnInclusive">${options([['false', 'Harga belum termasuk PPN (PPN ditambahkan)'], ['true', 'Harga sudah termasuk PPN']], String(!!s.ppnInclusive))}</select></div>
      <div class="field col-12"><label class="toggle"><input type="checkbox" name="pphFinal" ${s.pphFinal ? 'checked' : ''}><span class="sw"></span><span class="t-label"><b>PPh Final UMKM</b><small>Hitung PPh Final dari omzet bruto bulanan (PP 55/2022).</small></span></label></div>
      <div class="field col-6"><label>Tarif PPh Final (%)</label><input type="number" name="pphFinalRate" step="0.01" value="${s.pphFinalRate}"></div>
      <div class="col-12"><div class="alert alert-warning" style="margin:0"><i data-lucide="alert-triangle"></i><div>Perubahan tarif hanya berlaku untuk transaksi baru / yang disimpan ulang. Konsultasikan ketentuan pajak terbaru dengan konsultan pajak Anda.</div></div></div>
    </div><div class="card-footer"><button class="btn btn-primary"><i data-lucide="save"></i> Simpan</button></div></form>`,
    operasional: () => `<form class="card" data-form="operasional"><div class="card-body form-grid">
      <div class="field col-12"><label class="toggle"><input type="checkbox" name="wajibFoto" ${s.wajibFoto ? 'checked' : ''}><span class="sw"></span><span class="t-label"><b>Wajib dokumentasi before & after</b><small>Teknisi tidak dapat menyelesaikan pekerjaan sebelum mengunggah foto/video before dan after.</small></span></label></div>
      <div class="field col-6"><label>Garansi Default (hari)</label><input type="number" name="garansiHari" value="${s.garansiHari}"></div>
    </div><div class="card-footer"><button class="btn btn-primary"><i data-lucide="save"></i> Simpan</button></div></form>`,
    users: () => `<div class="card"><div class="card-header"><h3><i data-lucide="users"></i> Pengguna Sistem</h3><button class="btn btn-primary btn-sm" data-act="addUser"><i data-lucide="plus"></i> Tambah Pengguna</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Pegawai</th><th>Status</th><th></th></tr></thead><tbody>
      ${cache.users.map((u) => `<tr><td><div class="flex"><span class="avatar">${esc(initials(u.nama))}</span><b>${esc(u.nama)}</b></div></td><td class="mono">${esc(u.username)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'b-purple' : u.role === 'kasir' ? 'b-blue' : 'b-amber'}">${esc(u.role)}</span></td><td>${esc(byId('pegawai', u.pegawaiId)?.nama || '-')}</td>
        <td>${u.aktif === false ? '<span class="badge b-red">Nonaktif</span>' : '<span class="badge b-green">Aktif</span>'}</td>
        <td class="actions"><button class="btn-icon sm" data-edituser="${u.id}"><i data-lucide="pencil"></i></button>${u.id !== state.user.id ? `<button class="btn-icon sm danger" data-deluser="${u.id}"><i data-lucide="trash-2"></i></button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card-body"><div class="alert alert-info" style="margin:0"><i data-lucide="shield"></i><div><b>Hak akses:</b> <b>Admin</b> – semua fitur termasuk akuntansi & pajak · <b>Kasir</b> – order, pembelian, stok, master, kas · <b>Teknisi</b> – tugas pemasangan & upload dokumentasi.</div></div></div></div>`,
    data: () => `<div class="grid grid-2">
      <div class="card"><div class="card-header"><h3><i data-lucide="hard-drive-download"></i> Backup Data</h3></div><div class="card-body">
        <div class="alert alert-warning"><i data-lucide="alert-triangle"></i><div>Data aplikasi tersimpan <b>di browser perangkat ini</b>. Lakukan backup rutin dan simpan file di tempat aman (Google Drive, flashdisk).</div></div>
        <div id="usage" class="muted small mb-2"></div>
        <div class="flex flex-wrap"><button class="btn btn-primary" data-act="backup"><i data-lucide="download"></i> Backup Data</button><button class="btn btn-ghost" data-act="backupFull"><i data-lucide="images"></i> Backup + Foto/Video</button></div>
        <p class="muted small mt-1">Terakhir backup: ${s.lastBackup ? fmtDateTime(s.lastBackup) : 'belum pernah'}</p>
      </div></div>
      <div class="card"><div class="card-header"><h3><i data-lucide="hard-drive-upload"></i> Pulihkan Data</h3></div><div class="card-body">
        <p class="muted mb-2">Pulihkan dari file backup (.json). Seluruh data saat ini akan diganti.</p>
        <label class="btn btn-ghost"><i data-lucide="upload"></i> Pilih File Backup<input type="file" accept=".json,application/json" data-act="restore" hidden></label>
      </div></div>
      <div class="card"><div class="card-header"><h3><i data-lucide="rotate-ccw"></i> Reset Data</h3></div><div class="card-body">
        <p class="muted mb-2">Mulai dengan data kosong (hanya akun admin) untuk penggunaan nyata, atau muat ulang data demo.</p>
        <div class="flex flex-wrap"><button class="btn btn-danger" data-act="blank"><i data-lucide="trash-2"></i> Kosongkan Semua Data</button><button class="btn btn-ghost" data-act="demo"><i data-lucide="sparkles"></i> Muat Data Demo</button></div>
      </div></div>
    </div>`,
  };
  body.innerHTML = T[tab]();
  window.lucide?.createIcons();
  if (tab === 'data') showUsage(root);

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; return state.rerender(); }
    const eu = e.target.closest('[data-edituser]');
    if (eu) return userForm(byId('users', eu.dataset.edituser));
    const du = e.target.closest('[data-deluser]');
    if (du && (await confirmDlg('Hapus pengguna ini?'))) { await remove('users', du.dataset.deluser); return state.rerender(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'addUser') userForm();
    if (act === 'backup' || act === 'backupFull') backup(act === 'backupFull');
    if (act === 'blank' && (await confirmDlg('Hapus SEMUA data (transaksi, master, foto/video)? Pastikan sudah backup. Akun admin direset ke username "admin" PIN "1234".', { okText: 'Kosongkan' }))) {
      await clearAll(); await seedBlank(); resetSession();
    }
    if (act === 'demo' && (await confirmDlg('Ganti semua data dengan data demo?', { okText: 'Muat Demo' }))) {
      await clearAll(); await seedDemo(); resetSession();
    }
  });
  root.addEventListener('change', async (e) => {
    if (e.target.dataset.act !== 'restore' || !e.target.files[0]) return;
    restore(e.target.files[0]);
  });
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const d = {};
    for (const el of f.elements) {
      if (!el.name) continue;
      d[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value === 'true' ? true : el.value === 'false' ? false : el.value.trim();
    }
    Object.assign(s, d);
    await save('settings', s);
    await logActivity({ aksi: 'Ubah', modul: 'settings', refNo: f.dataset.form, detail: Object.keys(d).join(', ') });
    toast('Pengaturan disimpan');
    if (f.dataset.form === 'profil') location.reload();
  });
}

function resetSession() {
  try { localStorage.removeItem('bjg-session'); } catch (e) { /* abaikan */ }
  location.hash = '';
  location.reload();
}

async function showUsage(root) {
  try {
    const est = await navigator.storage?.estimate?.();
    const keys = (await idb.all('media')).length;
    root.querySelector('#usage').innerHTML = `${keys} file foto/video tersimpan${est ? ` · Penyimpanan terpakai ${fileSize(est.usage)} dari kuota ${fileSize(est.quota)}` : ''}`;
    if (navigator.storage?.persist) navigator.storage.persist();
  } catch (e) { /* abaikan */ }
}

function userForm(u) {
  formModal({
    title: u ? 'Ubah Pengguna' : 'Tambah Pengguna',
    body: `<div class="form-grid">
      <div class="field col-12"><label>Nama *</label><input name="nama" value="${esc(u?.nama || '')}" required></div>
      <div class="field col-6"><label>Username *</label><input name="username" value="${esc(u?.username || '')}" required autocapitalize="none"></div>
      <div class="field col-6"><label>PIN / Password *</label><input name="pin" type="password" value="${esc(u?.pin || '')}" required></div>
      <div class="field col-6"><label>Peran</label><select name="role">${options([['admin', 'Admin / Pemilik'], ['kasir', 'Kasir'], ['teknisi', 'Teknisi']], u?.role || 'teknisi')}</select></div>
      <div class="field col-6"><label>Terhubung ke Pegawai</label><select name="pegawaiId">${options(cache.pegawai.map((p) => [p.id, `${p.nama} (${p.jabatan})`]), u?.pegawaiId, '— Tidak ada —')}</select><div class="help">Wajib untuk teknisi agar tugas muncul.</div></div>
      <div class="field col-12"><label class="toggle"><input type="checkbox" name="aktif" ${u?.aktif === false ? '' : 'checked'}><span class="sw"></span><span class="t-label"><b>Aktif</b></span></label></div>
    </div>`,
    onSubmit: async (d) => {
      if (cache.users.some((x) => x.username.toLowerCase() === d.username.toLowerCase() && x.id !== u?.id)) { toast('Username sudah dipakai', 'error'); return false; }
      if (d.role === 'teknisi' && !d.pegawaiId) { toast('Teknisi harus dihubungkan ke data pegawai', 'error'); return false; }
      if (u?.id === state.user.id && (d.role !== 'admin' || !d.aktif)) { toast('Tidak dapat menurunkan peran / menonaktifkan akun sendiri', 'error'); return false; }
      await save('users', u ? Object.assign(u, d) : d, { log: { detail: `${d.username} (${d.role})` } });
      toast('Pengguna disimpan');
      state.rerender();
    },
  });
}

export function changePin() {
  const u = state.user;
  formModal({
    title: 'Ganti PIN / Password',
    body: `<div class="form-grid"><div class="field col-12"><label>PIN Lama *</label><input type="password" name="old" required></div>
      <div class="field col-6"><label>PIN Baru *</label><input type="password" name="pin" required></div><div class="field col-6"><label>Ulangi PIN Baru *</label><input type="password" name="pin2" required></div></div>`,
    onSubmit: async (d) => {
      if (d.old !== u.pin) { toast('PIN lama salah', 'error'); return false; }
      if (d.pin.length < 4) { toast('PIN minimal 4 karakter', 'error'); return false; }
      if (d.pin !== d.pin2) { toast('Konfirmasi PIN tidak sama', 'error'); return false; }
      u.pin = d.pin;
      await save('users', u, { log: { aksi: 'Ganti PIN' } });
      toast('PIN berhasil diganti');
    },
  });
}

async function backup(full) {
  toast('Menyiapkan backup…', 'info');
  const data = {};
  for (const s of DATA_STORES) data[s] = await idb.all(s);
  const out = { app: 'bogor-jaya-glass', version: 1, exportedAt: new Date().toISOString(), data, media: [] };
  if (full) {
    for (const m of await idb.all('media')) {
      const { blob, ...meta } = m;
      out.media.push({ ...meta, dataUrl: await readFileAsDataURL(blob) });
    }
  }
  download(`backup-bogor-jaya-glass-${todayStr()}${full ? '-lengkap' : ''}.json`, JSON.stringify(out), 'application/json');
  const s = getSettings();
  s.lastBackup = Date.now();
  await save('settings', s);
  await logActivity({ aksi: 'Backup', modul: 'settings', detail: full ? 'Backup lengkap + media' : 'Backup data' });
  toast('Backup berhasil diunduh');
}

async function restore(file) {
  let json;
  try { json = JSON.parse(await file.text()); } catch (e) { return toast('File backup tidak valid', 'error'); }
  if (json.app !== 'bogor-jaya-glass' || !json.data?.settings?.length) return toast('File bukan backup Bogor Jaya Glass', 'error');
  if (!(await confirmDlg(`Pulihkan backup tanggal ${fmtDateTime(json.exportedAt)}? Semua data saat ini akan diganti.`, { okText: 'Pulihkan' }))) return;
  toast('Memulihkan data…', 'info');
  await clearAll();
  for (const s of DATA_STORES) for (const rec of json.data[s] || []) await idb.put(s, rec);
  for (const m of json.media || []) {
    const { dataUrl, ...meta } = m;
    await idb.put('media', { ...meta, blob: await dataURLtoBlob(dataUrl) });
  }
  toast('Data berhasil dipulihkan');
  setTimeout(resetSession, 800);
}
