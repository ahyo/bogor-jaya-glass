// Penyimpanan data: IndexedDB + cache in-memory (write-through)
import { uid } from './utils.js';
import { state } from './state.js';

const DB_NAME = 'bogor-jaya-glass';
const VERSION = 1;
export const STORES = ['settings', 'users', 'barang', 'pelanggan', 'supplier', 'pegawai', 'pembelian', 'orders', 'kas', 'jurnal', 'opname', 'log', 'media'];
export const DATA_STORES = STORES.filter((s) => s !== 'media');
export const cache = {};

let dbPromise;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          const os = db.createObjectStore(s, { keyPath: 'id' });
          if (s === 'media') os.createIndex('orderId', 'orderId');
        }
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return openDB().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    let out;
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaksi dibatalkan (kemungkinan penyimpanan penuh)'));
  }));
}

export const idb = {
  all: (s) => run(s, 'readonly', (st) => st.getAll()),
  get: (s, id) => run(s, 'readonly', (st) => st.get(id)),
  put: (s, v) => run(s, 'readwrite', (st) => st.put(v)).then(() => v),
  del: (s, id) => run(s, 'readwrite', (st) => st.delete(id)),
  clear: (s) => run(s, 'readwrite', (st) => st.clear()),
  byIndex: (s, idx, val) => run(s, 'readonly', (st) => st.index(idx).getAll(val)),
  keysByIndex: (s, idx, val) => run(s, 'readonly', (st) => st.index(idx).getAllKeys(val)),
};

export async function loadAll() {
  for (const s of DATA_STORES) cache[s] = await idb.all(s);
}

// Simpan ke IndexedDB + cache. opts.log = { aksi, modul, ref, detail } untuk riwayat aktivitas
export async function save(store, obj, opts = {}) {
  const isNew = !obj.id || !cache[store].some((x) => x.id === obj.id);
  if (!obj.id) obj.id = uid();
  if (isNew && !obj.createdAt) obj.createdAt = Date.now();
  obj.updatedAt = Date.now();
  await idb.put(store, obj);
  const arr = cache[store];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  if (opts.log !== false && store !== 'log' && store !== 'settings') {
    await logActivity({ aksi: isNew ? 'Tambah' : 'Ubah', modul: store, refId: obj.id, refNo: obj.no || obj.kode || obj.nama || obj.username || '', ...(opts.log || {}) });
  }
  return obj;
}

export async function remove(store, id, opts = {}) {
  const obj = byId(store, id);
  await idb.del(store, id);
  cache[store] = cache[store].filter((x) => x.id !== id);
  if (opts.log !== false && store !== 'log') {
    await logActivity({ aksi: 'Hapus', modul: store, refId: id, refNo: obj?.no || obj?.kode || obj?.nama || '', ...(opts.log || {}) });
  }
}

export async function logActivity({ aksi, modul, refId = '', refNo = '', detail = '' }) {
  const entry = { id: uid(), waktu: Date.now(), userId: state.user?.id || '', user: state.user?.nama || 'Sistem', aksi, modul, refId, refNo, detail };
  await idb.put('log', entry);
  cache.log.push(entry);
  // Batasi log agar tidak membengkak
  if (cache.log.length > 5000) {
    const old = cache.log.sort((a, b) => a.waktu - b.waktu).splice(0, cache.log.length - 5000);
    for (const o of old) await idb.del('log', o.id);
  }
}

export const byId = (store, id) => cache[store]?.find((x) => x.id === id);
export const getSettings = () => cache.settings[0];

export function nextNo(store, prefix, tanggal) {
  const d = tanggal ? new Date(tanggal) : new Date();
  const ym = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0');
  const base = `${prefix}-${ym}-`;
  let max = 0;
  for (const x of cache[store]) if (x.no?.startsWith(base)) max = Math.max(max, +x.no.slice(base.length) || 0);
  return base + String(max + 1).padStart(4, '0');
}
