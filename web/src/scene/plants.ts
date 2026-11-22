// Dựng mô hình cây trồng low-poly theo loại cây và giai đoạn sinh trưởng.
import * as THREE from 'three';
import { IS_MOBILE } from '../perf.ts';
import type { Crop } from '../../../shared/catalog.ts';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, opts: { emissive?: number; rough?: number; transparent?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.emissive ?? ''}|${opts.rough ?? ''}|${opts.transparent ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: 0 });
    if (opts.emissive !== undefined) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = 0.6; }
    if (opts.transparent !== undefined) { m.transparent = true; m.opacity = opts.transparent; }
    matCache.set(key, m);
  }
  return m;
}

// Hình khối bo tròn, đổ bóng mịn để cảnh mềm mại hơn.
// Điện thoại, máy tính bảng dùng khối ít mặt hơn (quả cầu 80 thay vì 320 tam giác, trụ 9 cạnh): nhìn từ máy quay trên cao gần như không khác.
const LITE = IS_MOBILE;
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.IcosahedronGeometry(1, 1),
  ball: new THREE.IcosahedronGeometry(1, LITE ? 1 : 2),
  cone: new THREE.ConeGeometry(1, 1, LITE ? 8 : 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, LITE ? 9 : 14),
};
export const GEO = geo;

export function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z); o.scale.set(sx, sy, sz);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FRUIT: Record<string, number> = {
  thanh_long: 0xe8457f, nho: 0x6a3d9a, tao: 0x9bd64a, toi: 0xf3ecdf, hanh: 0xa2466f, vai: 0xd63a4a, nhan: 0xc9a66b,
  buoi: 0xd8e36a, cam: 0xf08a24, quyt: 0xf5a13a, xoai: 0xf4c430, sau_rieng: 0xa9b53d, mang_cut: 0x5b2a5e,
  chom_chom: 0xdc342b, vu_sua: 0x86c26f, khom: 0xf2b632, dua: 0x7a9a3a, chuoi: 0xf2d544, na: 0x9acb6f, man: 0x9a2d5b,
  dau_tay: 0xe2263c, hong: 0xf26a2e, bo: 0x4d7a3a, le: 0xd9d27a, ca_phe: 0xc0281e, ho_tieu: 0xc0392b, che: 0x8fdc5a,
  dieu: 0xeaa53a, mac_ca: 0x8a6a3b, que: 0xa5622f, hoi: 0xb9853f, lua: 0xe6c34a, hat_de: 0x7a4a22, mia: 0x7b3f8c,
  sen: 0xf29bc0, thot_not: 0x3d2c3f, lon_bon: 0xe8d58a, chanh: 0xa6d93a, chanh_day: 0x6a2c70, khoai_lang: 0xa3497a,
  atiso: 0x8a6fb0, mang_tay: 0x7fbf5a, ca_rot: 0xf07c1f, oi: 0xa8d66a, dau_da: 0xe8d070, hat_bang: 0xb58a4a, sim: 0x5a2a7a,
  hoa_hong: 0xe84a6a, cam_tu_cau: 0x8fb3f2, hoa_cuc: 0xffd23f, hoa_ly: 0xffb7d0, dia_lan: 0xd6a8f0, oai_huong: 0x9a7fe0,
  khoai_tay: 0xd9b77a, bap_su: 0xb7e69a, ca_chua: 0xe8412f,
};
export function fruitColor(cropId: string): number { return FRUIT[cropId] ?? 0xf2b632; }
const G1 = 0x5cb85f, G2 = 0x479c52, G3 = 0x8fd67c, TRUNK = 0x9a7150;

/** 0 mầm · 1 cây con · 2 trưởng thành · 3 chín, sẵn sàng thu hoạch */
export type Stage = 0 | 1 | 2 | 3;

function sprouts(g: THREE.Group, r: () => number, n = 6) {
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2;
    g.add(mesh(geo.cone, mat(G3), x, 0.22, z, 0.07, 0.2, 0.07));
    const leaf = mesh(geo.sphere, mat(G1), x + 0.06, 0.3, z, 0.08, 0.04, 0.08); g.add(leaf);
  }
}

