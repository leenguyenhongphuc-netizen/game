// Màn lái xe tải của Thương lái: rời làng, lên cao tốc ba làn, theo biển rẽ ở nút giao, ghé trạm xăng,
// qua trạm thu phí ETC, ra đường tỉnh tới cổng chào. Chặng biển đi theo luồng có phao số.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { REGIONS } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { ROAD_LIMITS, speedFine } from '../../../shared/rules.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { MORE, bird, cabin, cargoShip, ferry, lighthouse, limitSprite, minSprite, policeUnit, restStop, seaMaterial, skyDecor, wake } from './DriveExtras.ts';

export type Mode = 'truck' | 'boat';
export interface ScenePlan { km: number; needsBoat: boolean; seconds: number; tolls: number; tollFee: number; fuelNeededL: number; junctions: { atKm: number; dir: 'L' | 'R'; name: string }[]; stationsAtKm: number[] }
export interface DriveHud {
  progress: number; kmh: number; mode: Mode; phase: string; kmLeft: number;
  fuel: number; range: number; etcLeft: number; spent: number; detourKm: number; refuelL: number;
  nav: { icon: string; text: string; urgent: boolean }; warn: string | null;
  /** Giới hạn tốc độ hiện hành (km/h; 0 khi đi biển), có đang vượt quá không, km đã chạy, số đang gài, ga tự động, góc nhìn. */
  limit: number; over: boolean; slowLane: boolean; odo: number; gear: 'D' | 'R'; cruise: boolean; view: View; canReverse: boolean;
  /** Độ mệt 0..1, tốc độ tàu (hải lý/giờ), hướng mũi tàu (độ), tổng tiền phạt tạm tính. */
  tired: number; knots: number; heading: number; fines: number; stopped: boolean;
}
export type View = 'chase' | 'pov';
export interface DriveTicket { kmh: number; limit: number; over: number; min: number; max: number; fine: number; points: number; label: string; count: number }
export interface DriveSummary { km: number; detourKm: number; fuelUsed: number; refuelL: number; refuelCost: number; tollCount: number; tollEtc: number; tollCash: number; ranDry: boolean; speeding: number[]; fineTotal: number; rests: number; odoKm: number }
export interface DriveOptions {
  fromRegionId: string; toRegionId: string; plan: ScenePlan; fuelL: number;
  truck: { tankL: number; lPer100km: number; fuelPrice: number }; etc: number; truckColor: string;
  onTick?: (t: DriveHud) => void;
  onBump?: (text: string, kind: 'bad' | 'good' | 'info') => void;
  onFlash?: (text: string) => void;
  onArrive?: (s: DriveSummary) => void;
  /** Bị CSGT dừng xe: hiện biên bản, người chơi bấm "Đã hiểu" thì gọi resume(). */
  onPolice?: (t: DriveTicket) => void;
  view?: View; cruise?: boolean; police?: boolean;
}

const BASE = 30;          // 90 km/h quy ra đơn vị dựng hình mỗi giây
const UK = BASE / 90;     // một km/h bằng bấy nhiêu đơn vị/giây
const VMAX = 140;         // xe chạy được tối đa (km/h) — cao hơn mọi biển để người chơi có thể vi phạm
const SEA_V = 20;         // tốc độ hành trình của phà (12 hải lý/giờ)
const SEA_MAX = 23.5;     // phà chạy hết máy (14 hải lý/giờ)
const POSTED = ROAD_LIMITS.highwayPosted;
const AHEAD = 175;        // tầm nhìn phía trước
const LW = 3.2, HW = 4.8; // bề rộng một làn, nửa bề rộng cao tốc ba làn
const VW = 3.3;           // nửa bề rộng đường làng, đường tỉnh
const CH = 8;             // nửa bề rộng luồng tàu
const G = 13;             // độ tách của hai nhánh ở nút giao
const SEG = 3, SEGS = 64;
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = THREE.MathUtils.clamp;
const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ';

export interface Theme { ground: number; road: number; kinds: string[]; mountains: number | null }
export const THEMES: Record<Zone, Theme> = {
  bac: { ground: 0xa9d672, road: 0x9aa1ab, kinds: ['leaf', 'leaf', 'house', 'rice', 'rock', 'pole', 'leaf'], mountains: 0xa9cbbd },
  trung: { ground: 0xd6dc94, road: 0x9aa1ab, kinds: ['leaf', 'dune', 'house', 'palm', 'pole', 'dune', 'rock'], mountains: 0xc9d3b4 },
  taynguyen: { ground: 0xb4cf78, road: 0xdc9a78, kinds: ['pine', 'pine', 'bush', 'house', 'pole', 'pine', 'rock'], mountains: 0x9cc79a },
  nam: { ground: 0xa4d977, road: 0xa3aab4, kinds: ['palm', 'palm', 'rice', 'pond', 'house', 'pole', 'rice'], mountains: null },
  dao: { ground: 0xf0e3b4, road: 0xe6d3a0, kinds: ['palm', 'palm', 'rock', 'house', 'palm', 'pole', 'dune'], mountains: null },
};
const SEA_KINDS = ['islet', 'ghe', 'islet', 'seastone'];

/** Gộp các khối cùng chất liệu thành một lưới (bản rút gọn, đủ dùng cho vật trang trí). */
export function bake(root: THREE.Group, shadow = false): THREE.Group {
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
export function gradient(top: number, bottom: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#' + new THREE.Color(top).getHexString()); grad.addColorStop(0.6, '#' + new THREE.Color(bottom).getHexString());
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeSign(text: string, bg: string, fg = '#ffffff'): THREE.Sprite {
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

export type Prefab = () => THREE.Group;
export const SCENERY: Record<string, Prefab> = {
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

// ---------------------------------------------------------------- cảnh vật bổ sung (riêng màn lái)
const box = (c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, o?: { emissive?: number; rough?: number }) => mesh(GEO.box, mat(c, o), x, y, z, sx, sy, sz);
const EXTRA: Record<string, Prefab> = {
  // Nhà mái ngói ba gian
  thouse: () => { const g = new THREE.Group(), tile = [0xd9694a, 0xc9583f, 0xe07a52][Math.floor(Math.random() * 3)]; g.add(box(0xfff3da, 0, 1.0, 0, 4.4, 2.0, 3.0), box(0xf3e3ae, 0, 0.12, 2.0, 5.2, 0.24, 1.4)); for (const s of [-1, 1]) { const r = box(tile, 0, 2.55, s * 0.85, 4.9, 0.16, 2.1); r.rotation.x = s * 0.5; g.add(r); } g.add(box(0x8a5a3c, 0, 0.8, 1.52, 0.8, 1.5, 0.06), box(0x8ec9dc, -1.4, 1.2, 1.52, 0.7, 0.7, 0.06), box(0x8ec9dc, 1.4, 1.2, 1.52, 0.7, 0.7, 0.06)); for (const x of [-2.3, 2.3]) g.add(mesh(GEO.cyl, mat(0x9a6238), x, 0.9, 2.5, 0.09, 1.6, 0.09)); return g; },
  // Sạp trái cây ven đường
  stall: () => { const g = new THREE.Group(), cols = [0xf4c430, 0xdc342b, 0x9bd64a, 0xf08a24]; g.add(box(0xc9975a, 0, 0.75, 0, 2.6, 0.14, 1.3)); for (const [x, z] of [[-1.2, -0.55], [1.2, -0.55], [-1.2, 0.55], [1.2, 0.55]]) g.add(mesh(GEO.cyl, mat(0x9a6238), x, 1.1, z, 0.06, 2.2, 0.06)); for (let i = 0; i < 4; i++) g.add(box(i % 2 ? 0xffffff : 0xe8457f, -0.98 + i * 0.65, 2.25, 0, 0.65, 0.08, 1.7)); for (let i = 0; i < 8; i++) g.add(mesh(GEO.ball, mat(cols[i % 4], { rough: 0.5 }), -1 + (i % 4) * 0.66, 1.0, -0.25 + Math.floor(i / 4) * 0.5, 0.22)); return g; },
  // Hàng rào gỗ chạy dọc đường
  fence: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) g.add(box(0xe9d2a6, 0, 0.5, -3 + i * 1.5, 0.12, 1.0, 0.14)); g.add(box(0xe9d2a6, 0, 0.75, 0, 0.08, 0.1, 6.2), box(0xe9d2a6, 0, 0.4, 0, 0.08, 0.1, 6.2)); return g; },
  // Núi đá vôi
  karst: () => { const g = new THREE.Group(); for (const [x, z, h, w] of [[0, 0, 15, 5.5], [5, 2, 10, 4.2], [-4.5, -1.5, 8, 3.8]]) g.add(mesh(GEO.sphere, mat(0x9fb1a6, { rough: 1 }), x, h * 0.42, z, w, h, w * 0.9), mesh(GEO.sphere, mat(0x7fbf7a, { rough: 1 }), x, h * 0.86, z, w * 0.72, h * 0.3, w * 0.66)); return g; },
  // Đồi cà phê đất đỏ
  coffee: () => { const g = new THREE.Group(); g.add(mesh(GEO.ball, mat(0xc9714a, { rough: 1 }), 0, -0.6, 0, 7, 2.0, 5.2)); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(mesh(GEO.ball, mat((i + j) % 2 ? 0x3f8f4f : 0x4fa35c), -4 + i * 2.6, 1.0 - Math.abs(i - 1.5) * 0.3, -2.4 + j * 2.4, 0.9, 0.75, 0.9), mesh(GEO.ball, mat(0xc0281e), -3.7 + i * 2.6, 1.6 - Math.abs(i - 1.5) * 0.3, -2.2 + j * 2.4, 0.13)); return g; },
  // Vườn cây ăn trái
  orchard: () => { const g = new THREE.Group(), fr = [0xf4c430, 0xf08a24, 0xdc342b][Math.floor(Math.random() * 3)]; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = -3 + i * 3, z = -1.5 + j * 3; g.add(mesh(GEO.cyl, mat(0x9a7150), x, 0.6, z, 0.14, 1.2, 0.14), mesh(GEO.ball, mat(0x57b05f), x, 1.9, z, 1.2, 1.0, 1.2), mesh(GEO.ball, mat(fr, { rough: 0.5 }), x + 0.6, 1.6, z + 0.7, 0.2), mesh(GEO.ball, mat(fr, { rough: 0.5 }), x - 0.5, 2.0, z + 0.9, 0.2)); } return g; },
  // Rặng dừa bên mương nước
  coconut: () => { const g = new THREE.Group(); g.add(box(0x8fd8ea, 0, 0.04, 2.2, 9, 0.06, 2.2, { rough: 0.25 })); for (let i = 0; i < 3; i++) { const p = SCENERY.palm(); p.position.set(-3 + i * 3, 0, -0.6 + (i % 2)); p.scale.setScalar(0.9 + (i % 2) * 0.2); g.add(p); } return g; },
  // Kênh có cầu khỉ và xuồng
  canal: () => { const g = new THREE.Group(); g.add(box(0x8fd8ea, 0, 0.04, 0, 16, 0.06, 3.2, { rough: 0.25 }), box(0xc98a52, 2, 0.9, 0, 0.5, 0.1, 4.4)); for (const z of [-1.9, 1.9]) g.add(mesh(GEO.cyl, mat(0x9a6238), 2, 0.5, z, 0.07, 1.0, 0.07)); g.add(box(0xb9855a, -3, 0.2, 0.3, 2.6, 0.3, 0.8), mesh(GEO.cyl, mat(0x5cb85f), 6, 0.1, 0.6, 0.5, 0.03, 0.5)); return g; },
  // Biển quảng cáo ven cao tốc
  billboard: () => { const g = new THREE.Group(), c = [0xf2b25c, 0x6fb7d9, 0xf08a6c, 0x8fd67c][Math.floor(Math.random() * 4)]; for (const z of [-2, 2]) g.add(mesh(GEO.cyl, mat(0x8f97a3), 0, 2.2, z, 0.12, 4.4, 0.12)); g.add(box(0xffffff, 0, 5.2, 0, 0.2, 2.6, 6.2), box(c, 0.02, 5.2, 0, 0.22, 2.2, 5.8), mesh(GEO.ball, mat(0xffffff), 0.14, 5.4, 1.2, 0.1, 0.6, 0.6), box(0xffffff, 0.14, 4.9, -0.6, 0.06, 0.3, 2.6)); return g; },
};
const VILLAGE = ['thouse', 'tube', 'fence', 'stall', 'thouse', 'leaf', 'pole', 'fence', 'palm', 'house', 'tube', 'paddy'];
const ZONE_KINDS: Record<Zone, string[]> = {
  bac: ['karst', 'paddy', 'leaf', 'tea', 'thouse', 'leaf', 'billboard', 'karst', 'rock', 'lamp', 'kmpost', 'paddy'],
  trung: ['dune', 'palm', 'paddy', 'leaf', 'thouse', 'dune', 'billboard', 'rock', 'karst', 'lamp', 'kmpost'],
  taynguyen: ['coffee', 'pine', 'tea', 'coffee', 'bush', 'house', 'billboard', 'pine', 'rock', 'lamp', 'kmpost'],
  nam: ['coconut', 'paddy', 'canal', 'orchard', 'palm', 'rice', 'thouse', 'billboard', 'pond', 'lamp', 'kmpost'],
  dao: ['palm', 'palm', 'rock', 'dune', 'house', 'palm', 'dune'],
};
const WIDE = new Set(['rice', 'pond', 'canal', 'coffee', 'karst', 'orchard', 'coconut', 'dune', 'tea', 'paddy']);
const EDGE: Record<string, number> = { pole: 1.6, fence: 1.3, stall: 2.4, kmpost: 1.25, lamp: 1.9 };

// ---------------------------------------------------------------- xe cộ trên đường, vật trên biển
function sedan(): THREE.Group { const g = new THREE.Group(), c = [0xffffff, 0xd9482b, 0x4a78c8, 0x3f4652, 0xf2c94c, 0x9aa7b5][Math.floor(Math.random() * 6)]; g.add(box(c, 0, 0.62, 0, 1.75, 0.6, 3.9), box(c, 0, 1.12, 0.2, 1.55, 0.5, 2.0), box(0xbfe6f7, 0, 1.14, -0.83, 1.4, 0.4, 0.06, { rough: 0.3 }), box(0xbfe6f7, 0, 1.14, 1.22, 1.4, 0.4, 0.06, { rough: 0.3 }), box(0xe0342b, 0, 0.7, 1.96, 1.5, 0.14, 0.05)); for (const [x, z] of [[-0.85, -1.2], [0.85, -1.2], [-0.85, 1.2], [0.85, 1.2]]) g.add(wheel(x, z, 0.34)); return g; }
function coach(): THREE.Group { const g = new THREE.Group(), c = [0xf08a24, 0x3f8fd6, 0xdc4a6a, 0x38a169][Math.floor(Math.random() * 4)]; g.add(box(c, 0, 1.55, 0, 2.3, 2.3, 7.4), box(0xfff6dc, 0, 2.75, 0, 2.1, 0.12, 7.0), box(0x2f3a4a, -1.16, 1.95, 0, 0.04, 0.8, 6.4), box(0x2f3a4a, 1.16, 1.95, 0, 0.04, 0.8, 6.4), box(0x2f3a4a, 0, 1.95, 3.71, 1.9, 0.8, 0.04), box(0xbfe6f7, 0, 1.9, -3.71, 2.0, 1.0, 0.04, { rough: 0.3 }), box(0xe0342b, -0.8, 0.8, 3.72, 0.4, 0.2, 0.05), box(0xe0342b, 0.8, 0.8, 3.72, 0.4, 0.2, 0.05)); for (const [x, z] of [[-1.05, -2.4], [1.05, -2.4], [-1.05, 2.3], [1.05, 2.3]]) g.add(wheel(x, z, 0.46)); return g; }
function contTruck(): THREE.Group { const g = new THREE.Group(), c = [0xc0392b, 0x2e7d6b, 0x3b6fb5, 0xd98a2b][Math.floor(Math.random() * 4)]; g.add(box(0x4a5160, 0, 0.7, 0.6, 2.2, 0.3, 9.4), box(0xf4f1e8, 0, 1.75, -3.9, 2.3, 2.0, 1.7), box(0xbfe6f7, 0, 2.1, -4.77, 2.0, 0.8, 0.05, { rough: 0.3 }), box(c, 0, 2.2, 1.3, 2.4, 2.7, 7.8)); for (let i = 0; i < 6; i++) g.add(box(0x000000, 1.21, 2.2, -2 + i * 1.3, 0.02, 2.5, 0.06, { rough: 1 })); g.add(box(0xe0342b, -0.8, 0.9, 5.22, 0.4, 0.2, 0.05), box(0xe0342b, 0.8, 0.9, 5.22, 0.4, 0.2, 0.05)); for (const [x, z] of [[-1.05, -3.9], [1.05, -3.9], [-1.05, 2.6], [1.05, 2.6], [-1.05, 3.8], [1.05, 3.8]]) g.add(wheel(x, z, 0.48)); return g; }
function motorbike(): THREE.Group { const g = new THREE.Group(), c = [0xe0342b, 0x3f8fd6, 0x38a169][Math.floor(Math.random() * 3)]; g.add(box(c, 0, 0.6, 0, 0.4, 0.4, 1.5), wheel(0, -0.7, 0.32), wheel(0, 0.7, 0.32), mesh(GEO.cyl, mat(0x5aa9e6), 0, 1.25, -0.1, 0.26, 0.7, 0.22), mesh(GEO.ball, mat(0xf6cfa8), 0, 1.8, -0.1, 0.24), mesh(new THREE.ConeGeometry(0.42, 0.24, 10), mat(0xf2dc9a), 0, 2.05, -0.1), box(0xc9975a, 0, 1.1, 0.75, 1.0, 0.7, 0.7), mesh(GEO.ball, mat(0xf4c430), -0.2, 1.55, 0.75, 0.2), mesh(GEO.ball, mat(0x9bd64a), 0.2, 1.55, 0.8, 0.2)); return g; }
interface VehDef { build: Prefab; hw: number; hl: number }
const VEH: Record<string, VehDef> = {
  sedan: { build: sedan, hw: 0.9, hl: 2.0 }, coach: { build: coach, hw: 1.15, hl: 3.7 }, container: { build: contTruck, hw: 1.2, hl: 4.9 }, xemay: { build: motorbike, hw: 0.55, hl: 0.9 },
  nguoc: { hw: 1.05, hl: 2.3, build: () => { const t = buildTruck([0x6fb7d9, 0xf2b25c, 0xa98bd6][Math.floor(Math.random() * 3)], false); t.rotation.y = Math.PI; const g = new THREE.Group(); g.add(t); return g; } },
  // trên biển
  ghe: { hw: 0.9, hl: 2.1, build: () => SCENERY.ghe() },
  da: { hw: 1.4, hl: 1.2, build: () => SCENERY.seastone() },
  thung: { hw: 0.95, hl: 0.95, build: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x3f6f9a), 0, 0.3, 0, 0.95, 0.5, 0.95), mesh(GEO.cyl, mat(0x6fb7d9), 0, 0.5, 0, 0.82, 0.12, 0.82), mesh(GEO.cyl, mat(0x8a5a3c), 0, 1.0, 0, 0.26, 0.7, 0.22), mesh(GEO.ball, mat(0xf6cfa8), 0, 1.55, 0, 0.24), mesh(new THREE.ConeGeometry(0.44, 0.24, 10), mat(0xf2dc9a), 0, 1.8, 0)); return g; } },
  song: { hw: 3.0, hl: 0.8, build: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(mesh(GEO.ball, mat(i % 2 ? 0xffffff : 0xbfe9f5, { rough: 0.3 }), -2.6 + i * 1.05, 0.25, (i % 2) * 0.25, 0.75, 0.55, 0.6)); return g; } },
};
function buoy(color: number, big = false): THREE.Group { const g = new THREE.Group(), k = big ? 1.7 : 1; g.add(mesh(GEO.cyl, mat(color), 0, 0.35 * k, 0, 0.55 * k, 0.6 * k, 0.55 * k), mesh(GEO.cyl, mat(0xffffff), 0, 0.75 * k, 0, 0.45 * k, 0.2 * k, 0.45 * k), mesh(GEO.cone, mat(color), 0, 1.15 * k, 0, 0.3 * k, 0.6 * k, 0.3 * k)); return g; }

