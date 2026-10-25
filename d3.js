// 3D scene mode: white blockout shapes with black edges on a grid floor, Blender-style controls.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 9);
const r3 = v => Math.round(v * 1000) / 1000;
const V2 = (x, y) => new THREE.Vector2(x, y);
const INK = 0x111111, ACCENT = 0x2563eb, DEG = Math.PI / 180;

const PRIMS = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', cone: 'Cone', torus: 'Ring (torus)', capsule: 'Capsule', ramp: 'Ramp / wedge', arch: 'Arch', stairs: 'Stairs',
  tree: 'Tree', person: 'Person (scale figure)', pin: 'Note pin (marker)' };
const BEVEL = new Set(['box', 'cylinder', 'ramp', 'arch', 'stairs']), SIDED = new Set(['cylinder', 'cone']);
const POLY = { 3: 'triangular', 4: 'square', 5: 'pentagonal', 6: 'hexagonal', 8: 'octagonal' };
// palette key: [label, prim, w, h, d, bevel, bevel segments, style, extra fields]
const P = {
  box: ['Box', 'box', 1, 1, 1], rbox: ['Rounded box', 'box', 1, 1, 1, 0.15, 5], wall: ['Wall', 'box', 4, 2.5, 0.15], floor: ['Floor', 'box', 6, 0.05, 6],
  stairs: ['Stairs', 'stairs', 1.2, 1.8, 2.7], ramp: ['Ramp', 'ramp', 2, 1, 1.5], arch: ['Arch', 'arch', 2, 2.5, 0.4, 0.03, 3],
  door: ['Door', 'box', 0.9, 2.1, 0.05, 0, 3, 'dark'], window: ['Window', 'box', 1.2, 1, 0.05, 0, 3, 'ghost', { y: 0.9 }],
  cylinder: ['Cylinder', 'cylinder', 1, 1, 1, 0.04, 3], hex: ['Hex prism', 'cylinder', 1, 0.5, 1, 0.02, 2, 'solid', { sides: 6 }],
  sphere: ['Sphere', 'sphere', 1, 1, 1], cone: ['Cone', 'cone', 1, 1.2, 1], pyramid: ['Pyramid', 'cone', 1.4, 1, 1.4, 0, 3, 'solid', { sides: 4 }],
  torus: ['Ring', 'torus', 1, 0.2, 1], capsule: ['Capsule', 'capsule', 0.5, 1.5, 0.5],
  person: ['Person 1.8 m', 'person', 0.5, 1.8, 0.3], tree: ['Tree', 'tree', 1.6, 3.5, 1.6], zone: ['Zone / glass', 'box', 2, 2, 2, 0, 3, 'ghost'],
  pin: ['Note pin', 'pin', 0.3, 0.7, 0.3, 0, 3, 'note', { label: 'Note' }],
};
export const PALETTE = [
  ['Blocks', ['box', 'rbox', 'wall', 'floor', 'door', 'window', 'stairs', 'ramp', 'arch']],
  ['Shapes', ['cylinder', 'hex', 'sphere', 'cone', 'pyramid', 'torus', 'capsule']],
  ['Reference', ['person', 'tree', 'zone', 'pin']],
].map(([g, ks]) => [g, ks.map(k => [k, P[k][0]])]);
export const HINT = 'Click to select (Shift adds) · drag to orbit · right-drag or Shift-drag to pan · wheel zooms · G/R/S move/rotate/scale · 1/3/7/5 front/right/top/persp · F fit · X delete';
export const TARGETS = ['Blender (Python script)', 'three.js', 'React Three Fiber', 'Godot 4 scene', 'Unity', 'Unreal Engine', 'Roblox Studio', 'Minecraft build', 'Concept art image prompt'];

function make(key, x = 0, y = 0, z = 0, o = {}) {
  const [label, prim, w, h, d, bevel = 0, segs = 3, style = 'solid', { y: ey = 0, ...ex } = {}] = P[key];
  return { id: uid(), prim, label, w, h, d, bevel, segs, sides: 48, style, pos: [x, y || ey, z], rot: [0, 0, 0], note: '', ...ex, ...o };
}

