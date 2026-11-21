// Màn lái xe tải và lái tàu giữa hai vùng trồng: cảnh trôi về phía người chơi, né chướng ngại, tới đích thì xong.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { REGIONS } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';

export type Mode = 'truck' | 'boat';
export interface DriveOptions {
  fromRegionId: string; toRegionId: string; seconds: number; needsBoat: boolean; truckColor: string;
  onTick?: (t: { progress: number; kmh: number; mode: Mode }) => void;
  onBump?: (text: string) => void;
  onLeg?: (mode: Mode) => void;
  onArrive?: () => void;
}

const BASE = 22;          // tốc độ chuẩn (đơn vị/giây)
const AHEAD = 150;        // tầm nhìn phía trước
const ROAD_HALF = 4.4, SEA_HALF = 7.5;
const SEG = 3, SEGS = 62;

const roadX = (s: number) => 6 * Math.sin(s * 0.012) + 3.2 * Math.sin(s * 0.031 + 1);
const roadDX = (s: number) => 0.072 * Math.cos(s * 0.012) + 0.0992 * Math.cos(s * 0.031 + 1);

interface Theme { ground: number; road: number; kinds: string[]; mountains: number | null }
const THEMES: Record<Zone, Theme> = {
  bac: { ground: 0xa9d672, road: 0x9aa1ab, kinds: ['leaf', 'leaf', 'house', 'rice', 'rock', 'pole', 'leaf'], mountains: 0xa9cbbd },
  trung: { ground: 0xd6dc94, road: 0x9aa1ab, kinds: ['leaf', 'dune', 'house', 'palm', 'pole', 'dune', 'rock'], mountains: 0xc9d3b4 },
  taynguyen: { ground: 0xb4cf78, road: 0xdc9a78, kinds: ['pine', 'pine', 'bush', 'house', 'pole', 'pine', 'rock'], mountains: 0x9cc79a },
  nam: { ground: 0xa4d977, road: 0xa3aab4, kinds: ['palm', 'palm', 'rice', 'pond', 'house', 'pole', 'rice'], mountains: null },
  dao: { ground: 0xf0e3b4, road: 0xe6d3a0, kinds: ['palm', 'palm', 'rock', 'house', 'palm', 'pole', 'dune'], mountains: null },
};
const SEA_KINDS = ['islet', 'ghe', 'islet', 'seastone'];

/** Gộp các khối cùng chất liệu thành một lưới (bản rút gọn, đủ dùng cho vật trang trí). */
function bake(root: THREE.Group, shadow = false): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    const k = m.material as THREE.Material; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) { const m = new THREE.Mesh(mergeGeometries(geos, false), material); m.castShadow = shadow; m.receiveShadow = false; out.add(m); }
  return out;
}
function gradient(top: number, bottom: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#' + new THREE.Color(top).getHexString()); grad.addColorStop(0.6, '#' + new THREE.Color(bottom).getHexString());
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeSign(text: string, bg: string, fg = '#ffffff'): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!; g.font = '800 50px "Baloo 2", "Be Vietnam Pro", sans-serif';
  const w = Math.min(496, g.measureText(text).width + 60);
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect((512 - w) / 2 - 6, 8, w + 12, 112, 22); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect((512 - w) / 2, 14, w, 100, 18); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66, 460);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(7, 1.75, 1); return sp;
}

// ---------------------------------------------------------------- mô hình
function wheel(x: number, z: number, r = 0.42): THREE.Mesh { const w = mesh(GEO.cyl, mat(0x3a3f4a), x, r, z, r, 0.3, r); w.rotation.z = Math.PI / 2; return w; }
function buildTruck(color: number, cargo = true): THREE.Group {
  const g = new THREE.Group(), body = mat(color), dark = mat(0x4a5160);
  g.add(mesh(GEO.box, dark, 0, 0.62, 0.3, 1.9, 0.3, 4.1));
  g.add(mesh(GEO.box, body, 0, 1.45, -1.35, 1.9, 1.4, 1.3), mesh(GEO.box, body, 0, 1.0, -2.1, 1.9, 0.6, 0.5));
  g.add(mesh(GEO.box, mat(0xbfe6f7, { rough: 0.3 }), 0, 1.75, -2.02, 1.6, 0.6, 0.06), mesh(GEO.box, mat(0xfff6dc), 0, 2.2, -1.35, 1.7, 0.1, 1.1));
  g.add(mesh(GEO.box, mat(0xe9d2a6), 0, 1.15, 0.95, 2.0, 0.8, 2.7), mesh(GEO.box, mat(0xc9a877), 0, 1.6, 0.95, 2.1, 0.12, 2.8));
  if (cargo) {
    const cols = [0xe8457f, 0xf4c430, 0xf08a24, 0x9bd64a, 0x6a3d9a, 0xdc342b];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) g.add(mesh(GEO.ball, mat(cols[(i + j) % cols.length], { rough: 0.5 }), -0.6 + i * 0.6, 1.85 + ((i + j) % 2) * 0.12, 0 + j * 0.62, 0.3));
  }
  for (const [x, z] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.4], [0.95, 1.4]]) g.add(wheel(x, z));
  g.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), -0.6, 0.95, -2.37, 0.14), mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0.6, 0.95, -2.37, 0.14));
  g.add(mesh(GEO.box, mat(0xe0342b), -0.7, 0.95, 2.32, 0.3, 0.16, 0.06), mesh(GEO.box, mat(0xe0342b), 0.7, 0.95, 2.32, 0.3, 0.16, 0.06));
  return g;
}
function buildBoat(color: number): THREE.Group {
  const g = new THREE.Group(), wood = mat(0xc98a52), dark = mat(0x9a6238);
  g.add(mesh(GEO.box, wood, 0, 0.35, 0.4, 3.0, 0.9, 6.2), mesh(GEO.box, dark, 0, 0.82, 0.4, 3.2, 0.14, 6.4));
  const bow = mesh(GEO.cone, wood, 0, 0.35, -3.6, 1.5, 2.2, 0.45); bow.rotation.x = -Math.PI / 2; g.add(bow);
  g.add(mesh(GEO.box, mat(0x6fb7d9), 0, 0.2, 0.4, 3.06, 0.3, 6.25), mesh(GEO.box, mat(0xfff6dc), 0, 1.6, 2.9, 2.0, 1.4, 1.2), mesh(GEO.box, mat(0xf08a6c), 0, 2.4, 2.9, 2.3, 0.14, 1.5));
  g.add(mesh(GEO.cyl, dark, 0, 2.2, -2.6, 0.05, 2.6, 0.05), mesh(GEO.box, mat(0xe0342b), 0.42, 3.2, -2.6, 0.8, 0.5, 0.04), mesh(GEO.ball, mat(0xffd23f), 0.42, 3.2, -2.56, 0.13));
  const t = buildTruck(color); t.scale.setScalar(0.62); t.position.set(0, 0.55, -0.4); g.add(t);
  return g;
}