function tree(g: THREE.Group, r: () => number, s: number, fruit: number | null) {
  g.add(mesh(geo.cyl, mat(TRUNK), 0, 0.1 + 0.55 * s, 0, 0.09 * s, 1.1 * s, 0.09 * s));
  const blobs: [number, number, number, number, number][] = [
    [-0.32, 1.15, 0.1, 0.5, G2], [0.34, 1.2, -0.12, 0.52, G1], [0, 1.55, 0.05, 0.56, G3], [0.05, 1.1, 0.36, 0.42, G1],
  ];
  for (const [x, y, z, rad, c] of blobs) g.add(mesh(geo.ball, mat(c), x * s, 0.1 + y * s, z * s, rad * s));
  if (fruit !== null) {
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, h = 0.9 + r() * 0.7, rad = 0.52 + r() * 0.12;
      g.add(mesh(geo.ball, mat(fruit, { rough: 0.5 }), Math.cos(a) * rad * s, 0.1 + h * s, Math.sin(a) * rad * s, 0.11 * s));
    }
  }
}

function palm(g: THREE.Group, s: number, fruit: number | null, banana: boolean) {
  const h = (banana ? 1.1 : 1.9) * s;
  const trunk = mesh(geo.cyl, mat(banana ? 0x8fae5a : 0x8a6a45), 0.05, 0.1 + h / 2, 0, 0.1 * s, h, 0.1 * s);
  trunk.rotation.z = -0.06; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = mesh(geo.sphere, mat(i % 2 ? G1 : G3), 0, 0, 0, (banana ? 0.6 : 0.75) * s, 0.05 * s, 0.2 * s);
    const pivot = new THREE.Group();
    pivot.position.set(0.08, 0.1 + h, 0); pivot.rotation.y = a; pivot.rotation.z = -0.45;
    leaf.position.x = (banana ? 0.5 : 0.65) * s; pivot.add(leaf); g.add(pivot);
  }
  if (fruit !== null) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(mesh(geo.ball, mat(fruit, { rough: 0.5 }), 0.08 + Math.cos(a) * 0.16, 0.1 + h - 0.16, Math.sin(a) * 0.16, 0.13 * s));
  }
}

function dragonFruit(g: THREE.Group, s: number, fruit: number | null) {
  g.add(mesh(geo.box, mat(0xbdb8ac), 0, 0.1 + 0.65 * s, 0, 0.16, 1.3 * s, 0.16));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pivot = new THREE.Group(); pivot.position.set(0, 0.1 + 1.3 * s, 0); pivot.rotation.y = a;
    const out = mesh(geo.box, mat(G1), 0.26 * s, 0.04, 0, 0.52 * s, 0.09, 0.09); out.rotation.z = -0.25;
    const down = mesh(geo.box, mat(G3), 0.52 * s, -0.3 * s, 0, 0.09, 0.56 * s, 0.09);
    pivot.add(out, down);
    if (fruit !== null && i % 2 === 0) pivot.add(mesh(geo.ball, mat(fruit, { rough: 0.5 }), 0.56 * s, -0.62 * s, 0, 0.13, 0.17, 0.13));
    g.add(pivot);
  }
}

function trellis(g: THREE.Group, r: () => number, s: number, fruit: number | null, cover: number) {
  const h = 1.15;
  for (const [x, z] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) g.add(mesh(geo.cyl, mat(0x9a8a70), x, 0.1 + h / 2, z, 0.05, h, 0.05));
  g.add(mesh(geo.box, mat(0x9a8a70), 0, 0.1 + h, -0.65, 1.4, 0.04, 0.04), mesh(geo.box, mat(0x9a8a70), 0, 0.1 + h, 0.65, 1.4, 0.04, 0.04));
  const n = Math.round(10 * cover);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 1.3, z = (r() - 0.5) * 1.3;
    g.add(mesh(geo.ball, mat(i % 2 ? G1 : G3), x, 0.1 + h + 0.05, z, 0.3 * s, 0.12, 0.3 * s));
    if (fruit !== null && i % 2 === 0) { const c = mesh(geo.cone, mat(fruit, { rough: 0.5 }), x, 0.1 + h - 0.22, z, 0.1, 0.3, 0.1); c.rotation.x = Math.PI; g.add(c); }
  }
  g.add(mesh(geo.cyl, mat(TRUNK), 0, 0.1 + h / 2, 0, 0.04, h, 0.04));
}

