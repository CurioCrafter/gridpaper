// 2D layout mode: an SVG artboard on grid paper, wireframe elements, notes and arrows.
const GRID = 10;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 9);

// kind: [name, default width, default height, look, corner radius]
// width 1440 = full artboard width, height 900 = full artboard height.
const KINDS = {
  header: ['Header', 1440, 80, 'box', 0],
  hero: ['Hero', 1440, 520, 'box', 0],
  section: ['Section', 1440, 400, 'box', 0],
  sidebar: ['Sidebar', 260, 900, 'box', 0],
  card: ['Card', 320, 360, 'box', 12],
  modal: ['Modal', 560, 400, 'box', 16],
  footer: ['Footer', 1440, 200, 'box', 0],
  divider: ['Divider', 600, 10, 'divider', 0],
  heading: ['Heading', 600, 60, 'heading', 0],
  text: ['Paragraph', 500, 120, 'text', 0],
  image: ['Image', 400, 300, 'image', 0],
  video: ['Video', 640, 360, 'video', 0],
  carousel: ['Carousel', 900, 400, 'carousel', 0],
  icon: ['Icon / avatar', 48, 48, 'circle', 0],
  badge: ['Badge / tag', 90, 28, 'badge', 14],
  list: ['List', 400, 240, 'list', 0],
  table: ['Table', 800, 320, 'table', 0],
  chart: ['Chart', 600, 320, 'chart', 0],
  map: ['Map', 400, 300, 'map', 0],
  code: ['Code block', 500, 200, 'code', 8],
  progress: ['Progress bar', 300, 12, 'progress', 6],
  button: ['Button', 160, 48, 'button', 8],
  link: ['Link', 120, 24, 'link', 0],
  input: ['Text input', 320, 48, 'input', 6],
  textarea: ['Text area', 400, 120, 'textarea', 6],
  dropdown: ['Dropdown', 240, 48, 'dropdown', 6],
  checkbox: ['Checkbox', 200, 24, 'check', 0],
  radio: ['Radio button', 200, 24, 'radio', 0],
  toggle: ['Toggle switch', 52, 28, 'toggle', 14],
  slider: ['Slider', 300, 24, 'slider', 0],
  nav: ['Nav menu', 480, 40, 'nav', 0],
  tabs: ['Tabs', 480, 48, 'tabs', 0],
  note: ['Note', 260, 90, 'note', 0],
  arrow: ['Arrow', 200, 0, 'arrow', 0],
};
const ITEMS_LOOKS = new Set(['list', 'nav', 'tabs']), VALUE_LOOKS = new Set(['slider', 'progress']);
const BOARDS = [['Desktop', 1440, 900], ['Laptop', 1280, 800], ['Tablet', 768, 1024], ['Mobile', 390, 844], ['Long page', 1440, 1600]];

export const PALETTE = [
  ['Layout', ['header', 'hero', 'section', 'sidebar', 'card', 'modal', 'footer', 'divider']],
  ['Content', ['heading', 'text', 'image', 'video', 'carousel', 'icon', 'badge', 'list', 'table', 'chart', 'map', 'code', 'progress']],
  ['Controls', ['button', 'link', 'input', 'textarea', 'dropdown', 'checkbox', 'radio', 'toggle', 'slider', 'nav', 'tabs']],
  ['Notes for Claude', ['note', 'arrow']],
].map(([g, ks]) => [g, ks.map(k => [k, KINDS[k][0]])]);
export const HINT = 'Drag to move · corners resize · drag empty space to box-select · scroll or right-drag to pan · Ctrl+scroll zooms · arrows nudge · Alt = no snap · F = fit';
export const TARGETS = ['HTML + CSS', 'React + Tailwind', 'Next.js + Tailwind', 'Vue', 'Svelte', 'Flutter', 'SwiftUI', 'Jetpack Compose', 'Godot UI (Control nodes)', 'Unity UI', 'Figma-style design spec'];

// Opened files are untrusted: force every field to its expected type before it reaches the SVG markup.
const num = v => Number.isFinite(+v) ? +v : 0;
export function clean(p) {
  const b = p?.board || {};
  return {
    board: { name: String(b.name ?? 'Custom'), w: num(b.w) || 1440, h: num(b.h) || 900 },
    items: (Array.isArray(p?.items) ? p.items : []).map(it => ({
      id: /^[a-z0-9]{1,16}$/.test(it?.id) ? it.id : uid(), kind: KINDS[it?.kind] ? it.kind : 'section',
      x: num(it.x), y: num(it.y), w: num(it.w), h: num(it.h), r: num(it.r),
      label: String(it.label ?? ''), text: String(it.text ?? ''), note: String(it.note ?? ''), locked: it.locked === true,
    })),
  };
}

const make = (kind, x, y, w, h, label, text = '', extra = {}) =>
  ({ id: uid(), kind, x, y, w, h, r: KINDS[kind][4], label: label || KINDS[kind][0], text, note: '', ...extra });