// Opened files are untrusted: force every field to its expected type.
const num = v => Number.isFinite(+v) ? +v : 0;
const vec = a => [0, 1, 2].map(i => num(Array.isArray(a) ? a[i] : 0));
export const clean = p => ({
  items: (Array.isArray(p?.items) ? p.items : []).map(it => ({
    id: /^[a-z0-9]{1,16}$/.test(it?.id) ? it.id : uid(), prim: PRIMS[it?.prim] ? it.prim : 'box',
    label: String(it.label ?? ''), w: num(it.w) || 1, h: num(it.h) || 1, d: num(it.d) || 1,
    bevel: num(it.bevel), segs: Math.min(12, Math.max(1, Math.round(num(it.segs)) || 3)), sides: Math.min(64, Math.max(3, Math.round(num(it.sides)) || 48)),
    style: ['solid', 'dark', 'ghost', 'note'].includes(it.style) ? it.style : 'solid', pos: vec(it.pos), rot: vec(it.rot), note: String(it.note ?? ''), locked: it.locked === true,
  })),
});

// ---- geometry: every shape is built centred on X/Z with its base at y = 0 ----
function lathe(R, H, b, s, sides) {
  const pts = [V2(0, 0)];
  const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= s; i++) { const a = a0 + (a1 - a0) * i / s; pts.push(V2(cx + b * Math.cos(a), cy + b * Math.sin(a))); } };
  if (b > 0.001) { arc(R - b, b, -Math.PI / 2, 0); arc(R - b, H - b, 0, Math.PI / 2); } else pts.push(V2(R, 0), V2(R, H));
  pts.push(V2(0, H));
  return new THREE.LatheGeometry(pts, sides);
}
const extrude = (shape, d, b, s) => new THREE.ExtrudeGeometry(shape, {
  depth: Math.max(0.001, d - 2 * b), curveSegments: 24, bevelEnabled: b > 0.001, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: s,
});
const rbox = (w, h, d, b, s) => b > 0.001 ? new RoundedBoxGeometry(w, h, d, s, b) : new THREE.BoxGeometry(w, h, d);

function geom(it) {
  const { w, h, d } = it, s = it.segs || 3, sides = it.sides || 48;
  let b = Math.max(0, Math.min(it.bevel || 0, w / 2, h / 2, d / 2) * 0.999), g, fitBox = false;
  switch (it.prim) {
    // few-sided prisms and pyramids are turned so a flat face points at the front view
    case 'cylinder': g = lathe(w / 2, h, b, s, sides).rotateY(sides < 24 ? Math.PI / sides : 0).scale(1, 1, d / w); break;
    case 'sphere': g = new THREE.SphereGeometry(0.5, 48, 24).scale(w, h, d); break;
    case 'cone': g = new THREE.ConeGeometry(0.5, 1, sides).rotateY(sides < 24 ? Math.PI / sides : 0).scale(w, h, d); break;
    case 'tree':
      g = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.1, 1, 12).translate(0, 0.5, 0), new THREE.ConeGeometry(0.5, 1.5, 24).translate(0, 1.6, 0),
        new THREE.ConeGeometry(0.38, 1.1, 24).translate(0, 2.3, 0)].map(x => x.toNonIndexed()));
      fitBox = true;
      break;
    case 'pin':
      g = mergeGeometries([new THREE.ConeGeometry(0.5, 1.4, 24).rotateX(Math.PI).translate(0, 0.7, 0), new THREE.SphereGeometry(0.5, 24, 16).translate(0, 1.6, 0)].map(x => x.toNonIndexed()));
      fitBox = true;
      break;
    case 'torus': g = new THREE.TorusGeometry(0.4, 0.1, 24, 64).rotateX(Math.PI / 2).scale(w, h / 0.2, d); break;
    case 'capsule': g = new THREE.CapsuleGeometry(0.5, 1, 8, 24).scale(w, h / 2, d); break;
    case 'ramp': b = Math.min(b, w * 0.12, h * 0.12); g = extrude(new THREE.Shape([V2(0, 0), V2(w, 0), V2(w, h)]), d, b, s); break;
    case 'arch': {
      const t = w * 0.22, rr = Math.max(0.01, Math.min((w - 2 * t) / 2, h - t - 0.01)), cy = h - t - rr, sh = new THREE.Shape();
      b = Math.min(b, t * 0.4);
      sh.moveTo(0, 0); sh.lineTo(t, 0); sh.lineTo(t, cy); sh.absarc(w / 2, cy, rr, Math.PI, 0, true);
      sh.lineTo(w - t, 0); sh.lineTo(w, 0); sh.lineTo(w, h); sh.lineTo(0, h); sh.lineTo(0, 0);
      g = extrude(sh, d, b, s);
      break;
    }
    case 'stairs': {
      const n = Math.max(2, Math.round(h / 0.18)), sd = d / n, parts = [];
      for (let k = 0; k < n; k++) {
        const sh = h * (k + 1) / n;
        parts.push(rbox(w, sh, sd, Math.min(b, sd / 2, sh / 2) * 0.999, s).translate(0, sh / 2, -d / 2 + sd * (k + 0.5)).toNonIndexed());
      }
      g = mergeGeometries(parts);
      break;
    }
    case 'person': {
      const cap = (r, len, x, y) => new THREE.CapsuleGeometry(r, len, 6, 24).translate(x, y, 0);
      g = mergeGeometries([new THREE.SphereGeometry(0.11, 24, 16).translate(0, 1.69, 0), cap(0.17, 0.36, 0, 1.2),
        cap(0.075, 0.72, -0.1, 0.44), cap(0.075, 0.72, 0.1, 0.44), cap(0.055, 0.56, -0.25, 1.13), cap(0.055, 0.56, 0.25, 1.13)].map(x => x.toNonIndexed()));
      fitBox = true;
      break;
    }
    default: g = rbox(w, h, d, b, s);
  }
  g.computeBoundingBox();
  if (fitBox) { const sz = g.boundingBox.getSize(new THREE.Vector3()); g.scale(w / sz.x, h / sz.y, d / sz.z); g.computeBoundingBox(); }
  const bb = g.boundingBox;
  return g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
}

