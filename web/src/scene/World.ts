// Thế giới xóm vườn 3D: đường làng, các lô vườn (nhà mình và hàng xóm), nhân vật chạy bằng cần điều khiển.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CROPS, REGIONS, SPECIALTIES, processOf } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { PLOT_COLS, PLOT_ROWS, TILE_COUNT } from '../../../shared/rules.ts';
import type { Listing, Planting } from '../api.ts';
import { GEO, buildPlant, fruitColor, mat, mesh, rng } from './plants.ts';
import type { Stage } from './plants.ts';

// ---------------------------------------------------------------- bố cục xóm
const TILE = 2;
const PITCH = 24;          // khoảng cách giữa hai lô liền kề dọc đường
const ROAD_Z = 15.5;       // tim đường làng
const ROAD_HALF = 3;
const FENCE = { x: 9.6, back: -13.5, front: 8.5, gate: 1.8 };
const STALL = { x: 6.2, z: 10.6 };
/** Vị trí 10 lô: lô 0 là vườn đang xem, còn lại là hàng xóm; s = 1 phía bắc đường, -1 phía nam. */
const SLOTS: { k: number; s: 1 | -1 }[] = [
  { k: 0, s: 1 }, { k: -1, s: 1 }, { k: 1, s: 1 }, { k: 0, s: -1 }, { k: -1, s: -1 },
  { k: 1, s: -1 }, { k: -2, s: 1 }, { k: 2, s: 1 }, { k: -2, s: -1 }, { k: 2, s: -1 },
];
export const SLOT_COUNT = SLOTS.length;
const WORLD = { x: 62, zMin: -22, zMax: 53 };

function tileLocal(tile: number): { x: number; z: number } {
  const c = tile % PLOT_COLS, r = Math.floor(tile / PLOT_COLS);
  return { x: (c - (PLOT_COLS - 1) / 2) * TILE, z: (r - (PLOT_ROWS - 1) / 2) * TILE };
}
/** Đổi toạ độ trong lô ↔ toạ độ thế giới (phép đối xứng nên dùng được cả hai chiều). */
function flip(slot: number, x: number, z: number): { x: number; z: number } {
  const { k, s } = SLOTS[slot];
  return s === 1 ? { x: x + k * PITCH, z } : { x: k * PITCH - x, z: 2 * ROAD_Z - z };
}
function toLocal(slot: number, X: number, Z: number): { x: number; z: number } {
  const { k, s } = SLOTS[slot];
  return s === 1 ? { x: X - k * PITCH, z: Z } : { x: k * PITCH - X, z: 2 * ROAD_Z - Z };
}

/** Gộp các khối tĩnh cùng chất liệu thành một lưới để giảm số lần vẽ. */
export function bake(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((o as THREE.InstancedMesh).isInstancedMesh || (o as THREE.Sprite).isSprite) { keep.push(o); return; }
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    const material = m.material as THREE.Material;
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material)!.push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), material);
    merged.castShadow = !material.transparent; merged.receiveShadow = true; out.add(merged);
  }
  for (const o of keep) {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    o.removeFromParent(); rel.decompose(o.position, o.quaternion, o.scale); out.add(o);
  }
  out.position.copy(root.position); out.quaternion.copy(root.quaternion); out.scale.copy(root.scale);
  return out;
}

function makeLabel(text: string, bg: string, fg = '#3b2a17'): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '800 54px "Baloo 2", "Be Vietnam Pro", sans-serif';
  const w = Math.min(492, g.measureText(text).width + 64);
  g.fillStyle = '#56310f'; g.beginPath(); g.roundRect((512 - w) / 2 - 6, 10, w + 12, 108, 54); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect((512 - w) / 2, 16, w, 90, 45); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 64, 440);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(6, 1.5, 1);
  return sp;
}

interface Body { root: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Group; armR: THREE.Group }
function makeFarmer(shirt: number, hat = 0xf2dc9a): Body {
  const root = new THREE.Group();
  const skin = mat(0xf0c39a), cloth = mat(shirt), pants = mat(0x3d4a6b);
  const legL = mesh(GEO.box, pants, -0.15, 0.24, 0, 0.2, 0.48, 0.24), legR = mesh(GEO.box, pants, 0.15, 0.24, 0, 0.2, 0.48, 0.24);
  root.add(legL, legR, mesh(GEO.cyl, cloth, 0, 0.82, 0, 0.36, 0.72, 0.3), mesh(GEO.ball, skin, 0, 1.52, 0, 0.42));
  root.add(mesh(GEO.ball, mat(0x2b2118), -0.15, 1.56, 0.36, 0.055), mesh(GEO.ball, mat(0x2b2118), 0.15, 1.56, 0.36, 0.055));
  root.add(mesh(new THREE.ConeGeometry(0.62, 0.36, 12), mat(hat), 0, 1.98, 0), mesh(GEO.cyl, mat(0xd9482b), 0, 1.86, 0, 0.44, 0.07, 0.44));
  const arm = (x: number) => { const g = new THREE.Group(); g.position.set(x, 1.08, 0); g.add(mesh(GEO.box, cloth, 0, -0.22, 0, 0.17, 0.5, 0.18), mesh(GEO.ball, skin, 0, -0.5, 0, 0.11)); root.add(g); return g; };
  const armL = arm(-0.46), armR = arm(0.46);
  root.scale.setScalar(1.15);
  return { root, legL, legR, armL, armR };
}

// ---------------------------------------------------------------- dữ liệu vào
export interface LotData { plotId: number; ownerName: string; mine: boolean; friend: boolean; plantings: Planting[]; stall: Listing[] }
export interface WorldState { regionId: string; lots: (LotData | null)[]; clockOffset: number }
export type Context =
  | { kind: 'none' }
  | { kind: 'tile'; lot: number; tile: number }
  | { kind: 'stall'; lot: number }
  | { kind: 'empty-lot'; lot: number };
export interface WorldOptions {
  hour?: number; demo?: boolean;
  onContext?: (ctx: Context) => void;
  /** Nhân vật đang đứng trên một ô có cây đã đến giờ chăm. */
  onReady?: (lot: number, planting: Planting) => void;
}