const CSS = `
.el{fill:#fff;fill-opacity:.88;stroke:#111;stroke-width:2}
.ghost{fill:#fff;fill-opacity:.01;stroke:#111;stroke-width:1;stroke-dasharray:4 4;stroke-opacity:.45}
.thin{fill:none;stroke:#111;stroke-width:1.2;stroke-opacity:.55}
.fk{fill:#111}
.scrib{stroke:#a3abb9;stroke-width:5;stroke-linecap:round}
.hit{fill:#fff;fill-opacity:.01}
.hitl{stroke:#fff;stroke-opacity:.01;stroke-width:16}
.t{font-family:ui-sans-serif,system-ui,'Segoe UI',Arial,sans-serif;font-size:14px;fill:#111}
.th{font-weight:700}.tb{font-weight:600}.tm{fill:#8a93a3}.tl{fill:#2563eb;text-decoration:underline}.tw{fill:#fff}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:13px;fill:#e6e9ef}
.note{fill:#fff1f3;stroke:#e11d48;stroke-width:1.5;stroke-dasharray:6 4}
.nt{font-family:ui-sans-serif,system-ui,'Segoe UI',Arial,sans-serif;fill:#e11d48}
.arrow{stroke:#e11d48;stroke-width:2.5}
.board{fill:none;stroke:#111;stroke-width:3}
.bn{font:13px ui-monospace,Consolas,monospace;fill:#667085}
.bdg rect{fill:#111}.bdg text{fill:#fff;font:600 11px ui-monospace,Consolas,monospace}
.sel{fill:none;stroke:#2563eb;stroke-width:2;stroke-dasharray:6 3;vector-effect:non-scaling-stroke}
.hd{fill:#fff;stroke:#2563eb;stroke-width:2;vector-effect:non-scaling-stroke}
.guide{stroke:#ec4899;stroke-width:1;vector-effect:non-scaling-stroke}
.mq{fill:#2563eb;fill-opacity:.06;stroke:#2563eb;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}
.lk{pointer-events:none}
[data-id]{cursor:move}`;
const DEFS = `<defs>
<pattern id="g1" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#edf0f5" stroke-width="1"/></pattern>
<pattern id="g2" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#g1)"/><path d="M100 0H0V100" fill="none" stroke="#d3d9e3" stroke-width="1.2"/></pattern>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e11d48"/></marker>
</defs>`;

let api, svg, layer, vb = { x: 0, y: 0, w: 1600, h: 1000 }, showLabels = true, snapOn = true, fitted = false;
let drag = null, space = false, noSel = false, guides = [];
const cur = () => api.part().items.find(i => i.id === api.sel);
const scale = () => Math.max(vb.w / svg.clientWidth, vb.h / svg.clientHeight) || 1;
const pt = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
const applyVB = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
// arrows can have negative width/height, so always go through this for bounds
const box = it => ({ x: Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) });
function union(list) {
  const bs = list.map(box), x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
}
function zoom(f, p = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }) {
  const w = vb.w * f;
  if (w < 80 || w > 30000) return;
  vb = { x: p.x - (p.x - vb.x) * f, y: p.y - (p.y - vb.y) * f, w, h: vb.h * f };
  applyVB();
  render();
}

// Move the dragged box onto the nearest edge or centre of another element (or the artboard).
function smartSnap(b, dx, dy, ids, sn, e) {
  dx = sn(b.x + dx) - b.x; dy = sn(b.y + dy) - b.y;
  guides = [];
  if (!snapOn || e.altKey) return [dx, dy];
  const { board, items } = api.part(), tol = 6 * scale();
  const others = items.filter(i => !ids.has(i.id) && i.kind !== 'arrow').map(box).concat([{ x: 0, y: 0, w: board.w, h: board.h }]);
  const best = (mine, theirs) => {
    let r = null;
    for (const m of mine) for (const t of theirs) { const d = t - m; if (Math.abs(d) < tol && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, t }; }
    return r;
  };
  const bx = best([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], others.flatMap(o => [o.x, o.x + o.w / 2, o.x + o.w]));
  const by = best([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], others.flatMap(o => [o.y, o.y + o.h / 2, o.y + o.h]));
  if (bx) { dx += bx.d; guides.push({ x: bx.t }); }
  if (by) { dy += by.d; guides.push({ y: by.t }); }
  return [dx, dy];
}

export function init(a, el) {
  api = a; svg = el;
  svg.innerHTML = `<style>${CSS}</style>${DEFS}<rect x="-20000" y="-20000" width="40000" height="40000" fill="url(#g2)"/><g id="layer"></g>`;
  layer = svg.querySelector('#layer');
  new ResizeObserver(() => { if (!fitted) fit(); }).observe(svg);
  addEventListener('keydown', e => { if (e.code === 'Space' && !e.target.closest?.('input,textarea,button,select')) space = true; });
  addEventListener('keyup', e => { if (e.code === 'Space') space = false; });
  svg.addEventListener('contextmenu', e => e.preventDefault());

  svg.addEventListener('pointerdown', e => {
    const hd = e.target.closest('[data-h]'), g = e.target.closest('[data-id]'), p = pt(e);
    if (e.button !== 0 || space) {
      drag = { pan: true, sx: e.clientX, sy: e.clientY, vb: { ...vb } };
      e.preventDefault();
    } else if (hd) {
      const it = cur();
      drag = { h: hd.dataset.h, it, p0: p, o: { ...it } };
    } else if (g) {
      const id = g.dataset.id;
      let clickId = null;
      if (e.shiftKey) { api.select(id, true); if (!api.isSel(id)) return; }
      else if (!api.isSel(id)) api.select(id);
      else clickId = id;   // already part of a multi-selection: drag them all, or a plain click picks just this one
      const list = api.part().items.filter(i => api.isSel(i.id) && !i.locked);
      drag = { move: true, list: list.map(i => ({ i, x: i.x, y: i.y })), b: union(list), ids: new Set(list.map(i => i.id)), p0: p, clickId };
    } else drag = { mq: true, p0: p, add: e.shiftKey };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.pan) {
      const k = scale();
      vb.x = drag.vb.x - (e.clientX - drag.sx) * k;
      vb.y = drag.vb.y - (e.clientY - drag.sy) * k;
      return applyVB();
    }
    const p = pt(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    const sn = v => snapOn && !e.altKey ? Math.round(v / GRID) * GRID : Math.round(v);
    if (drag.mq) { drag.p1 = p; return render(); }
    if (drag.move) {
      if (!drag.moved && Math.hypot(dx, dy) < 2 * scale()) return;
      const [mx, my] = smartSnap(drag.b, dx, dy, drag.ids, sn, e);
      for (const o of drag.list) { o.i.x = o.x + mx; o.i.y = o.y + my; }
    } else {
      const { it, o, h } = drag;
      if (h === 'a') { it.x = sn(o.x + dx); it.y = sn(o.y + dy); it.w = o.x + o.w - it.x; it.h = o.y + o.h - it.y; }
      else if (h === 'b') { it.w = sn(o.x + o.w + dx) - o.x; it.h = sn(o.y + o.h + dy) - o.y; }
      else {
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (h.includes('w')) x1 = sn(x1 + dx);
        if (h.includes('e')) x2 = sn(x2 + dx);
        if (h.includes('n')) y1 = sn(y1 + dy);
        if (h.includes('s')) y2 = sn(y2 + dy);
        it.x = Math.min(x1, x2); it.y = Math.min(y1, y2);
        it.w = Math.max(GRID, Math.abs(x2 - x1)); it.h = Math.max(GRID, Math.abs(y2 - y1));
      }
    }
    drag.moved = true;
    render();
  });

  svg.addEventListener('pointerup', () => {
    const d = drag;
    drag = null; guides = [];
    if (!d || d.pan) return;
    if (d.mq) {
      const r = d.p1 && { x: Math.min(d.p0.x, d.p1.x), y: Math.min(d.p0.y, d.p1.y), w: Math.abs(d.p1.x - d.p0.x), h: Math.abs(d.p1.y - d.p0.y) };
      if (!r || r.w + r.h < 6 * scale()) return d.add ? render() : api.select(null);
      const hit = api.part().items.filter(i => { const b = box(i); return !i.locked && b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y; });
      return api.selectMany(hit.map(i => i.id), d.add);
    }
    if (d.moved) { render(); api.commit(); }
    else if (d.clickId) api.select(d.clickId);
  });

  // Figma-style: scroll pans, Ctrl/⌘ + scroll (or a trackpad pinch) zooms
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) return zoom(Math.exp(e.deltaY * (Math.abs(e.deltaY) < 40 ? 0.01 : 0.0015)), pt(e));
    const k = scale();
    vb.x += (e.shiftKey ? e.deltaY : e.deltaX) * k;
    vb.y += (e.shiftKey ? 0 : e.deltaY) * k;
    applyVB();
  }, { passive: false });
}