const material = style => style === 'ghost'
  ? new THREE.MeshStandardMaterial({ color: 0xcfdcff, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })
  : new THREE.MeshStandardMaterial({ color: { dark: 0x4a4f57, note: 0xe11d48 }[style] ?? 0xffffff, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

// ---- scene ----
let api, host, renderer, labelR, scene, root, persp, ortho, cam, orbit, tc;
let view = 'persp', mode = 'translate', showLabels = true, snap = true, framed = false, orthoHalf = 5;
const objs = new Map();
const cur = () => api.part().items.find(i => i.id === api.sel);

export function init(a, el) {
  api = a; host = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(devicePixelRatio);
  host.append(renderer.domElement);
  labelR = new CSS2DRenderer();
  labelR.domElement.className = 'labels3';
  host.append(labelR.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd4dc, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 7);
  scene.add(sun);
  const minor = new THREE.GridHelper(40, 160, 0xe6eaf0, 0xe6eaf0), major = new THREE.GridHelper(40, 40, 0x8a93a3, 0xc9d0db);
  major.position.y = 0.001;
  scene.add(minor, major);
  root = new THREE.Group();
  scene.add(root);

  persp = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  persp.position.set(8, 6, 10);
  ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, -500, 500);
  cam = persp;
  orbit = new OrbitControls(cam, renderer.domElement);
  orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
  orbit.target.set(0, 0.5, 0);
  orbit.update();

  tc = new TransformControls(cam, renderer.domElement);
  tc.setSize(0.9);
  tc.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
  tc.addEventListener('mouseUp', bake);
  scene.add(tc);
  applySnap();

  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, gizmo: tc.axis !== null }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || down.gizmo || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    const r = renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(V2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), cam);
    const hit = ray.intersectObjects([...objs.values()].map(g => g.children[0]).filter(m => !m.userData.locked), false)[0];
    if (hit) api.select(hit.object.userData.id, e.shiftKey);
    else if (!e.shiftKey) api.select(null);
  });

  new ResizeObserver(resize).observe(host);
  renderer.setAnimationLoop(() => {
    if (!host.clientWidth) return;
    renderer.render(scene, cam);
    labelR.render(scene, cam);
  });
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  labelR.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  applyOrtho(w / h);
  if (!framed) { framed = true; setView(view); }
}
function applyOrtho(a) {
  Object.assign(ortho, { left: -orthoHalf * a, right: orthoHalf * a, top: orthoHalf, bottom: -orthoHalf });
  ortho.updateProjectionMatrix();
}
function applySnap() {
  tc.setTranslationSnap(snap ? 0.25 : null);
  tc.setRotationSnap(snap ? 15 * DEG : null);
  tc.setScaleSnap(snap ? 0.25 : null);
}