interface Theme { grass: number; grass2: number; sea: boolean; mountains: number; hill: number; trees: 'palm' | 'pine' | 'leaf'; road: number }
const THEMES: Record<Zone, Theme> = {
  bac: { grass: 0x8fd94e, grass2: 0x7cc843, sea: false, mountains: 9, hill: 5, trees: 'leaf', road: 0xe2bd7e },
  trung: { grass: 0xa6d955, grass2: 0x93c84a, sea: false, mountains: 5, hill: 3, trees: 'leaf', road: 0xecd49a },
  taynguyen: { grass: 0x8ed150, grass2: 0x7abf45, sea: false, mountains: 7, hill: 6, trees: 'pine', road: 0xc8704a },
  nam: { grass: 0x86dc52, grass2: 0x72cb47, sea: false, mountains: 0, hill: 1, trees: 'palm', road: 0xe0b878 },
  dao: { grass: 0x9bdc58, grass2: 0x88cb4c, sea: true, mountains: 2, hill: 1.5, trees: 'palm', road: 0xf0dfae },
};
type Sky = { sky: number; sun: number; sunI: number; dir: [number, number, number]; hemiSky: number; hemiGround: number; hemiI: number; night: boolean };
function skyFor(hour: number): Sky {
  if (hour >= 7 && hour < 16.5) return { sky: 0x86d4ff, sun: 0xfff6e0, sunI: 2.4, dir: [10, 22, 12], hemiSky: 0xffffff, hemiGround: 0xb9d98a, hemiI: 1.5, night: false };
  if ((hour >= 5.3 && hour < 7) || (hour >= 16.5 && hour < 18.6)) return { sky: 0xffc58f, sun: 0xffb060, sunI: 2.3, dir: [20, 10, 10], hemiSky: 0xffe0c0, hemiGround: 0xa89a6a, hemiI: 1.25, night: false };
  return { sky: 0x22335e, sun: 0xb4c4ff, sunI: 1.2, dir: [-10, 20, 10], hemiSky: 0x8fa5e6, hemiGround: 0x33405f, hemiI: 1.2, night: true };
}

// ---------------------------------------------------------------- một lô vườn
class Lot {
  group = new THREE.Group();
  data: LotData | null = null;
  private built: 'none' | 'empty' | 'farm' = 'none';
  private plantLayer = new THREE.Group();
  private plants = new Map<number, { key: string; group: THREE.Group; born: number }>();
  private goods = new THREE.Group();
  private label: THREE.Sprite | null = null;
  private labelText = '';
  markers = new Map<number, THREE.Mesh>();
  npc: Body | null = null;
  private slot: number;
  private night: boolean;

  constructor(slot: number, night: boolean) {
    this.slot = slot; this.night = night;
    const { k, s } = SLOTS[slot];
    this.group.position.set(k * PITCH, 0, s === 1 ? 0 : 2 * ROAD_Z);
    this.group.rotation.y = s === 1 ? 0 : Math.PI;
  }