type Prefab = () => THREE.Group;
const SCENERY: Record<string, Prefab> = {
  leaf: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 0.9, 0, 0.2, 1.8, 0.2), mesh(GEO.ball, mat(0x5cb85f), -0.5, 2.3, 0.1, 1.1), mesh(GEO.ball, mat(0x79c96d), 0.6, 2.4, -0.1, 1.15), mesh(GEO.ball, mat(0x9bdc84), 0, 3.2, 0.1, 1.2)); return g; },
  pine: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 0.7, 0, 0.18, 1.4, 0.18)); for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(i % 2 ? 0x4f9f6a : 0x66b47c), 0, 1.8 + i * 1.0, 0, 1.4 - i * 0.33, 1.7, 1.4 - i * 0.33)); return g; },
  palm: () => { const g = new THREE.Group(), h = 4.2; const t = mesh(GEO.cyl, mat(0xa98a62), 0.15, h / 2, 0, 0.16, h, 0.16); t.rotation.z = -0.08; g.add(t); for (let i = 0; i < 7; i++) { const p = new THREE.Group(); p.position.set(0.32, h, 0); p.rotation.y = (i / 7) * 6.28; p.rotation.z = -0.5; p.add(mesh(GEO.sphere, mat(i % 2 ? 0x5cb85f : 0x8fd67c), 1.05, 0, 0, 1.2, 0.07, 0.32)); g.add(p); } return g; },
  house: () => { const g = new THREE.Group(), roofs = [0xf08a6c, 0x6fb7d9, 0xf2b25c, 0xa98bd6]; const c = roofs[Math.floor(Math.random() * roofs.length)]; g.add(mesh(GEO.box, mat(0xfff6e2), 0, 1.1, 0, 3.6, 2.2, 2.8)); const r = mesh(new THREE.CylinderGeometry(0.01, 2.4, 1.5, 4, 1), mat(c), 0, 2.95, 0, 1.2, 1, 0.95); r.rotation.y = Math.PI / 4; g.add(r, mesh(GEO.box, mat(0x9a7150), 0, 0.8, 1.42, 0.7, 1.4, 0.06), mesh(GEO.box, mat(0xa9dcf2), -1.1, 1.3, 1.42, 0.6, 0.6, 0.06)); return g; },
  rice: () => { const g = new THREE.Group(), gold = Math.random() < 0.4; g.add(mesh(GEO.box, mat(gold ? 0xe6cf6a : 0x8fd67c), 0, 0.06, 0, 7, 0.1, 5), mesh(GEO.box, mat(0xc9b98a), 0, 0.08, 0, 7.3, 0.06, 0.2), mesh(GEO.box, mat(0xc9b98a), 0, 0.08, 2.5, 7.3, 0.06, 0.2)); for (let i = 0; i < 6; i++) g.add(mesh(GEO.box, mat(gold ? 0xd9bd4e : 0x79c96d), -3 + i * 1.2, 0.16, 0, 0.3, 0.14, 4.6)); return g; },
  rock: () => { const g = new THREE.Group(); g.add(mesh(GEO.sphere, mat(0xb9c0c4), 0, 0.6, 0, 1.3, 0.9, 1.1), mesh(GEO.sphere, mat(0xa3acb2), 1.0, 0.4, 0.4, 0.8, 0.55, 0.7)); return g; },
  pole: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0xb9b2a4), 0, 2.6, 0, 0.1, 5.2, 0.1), mesh(GEO.box, mat(0xb9b2a4), 0, 4.8, 0, 1.6, 0.1, 0.1), mesh(GEO.ball, mat(0x6b7280), -0.7, 4.95, 0, 0.09), mesh(GEO.ball, mat(0x6b7280), 0.7, 4.95, 0, 0.09)); return g; },
  dune: () => { const g = new THREE.Group(); g.add(mesh(GEO.ball, mat(0xf3e3ae), 0, -0.4, 0, 4.2, 1.5, 3.2), mesh(GEO.ball, mat(0xead596), 2.6, -0.5, 1.2, 2.6, 1.1, 2.2), mesh(GEO.cone, mat(0x8fd67c), -1, 1.1, 0.5, 0.12, 0.6, 0.12)); return g; },
  bush: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.add(mesh(GEO.ball, mat((i + j) % 2 ? 0x479c52 : 0x5cb85f), -1.6 + i * 1.6, 0.5, -0.8 + j * 1.6, 0.7, 0.6, 0.7), mesh(GEO.ball, mat(0xc0281e), -1.4 + i * 1.6, 0.9, -0.6 + j * 1.6, 0.09)); return g; },
  pond: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x8fd8ea, { rough: 0.25 }), 0, 0.05, 0, 3.2, 0.08, 2.4), mesh(GEO.cyl, mat(0x5cb85f), 1, 0.1, 0.5, 0.5, 0.03, 0.5), mesh(GEO.cone, mat(0xf29bc0), 1, 0.3, 0.5, 0.14, 0.3, 0.14), mesh(GEO.cyl, mat(0x5cb85f), -1.2, 0.1, -0.6, 0.4, 0.03, 0.4)); return g; },
  islet: () => { const g = new THREE.Group(); g.add(mesh(GEO.ball, mat(0xf0e3b4), 0, -0.2, 0, 4, 1.0, 3.2), mesh(GEO.ball, mat(0xa9d672), 0.3, 0.5, 0, 2.6, 1.0, 2.0)); const p = SCENERY.palm(); p.position.set(0.5, 1.0, 0); p.scale.setScalar(0.8); g.add(p); return g; },
  ghe: () => { const g = new THREE.Group(), c = [0x6fb7d9, 0xf08a6c, 0x8fd67c][Math.floor(Math.random() * 3)]; g.add(mesh(GEO.box, mat(c), 0, 0.3, 0, 1.5, 0.7, 4), mesh(GEO.box, mat(0xfff6dc), 0, 0.72, 0, 1.6, 0.1, 4.1), mesh(GEO.cyl, mat(0x9a6238), 0, 1.6, 0.3, 0.05, 2, 0.05), mesh(GEO.box, mat(0xfff6dc), 0.02, 1.8, -0.4, 0.04, 1.3, 1.2)); return g; },
  seastone: () => { const g = new THREE.Group(); g.add(mesh(GEO.sphere, mat(0x8f9aa3), 0, 0.3, 0, 1.6, 1.2, 1.3), mesh(GEO.sphere, mat(0xa3acb2), 1.2, 0.1, 0.5, 0.9, 0.7, 0.8)); return g; },
};