function setView(v) {
  view = v;
  const sz = renderer.getSize(V2()), a = sz.x / sz.y || 1, box = new THREE.Box3().setFromObject(root);
  const c = box.isEmpty() ? new THREE.Vector3(0, 0.5, 0) : box.getCenter(new THREE.Vector3());
  const r = box.isEmpty() ? 3 : Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
  if (v === 'persp') {
    cam = persp;
    persp.aspect = a;
    persp.updateProjectionMatrix();
    persp.position.copy(c).add(new THREE.Vector3(1, 0.75, 1.25).normalize().multiplyScalar(r * 2.3 + 1));
  } else {
    cam = ortho;
    const dir = { top: [0, 1, 0], front: [0, 0, 1], right: [1, 0, 0] }[v];
    ortho.up.set(0, v === 'top' ? 0 : 1, v === 'top' ? -1 : 0);
    ortho.position.copy(c).add(new THREE.Vector3(...dir).multiplyScalar(100));
    ortho.zoom = 1;
    const s = box.isEmpty() ? new THREE.Vector3(6, 6, 6) : box.getSize(new THREE.Vector3());
    const [across, up] = { top: [s.x, s.z], front: [s.x, s.y], right: [s.z, s.y] }[v];
    orthoHalf = Math.max(across / a, up) / 2 * 1.15 + 0.3;
    applyOrtho(a);
  }
  cam.lookAt(c);
  orbit.object = cam;
  orbit.target.copy(c);
  orbit.enableRotate = v === 'persp';
  tc.camera = cam;
  orbit.update();
}

function build(it, n) {
  const g = new THREE.Group(), geo = geom(it), sel = api.isSel(it.id);
  const mesh = new THREE.Mesh(geo, material(it.style));
  mesh.userData = { id: it.id, locked: it.locked };
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: sel ? ACCENT : { ghost: 0x7d8db0, note: 0x9f1239 }[it.style] ?? INK }));
  const el = document.createElement('div');
  el.className = 'lbl3';
  el.innerHTML = `<b>${n}</b>${esc(it.label)}`;
  const label = new CSS2DObject(el);
  label.position.set(0, it.h + 0.15, 0);
  label.visible = showLabels;
  g.add(mesh, edges, label);
  g.position.fromArray(it.pos);
  g.rotation.set(it.rot[0] * DEG, it.rot[1] * DEG, it.rot[2] * DEG);
  return g;
}

export function render() {
  if (!root) return;
  for (const g of objs.values()) {
    root.remove(g);
    g.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); if (o.isCSS2DObject) o.element.remove(); });
  }
  objs.clear();
  api.part().items.forEach((it, i) => { const g = build(it, i + 1); root.add(g); objs.set(it.id, g); });
  root.updateMatrixWorld(true);
  const g = objs.get(api.sel);
  if (g) { tc.attach(g); tc.setMode(mode); } else tc.detach();
}

// TransformControls finished a drag: write the result back into the item.
function bake() {
  const g = tc.object, it = cur();
  if (!g || !it) return;
  it.pos = g.position.toArray().map(r3);
  it.rot = [g.rotation.x, g.rotation.y, g.rotation.z].map(v => Math.round(v / DEG * 10) / 10);
  const s = g.scale;
  if (s.x !== 1 || s.y !== 1 || s.z !== 1) { it.w = r3(Math.max(0.01, it.w * Math.abs(s.x))); it.h = r3(Math.max(0.01, it.h * Math.abs(s.y))); it.d = r3(Math.max(0.01, it.d * Math.abs(s.z))); }
  render();
  api.commit();
}

// ---- hooks used by app.js ----
export function add(key) {
  const it = make(key), q = v => Math.round(v * 4) / 4;
  it.pos = [q(orbit.target.x), it.pos[1], q(orbit.target.z)];
  return it;
}

const overlapXZ = (a, b) => a.min.x < b.max.x && a.max.x > b.min.x && a.min.z < b.max.z && a.max.z > b.min.z;
const worldBox = it => new THREE.Box3().setFromObject(objs.get(it.id).children[0]);
// Lower an object until it rests on the highest thing underneath it (or the ground).
function dropDown(it) {
  root.updateMatrixWorld(true);
  const me = worldBox(it);
  let top = 0;
  for (const o of api.part().items) {
    if (o === it) continue;
    const b = worldBox(o);
    if (overlapXZ(b, me) && b.max.y <= me.min.y + 0.01) top = Math.max(top, b.max.y);
  }
  it.pos[1] = r3(it.pos[1] - (me.min.y - top));
}
export const actions = () => [['Drop down', dropDown]];
export const offset = it => { it.pos = [it.pos[0] + 0.5, it.pos[1], it.pos[2] + 0.5]; };
export const fit = () => setView(view);