export function fit() {
  if (!svg?.clientWidth) return;
  fitted = true;
  const { board } = api.part(), m = 60, W = board.w + m * 2, H = board.h + m * 2, a = svg.clientWidth / svg.clientHeight;
  if (board.h > board.w * 1.5) vb = { x: -m, y: -m, w: W, h: W / a };            // tall page: fit width, start at top
  else if (W / H > a) vb = { x: -m, y: -m - (W / a - H) / 2, w: W, h: W / a };
  else vb = { x: -m - (H * a - W) / 2, y: -m, w: H * a, h: H };
  applyVB();
  render();
}

// ---- drawing ----
function wrap(s, w, size) {
  const n = Math.max(3, Math.floor(w / (size * 0.56))), out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (t.length > n && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function block(s, x, y, w, h, cls, max, center = false) {
  let fs = max, L;
  for (; fs > 10; fs -= 1) { L = wrap(s, w, fs); if (L.length * fs * 1.2 <= h) break; }
  L = wrap(s, w, fs).slice(0, Math.max(1, Math.floor(h / (fs * 1.2))));
  const y0 = y + (h - L.length * fs * 1.2) / 2 + fs * 0.9, tx = center ? x + w / 2 : x;
  return `<text class="${cls}" style="font-size:${fs}px"${center ? ' text-anchor="middle"' : ''}>${L.map((l, i) => `<tspan x="${tx}" y="${y0 + i * fs * 1.2}">${esc(l)}</tspan>`).join('')}</text>`;
}
const listItems = (t, fallback) => { const a = String(t || '').split(',').map(s => s.trim()).filter(Boolean); return a.length ? a : fallback; };
const pct = t => Math.min(100, Math.max(0, parseFloat(t) || 60)) / 100;

function itemSVG(it, n) {
  const { x, y, w, h } = it, look = KINDS[it.kind]?.[3] || 'box', t = it.text || '';
  const r = Math.max(0, Math.min(it.r || 0, w / 2, h / 2)), cx = x + w / 2, cy = y + h / 2;
  const rect = c => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const cross = (x0, y0, x1, y1) => `<path class="thin" d="M${x0} ${y0}L${x1} ${y1}M${x1} ${y0}L${x0} ${y1}"/>`;
  let b = '';
  switch (look) {
    case 'box': b = rect('el'); break;
    case 'image': b = rect('el') + cross(x, y, x + w, y + h); break;
    case 'video': { const s = Math.min(w, h) * 0.14; b = rect('el') + `<path class="fk" d="M${cx - s * 0.8} ${cy - s}L${cx + s} ${cy}L${cx - s * 0.8} ${cy + s}z"/>`; break; }
    case 'carousel': {
      const s = Math.min(18, h * 0.08);
      b = rect('el') + cross(x + 60, y + 16, x + w - 60, y + h - 40)
        + [x + 28, x + w - 28].map((ax, i) => `<circle class="el" cx="${ax}" cy="${cy}" r="${s}"/><path class="thin" style="stroke-width:2;stroke-opacity:1" d="M${ax + (i ? -4 : 4)} ${cy - 7}l${i ? 8 : -8} 7l${i ? -8 : 8} 7"/>`).join('')
        + [0, 1, 2, 3].map(i => `<circle class="${i ? 'thin' : 'fk'}" cx="${cx + (i - 1.5) * 18}" cy="${y + h - 20}" r="4.5"/>`).join('');
      break;
    }
    case 'circle': b = `<ellipse class="el" cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}"/>`; break;
    case 'badge': b = `<rect class="fk" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>` + block(t || it.label, x + 6, y, w - 12, h, 't tw tb', Math.min(14, h * 0.5), true); break;
    case 'divider': b = rect('hit') + `<line stroke="#111" stroke-width="2" x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}"/>`; break;
    case 'heading': b = rect('ghost') + block(t || it.label, x + 8, y + 2, w - 16, h - 4, 't th', Math.min(64, h * 0.7)); break;
    case 'text':
      b = rect('ghost');
      if (t) b += block(t, x + 8, y + 4, w - 16, h - 8, 't', 16);
      else for (let ly = y + 16, i = 0; ly < y + h - 6; ly += 20, i++) b += `<line class="scrib" x1="${x + 10}" y1="${ly}" x2="${x + w - 10 - (i % 4 === 3 ? w * 0.35 : 0)}" y2="${ly}"/>`;
      break;
    case 'button': b = rect('el') + block(t || it.label, x + 8, y, w - 16, h, 't tb', Math.min(18, h * 0.42), true); break;
    case 'link': b = rect('hit') + `<text class="t tl" x="${x}" y="${cy}" dominant-baseline="central">${esc(t || it.label)}</text>`; break;
    case 'input': case 'dropdown':
      b = rect('el') + `<text class="t tm" x="${x + 12}" y="${cy}" dominant-baseline="central">${esc(t || it.label)}</text>`;
      if (look === 'dropdown') b += `<path class="thin" d="M${x + w - 30} ${cy - 4}l8 8l8-8"/>`;
      break;
    case 'textarea': b = rect('el') + block(t || it.label, x + 12, y + 8, w - 24, Math.min(h - 16, 40), 't tm', 14) + `<path class="thin" d="M${x + w - 14} ${y + h - 6}l8 -8M${x + w - 9} ${y + h - 5}l4 -4"/>`; break;
    case 'check': case 'radio': {
      const s = Math.min(h, 20), by = cy - s / 2;
      b = rect('hit') + (look === 'check'
        ? `<rect class="el" x="${x}" y="${by}" width="${s}" height="${s}" rx="4"/><path class="thin" style="stroke-width:2.5;stroke-opacity:1" d="M${x + s * 0.22} ${cy}l${s * 0.2} ${s * 0.22}l${s * 0.38} ${-s * 0.42}"/>`
        : `<circle class="el" cx="${x + s / 2}" cy="${cy}" r="${s / 2}"/><circle class="fk" cx="${x + s / 2}" cy="${cy}" r="${s / 4}"/>`)
        + `<text class="t" x="${x + s + 10}" y="${cy}" dominant-baseline="central">${esc(t || it.label)}</text>`;
      break;
    }
    case 'toggle': b = rect('el') + `<circle class="fk" cx="${x + w - h / 2}" cy="${cy}" r="${Math.max(2, h / 2 - 5)}"/>`; break;
    case 'slider': { const v = pct(t); b = rect('hit') + `<line class="scrib" x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}"/><line stroke="#111" stroke-width="5" stroke-linecap="round" x1="${x}" y1="${cy}" x2="${x + w * v}" y2="${cy}"/><circle class="el" cx="${x + w * v}" cy="${cy}" r="${Math.min(h / 2, 10)}"/>`; break; }
    case 'progress': b = rect('el') + `<rect class="fk" x="${x}" y="${y}" width="${w * pct(t)}" height="${h}" rx="${r}"/>`; break;
    case 'map':
      b = rect('el') + `<path class="thin" d="M${x} ${y + h * 0.7}C${x + w * 0.3} ${y + h * 0.5} ${x + w * 0.6} ${y + h * 0.9} ${x + w} ${y + h * 0.6}M${x + w * 0.35} ${y}L${x + w * 0.45} ${y + h}M${x} ${y + h * 0.3}L${x + w} ${y + h * 0.25}"/>`
        + `<path class="fk" d="M${cx} ${cy}l-9 -14a10 10 0 1 1 18 0z"/>`;
      break;
    case 'code':
      b = `<rect fill="#1f2430" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
      if (t) b += `<text class="mono">${String(t).split('\n').slice(0, Math.max(1, Math.floor((h - 16) / 18))).map((l, i) => `<tspan x="${x + 16}" y="${y + 26 + i * 18}">${esc(l)}</tspan>`).join('')}</text>`;
      else for (let ly = y + 22, i = 0; ly < y + h - 10; ly += 20, i++) { const ind = i % 4 === 1 || i % 4 === 2 ? 24 : 0; b += `<line stroke="#7c8aa5" stroke-width="5" stroke-linecap="round" x1="${x + 16 + ind}" y1="${ly}" x2="${x + 16 + ind + Math.min(w - 40 - ind, 60 + ((i * 53) % 5) * w * 0.1)}" y2="${ly}"/>`; }
      break;
    case 'list': {
      const L = t ? listItems(t, []) : null;
      b = rect('ghost');
      for (let i = 0, ly = y + 20; ly < y + h - 6; i++, ly += 30) {
        if (L && i >= L.length) break;
        b += `<circle class="fk" cx="${x + 14}" cy="${ly}" r="3.5"/>` + (L ? `<text class="t" x="${x + 28}" y="${ly}" dominant-baseline="central">${esc(L[i])}</text>`
          : `<line class="scrib" x1="${x + 28}" y1="${ly}" x2="${x + w - 14 - (i % 3) * w * 0.12}" y2="${ly}"/>`);
      }
      break;
    }
    case 'nav': case 'tabs': {
      const L = listItems(t, ['Item 1', 'Item 2', 'Item 3']), cw = w / L.length;
      b = rect(look === 'tabs' ? 'el' : 'ghost');
      L.forEach((s, i) => {
        b += `<text class="t${look === 'tabs' && !i ? ' tb' : ''}" x="${x + cw * (i + 0.5)}" y="${cy}" text-anchor="middle" dominant-baseline="central">${esc(s)}</text>`;
        if (look === 'tabs' && i) b += `<line class="thin" x1="${x + cw * i}" y1="${y + 8}" x2="${x + cw * i}" y2="${y + h - 8}"/>`;
      });
      if (look === 'tabs') b += `<line stroke="#111" stroke-width="4" x1="${x + 10}" y1="${y + h - 3}" x2="${x + cw - 10}" y2="${y + h - 3}"/>`;
      break;
    }
    case 'table': {
      b = rect('el') + `<rect fill="#eef1f6" x="${x + 1}" y="${y + 1}" width="${Math.max(0, w - 2)}" height="${Math.min(38, h - 2)}"/>`;
      for (let ly = y + 40; ly < y + h - 4; ly += 40) b += `<line class="thin" x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}"/>`;
      for (let i = 1; i < 4; i++) b += `<line class="thin" x1="${x + w * i / 4}" y1="${y}" x2="${x + w * i / 4}" y2="${y + h}"/>`;
      break;
    }
    case 'chart': {
      const H = [0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.55], bw = (w - 40) / H.length;
      b = rect('el');
      H.forEach((v, i) => { const bh = (h - 40) * v; b += `<rect class="thin" fill="#eef1f6" x="${x + 20 + i * bw + bw * 0.15}" y="${y + h - 20 - bh}" width="${bw * 0.7}" height="${bh}"/>`; });
      break;
    }
    case 'note': b = rect('note') + block(t || it.label, x + 10, y + 6, w - 20, h - 12, 'nt', 16); break;
    case 'arrow': b = `<line class="hitl" x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}"/><line class="arrow" x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" marker-end="url(#ah)"/>`; break;
  }
  if ((look === 'image' || look === 'video') && t) b += `<text class="t tm" x="${cx}" y="${y + h - 14}" text-anchor="middle">${esc(t)}</text>`;
  if (showLabels) {
    const s = `${n} ${it.label}`, bw = s.length * 6.7 + 14;
    // tag sits on the top edge like a tab, so it covers as little of the content as possible
    let bx = x + 6, by = y - 9;
    if (look === 'arrow') { bx = cx - bw / 2; by = cy - 24; }
    b += `<g class="bdg"><rect x="${bx}" y="${by}" width="${bw}" height="18" rx="9"/><text x="${bx + 7}" y="${by + 13}">${esc(s)}</text></g>`;
  }
  return b;
}

