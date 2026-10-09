// Helper umum: format, DOM, modal, toast, file
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = (n) => (n < 0 ? '-Rp ' : 'Rp ') + Math.abs(Math.round(+n || 0)).toLocaleString('id-ID');
export const num = (n) => Math.round(+n || 0).toLocaleString('id-ID');
export const sum = (arr, f) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function todayStr(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
export function nowLocal(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}
export function parseD(d) {
  if (!d) return null;
  if (typeof d === 'number') return new Date(d);
  return new Date(d.length === 10 ? d + 'T00:00:00' : d);
}
export function addDays(dateStr, n) {
  const d = parseD(dateStr);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
export const fmtDate = (d) => (d ? parseD(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const fmtDateLong = (d) => (d ? parseD(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-');
export const fmtDateTime = (d) => (d ? parseD(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const fmtTime = (d) => (d ? parseD(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');
export const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${BULAN[+m - 1]} ${y}`; };
export const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const fileSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

export function icons() {
  try { window.lucide?.createIcons(); } catch (e) { /* ikon opsional */ }
}

export function toast(msg, type = 'success') {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const ic = { success: 'check-circle-2', error: 'alert-circle', info: 'info' }[type];
  t.innerHTML = `<i data-lucide="${ic}"></i><span>${esc(msg)}</span>`;
  box.appendChild(t);
  icons();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
}

export function modal({ title, body, size = 'md', footer = '', onMount, onClose }) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal modal-${size}" role="dialog" aria-modal="true">
    <div class="modal-header"><h3>${esc(title)}</h3><button type="button" class="btn-icon" data-close aria-label="Tutup"><i data-lucide="x"></i></button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  </div>`;
  let downTarget = null;
  const onKey = (e) => { if (e.key === 'Escape' && ov === [...document.querySelectorAll('.modal-overlay')].pop()) close(); };
  function close() {
    if (ov.dataset.closed) return;
    ov.dataset.closed = 1;
    ov.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => ov.remove(), 180);
    onClose?.();
  }
  ov.addEventListener('mousedown', (e) => { downTarget = e.target; });
  ov.addEventListener('click', (e) => {
    if ((e.target === ov && downTarget === ov) || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
  icons();
  const api = { el: ov.querySelector('.modal'), close };
  onMount?.(api);
  setTimeout(() => ov.querySelector('input:not([type=hidden]):not([readonly]),select,textarea')?.focus(), 60);
  return api;
}

export function confirmDlg(message, { title = 'Konfirmasi', okText = 'Ya, Lanjutkan', danger = true } = {}) {
  return new Promise((res) => {
    const m = modal({
      title, size: 'sm',
      body: `<p class="confirm-text">${esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
      onClose: () => res(false),
    });
    m.el.querySelector('[data-ok]').onclick = () => { res(true); m.close(); };
  });
}

// Modal berisi form; onSubmit(data, api) -> return false untuk menahan modal
export function formModal({ title, body, size = 'md', submitText = 'Simpan', onSubmit, onMount }) {
  const m = modal({
    title, size,
    body: `<form id="mf" novalidate>${body}<button type="submit" hidden></button></form>`,
    footer: `<button type="button" class="btn btn-ghost" data-close>Batal</button><button type="button" class="btn btn-primary" data-submit><i data-lucide="check"></i> ${esc(submitText)}</button>`,
    onMount,
  });
  const form = m.el.querySelector('#mf');
  const submit = async () => {
    for (const el of form.querySelectorAll('[required]')) {
      if (!String(el.value).trim()) { el.focus(); toast(`${el.closest('.field')?.querySelector('label')?.textContent.replace('*', '').trim() || 'Field'} wajib diisi`, 'error'); return; }
    }
    const btn = m.el.querySelector('[data-submit]');
    btn.disabled = true;
    try {
      const r = await onSubmit(formData(form), m);
      if (r !== false) m.close();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Terjadi kesalahan', 'error');
    } finally { btn.disabled = false; }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  m.el.querySelector('[data-submit]').onclick = submit;
  return m;
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); }
      else o[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else if (el.type === 'number') o[el.name] = el.value === '' ? 0 : +el.value;
    else o[el.name] = el.value.trim();
  }
  return o;
}

export function download(filename, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export function exportCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\n');
  download(filename, '﻿' + csv, 'text/csv;charset=utf-8');
}

export function waLink(phone, text) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const emptyState = (icon, title, text = '', action = '') =>
  `<div class="empty"><div class="empty-ic"><i data-lucide="${icon}"></i></div><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${action ? `<div class="mt-2">${action}</div>` : ''}</div>`;

export const options = (list, selected, placeholder) =>
  (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '') +
  list.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');

export function readFileAsDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
export async function dataURLtoBlob(url) { return (await fetch(url)).blob(); }