// ---------------------------------------------------------------- công trình trên đường
const POST = 0x8f97a3, GREEN = '#1f8a4c', BLUE = '#2f6fd0';
function sign(text: string, bg: string, w: number, fg = '#ffffff'): THREE.Sprite { const s = makeSign(text, bg, fg); s.scale.set(w, w / 4, 1); return s; }
/** Giá long môn bắc ngang đường, treo các biển chữ. */
function gantry(half: number, signs: { text: string; x: number; w?: number; bg?: string }[]): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-half - 1.0, half + 1.0]) g.add(mesh(GEO.cyl, mat(POST), x, 3.5, 0, 0.16, 7.0, 0.16));
  g.add(box(POST, 0, 6.95, 0, half * 2 + 2.4, 0.22, 0.3), box(POST, 0, 6.45, 0, half * 2 + 2.4, 0.12, 0.2));
  const out = bake(g, true);
  for (const s of signs) { const sp = sign(s.text, s.bg ?? GREEN, s.w ?? 7.2); sp.position.set(s.x, 8.0, 0.1); out.add(sp); }
  return out;
}
function roadside(text: string, bg: string, w = 6): THREE.Group { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(POST), 0, 1.7, 0, 0.1, 3.4, 0.1)); const out = bake(g, true); const sp = sign(text, bg, w); sp.position.y = 3.9; out.add(sp); return out; }
function tollPlaza(): { root: THREE.Group; arms: THREE.Object3D[] } {
  const g = new THREE.Group();
  for (const x of [-HW - 0.45, -LW / 2, LW / 2, HW + 0.45]) { g.add(box(0xf2c94c, x, 0.22, 0, 0.6, 0.44, 7), box(0x3f4652, x, 0.23, -3.3, 0.62, 0.46, 0.5), box(0xfff6e2, x, 1.5, 1.2, 0.56, 2.1, 1.5), box(0x8ec9dc, x, 1.8, 0.43, 0.5, 0.7, 0.04), mesh(GEO.cyl, mat(POST), x, 3.4, 2.4, 0.14, 6.4, 0.14)); }
  g.add(box(0x2f6fd0, 0, 6.75, 2.2, HW * 2 + 5, 0.5, 4.2), box(0xffffff, 0, 6.42, 0.06, HW * 2 + 5, 0.16, 0.12));
  const root = bake(g, true), arms: THREE.Object3D[] = [];
  for (const x of [-LW / 2, LW / 2, HW + 0.45]) { const a = new THREE.Group(); a.position.set(x - 0.3, 1.15, -1.5); for (let i = 0; i < 4; i++) a.add(box(i % 2 ? 0xffffff : 0xe0342b, -0.3 - i * 0.62, 0, 0, 0.62, 0.14, 0.1)); root.add(a); arms.push(a); }
  [-LW, 0, LW].forEach((x) => { const s = sign('ETC', '#f08a24', 2.6); s.position.set(x, 7.75, 0.2); root.add(s); });
  return { root, arms };
}
function fuelStation(price: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0xb8bec6, 4.5, 0.02, 0, 11, 0.04, 16, { rough: 1 }), box(0xf08a24, 4.2, 5.3, 0, 8.4, 0.45, 9), box(0xffffff, 4.2, 5.0, 0, 8.6, 0.16, 9.2));
  for (const [x, z] of [[0.8, -3.6], [0.8, 3.6], [7.6, -3.6], [7.6, 3.6]]) g.add(mesh(GEO.cyl, mat(0xf3f4f6), x, 2.6, z, 0.2, 5.2, 0.2));
  for (const z of [-2, 2]) g.add(box(0x9aa1ab, 1.4, 0.15, z, 1.0, 0.3, 2.2), box(0xe0342b, 1.4, 1.05, z, 0.7, 1.5, 0.9), box(0xffffff, 1.4, 1.45, z - 0.46, 0.5, 0.4, 0.03));
  g.add(box(0xfff6e2, 11.5, 1.6, 0, 4, 3.2, 8), box(0xf08a24, 11.5, 3.3, 0, 4.3, 0.3, 8.3), box(0x8ec9dc, 9.48, 1.5, 0, 0.04, 1.6, 5));
  const out = bake(g, true);
  const s = sign(`⛽ ${vnd(price)}/lít`, '#f08a24', 6.4); s.position.set(4.2, 6.6, 0); out.add(s);
  return out;
}
function overpass(): THREE.Group { const g = new THREE.Group(); g.add(box(0xc9cdd3, 0, 10.6, 0, 110, 0.9, 6), box(0xe6e8ec, 0, 11.4, -2.9, 110, 0.7, 0.25), box(0xe6e8ec, 0, 11.4, 2.9, 110, 0.7, 0.25)); for (const x of [-HW - 1.2, HW + 1.6, -HW * 3 - 5]) g.add(box(0xb8bec6, x, 5.1, 0, 0.9, 10.2, 3.4)); return bake(g, true); }
function tunnel(): THREE.Group {
  const g = new THREE.Group(), half = HW + 2.8, len = 56;
  // Hầm hở giữa hai sườn núi: vách hai bên, các sườn bê tông bắc ngang, nhìn từ trên vẫn thấy xe
  for (const sd of [-1, 1]) { const hill = mesh(GEO.sphere, mat(0x7fbf7a, { rough: 1 }), sd * (half + 31), 0, 0, 31.5, 22, len / 2 + 6); hill.castShadow = false; g.add(hill, mesh(GEO.sphere, mat(0x9fb1a6, { rough: 1 }), sd * (half + 20), 0, sd * 6, 18, 13, len / 2 - 4)); }
  const tube = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 7.6, len), new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 1, side: THREE.BackSide })); tube.position.y = 3.8; g.add(tube);
  for (let z = -len / 2 + 7; z < len / 2 - 3; z += 7) g.add(box(0xc9cdd3, 0, 7.9, z, half * 2 + 1.2, 0.6, 0.9));
  for (const z of [-len / 2 - 0.2, len / 2 + 0.2]) { g.add(box(0xd9dde2, -half - 0.6, 4, z, 1.2, 8, 1), box(0xd9dde2, half + 0.6, 4, z, 1.2, 8, 1), box(0xd9dde2, 0, 8.2, z, half * 2 + 2.4, 1.2, 1)); }
  for (let i = 0; i < 7; i++) for (const x of [-half + 0.1, half - 0.1]) g.add(box(0xfff3b0, x, 4.6, -24 + i * 8, 0.1, 0.3, 2.4, { emissive: 0xffe08a }));
  return g;
}
function pylon(): THREE.Group { const g = new THREE.Group(); for (const x of [-HW - 1.3, HW + 1.3]) { g.add(box(0xf3f4f6, x, 9, 0, 0.8, 18, 1.2)); for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) { const c = box(0xf3f4f6, x, 9 - i * 0.2 + 4.3 - i * 1.6, s * i * 2.6, 0.08, 0.08, Math.hypot(i * 5.2, 16 - i * 3.4)); c.rotation.x = s * Math.atan2(16 - i * 3.4, i * 5.2); g.add(c); } } g.add(box(0xf3f4f6, 0, 16.5, 0, HW * 2 + 3.4, 0.8, 1.0)); return bake(g, true); }

/** Cọc cắm biển tròn giới hạn tốc độ (kèm biển tốc độ tối thiểu nếu có). */
function limitPost(v: number, min = 0): THREE.Group {
  const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(POST), 0, 1.6, 0, 0.08, 3.2, 0.08)); const out = bake(g, true);
  const sp = limitSprite(v); sp.position.y = 3.6; out.add(sp); if (min) { const m2 = minSprite(min); m2.position.y = 1.7; out.add(m2); }
  return out;
}
/** Ô dừng xe kẻ sơn trên làn phụ của trạm. */
function stopBox(color: number): THREE.Group {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color });
  for (const [x, z, sx, sz] of [[-1.35, 0, 0.16, 12], [1.35, 0, 0.16, 12], [0, -6, 2.86, 0.16], [0, 6, 2.86, 0.16]]) { const b = new THREE.Mesh(GEO.box, m); b.position.set(x, 0.03, z); b.scale.set(sx, 0.02, sz); g.add(b); }
  for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(GEO.box, m); b.position.set(0, 0.03, i * 2.2); b.scale.set(2.2, 0.02, 0.12); b.rotation.y = 0.6; g.add(b); }
  return g;
}
interface EvObj { o: THREE.Object3D; ds: number; x: number; base?: boolean }
interface Ev {
  type: 'junction' | 'station' | 'rest' | 'toll' | 'feature' | 'police' | 'limit'; s: number; rs: number; pre: number; post: number;
  dir: number; name: string; exit: boolean; sigma: number; done: boolean; retry: boolean; bend: number; idx: number;
  kind: string; objs: EvObj[]; arms: THREE.Object3D[]; lift: number; mapAng: number;
  /** limit: trị số biển; police: có tổ công tác không, tốc độ vượt lớn nhất đo được, đèn nháy. */
  v: number; armed: boolean; meas: number; measKmh: number; lights: THREE.Mesh[];
}
interface Car { obj: THREE.Group; kind: string; s: number; x: number; v: number; vx: number; active: boolean; hit: boolean; j: Ev | null; sig: number }
interface Scen { obj: THREE.Group; kind: string; s: number; X: number; active: boolean }
interface Detour { from: number; len: number; km: number; j: Ev; turned: boolean }
interface Leg { mode: Mode; seconds: number; km: number }
interface MapPt { x: number; y: number; km: number }