function selSVG(it, handles) {
  const s = 10 * scale(), { x, y, w, h } = it;
  if (it.kind === 'arrow' && !handles) { const b = box(it); return `<rect class="sel" x="${b.x - 4}" y="${b.y - 4}" width="${b.w + 8}" height="${b.h + 8}"/>`; }
  const pts = !handles ? [] : it.kind === 'arrow' ? [['a', x, y], ['b', x + w, y + h]] : [['nw', x, y], ['ne', x + w, y], ['sw', x, y + h], ['se', x + w, y + h]];
  return (it.kind === 'arrow' ? '' : `<rect class="sel" x="${x}" y="${y}" width="${w}" height="${h}"/>`)
    + pts.map(([k, px, py]) => `<rect class="hd" data-h="${k}" style="cursor:${k.length < 2 ? 'crosshair' : (k === 'nw' || k === 'se' ? 'nwse' : 'nesw') + '-resize'}" x="${px - s / 2}" y="${py - s / 2}" width="${s}" height="${s}"/>`).join('');
}

export function render() {
  if (!layer) return;
  const { board, items } = api.part();
  let s = `<rect class="board" x="0" y="0" width="${board.w}" height="${board.h}"/><text class="bn" x="0" y="-30">${esc(board.name || 'Custom')} · ${board.w} × ${board.h}</text>`;
  items.forEach((it, i) => { s += `<g data-id="${it.id}"${it.locked ? ' class="lk"' : ''}>${itemSVG(it, i + 1)}</g>`; });
  if (!noSel) {
    const sel = items.filter(i => api.isSel(i.id));
    sel.forEach(it => { s += selSVG(it, sel.length === 1 && !it.locked); });
    for (const g of guides) s += g.x != null ? `<line class="guide" x1="${g.x}" y1="${vb.y}" x2="${g.x}" y2="${vb.y + vb.h}"/>` : `<line class="guide" x1="${vb.x}" y1="${g.y}" x2="${vb.x + vb.w}" y2="${g.y}"/>`;
    if (drag?.mq && drag.p1) s += `<rect class="mq" x="${Math.min(drag.p0.x, drag.p1.x)}" y="${Math.min(drag.p0.y, drag.p1.y)}" width="${Math.abs(drag.p1.x - drag.p0.x)}" height="${Math.abs(drag.p1.y - drag.p0.y)}"/>`;
  }
  layer.innerHTML = s;
}

