import * as d2 from './d2.js';
import * as d3 from './d3.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KEY = 'gridpaper-doc-v1';
const mods = { '2d': d2, '3d': d3 };

const blank = () => ({ title: 'Untitled design', notes: '', mode: '2d', d2: d2.TEMPLATES[0].build(), d3: d3.TEMPLATES[0].build() });
// Saved and opened designs are untrusted input (files get shared), so every field is re-typed here.
function clean(d) {
  if (!d?.d2 || !d?.d3) throw new Error('not a Gridpaper design');
  return { title: String(d.title ?? 'Untitled design'), notes: String(d.notes ?? ''), mode: d.mode === '3d' ? '3d' : '2d', d2: d2.clean(d.d2), d3: d3.clean(d.d3) };
}
function load() {
  try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return blank(); }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(doc)); } catch {} }

let doc = load(), sel = null, past = [], future = [], last = JSON.stringify(doc);
const mod = () => mods[doc.mode];
const part = () => doc[doc.mode === '2d' ? 'd2' : 'd3'];

const api = {
  get sel() { return sel; },
  part,
  select(id) { sel = id; mod().render(); renderProps(); },
  commit,
  toolbar: () => { $('#toolbar').innerHTML = mod().toolbar(); },
};

// ---- history ----
function commit() {
  const s = JSON.stringify(doc);
  if (s !== last) { past.push(last); if (past.length > 200) past.shift(); future = []; last = s; persist(); }
  renderProps();
}
function restore(s) { doc = clean(JSON.parse(s)); last = s; persist(); refresh(); }
function undo() { if (past.length) { future.push(last); restore(past.pop()); } }
function redo() { if (future.length) { past.push(last); restore(future.pop()); } }

// ---- properties panel ----
const getP = (o, k) => k.split('.').reduce((a, p) => a?.[p], o);
const setP = (o, k, v) => { const ps = k.split('.'), l = ps.pop(); ps.reduce((a, p) => a[p], o)[l] = v; };

function renderProps() {
  const el = $('#props'), list = part().items, it = list.find(i => i.id === sel);
  if (sel && !it) sel = null;
  const fields = it ? mod().fields(it) : [
    { key: 'title', label: 'Design title', type: 'text' },
    { key: 'notes', label: 'Overall notes for Claude (goal, style, tech stack…)', type: 'textarea' },
    ...mod().docFields(),
  ];
  el.innerHTML = it ? `<h3>#${list.indexOf(it) + 1} ${esc(it.label)}</h3>`
    : `<h3>Design</h3><p class="hint" style="margin:0 0 10px">Nothing selected. Click an element to label it and add notes.</p>`;
  const grid = document.createElement('div');
  grid.className = 'fields';
  for (const f of fields) grid.append(fieldEl(f, f.obj || it || doc));
  el.append(grid);
  if (!it) return;
  const row = document.createElement('div');
  row.className = 'actions';
  row.innerHTML = '<button data-a="dup">Duplicate</button><button data-a="up">Bring forward</button><button data-a="down">Send back</button><button data-a="del" class="danger">Delete</button>';
  row.onclick = e => ({ dup: duplicate, del: remove, up: () => reorder(1), down: () => reorder(-1) })[e.target.dataset.a]?.();
  el.append(row);
}

function fieldEl(f, o) {
  const w = document.createElement(f.type === 'presets' ? 'div' : 'label');
  w.className = f.half ? 'half' : f.third ? 'third' : '';
  w.innerHTML = `<span>${f.label}</span>`;
  if (f.type === 'presets') {
    const row = document.createElement('div');
    row.className = 'chips';
    for (const [name, fn] of f.options) {
      const b = document.createElement('button');
      b.textContent = name;
      b.onclick = () => { fn(o); mod().render(); commit(); };
      row.append(b);
    }
    w.append(row);
    return w;
  }
  const get = f.get || (() => getP(o, f.key)), set = f.set || (v => setP(o, f.key, v));
  const num = f.type === 'number' || f.type === 'range';
  let inp;
  if (f.type === 'select') {
    inp = document.createElement('select');
    inp.innerHTML = f.options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  } else if (f.type === 'textarea') inp = document.createElement('textarea');
  else {
    inp = document.createElement('input');
    inp.type = f.type;
    if (f.min != null) inp.min = f.min;
    if (f.max != null) inp.max = f.max;
    inp.step = f.step ?? 1;
  }
  inp.value = get() ?? '';
  if (f.type === 'range') w.querySelector('span').textContent = `${f.label}: ${inp.value}`;
  inp.oninput = () => {
    set(num ? +inp.value : inp.value);
    if (f.type === 'range') w.querySelector('span').textContent = `${f.label}: ${inp.value}`;
    mod().render();
  };
  inp.onchange = () => commit();
  w.append(inp);
  return w;
}