export function key(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key.toLowerCase(), m = { g: 'translate', w: 'translate', r: 'rotate', e: 'rotate', s: 'scale' }[k];
  if (m) { mode = m; tc.setMode(m); api.toolbar(); return true; }
  const v = { 1: 'front', 3: 'right', 7: 'top', 5: 'persp', 0: 'persp' }[e.key];
  if (v) { setView(v); api.toolbar(); return true; }
  if (k === 'f' || k === 'home') { setView(view); return true; }
  return false;
}

export const toolbar = () =>
  [['persp', 'Persp 5'], ['top', 'Top 7'], ['front', 'Front 1'], ['right', 'Right 3']].map(([v, t]) => `<button data-act="v:${v}" class="${view === v ? 'on' : ''}">${t}</button>`).join('')
  + ' &nbsp; ' + [['translate', 'Move G'], ['rotate', 'Rotate R'], ['scale', 'Scale S']].map(([m, t]) => `<button data-act="m:${m}" class="${mode === m ? 'on' : ''}">${t}</button>`).join('')
  + ` &nbsp; <button data-act="fit">Fit F</button><button data-act="labels" class="${showLabels ? 'on' : ''}">Labels</button><button data-act="snap" class="${snap ? 'on' : ''}">Snap 0.25 m</button>`;
export function act(a) {
  const [t, v] = a.split(':');
  if (t === 'v') setView(v);
  if (t === 'm') { mode = v; tc.setMode(v); }
  if (a === 'fit') setView(view);
  if (a === 'labels') { showLabels = !showLabels; render(); }
  if (a === 'snap') { snap = !snap; applySnap(); }
}

const minDim = o => Math.min(o.w, o.h, o.d);
export function fields(it) {
  const f = [
    { key: 'label', label: 'Label (what this is)', type: 'text' },
    { key: 'prim', label: 'Shape', type: 'select', options: Object.entries(PRIMS) },
    { key: 'style', label: 'Look', type: 'select', options: [['solid', 'Solid (white)'], ['dark', 'Dark (screens, metal)'], ['ghost', 'Ghost (glass, zone, volume)'], ['note', 'Red (note or marker)']] },
    { key: 'note', label: 'Note for Claude (material, purpose, behaviour…)', type: 'textarea' },
    { key: 'w', label: 'Width X (m)', type: 'number', step: 0.05, third: true },
    { key: 'h', label: 'Height Y (m)', type: 'number', step: 0.05, third: true },
    { key: 'd', label: 'Depth Z (m)', type: 'number', step: 0.05, third: true },
    { key: 'pos.0', label: 'X', type: 'number', step: 0.25, third: true },
    { key: 'pos.1', label: 'Base Y', type: 'number', step: 0.05, third: true },
    { key: 'pos.2', label: 'Z', type: 'number', step: 0.25, third: true },
    { key: 'rot.0', label: 'Tilt X°', type: 'number', step: 15, third: true },
    { key: 'rot.1', label: 'Turn Y°', type: 'number', step: 15, third: true },
    { key: 'rot.2', label: 'Roll Z°', type: 'number', step: 15, third: true },
  ];
  if (SIDED.has(it.prim)) f.push(
    { key: 'sides', label: 'Sides', type: 'range', min: 3, max: 64 },
    { label: 'Side presets', type: 'presets', options: [['Round', o => { o.sides = 48; }], ['Octagon', o => { o.sides = 8; }], ['Hexagon', o => { o.sides = 6; }], ['Square', o => { o.sides = 4; }], ['Triangle', o => { o.sides = 3; }]] },
  );
  if (BEVEL.has(it.prim)) f.push(
    { key: 'bevel', label: 'Bevel radius (m)', type: 'range', min: 0, max: r3(minDim(it) / 2), step: 0.005 },
    { key: 'segs', label: 'Bevel segments (1 = chamfer)', type: 'range', min: 1, max: 12 },
    { label: 'Bevel presets', type: 'presets', options: [
      ['None', o => { o.bevel = 0; }],
      ['Chamfer', o => { o.bevel = r3(minDim(o) * 0.15); o.segs = 1; }],
      ['Soft', o => { o.bevel = r3(minDim(o) * 0.08); o.segs = 4; }],
      ['Round', o => { o.bevel = r3(minDim(o) * 0.25); o.segs = 6; }],
      ['Pill', o => { o.bevel = r3(minDim(o) * 0.5); o.segs = 10; }],
    ] },
  );
  return f;
}
export const docFields = () => [];