// ---- hooks used by app.js ----
export function add(kind) {
  const [, w0, h0] = KINDS[kind], { board } = api.part(), sn = v => Math.round(v / GRID) * GRID;
  const w = w0 === 1440 ? board.w : Math.min(w0, board.w), h = h0 === 900 ? board.h : h0;
  return make(kind, w0 === 1440 ? 0 : sn(vb.x + vb.w / 2 - w / 2), h0 === 900 ? 0 : sn(vb.y + vb.h / 2 - h / 2), w, h);
}
export const offset = it => { it.x += 20; it.y += 20; };

export function key(e) {
  if (e.key === 'f' || e.key === 'F' || e.key === 'Home') { fit(); return true; }
  if (e.key === '+' || e.key === '=') { zoom(0.8); return true; }
  if (e.key === '-') { zoom(1.25); return true; }
  const list = api.part().items.filter(i => api.isSel(i.id)), st = e.shiftKey ? GRID * 10 : GRID;
  const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
  if (!list.length || !d) return false;
  list.forEach(it => { it.x += d[0]; it.y += d[1]; });
  render(); api.commit();
  return true;
}

export const toolbar = () => `<button data-act="fit" title="F">Fit</button><button data-act="out" title="−">−</button><button data-act="in" title="+">+</button>`
  + `<button data-act="labels" class="${showLabels ? 'on' : ''}">Labels</button><button data-act="snap" class="${snapOn ? 'on' : ''}">Snap + guides</button>`;
export function act(a) {
  if (a === 'fit') fit();
  if (a === 'in') zoom(0.8);
  if (a === 'out') zoom(1.25);
  if (a === 'labels') { showLabels = !showLabels; render(); }
  if (a === 'snap') snapOn = !snapOn;
}