  colliders(): [number, number, number, number][] {
    if (this.built !== 'farm') return [];
    const local: [number, number, number, number][] = [
      [-FENCE.x, FENCE.x, FENCE.back - 0.15, FENCE.back + 0.15], [-FENCE.x - 0.15, -FENCE.x + 0.15, FENCE.back, FENCE.front],
      [FENCE.x - 0.15, FENCE.x + 0.15, FENCE.back, FENCE.front], [-FENCE.x, -FENCE.gate, FENCE.front - 0.15, FENCE.front + 0.15],
      [FENCE.gate, FENCE.x, FENCE.front - 0.15, FENCE.front + 0.15], [-3.0, 3.0, -12.4, -8.4], [STALL.x - 1.9, STALL.x + 1.9, STALL.z - 0.8, STALL.z + 0.8],
    ];
    return local.map(([x0, x1, z0, z1]) => { const a = flip(this.slot, x0, z0), b = flip(this.slot, x1, z1); return [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z)]; });
  }

  private rebuild(kind: 'empty' | 'farm') {
    this.group.clear(); this.plants.clear(); this.markers.clear(); this.label = null; this.labelText = ''; this.npc = null;
    this.plantLayer = new THREE.Group(); this.goods = new THREE.Group();
    const st = new THREE.Group();
    const wood = mat(0x9a6238), woodDark = mat(0x6e4424);
    if (kind === 'empty') {
      for (const [x, z] of [[-FENCE.x, FENCE.front], [FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back]]) st.add(mesh(GEO.box, wood, x, 0.4, z, 0.2, 0.8, 0.2));
      st.add(mesh(GEO.box, woodDark, 0, 0.8, FENCE.front + 1.2, 0.14, 1.6, 0.14), mesh(GEO.box, mat(0xf6e7c1), 0, 1.5, FENCE.front + 1.28, 2.6, 0.9, 0.1));
      this.group.add(bake(st));
      const l = makeLabel('Đất trống · mời bạn', '#fff6dc'); l.position.set(0, 3.1, FENCE.front + 1.2); l.scale.set(5, 1.25, 1); this.group.add(l);
      this.built = kind; return;
    }
    // Sân đất và ô ruộng
    st.add(mesh(GEO.box, mat(0xe6c88f), 0, 0.03, 0.2, PLOT_COLS * TILE + 1.6, 0.06, PLOT_ROWS * TILE + 1.6));
    for (let t = 0; t < TILE_COUNT; t++) { const p = tileLocal(t); st.add(mesh(GEO.box, mat((t + Math.floor(t / PLOT_COLS)) % 2 ? 0xa86c3e : 0xb5773f), p.x, 0.08, p.z, TILE - 0.14, 0.08, TILE - 0.14)); }
    // Hàng rào và cổng
    const post = (x: number, z: number, h = 1) => st.add(mesh(GEO.box, wood, x, h / 2, z, 0.18, h, 0.18), mesh(GEO.ball, woodDark, x, h + 0.05, z, 0.14));
    const rail = (x: number, z: number, sx: number, sz: number) => st.add(mesh(GEO.box, wood, x, 0.72, z, sx, 0.1, sz), mesh(GEO.box, wood, x, 0.38, z, sx, 0.1, sz));
    const depth = FENCE.front - FENCE.back, midZ = (FENCE.front + FENCE.back) / 2;
    for (let i = 0; i <= 8; i++) { const x = -FENCE.x + (i * FENCE.x * 2) / 8; post(x, FENCE.back); if (Math.abs(x) > FENCE.gate + 0.3) post(x, FENCE.front); }
    for (let i = 1; i < 9; i++) { const z = FENCE.back + (i * depth) / 9; post(-FENCE.x, z); post(FENCE.x, z); }
    rail(0, FENCE.back, FENCE.x * 2, 0.08); rail(-FENCE.x, midZ, 0.08, depth); rail(FENCE.x, midZ, 0.08, depth);
    const seg = FENCE.x - FENCE.gate; rail(-(FENCE.x + FENCE.gate) / 2, FENCE.front, seg, 0.08); rail((FENCE.x + FENCE.gate) / 2, FENCE.front, seg, 0.08);
    for (const x of [-FENCE.gate, FENCE.gate]) st.add(mesh(GEO.box, woodDark, x, 1.5, FENCE.front, 0.28, 3, 0.28));
    st.add(mesh(GEO.box, woodDark, 0, 3.05, FENCE.front, FENCE.gate * 2 + 0.9, 0.26, 0.4), mesh(GEO.box, mat(0xd9482b), 0, 3.3, FENCE.front, FENCE.gate * 2 + 1.3, 0.14, 0.7));
    // Lối đá từ cổng vào ruộng, vòng ra nhà
    const stone = mat(0xf2e6cc);
    for (let i = 0; i < 4; i++) st.add(mesh(GEO.cyl, stone, i % 2 ? 0.2 : -0.2, 0.05, FENCE.front - 0.6 - i * 0.75, 0.42, 0.06, 0.36));
    for (let i = 0; i < 9; i++) st.add(mesh(GEO.cyl, stone, -7.6 + (i % 2 ? 0.15 : -0.1), 0.05, 5.2 - i * 1.5, 0.4, 0.06, 0.34));
    // Nhà mái ngói có hiên
    const h = new THREE.Group(); h.position.set(0, 0, -10.4);
    const glow = this.night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0x8fd3f2, { rough: 0.3 });
    const wallColor = [0xfff0cf, 0xffe1e1, 0xe2f0ff, 0xeaf7d6, 0xfff5b8][this.slot % 5], roofColor = [0xd9482b, 0x2f8fc4, 0xd97b2b, 0x8a5bc4, 0xc43a5b][this.slot % 5];
    h.add(mesh(GEO.box, mat(0xcdbb99), 0, 0.15, 0, 6.6, 0.3, 4.6), mesh(GEO.box, mat(wallColor), 0, 1.5, 0, 5.6, 2.4, 3.6));
    const roof = mesh(new THREE.CylinderGeometry(0.01, 3.1, 1.8, 4, 1), mat(roofColor), 0, 3.6, 0, 1.38, 1, 0.98); roof.rotation.y = Math.PI / 4; h.add(roof);
    h.add(mesh(GEO.box, woodDark, 0, 1.1, 1.82, 1.0, 1.6, 0.1));
    for (const x of [-1.8, 1.8]) h.add(mesh(GEO.box, glow, x, 1.7, 1.82, 0.95, 0.85, 0.08), mesh(GEO.box, mat(0xffffff), x, 1.7, 1.86, 1.1, 0.1, 0.05), mesh(GEO.box, mat(0xffffff), x, 1.7, 1.86, 0.1, 1.0, 0.05));
    h.add(mesh(GEO.box, mat(roofColor), 0, 2.6, 2.5, 6.3, 0.14, 1.5));
    for (const x of [-2.9, 2.9]) h.add(mesh(GEO.cyl, woodDark, x, 1.4, 3.1, 0.09, 2.4, 0.09));
    h.add(mesh(GEO.box, mat(0xb0a08a), 1.9, 4.2, -0.3, 0.5, 0.9, 0.5));
    h.add(mesh(GEO.cyl, mat(0xb5613c), -3.6, 0.55, 3.1, 0.45, 0.8, 0.45), mesh(GEO.cyl, mat(0x4fb3e0, { rough: 0.2 }), -3.6, 0.96, 3.1, 0.38, 0.03, 0.38));
    for (const x of [3.7, 4.6]) h.add(mesh(GEO.cyl, mat(0xc46a3f), x, 0.3, 3.2, 0.28, 0.4, 0.28), mesh(GEO.ball, mat(0x3fae4c), x, 0.75, 3.2, 0.36), mesh(GEO.ball, mat(x > 4 ? 0xff7fb0 : 0xffd23f), x + 0.1, 1.0, 3.3, 0.12));
    st.add(h);
    // Cây bóng mát, đống rơm, giếng trong sân
    st.add(mesh(GEO.cyl, mat(0x7a5233), 7.3, 1.0, -9.5, 0.2, 2, 0.2), mesh(GEO.ball, mat(0x3fa84a), 6.7, 2.6, -9.3, 1.2), mesh(GEO.ball, mat(0x58c060), 7.9, 2.8, -9.7, 1.25), mesh(GEO.ball, mat(0x7bd66a), 7.3, 3.6, -9.4, 1.2));
    st.add(mesh(GEO.cone, mat(0xf2c94c), -7.4, 0.8, -10.6, 1.1, 1.6, 1.1), mesh(GEO.cyl, mat(0xbdb5a6), -7.3, 0.4, 6.9, 0.7, 0.8, 0.7), mesh(GEO.cyl, mat(0x4fb3e0, { rough: 0.2 }), -7.3, 0.81, 6.9, 0.56, 0.03, 0.56));
    // Sạp bán hàng sát đường
    const s = new THREE.Group(); s.position.set(STALL.x, 0, STALL.z);
    s.add(mesh(GEO.box, wood, 0, 0.55, 0, 3.4, 1.1, 1.3), mesh(GEO.box, mat(0xe0b06e), 0, 1.13, 0.05, 3.6, 0.08, 1.5));
    for (const x of [-1.65, 1.65]) for (const z of [-0.6, 0.6]) s.add(mesh(GEO.cyl, woodDark, x, 1.5, z, 0.07, 3, 0.07));
    for (let i = 0; i < 8; i++) { const strip = mesh(GEO.box, mat(i % 2 ? 0xffffff : roofColor), -1.58 + i * 0.45, 3.05, 0.1, 0.45, 0.1, 2.1); strip.rotation.x = 0.22; s.add(strip); }
    st.add(s);
    this.group.add(bake(st), this.plantLayer);
    this.goods.position.set(STALL.x, 0, STALL.z); this.group.add(this.goods);
    if (this.slot !== 0) { // chủ nhà hàng xóm đứng trước hiên
      this.npc = makeFarmer([0x2f8fc4, 0xd9482b, 0x8a5bc4, 0x3fae4c, 0xd97b2b][this.slot % 5]);
      this.npc.root.position.set(-1.6, 0, -6.4); this.group.add(this.npc.root);
    }
    this.built = kind;
  }

  setData(data: LotData | null, time: number) {
    this.data = data;
    const want = data ? 'farm' : this.slot === 0 ? 'none' : 'empty';
    if (want === 'none') { this.group.clear(); this.built = 'none'; return; }
    if (this.built !== want) this.rebuild(want);
    if (!data) return;
    const text = data.mine ? 'Vườn nhà' : `Vườn ${data.ownerName}`;
    if (text !== this.labelText) {
      if (this.label) this.group.remove(this.label);
      this.label = makeLabel(text, data.mine ? '#ffcf3a' : '#fff6dc'); this.label.position.set(0, 4.5, FENCE.front); this.group.add(this.label); this.labelText = text;
    }
    const seen = new Set<number>();
    for (const p of data.plantings) {
      seen.add(p.tile);
      const crop = CROPS[SPECIALTIES[p.specialtyId].crop];
      const last = processOf(crop).length - 1, prog = p.stepIndex / last;
      const stage: Stage = p.stepIndex >= last ? 3 : prog < 0.3 ? 0 : prog < 0.65 ? 1 : 2;
      const key = `${p.id}:${stage}`, cur = this.plants.get(p.tile);
      if (cur?.key === key) continue;
      if (cur) this.plantLayer.remove(cur.group);
      const group = bake(buildPlant(crop, stage, p.id * 7 + p.tile));
      const l = tileLocal(p.tile); group.position.set(l.x, 0, l.z); group.userData.sway = p.tile * 0.7;
      this.plantLayer.add(group); this.plants.set(p.tile, { key, group, born: time });
    }
    for (const [tile, cur] of this.plants) if (!seen.has(tile)) { this.plantLayer.remove(cur.group); this.plants.delete(tile); }
    this.goods.clear();
    const kinds = [...new Set(data.stall.map((l) => SPECIALTIES[l.specialtyId].crop))].slice(0, 4);
    const g = new THREE.Group();
    kinds.forEach((cropId, i) => {
      const x = -1.2 + i * 0.8, r = rng(i + 3), color = fruitColor(cropId);
      g.add(mesh(GEO.box, mat(0xc9975a), x, 1.3, 0.1, 0.62, 0.26, 0.62));
      for (let k = 0; k < 6; k++) g.add(mesh(GEO.ball, mat(color, { rough: 0.5 }), x + (r() - 0.5) * 0.4, 1.5 + (k > 3 ? 0.14 : 0), 0.1 + (r() - 0.5) * 0.4, 0.14));
    });
    if (kinds.length) this.goods.add(bake(g));
  }

  animate(t: number, now: number, scene: World) {
    if (this.built !== 'farm' || !this.data) return;
    for (const [, p] of this.plants) {
      const k = Math.min(1, (t - p.born) / 0.5), ease = 1 - Math.pow(1 - k, 3);
      p.group.scale.setScalar((0.6 + 0.4 * ease + (k < 1 ? Math.sin(k * Math.PI) * 0.14 : 0)) * 1.14);
      p.group.rotation.z = Math.sin(t * 1.4 + p.group.userData.sway) * 0.03;
    }
    const ready = new Set<number>();
    for (const p of this.data.plantings) if (now >= p.stepReadyAt) ready.add(p.tile);
    for (const tile of ready) {
      let m = this.markers.get(tile);
      if (!m) { m = scene.makeMarker(); const l = tileLocal(tile); m.position.set(l.x, 2.6, l.z); this.group.add(m); this.markers.set(tile, m); }
      m.position.y = 2.7 + Math.sin(t * 3 + tile) * 0.2; m.rotation.y = t * 2.2;
    }
    for (const [tile, m] of this.markers) if (!ready.has(tile)) { this.group.remove(m); this.markers.delete(tile); }
    if (this.npc) { this.npc.armR.rotation.z = -2.4 + Math.sin(t * 5) * 0.35; this.npc.root.position.y = Math.abs(Math.sin(t * 2)) * 0.04; }
  }
}