interface ObsDef { build: Prefab; hw: number; hl: number; vs: number; mode: Mode; pickup?: boolean; wander?: number }
const OBSTACLES: Record<string, ObsDef> = {
  xemay: { mode: 'truck', hw: 0.6, hl: 1.0, vs: 9, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.box, mat(0xe0342b), 0, 0.6, 0, 0.4, 0.4, 1.5), wheel(0, -0.7, 0.32), wheel(0, 0.7, 0.32), mesh(GEO.cyl, mat(0x5aa9e6), 0, 1.25, -0.1, 0.26, 0.7, 0.22), mesh(GEO.ball, mat(0xf6cfa8), 0, 1.8, -0.1, 0.24), mesh(new THREE.ConeGeometry(0.42, 0.24, 10), mat(0xf2dc9a), 0, 2.05, -0.1), mesh(GEO.box, mat(0xc9975a), 0, 1.1, 0.75, 1.0, 0.7, 0.7), mesh(GEO.ball, mat(0xf4c430), -0.2, 1.55, 0.75, 0.2), mesh(GEO.ball, mat(0x9bd64a), 0.2, 1.55, 0.8, 0.2)); return g; } },
  xebo: { mode: 'truck', hw: 1.1, hl: 2.0, vs: 3.5, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.box, mat(0xb9855a), 0, 0.9, 1.0, 1.9, 0.5, 2.2), wheel(-1.0, 1.0, 0.6), wheel(1.0, 1.0, 0.6), mesh(GEO.ball, mat(0xf6d77a), 0, 1.5, 1.0, 0.9, 0.6, 1.0), mesh(GEO.ball, mat(0x6b5a4a), 0, 1.0, -1.3, 0.6, 0.6, 1.0), mesh(GEO.ball, mat(0x6b5a4a), 0, 1.3, -2.2, 0.36), mesh(GEO.cone, mat(0xf3ecdf), -0.3, 1.65, -2.2, 0.07, 0.4, 0.07), mesh(GEO.cone, mat(0xf3ecdf), 0.3, 1.65, -2.2, 0.07, 0.4, 0.07)); for (const [x, z] of [[-0.35, -1.7], [0.35, -1.7], [-0.35, -0.9], [0.35, -0.9]]) g.add(mesh(GEO.cyl, mat(0x5a4a3a), x, 0.3, z, 0.1, 0.6, 0.1)); return g; } },
  oga: { mode: 'truck', hw: 0.95, hl: 0.9, vs: 0, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x5b606b), 0, 0.03, 0, 1.0, 0.04, 0.8), mesh(GEO.cyl, mat(0x7a5a44), 0.1, 0.05, 0, 0.7, 0.04, 0.5)); return g; } },
  nguoc: { mode: 'truck', hw: 1.05, hl: 2.3, vs: -11, build: () => { const t = buildTruck([0x6fb7d9, 0xf2b25c, 0xa98bd6][Math.floor(Math.random() * 3)], false); t.rotation.y = Math.PI; const g = new THREE.Group(); g.add(t); return g; } },
  ga: { mode: 'truck', hw: 0.45, hl: 0.45, vs: 0, wander: 3.2, build: () => { const g = new THREE.Group(), c = mat(0xffffff); g.add(mesh(GEO.ball, c, 0, 0.36, 0, 0.3, 0.28, 0.36), mesh(GEO.ball, c, 0.26, 0.66, 0, 0.17), mesh(GEO.cone, mat(0xffa51e), 0.44, 0.64, 0, 0.05, 0.13, 0.05), mesh(GEO.box, mat(0xe0342b), 0.26, 0.86, 0, 0.14, 0.12, 0.05)); (g.children[2] as THREE.Mesh).rotation.z = -Math.PI / 2; return g; } },
  xang: { mode: 'truck', hw: 0.9, hl: 0.9, vs: 0, pickup: true, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.box, mat(0xffcf3a, { emissive: 0xffa800 }), 0, 1.0, 0, 0.7, 0.9, 0.4), mesh(GEO.box, mat(0xd9482b), 0.15, 1.55, 0, 0.2, 0.2, 0.2)); return g; } },
  da: { mode: 'boat', hw: 1.4, hl: 1.2, vs: 0, build: () => SCENERY.seastone() },
  phao: { mode: 'boat', hw: 0.6, hl: 0.6, vs: 0, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0xe0342b), 0, 0.35, 0, 0.55, 0.6, 0.55), mesh(GEO.cyl, mat(0xffffff), 0, 0.75, 0, 0.45, 0.2, 0.45), mesh(GEO.cone, mat(0xe0342b), 0, 1.15, 0, 0.3, 0.6, 0.3)); return g; } },
  thung: { mode: 'boat', hw: 0.95, hl: 0.95, vs: 0, wander: 1.4, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x3f6f9a), 0, 0.3, 0, 0.95, 0.5, 0.95), mesh(GEO.cyl, mat(0x6fb7d9), 0, 0.5, 0, 0.82, 0.12, 0.82), mesh(GEO.cyl, mat(0x8a5a3c), 0, 1.0, 0, 0.26, 0.7, 0.22), mesh(GEO.ball, mat(0xf6cfa8), 0, 1.55, 0, 0.24), mesh(new THREE.ConeGeometry(0.44, 0.24, 10), mat(0xf2dc9a), 0, 1.8, 0)); return g; } },
  song: { mode: 'boat', hw: 3.2, hl: 0.8, vs: -3, build: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(mesh(GEO.ball, mat(i % 2 ? 0xffffff : 0xbfe9f5, { rough: 0.3 }), -2.6 + i * 1.05, 0.25, (i % 2) * 0.25, 0.75, 0.55, 0.6)); return g; } },
  thungdau: { mode: 'boat', hw: 0.9, hl: 0.9, vs: 0, pickup: true, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0xffcf3a, { emissive: 0xffa800 }), 0, 0.6, 0, 0.45, 0.9, 0.45)); return g; } },
};