export function fields(it) {
  const look = KINDS[it.kind][3], arrow = look === 'arrow';
  const f = [
    { key: 'label', label: 'Label (what this is)', type: 'text' },
    { key: 'kind', label: 'Element type', type: 'select', options: Object.entries(KINDS).map(([k, v]) => [k, v[0]]) },
  ];
  if (!arrow && look !== 'divider') f.push({ key: 'text', type: VALUE_LOOKS.has(look) ? 'number' : 'textarea',
    label: ITEMS_LOOKS.has(look) ? 'Items (comma-separated)' : VALUE_LOOKS.has(look) ? 'Value (0–100)' : look === 'image' || look === 'video' || look === 'carousel' || look === 'map' ? 'What it shows'
      : look === 'note' ? 'Note text' : look === 'code' ? 'Code (optional)' : look === 'input' || look === 'textarea' ? 'Placeholder' : 'Text content' });
  f.push({ key: 'note', label: arrow ? 'What happens (e.g. "click opens modal")' : 'Note for Claude (behaviour, style, data…)', type: 'textarea' });
  for (const k of ['x', 'y', 'w', 'h']) f.push({ key: k, half: true, type: 'number', label: { x: 'X', y: 'Y', w: arrow ? 'Δ X' : 'Width', h: arrow ? 'Δ Y' : 'Height' }[k] });
  if (!arrow && look !== 'link' && look !== 'divider') f.push(
    { key: 'r', label: 'Corner radius', type: 'range', min: 0, max: Math.floor(Math.min(it.w, it.h) / 2) },
    { label: 'Corner presets', type: 'presets', options: [['Sharp', o => { o.r = 0; }], ['Soft', o => { o.r = 6; }], ['Round', o => { o.r = 16; }], ['Pill', o => { o.r = Math.floor(Math.min(o.w, o.h) / 2); }]] },
  );
  const b = api.part().board;
  f.push({ label: 'Align on artboard', type: 'presets', options: [
    ['Left', o => { o.x = 0; }], ['Centre', o => { o.x = Math.round((b.w - o.w) / 2); }], ['Right', o => { o.x = b.w - o.w; }],
    ['Full width', o => { o.x = 0; o.w = b.w; }], ['Top', o => { o.y = 0; }], ['Middle', o => { o.y = Math.round((b.h - o.h) / 2); }]] });
  return f;
}

export function docFields() {
  const b = api.part().board;
  return [
    { label: 'Artboard', type: 'select', options: [...BOARDS.map(([n, w, h]) => [n, `${n} ${w}×${h}`]), ['Custom', 'Custom size']],
      get: () => BOARDS.some(x => x[0] === b.name) ? b.name : 'Custom',
      set: v => { const p = BOARDS.find(x => x[0] === v); if (p) [b.name, b.w, b.h] = p; else b.name = 'Custom'; fit(); } },
    { key: 'w', obj: b, label: 'Width', type: 'number', half: true, set: v => { b.w = v; b.name = 'Custom'; } },
    { key: 'h', obj: b, label: 'Height', type: 'number', half: true, set: v => { b.h = v; b.name = 'Custom'; } },
  ];
}

// ---- export ----
export async function snapshot() {
  const { board, items } = api.part();
  let x0 = 0, y0 = 0, x1 = board.w, y1 = board.h;
  for (const it of items) {
    const b = box(it);
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  x0 -= 40; y0 -= 60; x1 += 40; y1 += 40;
  noSel = true; render();
  const c = svg.cloneNode(true);
  noSel = false; render();
  const W = x1 - x0, H = y1 - y0, s = Math.min(2, Math.max(0.5, 1800 / W));
  c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  c.setAttribute('viewBox', `${x0} ${y0} ${W} ${H}`);
  c.setAttribute('width', Math.round(W * s));
  c.setAttribute('height', Math.round(H * s));
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
  await img.decode();
  const cv = Object.assign(document.createElement('canvas'), { width: Math.round(W * s), height: Math.round(H * s) });
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0);
  return cv;
}

export function describe() {
  const { board, items } = api.part(), num = it => items.indexOf(it) + 1, name = it => `#${num(it)} ${it.label}`;
  const ui = items.filter(i => i.kind !== 'note' && i.kind !== 'arrow');
  const area = a => a.w * a.h;
  // a is inside b; identical boxes nest the later one inside the earlier one
  const inside = (a, b) => a !== b && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
    && !(a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && num(a) < num(b));
  const parent = a => ui.filter(b => inside(a, b)).sort((p, q) => area(p) - area(q))[0];
  const at = (px, py, skip) => ui.filter(b => b !== skip && px >= b.x - 8 && py >= b.y - 8 && px <= b.x + b.w + 8 && py <= b.y + b.h + 8).sort((p, q) => area(p) - area(q))[0];
  const kids = new Map();
  for (const it of ui) { const p = parent(it); kids.set(p, [...(kids.get(p) || []), it]); }
  const out = [];
  const walk = (p, d) => (kids.get(p) || []).sort((a, b) => a.y - b.y || a.x - b.x).forEach(it => {
    const pad = '  '.repeat(d), look = KINDS[it.kind][3];
    let s = `${pad}- **#${num(it)} ${it.label}** (${KINDS[it.kind][0].toLowerCase()}): ${it.w}×${it.h} at x ${it.x}, y ${it.y}`;
    if (it.r) s += `, corner radius ${it.r}`;
    if (it.text) s += `, ${ITEMS_LOOKS.has(look) ? 'items' : VALUE_LOOKS.has(look) ? 'value %' : ['image', 'video', 'carousel', 'map'].includes(look) ? 'shows' : look === 'input' || look === 'textarea' ? 'placeholder' : 'text'}: "${String(it.text).replace(/\n/g, ' / ')}"`;
    if (it.note) s += `\n${pad}  - Note: ${it.note}`;
    out.push(s);
    walk(it, d + 1);
  });
  walk(undefined, 0);
  const notes = items.filter(i => i.kind === 'note' || i.kind === 'arrow').map(it => {
    if (it.kind === 'arrow') {
      const a = at(it.x, it.y), b = at(it.x + it.w, it.y + it.h);
      return `- **#${num(it)} ${it.label}** (arrow): from ${a ? name(a) : `(${it.x}, ${it.y})`} to ${b ? name(b) : `(${it.x + it.w}, ${it.y + it.h})`}${it.note ? `. ${it.note}` : ''}`;
    }
    const on = at(it.x + it.w / 2, it.y + it.h / 2, it);
    return `- **#${num(it)}** note${on ? ` near ${name(on)}` : ''}: "${(it.text || it.label).replace(/\n/g, ' / ')}"${it.note ? `. ${it.note}` : ''}`;
  });
  return [
    '**Type:** 2D layout wireframe (website or app screen)',
    `**Artboard:** ${board.name || 'Custom'}, ${board.w} × ${board.h} px. Coordinates are px from the top-left corner.`,
    '',
    '## How to read the image',
    '- Black outlines are UI elements. The black numbered tags match the list below.',
    '- A box with an X is an image placeholder, ▶ is a video, grey bars are placeholder text, a dark box with lines is a code block.',
    '- Red dashed boxes and red arrows are notes and interactions from the designer, not part of the UI.',
    '',
    '## Elements (indented = inside the element above)',
    ...out,
    ...(notes.length ? ['', '## Notes and interactions', ...notes] : []),
  ].join('\n');
}