// ---------------------------------------------------------------- thế giới
export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.5, 500);
  private clock = new THREE.Clock();
  private sun: THREE.DirectionalLight;
  private sky: Sky;
  private env = new THREE.Group();
  private lots: Lot[] = [];
  private colliders: [number, number, number, number][] = [];
  private state: WorldState | null = null;
  private regionId = '';
  private player: Body;
  private pos = new THREE.Vector3(-7, 0, ROAD_Z + 0.5);
  private vel = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private input = new THREE.Vector2();
  private keys = new Set<string>();
  private walkTo: THREE.Vector3 | null = null;
  private stick: { id: number; x: number; y: number; moved: boolean; t: number } | null = null;
  private stickEl: HTMLDivElement; private knobEl: HTMLDivElement;
  private zoom = 1;
  private ctxKey = '';
  private readyAt = new Map<number, number>();
  private workUntil = 0;
  private ring: THREE.Mesh;
  private arrow = new THREE.Group();
  private markerGeo = new THREE.OctahedronGeometry(0.36, 0);
  private sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private floats: { s: THREE.Sprite; life: number }[] = [];
  private chickens: { obj: THREE.Group; target: THREE.Vector3; wait: number; speed: number }[] = [];
  private clouds: THREE.Group[] = [];
  private flutter: { m: THREE.Mesh; c: THREE.Vector3; ph: number }[] = [];
  private water: THREE.Mesh | null = null;
  private ro: ResizeObserver;
  private disposed = false;
  private enteredYard = false;
  private demoT = 0;
  private cleanup: (() => void)[] = [];
  paused = false;
  private container: HTMLElement;
  private opts: WorldOptions;

  constructor(container: HTMLElement, opts: WorldOptions) {
    this.container = container; this.opts = opts;
    const d = new Date();
    this.sky = skyFor(opts.hour ?? d.getHours() + d.getMinutes() / 60);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = this.sky.night ? 1.35 : 1.1;
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none';
    container.appendChild(el);
    this.scene.background = new THREE.Color(this.sky.sky);
    this.scene.fog = new THREE.Fog(this.sky.sky, 70, 210);
    this.sun = new THREE.DirectionalLight(this.sky.sun, this.sky.sunI);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(new THREE.HemisphereLight(this.sky.hemiSky, this.sky.hemiGround, this.sky.hemiI), this.sun, this.sun.target, this.env);
    for (let i = 0; i < SLOT_COUNT; i++) { const lot = new Lot(i, this.sky.night); this.lots.push(lot); this.scene.add(lot.group); }

    this.player = makeFarmer(0x2fa0e0); this.scene.add(this.player.root);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.rotation.z = Math.PI / 4; this.ring.visible = false; this.scene.add(this.ring);
    const gold = mat(0xffd23f, { emissive: 0xffa800, rough: 0.4 });
    const head = mesh(GEO.cone, gold, 0, 0, 0, 0.75, 1.1, 0.75); head.rotation.x = Math.PI; head.castShadow = false;
    const shaft = mesh(GEO.box, gold, 0, 1.2, 0, 0.5, 1.4, 0.5); shaft.castShadow = false;
    this.arrow.add(head, shaft); this.arrow.visible = false; this.scene.add(this.arrow);
    for (let i = 0; i < 30; i++) { const m = mesh(GEO.ball, mat(0xffffff), 0, -10, 0, 0.1); m.castShadow = false; m.visible = false; this.scene.add(m); this.sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }
    this.buildLife();

    // Cần điều khiển ảo
    this.stickEl = document.createElement('div'); this.knobEl = document.createElement('div');
    this.stickEl.className = 'stick'; this.knobEl.className = 'stick-knob'; this.stickEl.appendChild(this.knobEl); container.appendChild(this.stickEl);
    if (!opts.demo) this.bindInput(el);
    this.camPos.copy(this.pos);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  makeMarker(): THREE.Mesh { const m = new THREE.Mesh(this.markerGeo, mat(0xffd23f, { emissive: 0xffa800, rough: 0.4 })); return m; }

  private bindInput(el: HTMLCanvasElement) {
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: any) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); this.cleanup.push(() => t.removeEventListener(type, fn, o)); };
    on(el, 'pointerdown', (e: PointerEvent) => {
      if (this.paused || this.stick) return;
      el.setPointerCapture(e.pointerId);
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: performance.now() };
    });
    on(el, 'pointermove', (e: PointerEvent) => {
      const s = this.stick; if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y, len = Math.hypot(dx, dy);
      if (!s.moved && len > 10) { s.moved = true; this.walkTo = null; const r = this.container.getBoundingClientRect(); this.stickEl.style.left = `${s.x - r.left}px`; this.stickEl.style.top = `${s.y - r.top}px`; this.stickEl.classList.add('on'); }
      if (!s.moved) return;
      const k = Math.min(1, len / 56); this.input.set((dx / (len || 1)) * k, (dy / (len || 1)) * k);
      this.knobEl.style.transform = `translate(${this.input.x * 44}px, ${this.input.y * 44}px)`;
    });
    const end = (e: PointerEvent) => {
      const s = this.stick; if (!s || s.id !== e.pointerId) return;
      this.stick = null; this.input.set(0, 0); this.stickEl.classList.remove('on'); this.knobEl.style.transform = '';
      if (!s.moved && performance.now() - s.t < 500 && e.type === 'pointerup') { // chạm nhanh: chạy tới điểm đó
        const r = el.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
        const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) this.walkTo = hit;
      }
    };
    on(el, 'pointerup', end); on(el, 'pointercancel', end);
    on(el, 'wheel', (e: WheelEvent) => { e.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.92), 0.6, 1.6); }, { passive: false });
    const typing = () => /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    on(window, 'keydown', (e: KeyboardEvent) => { if (!typing() && /^(Arrow|Key[WASD])/.test(e.code)) { this.keys.add(e.code); this.walkTo = null; e.preventDefault(); } });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
  }

  // ------------------------------------------------------------ cảnh nền theo vùng
  private buildLife() {
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Group(), r = rng(100 + i);
      for (let k = 0; k < 4; k++) { const b = mesh(GEO.ball, mat(this.sky.night ? 0x5a6a99 : 0xffffff, { rough: 1 }), k * 2.2 - 3 + r(), r() * 0.8, r() * 1.5, 2 + r() * 1.3, 1.1 + r() * 0.5, 1.8); b.castShadow = false; b.receiveShadow = false; c.add(b); }
      c.position.set(-90 + i * 26, 30 + r() * 8, -60 + r() * 60); c.userData.speed = 0.6 + r() * 0.6; this.clouds.push(c); this.scene.add(c);
    }
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(), col = mat(i % 2 ? 0xffffff : 0xd98a4a);
      g.add(mesh(GEO.ball, col, 0, 0.32, 0, 0.27, 0.25, 0.33), mesh(GEO.ball, col, 0, 0.6, 0.22, 0.15), mesh(GEO.cone, mat(0xffa51e), 0, 0.58, 0.39, 0.05, 0.12, 0.05), mesh(GEO.box, mat(0xe0342b), 0, 0.77, 0.22, 0.05, 0.11, 0.14), mesh(GEO.cone, col, 0, 0.46, -0.33, 0.11, 0.27, 0.11));
      (g.children[2] as THREE.Mesh).rotation.x = Math.PI / 2;
      g.position.set(-8 + i * 0.7, 0, 7 - i * 0.3);
      this.chickens.push({ obj: g, target: g.position.clone(), wait: i * 0.7, speed: 1.2 + i * 0.15 }); this.scene.add(g);
    }
    if (!this.sky.night) for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({ color: [0xff7fb0, 0xffd23f, 0x7fd0ff, 0xffffff][i % 4], side: THREE.DoubleSide }));
      this.flutter.push({ m, c: new THREE.Vector3(-14 + i * 4, 1.2, 9 + (i % 3) * 2), ph: i * 1.7 }); this.scene.add(m);
    }
  }

  private buildEnvironment(regionId: string) {
    this.env.clear(); this.water = null;
    const zone = REGIONS[regionId]?.zone ?? 'nam', th = THEMES[zone];
    const r = rng([...regionId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const out = (x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x) - (WORLD.x + 6)), Math.max(0, WORLD.zMin - 6 - z, z - WORLD.zMax - 6));
    const g = new THREE.PlaneGeometry(520, 520, 80, 80); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute, colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), cg = new THREE.Color(th.grass), cg2 = new THREE.Color(th.grass2), sand = new THREE.Color(0xf2e2a8), rock = new THREE.Color(0x8fa08a);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i) + 15, d = out(x, z);
      const n = Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.16) + Math.sin(x * 0.07 + z * 0.1) * 1.4;
      let y = 0;
      if (th.sea) { y = -Math.min(3.5, Math.max(0, d - 4) * 0.3); c.copy(d < 2 ? (n > 0.9 ? cg2 : cg) : sand); }
      else { const k = d / 34; y = k * k * th.hill * (2.4 + n); c.copy(y > 9 ? rock : n > 0.9 ? cg2 : cg); }
      pos.setZ(i, z); pos.setY(i, y); colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    ground.receiveShadow = true; ground.position.y = -0.03; this.env.add(ground);
    if (th.sea) {
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: this.sky.night ? 0x245a86 : 0x35b6e6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
      this.water.position.set(0, -0.6, 15); this.water.receiveShadow = true; this.env.add(this.water);
      for (const [bx, bz, col] of [[-48, 66, 0x2f7fc4], [30, 70, 0xd9482b], [78, 20, 0x3fae4c]] as const) {
        const boat = bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(col), 0, 0, 0, 3, 0.6, 1.1), mesh(GEO.box, mat(0xffffff), 0, 0.36, 0, 3.1, 0.12, 1.2), mesh(GEO.cyl, mat(0x6e4424), 0.2, 1.2, 0, 0.05, 1.9, 0.05), mesh(GEO.box, mat(0xfff6dc), 0.75, 1.3, 0, 1.0, 1.2, 0.04)); return b; })());
        boat.position.set(bx, -0.4, bz); boat.rotation.y = r() * 3; boat.userData.boat = r() * 6; this.env.add(boat);
      }
    }
    // Đường làng và lối vào từng cổng
    const st = new THREE.Group(), road = mat(th.road), edge = mat(0xfff3d0);
    st.add(mesh(GEO.box, road, 0, 0.02, ROAD_Z, (WORLD.x + 6) * 2, 0.06, ROAD_HALF * 2));
    for (let x = -WORLD.x - 4; x <= WORLD.x + 4; x += 2.4) for (const s of [-1, 1]) st.add(mesh(GEO.cyl, edge, x + (s > 0 ? 1.1 : 0), 0.05, ROAD_Z + s * (ROAD_HALF + 0.1), 0.32, 0.08, 0.26));
    for (let i = 0; i < SLOT_COUNT; i++) { const a = flip(i, 0, (FENCE.front + ROAD_Z - ROAD_HALF) / 2); st.add(mesh(GEO.box, road, a.x, 0.025, a.z, 3.2, 0.06, ROAD_Z - ROAD_HALF - FENCE.front + 0.4)); }
    for (let x = -54; x <= 54; x += 24) { // cột đèn
      st.add(mesh(GEO.cyl, mat(0x5a5f6b), x + 12, 1.7, ROAD_Z - ROAD_HALF - 0.6, 0.08, 3.4, 0.08), mesh(GEO.ball, this.sky.night ? mat(0xffe9a8, { emissive: 0xffd05a }) : mat(0xfff6dc), x + 12, 3.5, ROAD_Z - ROAD_HALF - 0.6, 0.28));
      if (this.sky.night) { const lamp = new THREE.PointLight(0xffd58a, 22, 14, 1.7); lamp.position.set(x + 12, 3.4, ROAD_Z - ROAD_HALF - 0.4); this.env.add(lamp); }
    }
    if (zone === 'nam') st.add(mesh(GEO.box, new THREE.MeshStandardMaterial({ color: 0x4fc0d8, roughness: 0.25, transparent: true, opacity: 0.92 }), 0, 0.03, WORLD.zMin - 3, 300, 0.06, 6));
    // Cây, bụi quanh xóm
    const free = (x: number, z: number) => {
      if (Math.abs(z - ROAD_Z) < ROAD_HALF + 1.5) return false;
      for (let i = 0; i < SLOT_COUNT; i++) { const l = toLocal(i, x, z); if (Math.abs(l.x) < FENCE.x + 1.2 && l.z > FENCE.back - 1.2 && l.z < FENCE.front + 4) return false; }
      return true;
    };
    let placed = 0, guard = 0;
    while (placed < 70 && guard++ < 900) {
      const x = (r() * 2 - 1) * (WORLD.x + 40), z = WORLD.zMin - 34 + r() * (WORLD.zMax - WORLD.zMin + 70);
      const d = out(x, z); if (!free(x, z) || (th.sea && d > 3)) continue;
      if (z > ROAD_Z + ROAD_HALF && z < 2 * ROAD_Z + 6 && Math.abs(x) < 8 && r() < 0.7) continue;
      const k = d / 34, t = this.makeTree(th.trees, r); t.position.set(x, th.sea ? 0 : k * k * th.hill * 2.4, z); t.rotation.y = r() * 6; t.scale.setScalar(0.9 + r() * 0.7);
      t.userData.sway = r() * 6; this.env.add(t); placed++;
    }
    for (let i = 0; i < 60; i++) { const x = (r() * 2 - 1) * WORLD.x, z = WORLD.zMin + r() * (WORLD.zMax - WORLD.zMin); if (free(x, z)) st.add(mesh(GEO.ball, mat(i % 3 ? 0x4fb857 : 0x3fa04a), x, 0.2, z, 0.4 + r() * 0.3, 0.3, 0.4)); }
    for (let i = 0; i < th.mountains; i++) {
      const a = Math.PI * (1.05 + (i / Math.max(1, th.mountains - 1)) * 0.9) + r() * 0.15, dist = 150 + r() * 50, hh = 34 + r() * 36;
      const m = mesh(new THREE.ConeGeometry(26 + r() * 20, hh, 6), mat(zone === 'taynguyen' ? 0x6fa064 : 0x7fa890, { rough: 1 }), Math.cos(a) * dist, hh / 2 - 3, 15 + Math.sin(a) * dist); m.castShadow = false; m.rotation.y = r() * 3; this.env.add(m);
    }
    this.env.add(bake(st));
    // Cỏ và hoa dại
    const tuft = new THREE.InstancedMesh(GEO.cone, mat(th.grass2), 700), flower = new THREE.InstancedMesh(GEO.ball, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), 260);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), palette = [0xffffff, 0xffd23f, 0xff7fb0, 0xff8a3a, 0xc59bff];
    let ti = 0, fi = 0, tries = 0;
    while ((ti < 700 || fi < 260) && tries++ < 6000) {
      const x = (r() * 2 - 1) * (WORLD.x + 4), z = WORLD.zMin - 4 + r() * (WORLD.zMax - WORLD.zMin + 8);
      if (!free(x, z)) continue;
      if (ti < 700 && r() < 0.75) { m4.compose(new THREE.Vector3(x, 0.16, z), q.setFromEuler(new THREE.Euler(0, r() * 6, (r() - 0.5) * 0.5)), new THREE.Vector3(0.09, 0.3 + r() * 0.2, 0.09)); tuft.setMatrixAt(ti++, m4); }
      else if (fi < 260) { m4.compose(new THREE.Vector3(x, 0.2, z), q.identity(), new THREE.Vector3(0.11, 0.11, 0.11)); flower.setMatrixAt(fi, m4); flower.setColorAt(fi++, col.setHex(palette[Math.floor(r() * palette.length)])); }
    }
    tuft.count = ti; flower.count = fi; tuft.receiveShadow = true; this.env.add(tuft, flower);
  }

  private makeTree(kind: Theme['trees'], r: () => number): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'pine') {
      g.add(mesh(GEO.cyl, mat(0x7a5233), 0, 0.6, 0, 0.16, 1.2, 0.16));
      for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(i % 2 ? 0x2f8a52 : 0x3fa062), 0, 1.5 + i * 0.9, 0, 1.25 - i * 0.3, 1.5, 1.25 - i * 0.3));
    } else if (kind === 'palm') {
      const h = 3.2 + r() * 1.6; const trunk = mesh(GEO.cyl, mat(0x9a7a50), 0.15, h / 2, 0, 0.15, h, 0.15); trunk.rotation.z = -0.08; g.add(trunk);
      for (let i = 0; i < 7; i++) { const p = new THREE.Group(); p.position.set(0.3, h, 0); p.rotation.y = (i / 7) * 6.28; p.rotation.z = -0.5; p.add(mesh(GEO.sphere, mat(i % 2 ? 0x3fae4c : 0x62c868), 1.0, 0, 0, 1.15, 0.07, 0.3)); g.add(p); }
      g.add(mesh(GEO.ball, mat(0x8aa83a), 0.3, h - 0.2, 0.17, 0.19), mesh(GEO.ball, mat(0x8aa83a), 0.13, h - 0.22, -0.1, 0.19));
    } else {
      g.add(mesh(GEO.cyl, mat(0x7a5233), 0, 0.8, 0, 0.18, 1.6, 0.18));
      g.add(mesh(GEO.ball, mat(0x3fa04a), -0.5, 2.0, 0.1, 1.0), mesh(GEO.ball, mat(0x55b85c), 0.55, 2.1, -0.1, 1.05), mesh(GEO.ball, mat(0x7bd66a), 0, 2.8, 0.1, 1.1));
    }
    return bake(g);
  }

  // ------------------------------------------------------------ trạng thái
  setState(state: WorldState) {
    if (state.regionId !== this.regionId) { this.regionId = state.regionId; this.buildEnvironment(state.regionId); }
    this.state = state;
    const t = this.clock.elapsedTime;
    for (let i = 0; i < SLOT_COUNT; i++) this.lots[i].setData(state.lots[i] ?? null, t);
    this.colliders = this.lots.flatMap((l) => l.colliders());
  }

  private worldOfTile(lot: number, tile: number): THREE.Vector3 { const l = tileLocal(tile), w = flip(lot, l.x, l.z); return new THREE.Vector3(w.x, 0, w.z); }

  burst(lot: number, tile: number, kind: 'water' | 'soil' | 'leaf' | 'harvest') {
    const color = { water: 0x6ecbff, soil: 0xb5773f, leaf: 0x7fe06a, harvest: 0xffd84a }[kind], p = this.worldOfTile(lot, tile);
    for (const s of this.sparks) {
      s.m.material = mat(color, kind === 'harvest' ? { emissive: 0xffb300, rough: 0.4 } : { rough: 0.5 });
      s.m.position.set(p.x + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.8, p.z + (Math.random() - 0.5) * 1.2);
      s.v.set((Math.random() - 0.5) * 3, 3 + Math.random() * 3.5, (Math.random() - 0.5) * 3); s.life = 0.9 + Math.random() * 0.5; s.m.visible = true;
    }
    this.workUntil = this.clock.elapsedTime + 0.9;
  }
  /** Chữ nổi bay lên tại một ô (ví dụ "+25 kg"). */
  floatText(lot: number, tile: number, text: string, bg = '#ffcf3a') {
    const s = makeLabel(text, bg), p = this.worldOfTile(lot, tile);
    s.position.set(p.x, 3.0, p.z); s.scale.set(3.6, 0.9, 1); s.renderOrder = 10; (s.material as THREE.SpriteMaterial).depthTest = false;
    this.scene.add(s); this.floats.push({ s, life: 1.6 });
  }
  /** Cho nhân vật tự chạy tới một ô (dùng cho nút dẫn đường và kiểm thử). */
  goToTile(lot: number, tile: number) { this.walkTo = this.worldOfTile(lot, tile); }
  teleportToTile(lot: number, tile: number) { this.pos.copy(this.worldOfTile(lot, tile)); this.walkTo = null; this.vel.set(0, 0, 0); }
  goHome() { this.pos.set(0, 0, FENCE.front + 2.5); this.walkTo = null; this.camPos.copy(this.pos); }
  position() { return { x: this.pos.x, z: this.pos.z }; }

  private resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ vòng lặp
  private frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime, now = Date.now() + (this.state?.clockOffset ?? 0);
    this.movePlayer(dt, t);
    this.updateContext(now, t);
    for (const lot of this.lots) lot.animate(t, now, this);
    // Máy quay bám theo nhân vật
    this.camPos.lerp(this.pos, 1 - Math.pow(0.002, dt));
    const portrait = this.camera.aspect < 0.9, k = (portrait ? 1.35 : 1) * this.zoom;
    if (this.opts.demo) { const a = t * 0.12; this.camera.position.set(this.camPos.x + Math.sin(a) * 20, 20, this.camPos.z + Math.cos(a) * 20); }
    else this.camera.position.set(this.camPos.x, 18 * k, this.camPos.z + 17 * k);
    this.camera.lookAt(this.camPos.x, 0.8, this.camPos.z - (this.opts.demo ? 0 : 1.2));
    this.sun.target.position.copy(this.camPos); this.sun.position.set(this.camPos.x + this.sky.dir[0], this.sky.dir[1], this.camPos.z + this.sky.dir[2]);
    this.updateGuide(now, t);
    this.animateLife(dt, t);
    this.renderer.render(this.scene, this.camera);
  }

  private movePlayer(dt: number, t: number) {
    const dir = new THREE.Vector3();
    if (this.opts.demo) { // nhân vật mẫu tự đi vòng quanh ruộng
      const pts = [[-7.4, 6.4], [-7.4, -6.6], [7.4, -6.6], [7.4, 6.4]]; const target = pts[Math.floor(this.demoT) % 4];
      dir.set(target[0] - this.pos.x, 0, target[1] - this.pos.z); if (dir.length() < 0.4) this.demoT++; dir.normalize().multiplyScalar(0.55);
    } else if (!this.paused) {
      dir.set(this.input.x, 0, this.input.y);
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir.x -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir.x += 1;
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) dir.z -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) dir.z += 1;
      if (dir.lengthSq() > 1) dir.normalize();
      if (dir.lengthSq() < 0.01 && this.walkTo) {
        dir.subVectors(this.walkTo, this.pos).setY(0); const d = dir.length();
        if (d < 0.25) { this.walkTo = null; dir.set(0, 0, 0); } else dir.normalize().multiplyScalar(Math.min(1, d / 1.2 + 0.35));
      }
    }
    this.vel.lerp(dir.multiplyScalar(7.5), 1 - Math.pow(0.0005, dt));
    const before = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);
    const R = 0.42;
    for (const [x0, x1, z0, z1] of this.colliders) {
      const cx = THREE.MathUtils.clamp(this.pos.x, x0, x1), cz = THREE.MathUtils.clamp(this.pos.z, z0, z1), dx = this.pos.x - cx, dz = this.pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); this.pos.x = cx + (dx / d) * R; this.pos.z = cz + (dz / d) * R; }
      else { this.pos.copy(before); }
    }
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -WORLD.x, WORLD.x); this.pos.z = THREE.MathUtils.clamp(this.pos.z, WORLD.zMin, WORLD.zMax);
    if (this.walkTo && before.distanceTo(this.pos) < 0.4 * 7.5 * dt * 0.2 && this.vel.length() > 2) this.walkTo = null; // kẹt vật cản thì dừng
    const p = this.player, speed = this.vel.length();
    p.root.position.copy(this.pos);
    if (speed > 0.4) {
      const want = Math.atan2(this.vel.x, this.vel.z); let diff = want - p.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.root.rotation.y += diff * Math.min(1, dt * 14);
      const sw = Math.sin(t * 16) * 0.9 * Math.min(1, speed / 5); p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw; p.armR.rotation.x = sw;
      p.root.position.y = Math.abs(Math.sin(t * 16)) * 0.1; p.root.rotation.x = 0.12;
    } else {
      p.legL.rotation.x = p.legR.rotation.x = 0; p.root.rotation.x = 0;
      if (t < this.workUntil) { const sw = Math.sin(t * 18); p.armL.rotation.x = -1.4 + sw * 0.6; p.armR.rotation.x = -1.4 - sw * 0.6; p.root.position.y = Math.abs(sw) * 0.06; }
      else { p.armL.rotation.x = Math.sin(t * 1.5) * 0.06; p.armR.rotation.x = -Math.sin(t * 1.5) * 0.06; p.root.position.y = Math.sin(t * 2.2) * 0.02; }
    }
  }

  private updateContext(now: number, t: number) {
    let ctx: Context = { kind: 'none' };
    for (let i = 0; i < SLOT_COUNT; i++) {
      const lot = this.lots[i], l = toLocal(i, this.pos.x, this.pos.z);
      const inside = Math.abs(l.x) < FENCE.x && l.z > FENCE.back && l.z < FENCE.front;
      if (!lot.data) { if (i !== 0 && Math.abs(l.x) < FENCE.x && l.z > FENCE.back && l.z < FENCE.front + 3) ctx = { kind: 'empty-lot', lot: i }; continue; }
      if (i === 0 && inside) this.enteredYard = true;
      if (Math.abs(l.x) < PLOT_COLS && Math.abs(l.z) < PLOT_ROWS) {
        const tile = Math.floor((l.z + PLOT_ROWS) / TILE) * PLOT_COLS + Math.floor((l.x + PLOT_COLS) / TILE);
        ctx = { kind: 'tile', lot: i, tile };
        const planting = lot.data.plantings.find((p) => p.tile === tile);
        if (planting && now >= planting.stepReadyAt && !this.opts.demo && (this.readyAt.get(planting.id) ?? 0) < t) { this.readyAt.set(planting.id, t + 1.5); this.opts.onReady?.(i, planting); }
      } else if (Math.hypot(l.x - STALL.x, l.z - (STALL.z + 1.6)) < 2.4) ctx = { kind: 'stall', lot: i };
    }
    if (ctx.kind === 'tile') { const p = this.worldOfTile(ctx.lot, ctx.tile); this.ring.visible = true; this.ring.position.set(p.x, 0.17, p.z); this.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.04); } else this.ring.visible = false;
    const key = JSON.stringify(ctx);
    if (key !== this.ctxKey) { this.ctxKey = key; this.opts.onContext?.(ctx); }
  }

  /** Mũi tên dẫn đường: cổng vườn khi mới tới, sau đó là ô gần nhất đang chờ chăm. */
  private updateGuide(now: number, t: number) {
    const home = this.lots[0]; let target: THREE.Vector3 | null = null;
    if (!this.opts.demo && home.data?.mine) {
      if (!this.enteredYard) target = new THREE.Vector3(0, 0, FENCE.front);
      else { let best = Infinity; for (const p of home.data.plantings) if (now >= p.stepReadyAt) { const w = this.worldOfTile(0, p.tile), d = w.distanceTo(this.pos); if (d < best) { best = d; target = w; } } if (best < 1.6) target = null; }
    }
    this.arrow.visible = !!target;
    if (target) { this.arrow.position.set(target.x, 4.2 + Math.abs(Math.sin(t * 4)) * 0.8, target.z); this.arrow.rotation.y = t * 1.5; }
  }

  private animateLife(dt: number, t: number) {
    for (const o of this.env.children) {
      if (o.userData.sway !== undefined) o.rotation.z = Math.sin(t * 0.9 + o.userData.sway) * 0.03;
      if (o.userData.boat !== undefined) { o.position.y = -0.4 + Math.sin(t * 1.2 + o.userData.boat) * 0.1; o.rotation.z = Math.sin(t * 0.9 + o.userData.boat) * 0.05; }
    }
    if (this.water) this.water.position.y = -0.6 + Math.sin(t * 0.8) * 0.06;
    for (const c of this.chickens) {
      const d = new THREE.Vector3().subVectors(c.target, c.obj.position), dist = d.length();
      if (dist < 0.1) {
        c.wait -= dt; c.obj.children[1].position.y = 0.6 - Math.max(0, Math.sin(t * 6 + c.speed * 9)) * 0.25;
        if (c.wait <= 0) { c.wait = 1.5 + Math.random() * 3; const side = Math.random() < 0.5 ? -1 : 1; c.target.set(side * (7 + Math.random() * 2), 0, -6 + Math.random() * 13); }
      } else { d.normalize(); c.obj.position.addScaledVector(d, Math.min(dist, c.speed * dt)); c.obj.rotation.y = Math.atan2(d.x, d.z); c.obj.position.y = Math.abs(Math.sin(t * 14)) * 0.05; c.obj.children[1].position.y = 0.6; }
    }
    for (const c of this.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 110) c.position.x = -110; }
    for (const f of this.flutter) { f.m.position.set(f.c.x + Math.sin(t * 0.7 + f.ph) * 3, f.c.y + Math.sin(t * 2.3 + f.ph) * 0.5, f.c.z + Math.cos(t * 0.5 + f.ph) * 3); f.m.rotation.set(Math.sin(t * 18 + f.ph) * 1.1, t + f.ph, 0); }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 10 * dt; s.m.position.addScaledVector(s.v, dt); s.m.scale.setScalar(Math.max(0.01, 0.13 * s.life));
      if (s.life <= 0 || s.m.position.y < 0) { s.life = 0; s.m.visible = false; }
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.life -= dt; f.s.position.y += dt * 1.8; (f.s.material as THREE.SpriteMaterial).opacity = Math.min(1, f.life * 2);
      if (f.life <= 0) { this.scene.remove(f.s); (f.s.material as THREE.SpriteMaterial).map?.dispose(); f.s.material.dispose(); this.floats.splice(i, 1); }
    }
  }

  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null);
    for (const fn of this.cleanup) fn();
    this.ro.disconnect(); this.renderer.dispose(); this.renderer.domElement.remove(); this.stickEl.remove();
  }
}