// ---- export: a 2×2 sheet of perspective, top, front and right views with numbered tags ----
function pill(ctx, x, y, n, text) {
  const s = `${n} ${text}`;
  ctx.font = '600 13px ui-monospace, Consolas, monospace';
  const w = ctx.measureText(s).width + 16;
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 11, w, 22, 11); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(s, x - w / 2 + 8, y + 4.5);
}

export async function snapshot() {
  const saved = { view, pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: orbit.target.clone(), half: orthoHalf };
  const items = api.part().items, TW = 960, TH = 720, pr = renderer.getPixelRatio();
  tc.visible = false;
  for (const [id, g] of objs) { g.children[2].visible = false; if (api.isSel(id)) g.children[1].material.color.set(INK); }
  renderer.setPixelRatio(1);
  renderer.setSize(TW, TH, false);
  const cv = Object.assign(document.createElement('canvas'), { width: TW * 2, height: TH * 2 }), ctx = cv.getContext('2d');
  [['persp', 'Perspective'], ['top', 'Top view (X → right, Z → down)'], ['front', 'Front view (looking toward −Z)'], ['right', 'Right view (looking toward −X)']].forEach(([v, title], i) => {
    setView(v);
    renderer.render(scene, cam);
    const ox = (i % 2) * TW, oy = Math.floor(i / 2) * TH;
    ctx.drawImage(renderer.domElement, ox, oy);
    items.forEach((it, j) => {
      const p = objs.get(it.id).children[2].getWorldPosition(new THREE.Vector3()).project(cam);
      if (Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 && Math.abs(p.z) < 1) pill(ctx, ox + (p.x + 1) / 2 * TW, oy + (1 - p.y) / 2 * TH, j + 1, it.label);
    });
    ctx.fillStyle = '#111';
    ctx.font = 'bold 16px ui-monospace, Consolas, monospace';
    ctx.fillText(title, ox + 14, oy + 26);
  });
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, TW * 2 - 3, TH * 2 - 3);
  ctx.beginPath(); ctx.moveTo(TW, 0); ctx.lineTo(TW, TH * 2); ctx.moveTo(0, TH); ctx.lineTo(TW * 2, TH); ctx.stroke();

  renderer.setPixelRatio(pr);
  resize();
  setView(saved.view);
  orthoHalf = saved.half;
  applyOrtho(host.clientWidth / host.clientHeight || 1);
  cam.position.copy(saved.pos); cam.up.copy(saved.up); cam.zoom = saved.zoom; cam.updateProjectionMatrix();
  orbit.target.copy(saved.target); orbit.update();
  tc.visible = true;
  render();
  return cv;
}

export function describe() {
  const items = api.part().items, n = it => items.indexOf(it) + 1, f = v => +(+v).toFixed(2);
  root.updateMatrixWorld(true);
  const boxes = new Map(items.map(it => [it, worldBox(it)]));
  const shape = it => it.prim === 'box' && it.bevel > 0 ? 'rounded box'
    : SIDED.has(it.prim) && it.sides < 24 ? `${POLY[it.sides] || it.sides + '-sided'} ${it.prim === 'cone' ? 'pyramid' : 'prism'}`
    : it.prim === 'pin' ? 'note pin: a designer annotation, not part of the scene' : PRIMS[it.prim].replace(/ \(.*\)/, '').toLowerCase();
  const lines = items.map(it => {
    const b = boxes.get(it);
    let s = `${n(it)}. **${it.label}** (${shape(it)}): ${f(it.w)} × ${f(it.h)} × ${f(it.d)} m (W × H × D), base centre at x ${f(it.pos[0])}, y ${f(it.pos[1])}, z ${f(it.pos[2])}`;
    const rot = it.rot.map((r, i) => r ? `${'XYZ'[i]} ${f(r)}°` : '').filter(Boolean);
    if (rot.length) s += `, rotated ${rot.join(', ')}`;
    if (BEVEL.has(it.prim) && it.bevel > 0) s += `, ${it.segs === 1 ? 'chamfered' : 'rounded'} edges ${f(it.bevel)} m`;
    if (it.style === 'ghost') s += ', ghost (see-through: glass, a zone or a volume)';
    if (it.style === 'dark') s += ', dark material';
    if (it.style === 'note' && it.prim !== 'pin') s += ', red (a designer marker, not the real colour)';
    const on = b.min.y > 0.01 && items.find(o => o !== it && Math.abs(boxes.get(o).max.y - b.min.y) < 0.03 && overlapXZ(boxes.get(o), b));
    if (on) s += `, sits on #${n(on)} ${on.label}`;
    if (it.note) s += `\n   - Note: ${it.note}`;
    return s;
  });
  const all = new THREE.Box3();
  boxes.forEach(b => all.union(b));
  const sz = all.isEmpty() ? new THREE.Vector3() : all.getSize(new THREE.Vector3());
  return [
    '**Type:** 3D scene concept (a blockout of shapes, not final art)',
    '**Units:** metres. Y is up and the ground is y = 0. Positions are the centre of each object\'s base. Rotations are in degrees.',
    `**Scene size:** about ${f(sz.x)} × ${f(sz.y)} × ${f(sz.z)} m (X × Y × Z)`,
    '',
    '## How to read the image',
    '- Four views: perspective (top left), top (top right), front (bottom left), right side (bottom right).',
    '- White shapes with black edges are solid objects, grey shapes are dark materials, pale see-through shapes are glass, zones or volumes, red pins are notes.',
    '- Floor grid: 1 m squares with fine lines every 0.25 m. The black numbered tags match the list below.',
    '',
    '## Objects',
    ...lines,
  ].join('\n');
}