// ---- templates ----
const T = make;
const header = (w, nav = 'Product, Pricing, Docs, Blog') => [
  T('header', 0, 0, w, 80, 'Header'), T('icon', 40, 16, 48, 48, 'Logo'),
  T('nav', w / 2 - 240, 20, 480, 40, 'Main nav', nav), T('button', w - 200, 16, 160, 48, 'Sign-up button', 'Get started'),
];

export const TEMPLATES = [
  { name: 'Landing page', build: () => ({ board: { name: 'Long page', w: 1440, h: 1600 }, items: [
    ...header(1440),
    T('hero', 0, 80, 1440, 560, 'Hero'),
    T('heading', 120, 170, 620, 160, 'Headline', 'Sketch it. Label it. Let Claude build it.'),
    T('text', 120, 340, 560, 90, 'Subheadline', 'A grid-paper canvas for wireframes and 3D blockouts that AI can read.'),
    T('button', 120, 470, 200, 56, 'Primary CTA', 'Start designing'),
    T('button', 340, 470, 200, 56, 'Secondary CTA', 'Watch demo', { note: 'Outline style, not filled' }),
    T('image', 800, 160, 520, 400, 'Product screenshot', 'App screenshot'),
    T('section', 0, 640, 1440, 520, 'Features'),
    T('heading', 120, 690, 600, 60, 'Section title', 'Why people use it'),
    ...[0, 1, 2].flatMap(i => { const x = 120 + i * 410; return [
      T('card', x, 790, 380, 320, `Feature card ${i + 1}`), T('icon', x + 30, 830, 56, 56, `Feature icon ${i + 1}`),
      T('heading', x + 30, 910, 320, 40, `Feature title ${i + 1}`, ['Grid paper', 'Labels', 'Export'][i]), T('text', x + 30, 960, 320, 110, `Feature text ${i + 1}`)]; }),
    T('note', 1000, 690, 320, 70, 'Animation note', 'Cards fade in one by one on scroll'),
    T('section', 0, 1160, 1440, 200, 'CTA band'),
    T('heading', 120, 1225, 700, 70, 'CTA headline', 'Ready to sketch your idea?'),
    T('button', 1100, 1230, 220, 60, 'CTA button', 'Try it free'),
    T('footer', 0, 1360, 1440, 240, 'Footer'),
    T('list', 120, 1400, 220, 150, 'Footer links', 'About, Careers, Privacy, Terms'),
    T('text', 1000, 1400, 320, 40, 'Copyright', '© 2026 Your Company'),
  ] }) },
  { name: 'Dashboard', build: () => ({ board: { name: 'Desktop', w: 1440, h: 900 }, items: [
    T('sidebar', 0, 0, 240, 900, 'Sidebar'), T('icon', 24, 20, 48, 48, 'Logo'),
    T('list', 24, 100, 192, 300, 'Sidebar links', 'Overview, Orders, Customers, Reports, Settings'),
    T('header', 240, 0, 1200, 72, 'Top bar'), T('input', 280, 12, 360, 48, 'Search', 'Search…'), T('icon', 1370, 12, 48, 48, 'User avatar'),
    ...['Revenue', 'Users', 'Orders', 'Churn'].map((k, i) => T('card', 280 + i * 285, 104, 260, 120, `KPI: ${k}`)),
    T('chart', 280, 256, 760, 360, 'Revenue chart', '', { note: 'Line chart, last 12 months' }),
    T('list', 1070, 256, 330, 360, 'Recent activity'),
    T('table', 280, 648, 1120, 220, 'Orders table', '', { note: 'Columns: order, customer, total, status' }),
  ] }) },
  { name: 'Mobile app screen', build: () => ({ board: { name: 'Mobile', w: 390, h: 844 }, items: [
    T('header', 0, 0, 390, 96, 'App bar'), T('heading', 20, 44, 200, 40, 'Screen title', 'Discover'), T('icon', 330, 48, 40, 40, 'Profile'),
    T('input', 20, 112, 350, 48, 'Search', 'Search places', { r: 24 }),
    T('tabs', 20, 176, 350, 40, 'Filter tabs', 'All, New, Popular'),
    ...[0, 1, 2].flatMap(i => { const y = 232 + i * 172; return [
      T('card', 20, y, 350, 156, `Item card ${i + 1}`, '', { r: 16 }), T('image', 32, y + 12, 120, 132, `Item photo ${i + 1}`, '', { r: 10 }),
      T('heading', 166, y + 18, 190, 32, `Item title ${i + 1}`, ['Lisbon', 'Kyoto', 'Oaxaca'][i]), T('text', 166, y + 58, 190, 80, `Item summary ${i + 1}`)]; }),
    T('tabs', 0, 764, 390, 80, 'Bottom tab bar', 'Home, Search, Saved, Profile'),
  ] }) },
  { name: 'Login', build: () => ({ board: { name: 'Desktop', w: 1440, h: 900 }, items: [
    T('card', 520, 180, 400, 560, 'Login card', '', { r: 16 }), T('icon', 690, 220, 60, 60, 'Logo'),
    T('heading', 560, 300, 320, 50, 'Title', 'Welcome back'),
    T('input', 560, 380, 320, 48, 'Email field', 'you@example.com'), T('input', 560, 448, 320, 48, 'Password field', '••••••••'),
    T('checkbox', 560, 510, 200, 24, 'Remember me', 'Remember me'),
    T('button', 560, 550, 320, 52, 'Log-in button', 'Log in'), T('link', 640, 630, 160, 24, 'Forgot password link', 'Forgot password?'),
    T('note', 1000, 520, 280, 90, 'Success note', 'On success, go to the dashboard. Show errors under the field.'),
    T('arrow', 880, 576, 120, -10, 'Submit flow', '', { note: 'Submitting validates and logs in' }),
  ] }) },
  { name: 'Settings form', build: () => ({ board: { name: 'Desktop', w: 1440, h: 900 }, items: [
    T('sidebar', 0, 0, 240, 900, 'Settings menu'), T('list', 24, 40, 192, 220, 'Settings sections', 'Profile, Account, Notifications, Billing, Privacy'),
    T('heading', 300, 40, 600, 50, 'Page title', 'Profile settings'),
    T('icon', 300, 120, 96, 96, 'Profile photo'), T('button', 420, 144, 160, 48, 'Change photo button', 'Change photo'),
    T('input', 300, 250, 400, 48, 'Name field', 'Your name'), T('input', 730, 250, 400, 48, 'Email field', 'you@example.com'),
    T('textarea', 300, 320, 830, 120, 'Bio field', 'A short bio'),
    T('dropdown', 300, 470, 400, 48, 'Language dropdown', 'English'),
    T('divider', 300, 540, 830, 10, 'Divider'),
    T('toggle', 300, 580, 52, 28, 'Email updates toggle'), T('text', 370, 580, 400, 28, 'Email updates label', 'Send me product updates'),
    T('toggle', 300, 630, 52, 28, 'Dark mode toggle'), T('text', 370, 630, 400, 28, 'Dark mode label', 'Dark mode'),
    T('button', 970, 800, 160, 52, 'Save button', 'Save changes'), T('button', 790, 800, 160, 52, 'Cancel button', 'Cancel'),
  ] }) },
  { name: 'Pricing page', build: () => ({ board: { name: 'Desktop', w: 1440, h: 900 }, items: [
    ...header(1440),
    T('heading', 420, 110, 600, 70, 'Title', 'Simple pricing'),
    T('text', 470, 185, 500, 40, 'Subtitle', 'Start free, upgrade when you need more.'),
    ...[0, 1, 2].flatMap(i => { const x = 150 + i * 390; return [
      T('card', x, 260, 360, 580, `Plan card: ${['Free', 'Pro', 'Team'][i]}`, '', i === 1 ? { note: 'Most popular: highlight this card' } : {}),
      T('heading', x + 30, 290, 300, 40, `Plan name ${i + 1}`, ['Free', 'Pro', 'Team'][i]),
      T('heading', x + 30, 340, 300, 70, `Price ${i + 1}`, ['$0', '$12/mo', '$40/mo'][i]),
      T('list', x + 30, 430, 300, 280, `Plan features ${i + 1}`),
      T('button', x + 30, 750, 300, 56, `Choose plan ${i + 1}`, 'Choose plan')]; }),
  ] }) },
  { name: 'Blog article', build: () => ({ board: { name: 'Custom', w: 1440, h: 1220 }, items: [
    ...header(1440, 'Home, Articles, About'),
    T('heading', 220, 130, 760, 120, 'Article title', 'How to explain a design to an AI in five minutes'),
    T('text', 220, 260, 760, 30, 'Author and date', 'By Sam Lee · 25 Oct 2026 · 6 min read'),
    T('image', 220, 310, 760, 400, 'Cover image', 'Hero photo for the article'),
    T('text', 220, 740, 760, 320, 'Article body'),
    T('card', 1040, 130, 300, 560, 'Sidebar card'), T('heading', 1060, 150, 260, 40, 'Sidebar title', 'Related posts'),
    T('list', 1060, 200, 260, 280, 'Related posts list'),
    T('input', 1060, 540, 260, 48, 'Newsletter email', 'Your email'), T('button', 1060, 600, 260, 48, 'Subscribe button', 'Subscribe'),
    T('footer', 0, 1100, 1440, 120, 'Footer'),
  ] }) },
  { name: 'Online shop product', build: () => ({ board: { name: 'Desktop', w: 1440, h: 900 }, items: [
    ...header(1440, 'Shop, New, Sale, About'),
    T('carousel', 120, 130, 640, 560, 'Product photos', 'Product photos, swipe between them'),
    T('badge', 820, 140, 90, 28, 'Sale badge', 'Sale'),
    T('heading', 820, 180, 500, 90, 'Product name', 'Merino travel hoodie'),
    T('heading', 820, 280, 300, 50, 'Price', '$89'),
    T('text', 820, 350, 500, 100, 'Product description'),
    T('tabs', 820, 470, 400, 44, 'Size picker', 'XS, S, M, L, XL'),
    T('button', 820, 540, 300, 56, 'Add to cart button', 'Add to cart', { note: 'Shows a mini cart on click' }),
    T('icon', 1140, 544, 48, 48, 'Favourite button'),
    T('list', 820, 620, 400, 120, 'Shipping info', 'Free shipping over $50, 30-day returns'),
  ] }) },
];