function rows(g: THREE.Group, r: () => number, s: number, fruit: number | null, shape: 'bush' | 'tuft' | 'spike' | 'cane') {
  const n = shape === 'tuft' ? 4 : 3;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i / (n - 1) - 0.5) * 1.25 + (r() - 0.5) * 0.06, z = (j / (n - 1) - 0.5) * 1.25 + (r() - 0.5) * 0.06;
    if (shape === 'bush') {
      g.add(mesh(geo.ball, mat((i + j) % 2 ? G1 : G3), x, 0.2 + 0.16 * s, z, 0.24 * s, 0.2 * s, 0.24 * s));
      if (fruit !== null) g.add(mesh(geo.ball, mat(fruit, { rough: 0.5 }), x + 0.1, 0.2 + 0.3 * s, z + 0.06, 0.07), mesh(geo.ball, mat(fruit, { rough: 0.5 }), x - 0.1, 0.2 + 0.2 * s, z - 0.1, 0.06));
    } else if (shape === 'tuft') {
      g.add(mesh(geo.cone, mat((i + j) % 2 ? G1 : G3), x, 0.18 + 0.25 * s, z, 0.06, 0.55 * s, 0.06));
      const lean = mesh(geo.cone, mat(G3), x + 0.05, 0.18 + 0.2 * s, z, 0.04, 0.45 * s, 0.04); lean.rotation.z = -0.4; g.add(lean);
      if (fruit !== null) g.add(mesh(geo.ball, mat(fruit, { rough: 0.6 }), x, 0.2, z, 0.09));
    } else if (shape === 'spike') {
      for (let k = 0; k < 5; k++) { const leaf = mesh(geo.cone, mat(k % 2 ? G2 : G1), x, 0.28 * s + 0.16, z, 0.05, 0.5 * s, 0.05); leaf.rotation.z = 0.7; leaf.rotation.y = (k / 5) * Math.PI * 2; leaf.rotation.order = 'YZX'; g.add(leaf); }
      if (fruit !== null) g.add(mesh(geo.cyl, mat(fruit, { rough: 0.6 }), x, 0.42, z, 0.09, 0.2, 0.09), mesh(geo.cone, mat(G3), x, 0.6, z, 0.06, 0.16, 0.06));
    } else {
      g.add(mesh(geo.cyl, mat(fruit ?? 0x9ec26a), x, 0.15 + 0.7 * s, z, 0.04, 1.4 * s, 0.04), mesh(geo.cone, mat(G3), x, 0.2 + 1.45 * s, z, 0.14, 0.4 * s, 0.14));
    }
  }
}

function rice(g: THREE.Group, r: () => number, s: number, ripe: boolean) {
  g.add(mesh(geo.box, mat(0x5b8fb0, { rough: 0.2, transparent: 0.75 }), 0, 0.2, 0, 1.6, 0.03, 1.6));
  const n = 70;
  const blades = new THREE.InstancedMesh(geo.cone, mat(ripe ? 0xe0c04a : 0x67b85a), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    e.set((r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3); q.setFromEuler(e);
    const h = (0.35 + r() * 0.2) * s + 0.1;
    m.compose(new THREE.Vector3((r() - 0.5) * 1.5, 0.2 + h / 2, (r() - 0.5) * 1.5), q, new THREE.Vector3(0.035, h, 0.035));
    blades.setMatrixAt(i, m);
  }
  blades.castShadow = true; g.add(blades);
}

function lotus(g: THREE.Group, r: () => number, s: number, bloom: boolean) {
  g.add(mesh(geo.box, mat(0x4f8fae, { rough: 0.2, transparent: 0.8 }), 0, 0.2, 0, 1.6, 0.03, 1.6));
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * 1.3, z = (r() - 0.5) * 1.3;
    g.add(mesh(geo.cyl, mat(i % 2 ? G1 : G3), x, 0.23, z, 0.2 * s, 0.02, 0.2 * s));
    if (bloom && i % 2 === 0) g.add(mesh(geo.cyl, mat(G2), x, 0.4, z, 0.015, 0.36, 0.015), mesh(geo.cone, mat(FRUIT.sen, { rough: 0.5 }), x, 0.64, z, 0.1, 0.18, 0.1));
  }
}

/** Luống hoa: thân xanh, khi nở thì mỗi cây một bông đúng màu của loài. */
function flowers(g: THREE.Group, r: () => number, s: number, bloom: number | null, id: string) {
  const big = id === 'cam_tu_cau', spike = id === 'oai_huong', n = big ? 3 : 4;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i / (n - 1) - 0.5) * 1.25 + (r() - 0.5) * 0.08, z = (j / (n - 1) - 0.5) * 1.25 + (r() - 0.5) * 0.08, h = (big ? 0.42 : 0.55) * s;
    g.add(mesh(geo.cyl, mat(G2), x, 0.2 + h / 2, z, 0.025, h, 0.025), mesh(geo.sphere, mat((i + j) % 2 ? G1 : G3), x, 0.24 + h * 0.4, z, 0.16 * s, 0.07, 0.16 * s));
    if (bloom === null) { g.add(mesh(geo.ball, mat(G3), x, 0.22 + h, z, 0.06)); continue; }
    if (spike) g.add(mesh(geo.cone, mat(bloom, { rough: 0.5 }), x, 0.3 + h, z, 0.07, 0.34, 0.07));
    else if (big) g.add(mesh(geo.ball, mat(bloom, { rough: 0.5 }), x, 0.3 + h, z, 0.24, 0.2, 0.24));
    else g.add(mesh(geo.ball, mat(bloom, { rough: 0.5 }), x, 0.25 + h, z, 0.13, 0.1, 0.13), mesh(geo.ball, mat(id === 'hoa_cuc' ? 0xb5651d : 0xfff3c4), x, 0.3 + h, z, 0.05));
  }
}