// ---- templates ----
const M = make;
export const TEMPLATES = [
  { name: 'Living room', build: () => ({ items: [
    M('floor', 0, 0, 0, { label: 'Floor', w: 6, d: 5, note: 'Light oak boards' }),
    M('wall', 0, 0.05, -2.5, { label: 'Back wall', w: 6 }),
    M('wall', -3, 0.05, 0, { label: 'Left wall', w: 5, rot: [0, 90, 0] }),
    M('rbox', 0, 0.05, -1.8, { label: 'Sofa seat', w: 2.2, h: 0.45, d: 0.9, bevel: 0.08, segs: 4, note: 'Soft fabric, warm grey' }),
    M('rbox', 0, 0.5, -2.15, { label: 'Sofa back', w: 2.2, h: 0.45, d: 0.2, bevel: 0.08, segs: 4 }),
    M('rbox', 0, 0.05, -0.4, { label: 'Rug', w: 2.6, h: 0.02, d: 1.8, bevel: 0.01, segs: 2 }),
    M('cylinder', 0, 0.07, -0.4, { label: 'Coffee table', w: 1, h: 0.4, d: 1, bevel: 0.03 }),
    M('rbox', 0, 0.05, 2.1, { label: 'TV stand', w: 1.8, h: 0.5, d: 0.4, bevel: 0.03, segs: 2 }),
    M('box', 0, 0.55, 2.1, { label: 'TV', w: 1.4, h: 0.8, d: 0.06, style: 'dark', rot: [0, 180, 0] }),
    M('cylinder', -2.4, 0.05, -1.9, { label: 'Lamp pole', w: 0.05, h: 1.5, d: 0.05, bevel: 0 }),
    M('cone', -2.4, 1.55, -1.9, { label: 'Lamp shade', w: 0.45, h: 0.35, d: 0.45 }),
    M('box', -2.92, 0.9, 0.6, { label: 'Window', w: 0.08, h: 1.3, d: 1.6, style: 'ghost' }),
    M('person', 1.8, 0.05, 0.3, { label: 'Person (for scale)' }),
  ] }) },
  { name: 'Simple house', build: () => ({ items: [
    M('floor', 0, 0, 0, { label: 'Ground', w: 12, d: 12, note: 'Grass' }),
    M('rbox', 0, 0.05, 0, { label: 'House body', w: 6, h: 3, d: 5, bevel: 0.05, segs: 2, note: 'White render walls' }),
    M('ramp', -1.5, 3.05, 0, { label: 'Roof left', w: 3, h: 1.6, d: 5.4, note: 'Dark slate tiles' }),
    M('ramp', 1.5, 3.05, 0, { label: 'Roof right', w: 3, h: 1.6, d: 5.4, rot: [0, 180, 0] }),
    M('box', 1.6, 3.4, -1, { label: 'Chimney', w: 0.6, h: 1.4, d: 0.6 }),
    M('box', 0, 0.05, 2.52, { label: 'Front door', w: 1, h: 2.1, d: 0.08, style: 'dark' }),
    M('box', -1.8, 1.3, 2.52, { label: 'Window left', w: 1.2, h: 1, d: 0.06, style: 'ghost' }),
    M('box', 1.8, 1.3, 2.52, { label: 'Window right', w: 1.2, h: 1, d: 0.06, style: 'ghost' }),
    M('arch', 0, 0.05, 5, { label: 'Garden arch', w: 2, h: 2.5, d: 0.4 }),
    M('tree', -4, 0.05, 3, { label: 'Tree left' }), M('tree', 4.2, 0.05, -2.5, { label: 'Tree right', w: 2, h: 4.5, d: 2 }),
    M('person', 2.5, 0.05, 4, { label: 'Person (for scale)' }),
  ] }) },
  { name: 'Desk setup', build: () => ({ items: [
    M('rbox', 0, 0.7, 0, { label: 'Desk top', w: 1.6, h: 0.05, d: 0.8, bevel: 0.02, segs: 3, note: 'Walnut' }),
    ...[[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]].map(([x, z], i) => M('cylinder', x, 0, z, { label: `Desk leg ${i + 1}`, w: 0.05, h: 0.7, d: 0.05, bevel: 0 })),
    M('cylinder', 0, 0.75, -0.25, { label: 'Monitor stand', w: 0.14, h: 0.2, d: 0.14, bevel: 0.01 }),
    M('rbox', 0, 0.95, -0.25, { label: 'Monitor', w: 0.62, h: 0.36, d: 0.03, bevel: 0.01, segs: 2, style: 'dark' }),
    M('rbox', 0, 0.75, 0.05, { label: 'Keyboard', w: 0.45, h: 0.02, d: 0.15, bevel: 0.005, segs: 2 }),
    M('cylinder', 0, 0, 0.55, { label: 'Chair base', w: 0.08, h: 0.42, d: 0.08, bevel: 0 }),
    M('cylinder', 0, 0.42, 0.55, { label: 'Chair seat', w: 0.5, h: 0.08, d: 0.5, bevel: 0.03 }),
    M('rbox', 0, 0.5, 0.8, { label: 'Chair back', w: 0.45, h: 0.5, d: 0.06, bevel: 0.03, segs: 4 }),
    M('person', 1.2, 0, 0.6, { label: 'Person (for scale)' }),
  ] }) },
  { name: 'Product shot', build: () => ({ items: [
    M('box', 0, 0, -1, { label: 'Backdrop', w: 3, h: 2, d: 0.05, note: 'Soft gradient studio backdrop' }),
    M('cylinder', 0, 0, 0, { label: 'Pedestal', w: 1.2, h: 0.3, d: 1.2, bevel: 0.03 }),
    M('rbox', 0, 0.3, 0, { label: 'Phone', w: 0.38, h: 0.78, d: 0.04, bevel: 0.019, segs: 8, style: 'dark', rot: [0, 25, 0], note: 'The hero product. Glossy black glass, thin metal frame.' }),
    M('sphere', 0.42, 0.3, 0.25, { label: 'Accent ball', w: 0.22, h: 0.22, d: 0.22 }),
    M('torus', -0.4, 0.3, 0.2, { label: 'Accent ring', w: 0.3, h: 0.06, d: 0.3 }),
  ] }) },
  { name: 'Game level blockout', build: () => ({ items: [
    M('rbox', 0, 0, 0, { label: 'Start platform', w: 4, h: 0.5, d: 4, bevel: 0.05, segs: 2, note: 'Player spawns here' }),
    M('ramp', 3.5, 0, 0, { label: 'Ramp up', w: 3, h: 1.5, d: 2 }),
    M('box', 7, 0, 0, { label: 'Upper platform', w: 4, h: 1.5, d: 4 }),
    M('stairs', 7, 0, -3.25, { label: 'Side stairs', w: 1.5, h: 1.5, d: 2.5 }),
    M('zone', 7, 1.5, 0, { label: 'Enemy spawn zone', note: 'Two enemies appear when the player enters' }),
    M('arch', 8.8, 1.5, 0, { label: 'Exit gate', w: 2, h: 2.6, d: 0.4, rot: [0, 90, 0] }),
    M('cylinder', 0, 0.5, 1.5, { label: 'Pillar', w: 0.5, h: 2.5, d: 0.5, bevel: 0.04 }),
    M('person', 0, 0.5, 0, { label: 'Player (1.8 m)' }),
    M('pin', 7, 3.6, 0, { label: 'Checkpoint', note: 'Save point when the player reaches the upper platform' }),
    M('pyramid', 8.2, 1.5, 1.5, { label: 'Spike trap', w: 0.6, h: 0.5, d: 0.6, style: 'dark', note: 'Damages the player on touch' }),
  ] }) },
  { name: 'Blank scene', build: () => ({ items: [] }) },
];
