// Cảnh tĩnh của khu trạm dừng nghỉ / cây xăng / trạm sạc trên cao tốc (kiểu Việt Nam):
// mái che cây xăng trắng có viền màu, đảo bơm có bậc và cọc chắn, trụ bơm có màn số, cột giá điện tử bên lối vào,
// bãi đỗ xe con / xe tải có vỉa và dải cây, đèn cao áp, nhà dịch vụ mái ngói (cửa hàng, nhà hàng, nhà vệ sinh) có hành lang mái che,
// trụ sạc DC dưới mái pin mặt trời, biển chỉ dẫn xanh lá theo QCVN 41. Máy quay nhìn từ phía bắc (phía cao tốc) xuống phía nam,
// nên mọi mặt tiền, biển chữ đều quay về −z.
// Toàn bộ khối màu trơn gộp thành vài lưới (scene/batch.ts), toàn bộ chữ vẽ chung một tấm hoạ tiết (Atlas) nên tốn rất ít lần vẽ.
import * as THREE from 'three';
import { bakeColored } from '../scene/batch.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { grassTex } from '../scene/tex.ts';
import { fuelPriceNow } from '../../../shared/realPrices.ts';
import { playerVehicle } from './DriveExtras.ts';
import { person } from './RideParts.ts';

// ---------------------------------------------------------------- bố cục (StopArea dùng chung cho va chạm, đường đi)
export interface Box2 { x0: number; z0: number; x1: number; z1: number }
export const LOT: Box2 = { x0: -30, z0: -26, x1: 34, z1: 12.4 };
export const BUILDING: Box2 = { x0: -27, z0: 14, x1: 23, z1: 25 };
export const ISLANDS: Box2[] = [{ x0: -16.8, z0: -15.5, x1: -15.2, z1: -8.5 }, { x0: -6.8, z0: -15.5, x1: -5.2, z1: -8.5 }];
export const CHARGER_X = [8, 14, 20];
export const DOORS: Record<'shop' | 'food' | 'wc', [number, number]> = { shop: [-14, 13.4], food: [-1, 13.4], wc: [13, 13.4] };
export const ENTRY: [number, number] = [-37, -24];
export const EXIT: [number, number] = [41, -24];
/** Vùng mái che cây xăng và mái trạm sạc (để làm mờ khi xe, người đứng dưới). */
export const CANOPY: Box2 = { x0: -23, z0: -19, x1: 1, z1: -5 };
export const EV_CANOPY: Box2 = { x0: 5, z0: -15.5, x1: 24, z1: -6.5 };

export type SceneryKind = 'rest' | 'fuel' | 'charger';
export interface SceneryOpts { kind: SceneryKind; name: string; pumps: boolean; electric: boolean; lots: { x: number; z: number; taken?: boolean }[] }
export interface PumpScreen { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; x: number; z: number }
export interface Fade { group: THREE.Group; mats: THREE.Material[]; box: Box2; h: number; a: number }
export interface Scenery { fades: Fade[]; screens: PumpScreen[]; own: { dispose(): void }[]; sun: THREE.DirectionalLight }

// ---------------------------------------------------------------- bảng màu (ấm, low-poly như các cảnh khác)
const C = {
  grass: 0x9ccc72, asphalt: 0x545b65, asphaltD: 0x474d56, concrete: 0xc9ccd0, kerb: 0xe4e2dc, line: 0xfafafa, yellow: 0xffc928,
  white: 0xf7f8fa, canopyUnder: 0xeceef1, brand: 0x1f5fb8, brandD: 0x174a91, orange: 0xf08a24, red: 0xd8402c, dark: 0x2b2f36, steel: 0x8b929c,
  wall: 0xf4ead2, wallD: 0xe2d4b0, tile: 0xb8543a, tileD: 0x9c4632, glass: 0x8fc8e4, wood: 0x8a5a34, trunk: 0x7a5232,
  leaf: 0x4f9f45, leafL: 0x6cb95a, leafD: 0x3d8340, hedge: 0x5aa64c, wcWall: 0xdfe7ec, green: 0x1f8a4c, evGreen: 0x2f9e5a, solar: 0x22324f,
};
const CSS = (n: number) => '#' + n.toString(16).padStart(6, '0');
const FONT = '"Be Vietnam Pro", "Baloo 2", system-ui, sans-serif';