interface Item { obj: THREE.Group; kind: string; s: number; x: number; active: boolean; hit?: boolean; vx?: number }
interface Leg { mode: Mode; start: number; end: number; zoneA: Zone; zoneB: Zone }

export class DriveScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.5, 400);
  private clock = new THREE.Clock();
  private sun: THREE.DirectionalLight;
  private truck: THREE.Group; private boat: THREE.Group;
  private wheels: THREE.Object3D[] = [];
  private road: THREE.Mesh; private edgeL: THREE.Mesh; private edgeR: THREE.Mesh;
  private ground: THREE.Mesh; private sea: THREE.Mesh;
  private dashes: THREE.Mesh[] = []; private buoys: THREE.Group[] = [];
  private mountains = new THREE.Group();
  private scenery: Item[] = []; private obstacles: Item[] = [];
  private plan: { s: number; kind: string; x: number }[] = []; private planIdx = 0;
  private signs: { sp: THREE.Group; s: number }[] = [];
  private gate = new THREE.Group(); private pier = new THREE.Group(); private island = new THREE.Group();
  private sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private legs: Leg[] = []; private legIdx = 0;
  private L: number; private dist = 0; private speed = 0; private px = 0; private pv = 0;
  private nextScenery = 10; private r = rng(20261121);
  private running = false; private arrived = false; private pause = 0; private slow = 0; private boost = 0; private shake = 0; private elapsed = 0; private tickAcc = 0;
  private keys = new Set<string>(); private drag: { id: number; x: number; px: number } | null = null; private target: number | null = null;
  private cleanup: (() => void)[] = []; private ro: ResizeObserver; private disposed = false;
  private container: HTMLElement; private opts: DriveOptions;

  constructor(container: HTMLElement, opts: DriveOptions) {
    this.container = container; this.opts = opts;
    this.L = BASE * Math.max(10, opts.seconds);
    const zf = REGIONS[opts.fromRegionId]?.zone ?? 'nam', zt = REGIONS[opts.toRegionId]?.zone ?? 'nam';
    if (!opts.needsBoat) this.legs = [{ mode: 'truck', start: 0, end: this.L, zoneA: zf, zoneB: zt }];
    else if (REGIONS[opts.fromRegionId]?.island) this.legs = [{ mode: 'boat', start: 0, end: this.L * 0.5, zoneA: 'dao', zoneB: 'dao' }, { mode: 'truck', start: this.L * 0.5, end: this.L, zoneA: zt, zoneB: zt }];
    else this.legs = [{ mode: 'truck', start: 0, end: this.L * 0.5, zoneA: zf, zoneB: zf === 'taynguyen' || zf === 'bac' ? 'trung' : zf }, { mode: 'boat', start: this.L * 0.5, end: this.L, zoneA: 'dao', zoneB: 'dao' }];

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    const el = this.renderer.domElement; el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none';
    container.appendChild(el);
    this.scene.background = gradient(0x8fd0f5, 0xdff3fb); this.scene.fog = new THREE.Fog(0xdff3fb, 70, AHEAD + 10);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.1); this.sun.position.set(10, 22, 8); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 30, bottom: -12, near: 1, far: 70 }); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 4;
    this.scene.add(new THREE.HemisphereLight(0xfafcff, 0xd6e6b0, 1.35), this.sun, this.sun.target);

    // Nền đất, mặt biển, đường
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: THEMES[zf].ground, roughness: 1 }));
    this.ground.position.set(0, -0.05, -150); this.ground.receiveShadow = true;
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7fd3e8, roughness: 0.25, metalness: 0.05 }));
    this.sea.position.set(0, -0.04, -150); this.sea.receiveShadow = true;
    const strip = (color: number, y: number) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 6), 3)); const idx: number[] = []; for (let i = 0; i < SEGS; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); g.setIndex(idx); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95 })); m.position.y = y; m.receiveShadow = true; m.frustumCulled = false; return m; };
    this.road = strip(THEMES[zf].road, 0.0); this.edgeL = strip(0xfbf3df, 0.012); this.edgeR = strip(0xfbf3df, 0.012);
    this.scene.add(this.ground, this.sea, this.road, this.edgeL, this.edgeR, this.mountains);
    for (let i = 0; i < 26; i++) { const d = mesh(GEO.box, mat(0xffffff), 0, 0.03, 0, 0.22, 0.02, 2.4); d.castShadow = false; this.dashes.push(d); this.scene.add(d); }
    for (let i = 0; i < 24; i++) { const b = bake(OBSTACLES.phao.build()); b.scale.setScalar(0.7); this.buoys.push(b); this.scene.add(b); }
    for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225, h = 26 + this.r() * 26; const m = mesh(new THREE.ConeGeometry(22 + this.r() * 16, h, 7), mat(0xa9cbbd, { rough: 1 }), Math.sin(a) * 210, h / 2 - 3, -150 - Math.cos(a) * 60); m.castShadow = false; this.mountains.add(m); }
    // Đảo đích (chặng tàu), cầu tàu, cổng chào
    this.island.add(mesh(GEO.ball, mat(0xf0e3b4), 0, -1, 0, 34, 3, 20), mesh(GEO.ball, mat(0xa9d672), 0, 0, -4, 26, 5, 14), mesh(GEO.cone, mat(0x9cc79a, { rough: 1 }), -8, 7, -8, 10, 14, 10), mesh(GEO.cone, mat(0xa9cbbd, { rough: 1 }), 9, 5, -7, 8, 10, 8));
    for (let i = 0; i < 6; i++) { const p = SCENERY.palm(); p.position.set(-14 + i * 5.5, 1.6, 2 + (i % 2) * 2); this.island.add(p); }
    for (let i = 0; i < 3; i++) { const h = SCENERY.house(); h.position.set(-9 + i * 9, 2.4, -1); this.island.add(h); }
    const islandBaked = bake(this.island); this.island = islandBaked; this.scene.add(this.island);
    const pier = new THREE.Group(); pier.add(mesh(GEO.box, mat(0xc98a52), 0, 0.3, 0, 7, 0.3, 12)); for (const x of [-3.2, 3.2]) for (let z = -5; z <= 5; z += 2.5) pier.add(mesh(GEO.cyl, mat(0x9a6238), x, 0.1, z, 0.18, 1.6, 0.18));
    this.pier = bake(pier); this.scene.add(this.pier);
    const gate = new THREE.Group(); for (const x of [-5.4, 5.4]) gate.add(mesh(GEO.box, mat(0xb9855a), x, 2.6, 0, 0.5, 5.2, 0.5)); gate.add(mesh(GEO.box, mat(0xf08a6c), 0, 5.4, 0, 12.4, 0.5, 0.9));
    this.gate = bake(gate); const gl = makeSign(`Chào mừng tới ${REGIONS[opts.toRegionId]?.name ?? ''}`, '#f08a6c'); gl.position.set(0, 6.9, 0); gl.scale.set(11, 2.75, 1); this.gate.add(gl); this.scene.add(this.gate);
    const toName = REGIONS[opts.toRegionId]?.name ?? '';
    for (const s of [45, this.L * 0.3, this.L * 0.72]) { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x8f97a3), 0, 1.6, 0, 0.09, 3.2, 0.09)); const sp = makeSign(`↑ ${toName}`, '#3f8fd6'); sp.position.y = 3.6; sp.scale.set(5.6, 1.4, 1); g.add(sp); this.signs.push({ sp: g, s }); this.scene.add(g); }

    // Xe, tàu
    const color = new THREE.Color(opts.truckColor || '#f08a6c').getHex();
    this.truck = buildTruck(color); this.boat = buildBoat(color);
    this.truck.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry === GEO.cyl && Math.abs(o.rotation.z - Math.PI / 2) < 0.01) this.wheels.push(o); });
    this.scene.add(this.truck, this.boat);
    // Bể vật trang trí và chướng ngại
    for (const kind of Object.keys(SCENERY)) for (let i = 0; i < (kind === 'pole' ? 5 : 7); i++) { const obj = bake(SCENERY[kind]()); obj.visible = false; this.scene.add(obj); this.scenery.push({ obj, kind, s: -1e9, x: 0, active: false }); }
    for (const kind of Object.keys(OBSTACLES)) for (let i = 0; i < 4; i++) { const obj = bake(OBSTACLES[kind].build(), true); obj.visible = false; this.scene.add(obj); this.obstacles.push({ obj, kind, s: -1e9, x: 0, active: false }); }
    for (let i = 0; i < 22; i++) { const m = mesh(GEO.ball, mat(0xffffff), 0, -10, 0, 0.12); m.castShadow = false; m.visible = false; this.scene.add(m); this.sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }
    this.makePlan();
    this.bindInput(el);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.applyLeg(true);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private makePlan() {
    const r = rng(7 + Math.round(this.L));
    for (const leg of this.legs) {
      const kinds = Object.keys(OBSTACLES).filter((k) => OBSTACLES[k].mode === leg.mode && !OBSTACLES[k].pickup), pick = Object.keys(OBSTACLES).find((k) => OBSTACLES[k].mode === leg.mode && OBSTACLES[k].pickup)!;
      const half = (leg.mode === 'truck' ? ROAD_HALF : SEA_HALF) - 1.1;
      let s = leg.start + 55, n = 0;
      while (s < leg.end - 60) {
        const kind = n % 6 === 4 ? pick : kinds[Math.floor(r() * kinds.length)];
        let x = (r() * 2 - 1) * half;
        if (kind === 'nguoc') x = -half * (0.35 + r() * 0.6);
        if (kind === 'xemay' || kind === 'xebo') x = half * (0.15 + r() * 0.8);
        if (kind === 'song') x = (r() < 0.5 ? -1 : 1) * (SEA_HALF - 3.3);
        this.plan.push({ s, kind, x }); s += 17 + r() * 13; n++;
      }
    }
  }

  private bindInput(el: HTMLCanvasElement) {
    const on = (t: EventTarget, type: string, fn: (e: any) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); this.cleanup.push(() => t.removeEventListener(type, fn, o)); };
    on(el, 'pointerdown', (e: PointerEvent) => { if (this.drag) return; try { el.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } this.drag = { id: e.pointerId, x: e.clientX, px: this.px }; });
    on(el, 'pointermove', (e: PointerEvent) => { const d = this.drag; if (!d || d.id !== e.pointerId) return; const half = this.half(); this.target = THREE.MathUtils.clamp(d.px + ((e.clientX - d.x) / Math.max(200, this.container.clientWidth)) * half * 3.2, -half, half); });
    const end = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) { this.drag = null; this.target = null; } };
    on(el, 'pointerup', end); on(el, 'pointercancel', end);
    on(window, 'keydown', (e: KeyboardEvent) => { if (/^(ArrowLeft|ArrowRight|KeyA|KeyD)$/.test(e.code)) { this.keys.add(e.code); e.preventDefault(); } });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
  }

  private leg(): Leg { return this.legs[this.legIdx]; }
  private half(): number { return (this.leg().mode === 'truck' ? ROAD_HALF : SEA_HALF) - 1.0; }
  private zoneAt(s: number): Zone { const l = this.legs.find((x) => s < x.end) ?? this.legs[this.legs.length - 1]; return (s - l.start) / (l.end - l.start) < 0.5 ? l.zoneA : l.zoneB; }

  private applyLeg(first = false) {
    const leg = this.leg(), boat = leg.mode === 'boat';
    this.truck.visible = !boat; this.boat.visible = boat;
    this.road.visible = this.edgeL.visible = this.edgeR.visible = !boat; this.ground.visible = !boat;
    for (const d of this.dashes) d.visible = !boat; for (const b of this.buoys) b.visible = boat;
    this.px = THREE.MathUtils.clamp(this.px, -this.half(), this.half());
    // Dọn vật của chặng trước để cảnh không lẫn
    for (const it of this.scenery) if (it.active && it.s > this.dist + 12) { it.active = false; it.obj.visible = false; }
    this.nextScenery = Math.max(this.nextScenery, this.dist + 14);
    if (!first) this.opts.onLeg?.(leg.mode);
  }

  start() { this.running = true; }
  private resize() { const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.9 ? 58 : 46; this.camera.updateProjectionMatrix(); }
  /** Dùng cho kiểm thử: vị trí ngang, quãng đã đi, chướng ngại gần nhất phía trước. */
  debug() { const o = this.obstacles.filter((i) => i.active && !i.hit && i.s > this.dist + 2).sort((a, b) => a.s - b.s)[0]; return { px: this.px, dist: this.dist, total: this.L, speed: this.speed, mode: this.leg().mode, next: o ? { kind: o.kind, ahead: o.s - this.dist, x: o.x } : null }; }

  private place(obj: THREE.Object3D, s: number, x: number, y = 0) { obj.position.set(roadX(s) - roadX(this.dist) + x, y, -(s - this.dist)); }

  private frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    const leg = this.leg(), boat = leg.mode === 'boat', half = this.half();
    // ---- tốc độ và tiến độ
    if (this.running && !this.arrived) {
      this.elapsed += dt;
      if (this.pause > 0) this.pause -= dt;
      const remain = this.L - this.dist, capped = this.elapsed + remain / BASE > this.opts.seconds * 1.55;
      let want = BASE * (this.slow > 0 && !capped ? 0.38 : 1) * (this.boost > 0 ? 1.35 : 1);
      if (remain < 26) want = Math.max(4, BASE * (remain / 26));
      if (this.pause > 0) want = 0;
      this.speed += (want - this.speed) * Math.min(1, dt * (want < this.speed ? 5 : 2.2));
      this.slow = Math.max(0, this.slow - dt); this.boost = Math.max(0, this.boost - dt);
      this.dist += this.speed * dt;
      if (this.legIdx < this.legs.length - 1 && this.dist >= leg.end) { this.legIdx++; this.pause = 1.1; this.speed = 0; this.applyLeg(); }
      if (this.dist >= this.L) { this.dist = this.L; this.arrived = true; this.speed = 0; this.opts.onArrive?.(); }
      // ---- lái
      let steer = 0;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) steer -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) steer += 1;
      if (this.target !== null) this.pv = THREE.MathUtils.clamp((this.target - this.px) * 9, -13, 13);
      else this.pv += (steer * (boat ? 8 : 10) - this.pv) * Math.min(1, dt * (boat ? 4 : 9));
      this.px += this.pv * dt - roadDX(this.dist) * this.speed * dt * 0.45;
      if (Math.abs(this.px) > half) { this.px = Math.sign(this.px) * half; this.pv = 0; }
    }
    const k = this.speed / BASE;
    // ---- xe, tàu
    const veh = boat ? this.boat : this.truck;
    veh.position.set(this.px, boat ? Math.sin(t * 2.2) * 0.12 - 0.1 : Math.abs(Math.sin(t * 22)) * 0.03 * k, 0);
    veh.rotation.y = -this.pv * (boat ? 0.035 : 0.022); veh.rotation.z = boat ? Math.sin(t * 1.7) * 0.05 - this.pv * 0.012 : -this.pv * 0.006;
    if (boat) veh.rotation.x = Math.sin(t * 2.2 + 1) * 0.03;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.2;
    // ---- đường
    const upd = (m: THREE.Mesh, off: number, hw: number) => { const p = (m.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute, base = this.dist - 12; for (let i = 0; i <= SEGS; i++) { const s = base + i * SEG, cx = roadX(s) - roadX(this.dist) + off, z = -(s - this.dist); p.setXYZ(i * 2, cx - hw, 0, z); p.setXYZ(i * 2 + 1, cx + hw, 0, z); } p.needsUpdate = true; };
    if (!boat) {
      upd(this.road, 0, ROAD_HALF); upd(this.edgeL, -ROAD_HALF + 0.25, 0.14); upd(this.edgeR, ROAD_HALF - 0.25, 0.14);
      const first = Math.floor((this.dist - 10) / 7) * 7;
      this.dashes.forEach((d, i) => { const s = first + i * 7; this.place(d, s, 0, 0.03); d.rotation.y = -Math.atan(roadDX(s)); d.visible = s < leg.end && s > leg.start - 5; });
      const z = this.zoneAt(this.dist), th = THEMES[z];
      (this.ground.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(th.ground), dt * 0.8);
      (this.road.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(th.road), dt * 0.8);
      this.mountains.visible = th.mountains !== null;
    } else {
      this.mountains.visible = false;
      const first = Math.floor((this.dist - 10) / 13) * 13;
      this.buoys.forEach((b, i) => { const s = first + Math.floor(i / 2) * 13; this.place(b, s, (i % 2 ? 1 : -1) * (SEA_HALF + 0.6), Math.sin(t * 2 + i) * 0.1 - 0.05); b.rotation.z = Math.sin(t * 1.6 + i) * 0.12; });
    }
    const coast = !boat && this.zoneAt(this.dist) === 'dao';
    this.sea.visible = boat || coast;
    this.sea.position.y = boat ? -0.04 + Math.sin(t * 0.9) * 0.03 : -0.3;
    this.ground.scale.set(coast ? 0.13 : 1, 1, 1); // đảo: dải đất hẹp, hai bên là biển
    // ---- cảnh hai bên
    while (this.nextScenery < this.dist + AHEAD) {
      const s = this.nextScenery, l = this.legs.find((x) => s < x.end) ?? this.legs[this.legs.length - 1];
      const kinds = l.mode === 'boat' ? SEA_KINDS : THEMES[this.zoneAt(s)].kinds, kind = kinds[Math.floor(this.r() * kinds.length)];
      const it = this.scenery.find((i) => !i.active && i.kind === kind);
      if (it) {
        const side = kind === 'pole' ? 1 : this.r() < 0.5 ? -1 : 1, edge = l.mode === 'boat' ? SEA_HALF + 9 : ROAD_HALF + (kind === 'pole' ? 1.3 : kind === 'rice' || kind === 'pond' ? 6 : 3.4);
        it.s = s; it.x = side * (edge + (kind === 'pole' ? 0 : this.r() * (l.mode === 'boat' ? 34 : 16))); it.active = true; it.obj.visible = true; it.obj.rotation.y = kind === 'house' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : kind === 'pole' || kind === 'rice' ? 0 : this.r() * 6; it.obj.scale.setScalar(kind === 'pole' || kind === 'house' || kind === 'rice' ? 1 : 0.85 + this.r() * 0.5);
      }
      this.nextScenery += l.mode === 'boat' ? 9 + this.r() * 10 : 2.6 + this.r() * 2.8;
    }
    for (const it of this.scenery) { if (!it.active) continue; if (it.s < this.dist - 14) { it.active = false; it.obj.visible = false; continue; } this.place(it.obj, it.s, it.x, it.kind === 'islet' || it.kind === 'ghe' || it.kind === 'seastone' ? Math.sin(t + it.s) * 0.06 : 0); }
    // ---- chướng ngại
    while (this.planIdx < this.plan.length && this.plan[this.planIdx].s < this.dist + AHEAD - 10) {
      const p = this.plan[this.planIdx++], it = this.obstacles.find((i) => !i.active && i.kind === p.kind);
      if (it) { it.s = p.s; it.x = p.x; it.active = true; it.hit = false; it.obj.visible = true; it.vx = OBSTACLES[p.kind].wander ? (this.r() < 0.5 ? -1 : 1) * OBSTACLES[p.kind].wander! : 0; }
    }
    const myHw = boat ? 1.35 : 1.0, myHl = boat ? 3.0 : 2.1;
    for (const it of this.obstacles) {
      if (!it.active) continue;
      const def = OBSTACLES[it.kind], lim = (def.mode === 'truck' ? ROAD_HALF : SEA_HALF) - 0.9;
      if (this.running && !this.arrived && this.pause <= 0) { it.s += def.vs * dt; if (it.vx) { it.x += it.vx * dt; if (Math.abs(it.x) > lim) { it.x = Math.sign(it.x) * lim; it.vx = -it.vx; } } }
      if (it.s < this.dist - 12 || def.mode !== leg.mode) { it.active = false; it.obj.visible = false; continue; }
      const bob = def.mode === 'boat' ? Math.sin(t * 2 + it.s) * 0.1 : it.kind === 'ga' ? Math.abs(Math.sin(t * 14)) * 0.08 : 0;
      this.place(it.obj, it.s, it.x, bob + (def.pickup ? Math.sin(t * 4) * 0.2 : 0));
      if (def.pickup) it.obj.rotation.y = t * 2.5; else if (it.kind === 'ga') it.obj.rotation.y = (it.vx ?? 0) > 0 ? 0 : Math.PI;
      if (!it.hit && Math.abs(it.s - this.dist) < def.hl + myHl && Math.abs(it.x - this.px) < def.hw + myHw) {
        it.hit = true;
        if (def.pickup) { this.boost = 2.2; it.active = false; it.obj.visible = false; this.burst(0xffd84a, it.x); this.opts.onBump?.(boat ? 'Thêm dầu! Tăng tốc!' : 'Thêm xăng! Tăng tốc!'); }
        else { this.slow = 1.5; this.shake = 0.5; this.speed *= 0.55; this.burst(boat ? 0xffffff : 0xd9c9a6, it.x); const words = boat ? ['Ùm!', 'Sóng to quá!', 'Coi chừng!'] : ['Ối!', 'Úi chà!', 'Cẩn thận!']; this.opts.onBump?.(words[Math.floor(Math.random() * words.length)]); }
      }
    }
    // ---- mốc: biển chỉ đường, bến, cổng, đảo
    for (const sg of this.signs) { const vis = Math.abs(sg.s - this.dist - 60) < 90 && (this.legs.find((x) => sg.s < x.end) ?? leg).mode === 'truck' && !boat; sg.sp.visible = vis; if (vis) this.place(sg.sp, sg.s, ROAD_HALF + 1.6); }
    const last = this.legs[this.legs.length - 1], boundary = this.legs.length > 1 ? this.legs[0].end : -1e9;
    this.gate.visible = last.mode === 'truck' && this.L - this.dist < AHEAD; if (this.gate.visible) this.place(this.gate, this.L + 3, 0);
    const pierS = last.mode === 'boat' && this.L - this.dist < AHEAD ? this.L + 8 : boundary > 0 && Math.abs(boundary - this.dist) < AHEAD ? boundary + (this.legs[0].mode === 'truck' ? 2 : -2) : null;
    this.pier.visible = pierS !== null; if (pierS !== null) this.place(this.pier, pierS, 0);
    this.island.visible = last.mode === 'boat' && boat; if (this.island.visible) { const d = Math.max(0, this.L - this.dist); this.island.position.set(roadX(this.L) - roadX(this.dist), 0, -(d + 34)); }
    // ---- hạt, máy quay
    for (const s of this.sparks) { if (s.life <= 0) continue; s.life -= dt; s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt); s.m.position.z += this.speed * dt; s.m.scale.setScalar(Math.max(0.01, 0.16 * s.life)); if (s.life <= 0) s.m.visible = false; }
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 0.5, portrait = this.camera.aspect < 0.9;
    this.camera.position.set(this.px * 0.55 + (Math.random() - 0.5) * sh, (portrait ? 9.5 : 7.2) + (Math.random() - 0.5) * sh, portrait ? 12.5 : 10.5);
    this.camera.lookAt(this.px * 0.7, 1.2, -9);
    this.sun.target.position.set(0, 0, -8); this.sun.position.set(10, 22, 0);
    this.renderer.render(this.scene, this.camera);
    this.tickAcc += dt;
    if (this.tickAcc > 0.15) { this.tickAcc = 0; this.opts.onTick?.({ progress: this.dist / this.L, kmh: Math.round(k * (boat ? 28 : 62)), mode: leg.mode }); }
  }

  private burst(color: number, x: number) {
    for (const s of this.sparks) { s.m.material = mat(color, { rough: 0.6 }); s.m.position.set(x + (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), -2 - Math.random() * 2); s.v.set((Math.random() - 0.5) * 6, 3 + Math.random() * 4, -Math.random() * 4); s.life = 0.6 + Math.random() * 0.5; s.m.visible = true; }
  }

  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null);
    for (const fn of this.cleanup) fn();
    this.ro.disconnect();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && !Object.values(GEO).includes(m.geometry as never)) m.geometry.dispose(); const sm = (o as THREE.Sprite).material as THREE.SpriteMaterial | undefined; if ((o as THREE.Sprite).isSprite && sm) { sm.map?.dispose(); sm.dispose(); } });
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