// ---- item actions ----
function duplicate() {
  const list = part().items, it = list.find(i => i.id === sel);
  if (!it) return;
  const c = structuredClone(it);
  c.id = Math.random().toString(36).slice(2, 9);
  mod().offset(c);
  list.push(c);
  api.select(c.id);
  commit();
}
function remove() {
  const p = part();
  if (!sel) return;
  p.items = p.items.filter(i => i.id !== sel);
  api.select(null);
  commit();
}
function reorder(d) {
  const list = part().items, i = list.findIndex(x => x.id === sel), j = i + d;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  mod().render();
  commit();
}

// ---- export ----
function describe() {
  return `# ${doc.title}\n\n` + (doc.notes ? doc.notes.trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n' : '')
    + mod().describe()
    + '\n\n---\n_Made with Gridpaper. The numbered tags in the image match the numbers above._\n';
}
const blobOf = c => new Promise(r => c.toBlob(r, 'image/png'));
const slug = () => (doc.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3000);
}
const save = () => download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), slug() + '.gridpaper.json');

$('#copyImg').onclick = async () => {
  try {
    const b = await blobOf(await mod().snapshot());
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
    toast('Image copied. Paste it into Claude with Ctrl+V.');
  } catch (err) { console.error(err); toast('This browser blocked copying the image. Use "Download for Claude".'); }
};
$('#copyMd').onclick = async () => {
  try { await navigator.clipboard.writeText(describe()); toast('Description copied. Paste it next to the image.'); }
  catch { download(new Blob([describe()], { type: 'text/markdown' }), slug() + '.md'); toast('Clipboard blocked, so the description was downloaded.'); }
};
$('#export').onclick = async () => {
  download(await blobOf(await mod().snapshot()), slug() + '.png');
  download(new Blob([describe()], { type: 'text/markdown' }), slug() + '.md');
  toast(`Saved ${slug()}.png and ${slug()}.md. Give both to Claude.`);
};
$('#save').onclick = save;
$('#open').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    doc = clean(JSON.parse(await f.text())); sel = null; refresh(); mod().fit(); commit();
    toast('Opened ' + f.name);
  } catch { toast('That file is not a Gridpaper design.'); }
};
$('#undo').onclick = undo;
$('#redo').onclick = redo;
$('#help').onclick = () => $('#helpDlg').showModal();

// ---- mode, palette, templates ----
function refresh() {
  document.body.dataset.mode = doc.mode;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === doc.mode));
  $('#palette').innerHTML = mod().PALETTE.map(([g, keys]) => `<h4>${g}</h4><div class="pal">${keys.map(([k, t]) => `<button data-add="${k}">${t}</button>`).join('')}</div>`).join('')
    + `<p class="hint">${mod().HINT}</p>`;
  $('#template').innerHTML = '<option value="">Templates…</option>' + mod().TEMPLATES.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
  api.toolbar();
  mod().render();
  renderProps();
}

document.querySelectorAll('header [data-mode]').forEach(b => b.onclick = () => {
  doc.mode = b.dataset.mode; sel = null; refresh(); last = JSON.stringify(doc); persist();
});
$('#palette').onclick = e => {
  const k = e.target.closest('[data-add]')?.dataset.add;
  if (!k) return;
  const it = mod().add(k);
  part().items.push(it);
  api.select(it.id);
  commit();
};
$('#template').onchange = e => {
  const t = mod().TEMPLATES[e.target.value];
  e.target.value = '';
  if (!t || (part().items.length && !confirm(`Replace the current ${doc.mode.toUpperCase()} design with "${t.name}"? (Undo can bring it back.)`))) return;
  doc[doc.mode === '2d' ? 'd2' : 'd3'] = t.build();
  sel = null; refresh(); mod().fit(); commit();
};
$('#toolbar').onclick = e => {
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a) { mod().act(a); api.toolbar(); }
};

addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select, dialog')) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'z') e.shiftKey ? redo() : undo();
  else if (ctrl && k === 'y') redo();
  else if (ctrl && k === 's') save();
  else if ((ctrl || e.shiftKey) && k === 'd') duplicate();
  else if (k === 'delete' || k === 'backspace' || (k === 'x' && !ctrl && doc.mode === '3d')) remove();
  else if (k === 'escape') api.select(null);
  else if (ctrl || !mod().key(e)) return;
  e.preventDefault();
});

d2.init(api, $('#view2d'));
d3.init(api, $('#view3d'));
refresh();