// ---------------------------------------------------------------- tấm hoạ tiết chữ chung
type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;
interface Rect { x: number; y: number; w: number; h: number }
class Atlas {
  readonly S = 2048; readonly canvas = document.createElement('canvas'); readonly tex: THREE.CanvasTexture;
  private cx = 0; private cy = 0; private rowH = 0; private items: { r: Rect; draw: Draw }[] = [];
  signs: THREE.BufferGeometry[] = []; decals: THREE.BufferGeometry[] = [];
  constructor() { this.canvas.width = this.canvas.height = this.S; this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8; }
  add(w: number, h: number, draw: Draw): Rect {
    w = Math.ceil(w); h = Math.ceil(h);
    if (this.cx + w + 8 > this.S) { this.cx = 0; this.cy += this.rowH + 8; this.rowH = 0; }
    const r = { x: this.cx + 4, y: this.cy + 4, w, h }; this.cx += w + 8; this.rowH = Math.max(this.rowH, h);
    this.items.push({ r, draw }); this.paint(r, draw); return r;
  }
  private paint(r: Rect, draw: Draw) { const g = this.canvas.getContext('2d')!; g.save(); g.translate(r.x, r.y); g.beginPath(); g.rect(0, 0, r.w, r.h); g.clip(); g.clearRect(0, 0, r.w, r.h); draw(g, r.w, r.h); g.restore(); }
  /** Vẽ lại mọi ô (khi phông chữ tải xong). */
  redraw() { for (const it of this.items) this.paint(it.r, it.draw); this.tex.needsUpdate = true; }
  /** Mặt phẳng W × H mét mang ô `r`, mặt hướng −z (về phía máy quay), tâm (x, y, z), xoay thêm `ry` quanh trục đứng. */
  sign(r: Rect, W: number, H: number, x: number, y: number, z: number, ry = 0) { const g = this.quad(r, W, H); g.rotateY(Math.PI + ry); g.translate(x, y, z); this.signs.push(g); }
  /** Chữ sơn nằm trên mặt đất, đọc xuôi từ phía máy quay. */
  decal(r: Rect, W: number, H: number, x: number, z: number, ry = 0, y = 0.05) { const g = this.quad(r, W, H); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI + ry); g.translate(x, y, z); this.decals.push(g); }
  private quad(r: Rect, W: number, H: number) {
    const g = new THREE.PlaneGeometry(W, H), uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (r.x + u * r.w) / this.S, 1 - (r.y + (1 - v) * r.h) / this.S); }
    return g;
  }
}
function fit(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800) { let s = size; do { g.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (g.measureText(text).width > maxW && s > 8); }
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function txt(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 800) { fit(g, text, maxW, size, weight); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(text, x, y); }
/** Biểu tượng dịch vụ (trắng) vẽ trong ô vuông s × s. */
function icon(g: CanvasRenderingContext2D, kind: 'fuel' | 'food' | 'wc' | 'p' | 'bolt' | 'cafe', x: number, y: number, s: number, col = '#fff') {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'fuel') { g.fillRect(22, 18, 40, 66); g.fillStyle = '#0000'; g.clearRect(30, 26, 24, 18); g.fillStyle = col; g.lineWidth = 7; g.beginPath(); g.moveTo(62, 40); g.lineTo(76, 48); g.lineTo(76, 74); g.lineTo(84, 74); g.lineTo(84, 34); g.stroke(); g.fillRect(16, 82, 52, 8); }
  else if (kind === 'food') { g.lineWidth = 7; g.beginPath(); for (const xx of [30, 40, 50]) { g.moveTo(xx, 14); g.lineTo(xx, 40); } g.moveTo(30, 40); g.quadraticCurveTo(40, 52, 50, 40); g.moveTo(40, 48); g.lineTo(40, 88); g.stroke(); g.beginPath(); g.moveTo(68, 88); g.lineTo(68, 14); g.quadraticCurveTo(84, 30, 80, 56); g.lineTo(68, 56); g.stroke(); }
  else if (kind === 'wc') { for (const [cx, dress] of [[30, false], [70, true]] as [number, boolean][]) { g.beginPath(); g.arc(cx, 20, 9, 0, 7); g.fill(); if (dress) { g.beginPath(); g.moveTo(cx - 6, 33); g.lineTo(cx + 6, 33); g.lineTo(cx + 15, 66); g.lineTo(cx - 15, 66); g.closePath(); g.fill(); g.fillRect(cx - 8, 64, 5, 24); g.fillRect(cx + 3, 64, 5, 24); } else { g.fillRect(cx - 11, 33, 22, 32); g.fillRect(cx - 10, 62, 8, 26); g.fillRect(cx + 2, 62, 8, 26); } } g.fillRect(48, 12, 4, 78); }
  else if (kind === 'p') { g.font = `900 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 50, 56); }
  else if (kind === 'bolt') { g.beginPath(); g.moveTo(58, 6); g.lineTo(22, 56); g.lineTo(46, 56); g.lineTo(38, 94); g.lineTo(78, 40); g.lineTo(54, 40); g.closePath(); g.fill(); }
  else { g.lineWidth = 7; g.strokeRect(22, 40, 44, 40); g.beginPath(); g.arc(70, 58, 10, -1.4, 1.4); g.stroke(); for (const xx of [34, 46]) { g.beginPath(); g.moveTo(xx, 32); g.quadraticCurveTo(xx + 6, 22, xx, 12); g.stroke(); } g.fillRect(16, 84, 56, 6); }
  g.restore();
}

// ---------------------------------------------------------------- khối hình
const PRISM = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
const HIP = (() => { const g = new THREE.CylinderGeometry(0.35 * Math.SQRT1_2, Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); return g; })();
type G = THREE.Group;
const box = (g: G, color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rough?: number) => { const m = mesh(GEO.box, mat(color, rough === undefined ? {} : { rough }), x, y, z, sx, sy, sz); g.add(m); return m; };
const cyl = (g: G, color: number, x: number, y: number, z: number, r: number, h: number, rough?: number) => { const m = mesh(GEO.cyl, mat(color, rough === undefined ? {} : { rough }), x, y, z, r, h, r); g.add(m); return m; };
/** Mái bốn dốc phủ nền w × d, chân mái ở độ cao y. */
let TILE: THREE.CanvasTexture | null = null; const TILE_M = new Map<number, THREE.MeshStandardMaterial>();
/** Hoạ tiết ngói: các hàng ngói xếp lớp, viền tối mỗi hàng. */
function tileMat(color: number): THREE.MeshStandardMaterial {
  if (!TILE) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 16) { g.fillStyle = 'rgba(70,30,20,0.32)'; g.fillRect(0, y + 12, 64, 4); g.fillStyle = 'rgba(255,255,255,0.0)'; for (let x = (y / 16) % 2 ? 8 : 0; x < 64; x += 16) { g.fillStyle = 'rgba(70,30,20,0.16)'; g.fillRect(x, y, 2, 12); } } TILE = new THREE.CanvasTexture(c); TILE.colorSpace = THREE.SRGBColorSpace; TILE.wrapS = TILE.wrapT = THREE.RepeatWrapping; TILE.repeat.set(10, 7); TILE.anisotropy = 4; }
  let m = TILE_M.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, map: TILE, roughness: 0.85 }); TILE_M.set(color, m); } return m;
}
const hip = (g: G, color: number, x: number, y: number, z: number, w: number, h: number, d: number) => { const m = mesh(HIP, tileMat(color), x, y + h / 2, z, w, h, d); g.add(m); return m; };
/** Thanh nối hai điểm trên mặt đất (vạch sơn, vỉa…) dày t, cao h. */
function bar(g: G, color: number, x0: number, z0: number, x1: number, z1: number, t: number, h: number, y = h / 2, rough = 1) { const l = Math.hypot(x1 - x0, z1 - z0), m = box(g, color, (x0 + x1) / 2, y, (z0 + z1) / 2, t, h, l, rough); m.rotation.y = Math.atan2(x1 - x0, z1 - z0); return m; }

function tree(g: G, x: number, z: number, s: number, r: () => number) {
  const k = r();
  if (k < 0.28) { // cau / dừa cảnh
    cyl(g, 0x9b8366, x, 2.6 * s, z, 0.14 * s, 5.2 * s);
    for (let i = 0; i < 8; i++) { // tàu lá rủ xuống quanh ngọn
      const a = (i / 8) * Math.PI * 2 + r() * 0.4, droop = 0.35 + (i % 2) * 0.25, L = 2.6 * s, f = mesh(GEO.box, mat(i % 2 ? C.leafL : C.leaf), 0, 0, 0, L, 0.06, 0.55 * s);
      f.rotation.order = 'YXZ'; f.rotation.y = -a; f.rotation.z = -droop; f.position.set(x + Math.cos(a) * L * 0.45 * Math.cos(droop), 5.15 * s - Math.sin(droop) * L * 0.45, z + Math.sin(a) * L * 0.45 * Math.cos(droop)); g.add(f);
    }
    g.add(mesh(GEO.sphere, mat(C.leaf), x, 5.2 * s, z, 0.45 * s));
  } else { // cây tán tròn (bằng lăng, sao đen)
    cyl(g, C.trunk, x, 1.2 * s, z, 0.2 * s, 2.4 * s);
    const col = k < 0.55 ? C.leaf : k < 0.8 ? C.leafD : 0x8a6fb8; // thỉnh thoảng một cây bằng lăng tím
    g.add(mesh(GEO.sphere, mat(col), x, 3.3 * s, z, 1.7 * s, 1.4 * s, 1.7 * s), mesh(GEO.sphere, mat(col === 0x8a6fb8 ? 0x9f85cc : C.leafL), x + 0.6 * s, 3.9 * s, z - 0.4 * s, 1.1 * s));
  }
}
function shrubRow(g: G, x0: number, z0: number, x1: number, z1: number) { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.3)); for (let i = 0; i <= n; i++) { const t = i / n; g.add(mesh(GEO.sphere, mat(i % 3 ? C.hedge : C.leafL), x0 + (x1 - x0) * t, 0.45, z0 + (z1 - z0) * t, 0.75, 0.55, 0.75)); } }
/** Đèn cao áp hai cần (cao 9 m). */
function highLamp(g: G, x: number, z: number, arms: number[] = [0, Math.PI]) {
  cyl(g, 0xc9ccd1, x, 0.3, z, 0.32, 0.6); cyl(g, 0x9aa1ab, x, 4.8, z, 0.13, 9.0);
  for (const a of arms) { const ax = Math.cos(a), az = Math.sin(a); const arm = box(g, 0x9aa1ab, x + ax * 0.9, 9.1, z + az * 0.9, 1.8, 0.1, 0.1); arm.rotation.y = -a; const head = box(g, 0xfffbe6, x + ax * 1.8, 9.0, z + az * 1.8, 0.8, 0.14, 0.36); head.rotation.y = -a; }
}
function bench(g: G, x: number, z: number, ry = 0) { const b = new THREE.Group(); box(b, 0xd9d4c7, 0, 0.42, 0, 1.6, 0.12, 0.5, 0.95); box(b, 0xc9c3b3, -0.6, 0.2, 0, 0.18, 0.4, 0.42); box(b, 0xc9c3b3, 0.6, 0.2, 0, 0.18, 0.4, 0.42); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); }
function planter(g: G, x: number, z: number) { box(g, 0xb98a5a, x, 0.3, z, 0.8, 0.6, 0.8); g.add(mesh(GEO.ball, mat(C.leafD), x, 0.95, z, 0.55, 0.6, 0.55), mesh(GEO.ball, mat(0xe8457f), x + 0.2, 1.2, z - 0.2, 0.16)); }

// ---------------------------------------------------------------- dựng cảnh
export function buildScenery(scene: THREE.Scene, o: SceneryOpts): Scenery {
  const own: { dispose(): void }[] = [], fades: Fade[] = [], screens: PumpScreen[] = [], r = rng(182);
  const st = new THREE.Group(), at = new Atlas(), ao = new THREE.Group();
  own.push(at.tex);
  // trời, nắng: mặt trời ở phía bắc-tây (sau lưng máy quay) để mặt tiền nhà, mái che sáng rõ
  scene.background = new THREE.Color(0xc4e6f6); scene.fog = new THREE.Fog(0xc4e6f6, 110, 260);
  scene.add(new THREE.HemisphereLight(0xfdfbff, 0x8a9a74, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.55); sun.position.set(-30, 70, -45); sun.target.position.set(0, 0, 0);
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 60, bottom: -60, near: 10, far: 200 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---- nền cỏ (có vân), cao tốc ở phía bắc, nhánh rẽ
  { const t = grassTex().clone(); t.needsUpdate = true; t.repeat.set(36, 28); const m = new THREE.MeshStandardMaterial({ color: C.grass, map: t, roughness: 1 }); const gr = new THREE.Mesh(new THREE.PlaneGeometry(300, 240), m); gr.rotation.x = -Math.PI / 2; gr.position.set(0, -0.02, 10); gr.receiveShadow = true; scene.add(gr); own.push(t, m, gr.geometry); }
  box(st, C.asphaltD, 0, 0.0, -50, 300, 0.06, 17);
  for (let x = -140; x < 150; x += 12) for (const z of [-53.5, -46.5]) box(st, C.line, x, 0.04, z, 5, 0.02, 0.16);
  for (const z of [-58.2, -41.8]) box(st, C.line, 0, 0.04, z, 300, 0.02, 0.22);
  box(st, 0x3f7a3a, 0, 0.1, -50, 300, 0.2, 1.4); for (let x = -140; x < 150; x += 6) box(st, x % 12 ? C.hedge : C.leafD, x, 0.6, -50, 5.4, 0.8, 0.9); // dải phân cách trồng cây
  for (const z of [-59, -41]) { for (let x = -148; x < 150; x += 4) box(st, C.steel, x, 0.45, z, 0.12, 0.9, 0.12, 0.5); box(st, 0xd5d9de, 0, 0.72, z, 300, 0.3, 0.06, 0.4); } // hộ lan tôn sóng
  const ramp = (pts: [number, number][]) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; bar(st, C.asphalt, x0, z0, x1, z1, 7.4, 0.04, 0.015); const nx = -(z1 - z0), nz = x1 - x0, l = Math.hypot(nx, nz); for (const s of [-1, 1]) bar(st, C.line, x0 + nx / l * s * 3.35, z0 + nz / l * s * 3.35, x1 + nx / l * s * 3.35, z1 + nz / l * s * 3.35, 0.16, 0.02, 0.045); } };
  ramp([[-96, -42], [-70, -41], [-50, -34], [-34, -24]]); ramp([[38, -24], [52, -34], [70, -41], [96, -42]]);

  // ---- sân bê tông nhựa toàn khu, vỉa bao quanh, dải cây
  box(st, C.asphalt, 2, 0.006, -8, 72, 0.03, 42);
  box(st, 0xd8d6cf, -2, 0.12, 13.2, 62, 0.24, 1.6, 0.95); // vỉa hè trước nhà
  const kerb = (x0: number, z0: number, x1: number, z1: number) => bar(st, C.kerb, x0, z0, x1, z1, 0.35, 0.18, 0.09, 0.95);
  kerb(-33.8, -18, -33.8, 12.2); kerb(37.8, -17.5, 37.8, 12.2); kerb(-27, -29, 31, -29);
  // dải cỏ trồng cây giữa cao tốc và khu trạm
  for (let x = -24; x <= 28; x += 8) tree(st, x + r() * 2, -32 - r() * 3, 0.9 + r() * 0.3, r);
  shrubRow(st, -26, -29.8, 30, -29.8);
  // đảo cây đầu hàng ô đỗ và giữa ô xe con / xe tải
  for (const [x0, x1] of [[-32.8, -27.2], [16.6, 19.4]]) { box(st, C.kerb, (x0 + x1) / 2, 0.1, 8.3, x1 - x0, 0.2, 6.4, 0.95); box(st, C.grass, (x0 + x1) / 2, 0.21, 8.3, x1 - x0 - 0.4, 0.02, 6.0); tree(st, (x0 + x1) / 2, 8.3, 0.85, r); shrubRow(st, x0 + 0.6, 6, x0 + 0.6, 10.6); }
  // ô đỗ xe con (vạch trắng sắc, có vạch đầu ô), ô xe tải
  for (const b of o.lots) { for (const s of [-2.1, 2.1]) box(st, C.line, b.x + s, 0.04, b.z, 0.14, 0.02, 5.6, 1); }
  box(st, C.line, -24 + 4.5 * 4.2, 0.04, 5.6, 46, 0.02, 0.14, 1);
  for (let i = 0; i < 4; i++) { const x = 21.2 + i * 4.4; box(st, C.line, x, 0.04, 6.0, 0.14, 0.02, 11, 1); }
  box(st, C.line, 27.8, 0.04, 0.5, 13.2, 0.02, 0.14, 1);
  // mũi tên chiều đi trên làn chạy
  const arrow = at.add(96, 192, (g) => { g.fillStyle = '#fff'; g.fillRect(36, 70, 24, 116); g.beginPath(); g.moveTo(48, 6); g.lineTo(90, 76); g.lineTo(6, 76); g.closePath(); g.fill(); });
  for (const [x, z, a] of [[-27, -18, -2.4], [-6, -1.5, Math.PI / 2], [12, -1.5, Math.PI / 2], [30, -14, Math.PI * 0.82]] as [number, number, number][]) at.decal(arrow, 1.0, 2.6, x, z, a);
  // chữ sơn trong ô xe tải và ô sạc
  const truckTxt = at.add(256, 80, (g, w, h) => txt(g, 'XE TẢI', w / 2, h / 2 + 2, w - 10, 64, '#ffffff'));
  for (let i = 0; i < 3; i++) at.decal(truckTxt, 3.0, 0.95, 23.4 + i * 4.4, 9.6);
  const pTxt = at.add(100, 100, (g) => icon(g, 'p', 0, 0, 100));
  for (const b of o.lots) if (!b.taken) at.decal(pTxt, 1.2, 1.2, b.x, b.z + 1.9);

  // ---- cây xăng: nền bê tông, đảo bơm, trụ bơm, mái che
  if (o.pumps) {
    box(st, C.concrete, -11, 0.016, -12, 26, 0.03, 15, 0.95);
    for (let x = -23; x <= 1; x += 4) box(st, 0xaeb2b8, x, 0.035, -12, 0.06, 0.01, 15, 1); for (let z = -19; z <= -5; z += 3.5) box(st, 0xaeb2b8, -11, 0.035, z, 26, 0.01, 0.06, 1); // khe co giãn bê tông
    for (const isl of ISLANDS) { const x = (isl.x0 + isl.x1) / 2; for (const sx of [-1, 1]) box(st, C.yellow, x + sx * 1.15, 0.04, -12, 0.12, 0.01, 9.6, 1); } // vạch vàng dẫn vào làn bơm
    for (const isl of ISLANDS) {
      const x = (isl.x0 + isl.x1) / 2;
      box(st, 0xe7e8ea, x, 0.12, -12, 1.7, 0.24, 8.8, 0.95); box(st, 0xd0d3d7, x, 0.25, -12, 1.5, 0.04, 8.6, 0.95);
      for (const z of [-16.7, -7.3]) { cyl(st, C.yellow, x, 0.5, z, 0.14, 1.0, 0.6); for (const y of [0.25, 0.65]) cyl(st, 0x22252b, x, y, z, 0.145, 0.14, 0.6); } // cọc chắn sơn vàng đen
      for (const z of [-14, -10]) { // trụ bơm: chân, thân trắng, sườn xanh, đầu hộp xanh, cò bơm 3 loại nhiên liệu mỗi bên
        box(st, 0x3a3f47, x, 0.32, z, 1.0, 0.16, 1.3, 0.8);
        box(st, C.white, x, 1.05, z, 0.88, 1.3, 1.12, 0.5); box(st, C.brand, x, 0.62, z, 0.9, 0.4, 1.14, 0.6);
        box(st, C.brand, x, 1.97, z, 0.96, 0.52, 1.22, 0.6); box(st, C.orange, x, 1.75, z, 0.97, 0.07, 1.23, 0.6); box(st, C.brandD, x, 2.26, z, 0.98, 0.06, 1.24, 0.5); box(st, 0xffffff, x, 2.3, z, 0.5, 0.02, 0.9, 0.5);
        for (const s of [-1, 1]) {
          box(st, 0x1d2329, x + s * 0.455, 1.6, z, 0.03, 0.5, 0.9, 0.4); // khung màn hình
          [0xd8402c, 0x2f9e5a, 0x2b2f36].forEach((col, k) => { const zz = z - 0.34 + k * 0.34; box(st, col, x + s * 0.5, 1.12, zz, 0.12, 0.26, 0.16, 0.6); bar(st, 0x1b1d22, x + s * 0.52, zz, x + s * 0.62, zz, 0.06, 0.7, 0.72); });
        }
      }
      // bình cứu hoả, thùng cát ở đầu đảo
      box(st, 0xc62828, x, 0.55, -7.9, 0.7, 0.6, 0.45, 0.6); box(st, 0xd8402c, x - 0.25, 0.42, -16.1, 0.22, 0.6, 0.22, 0.4); cyl(st, 0xd8402c, x + 0.25, 0.38, -16.1, 0.12, 0.5, 0.4);
    }
    // cột mái che bọc nhôm trắng, chân ốp xanh
    const pr = at.add(160, 60, (g, w, h) => { rr(g, 0, 0, w, h, 10, '#d8402c'); txt(g, 'CẤM LỬA', w / 2, h / 2 + 2, w - 12, 34, '#fff'); });
    for (const isl of ISLANDS) at.sign(pr, 0.55, 0.21, (isl.x0 + isl.x1) / 2, 1.9, -8.1 - 0.29);
    // số trụ trên đầu hộp
    [1, 2, 3, 4].forEach((n) => { const isl = ISLANDS[n <= 2 ? 0 : 1], x = (isl.x0 + isl.x1) / 2, z = n % 2 ? -14 : -10, plate = at.add(64, 64, (g, w) => { rr(g, 0, 0, w, w, 12, '#ffffff'); txt(g, String(n), w / 2, w / 2 + 3, w - 8, 50, CSS(C.brand), 'center', 900); }); at.sign(plate, 0.4, 0.4, x, 1.97, z - 0.62); const side = n === 1 || n === 3 ? -1 : 1; at.sign(plate, 0.4, 0.4, x + side * 0.49, 1.97, z, side * Math.PI / 2); });
    // màn hình trụ (canvas riêng, nhảy số khi bơm)
    for (const isl of ISLANDS) for (const z of [-14, -10]) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const ctx = c.getContext('2d')!; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const x = (isl.x0 + isl.x1) / 2, m = new THREE.MeshBasicMaterial({ map: tex });
      const two = [-1, 1].map((side) => { const pg = new THREE.PlaneGeometry(0.8, 0.4); pg.rotateY(side * Math.PI / 2); pg.translate(x + side * 0.475, 1.6, z); return pg; }), pg = mergeAll(two);
      const p = new THREE.Mesh(pg, m); scene.add(p); own.push(tex, m, pg);
      screens.push({ tex, ctx, x, z });
    }
    // mái che: tấm phẳng, mặt dưới sáng có đèn âm trần, viền trắng có dải màu
    const roof = new THREE.Group(), cx = (CANOPY.x0 + CANOPY.x1) / 2, cz = (CANOPY.z0 + CANOPY.z1) / 2, W = CANOPY.x1 - CANOPY.x0, D = CANOPY.z1 - CANOPY.z0;
    for (const isl of ISLANDS) for (const z of [-15.9, -8.1]) { const x = (isl.x0 + isl.x1) / 2; box(roof, C.white, x, 3.0, z, 0.55, 5.6, 0.55, 0.45); box(roof, C.brand, x, 0.75, z, 0.6, 1.1, 0.6, 0.6); }
    box(roof, 0xf1f3f5, cx, 6.6, cz, W - 0.2, 0.06, D - 0.2, 0.9); // tấm mái (một lớp mỏng: khi mờ đi không phủ màu xám lên cả khu)
    for (let x = CANOPY.x0 + 2; x < CANOPY.x1 - 1; x += 2) box(roof, 0xdfe3e7, x, 6.64, cz, 0.06, 0.02, D - 0.6, 0.9); // đường ghép tôn trên nóc
    for (const [x, z, w, d] of [[cx, CANOPY.z0, W + 0.1, 0.16], [cx, CANOPY.z1, W + 0.1, 0.16], [CANOPY.x0, cz, 0.16, D + 0.1], [CANOPY.x1, cz, 0.16, D + 0.1]]) { box(roof, C.white, x, 6.15, z, w, 1.1, d, 0.9); box(roof, C.brand, x, 5.82, z, w + 0.02, 0.4, d + 0.02, 0.6); box(roof, C.orange, x, 6.1, z, w + 0.02, 0.08, d + 0.02, 0.6); }
    const baked = bakeColored(roof, true, false);
    // chữ trên viền mái (mờ cùng mái)
    const fc = document.createElement('canvas'); fc.width = 1024; fc.height = 64; const fg = fc.getContext('2d')!;
    const drawFascia = () => { fg.clearRect(0, 0, 1024, 64); icon(fg, 'fuel', 300, 6, 52, CSS(C.brand)); txt(fg, 'XĂNG DẦU', 512, 34, 360, 46, CSS(C.brand), 'center', 900); icon(fg, 'fuel', 672, 6, 52, CSS(C.brand)); ft.needsUpdate = true; };
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; drawFascia();
    const fm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }), fp = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, W * 0.92 / 16), fm); fp.rotation.y = Math.PI; fp.position.set(cx, 6.28, CANOPY.z0 - 0.1); baked.add(fp); own.push(ft, fm, fp.geometry);
    void document.fonts?.ready.then(drawFascia);
    fades.push(fadeOf(baked, CANOPY, 6.6, own)); scene.add(baked);
    // cột giá điện tử bên lối vào (giá thật, cập nhật theo bảng giá)
    const P = { ron95: fuelPriceNow('ron95'), e5: fuelPriceNow('e5'), dau: fuelPriceNow('do') };
    pylon(st, at, -38, -31, [['RON 95-III', P.ron95], ['E5 RON 92-II', P.e5], ['DO 0,05S-II', P.dau]], 'XĂNG DẦU', 'đ/lít');
  }

  // ---- trạm sạc: ô sơn xanh, trụ DC, mái pin mặt trời
  {
    for (const x of CHARGER_X) { box(st, C.evGreen, x, 0.03, -11, 3.6, 0.02, 6, 1); for (const s of [-2, 2]) box(st, C.line, x + s, 0.04, -11, 0.14, 0.02, 6.4, 1); }
    const bolt = at.add(100, 100, (g) => icon(g, 'bolt', 0, 0, 100)); for (const x of CHARGER_X) at.decal(bolt, 1.6, 1.6, x, -9.4);
    const kw = at.add(128, 64, (g, w, h) => { rr(g, 0, 0, w, h, 8, '#0f3d22'); txt(g, 'DC 60kW', w / 2, h / 2 + 2, w - 10, 30, '#7dff9a'); });
    for (const x of CHARGER_X) { const px = x + 2.6, pz = -11; box(st, 0x3a3f47, px, 0.12, pz, 0.9, 0.24, 1.2, 0.8); box(st, C.white, px, 1.15, pz, 0.62, 1.9, 0.85, 0.45); box(st, C.evGreen, px, 1.15, pz - 0.43, 0.64, 1.9, 0.04, 0.6); box(st, C.evGreen, px, 2.17, pz, 0.7, 0.14, 0.95, 0.6); box(st, 0x1d2329, px - 0.32, 1.5, pz, 0.03, 0.5, 0.55, 0.4); box(st, 0x1b1d22, px - 0.33, 1.0, pz + 0.3, 0.12, 0.3, 0.12, 0.6); at.sign(kw, 0.5, 0.25, px, 1.75, pz - 0.46); }
    const ev = new THREE.Group();
    for (const x of [EV_CANOPY.x0 + 0.5, (EV_CANOPY.x0 + EV_CANOPY.x1) / 2, EV_CANOPY.x1 - 0.5]) for (const z of [EV_CANOPY.z0 + 0.4, EV_CANOPY.z1 - 0.4]) box(st, 0x5d6470, x, 2.2, z, 0.25, 4.4, 0.25, 0.5);
    const ecx = (EV_CANOPY.x0 + EV_CANOPY.x1) / 2, ecz = (EV_CANOPY.z0 + EV_CANOPY.z1) / 2, EW = EV_CANOPY.x1 - EV_CANOPY.x0, ED = EV_CANOPY.z1 - EV_CANOPY.z0;
    box(ev, 0x5d6470, ecx, 4.45, ecz, EW, 0.14, ED, 0.5);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const p = box(ev, C.solar, EV_CANOPY.x0 + 1.6 + i * 3.15, 4.62, EV_CANOPY.z0 + 1.6 + j * 3.0, 3.0, 0.08, 2.85, 0.35); p.rotation.x = -0.08; }
    box(ev, C.evGreen, ecx, 4.3, EV_CANOPY.z0, EW + 0.1, 0.36, 0.12, 0.6);
    const evb = bakeColored(ev, true, false); fades.push(fadeOf(evb, EV_CANOPY, 4.8, own)); scene.add(evb);
    const evs = at.add(320, 160, (g, w, h) => { rr(g, 0, 0, w, h, 16, '#ffffff'); rr(g, 6, 6, w - 12, h - 12, 12, CSS(C.evGreen)); icon(g, 'bolt', 14, 26, 108); txt(g, 'TRẠM SẠC', 210, 58, 190, 44, '#fff', 'center', 900); txt(g, o.electric ? 'Sạc nhanh DC' : 'Xe điện', 210, 108, 190, 30, '#eaffef', 'center', 700); });
    box(st, 0x9aa1ab, 26.5, 2.0, -15, 0.12, 4.0, 0.12, 0.5); at.sign(evs, 2.6, 1.3, 26.5, 3.6, -15.08);
    if (!o.pumps) pylon(st, at, -38, -31, [['Sạc nhanh DC', fuelPriceNow('dien_dc')], ['Sạc AC', fuelPriceNow('dien_nha')]], 'TRẠM SẠC', 'đ/kWh');
  }

  // ---- nhà dịch vụ: cửa hàng tiện lợi, nhà hàng, khu vệ sinh; hành lang mái ngói phía trước
  {
    const Z0 = BUILDING.z0, Z1 = BUILDING.z1, ZM = (Z0 + Z1) / 2, DZ = Z1 - Z0;
    // nền nhà, bậc
    box(st, 0xcfc6b4, (BUILDING.x0 + BUILDING.x1) / 2, 0.18, ZM, BUILDING.x1 - BUILDING.x0 + 1, 0.36, DZ + 0.6, 0.95);
    // cửa hàng tiện lợi: tường kính lớn, mái bốn dốc ngói
    const shop = { x0: -27, x1: -6.5 }, food = { x0: -6, x1: 7.5 }, wc = { x0: 8, x1: 23 };
    { const cx = (shop.x0 + shop.x1) / 2, w = shop.x1 - shop.x0;
      box(st, C.wall, cx, 2.3, ZM, w, 4.2, DZ); box(st, C.wallD, cx, 0.6, Z0 - 0.02, w, 0.5, 0.06);
      for (let x = shop.x0 + 1.2; x < shop.x1 - 0.8; x += 2.6) { if (Math.abs(x + 1.3 - DOORS.shop[0]) < 1.6) continue; box(st, C.glass, x + 1.3, 2.1, Z0 - 0.03, 2.4, 2.4, 0.06, 0.25); }
      for (let x = shop.x0 + 1.2; x <= shop.x1 - 0.8; x += 2.6) box(st, 0x6b7380, x, 2.1, Z0 - 0.06, 0.12, 2.6, 0.06, 0.5);
      hip(st, C.tile, cx, 4.4, ZM, w + 1.6, 2.4, DZ + 1.6); box(st, 0xfdf6e6, cx, 4.35, ZM, w + 1.7, 0.18, DZ + 1.7, 0.8);
    }
    // nhà hàng: hai tầng mái (mái chồng diêm), cột gỗ, cửa kính
    { const cx = (food.x0 + food.x1) / 2, w = food.x1 - food.x0;
      box(st, C.wall, cx, 2.6, ZM, w, 4.8, DZ); for (let x = food.x0 + 0.6; x <= food.x1 - 0.6; x += 2.1) cyl(st, C.wood, x, 2.3, Z0 - 0.25, 0.16, 4.2, 0.7);
      for (let x = food.x0 + 1.6; x < food.x1 - 1; x += 2.1) { if (Math.abs(x - DOORS.food[0]) < 1.4) continue; box(st, C.glass, x, 2.3, Z0 - 0.03, 1.5, 2.6, 0.06, 0.25); }
      hip(st, C.tileD, cx, 5.0, ZM, w + 2.0, 1.6, DZ + 2.0); box(st, C.wall, cx, 7.0, ZM, w * 0.55, 1.4, DZ * 0.55); hip(st, C.tile, cx, 7.6, ZM, w * 0.7, 1.9, DZ * 0.7);
      box(st, 0xfdf6e6, cx, 4.95, ZM, w + 2.1, 0.18, DZ + 2.1, 0.8);
    }
    // khu vệ sinh: tường ốp gạch sáng, lam thông gió, mái bằng có sê-nô
    { const cx = (wc.x0 + wc.x1) / 2, w = wc.x1 - wc.x0;
      box(st, C.wcWall, cx, 2.1, ZM, w, 3.8, DZ, 0.6); box(st, 0xb9c6d0, cx, 0.5, Z0 - 0.02, w, 0.6, 0.06, 0.6);
      for (let x = wc.x0 + 1; x < wc.x1 - 0.5; x += 0.5) if (Math.abs(x - DOORS.wc[0]) > 2.2) box(st, 0x9aa8b4, x, 3.25, Z0 - 0.05, 0.08, 0.7, 0.08, 0.5);
      box(st, 0xf4f6f8, cx, 4.1, ZM, w + 0.6, 0.35, DZ + 0.6, 0.7); box(st, 0xd3dae0, cx, 4.45, ZM, w + 0.6, 0.4, 0.2 + DZ + 0.6, 0.7);
      // bồn nước inox trên mái
      cyl(st, 0xdfe6ee, wc.x1 - 3, 5.3, ZM + 2, 0.6, 1.4, 0.3); box(st, 0x8f97a3, wc.x1 - 3, 4.6, ZM + 2, 1.4, 0.12, 1.4, 0.6);
    }
    // cửa ra vào
    box(st, 0x6a4a2f, DOORS.shop[0], 1.3, Z0 - 0.07, 2.2, 2.6, 0.08, 0.7); box(st, C.glass, DOORS.shop[0], 1.4, Z0 - 0.1, 1.8, 2.2, 0.04, 0.2);
    box(st, 0x7a4a22, DOORS.food[0], 1.4, Z0 - 0.07, 2.4, 2.8, 0.08, 0.7); box(st, 0xffe7a8, DOORS.food[0], 1.4, Z0 - 0.1, 2.0, 2.4, 0.04, 0.6);
    for (const s of [-1.3, 1.3]) box(st, 0x3c6e9e, DOORS.wc[0] + s, 1.2, Z0 - 0.07, 1.6, 2.4, 0.08, 0.6);
    // hành lang có mái che trước nhà (cột tránh các cửa)
    box(st, 0xfdf6e6, -2, 3.25, 12.95, 51, 0.18, 2.3, 0.8); box(st, C.tile, -2, 3.45, 12.95, 51.4, 0.22, 2.6); box(st, C.tileD, -2, 3.3, 11.75, 51.4, 0.3, 0.12);
    for (let x = -26.5; x <= 22.5; x += 3.5) { if (Object.values(DOORS).some(([dx]) => Math.abs(x - dx) < 2.4)) continue; cyl(st, 0xfdf6e6, x, 1.62, 11.95, 0.14, 3.2, 0.6); }
    bench(st, -22, 12.9); bench(st, -6.6, 12.9); bench(st, 6.6, 12.9); bench(st, 19.5, 12.9); planter(st, -16.6, 12.6); planter(st, -11.4, 12.6); planter(st, 10.2, 12.6); planter(st, 15.8, 12.6);
    // bảng hiệu trên tường
    const shopName = o.kind === 'rest' ? 'CỬA HÀNG TIỆN LỢI' : 'CỬA HÀNG XĂNG DẦU';
    const sShop = at.add(640, 96, (g, w, h) => { rr(g, 0, 0, w, h, 10, CSS(C.green)); rr(g, 6, 6, w - 12, h - 12, 8, '#23995a'); icon(g, 'cafe', 18, 14, 68); txt(g, shopName, w / 2 + 34, h / 2 + 3, w - 130, 56, '#fff', 'center', 900); });
    at.sign(sShop, 9.5, 1.42, (shop.x0 + shop.x1) / 2, 3.95, Z0 - 0.08);
    const foodName = o.kind === 'rest' ? 'NHÀ HÀNG · ĐẶC SẢN' : 'VĂN PHÒNG TRẠM';
    const sFood = at.add(560, 96, (g, w, h) => { rr(g, 0, 0, w, h, 10, '#6e1f12'); rr(g, 5, 5, w - 10, h - 10, 8, '#8c2a1c'); if (o.kind === 'rest') icon(g, 'food', 14, 12, 72, '#ffd36a'); txt(g, foodName, w / 2 + (o.kind === 'rest' ? 32 : 0), h / 2 + 3, w - 120, 54, '#ffd36a', 'center', 900); });
    at.sign(sFood, 8.2, 1.4, (food.x0 + food.x1) / 2, 4.15, Z0 - 0.3);
    const sWc = at.add(480, 96, (g, w, h) => { rr(g, 0, 0, w, h, 10, '#1f4fa8'); icon(g, 'wc', 12, 8, 80); txt(g, 'NHÀ VỆ SINH', w / 2 + 40, h / 2 + 3, w - 120, 54, '#fff', 'center', 900); });
    at.sign(sWc, 6.5, 1.3, DOORS.wc[0], 2.95, Z0 - 0.1);
    for (const [t, s] of [['NAM', -1.3], ['NỮ', 1.3]] as [string, number][]) { const pl = at.add(96, 48, (g, w, h) => { rr(g, 0, 0, w, h, 8, '#ffffff'); txt(g, t, w / 2, h / 2 + 2, w - 10, 32, '#1f4fa8', 'center', 900); }); at.sign(pl, 0.7, 0.35, DOORS.wc[0] + s, 2.0, Z0 - 0.12); }
    // biển tên trạm trên nóc nhà hàng
    const nameT = at.add(900, 120, (g, w, h) => { rr(g, 0, 0, w, h, 14, '#ffffff'); rr(g, 6, 6, w - 12, h - 12, 10, CSS(C.brand)); txt(g, o.name.toUpperCase(), w / 2, h / 2 + 4, w - 60, 70, '#ffffff', 'center', 900); });
    for (const x of [-4.2, 5.7]) box(st, 0x5d6470, x, 8.6, ZM - 2, 0.14, 3.0, 0.14, 0.5);
    at.sign(nameT, 13, 1.73, (food.x0 + food.x1) / 2, 9.6, ZM - 2.1);
    // người đứng chơi, ngồi nghỉ trước nhà
    for (const [i, x, z, ry] of [[1, -20.5, 12.6, 0.4], [4, -8.6, 12.4, -0.3], [2, 3.2, 12.7, 3.0], [5, 18, 12.5, 0.2]] as [number, number, number, number][]) { const p = person(i, 1.3); p.position.set(x, 0.24, z); p.rotation.y = ry; st.add(p); }
  }

  // ---- đèn cao áp, cây quanh khu, lùm cây xa phía nam
  for (const [x, z] of [[-33.8, -12], [-33.8, 4], [37.8, -12], [37.8, 4], [-30, 8.3], [18, 8.3], [2, -29], [27, -29]] as [number, number][]) highLamp(st, x, z, x < -33 || x > 37 ? [x < 0 ? 0 : Math.PI] : [0, Math.PI]);
  for (let i = 0; i < 26; i++) { const x = -60 + i * 4.8 + r() * 2, z = 30 + r() * 10; tree(st, x, z, 1 + r() * 0.5, r); }
  for (let i = 0; i < 10; i++) { tree(st, -40 - r() * 14, -20 + i * 5 + r() * 2, 0.9 + r() * 0.4, r); tree(st, 44 + r() * 14, -20 + i * 5 + r() * 2, 0.9 + r() * 0.4, r); }
  // xe đỗ sẵn: một xe tải trong ô xe tải
  { const t = bakeColored(playerVehicle('tai_nang', 0x2f6fd0).root, true); t.position.set(32.4, 0, 6.0); t.rotation.y = Math.PI; scene.add(t); }

  // ---- biển chỉ dẫn xanh lá (QCVN 41): báo trạm dừng nghỉ trước nút rẽ, lối vào, lối ra
  {
    const services: ('fuel' | 'food' | 'wc' | 'p' | 'bolt')[] = o.kind === 'rest' ? ['fuel', 'food', 'p', 'wc', 'bolt'] : o.pumps ? ['fuel', 'p', 'wc', 'bolt'] : ['bolt', 'p', 'wc'];
    const big = at.add(560, 340, (g, w, h) => {
      rr(g, 0, 0, w, h, 22, '#ffffff'); rr(g, 8, 8, w - 16, h - 16, 16, CSS(C.green));
      txt(g, o.kind === 'rest' ? 'TRẠM DỪNG NGHỈ' : o.pumps ? 'CÂY XĂNG' : 'TRẠM SẠC ĐIỆN', w / 2, 62, w - 60, 62, '#ffffff', 'center', 900);
      const n = services.length, s = 76, gap = 14, x0 = (w - (n * s + (n - 1) * gap)) / 2; services.forEach((k, i) => { rr(g, x0 + i * (s + gap), 112, s, s, 8, '#ffffff'); rr(g, x0 + i * (s + gap) + 4, 116, s - 8, s - 8, 6, '#1f4fa8'); icon(g, k, x0 + i * (s + gap) + 8, 120, s - 16); });
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w / 2 - 30, 300); g.lineTo(w / 2 + 30, 300); g.lineTo(w / 2 + 30, 270); g.lineTo(w / 2 + 70, 270); g.lineTo(w / 2, 220); g.lineTo(w / 2 - 70, 270); g.lineTo(w / 2 - 30, 270); g.closePath(); g.fill();
      txt(g, '500 m', w - 90, 286, 140, 44, '#ffffff', 'center', 800);
    });
    for (const x of [-53.4, -48.6]) box(st, 0x9aa1ab, x, 2.6, -37.5, 0.16, 5.2, 0.16, 0.5);
    at.sign(big, 6.6, 4.0, -51, 4.6, -37.6, 0.25);
    const small = (t: string, arrowR: boolean) => at.add(360, 120, (g, w, h) => { rr(g, 0, 0, w, h, 14, '#ffffff'); rr(g, 6, 6, w - 12, h - 12, 10, CSS(C.green)); txt(g, t, w / 2 - 26, h / 2 + 3, w - 110, 52, '#fff', 'center', 900); g.fillStyle = '#fff'; const ax = w - 46, ay = h / 2; g.beginPath(); if (arrowR) { g.moveTo(ax + 24, ay); g.lineTo(ax - 6, ay - 26); g.lineTo(ax - 6, ay + 26); } else { g.moveTo(ax, ay - 30); g.lineTo(ax + 26, ay + 4); g.lineTo(ax - 26, ay + 4); } g.closePath(); g.fill(); g.fillRect(ax - 26, ay - 7, 30, 14); });
    const inS = small('LỐI VÀO', false), outS = small('RA CAO TỐC', true);
    box(st, 0x9aa1ab, -35.8, 1.6, -27.6, 0.12, 3.2, 0.12, 0.5); at.sign(inS, 3.0, 1.0, -35.8, 3.2, -27.68);
    box(st, 0x9aa1ab, 40.5, 1.6, -29.0, 0.12, 3.2, 0.12, 0.5); at.sign(outS, 3.0, 1.0, 40.5, 3.2, -29.08);
    const pSign = at.add(100, 100, (g, w) => { rr(g, 0, 0, w, w, 10, '#ffffff'); rr(g, 5, 5, w - 10, w - 10, 8, '#1f4fa8'); icon(g, 'p', 5, 5, w - 10); });
    box(st, 0x9aa1ab, -31, 1.3, 1.4, 0.1, 2.6, 0.1, 0.5); at.sign(pSign, 0.9, 0.9, -31, 2.6, 1.34);
  }

  // ---- bóng mờ (bóng đổ giả cho điện thoại, và làm đất "ăn" vào chân vật)
  const shadowM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); own.push(shadowM);
  const aoQuad = (x: number, z: number, w: number, d: number, k = 1) => { for (let i = 0; i < k; i++) { const m = new THREE.Mesh(GEO.box, shadowM); m.scale.set(w - i * 1.2, 0.001, d - i * 1.2); m.position.set(x, 0.06, z); ao.add(m); } };
  if (o.pumps) aoQuad(-11 + 2.5, -12 + 3.5, 24, 14, 2);
  aoQuad((EV_CANOPY.x0 + EV_CANOPY.x1) / 2 + 2, -11 + 2.5, 19, 9, 1); aoQuad(-2, 13.4, 51, 2.6, 1);
  { const merged = bakeColored(ao); merged.traverse((m) => { const me = m as THREE.Mesh; if (me.isMesh) { me.material = shadowM; me.renderOrder = 1; } }); scene.add(merged); }

  // ---- gộp
  scene.add(bakeColored(st, true, true));
  const signM = new THREE.MeshBasicMaterial({ map: at.tex, transparent: true, alphaTest: 0.4 }), decalM = new THREE.MeshLambertMaterial({ map: at.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  own.push(signM, decalM);
  const merge = (gs: THREE.BufferGeometry[], m: THREE.Material) => { if (!gs.length) return; const g = mergeAll(gs); own.push(g); const me = new THREE.Mesh(g, m); scene.add(me); };
  merge(at.signs, signM); merge(at.decals, decalM);
  void document.fonts?.ready.then(() => at.redraw());
  return { fades, screens, own, sun };
}

function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // các mặt phẳng cùng thuộc tính (position, normal, uv) — nối thẳng bộ đệm
  let n = 0; for (const g of gs) n += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let k = 0;
  for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position, q = g.attributes.normal, u = g.attributes.uv; for (let i = 0; i < p.count; i++, k++) { pos.set([p.getX(i), p.getY(i), p.getZ(i)], k * 3); nor.set([q.getX(i), q.getY(i), q.getZ(i)], k * 3); uv.set([u.getX(i), u.getY(i)], k * 2); } g.dispose(); if (g !== g0) g0.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return out;
}
/** Nhóm mái làm mờ được: chất liệu riêng có trong suốt. */
function fadeOf(group: THREE.Group, b: Box2, h: number, own: { dispose(): void }[]): Fade {
  const mats: THREE.Material[] = [];
  group.traverse((o) => { const me = o as THREE.Mesh; if (!me.isMesh) return; const m = (me.material as THREE.Material).clone(); m.transparent = true; me.material = m; mats.push(m); own.push(m); });
  return { group, mats, box: b, h, a: 1 };
}
/** Cột giá điện tử: chân đôi, bảng xanh có tiêu đề và các dòng số LED đỏ. Mặt quay về −z. */
function pylon(st: G, at: Atlas, x: number, z: number, rows: [string, number][], head: string, unit: string) {
  const H = 8.2, W = 3.0, BH = 1.2 + rows.length * 0.95;
  for (const s of [-1, 1]) box(st, 0x2f3540, x + s * (W / 2 - 0.25), (H - BH) / 2, z, 0.3, H - BH, 0.3, 0.5);
  box(st, 0xcfd3d8, x, 0.3, z, W, 0.6, 0.8, 0.9); box(st, C.brandD, x, H - BH / 2, z + 0.12, W + 0.2, BH + 0.2, 0.36, 0.6);
  const t = at.add(300, Math.round(300 * BH / W), (g, w, h) => {
    g.fillStyle = CSS(C.brand); g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 82); g.fillStyle = CSS(C.orange); g.fillRect(0, 82, w, 8);
    icon(g, head === 'TRẠM SẠC' ? 'bolt' : 'fuel', 12, 10, 62, CSS(C.brand)); txt(g, head, w / 2 + 30, 46, w - 100, 46, CSS(C.brand), 'center', 900);
    const rh = (h - 110) / rows.length;
    rows.forEach(([name, price], i) => { const y = 100 + i * rh; txt(g, name, 10, y + rh * 0.28, w - 20, 22, '#ffffff', 'left', 800); rr(g, 10, y + rh * 0.46, w - 20, rh * 0.48, 6, '#0b0d10'); txt(g, price.toLocaleString('vi-VN'), w - 66, y + rh * 0.71, w - 100, rh * 0.42, '#ff3b2b', 'right', 900); txt(g, unit, w - 16, y + rh * 0.73, 46, 16, '#ffb3ab', 'right', 700); });
  });
  at.sign(t, W, BH, x, H - BH / 2, z - 0.07);
}