function bed(g: THREE.Group, wet: boolean) {
  g.add(mesh(geo.box, mat(wet ? 0x6a4a36 : 0x7d553a), 0, 0.14, 0, 1.72, 0.1, 1.72));
  if (!wet) for (const z of [-0.5, 0, 0.5]) g.add(mesh(geo.box, mat(0x8f6444), 0, 0.2, z, 1.6, 0.05, 0.22));
}

export function buildPlant(crop: Crop, stage: Stage, seed: number): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const id = crop.id;
  const water = id === 'lua' || id === 'sen';
  bed(g, water);
  const fruit = stage === 3 ? FRUIT[id] ?? 0xf2b632 : null;
  const s = stage === 1 ? 0.6 : stage === 2 ? 0.88 : 1;
  if (id === 'lua') { rice(g, r, stage === 0 ? 0.3 : s, stage === 3); return g; }
  if (id === 'sen') { lotus(g, r, stage === 0 ? 0.4 : s, stage >= 2); return g; }
  if (stage === 0) { sprouts(g, r); return g; }
  if (crop.kind === 'hoa') { flowers(g, r, s, fruit, id); return g; }
  if (id === 'thanh_long') dragonFruit(g, s, fruit);
  else if (id === 'ho_tieu') {
    g.add(mesh(geo.cyl, mat(0x8a7a60), 0, 0.1 + 0.8 * s, 0, 0.07, 1.6 * s, 0.07), mesh(geo.cyl, mat(G1), 0, 0.15 + 0.75 * s, 0, 0.26 * s, 1.4 * s, 0.26 * s));
    g.add(mesh(geo.ball, mat(G3), 0, 0.2 + 1.5 * s, 0, 0.3 * s));
    if (fruit !== null) for (let i = 0; i < 8; i++) { const a = r() * 6.28; g.add(mesh(geo.ball, mat(fruit, { rough: 0.5 }), Math.cos(a) * 0.27, 0.4 + r() * 1.0, Math.sin(a) * 0.27, 0.05, 0.12, 0.05)); }
  } else if (crop.kind === 'leo') trellis(g, r, s, fruit, stage === 1 ? 0.5 : 1);
  else if (id === 'dua' || id === 'thot_not') palm(g, s, fruit, false);
  else if (id === 'chuoi') palm(g, s, fruit, true);
  else if (id === 'khom') rows(g, r, s, fruit, 'spike');
  else if (id === 'mia') rows(g, r, s, stage === 3 ? FRUIT.mia : null, 'cane');
  else if (id === 'che') {
    for (const z of [-0.5, 0, 0.5]) g.add(mesh(geo.ball, mat(z ? G1 : G2), 0, 0.2 + 0.2 * s, z, 0.78, 0.3 * s, 0.22));
    if (fruit !== null) for (let i = 0; i < 10; i++) g.add(mesh(geo.ball, mat(fruit), (r() - 0.5) * 1.3, 0.24 + 0.42 * s, (Math.floor(r() * 3) - 1) * 0.5, 0.06));
  }
  else if (crop.kind === 'cu') rows(g, r, s, fruit, 'tuft');
  else if (crop.kind === 'ngan') rows(g, r, s, fruit, 'bush');
  else if (id === 'ca_phe') {
    g.add(mesh(geo.cyl, mat(TRUNK), 0, 0.1 + 0.3 * s, 0, 0.05, 0.6 * s, 0.05));
    g.add(mesh(geo.ball, mat(G2), 0, 0.15 + 0.6 * s, 0, 0.55 * s, 0.45 * s, 0.55 * s), mesh(geo.ball, mat(G1), 0.1, 0.2 + 0.95 * s, 0, 0.38 * s));
    if (fruit !== null) for (let i = 0; i < 12; i++) { const a = r() * 6.28; g.add(mesh(geo.ball, mat(fruit, { rough: 0.5 }), Math.cos(a) * 0.5 * s, 0.3 + r() * 0.6, Math.sin(a) * 0.5 * s, 0.055)); }
  } else tree(g, r, s, fruit);
  return g;
}