export class DriveScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.3, 420);
  private clock = new THREE.Clock();
  private sun: THREE.DirectionalLight; private hemi!: THREE.HemisphereLight; private sky!: THREE.Texture; private dark = 0; private darkCol = new THREE.Color(0x232831); private fogCol = new THREE.Color(0xdff3fb);
  private truck: THREE.Group; private boat: THREE.Group; private wheels: THREE.Object3D[] = [];
  private ground: THREE.Mesh; private sea: THREE.Mesh; private mountains = new THREE.Group();
  private roadA: THREE.Mesh; private roadB: THREE.Mesh; private lineL: THREE.Mesh; private lineR: THREE.Mesh;
  private median: THREE.Mesh; private barrier: THREE.Mesh; private opp: THREE.Mesh; private guard: THREE.Mesh;
  private dashes: THREE.Mesh[] = []; private buoys: THREE.Group[] = [];
  private scen: Scen[] = []; private cars: Car[] = []; private oncoming: { obj: THREE.Group; s: number; lane: number }[] = [];
  private props: { o: THREE.Object3D; s: number; x: number; mode: Mode }[] = [];
  private sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  // lộ trình
  private legs: Leg[] = []; private legIdx = 0; private mode: Mode = 'truck';
  private events: Ev[] = []; private juncs: Ev[] = []; private baseJ: Ev[] = []; private stations: Ev[] = []; private tolls: Ev[] = []; private feats: Ev[] = [];
  private detours: Detour[] = []; private exitDone: Ev | null = null;
  private rampS = 95; private exS = 150; private endS = 0; private road0 = 0; private mul = 1; private kmU = 0; private roadKm = 0; private seaKm = 0; private seaL = 0;
  private gates: number[] = [];
  private tplan: { s: number; kind: string; x: number; v: number }[] = []; private tIdx = 0;
  // trạng thái
  private s = 0; private cx = 0; private px = 0; private pv = 0; private speed = 0; private phi = 0;
  private fuel: number; private etcLeft: number; private fuelUsed = 0; private refuelL = 0; private detourKm = 0; private tollEtc = 0; private tollCash = 0; private tollCount = 0; private stationsPassed = 0; private ranDry = false;
  private running = false; private arrived = false; private pause = 0; private slow = 0; private shake = 0; private elapsed = 0; private legT = 0; private tickAcc = 0; private switching = 0;
  private offChan = false; private warnDry = false; private kmDoneBefore = 0;
  private nextSc = 6; private r = rng(20261121);
  private keys = new Set<string>(); private drag: { id: number; x: number; px: number } | null = null; private target: number | null = null; private holdX: number | null = null; private btn = 0;
  private cleanup: (() => void)[] = []; private ro: ResizeObserver; private disposed = false;
  private container: HTMLElement; private opts: DriveOptions;
  private e2: [number, number] = [0, 0]; private tmp = [0, 0, 0, 0];
  private mapRoad: MapPt[] = []; private mapSea: MapPt[] = [];
  private fromName: string; private toName: string; private zf: Zone; private zt: Zone;
  // lái thật: ga, thắng, số, ga tự động, góc nhìn
  private throttle = 0; private brakeIn = 0; private gear: 'D' | 'R' = 'D'; private cruise = false; private view: View = 'chase'; private braking = false;
  private odo = 0; private tired = 0; private rests = 0; private speeding: number[] = []; private fineTotal = 0; private lowT = 0; private nagT = 0; private revFloor = 0; private yawn = 0;
  private pulled: { e: Ev; over: number; kmh: number; limit: number; shown: boolean; go: boolean } | null = null;
  private auxs: Ev[] = []; private limits: Ev[] = []; private polices: Ev[] = [];
  private cab!: ReturnType<typeof cabin>; private brakeL: THREE.Mesh[] = []; private posts!: THREE.InstancedMesh; private seaMat!: THREE.ShaderMaterial; private wakeM!: THREE.Mesh;
  private birds: { b: ReturnType<typeof bird>; a: number; r: number; h: number; w: number }[] = []; private decor!: THREE.Group; private m4 = new THREE.Matrix4(); private camV = new THREE.Vector3(); private fovNow = 50;

  constructor(container: HTMLElement, opts: DriveOptions) {
    // Chuyến dài có nhiều trạm thu phí hơn số trạm dựng được trên đường (tối đa 6): gộp phí theo chặng
    // để tổng tiền trên màn lái khớp với tổng máy chủ tính theo kế hoạch.
    const pt = opts.plan.tolls | 0;
    if (pt > 6) opts = { ...opts, plan: { ...opts.plan, tolls: 6, tollFee: Math.round((pt * opts.plan.tollFee) / 6 / 1000) * 1000 } };
    this.container = container; this.opts = opts;
    const plan = opts.plan, T = clamp(plan.seconds || 30, 20, 90);
    const from = REGIONS[opts.fromRegionId], to = REGIONS[opts.toRegionId];
    this.fromName = from?.name ?? 'Nơi đi'; this.toName = to?.name ?? 'Nơi đến';
    this.zf = from?.zone ?? 'nam'; this.zt = to?.zone ?? 'nam';
    this.fuel = Math.max(0, opts.fuelL); this.etcLeft = Math.max(0, opts.etc); this.view = opts.view ?? 'chase'; this.cruise = !!opts.cruise;
    this.roadKm = plan.needsBoat ? plan.km * 0.6 : plan.km; this.seaKm = plan.needsBoat ? plan.km * 0.4 : 0;
    const road: Leg = { mode: 'truck', seconds: plan.needsBoat ? T * 0.6 : T, km: this.roadKm }, sea: Leg = { mode: 'boat', seconds: T * 0.4, km: this.seaKm };
    this.legs = !plan.needsBoat ? [road] : from?.island ? [sea, road] : [road, sea];
    this.seaL = Math.max(300, SEA_V * sea.seconds);
    this.layout(road.seconds);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    const el = this.renderer.domElement; el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none';
    container.appendChild(el);
    this.scene.background = gradient(0x8fd0f5, 0xdff3fb); this.scene.fog = new THREE.Fog(0xdff3fb, 80, AHEAD + 20);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.1); this.sun.position.set(10, 22, 0); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -20, right: 20, top: 34, bottom: -14, near: 1, far: 70 }); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 4;
    this.sun.target.position.set(0, 0, -8);
    this.hemi = new THREE.HemisphereLight(0xfafcff, 0xd6e6b0, 1.35); this.sky = this.scene.background as THREE.Texture;
    this.decor = skyDecor(); this.scene.add(this.hemi, this.sun, this.sun.target, this.world, this.camera, this.decor);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: THEMES[this.zf].ground, roughness: 1 }));
    this.ground.position.set(0, -0.06, -150); this.ground.receiveShadow = true;
    this.seaMat = seaMaterial(this.scene.fog as THREE.Fog);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), this.seaMat);
    this.sea.position.set(0, -0.05, -150);
    const strip = (color: number, shadow = true) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 6), 3)); const n = new Float32Array((SEGS + 1) * 6); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); const idx: number[] = []; for (let i = 0; i < SEGS; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); g.setIndex(idx); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide })); m.receiveShadow = shadow; m.frustumCulled = false; this.world.add(m); return m; };
    this.opp = strip(0x7f8690); this.median = strip(0x6fb56a); this.roadB = strip(0x7f8690); this.roadA = strip(THEMES[this.zf].road);
    this.lineL = strip(0xfbf3df, false); this.lineR = strip(0xfbf3df, false); this.barrier = strip(0xd9dde2, false); this.guard = strip(0xc5cbd3, false);
    this.scene.add(this.ground, this.sea, this.mountains);
    for (let i = 0; i < 46; i++) { const d = mesh(GEO.box, mat(0xffffff), 0, 0.03, 0, 0.2, 0.02, 3.0); d.castShadow = false; d.receiveShadow = false; this.dashes.push(d); this.world.add(d); }
    for (let i = 0; i < 26; i++) { const b = bake(buoy(i % 2 ? 0x2faa5a : 0xe0342b)); b.scale.setScalar(0.75); this.buoys.push(b); this.world.add(b); }
    for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225, h = 26 + this.r() * 26; const m = mesh(new THREE.ConeGeometry(22 + this.r() * 16, h, 7), mat(0xa9cbbd, { rough: 1 }), Math.sin(a) * 230, h / 2 - 3, -170 - Math.cos(a) * 60); m.castShadow = false; this.mountains.add(m); }

    const color = new THREE.Color(opts.truckColor || '#f08a6c').getHex();
    this.truck = buildTruck(color);
    { const t = buildTruck(color); t.scale.setScalar(0.9); t.position.set(-1.05, 1.02, -1.2); const c2 = sedan(); c2.scale.setScalar(0.9); c2.position.set(1.05, 1.02, 0.2); const c3 = sedan(); c3.scale.setScalar(0.9); c3.position.set(1.05, 1.02, -3.4);
      this.boat = bake(ferry([t, c2, c3]), true); this.wakeM = wake(); this.boat.add(this.wakeM); }
    for (const x of [-0.7, 0.7]) { const b = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0xff2a1a })); b.position.set(x, 0.95, 2.34); b.scale.set(0.42, 0.24, 0.06); b.visible = false; this.truck.add(b); this.brakeL.push(b); }
    this.cab = cabin(color); this.cab.root.visible = false; this.camera.add(this.cab.root);
    this.posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), new THREE.MeshStandardMaterial({ color: 0xeef0f3, roughness: 0.6 }), 96); this.posts.frustumCulled = false; this.posts.castShadow = false; this.world.add(this.posts);
    this.truck.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry === GEO.cyl && Math.abs(o.rotation.z - Math.PI / 2) < 0.01) this.wheels.push(o); });
    this.world.add(this.truck, this.boat);
    // Bể cảnh vật, xe cộ, hạt bụi
    const all: Record<string, Prefab> = { ...SCENERY, ...EXTRA, ...MORE };
    const used = new Set<string>([...VILLAGE, ...ZONE_KINDS[this.zf], ...ZONE_KINDS[this.zt], ...ZONE_KINDS.trung, ...(plan.needsBoat ? SEA_KINDS : [])]);
    for (const kind of used) for (let i = 0; i < (kind === 'pole' || kind === 'billboard' || kind === 'tea' ? 4 : kind === 'lamp' || kind === 'kmpost' ? 6 : 7); i++) { const obj = bake(all[kind]()); obj.visible = false; this.world.add(obj); this.scen.push({ obj, kind, s: -1e9, X: 0, active: false }); }
    for (const kind of Object.keys(VEH)) { const seaKind = /ghe|da|thung|song/.test(kind); if (seaKind && !plan.needsBoat) continue; for (let i = 0; i < (kind === 'sedan' ? 6 : 4); i++) { const obj = bake(VEH[kind].build(), true); obj.visible = false; this.world.add(obj); this.cars.push({ obj, kind, s: -1e9, x: 0, v: 0, vx: 0, active: false, hit: false, j: null, sig: 0 }); } }
    for (let i = 0; i < 5; i++) { const obj = bake((i % 3 === 0 ? coach : i % 3 === 1 ? sedan : contTruck)(), false); obj.rotation.y = Math.PI; obj.visible = false; this.world.add(obj); this.oncoming.push({ obj, s: 60 + i * 55, lane: (i % 3) - 1 }); }
    for (let i = 0; i < 20; i++) { const m = mesh(GEO.ball, mat(0xffffff), 0, -10, 0, 0.12); m.castShadow = false; m.visible = false; this.world.add(m); this.sparks.push({ m, v: new THREE.Vector3(), life: 0 }); }
    this.buildProps();
    for (const e of this.events) this.buildEvent(e);
    this.planTraffic();
    this.buildMap();
    this.bindInput(el);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.applyLeg(true);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- dựng lộ trình
  private layout(roadSec: number) {
    const p = this.opts.plan, km = Math.max(1, this.roadKm);
    const planned = Math.max(260, (roadSec - 20) * BASE);
    const want: { ev: Ev; f: number }[] = [];
    const mk = (type: Ev['type'], pre: number, post: number, extra: Partial<Ev> = {}): Ev => ({ type, s: 0, rs: 0, pre, post, dir: 1, name: '', exit: false, sigma: 0, done: false, retry: false, bend: 0, idx: 0, kind: '', objs: [], arms: [], lift: 0, mapAng: 0, v: 0, armed: false, meas: 0, measKmh: 0, lights: [], ...extra });
    const js = [...(p.junctions ?? [])].filter((j) => j && isFinite(j.atKm)).sort((a, b) => a.atKm - b.atKm);
    if (!js.length) js.push({ atKm: km, dir: 'R', name: this.toName });
    js.forEach((j, i) => { const last = i === js.length - 1; want.push({ ev: mk('junction', 30, 78, { dir: j.dir === 'L' ? -1 : 1, name: j.name || this.toName, exit: last, idx: i }), f: last ? 2 : clamp(j.atKm / km, 0.1, 0.96) }); });
    // Chuyến dài có rất nhiều trạm: chỉ dựng tối đa 5 trạm xăng, 6 trạm thu phí (rải đều) để chuyến đi không kéo lê
    let st = (p.stationsAtKm ?? []).filter((k) => isFinite(k)).sort((a, b) => a - b);
    if (st.length > 5) st = Array.from({ length: 5 }, (_, i) => st[Math.round(i * (st.length - 1) / 4)]);
    const sf = st.map((k) => clamp(k / km, 0.05, 0.95));
    sf.forEach((f, i) => want.push({ ev: mk('station', 66, 66, { idx: i }), f }));
    const nT = Math.max(0, Math.min(6, p.tolls | 0));
    for (let i = 0; i < nT; i++) want.push({ ev: mk('toll', 76, 24, { idx: i }), f: (i + 0.5) / Math.max(1, nT) * 0.92 + 0.01 * i });
    // Trạm dừng nghỉ xen giữa các trạm xăng
    const rf = sf.length >= 2 ? [(sf[0] + sf[1]) / 2, ...(sf.length >= 4 ? [(sf[sf.length - 2] + sf[sf.length - 1]) / 2] : [])] : roadSec >= 30 ? [sf.length ? clamp(sf[0] + 0.3, 0.2, 0.85) : 0.6] : [];
    rf.forEach((f, i) => want.push({ ev: mk('rest', 70, 70, { idx: i }), f }));
    // Các điểm có thể có tổ CSGT bắn tốc độ (có tổ hay không là ngẫu nhiên mỗi chuyến)
    const force = this.opts.police ?? (globalThis as { __drivePolice?: boolean }).__drivePolice;
    (roadSec >= 60 ? [0.2, 0.52, 0.8] : roadSec >= 32 ? [0.3, 0.72] : [0.5]).forEach((f, i) => want.push({ ev: mk('police', 36, 96, { idx: i, armed: force ?? Math.random() < 0.7 }), f: f + 0.013 }));
    if (roadSec >= 28) want.push({ ev: mk('feature', 46, 52, { kind: THEMES[this.zf].mountains !== null ? 'tunnel' : 'bridge' }), f: 0.47 });
    want.sort((a, b) => a.f - b.f);
    let prev: Ev | null = null;
    for (const w of want) { const e = w.ev, min: number = prev ? prev.s + prev.post + e.pre : this.exS + e.pre + 34; e.s = Math.max(min, w.f > 1 ? this.exS + planned : this.exS + w.f * planned); prev = e; this.events.push(e); }
    const exit = prev!;
    this.mul = clamp((exit.s - this.exS) / planned, 1, 1.25);
    this.endS = this.road0 = exit.s + 78 + 80; this.kmU = km / this.road0;
    for (const e of this.events) e.rs = e.s;
    this.reindex(); this.baseJ = [...this.juncs];
    this.planLimits = () => {
      // Biển giới hạn tốc độ theo từng đoạn cao tốc: đổi sau mỗi nút giao, đoạn dài thì chia đôi
      const cuts = [this.exS + 26, ...this.juncs.filter((j) => !j.exit).map((j) => j.s + 84)], ends = [...cuts.slice(1), exit.s];
      const pat = [POSTED[1] ?? 100, POSTED[2] ?? 120, POSTED[1] ?? 100, POSTED[0] ?? 80, POSTED[2] ?? 120]; let k = 0;
      cuts.forEach((c, i) => { const span = ends[i] - c, parts = span > 560 ? 2 : 1; for (let q = 0; q < parts; q++) { const e = mk('limit', 0, 0, { s: c + span * q / parts, v: pat[k++ % pat.length] }); e.rs = e.s; this.events.push(e); } });
      this.reindex();
    };
    // Cầu vượt ở những quãng trống
    let n = 0;
    for (let i = 1; i < this.events.length && n < 2; i++) { const a = this.events[i - 1], b = this.events[i], gap = (b.s - b.pre) - (a.s + a.post); if (gap > 26 && b.type !== 'feature') { b.objs.push({ o: overpass(), ds: -(b.pre + gap / 2), x: 0 }); n++; } }
    this.planLimits();
    // Phao số trên biển
    const N = clamp(Math.round(this.seaL / 100), 4, 6); for (let i = 0; i < N; i++) this.gates.push(((i + 0.6) / N) * this.seaL);
  }
  private planLimits: () => void = () => {};
  private reindex() { this.events.sort((a, b) => a.s - b.s); this.juncs = this.events.filter((e) => e.type === 'junction'); this.stations = this.events.filter((e) => e.type === 'station'); this.auxs = this.events.filter((e) => e.type === 'station' || e.type === 'rest'); this.limits = this.events.filter((e) => e.type === 'limit'); this.polices = this.events.filter((e) => e.type === 'police'); this.tolls = this.events.filter((e) => e.type === 'toll'); this.feats = this.events.filter((e) => e.type === 'feature'); }

  private buildEvent(e: Ev) {
    const add = (o: THREE.Object3D, ds: number, x: number, base = false) => { e.objs.push({ o, ds, x, base }); };
    if (e.type === 'junction') {
      const L = e.dir < 0, nm = e.retry ? `↩ ${e.name}` : e.name, far = -Math.min(150, Math.max(40, e.s - this.exS - 12));
      add(gantry(HW, [{ text: L ? `← ${nm} · 500 m` : `${nm} · 500 m →`, x: e.dir * 1.2, w: 9 }]), far, 0);
      add(gantry(HW, [{ text: L ? `← ${nm}` : `${nm} →`, x: e.dir * (LW + 0.6), w: 5.6, bg: e.exit ? '#f08a24' : GREEN }, { text: '↑ Đi thẳng', x: -e.dir * LW * 0.8, w: 4.6, bg: BLUE }]), -52, 0);
      const gore = new THREE.Group(); gore.add(box(0xf2c94c, 0, 0.7, 0, 1.3, 1.4, 0.3), box(0x3f4652, 0, 0.7, -0.16, 0.9, 0.3, 0.05), mesh(GEO.cyl, mat(0xf2c94c), 0, 0.5, -2.2, 0.5, 1.0, 0.5));
      add(bake(gore, true), 16, e.dir * LW / 2, true);
    } else if (e.type === 'station') {
      add(roadside('⛽ Trạm xăng 500 m →', '#f08a24', 6.4), -140, HW + 2.2);
      add(roadside('⛽ Vào trạm →', '#f08a24', 5), -58, HW + 2.2);
      add(fuelStation(this.opts.truck.fuelPrice), 0, HW + LW + 0.9);
      add(stopBox(0xf2c94c), 0, HW + LW / 2 + 0.3); add(limitPost(ROAD_LIMITS.station), -50, HW + LW + 1.6);
    } else if (e.type === 'rest') {
      add(roadside('☕ Trạm dừng nghỉ 500 m →', BLUE, 7), -150, HW + 2.2);
      add(roadside('☕ Vào trạm nghỉ →', BLUE, 5.6), -60, HW + 2.2);
      const rs = bake(restStop(), true); const sp = sign('☕ Trạm dừng nghỉ', BLUE, 7); sp.position.set(8, 6.4, -3); rs.add(sp); add(rs, 0, HW + LW + 0.9);
      add(stopBox(0x7fd0ff), 0, HW + LW / 2 + 0.3); add(limitPost(ROAD_LIMITS.station), -50, HW + LW + 1.6);
    } else if (e.type === 'police') {
      if (e.armed) { const u = policeUnit(); const root = bake(u.root, true); for (const l of u.lights) root.add(l); e.lights = u.lights; const sp = sign('CSGT', '#1f4fa8', 3); sp.position.set(1.6, 2.8, -3); root.add(sp); add(root, 0, HW + 2.4); }
    } else if (e.type === 'limit') {
      add(limitPost(e.v), 4, HW + 1.7); add(limitPost(e.v), 4, -HW - 1.5); add(limitPost(e.v, ROAD_LIMITS.highwayMin), 170, HW + 1.7);
    } else if (e.type === 'toll') {
      add(limitPost(ROAD_LIMITS.toll), -70, HW + 1.7);
      add(gantry(HW, [{ text: `Thu phí chặng · ${vnd(this.opts.plan.tollFee)}`, x: 0, w: 9, bg: BLUE }]), -96, 0);
      const t = tollPlaza(); e.arms = t.arms; add(t.root, 0, 0);
    } else if (e.kind === 'tunnel') { add(tunnel(), 0, 0); add(roadside('Hầm đường bộ', BLUE, 5), -70, HW + 2.2); }
    else { const river = box(0x6cc5e0, 0, 0, 0, 700, 0.06, 64, { rough: 0.25 }); river.castShadow = false; river.position.y = -0.02; add(river, 0, 0); add(pylon(), -15, 0); add(pylon(), 15, 0); add(roadside('Cầu vượt sông', BLUE, 5), -70, HW + 2.2); }
    for (const o of e.objs) { o.o.visible = false; if (!o.o.parent) this.world.add(o.o); }
  }

  private buildProps() {
    const put = (o: THREE.Object3D, s: number, x: number, mode: Mode) => { o.visible = false; this.world.add(o); this.props.push({ o, s, x, mode }); };
    const roadLast = this.legs[this.legs.length - 1].mode === 'truck', roadFirst = this.legs[0].mode === 'truck';
    // Xuất phát: cổng vườn (hoặc cổng cảng nếu vừa rời phà)
    const farm = new THREE.Group(); for (const x of [-VW - 1.2, VW + 1.2]) farm.add(box(0xb9855a, x, 2.2, 0, 0.5, 4.4, 0.5)); farm.add(box(0x6fb56a, 0, 4.6, 0, VW * 2 + 3.4, 0.5, 0.8));
    const fg = bake(farm, true); const fs = sign(roadFirst ? `Vườn ${this.fromName}` : 'Cảng · lên bờ', '#4caf3f', 8); fs.position.set(0, 5.9, 0); fg.add(fs); put(fg, 14, 0, 'truck');
    put(roadside('↑ Lối vào cao tốc', GREEN, 6.4), this.rampS - 20, VW + 2.4, 'truck');
    put(gantry(HW, [{ text: `Cao tốc · ${this.toName} ↑`, x: 0, w: 9 }]), this.exS + 14, 0, 'truck');
    // Đích chặng bộ: cổng chào (hoặc cổng cảng nếu còn chặng biển)
    const gate = new THREE.Group(); for (const x of [-5.4, 5.4]) gate.add(box(0xb9855a, x, 2.6, 0, 0.5, 5.2, 0.5)); gate.add(box(0xf08a6c, 0, 5.4, 0, 12.4, 0.5, 0.9));
    const gg = bake(gate, true); const gs = sign(roadLast ? `Chào mừng tới ${this.toName}` : 'Bến phà · xuống tàu', '#f08a6c', 11); gs.position.set(0, 6.9, 0); gg.add(gs); put(gg, 1e9, 0, 'truck');
    // Chặng biển: cầu tàu hai đầu, phao số, bờ đích
    if (this.opts.plan.needsBoat) {
      const pier = () => { const p = new THREE.Group(); p.add(box(0xc98a52, 0, 0.3, 0, 7, 0.3, 14)); for (const x of [-3.2, 3.2]) for (let z = -6; z <= 6; z += 3) p.add(mesh(GEO.cyl, mat(0x9a6238), x, 0.1, z, 0.18, 1.6, 0.18)); return bake(p); };
      put(pier(), -10, 0, 'boat'); put(pier(), this.seaL + 10, 0, 'boat');
      const land = new THREE.Group(); land.add(mesh(GEO.ball, mat(0xf0e3b4), 0, -1, 0, 60, 3, 22), mesh(GEO.ball, mat(0xa9d672), 0, 0, -6, 48, 5, 15), mesh(GEO.cone, mat(0x9cc79a, { rough: 1 }), -12, 7, -10, 10, 14, 10), mesh(GEO.cone, mat(0xa9cbbd, { rough: 1 }), 14, 5, -9, 8, 10, 8));
      for (let i = 0; i < 7; i++) { const p = SCENERY.palm(); p.position.set(-20 + i * 6.5, 1.6, 2 + (i % 2) * 2); land.add(p); }
      for (let i = 0; i < 3; i++) { const h = EXTRA.thouse(); h.position.set(-12 + i * 12, 2.4, -1); land.add(h); }
      const lb = bake(land); const ls = sign(roadLast ? 'Cảng đất liền' : `Chào mừng tới ${this.toName}`, '#f08a6c', 12); ls.position.set(0, 9, 4); lb.add(ls); put(lb, this.seaL + 38, 0, 'boat');
      put(bake(lighthouse()), this.seaL * 0.56, CH + 19, 'boat'); put(bake(cargoShip()), this.seaL * 0.3, -(CH + 62), 'boat'); put(bake(cargoShip()), this.seaL * 0.8, CH + 90, 'boat');
      for (let i = 0; i < 6; i++) { const b = bird(); b.root.visible = false; this.scene.add(b.root); this.birds.push({ b, a: i * 1.1, r: 9 + i * 3.5, h: 7 + (i % 3) * 2.2, w: 0.5 + (i % 4) * 0.12 }); }
      this.gates.forEach((s, i) => { for (const side of [-1, 1]) { const b = bake(buoy(side < 0 ? 0xe0342b : 0x2faa5a, true)); const n = sign(String(i + 1), side < 0 ? '#e0342b' : '#2faa5a', 3.2); n.position.y = 3.6; b.add(n); put(b, s, side * (CH + 0.8), 'boat'); } });
    }
  }

  private planTraffic() {
    const r = rng(31 + Math.round(this.road0)), exit = this.events[this.events.length - 1];
    this.tplan.push({ s: 52, kind: 'xemay', x: 1.9, v: 8 }, { s: 150, kind: 'nguoc', x: -1.7, v: -9 }, { s: 105, kind: 'xemay', x: 1.9, v: 8 });
    let s = this.exS + 70, last = -2;
    while (s < exit.s - 20) { let lane = Math.floor(r() * 3) - 1; if (lane === last) lane = ((lane + 2) % 3) - 1; last = lane; const kind = lane === -1 ? 'sedan' : (['coach', 'container', 'sedan', 'container'] as const)[Math.floor(r() * 4)]; this.tplan.push({ s, kind, x: lane * LW, v: (lane < 0 ? 92 : lane === 0 ? 78 : 66) * UK }); s += 34 + r() * 30; }
    this.tplan.sort((a, b) => a.s - b.s);
    // Trên biển: ghe, thuyền thúng, đá ngầm, sóng
    const kinds = ['ghe', 'thung', 'da', 'song', 'ghe', 'thung'];
    for (let q = 70, i = 0; q < this.seaL - 60; q += 30 + r() * 16, i++) { const kind = kinds[i % kinds.length]; this.seaPlan.push({ s: q, kind, x: kind === 'da' ? (r() < 0.5 ? -1 : 1) * (CH - 1.2) : (r() * 2 - 1) * (CH - 2.5), v: kind === 'ghe' ? 5 : kind === 'song' ? -3 : 0 }); }
  }
  private seaPlan: { s: number; kind: string; x: number; v: number }[] = [];

  // ---------------------------------------------------------------- hình học đường
  private curve(s: number) { return 4 * Math.sin(s * 0.008) + 2 * Math.sin(s * 0.021 + 1); }
  private chan(s: number) { const e = sm(s / 50) * sm((this.seaL - s) / 50); return e * (19 * Math.sin(s * 0.02417) + 4 * Math.sin(s * 0.0648 + 1)); }
  private g(u: number) { return G * sm(u / 60); }
  private shift(s: number, skip: Ev | null = null, sig = 0) { let x = 0; for (const j of this.juncs) { const u = s - j.s; if (u <= 0) continue; x += (j === skip ? sig : (j.sigma || -j.dir)) * this.g(u); } return x; }
  private center(s: number) { return this.mode === 'boat' ? this.chan(s) : this.curve(s) + this.shift(s); }
  private halfAt(s: number) {
    if (s < this.rampS) return VW;
    if (s < this.exS) return lerp(VW, HW, sm((s - this.rampS) / (this.exS - this.rampS)));
    const ex = this.exitDone; if (ex && s > ex.s + 78) return lerp(HW, VW + 0.2, sm((s - ex.s - 78) / 40));
    return HW;
  }
  private ribbon(u: number, d: number, sg: number, o: [number, number]) { const w = sm((u - 8) / 62); if (sg === d) { if (d > 0) o[0] = lerp(LW / 2, -HW, w); else o[1] = lerp(-LW / 2, HW, w); } else if (d > 0) o[1] = lerp(LW / 2, HW, w); else o[0] = lerp(-LW / 2, -HW, w); }
  /** Mép trái, phải của đường xe đang chạy, tính từ tim đường. */
  private edges(s: number): [number, number] {
    const o = this.e2, h = this.halfAt(s); o[0] = -h; o[1] = h;
    for (const j of this.juncs) { const u = s - j.s; if (u >= 0 && u < 72) this.ribbon(u, j.dir, j.sigma || -j.dir, o); }
    for (const e of this.auxs) { const u = s - e.s; if (u > -64 && u < 64) o[1] += (LW + 0.6) * sm((u + 64) / 18) * sm((64 - u) / 18); }
    return o;
  }
  private oppF(s: number) {
    if (s < this.exS + 10 || this.mode === 'boat') return 0; let f = sm((s - this.exS - 10) / 30);
    for (const j of this.juncs) f *= Math.max(sm((j.s - 50 - s) / 30), j.exit && j.sigma !== -j.dir ? 0 : sm((s - j.s - 170) / 30));
    for (const e of this.feats) if (e.kind === 'tunnel') f *= Math.max(sm((e.s - 44 - s) / 20), sm((s - e.s - 44) / 20));
    return f;
  }
  private guardOn(s: number) {
    if (s < this.exS + 5 || (this.exitDone && s > this.exitDone.s)) return false;
    for (const j of this.juncs) { const u = s - j.s; if (u > -12 && u < 78) return false; }
    for (const e of this.auxs) if (Math.abs(s - e.s) < 66) return false;
    for (const e of this.polices) if (e.armed && s - e.s > -14 && s - e.s < 22) return false;
    for (const e of this.tolls) if (Math.abs(s - e.s) < 9) return false;
    for (const e of this.feats) if (e.kind === 'tunnel' && Math.abs(s - e.s) < 30) return false;
    return true;
  }
  private fill(m: THREE.Mesh, fn: (s: number, o: number[]) => void) {
    const p = (m.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute, a = p.array as Float32Array, base = Math.floor((this.s - 14) / SEG) * SEG, o = this.tmp;
    for (let i = 0; i <= SEGS; i++) { const s = base + i * SEG, z = -(s - this.s), k = i * 6; fn(s, o); a[k] = o[0] - this.cx; a[k + 1] = o[1]; a[k + 2] = z; a[k + 3] = o[2] - this.cx; a[k + 4] = o[3]; a[k + 5] = z; }
    p.needsUpdate = true;
  }
  private put(obj: THREE.Object3D, s: number, X: number, y = 0) { obj.position.set(X - this.cx, y, -(s - this.s)); }

  // ---------------------------------------------------------------- quãng đường, nhiên liệu
  private det(s = this.s): Detour | null { for (const d of this.detours) if (s > d.from && s < d.from + d.len) return d; return null; }
  private routeS(s = this.s) { let r = s; for (const d of this.detours) r -= clamp(s - d.from, 0, d.len); return r; }
  /** Số km thật giữa hai điểm trên đường (tính cả đoạn đi lố). */
  private kmBetween(a: number, b: number) { let km = (this.routeS(b) - this.routeS(a)) * this.kmU; for (const d of this.detours) km += Math.max(0, Math.min(b, d.from + d.len) - Math.max(a, d.from)) / d.len * d.km; return km; }
  private kmLeft() {
    const later = this.legs.slice(this.legIdx + 1).reduce((n, l) => n + l.km, 0);
    return later + (this.mode === 'boat' ? (1 - this.s / this.seaL) * this.seaKm : this.kmBetween(this.s, this.endS));
  }
  private zoneAt(s: number): Zone { return this.routeS(s) / this.road0 < 0.5 ? this.zf : this.zt === 'dao' ? 'trung' : this.zt; }

  // ---------------------------------------------------------------- điều khiển
  private bindInput(el: HTMLCanvasElement) {
    const on = (t: EventTarget, type: string, fn: (e: any) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn, o); this.cleanup.push(() => t.removeEventListener(type, fn, o)); };
    on(el, 'pointerdown', (e: PointerEvent) => { if (this.drag) return; try { el.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } this.drag = { id: e.pointerId, x: e.clientX, px: this.px }; });
    on(el, 'pointermove', (e: PointerEvent) => { const d = this.drag; if (!d || d.id !== e.pointerId) return; this.target = d.px + ((e.clientX - d.x) / Math.max(200, this.container.clientWidth)) * (this.mode === 'boat' ? 30 : 17); });
    const end = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) { this.drag = null; this.target = null; } };
    on(el, 'pointerup', end); on(el, 'pointercancel', end);
    on(window, 'keydown', (e: KeyboardEvent) => { if (/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|KeyA|KeyD|KeyW|KeyS|Space)$/.test(e.code)) { this.keys.add(e.code); e.preventDefault(); } else if (!e.repeat && e.code === 'KeyR') this.setGear(this.gear === 'R' ? 'D' : 'R'); else if (!e.repeat && e.code === 'KeyC') this.setView(this.view === 'pov' ? 'chase' : 'pov'); else if (!e.repeat && e.code === 'KeyQ') this.setCruise(!this.cruise); });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.btn = 0; this.throttle = 0; this.brakeIn = 0; });
  }
  /** Nút ◀ ▶ trên màn hình: -1 trái, 1 phải, 0 thả. */
  setSteer(dir: number) { this.btn = Math.sign(dir); }
  /** Dùng cho kiểm thử: giữ xe ở vị trí ngang x (tính từ tim đường); null để trả lại tay lái. */
  setX(x: number | null) { this.holdX = x; }
  start() { this.running = true; }
  /** Bàn đạp ga, thắng: 0 (nhả) tới 1 (đạp hết). */
  setThrottle(v: number) { this.throttle = clamp(+v || 0, 0, 1); }
  setBrake(v: number) { this.brakeIn = clamp(+v || 0, 0, 1); if (this.brakeIn > 0.05 && this.cruise) { this.cruise = false; this.bump('Đạp thắng: tắt ga tự động', 'info'); } }
  /** Gài số tiến/lùi — chỉ khi xe đã dừng hẳn. Trả về số đang gài. */
  setGear(g: 'D' | 'R'): 'D' | 'R' {
    if (g === this.gear || this.mode === 'boat') return this.gear;
    if (Math.abs(this.speed) > 2 * UK) { this.bump('Dừng hẳn rồi mới gài số', 'info'); return this.gear; }
    this.gear = g; if (g === 'R') { this.cruise = false; this.revFloor = Math.max(0, this.s - 60); } this.bump(g === 'R' ? 'Số lùi (R)' : 'Số tiến (D)', 'info'); return this.gear;
  }
  /** Ga tự động: giữ đúng tốc độ trên biển. */
  setCruise(on: boolean) { this.cruise = !!on; if (on) this.gear = 'D'; }
  auto(on: boolean) { this.setCruise(on); }
  setView(v: View) { this.view = v === 'pov' ? 'pov' : 'chase'; this.resize(); }
  /** Dùng cho kiểm thử: chạy mô phỏng thêm `sec` giây (không vẽ), để máy thử chậm vẫn đi hết tình huống. */
  simulate(sec: number) { for (let t = 0; t < sec && this.running && !this.arrived; t += 0.05) this.step(0.05); }
  /** Đã đọc biên bản: cho xe đi tiếp. */
  resume() { if (this.pulled?.shown) { this.pulled.go = true; } }
  /** Dùng cho kiểm thử: nhảy tới vị trí s trên chặng hiện tại (không tính sự kiện đã bỏ qua). */
  warp(s: number) { this.s = s; this.nextSc = s + 6; for (const it of this.scen) { it.active = false; it.obj.visible = false; } const plan = this.mode === 'boat' ? this.seaPlan : this.tplan; while (this.tIdx < plan.length && plan[this.tIdx].s < s + 30) this.tIdx++; }
  private resize() { const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.fovNow = this.camera.fov = this.baseFov(); this.camera.updateProjectionMatrix(); const pt = w / h < 0.9; this.cab.root.position.set(0, pt ? -0.42 : -0.06, pt ? -0.1 : 0); this.cab.roof.visible = !pt; }
  private baseFov() { const portrait = this.camera.aspect < 0.9; return this.view === 'pov' && this.mode !== 'boat' ? (portrait ? 78 : 62) : portrait ? 58 : 46; }

  private applyLeg(first = false) {
    const leg = this.legs[this.legIdx], boat = leg.mode === 'boat'; this.mode = leg.mode;
    this.kmDoneBefore = this.legs.slice(0, this.legIdx).reduce((n, l) => n + l.km, 0);
    this.gear = 'D'; this.s = 0; this.px = boat ? 0 : 1.6; this.pv = 0; this.speed = 0; this.legT = 0; this.phi = 0; this.nextSc = 6; this.tIdx = 0; this.offChan = false;
    this.truck.visible = !boat; this.boat.visible = boat; this.ground.visible = !boat; this.sea.visible = boat; this.mountains.visible = !boat && THEMES[this.zf].mountains !== null;
    for (const m of [this.roadA, this.roadB, this.lineL, this.lineR, this.median, this.barrier, this.opp, this.guard, this.posts]) m.visible = !boat;
    for (const b of this.birds) b.b.root.visible = boat;
    for (const d of this.dashes) d.visible = false; for (const b of this.buoys) b.visible = boat;
    for (const it of this.scen) { it.active = false; it.obj.visible = false; }
    for (const c of this.cars) { c.active = false; c.obj.visible = false; }
    for (const o of this.oncoming) o.obj.visible = false;
    for (const e of this.events) for (const o of e.objs) o.o.visible = false;
    if (!first) this.pause = 0.6;
  }

  // ---------------------------------------------------------------- diễn biến
  private inAux() { return this.px > this.halfAt(this.s) + 0.3; }
  private bump(text: string, kind: 'bad' | 'good' | 'info') { this.opts.onBump?.(text, kind); }
  private summary(): DriveSummary { const r1 = (n: number) => Math.round(n * 10) / 10; return { km: this.opts.plan.km, detourKm: this.detourKm, fuelUsed: r1(this.fuelUsed), refuelL: r1(this.refuelL), refuelCost: Math.round(r1(this.refuelL) * this.opts.truck.fuelPrice), tollCount: this.tollCount, tollEtc: this.tollEtc, tollCash: this.tollCash, ranDry: this.ranDry, speeding: [...this.speeding], fineTotal: this.fineTotal, rests: this.rests, odoKm: r1(this.odo) }; }
  private kmh() { return Math.abs(this.speed) / UK; }
  /** Giới hạn tốc độ tại vị trí s. `main`: chỉ tính biển của đoạn đường (bỏ qua vùng trạm thu phí, làn vào trạm). */
  private limitAt(s: number, main = false): number {
    if (this.mode === 'boat') return 0;
    let v: number;
    if (s < this.rampS) v = ROAD_LIMITS.village; else if (s < this.exS + 26) v = ROAD_LIMITS.ramp;
    else { const ex = this.exitDone; if (ex && s > ex.s + 60) v = s > ex.s + 120 ? ROAD_LIMITS.village : ROAD_LIMITS.ramp; else { v = POSTED[1] ?? 100; for (const l of this.limits) { if (l.s > s) break; v = l.v; } for (const e of this.feats) if (e.kind === 'tunnel' && Math.abs(s - e.s) < 34) v = Math.min(v, POSTED[0] ?? 80); } }
    if (main) return v;
    for (const e of this.tolls) { const u = s - e.s; if (u > -70 && u < 6) v = Math.min(v, ROAD_LIMITS.toll); }
    if (this.inAux()) for (const e of this.auxs) if (Math.abs(s - e.s) < 52) v = Math.min(v, ROAD_LIMITS.station);
    return v;
  }

  private step(dt: number) {
    const boat = this.mode === 'boat', leg = this.legs[this.legIdx], tk = this.opts.truck;
    if (this.switching > 0) { this.switching -= dt; if (this.switching <= 0) { this.legIdx++; this.applyLeg(); } return; }
    this.elapsed += dt; this.legT += dt;
    const assist = this.legT > leg.seconds * 4;
    if (this.pause > 0) this.pause -= dt;
    const end = boat ? this.seaL : this.endS, remain = end - this.s;
    // ---- bàn đạp
    let th = this.throttle, br = this.brakeIn;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) th = 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.keys.has('Space')) { br = 1; if (this.cruise) this.cruise = false; }
    const lim = this.limitAt(this.s), kmh = this.kmh();
    let cap = Infinity;                                   // tốc độ bị ép (km/h): về đích, trạm thu phí tiền mặt, CSGT dừng xe
    if (remain < 70) cap = Math.max(remain > 1.5 ? 7 : 0, remain * 1.1);
    if (boat) {
      const vmax = (this.offChan ? 0.55 : 1) * SEA_MAX, want = this.cruise || assist ? Math.min(SEA_V, vmax) : th * vmax;
      const capU = Math.min(vmax, cap * UK * 2.2);
      let a = (want - this.speed) * 0.55; if (br > 0) a -= br * 5.5; else if (th === 0 && !this.cruise && !assist) a = -this.speed * 0.16;
      this.speed = clamp(this.speed + a * dt, 0, Math.max(0, capU));
      if (this.pause > 0) this.speed = 0;
    } else {
      // Trạm thu phí: không đủ ETC hoặc lao qua quá nhanh thì thanh chắn không mở — phải dừng trước cabin
      for (const e of this.tolls) {
        if (e.done || e.armed) continue; const u = e.s - 6 - this.s, fee = this.opts.plan.tollFee, poor = this.etcLeft < fee;
        if (u > 0 && u < 14 && e.kind !== 'fast' && !poor && kmh > ROAD_LIMITS.toll + 8) { e.kind = 'fast'; this.bump(`Qua trạm quá ${ROAD_LIMITS.toll} km/h: ETC không kịp đọc, phải dừng!`, 'bad'); }
        if (u > -1 && u < 60 && (poor || e.kind === 'fast')) {
          cap = Math.min(cap, u < 1.2 ? 0 : Math.sqrt(u) * 9);
          if (u < 2.5 && kmh < 1 && this.pause <= 0) {       // đã dừng trước thanh chắn: trả tiền rồi mới được đi
            e.armed = true; e.kind = 'stop'; this.pause = 1.7;
            if (poor) { const c = Math.round(fee * 1.2); this.tollCash += c; this.bump(`Không đủ ETC: trả tiền mặt ${vnd(c)} (+20%)`, 'bad'); }
            else { this.etcLeft -= fee; this.tollEtc += fee; this.bump(`Dừng quẹt thẻ: -${vnd(fee)} ETC`, 'info'); }
          }
        }
      }
      const pl = this.pulled; if (pl && !pl.go) cap = 0;
      if (this.cruise && this.gear === 'D' && !pl) {
        const tgt = Math.max(8, Math.min(lim, this.limitAt(this.s + Math.max(0, this.speed) * 2.4)) - 2);
        if (kmh < tgt - 0.5) th = Math.max(th, clamp((tgt - kmh) / 10, 0.12, 1)); else if (kmh > tgt + 2 && th === 0) br = Math.max(br, clamp((kmh - tgt) / 30, 0.05, 0.7));
        else if (th === 0) th = clamp(0.1 + kmh / VMAX * 0.5, 0, 0.7);
      }
      if (assist && this.gear === 'D' && th === 0 && br === 0 && kmh < Math.min(40, lim)) th = 0.6;
      let v = this.speed / UK;                              // km/h có dấu (âm khi lùi)
      const dry = this.fuel <= 0, top = dry ? 30 : VMAX;
      if (this.gear === 'R') { v += (-(th * 16) * (1 + v / 14) + br * 40 * (v < 0 ? 1 : 0) + (th === 0 ? 6 : 0)) * dt; v = clamp(v, -12, 0); }
      else {
        const acc = th * (dry ? 5 : 21) * Math.max(0, 1 - Math.max(0, v) / (top + 12)) ** 0.9;
        v += (acc - (1.1 + v * 0.013) - br * 46) * dt; if (v > top) v -= 30 * dt; v = Math.max(0, v);
      }
      if (v > cap) v = Math.max(cap, v - (pl ? 34 : 60) * dt);
      if (this.pause > 0) v = 0;
      this.braking = br > 0.05 || (v > cap - 0.5 && cap < kmh) || this.pause > 0;
      if (br > 0.7 && kmh > 70 && this.shake < 0.05) this.shake = 0.12;
      this.speed = v * UK;
    }
    this.slow = Math.max(0, this.slow - dt);
    const prev = this.s; this.s = clamp(this.s + this.speed * dt, this.gear === 'R' ? this.revFloor : 0, end);
    if (this.gear === 'R' && this.s <= this.revFloor + 0.01 && this.speed < 0) this.speed = 0;
    if (!boat) this.roadEvents(prev, assist, dt); // xét nút giao trước khi mép đường mới ép xe
    else this.odo += Math.abs(this.s - prev) / this.seaL * this.seaKm;
    // ---- lái ngang
    let steer = this.btn;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) steer -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) steer += 1;
    const tgt = this.pulled && !this.pulled.go ? this.edges(this.s)[1] - 1.3 : this.holdX ?? this.target, grip = Math.min(1, Math.abs(this.speed) / 6) * (this.speed < 0 ? -1 : 1);
    if (tgt !== null) this.pv = clamp((tgt - this.px) * (this.pulled ? 2.4 : 8), -12, 12) * (this.speed < 0 ? -1 : 1);
    else this.pv += (clamp(steer, -1, 1) * (boat ? 7.5 : 10.5) - this.pv) * Math.min(1, dt * (boat ? 2.2 : 9));
    if (!boat && this.tired > 0.8 && tgt === null) this.pv += Math.sin(this.elapsed * 1.3) * (this.tired - 0.8) * 9 * dt * 10;
    this.px += this.pv * grip * dt;
    let lo = -(CH + 8), hi = CH + 8;
    if (!boat) { const e = this.edges(this.s); lo = e[0] + 1.15; hi = e[1] - 1.15; for (const t of this.tolls) { const u = this.s - t.s; if (u > -16 && u < 6) { const lane = clamp(Math.round(this.px / LW), -1, 1) * LW; this.px += (lane - this.px) * Math.min(1, dt * 5); } } }
    if (this.px < lo) { this.px = Math.min(lo, this.px + 16 * dt + (lo - this.px) * Math.min(1, dt * 8)); this.pv = Math.max(0, this.pv); }
    if (this.px > hi) { this.px = Math.max(hi, this.px - 16 * dt - (this.px - hi) * Math.min(1, dt * 8)); this.pv = Math.min(0, this.pv); }
    if (boat) { const off = Math.abs(this.px) > CH - 0.6; if (off && !this.offChan) this.bump('Lệch luồng! Tàu phải giảm máy', 'bad'); this.offChan = off; }
    if (this.s >= end - 1.5 && this.speed < 10 * UK && this.speed >= 0) {
      this.speed = 0;
      if (this.legIdx < this.legs.length - 1) { this.switching = 1.3; this.opts.onFlash?.(boat ? '🚚 Cập bến, xe lên bờ chạy tiếp!' : '⛴ Tới bến phà, xe xuống tàu ra khơi!'); }
      else { this.arrived = true; this.opts.onArrive?.(this.summary()); }
    }
  }

  private roadEvents(prev: number, assist: boolean, dt: number) {
    const s = this.s, tk = this.opts.truck, p = this.opts.plan, cross = (at: number) => prev < at && s >= at, kmh = this.kmh();
    // xăng: chạy càng nhanh càng hao
    const d = this.det((prev + s) / 2), dkm = Math.abs(s - prev) * (d ? d.km / d.len : this.kmU), burn = dkm * tk.lPer100km / 100 * (1 + clamp((kmh - 80) / 60, 0, 1) * 0.5);
    this.odo += dkm;
    if (this.fuel > 0) { const b = Math.min(this.fuel, burn); this.fuel -= b; this.fuelUsed += b; if (this.fuel <= 0 && !this.warnDry) { this.warnDry = true; this.ranDry = true; this.bump('Hết xăng! Xe chỉ bò được, sẽ tốn phí cứu hộ', 'bad'); } }
    if (d && !d.turned && s > d.from + d.len * 0.45) { d.turned = true; this.bump(`↩ Quay đầu, vòng lại nút ${d.j.name}`, 'info'); }
    // mệt dần theo thời gian cầm lái; chạy quá chậm trên cao tốc thì nhắc
    if (kmh > 5) this.tired = Math.min(1, this.tired + dt / 105);
    if (this.tired > 0.8 && this.elapsed - this.yawn > 14) { this.yawn = this.elapsed; this.bump('😴 Buồn ngủ rồi — ghé trạm dừng nghỉ ☕', 'bad'); }
    const main = this.limitAt(s, true), onHw = s > this.exS + 60 && !(this.exitDone && s > this.exitDone.s) && !this.inAux() && !this.pulled && this.gear === 'D';
    let nearEv = false; for (const e of this.tolls) if (Math.abs(s - e.s) < 60) nearEv = true;
    if (onHw && !nearEv && kmh < ROAD_LIMITS.highwayMin - 2 && this.fuel > 0 && this.slow <= 0) { this.lowT += dt; if (this.lowT > 5 && this.elapsed - this.nagT > 12) { this.nagT = this.elapsed; this.lowT = 0; this.bump(`Cao tốc: tốc độ tối thiểu ${ROAD_LIMITS.highwayMin} km/h`, 'info'); } } else this.lowT = 0;
    // được CSGT cho đi
    const pl = this.pulled;
    if (pl) {
      if (!pl.shown && kmh < 1) { pl.shown = true; const f = speedFine(pl.over)!; this.speeding.push(pl.over); this.fineTotal += f.fine; this.opts.onPolice?.({ kmh: pl.kmh, limit: pl.limit, over: pl.over, min: f.min, max: f.max, fine: f.fine, points: f.points, label: f.label, count: this.speeding.length }); }
      if (pl.go) this.pulled = null;
    }
    for (const e of this.events) {
      if (e.done) continue;
      if (e.type === 'junction' && cross(e.s)) {
        e.done = true;
        let ok = this.px * e.dir > LW / 2 - 0.25;
        if (!ok && assist) { ok = true; this.px = e.dir * LW; this.bump('Trợ lái đưa xe vào đúng nhánh', 'info'); }
        if (ok) { e.sigma = e.dir; if (e.exit) { this.exitDone = e; this.tplan.push({ s: e.s + 150, kind: 'xemay', x: 1.9, v: 8 }, { s: e.s + 260, kind: 'nguoc', x: -1.7, v: -9 }); } this.bump(e.exit ? `Ra đúng lối ${e.name}` : `Đúng hướng ${e.name}`, 'good'); }
        else this.miss(e);
        break;
      }
      if (e.type === 'station' || e.type === 'rest') {
        const u = s - e.s;
        if (u > 70) { e.done = true; if (e.type === 'station') this.stationsPassed++; continue; }
        if (this.inAux() && Math.abs(u) < 7.5 && kmh < 1.5 && this.pause <= 0) {
          e.done = true; this.gear = 'D';
          if (e.type === 'station') { this.stationsPassed++; const add = Math.max(0, tk.tankL - this.fuel); this.tired = Math.max(0, this.tired - 0.3); if (add > 0.5) { this.fuel = tk.tankL; this.refuelL += add; this.warnDry = false; this.pause = 2.0; this.speed = 0; this.bump(`⛽ +${Math.round(add)} lít · ${vnd(Math.round(add * 10) / 10 * tk.fuelPrice)}`, 'good'); } else this.bump('Bình còn đầy, chạy tiếp', 'info'); }
          else { this.rests++; this.tired = 0; this.pause = 2.2; this.speed = 0; this.bump('☕ Nghỉ 15 phút — tỉnh táo trở lại', 'good'); }
        }
      }
      if (e.type === 'toll' && cross(e.s - 4)) {
        e.done = true; this.tollCount++;
        if (!e.armed) { if (this.etcLeft >= p.tollFee) { this.etcLeft -= p.tollFee; this.tollEtc += p.tollFee; this.bump(`-${vnd(p.tollFee)} ETC · còn ${vnd(this.etcLeft)}`, 'good'); } else { const c = Math.round(p.tollFee * 1.2); this.tollCash += c; this.bump(`Không đủ ETC: trả tiền mặt ${vnd(c)} (+20%)`, 'bad'); } }
      }
      if (e.type === 'police') {
        const u = s - e.s;
        if (u > -60 && u < 0) { const over = kmh - main; if (over > e.meas) { e.meas = over; e.measKmh = kmh; } }
        if (cross(e.s)) { e.done = true; const over = Math.floor(e.meas); if (e.armed && over >= 5 && this.speeding.length < 3 && !this.pulled) { this.pulled = { e, over, kmh: Math.round(e.measKmh), limit: main, shown: false, go: false }; this.cruise = false; this.bump('🚨 CSGT ra hiệu dừng xe — tấp vào lề', 'bad'); } }
      }
    }
  }

  private miss(j: Ev) {
    j.sigma = -j.dir;
    const km = 6 + ((j.idx * 5 + j.name.length) % 7), len = clamp(km * 20, 150, 240);
    this.detourKm += km;
    for (const e of this.events) if (e.s > j.s) e.s += len;
    this.endS += len;
    const j2: Ev = { ...j, s: j.s + len, sigma: 0, done: false, retry: true, bend: 0, objs: [], arms: [], lift: 0, lights: [] };
    this.events.push(j2); this.reindex(); this.buildEvent(j2);
    const turn = roadside('↩ Quay đầu', '#e0342b', 5); turn.visible = false; this.world.add(turn); j2.objs.push({ o: turn, ds: -len * 0.55, x: HW + 2.2 });
    this.detours.push({ from: j.s, len, km, j, turned: false });
    this.shake = 0.4; this.bump(`Đi lố nút ${j.name}! Vòng lại +${km} km`, 'bad');
  }

  private phase(): string {
    if (this.arrived) return 'arrived'; if (!this.running) return 'countdown'; if (this.mode === 'boat') return 'sea';
    const s = this.s; if (s < this.rampS) return 'village'; if (s < this.exS) return 'ramp';
    if (this.exitDone && s > this.exitDone.s) return 'exit'; if (this.det()) return 'detour';
    if (this.pulled) return 'police';
    for (const e of this.auxs) if (Math.abs(s - e.s) < 64 && this.inAux()) return e.type;
    for (const e of this.tolls) if (s - e.s > -45 && s - e.s < 10) return 'toll';
    for (const j of this.juncs) if (s - j.s > -70 && s - j.s < 72) return 'junction';
    return 'highway';
  }
  private nav(): { icon: string; text: string; urgent: boolean } {
    const km = (n: number) => n >= 10 ? `${Math.round(n)} km` : n >= 1 ? `${n.toFixed(1).replace('.', ',')} km` : `${Math.max(50, Math.round(n * 10) * 100)} m`;
    if (this.mode === 'boat') { const i = this.gates.findIndex((g) => g > this.s); return this.offChan ? { icon: '⚠', text: 'Lệch luồng! Quay lại giữa phao đỏ và phao xanh', urgent: true } : { icon: '🧭', text: i < 0 ? `Qua hết phao, cập bến ${this.legIdx === this.legs.length - 1 ? this.toName : 'đất liền'}` : `Bám luồng tới cặp phao số ${i + 1}/${this.gates.length}`, urgent: false }; }
    const s = this.s, d = this.det();
    if (this.pulled) return { icon: '🚨', text: 'CSGT ra hiệu: giảm tốc, tấp vào lề phải', urgent: true };
    if (this.gear === 'R') return { icon: 'R', text: 'Đang gài số lùi: giữ GA để lùi, bấm R để về số tiến', urgent: true };
    if (this.inAux()) for (const e of this.auxs) { const u = s - e.s, what = e.type === 'station' ? 'đổ xăng' : 'nghỉ'; if (e.done || Math.abs(u) > 62) continue; if (u < -7.5) return { icon: e.type === 'station' ? '⛽' : '☕', text: `Còn ${Math.round((-u - 3) / UK / 10) * 10 || 10} m: thắng dần, dừng hẳn trong ô kẻ để ${what}`, urgent: false }; if (u <= 7.5) return { icon: 'P', text: `Đúng ô rồi: đạp thắng dừng hẳn để ${what}`, urgent: true }; return { icon: '↩', text: 'Lố ô dừng: dừng hẳn, gài số lùi (R) rồi lùi lại', urgent: true }; }
    for (const e of this.tolls) { const u = e.s - s; if (!e.done && u > 0 && u < 90) return this.etcLeft >= this.opts.plan.tollFee ? { icon: '🎫', text: `Trạm thu phí: giảm xuống ${ROAD_LIMITS.toll} km/h, ETC tự trừ tiền`, urgent: false } : { icon: '💵', text: 'Không đủ ETC: dừng trước thanh chắn trả tiền mặt', urgent: true }; }
    if (s < this.exS) return { icon: '↑', text: s < 4 && this.speed === 0 ? 'Giữ bàn đạp GA để lăn bánh' : 'Chạy qua làng rồi nhập làn lên cao tốc', urgent: false };
    const j = this.juncs.find((x) => !x.done && x.s > s);
    if (j) { const side = j.dir < 0 ? 'trái' : 'phải', icon = j.dir < 0 ? '↰' : '↱', ahead = j.s - s;
      if (ahead < 75) return { icon, text: `Rẽ ${side} ngay: giữ làn ngoài cùng bên ${side}`, urgent: true };
      if (d) return { icon: '↩', text: `Đi lố rồi! Vòng lại ${km(this.kmBetween(s, j.s))} nữa, rẽ ${side} vào ${j.name}`, urgent: true };
      return { icon, text: `Sau ${km(this.kmBetween(s, j.s))} rẽ ${side} ${j.exit ? 'ra' : 'vào'} ${j.name}`, urgent: false }; }
    return { icon: '↑', text: `Còn ${km(this.kmBetween(s, this.endS))} tới ${this.legIdx === this.legs.length - 1 ? this.toName : 'bến phà'}`, urgent: false };
  }
  private hud(): DriveHud {
    const boat = this.mode === 'boat', tk = this.opts.truck, left = this.kmLeft(), range = this.fuel / Math.max(1, tk.lPer100km) * 100, kmh = Math.round(this.kmh()), limit = this.limitAt(this.s);
    let warn: string | null = null;
    if (boat) warn = this.offChan ? 'Lệch luồng' : null;
    else if (this.fuel <= 0) warn = 'Hết xăng! Sẽ tốn phí cứu hộ';
    else {
      // Chỉ nhắc khi buộc phải ghé trạm kế tiếp, và khi trạm đã gần — không treo cảnh báo suốt chuyến.
      const ahead = this.stations.filter((e) => !e.done && e.s > this.s), st = ahead[0];
      const toNext = st ? this.kmBetween(this.s, st.s) : Infinity;
      const toAfter = ahead[1] ? this.kmBetween(this.s, ahead[1].s) : this.kmBetween(this.s, this.endS);
      if (st && range < toNext) warn = `Xăng chỉ còn ~${Math.round(range)} km · trạm ⛽ còn ${Math.max(1, Math.round(toNext))} km`;
      else if (st && range < toAfter && toNext <= 25) warn = `Sắp cạn xăng · ghé trạm ⛽ bên phải sau ${Math.max(1, Math.round(toNext))} km`;
      else if (!st && range < this.kmBetween(this.s, this.endS)) warn = 'Xăng không đủ tới nơi';
      else if (this.tired > 0.8) warn = 'Buồn ngủ: ghé trạm dừng nghỉ ☕ hoặc trạm xăng';
    }
    const knots = this.speed / SEA_V * 12, head = ((this.mapHead() * 180 / Math.PI + 90 + 720) % 360);
    return { progress: clamp(1 - left / Math.max(1, this.opts.plan.km), 0, 1), kmh: boat ? Math.round(knots * 1.852) : kmh, mode: this.mode, phase: this.phase(), kmLeft: Math.max(0, left), fuel: this.fuel, range, etcLeft: this.etcLeft, spent: Math.round(Math.round(this.refuelL * 10) / 10 * tk.fuelPrice) + this.tollCash + this.fineTotal, detourKm: this.detourKm, refuelL: Math.round(this.refuelL * 10) / 10, nav: this.nav(), warn,
      limit, over: !boat && kmh >= limit + 5, slowLane: false, odo: this.odo, gear: this.gear, cruise: this.cruise, view: this.view, canReverse: !boat && kmh < 2, tired: this.tired, knots: Math.max(0, knots), heading: head, fines: this.fineTotal, stopped: kmh < 1 };
  }
  /** Hướng đi trên bản đồ (radian, trục x sang phải, y xuống dưới). */
  private mapHead(): number {
    const pts = this.mode === 'boat' ? this.mapSea : this.mapRoad; if (pts.length < 2) return -Math.PI / 2;
    const km = this.mode === 'boat' ? this.s / this.seaL * this.seaKm : this.routeS() * this.kmU, a = this.along(pts, Math.max(0, km - 0.5)), b = this.along(pts, km + Math.max(0.5, this.opts.plan.km * 0.01));
    return Math.atan2(b[1] - a[1], b[0] - a[0]) + this.phi * 0.5;
  }
  /** Dùng cho kiểm thử. */
  debug() {
    const s = this.s, boat = this.mode === 'boat', e = boat ? [-CH, CH] : [...this.edges(s)];
    const nx = this.events.filter((x) => !x.done && x.s > s)[0];
    const cars = this.cars.filter((c) => c.active && !c.hit && c.s > s - 6 && c.s < s + 60 && (!c.j || c.j.sigma === 0 || c.j.sigma === c.sig)).map((c) => ({ kind: c.kind, ahead: c.s - s, x: this.carX(c) - this.cx, hw: VEH[c.kind].hw })).sort((a, b) => a.ahead - b.ahead);
    return { phase: this.phase(), mode: this.mode, kmh: Math.round(boat ? this.speed / SEA_V * 12 * 1.852 : this.kmh()), limit: this.limitAt(s), view: this.view, odo: this.odo, gear: this.gear, cruise: this.cruise, tired: this.tired, speeding: [...this.speeding], fineTotal: this.fineTotal, pulled: !!this.pulled, rests: this.rests, s, total: boat ? this.seaL : this.endS, px: this.px, lane: boat ? 0 : clamp(Math.round(this.px / LW), -1, 2), bounds: e, speed: this.speed,
      km: this.kmDoneBefore + (boat ? s / this.seaL * this.seaKm : this.kmBetween(0, s)), kmLeft: this.kmLeft(), fuel: this.fuel, fuelUsed: this.fuelUsed, detourKm: this.detourKm, refuelL: Math.round(this.refuelL * 10) / 10,
      stationsPassed: this.stationsPassed, tollsPassed: this.tollCount, etcLeft: this.etcLeft, tollCash: this.tollCash, offChannel: this.offChan, arrived: this.arrived, elapsed: this.elapsed, laneW: LW,
      next: nx ? { type: nx.type, ahead: nx.s - s, dir: nx.dir, name: nx.name, exit: nx.exit } : null, cars, events: this.events.map((x) => ({ type: x.type, s: x.s, dir: x.dir, done: x.done, v: x.v, armed: x.armed })) };
  }

  // ---------------------------------------------------------------- vẽ từng khung
  private carX(c: Car): number {
    if (this.mode === 'boat') return this.chan(c.s) + c.x;
    const j = c.j; if (!j) return this.center(c.s) + c.x;
    let X = this.curve(c.s) + this.shift(c.s, j, c.sig) + c.x;
    if (j.sigma && j.sigma !== c.sig) X += c.sig * j.bend * 0.004 * Math.max(0, c.s - j.s - 70) ** 2;
    return X;
  }
  /** Biển chữ treo cao: ẩn khi sắp lướt qua máy quay để khỏi che xe. */
  private near(o: THREE.Object3D, ahead: number) { for (const c of o.children) if ((c as THREE.Sprite).isSprite) c.visible = ahead > 13; }
  private slope(s: number) { return (this.center(s + 1.5) - this.center(s - 1.5)) / 3; }
  private spawnCar(p: { s: number; kind: string; x: number; v: number }) {
    const c = this.cars.find((i) => !i.active && i.kind === p.kind); if (!c) return;
    c.s = p.s; c.x = p.x; c.v = p.v; c.vx = p.kind === 'thung' ? (this.r() < 0.5 ? -1.4 : 1.4) : 0; c.active = true; c.hit = false; c.obj.visible = true; c.j = null; c.sig = 0;
    if (this.mode === 'truck') for (const j of this.juncs) if (j.sigma === 0 && j.s < p.s) { c.j = j; c.sig = p.x * j.dir > LW / 2 ? j.dir : -j.dir; }
  }
  private sceneX(s: number, side: number, kind: string, near: boolean): number | null {
    if (this.mode === 'boat') return this.chan(s) + side * (CH + 12 + this.r() * 34);
    for (const e of this.tolls) if (Math.abs(s - e.s) < 16) return null;
    for (const e of this.feats) if (Math.abs(s - e.s) < (e.kind === 'tunnel' ? 34 : 40)) return null;
    for (const e of this.auxs) if (side > 0 && Math.abs(s - e.s) < 72) return null;
    for (const e of this.polices) if (side > 0 && e.armed && Math.abs(s - e.s) < 16) return null;
    const e = this.edges(s);
    let off = (side > 0 ? e[1] : -e[0]) + (EDGE[kind] ?? (kind === 'tube' ? 6.5 : WIDE.has(kind) ? 8 : 4)) + (kind in EDGE || kind === 'tube' ? 0 : this.r() * (near ? 5 : 20));
    if (side < 0 && this.oppF(s) > 0.02) off += HW * 2 + 3.6;
    else if (side > 0 && !near) off += 1.5;
    for (const j of this.juncs) { const u = s - j.s; if (u > -8 && u < 330 && side === (j.sigma ? -j.sigma : j.dir)) off += 2 * this.g(Math.max(0, u)) + 0.004 * Math.max(0, u - 70) ** 2 + 2; }
    return this.center(s) + side * off;
  }

  private frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    if (this.running && !this.arrived) this.step(dt);
    const boat = this.mode === 'boat', s = this.s, live = this.running && !this.arrived && this.switching <= 0;
    this.cx = this.center(s);
    this.phi += (Math.atan(this.slope(s)) - this.phi) * Math.min(1, dt * 6); this.world.rotation.y = this.phi;
    const k = this.speed / (boat ? SEA_V : BASE);
    // ---- xe, phà
    const veh = boat ? this.boat : this.truck;
    const pov = this.view === 'pov', kmh = this.kmh();
    this.truck.visible = !boat && !pov; this.cab.root.visible = pov && !boat; for (const b of this.brakeL) b.visible = this.braking && !boat;
    veh.position.set(this.px, boat ? Math.sin(t * 2.2) * 0.12 - 0.1 : Math.abs(Math.sin(t * 22)) * 0.03 * Math.abs(k), 0);
    veh.rotation.y = -this.phi - this.pv * (boat ? 0.035 : 0.02) * Math.min(1, k * 2); veh.rotation.z = boat ? Math.sin(t * 1.7) * 0.05 - this.pv * 0.012 : -this.pv * 0.005;
    if (boat) veh.rotation.x = Math.sin(t * 2.2 + 1) * 0.03;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.2;
    if (!boat) this.drawRoad(dt);
    else {
      this.seaMat.uniforms.uT.value = t; (this.seaMat.uniforms.uOff.value as THREE.Vector2).set(this.cx, s); const fg = this.scene.fog as THREE.Fog; this.seaMat.uniforms.uNear.value = fg.near; this.seaMat.uniforms.uFar.value = fg.far;
      (this.wakeM.material as THREE.MeshBasicMaterial).opacity = clamp(this.speed / SEA_V, 0, 1) * 0.9; this.wakeM.scale.z = 0.5 + clamp(this.speed / SEA_V, 0, 1.2) * 0.6;
      for (const b of this.birds) { b.a += dt * b.w; b.b.root.position.set(this.px + Math.cos(b.a) * b.r, b.h + Math.sin(b.a * 2.3) * 0.8, -18 + Math.sin(b.a) * b.r * 0.7); b.b.root.rotation.y = -b.a; const f = Math.sin(t * 9 + b.r) * 0.6; b.b.wings[0].rotation.z = -f; b.b.wings[1].rotation.z = f; }
      const first = Math.floor((s - 12) / 16) * 16;
      this.buoys.forEach((b, i) => { const q = first + Math.floor(i / 2) * 16, side = i % 2 ? 1 : -1; b.visible = q > 4 && q < this.seaL - 4 && !this.gates.some((g) => Math.abs(g - q) < 7); if (b.visible) { this.put(b, q, this.chan(q) + side * (CH + 0.6), Math.sin(t * 2 + i) * 0.1 - 0.05); b.rotation.z = Math.sin(t * 1.6 + i) * 0.12; } });
    }
    // ---- cảnh hai bên
    while (this.nextSc < s + AHEAD) {
      const q = this.nextSc, near = !boat && (q < this.exS - 24 || (!!this.exitDone && q > this.exitDone.s + 80));
      const kinds = boat ? SEA_KINDS : near ? VILLAGE : ZONE_KINDS[this.zoneAt(q)], kind = kinds[Math.floor(this.r() * kinds.length)];
      this.nextSc += boat ? 9 + this.r() * 10 : near ? 2.0 + this.r() * 1.6 : 2.4 + this.r() * 2.4;
      const it = this.scen.find((i) => !i.active && i.kind === kind); if (!it) continue;
      const side = kind === 'pole' || kind === 'kmpost' || kind === 'lamp' ? 1 : this.r() < 0.5 ? -1 : 1, X = this.sceneX(q, side, kind, near); if (X === null) continue;
      it.s = q; it.X = X; it.active = true; it.obj.visible = true;
      it.obj.rotation.y = kind === 'house' || kind === 'thouse' || kind === 'stall' || kind === 'tube' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : kind === 'billboard' ? (side > 0 ? Math.PI : 0) : kind === 'tea' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : /^(pole|rice|fence|canal|coconut|kmpost|lamp|paddy)$/.test(kind) ? 0 : this.r() * 6;
      it.obj.scale.setScalar(/pole|house|thouse|rice|fence|stall|billboard|canal|tube|kmpost|lamp|paddy/.test(kind) ? 1 : 0.85 + this.r() * 0.5);
    }
    for (const it of this.scen) { if (!it.active) continue; if (it.s < s - 16) { it.active = false; it.obj.visible = false; continue; } this.put(it.obj, it.s, it.X, boat ? Math.sin(t + it.s) * 0.06 : 0); }
    // ---- xe cùng chiều, vật cản trên biển
    const plan = boat ? this.seaPlan : this.tplan;
    while (this.tIdx < plan.length && plan[this.tIdx].s < s + AHEAD - 8) { const p = plan[this.tIdx++]; if (p.s > s + 28) this.spawnCar(p); }
    const myHw = boat ? 2.2 : 1.0, myHl = boat ? 5.6 : 2.2;
    for (const c of this.cars) {
      if (!c.active) continue;
      const def = VEH[c.kind], seaKind = /ghe|da|thung|song/.test(c.kind);
      if (live) { const before = c.s; c.s += c.v * dt; if (c.vx) { c.x += c.vx * dt; if (Math.abs(c.x) > CH - 1.2) { c.x = Math.sign(c.x) * (CH - 1.2); c.vx = -c.vx; } } if (!boat) for (const j of this.juncs) if (j.sigma === 0 && j !== c.j && before <= j.s && c.s > j.s) { c.j = j; c.sig = c.x * j.dir > LW / 2 ? j.dir : -j.dir; } }
      const other = !!c.j && c.j.sigma !== 0 && c.j.sigma !== c.sig;
      if (c.s < s - 16 || seaKind !== boat || (c.kind === 'xemay' && c.s > this.exS + 6 && c.s < this.exS + 40) || (other && c.s - c.j!.s > 230)) { c.active = false; c.obj.visible = false; continue; }
      const X = this.carX(c); this.put(c.obj, c.s, X, seaKind ? Math.sin(t * 2 + c.s) * 0.1 : 0);
      if (!seaKind) c.obj.rotation.y = -Math.atan(this.slope(c.s)) * (c.kind === 'nguoc' ? -1 : 1);
      if (live && !c.hit && !other && Math.abs(c.s - s) < def.hl + myHl && Math.abs(X - this.cx - this.px) < def.hw + myHw) {
        c.hit = true; this.slow = 1.5; this.shake = 0.5; this.speed *= 0.55; this.burst(boat ? 0xffffff : 0xd9c9a6, this.px); if (c.v > 0) c.v *= 1.5;
        const words = boat ? ['Ùm! Va phải rồi', 'Sóng to quá!', 'Coi chừng!'] : ['Ối! Va chạm rồi', 'Úi chà! Chậm lại', 'Cẩn thận!']; this.bump(words[Math.floor(Math.random() * words.length)], 'bad');
      }
    }
    // ---- mốc dọc đường
    if (!boat) for (const e of this.events) {
      if (e.type === 'junction' && e.sigma !== 0) e.bend = Math.min(1, e.bend + dt / 1.2);
      for (const o of e.objs) { const q = e.s + o.ds, vis = q > s - 70 && q < s + AHEAD + 40; o.o.visible = vis; if (vis) { this.near(o.o, q - s); } if (vis) this.put(o.o, q, (o.base ? this.curve(q) + this.shift(q, e, 0) : this.center(q)) + o.x, o.o.position.y); }
      if (e.lights.length) { const on = Math.floor(t * 5) % 2 === 0; e.lights[0].visible = on; e.lights[1].visible = !on; }
      if (e.arms.length) { const u = s - e.s, open = u > -24 && !(e.kind === 'stop' && this.pause > 0.3) && (e.done || e.armed || !(e.kind === 'fast' || this.etcLeft < this.opts.plan.tollFee)); e.lift += ((open ? 1 : 0) - e.lift) * Math.min(1, dt * 6); for (const a of e.arms) a.rotation.z = -e.lift * 1.35; }
    }
    for (const p of this.props) { const q = p.s > 1e8 ? this.endS + 5 : p.s, vis = p.mode === this.mode && q > s - 60 && q < s + AHEAD + 70; p.o.visible = vis; if (vis) { this.near(p.o, q - s); this.put(p.o, q, this.center(q) + p.x, p.o.position.y); } }
    // ---- trong hầm: tối dần, chỉ còn đèn vách
    let inT = 0; if (!boat) for (const e of this.feats) if (e.kind === 'tunnel' && Math.abs(s - e.s) < 27) inT = 1;
    if (inT !== this.dark || this.dark > 0) { this.dark += (inT - this.dark) * Math.min(1, dt * 5); if (Math.abs(inT - this.dark) < 0.01) this.dark = inT; const f = this.scene.fog as THREE.Fog; this.hemi.intensity = lerp(1.35, 0.5, this.dark); this.sun.intensity = lerp(2.1, 0.1, this.dark); f.color.copy(this.fogCol).lerp(this.darkCol, this.dark); f.near = lerp(80, 22, this.dark); f.far = lerp(AHEAD + 20, 110, this.dark); this.scene.background = this.dark > 0.5 ? this.darkCol : this.sky; }
    // ---- hạt bụi, máy quay
    for (const sp of this.sparks) { if (sp.life <= 0) continue; sp.life -= dt; sp.v.y -= 12 * dt; sp.m.position.addScaledVector(sp.v, dt); sp.m.position.z += this.speed * dt; sp.m.scale.setScalar(Math.max(0.01, 0.16 * sp.life)); if (sp.life <= 0) sp.m.visible = false; }
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 0.5, portrait = this.camera.aspect < 0.9, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    const fov = this.baseFov() + (boat ? 0 : clamp(kmh / VMAX, 0, 1) * (pov ? 9 : 7)); if (Math.abs(fov - this.fovNow) > 0.05) { this.fovNow += (fov - this.fovNow) * Math.min(1, dt * 3); this.camera.fov = this.fovNow; this.camera.updateProjectionMatrix(); }
    if (pov) {
      // Ngồi ghế lái (bên trái), nhìn qua kính chắn gió; trên phà thì đứng ở đài chỉ huy nhìn qua boong
      const yaw = this.phi + veh.rotation.y, o = this.camV;
      if (boat) o.set(0, 6.6, 3.0); else o.set(-0.42, 2.02 + Math.sin(t * 17) * 0.006 * Math.min(1, kmh / 60), -1.2);
      o.applyAxisAngle(THREE.Object3D.DEFAULT_UP, veh.rotation.y); o.x += this.px; o.y += veh.position.y; o.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.phi);
      this.camera.position.set(o.x + jx * 0.3, o.y + jy * 0.3, o.z);
      this.camera.rotation.set(boat ? -0.3 : -0.045, yaw - this.pv * 0.006, veh.rotation.z * 0.5, 'YXZ');
      this.cab.wheel.rotation.z = -this.pv * 0.2; this.cab.needle.rotation.z = lerp(2.2, -2.2, clamp(kmh / 160, 0, 1));
    } else {
      this.camera.position.set(this.px * 0.86 + jx, (boat ? (portrait ? 17 : 9.5) : portrait ? 10.5 : 7.2) + jy, boat ? (portrait ? 25 : 20) : portrait ? 14 : 13);
      this.camera.lookAt(this.px * 0.92, boat ? (portrait ? -4 : -2) : portrait ? -2.4 : -1.6, boat ? -22 : portrait ? -15 : -15);
    }
    this.decor.rotation.y = this.phi * 0.6;
    this.renderer.render(this.scene, this.camera);
    this.tickAcc += dt;
    if (this.tickAcc > 0.12) { this.tickAcc = 0; this.opts.onTick?.(this.hud()); }
  }

  private drawRoad(dt: number) {
    const s = this.s;
    this.fill(this.roadA, (q, o) => { const c = this.center(q), e = this.edges(q); o[0] = c + e[0]; o[1] = 0; o[2] = c + e[1]; o[3] = 0; });
    this.fill(this.lineL, (q, o) => { const c = this.center(q), e = this.edges(q); o[0] = c + e[0] + 0.2; o[1] = 0.014; o[2] = c + e[0] + 0.42; o[3] = 0.014; });
    this.fill(this.lineR, (q, o) => { const c = this.center(q), e = this.edges(q); o[0] = c + e[1] - 0.42; o[1] = 0.014; o[2] = c + e[1] - 0.2; o[3] = 0.014; });
    this.fill(this.median, (q, o) => { const f = this.oppF(q), x = this.center(q) + this.edges(q)[0]; o[0] = x - 0.3 - 2.5 * f; o[2] = x - 0.3; o[1] = o[3] = f > 0.02 ? 0.01 : -1; });
    this.fill(this.opp, (q, o) => { const f = this.oppF(q), x = this.center(q) + this.edges(q)[0] - 2.9; o[0] = x - HW * 2 * f; o[2] = x; o[1] = o[3] = f > 0.02 ? 0 : -1; });
    this.fill(this.barrier, (q, o) => { const f = this.oppF(q), x = this.center(q) + this.edges(q)[0] - 0.7; o[0] = o[2] = x; o[1] = f > 0.5 ? 0 : -2; o[3] = f > 0.5 ? 0.8 : -2; });
    this.fill(this.guard, (q, o) => { const on = this.guardOn(q), x = this.center(q) + this.edges(q)[1] + 0.7; o[0] = o[2] = x; o[1] = on ? 0.35 : -2; o[3] = on ? 0.85 : -2; });
    // Nhánh còn lại ở nút giao gần nhất (đã qua hoặc sắp tới)
    let jb: Ev | null = null; for (const j of this.juncs) if (j.s < s + AHEAD + 10 && s - j.s < 240) { if (!jb || (j.s > s ? j.s - s < 130 : true)) jb = j; }
    const e2: [number, number] = [0, 0];
    this.fill(this.roadB, (q, o) => {
      const j = jb; if (!j || q < j.s) { o[0] = o[2] = this.cx; o[1] = o[3] = -1; return; }
      const u = q - j.s, so = j.sigma ? -j.sigma : j.dir, c = this.curve(q) + this.shift(q, j, so) + so * j.bend * 0.004 * Math.max(0, u - 70) ** 2;
      e2[0] = -HW; e2[1] = HW; if (u < 72) this.ribbon(u, j.dir, so, e2); o[0] = c + e2[0]; o[2] = c + e2[1]; o[1] = o[3] = -0.004;
    });
    // Vạch kẻ làn
    const first = Math.floor((s - 12) / 8) * 8;
    for (let i = 0; i < this.dashes.length; i += 2) {
      const q = first + (i / 2) * 8, a = this.dashes[i], b = this.dashes[i + 1];
      let zone = q < -6 || q > this.endS + 12; for (const j of this.juncs) { const u = q - j.s; if (u > -2 && u < 74) zone = true; } for (const e of this.tolls) if (Math.abs(q - e.s) < 10) zone = true;
      const wide = this.halfAt(q) > HW - 0.2; a.visible = !zone; b.visible = !zone && wide;
      if (zone) continue; const c = this.center(q), rot = -Math.atan(this.slope(q));
      this.put(a, q, c + (wide ? -LW / 2 : 0), 0.03); a.rotation.y = rot; if (wide) { this.put(b, q, c + LW / 2, 0.03); b.rotation.y = rot; }
    }
    // Cọc tôn lượn sóng dọc dải phân cách và lan can phải
    { let n = 0; const f0 = Math.floor((s - 12) / 6) * 6, m4 = this.m4;
      for (let i = 0; i < 34 && n < 94; i++) { const q = f0 + i * 6, c = this.center(q), e = this.edges(q), z = -(q - s);
        if (this.oppF(q) > 0.5) { m4.makeTranslation(c + e[0] - 0.7 - this.cx, 0.47, z); this.posts.setMatrixAt(n++, m4); }
        if (this.guardOn(q)) { m4.makeTranslation(c + e[1] + 0.7 - this.cx, 0.47, z); this.posts.setMatrixAt(n++, m4); } }
      this.posts.count = n; this.posts.instanceMatrix.needsUpdate = true; }
    // Xe chiều ngược lại bên kia dải phân cách
    for (const o of this.oncoming) { if (this.running && !this.arrived) o.s -= 85 * UK * dt; if (o.s < s - 16) o.s = s + AHEAD + this.r() * 80; const f = this.oppF(o.s); o.obj.visible = f > 0.97; if (o.obj.visible) { this.put(o.obj, o.s, this.center(o.s) + this.edges(o.s)[0] - 2.9 - HW + o.lane * LW); o.obj.rotation.y = Math.PI - Math.atan(this.slope(o.s)); } }
    // Màu đất, màu mặt đường theo vùng
    const th = THEMES[this.zoneAt(s)], rural = s < this.exS - 30 || (!!this.exitDone && s > this.exitDone.s + 90);
    (this.ground.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(th.ground), dt * 0.8);
    (this.roadA.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(rural ? th.road : 0x8f96a1), dt * 1.2);
    this.mountains.visible = th.mountains !== null;
  }

  private burst(color: number, x: number) {
    for (const sp of this.sparks) { sp.m.material = mat(color, { rough: 0.6 }); sp.m.position.set(x + (Math.random() - 0.5) * 1.5, 0.6 + Math.random(), -2 - Math.random() * 2); sp.v.set((Math.random() - 0.5) * 6, 3 + Math.random() * 4, -Math.random() * 4); sp.life = 0.6 + Math.random() * 0.5; sp.m.visible = true; }
  }

  // ---------------------------------------------------------------- bản đồ chỉ đường
  private buildMap() {
    let x = 0, y = 0, ang = -Math.PI / 2;
    const road = () => { this.mapRoad = [{ x, y, km: 0 }]; let prev = 0; for (const j of this.baseJ) { const km = j.rs * this.kmU; x += Math.cos(ang) * (km - prev); y += Math.sin(ang) * (km - prev); this.mapRoad.push({ x, y, km }); j.mapAng = ang; ang += j.dir * 1.0; prev = km; } x += Math.cos(ang) * (this.roadKm - prev); y += Math.sin(ang) * (this.roadKm - prev); this.mapRoad.push({ x, y, km: this.roadKm }); };
    const sea = () => { this.mapSea = []; const n = 30, ox = x, oy = y, nx = -Math.sin(ang), ny = Math.cos(ang), ku = this.seaKm / this.seaL; for (let i = 0; i <= n; i++) { const q = i / n, l = this.chan(q * this.seaL) * ku * 2.5; this.mapSea.push({ x: ox + Math.cos(ang) * this.seaKm * q + nx * l, y: oy + Math.sin(ang) * this.seaKm * q + ny * l, km: this.seaKm * q }); } x = ox + Math.cos(ang) * this.seaKm; y = oy + Math.sin(ang) * this.seaKm; };
    for (const l of this.legs) if (l.mode === 'truck') road(); else sea();
  }
  private along(pts: MapPt[], km: number): [number, number] { for (let i = 1; i < pts.length; i++) if (km <= pts[i].km || i === pts.length - 1) { const a = pts[i - 1], b = pts[i], q = clamp((km - a.km) / Math.max(1e-6, b.km - a.km), 0, 1); return [lerp(a.x, b.x, q), lerp(a.y, b.y, q)]; } return [0, 0]; }
  private loopAt(d: Detour, q: number): [number, number] { const [px, py] = this.along(this.mapRoad, d.j.rs * this.kmU), a = d.j.mapAng, R = Math.max(8, this.opts.plan.km * 0.075), hx = Math.cos(a), hy = Math.sin(a), w = q * Math.PI * 2; return [px + hx * R * (1 - Math.cos(w)) - hy * Math.sin(w) * R * 0.5 * d.j.dir * -1, py + hy * R * (1 - Math.cos(w)) + hx * Math.sin(w) * R * 0.5 * d.j.dir * -1]; }
  /** Vẽ bản đồ nhỏ lên khung vẽ 2D (gọi mỗi nhịp cập nhật). */
  drawMap(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    const pts: [number, number][] = [...this.mapRoad, ...this.mapSea].map((p) => [p.x, p.y] as [number, number]);
    for (const d of this.detours) for (let i = 0; i <= 8; i++) pts.push(this.loopAt(d, i / 8));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = Math.max(12, w * 0.12), sc = Math.min((w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, y1 - y0)), u = w / 120;
    const T = (p: [number, number]): [number, number] => [w / 2 + (p[0] - (x0 + x1) / 2) * sc, h / 2 + (p[1] - (y0 + y1) / 2) * sc];
    const line = (ps: [number, number][], color: string, width: number, dash: number[] = []) => { if (ps.length < 2) return; ctx.beginPath(); ps.forEach((p, i) => { const [x, y] = T(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.lineJoin = ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]); };
    const dot = (p: [number, number], r: number, fill: string, stroke = '#ffffff') => { const [x, y] = T(p); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5 * u; ctx.stroke(); };
    const text = (p: [number, number], s: string, size: number, color = '#3b2a17') => { const [x, y] = T(p); ctx.font = `800 ${size}px "Be Vietnam Pro", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(s, x, y); };
    const seaPts = this.mapSea.map((p) => [p.x, p.y] as [number, number]), roadPts = this.mapRoad.map((p) => [p.x, p.y] as [number, number]);
    line(seaPts, '#ffffff', 6 * u); line(seaPts, '#2a9fd6', 3 * u, [5 * u, 4 * u]);
    line(roadPts, '#ffffff', 7 * u); line(roadPts, '#3f8fd6', 4 * u);
    for (const d of this.detours) { const lp: [number, number][] = []; for (let i = 0; i <= 20; i++) lp.push(this.loopAt(d, i / 20)); line(lp, '#e0342b', 2.5 * u, [4 * u, 3 * u]); }
    const at = (e: Ev) => this.along(this.mapRoad, e.rs * this.kmU);
    // Chỉ vẽ những mốc cần biết lúc này: nút giao sắp tới (có mũi tên hướng rẽ), trạm xăng/trạm nghỉ kế tiếp; các nút khác là chấm mờ
    const nextJ = this.mode === 'truck' ? this.juncs.find((e) => !e.done && e.s > this.s) : undefined, nextA = this.mode === 'truck' ? this.auxs.find((e) => !e.done && e.s > this.s) : undefined;
    for (const e of this.juncs) { if (e.retry || e === nextJ) continue; dot(at(e), 2.6 * u, e.sigma === e.dir ? '#4caf3f' : '#ffffff', '#3f8fd6'); }
    for (const g of this.gates) { if (!this.mapSea.length) break; dot(this.along(this.mapSea, g / this.seaL * this.seaKm), 2.2 * u, g < this.s && this.mode === 'boat' ? '#4caf3f' : '#ffffff', '#2a9fd6'); }
    if (nextA) { const q = at(nextA); dot(q, 7.5 * u, '#ffffff', nextA.type === 'station' ? '#f08a24' : '#2f6fd0'); text(q, nextA.type === 'station' ? '⛽' : '☕', 9 * u); }
    if (nextJ) { const q = nextJ.retry ? this.along(this.mapRoad, nextJ.rs * this.kmU) : at(nextJ), [x, y] = T(q), a = nextJ.mapAng + nextJ.dir * 1.0; dot(q, 7.5 * u, '#ffd23f', '#7a4a22'); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(5 * u, 0); ctx.lineTo(-2.5 * u, -4 * u); ctx.lineTo(-2.5 * u, 4 * u); ctx.closePath(); ctx.fillStyle = '#7a4a22'; ctx.fill(); ctx.restore(); }
    const first = this.legs[0].mode === 'truck' ? roadPts[0] : seaPts[0], lastL = this.legs[this.legs.length - 1].mode === 'truck' ? roadPts : seaPts, last = lastL[lastL.length - 1];
    dot(first, 4.5 * u, '#4caf3f'); dot(last, 6 * u, '#e0342b'); text(last, '★', 8 * u, '#ffffff');
    // vị trí xe
    const d = this.det(); let me: [number, number];
    if (this.mode === 'boat') me = this.along(this.mapSea, this.s / this.seaL * this.seaKm); else if (d) me = this.loopAt(d, (this.s - d.from) / d.len); else me = this.along(this.mapRoad, this.routeS() * this.kmU);
    const [mx, my] = T(me); ctx.beginPath(); ctx.arc(mx, my, 6 * u, 0, 7); ctx.fillStyle = '#f08a24'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4 * u; ctx.stroke(); ctx.beginPath(); ctx.arc(mx, my, 9.5 * u, 0, 7); ctx.strokeStyle = '#f08a2466'; ctx.lineWidth = 2 * u; ctx.stroke();
    if (this.mode === 'boat') { const cx = w - 15 * u, cy = 15 * u, a = -this.phi - Math.PI / 2; ctx.beginPath(); ctx.arc(cx, cy, 10 * u, 0, 7); ctx.fillStyle = '#ffffffdd'; ctx.fill(); ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 1.5 * u; ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 8 * u, cy + Math.sin(a) * 8 * u); ctx.lineTo(cx + Math.cos(a + 2.5) * 5 * u, cy + Math.sin(a + 2.5) * 5 * u); ctx.lineTo(cx + Math.cos(a - 2.5) * 5 * u, cy + Math.sin(a - 2.5) * 5 * u); ctx.closePath(); ctx.fillStyle = '#e0342b'; ctx.fill(); ctx.font = `800 ${6 * u}px sans-serif`; ctx.fillStyle = '#3b2a17'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', cx, cy + 0.5 * u); }
  }

  dispose() {
    this.disposed = true; this.renderer.setAnimationLoop(null);
    for (const fn of this.cleanup) fn();
    this.ro.disconnect();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && !Object.values(GEO).includes(m.geometry as never)) m.geometry.dispose(); const sm2 = (o as THREE.Sprite).material as THREE.SpriteMaterial | undefined; if ((o as THREE.Sprite).isSprite && sm2) { sm2.map?.dispose(); sm2.dispose(); } });
    this.sky.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
