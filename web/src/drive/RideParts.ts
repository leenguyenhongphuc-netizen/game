// Mô hình dùng chung cho hoạt cảnh du lịch: phương tiện, nhân vật kéo vali, công trình điểm nhấn từng miền.
// Mọi phương tiện quay đầu về -z; cửa lên xuống ở bên +x (bên phải theo chiều chạy).
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { SCENERY, makeSign } from './RideKit.ts';

export const V3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** Tiến độ 0..1 của t trong khoảng [a, b]. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const ease = (x: number): number => x * x * (3 - 2 * x);

const glass = () => mat(0x7fb9d9, { rough: 0.25 });
const lamp = () => mat(0xfff3b0, { emissive: 0xffe08a });
const DOOR = 0x3f5566;

function wheel(x: number, z: number, r = 0.5): THREE.Mesh { const w = mesh(GEO.cyl, mat(0x3a3f4a), x, r, z, r, 0.34, r); w.rotation.z = Math.PI / 2; return w; }

// ---------------------------------------------------------------- phương tiện
export function buildBus(): THREE.Group {
  const g = new THREE.Group(), body = mat(0xf08a6c), white = mat(0xfffaf0);
  g.add(mesh(GEO.box, body, 0, 2.0, 0, 2.6, 2.7, 10), mesh(GEO.box, white, 0, 1.15, 0, 2.66, 0.5, 10.06), mesh(GEO.box, white, 0, 3.42, 0, 2.3, 0.2, 9.4));
  g.add(mesh(GEO.box, glass(), 0, 2.5, 0.2, 2.68, 0.9, 8.6), mesh(GEO.box, glass(), 0, 2.35, -5.02, 2.3, 1.3, 0.06));
  for (let i = 0; i < 5; i++) g.add(mesh(GEO.box, body, 0, 2.5, -3.2 + i * 1.75, 2.72, 0.95, 0.16));
  g.add(mesh(GEO.box, mat(0x6fb7d9), 0, 3.62, 1.2, 1.4, 0.24, 2.2), mesh(GEO.box, mat(0x4a5160), 0, 0.72, 0, 2.5, 0.3, 9.8));
  g.add(mesh(GEO.box, mat(DOOR), 1.32, 1.85, -4.1, 0.06, 2.1, 1.0));
  for (const z of [-3.0, 2.6, 3.8]) g.add(wheel(-1.25, z, 0.6), wheel(1.25, z, 0.6));
  for (const x of [-0.85, 0.85]) g.add(mesh(GEO.ball, lamp(), x, 1.15, -5.04, 0.18), mesh(GEO.box, mat(0xe0342b), x, 1.2, 5.03, 0.4, 0.2, 0.06));
  return g;
}

/** Xe trung chuyển 16 chỗ. */
export function buildMinibus(): THREE.Group {
  const g = new THREE.Group(), body = mat(0xfffaf0), band = mat(0x4fa3a5);
  g.add(mesh(GEO.box, body, 0, 1.6, 0, 2.1, 2.1, 5.6), mesh(GEO.box, band, 0, 0.98, 0, 2.16, 0.45, 5.66), mesh(GEO.box, mat(0x4a5160), 0, 0.5, 0, 2.0, 0.25, 5.4));
  g.add(mesh(GEO.box, glass(), 0, 2.0, 0.25, 2.14, 0.7, 4.5), mesh(GEO.box, glass(), 0, 1.9, -2.82, 1.8, 0.9, 0.06));
  for (let i = 0; i < 3; i++) g.add(mesh(GEO.box, body, 0, 2.0, -0.4 + i * 1.35, 2.18, 0.74, 0.14));
  g.add(mesh(GEO.box, mat(DOOR), 1.07, 1.45, -1.5, 0.05, 1.75, 0.9), mesh(GEO.box, mat(0xf2c65c), 0, 2.78, -1.4, 1.4, 0.26, 0.5));
  for (const z of [-1.8, 1.7]) g.add(wheel(-1.0, z, 0.45), wheel(1.0, z, 0.45));
  for (const x of [-0.7, 0.7]) g.add(mesh(GEO.ball, lamp(), x, 1.0, -2.83, 0.15), mesh(GEO.box, mat(0xe0342b), x, 1.0, 2.82, 0.32, 0.18, 0.06));
  return g;
}

export function buildTaxi(): THREE.Group {
  const g = new THREE.Group(), body = mat(0xf7d14a);
  g.add(mesh(GEO.box, body, 0, 0.78, 0, 1.8, 0.7, 4.3), mesh(GEO.box, body, 0, 1.38, 0.2, 1.7, 0.6, 2.3), mesh(GEO.box, mat(0x4fa86a), 0, 0.78, 0, 1.84, 0.16, 4.34));
  g.add(mesh(GEO.box, glass(), 0, 1.4, 0.2, 1.74, 0.42, 2.0), mesh(GEO.box, glass(), 0, 1.38, -0.97, 1.5, 0.44, 0.06), mesh(GEO.box, mat(0xfffaf0, { emissive: 0xffe08a }), 0, 1.8, 0.1, 0.7, 0.22, 0.3));
  g.add(mesh(GEO.box, mat(DOOR), 0.91, 1.0, 0.3, 0.04, 1.1, 0.06));
  for (const z of [-1.35, 1.35]) g.add(wheel(-0.86, z, 0.36), wheel(0.86, z, 0.36));
  for (const x of [-0.6, 0.6]) g.add(mesh(GEO.ball, lamp(), x, 0.85, -2.16, 0.13), mesh(GEO.box, mat(0xe0342b), x, 0.85, 2.16, 0.3, 0.14, 0.06));
  return g;
}

export function buildTrain(): THREE.Group {
  const g = new THREE.Group(), dark = mat(0x4a5160), gl = mat(0xa9dcf2, { rough: 0.25 });
  const loco = new THREE.Group(), lc = mat(0x4fa3a5);
  loco.add(mesh(GEO.box, lc, 0, 2.0, 0.3, 2.7, 2.2, 6.2), mesh(GEO.box, mat(0xf2c65c), 0, 1.2, 0.3, 2.76, 0.4, 6.26), mesh(GEO.box, lc, 0, 3.5, 1.9, 2.6, 0.9, 2.6));
  loco.add(mesh(GEO.box, gl, 0, 3.5, 0.57, 2.2, 0.6, 0.06), mesh(GEO.box, gl, 0, 3.5, 1.9, 2.66, 0.6, 1.8), mesh(GEO.cyl, dark, 0, 3.6, -1.6, 0.36, 1.1, 0.36));
  loco.add(mesh(GEO.box, mat(0xe0342b), 0, 0.9, -3.0, 2.4, 0.6, 0.5), mesh(GEO.ball, lamp(), 0, 2.4, -2.84, 0.3));
  loco.position.z = -15.2; g.add(loco);
  const cols = [0xf08a6c, 0xfdf6e6, 0x6fb7d9, 0xf2b25c];
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group(), z = -7.3 + i * 7.6;
    car.add(mesh(GEO.box, mat(cols[i]), 0, 2.2, 0, 2.6, 2.5, 7), mesh(GEO.box, mat(0xfffaf0), 0, 3.52, 0, 2.3, 0.2, 6.7), mesh(GEO.box, gl, 0, 2.6, -0.4, 2.66, 0.85, 4.8));
    for (let k = 0; k < 4; k++) car.add(mesh(GEO.box, mat(cols[i]), 0, 2.6, -2.4 + k * 1.3, 2.7, 0.9, 0.14));
    car.add(mesh(GEO.box, dark, 0, 0.9, 3.65, 0.5, 0.3, 0.7));
    car.position.z = z; g.add(car);
  }
  g.add(mesh(GEO.box, dark, 0, 0.72, 0.6, 2.4, 0.34, 36));
  for (let z = -17; z <= 18; z += 2.6) g.add(wheel(-1.15, z, 0.52), wheel(1.15, z, 0.52));
  return g;
}
/** Vị trí cửa toa (toa đầu, sát đầu máy) trong hệ toạ độ đoàn tàu. */
export const TRAIN_DOOR_Z = -4.6;

export function buildPlane(): THREE.Group {
  const g = new THREE.Group(), white = mat(0xfffdf6, { rough: 0.5 }), accent = mat(0x6fb7d9), dark = mat(0x4a5160);
  const fus = mesh(GEO.cyl, white, 0, 0, 0, 1.25, 14, 1.25); fus.rotation.x = Math.PI / 2; g.add(fus);
  g.add(mesh(GEO.ball, white, 0, 0, -7, 1.25, 1.25, 2.2), mesh(GEO.ball, glass(), 0, 0.45, -7.5, 0.95, 0.6, 1.2));
  const tail = mesh(GEO.cone, white, 0, 0.25, 8.4, 1.2, 3.4, 1.0); tail.rotation.x = Math.PI / 2; g.add(tail);
  g.add(mesh(GEO.box, accent, 0, 2.1, 8.6, 0.24, 3.4, 2.4), mesh(GEO.box, mat(0xf2c65c), 0, 3.3, 9.0, 0.26, 1.0, 1.5), mesh(GEO.box, white, 0, 0.5, 8.9, 6, 0.18, 1.5));
  g.add(mesh(GEO.box, white, 0, -0.35, 0.6, 16.4, 0.24, 3.0));
  for (const x of [-8.0, 8.0]) g.add(mesh(GEO.box, accent, x, 0.25, 1.2, 0.2, 1.2, 1.6));
  for (const x of [-3.8, 3.8]) {
    const e = mesh(GEO.cyl, accent, x, -1.1, -0.2, 0.62, 2.4, 0.62), cap = mesh(GEO.cyl, dark, x, -1.1, -1.42, 0.5, 0.06, 0.5);
    e.rotation.x = Math.PI / 2; cap.rotation.x = Math.PI / 2; g.add(e, cap);
  }
  for (let i = 0; i < 9; i++) for (const x of [-1.24, 1.24]) g.add(mesh(GEO.box, glass(), x, 0.3, -3.4 + i * 1.02, 0.06, 0.4, 0.5));
  g.add(mesh(GEO.box, accent, 0, -0.2, 0, 2.54, 0.2, 13.6));
  // Càng đáp
  for (const [x, z] of [[0, -5.2], [-1.7, 1.0], [1.7, 1.0]]) { g.add(mesh(GEO.cyl, dark, x, -1.45, z, 0.09, 0.8, 0.09)); const w = wheel(x, z, 0.34); w.position.y = -1.76; g.add(w); }
  return g;
}
/** Độ cao tâm thân máy bay khi đứng trên mặt đất, và vị trí cửa trước. */
export const PLANE_Y = 2.1;
export const PLANE_DOOR_Z = -4.7;

/** Thân tàu nhìn từ trên xuống: mũi nhọn về -z, đuôi bo tròn; đùn theo chiều cao. */
export function hullGeo(half: number, bow: number, stern: number, height: number, flare = 1): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(-half, -stern + half * 0.5); sh.quadraticCurveTo(-half, -stern, -half * 0.5, -stern); sh.lineTo(half * 0.5, -stern); sh.quadraticCurveTo(half, -stern, half, -stern + half * 0.5);
  sh.lineTo(half, bow * 0.45); sh.quadraticCurveTo(half * 0.92, bow * 0.8, 0, bow); sh.quadraticCurveTo(-half * 0.92, bow * 0.8, -half, bow * 0.45); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: height, bevelEnabled: false, curveSegments: 8 }); g.rotateX(-Math.PI / 2);
  if (flare !== 1) { const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.01) { pos.setX(i, pos.getX(i) * flare); pos.setZ(i, pos.getZ(i) * (0.5 + flare / 2)); } g.computeVertexNormals(); }
  return g;
}
/** Lan can: tay vịn chạy theo đường gấp khúc kín hoặc hở, có trụ đỡ. */
export function railing(g: THREE.Group, pts: [number, number][], y: number, h = 0.62, color = 0xfffdf6) {
  const m = mat(color);
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    for (const k of [1, 0.5]) { const r = mesh(GEO.box, m, (x0 + x1) / 2, y + h * k, (z0 + z1) / 2, 0.06, 0.06, len); r.rotation.y = ang; g.add(r); }
    const n = Math.max(1, Math.round(len / 1.3)); for (let j = 0; j <= n; j++) g.add(mesh(GEO.box, m, x0 + (x1 - x0) * j / n, y + h / 2, z0 + (z1 - z0) * j / n, 0.06, h, 0.06));
  }
}
/** Tàu khách ba tầng: thân xanh trắng, lan can, cửa sổ từng tầng, ống khói, xuồng cứu sinh, cờ. */
export function buildFerry(): THREE.Group {
  const g = new THREE.Group(), white = mat(0xfffdf6), navy = mat(0x23507f), cream = mat(0xf6ead0), win = mat(0x2f5f86, { rough: 0.2 });
  g.add(mesh(hullGeo(2.5, 9.4, 7.6, 1.9, 0.86), white, 0, 0, 0.6 - 0.6));
  const band = mesh(hullGeo(2.53, 9.45, 7.63, 0.95, 0.9), navy, 0, -0.02, 0); g.add(band);
  g.add(mesh(hullGeo(2.56, 9.48, 7.66, 0.16, 1), mat(0xd9482b), 0, 0.86, 0), mesh(hullGeo(2.42, 9.2, 7.5, 0.06, 1), mat(0xc9a877), 0, 1.86, 0));
  // Ba tầng thượng tầng lùi dần, mái nhô ra che nắng
  const deck = (y: number, z: number, w: number, h: number, len: number, roofOver = 0.3) => {
    g.add(mesh(GEO.box, white, 0, y + h / 2, z, w, h, len), mesh(GEO.box, cream, 0, y + h + 0.06, z, w + roofOver * 2, 0.12, len + roofOver * 2));
    for (const sx of [-1, 1]) { g.add(mesh(GEO.box, win, sx * (w / 2 + 0.01), y + h * 0.58, z, 0.05, h * 0.42, len - 0.9)); for (let k = -len / 2 + 0.9; k < len / 2 - 0.5; k += 1.1) g.add(mesh(GEO.box, white, sx * (w / 2 + 0.03), y + h * 0.58, z + k, 0.05, h * 0.46, 0.14)); }
    g.add(mesh(GEO.box, win, 0, y + h * 0.6, z - len / 2 - 0.01, w - 0.7, h * 0.4, 0.05));
  };
  deck(1.9, 1.3, 4.2, 1.6, 9.6); deck(3.62, 1.7, 3.7, 1.45, 7.0); deck(5.2, -0.3, 3.2, 1.25, 3.0, 0.4);
  g.add(mesh(GEO.box, mat(0x3f5566), 0.6, 2.6, -3.52, 0.9, 1.4, 0.06));
  railing(g, [[2.3, -3.6], [2.2, -5.6], [1.2, -8.0], [0, -9.0], [-1.2, -8.0], [-2.2, -5.6], [-2.3, -3.6]], 1.9);
  railing(g, [[2.3, 6.2], [2.3, 7.4], [-2.3, 7.4], [-2.3, 6.2]], 1.9);
  railing(g, [[2.3, -3.4], [2.3, 6.2]], 3.62, 0.55); railing(g, [[-2.3, -3.4], [-2.3, 6.2]], 3.62, 0.55);
  railing(g, [[1.95, -1.9], [1.95, 5.3], [-1.95, 5.3], [-1.95, -1.9]], 5.2, 0.5);
  // Ống khói nghiêng, cột ra-đa, còi
  const fun = mesh(GEO.cyl, mat(0xd9482b), 0, 6.5, 3.2, 0.62, 2.0, 0.78); fun.rotation.x = 0.16; g.add(fun);
  const st = mesh(GEO.cyl, white, 0, 6.6, 3.22, 0.64, 0.34, 0.8); st.rotation.x = 0.16; const cap = mesh(GEO.cyl, mat(0x2e3440), 0, 7.45, 3.36, 0.64, 0.24, 0.8); cap.rotation.x = 0.16; g.add(st, cap);
  g.add(mesh(GEO.cyl, mat(0xb9bfc9), 0, 7.4, -0.5, 0.06, 1.8, 0.06), mesh(GEO.box, mat(0xb9bfc9), 0, 7.9, -0.5, 1.5, 0.08, 0.14), mesh(GEO.box, white, 0, 8.25, -0.5, 0.9, 0.12, 0.3), mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 8.4, -0.5, 0.1));
  // Xuồng cứu sinh, phao tròn, mỏ neo, cột cờ mũi và đuôi
  for (const sx of [-1, 1]) for (const z of [0.2, 3.4]) { g.add(mesh(GEO.ball, mat(0xf08a24), sx * 2.15, 4.25, z, 0.36, 0.3, 1.0), mesh(GEO.box, white, sx * 2.15, 4.42, z, 0.5, 0.06, 1.5), mesh(GEO.box, mat(0x8f97a3), sx * 2.1, 4.8, z - 0.7, 0.05, 0.9, 0.05), mesh(GEO.box, mat(0x8f97a3), sx * 2.1, 4.8, z + 0.7, 0.05, 0.9, 0.05)); }
  for (const sx of [-1, 1]) for (const z of [-1.6, 1.2, 4.0]) { const ring = mesh(new THREE.TorusGeometry(0.26, 0.09, 6, 12), mat(0xf08a24), sx * 2.13, 2.5, z); ring.rotation.y = Math.PI / 2; g.add(ring); }
  g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 3.0, -8.4, 0.05, 2.2, 0.05), mesh(GEO.cyl, mat(0x9a7150), 0, 3.2, 7.2, 0.05, 2.6, 0.05));
  g.add(mesh(GEO.box, mat(0xe0342b), 0.5, 4.1, 7.2, 0.95, 0.6, 0.05), mesh(GEO.ball, mat(0xffd23f), 0.5, 4.1, 7.24, 0.15), mesh(GEO.box, mat(0xfff3b0), 0.3, 3.9, -8.4, 0.55, 0.36, 0.04));
  g.add(mesh(GEO.box, mat(0x2e3440), 2.3, 1.3, -6.6, 0.1, 0.5, 0.36), mesh(GEO.box, mat(0x2e3440), -2.3, 1.3, -6.6, 0.1, 0.5, 0.36));
  // Ghế boong mũi
  for (const x of [-1.1, 1.1]) g.add(mesh(GEO.box, mat(0x6fb7d9), x, 2.1, -5.4, 1.2, 0.12, 0.4), mesh(GEO.box, mat(0x6fb7d9), x, 2.35, -5.2, 1.2, 0.4, 0.08));
  return g;
}
/** Mặt boong tàu thuỷ (cao so với gốc mô hình) và vị trí cầu ván. */
export const FERRY_DECK = 1.86;
export const FERRY_PLANK_Z = -5.0;

// ---------------------------------------------------------------- nhân vật
/** Người chơi: nón lá, áo xanh, kéo vali. Mặt hướng +z của mô hình. */
export class Walker {
  readonly g = new THREE.Group();
  private legs: THREE.Group[] = [];
  private arm = new THREE.Group();
  private body = new THREE.Group();
  private size: number;
  private fixedArm = false;
  private bag = new THREE.Group();
  private load = new THREE.Group();
  /** carry = 'sot': bưng sọt hàng trước ngực thay vì kéo vali. */
  constructor(size = 1.3, carry: 'vali' | 'sot' = 'vali') {
    this.size = size;
    const skin = mat(0xf6cfa8), shirt = mat(0x4f9fe0), pants = mat(0x6b5140);
    const b = this.body;
    b.add(mesh(GEO.cyl, shirt, 0, 1.08, 0, 0.3, 0.72, 0.23), mesh(GEO.ball, shirt, 0, 1.44, 0, 0.3, 0.16, 0.23), mesh(GEO.ball, skin, 0, 1.72, 0, 0.27));
    b.add(mesh(GEO.cone, mat(0xf3e2ae), 0, 2.02, 0, 0.6, 0.36, 0.6), mesh(GEO.ball, mat(0x3b2a17), 0, 1.78, -0.06, 0.26, 0.2, 0.25));
    for (const x of [-0.1, 0.1]) b.add(mesh(GEO.ball, mat(0x3b2a17), x, 1.74, 0.25, 0.035));
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * 0.14, 0.74, 0);
      leg.add(mesh(GEO.cyl, pants, 0, -0.34, 0, 0.11, 0.68, 0.11), mesh(GEO.ball, mat(0x4a5160), 0, -0.68, 0.06, 0.12, 0.08, 0.19));
      this.legs.push(leg); this.g.add(leg);
    }
    this.arm.position.set(-0.37, 1.4, 0);
    this.arm.add(mesh(GEO.cyl, shirt, 0, -0.26, 0, 0.085, 0.52, 0.085), mesh(GEO.ball, skin, 0, -0.56, 0, 0.09));
    const hold = new THREE.Group(); hold.position.set(0.37, 1.4, 0); hold.rotation.x = 0.55;
    hold.add(mesh(GEO.cyl, shirt, 0, -0.26, 0, 0.085, 0.52, 0.085), mesh(GEO.ball, skin, 0, -0.56, 0, 0.09));
    // Vali kéo phía sau tay phải
    const bag = this.bag; bag.position.set(0.4, 0, -0.62); bag.rotation.x = 0.3;
    bag.add(mesh(GEO.box, mat(0xf08a6c), 0, 0.52, 0, 0.46, 0.7, 0.28), mesh(GEO.box, mat(0xd9482b), 0, 0.52, 0.15, 0.3, 0.42, 0.03), mesh(GEO.cyl, mat(0x4a5160), 0, 1.1, 0, 0.03, 0.5, 0.03));
    for (const x of [-0.17, 0.17]) { const w = mesh(GEO.cyl, mat(0x3a3f4a), x, 0.09, 0, 0.09, 0.07, 0.09); w.rotation.z = Math.PI / 2; bag.add(w); }
    b.add(this.arm, hold, bag);
    if (carry === 'sot') {
      bag.visible = false; hold.rotation.x = -1.1; this.arm.rotation.x = -1.1; this.fixedArm = true;
      this.load.add(mesh(GEO.box, mat(0xc99a68), 0, 1.12, 0.52, 0.66, 0.46, 0.5), mesh(GEO.box, mat(0x8a6a4a), 0, 1.12, 0.52, 0.7, 0.07, 0.54));
      for (const [x, c] of [[-0.17, 0xf08a24], [0.17, 0xdc342b], [0, 0x9bd64a]] as [number, number][]) this.load.add(mesh(GEO.ball, mat(c, { rough: 0.5 }), x, 1.4, 0.52 + (x === 0 ? 0.1 : -0.06), 0.15));
      b.add(this.load);
    }
    this.g.add(b); this.g.scale.setScalar(size);
  }
  /** Nhịp bước: phase tăng theo thời gian, moving = đang đi. */
  pose(phase: number, moving: boolean) {
    const s = moving ? Math.sin(phase) : 0;
    this.legs[0].rotation.x = s * 0.75; this.legs[1].rotation.x = -s * 0.75; if (!this.fixedArm) this.arm.rotation.x = -s * 0.6;
    this.body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.05 : 0;
  }
  /** Đi theo đường gấp khúc: u = 0..1 dọc đường. */
  walk(pts: THREE.Vector3[], u: number, time: number) {
    const k = clamp01(u); let total = 0; const lens: number[] = [];
    for (let i = 1; i < pts.length; i++) { lens.push(pts[i].distanceTo(pts[i - 1])); total += lens[i - 1]; }
    let d = k * total, i = 0; while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
    const a = pts[i], b = pts[i + 1], f = lens[i] > 0 ? clamp01(d / lens[i]) : 0;
    this.g.position.lerpVectors(a, b, f);
    if (k < 1) this.face(b.x - a.x, b.z - a.z);
    this.pose(time * 11, k > 0 && k < 1);
  }
  /** Quay mặt về hướng (dx, dz), xoay mượt. */
  face(dx: number, dz: number) {
    const want = Math.atan2(dx, dz); let diff = want - this.g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    this.g.rotation.y += diff * 0.3;
  }
  /** Đang bưng sọt hay đi tay không. */
  holding(v: boolean) { this.load.visible = v; }
  /** Khuất dần khi bước vào phương tiện (k = 1 là đã vào hẳn). */
  hide(k: number) { const s = 1 - clamp01(k); this.g.visible = s > 0.02; this.g.scale.setScalar(this.size * Math.max(0.02, s)); }
}

// ---------------------------------------------------------------- biển chữ
export function sign(text: string, color: string, width: number, x: number, y: number, z: number): THREE.Sprite {
  const s = makeSign(text, color); s.scale.set(width, width / 4, 1); s.position.set(x, y, z); return s;
}

// ---------------------------------------------------------------- điểm nhấn từng miền
/** Bắc: cụm núi đá vôi. */
export function karst(r: () => number): THREE.Group {
  const g = new THREE.Group(), n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const h = 13 + r() * 15, w = 4.5 + r() * 4, x = (r() - 0.5) * 22, z = (r() - 0.5) * 16;
    g.add(mesh(GEO.ball, mat(i % 2 ? 0xa9b8ad : 0x9aae9f, { rough: 1 }), x, h * 0.3, z, w, h, w * 0.9), mesh(GEO.ball, mat(0x7fbf7a, { rough: 1 }), x + 0.4, h * 1.12, z, w * 0.62, h * 0.24, w * 0.6));
  }
  return g;
}
/** Bắc: đồi ruộng bậc thang (bậc lùi dần về -z). */
export function terraces(): THREE.Group {
  const g = new THREE.Group(), cols = [0x8fd67c, 0xe6cf6a, 0xb7e69a, 0x79c96d, 0xd9bd4e, 0x8fd67c];
  for (let i = 0; i < 6; i++) g.add(mesh(GEO.cyl, mat(0xb8a878), 0, i * 0.8 + 0.3, -i * 1.1, 13 - i * 1.9, 0.6, 9.6 - i * 1.3), mesh(GEO.cyl, mat(cols[i]), 0, i * 0.8 + 0.66, -i * 1.1, 12.6 - i * 1.9, 0.14, 9.2 - i * 1.3));
  return g;
}
/** Trung: tháp Chăm cách điệu trên gò đất. */
export function chamTower(): THREE.Group {
  const g = new THREE.Group(), brick = mat(0xc8674a), dark = mat(0xa9523a);
  g.add(mesh(GEO.ball, mat(0xd9c98a), 0, -0.6, 0, 7, 1.6, 6), mesh(GEO.box, dark, 0, 1.0, 0, 4.4, 0.6, 4.4), mesh(GEO.box, brick, 0, 3.6, 0, 3.6, 4.8, 3.6));
  g.add(mesh(GEO.box, dark, 0, 6.2, 0, 4.0, 0.4, 4.0), mesh(GEO.box, brick, 0, 7.5, 0, 2.8, 2.2, 2.8), mesh(GEO.box, dark, 0, 8.8, 0, 3.1, 0.35, 3.1), mesh(GEO.box, brick, 0, 9.8, 0, 2.0, 1.7, 2.0));
  g.add(mesh(GEO.cone, brick, 0, 11.6, 0, 1.2, 2.0, 1.2), mesh(GEO.box, mat(0x4a2c22), 1.82, 2.6, 0, 0.1, 2.6, 1.2), mesh(GEO.box, mat(0x4a2c22), 0, 2.6, 1.82, 1.2, 2.6, 0.1));
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) g.add(mesh(GEO.cone, dark, x, 6.9, z, 0.4, 1.0, 0.4));
  return g;
}
/** Tây Nguyên: nhà rông mái cao. */
export function nhaRong(): THREE.Group {
  const g = new THREE.Group(), wood = mat(0x9a7150), thatch = mat(0xc99a5c);
  for (const x of [-1.6, 1.6]) for (const z of [-2.6, 0, 2.6]) g.add(mesh(GEO.cyl, wood, x, 0.8, z, 0.16, 1.6, 0.16));
  g.add(mesh(GEO.box, wood, 0, 1.7, 0, 4.2, 0.24, 6.8), mesh(GEO.box, mat(0xe0c08a), 0, 2.5, 0, 3.6, 1.4, 6.0), mesh(GEO.box, mat(0x6b4a2c), 1.82, 2.4, 0, 0.06, 1.2, 0.9));
  const roof = mesh(new THREE.CylinderGeometry(0.16, 3.2, 9.5, 4, 1), thatch, 0, 7.9, 0, 1, 1, 1.5); roof.rotation.y = Math.PI / 4; g.add(roof);
  g.add(mesh(GEO.box, mat(0xa97a3c), 0, 12.7, 0, 0.3, 0.5, 3.6));
  const ladder = mesh(GEO.box, wood, 2.9, 0.85, 0, 0.5, 0.14, 0.9); ladder.rotation.z = -0.7; g.add(ladder);
  return g;
}
/** Tây Nguyên: đồi đất đỏ trồng cà phê thành hàng. */
export function coffeeHill(r: () => number): THREE.Group {
  const g = new THREE.Group(), A = 15, B = 10, H = 5;
  g.add(mesh(GEO.ball, mat(0xd98a66, { rough: 1 }), 0, -1, 0, A, H, B));
  for (let row = -3; row <= 3; row++) for (let i = -6; i <= 6; i++) {
    const x = i * 2 + (r() - 0.5) * 0.4, z = row * 2.4, q = 1 - (x / A) ** 2 - (z / B) ** 2; if (q < 0.12) continue;
    g.add(mesh(GEO.ball, mat(row % 2 ? 0x3f8f52 : 0x4fa35f), x, -1 + H * Math.sqrt(q) + 0.25, z, 0.75, 0.62, 0.75));
  }
  return g;
}
/** Nam: trụ tháp và dây văng của cầu qua sông lớn (mặt cầu trùng mặt đường, chạy dọc z). */
export function cableBridge(len: number, width: number): THREE.Group {
  const g = new THREE.Group(), white = mat(0xfffaf0), pyl = mat(0xe9edf2), hx = width / 2 + 0.9, top = 21;
  for (const x of [-hx + 0.5, hx - 0.5]) g.add(mesh(GEO.box, white, x, 0.75, 0, 0.3, 0.9, len + 8), mesh(GEO.box, mat(0xb4bac4), x * 0.99, 0.2, 0, 0.5, 0.3, len + 8));
  for (const zp of [-len * 0.24, len * 0.24]) {
    for (const x of [-hx, hx]) {
      const leg = mesh(GEO.box, pyl, x * 0.82, top / 2 + 4, zp, 0.9, top - 6, 1.2); leg.rotation.z = x > 0 ? 0.1 : -0.1; g.add(leg, mesh(GEO.box, pyl, x, 2.5, zp, 1.1, 5.4, 1.4));
      for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) {
        const dz = s * k * len * 0.045, y0 = top - 0.6 - k * 0.5, dy = y0 - 0.9, L = Math.hypot(dz, dy);
        const c = mesh(GEO.box, white, x * 0.66 + (x * 0.34 * 0.5), (y0 + 0.9) / 2, zp + dz / 2, 0.09, L, 0.09); c.rotation.x = Math.atan2(dz, dy); c.rotation.z = x > 0 ? -0.07 : 0.07; g.add(c);
      }
    }
    g.add(mesh(GEO.box, pyl, 0, top + 0.6, zp, hx * 1.4, 1.0, 1.3), mesh(GEO.box, pyl, 0, 12, zp, hx * 1.7, 0.7, 1.1), mesh(GEO.box, mat(0xd9d2c4), 0, -1.2, zp, width + 4, 2.6, 3));
  }
  return g;
}
/** Đảo: bè nuôi cá. */
export function fishRaft(): THREE.Group {
  const g = new THREE.Group(), wood = mat(0xc99a68), barrel = mat(0x5aa9e6);
  for (let i = 0; i < 4; i++) g.add(mesh(GEO.box, wood, -4.5 + i * 3, 0.36, 0, 0.3, 0.14, 9.4), mesh(GEO.box, wood, 0, 0.4, -4.5 + i * 3, 9.4, 0.14, 0.3));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) { const b = mesh(GEO.cyl, barrel, -4.5 + i * 3, 0.1, -4.5 + j * 3, 0.36, 0.9, 0.36); b.rotation.x = Math.PI / 2; g.add(b); }
  g.add(mesh(GEO.box, mat(0xfff6e2), 3, 1.2, 3, 2.6, 1.5, 2.6), mesh(GEO.box, mat(0xf08a6c), 3, 2.1, 3, 3.1, 0.2, 3.1), mesh(GEO.cyl, wood, -4.5, 1.3, -4.5, 0.05, 2, 0.05), mesh(GEO.box, mat(0xe0342b), -4.1, 2.0, -4.5, 0.7, 0.45, 0.04));
  return g;
}
/** Phao tiêu luồng hàng hải. */
export function buoy(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(GEO.cyl, mat(color), 0, 0.5, 0, 0.6, 1.0, 0.6), mesh(GEO.cone, mat(color), 0, 1.7, 0, 0.5, 1.4, 0.5), mesh(GEO.ball, lamp(), 0, 2.5, 0, 0.18), mesh(GEO.cyl, mat(0xfffaf0), 0, 0.95, 0, 0.62, 0.16, 0.62));
  return g;
}
/** Hải đăng trên mỏm đá. */
export function lighthouse(): THREE.Group {
  const g = new THREE.Group(), rock = SCENERY.seastone(); rock.scale.setScalar(3.4); g.add(rock);
  g.add(mesh(GEO.ball, mat(0xa9d672), -1, 2.2, 0.5, 4.2, 1.6, 3.6));
  g.add(mesh(new THREE.CylinderGeometry(1.0, 1.6, 11, 14), mat(0xfffdf6), 0, 8.4, 0));
  for (const y of [5.6, 9.6]) g.add(mesh(new THREE.CylinderGeometry(1.3 - (y - 3) * 0.055, 1.37 - (y - 3) * 0.055, 1.4, 14), mat(0xe0342b), 0, y, 0));
  g.add(mesh(GEO.cyl, mat(0x4a5160), 0, 14.0, 0, 1.5, 0.2, 1.5), mesh(GEO.cyl, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 14.9, 0, 0.9, 1.6, 0.9), mesh(GEO.cone, mat(0xe0342b), 0, 16.4, 0, 1.3, 1.4, 1.3));
  return g;
}
/** Quả đồi có hầm xuyên qua dọc trục z (cho đường sắt). */
export function tunnelHill(len: number, color: number, r: () => number): THREE.Group {
  const g = new THREE.Group(), sh = new THREE.Shape();
  sh.moveTo(-16, -0.2); sh.quadraticCurveTo(-13.5, 8.5, -6, 11.5); sh.quadraticCurveTo(0, 14, 6, 11.2); sh.quadraticCurveTo(13.5, 8, 16, -0.2); sh.closePath();
  const hole = new THREE.Path(); hole.moveTo(-2.5, -0.3); hole.lineTo(-2.5, 4.3); hole.absarc(0, 4.3, 2.5, Math.PI, 0, true); hole.lineTo(2.5, -0.3); hole.closePath(); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 10 }); geo.translate(0, 0, -len / 2);
  g.add(mesh(geo, mat(color, { rough: 1 })));
  const stone = mat(0xd9d2c4);
  for (const z of [-len / 2 - 0.3, len / 2 + 0.3]) {
    g.add(mesh(GEO.box, stone, -3.1, 2.4, z, 1.0, 5.2, 0.9), mesh(GEO.box, stone, 3.1, 2.4, z, 1.0, 5.2, 0.9), mesh(GEO.box, stone, 0, 7.3, z, 7.6, 1.0, 0.9));
    for (let i = -2; i <= 2; i++) g.add(mesh(GEO.box, stone, i * 1.15, 6.5 - Math.abs(i) * 0.75, z, 1.3, 0.9, 0.8));
  }
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 24, z = (r() - 0.5) * (len - 6), y = 12.6 * (1 - (x / 16) ** 2) - 0.4;
    g.add(mesh(GEO.ball, mat(i % 2 ? 0x5cb85f : 0x79c96d), x, y + 0.6, z, 1.5 + r(), 1.2 + r() * 0.6, 1.5 + r()));
  }
  return g;
}

// ---------------------------------------------------------------- mặt biển, vệt nước, khói, chim
const SEA_VERT = `
uniform float uTime; uniform float uScroll;
varying vec3 vW; varying vec2 vP;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p = vec2(wp.x, wp.z - uScroll); vP = p;
  wp.y += sin(p.x * 0.11 + uTime * 1.1) * 0.2 + sin(p.y * 0.16 - uTime * 1.4 + p.x * 0.05) * 0.17 + sin((p.x + p.y) * 0.31 + uTime * 2.0) * 0.06;
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const SEA_FRAG = `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSunDir;
varying vec3 vW; varying vec2 vP;
#include <fog_pars_fragment>
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nz(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 p = vP; float t = uTime;
  float c2 = cos(p.y * 0.16 - t * 1.4 + p.x * 0.05), c3 = cos((p.x + p.y) * 0.31 + t * 2.0);
  float dx = cos(p.x * 0.11 + t * 1.1) * 0.022 + c2 * 0.0085 + c3 * 0.0186;
  float dz = c2 * 0.0272 + c3 * 0.0186;
  float r1 = nz(p * 0.5 + vec2(t * 0.35, t * 0.2)), r2 = nz(p * 1.25 - vec2(t * 0.3, t * 0.45)), r3 = nz(p * 3.1 + vec2(-t * 0.5, t * 0.6));
  vec3 N = normalize(vec3(-dx * 2.4 - (r1 - 0.5) * 0.3 - (r3 - 0.5) * 0.08, 1.0, -dz * 2.4 - (r2 - 0.5) * 0.3 - (r3 - 0.5) * 0.08));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = mix(uDeep, uShallow, smoothstep(0.1, 0.95, r1 * 0.6 + r2 * 0.3 + 0.1));
  col = mix(col, uSky, clamp(fres * 0.8 + 0.06, 0.0, 1.0));
  vec3 H = normalize(V + normalize(uSunDir));
  col += vec3(1.0, 0.96, 0.84) * pow(max(dot(N, H), 0.0), 90.0) * 0.8;
  float foam = smoothstep(0.9, 0.99, nz(p * 0.16 + vec2(t * 0.1, 0.0)) * 0.62 + r2 * 0.42);
  col = mix(col, vec3(1.0), foam * 0.45);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
export interface Sea { mesh: THREE.Mesh; tick(time: number, scroll?: number): void }
/** Mặt biển có sóng lăn tăn, phản chiếu trời và ánh nắng. `scroll` dịch hoạ tiết khi tàu đang chạy. */
export function seaSurface(size = 1500, segs = 150): Sea {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs); geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uScroll: { value: 0 }, uDeep: { value: new THREE.Color(0x2b8fbf) }, uShallow: { value: new THREE.Color(0x52bfd8) },
      uSky: { value: new THREE.Color(0xcfeefc) }, uSunDir: { value: new THREE.Vector3(18, 30, 12).normalize() },
    }]),
  });
  const m = new THREE.Mesh(geo, material); m.userData.own = true; m.frustumCulled = false;
  return { mesh: m, tick: (time, scroll = 0) => { material.uniforms.uTime.value = time; material.uniforms.uScroll.value = scroll; } };
}

/** Vệt nước trắng toả hình chữ V sau đuôi tàu và bọt rẽ ở mũi. */
export class Wake {
  readonly g = new THREE.Group();
  private parts: THREE.Mesh[] = [];
  private mats: THREE.MeshStandardMaterial[] = [];
  private half: number; private len: number;
  constructor(half: number, len: number, n = 30) {
    this.half = half; this.len = len;
    for (let i = 0; i < n; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.8, depthWrite: false });
      const p = new THREE.Mesh(GEO.ball, m); p.userData.own = true; p.castShadow = false; p.receiveShadow = false; this.parts.push(p); this.mats.push(m); this.g.add(p);
    }
  }
  /** (x, z) = tâm tàu; bow/stern = nửa chiều dài về mũi và đuôi; power 0..1 theo tốc độ. */
  update(time: number, x: number, z: number, bow: number, stern: number, power: number) {
    const n = this.parts.length; this.g.visible = power > 0.04;
    this.parts.forEach((p, i) => {
      const k = (time * 0.42 + i / n) % 1, side = i % 2 ? 1 : -1, lane = i % 6;
      if (lane < 4) { // chữ V sau đuôi
        p.position.set(x + side * (this.half * 0.55 + k * this.half * 2.2), 0.2, z + stern * 0.6 + k * this.len * power);
        p.scale.set(0.35 + k * 0.9, 0.04, 1.6 + k * 2.6); p.rotation.y = -side * 0.32;
      } else if (lane === 4) { // bọt chân vịt giữa đuôi
        p.position.set(x + Math.sin(i * 3.1 + time * 5) * 0.7, 0.18, z + stern + k * this.len * 0.7 * power);
        p.scale.set(1.0 + k * 1.0, 0.05, 1.2 + k * 2.2);
      } else { // sóng rẽ mũi
        p.position.set(x + side * (0.5 + k * this.half * 1.9), 0.18, z - bow * 0.82 + k * bow * 1.1);
        p.scale.set(0.3 + k * 0.5, 0.05, 0.9 + k * 1.6); p.rotation.y = -side * 0.5;
      }
      this.mats[i].opacity = 0.7 * (1 - k) * (1 - k) * Math.min(1, power * 1.6);
    });
  }
}

/** Cụm khói bay lên rồi tản theo gió (ống khói tàu, đầu máy). */
export class Smoke {
  readonly g = new THREE.Group();
  private parts: THREE.Mesh[] = []; private mats: THREE.MeshStandardMaterial[] = [];
  constructor(n = 8, color = 0xf2f2ee) {
    for (let i = 0; i < n; i++) { const m = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }); const p = new THREE.Mesh(GEO.ball, m); p.userData.own = true; p.castShadow = false; this.parts.push(p); this.mats.push(m); this.g.add(p); }
  }
  /** Khói phun từ (x, y, z), trôi về +z với lực drift. */
  update(time: number, x: number, y: number, z: number, drift: number, size = 0.5) {
    const n = this.parts.length;
    this.parts.forEach((p, i) => { const k = (time * 0.45 + i / n) % 1; p.position.set(x + Math.sin(k * 5 + i) * 0.35 * k, y + k * (2.6 + size * 2), z + k * k * drift); p.scale.setScalar(size * (0.6 + k * 2.2)); this.mats[i].opacity = 0.75 * (1 - k); });
  }
}

/** Đàn hải âu lượn vòng quanh một điểm. */
export class Gulls {
  readonly g = new THREE.Group();
  private birds: THREE.Group[] = [];
  constructor(n = 5) {
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      for (const s of [-1, 1]) { const w = mesh(GEO.box, mat(0xffffff), s * 0.55, 0, 0, 1.1, 0.05, 0.34); w.castShadow = false; b.add(w); }
      b.add(mesh(GEO.ball, mat(0xffffff), 0, 0, 0, 0.2, 0.16, 0.4), mesh(GEO.ball, mat(0xf2c65c), 0, 0, -0.42, 0.06, 0.05, 0.12)); this.birds.push(b); this.g.add(b);
    }
  }
  update(time: number, x: number, y: number, z: number) {
    this.birds.forEach((b, i) => {
      const a = time * 0.5 + i * 1.4; b.position.set(x + Math.cos(a) * (7 + i * 1.8), y + Math.sin(time * 1.4 + i) * 0.8 + i * 0.5, z + Math.sin(a) * (6 + i * 1.2)); b.rotation.y = -a; b.rotation.z = 0.25;
      const flap = Math.sin(time * 9 + i) * 0.55; b.children[0].rotation.z = flap; b.children[1].rotation.z = -flap;
    });
  }
}

// ---------------------------------------------------------------- người và đồ đạc ở bến
const SHIRTS = [0xf08a6c, 0x6fb7d9, 0xf2c65c, 0x8fd67c, 0xa98bd6, 0xfffaf0, 0xe8457f];
/** Người đứng chờ (tĩnh): i chọn màu áo, có người đội nón lá, có người xách túi. */
export function person(i: number, size = 1.25): THREE.Group {
  const g = new THREE.Group(), skin = mat(0xf6cfa8), shirt = mat(SHIRTS[i % SHIRTS.length]), pants = mat([0x4a5160, 0x6b5140, 0x3f5566][i % 3]);
  g.add(mesh(GEO.cyl, shirt, 0, 1.08, 0, 0.3, 0.72, 0.23), mesh(GEO.ball, shirt, 0, 1.44, 0, 0.3, 0.16, 0.23), mesh(GEO.ball, skin, 0, 1.72, 0, 0.27));
  if (i % 3 === 0) g.add(mesh(GEO.cone, mat(0xf3e2ae), 0, 2.02, 0, 0.6, 0.36, 0.6)); else g.add(mesh(GEO.ball, mat([0x3b2a17, 0x5a3d22][i % 2]), 0, 1.82, -0.04, 0.29, 0.22, 0.28));
  for (const s of [-1, 1]) g.add(mesh(GEO.cyl, pants, s * 0.14, 0.4, 0, 0.11, 0.8, 0.11), mesh(GEO.cyl, shirt, s * 0.37, 1.14, 0, 0.085, 0.52, 0.085));
  if (i % 2) g.add(mesh(GEO.box, mat(SHIRTS[(i + 3) % SHIRTS.length]), 0.5, 0.36, 0.1, 0.34, 0.5, 0.5));
  g.scale.setScalar(size); return g;
}
/** Đồng hồ treo cột. */
export function clockPost(h = 4.2): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(GEO.cyl, mat(0x3f5566), 0, h / 2, 0, 0.1, h, 0.1), mesh(GEO.box, mat(0x3f5566), 0, h + 0.5, 0, 0.36, 1.1, 1.1));
  for (const sx of [-1, 1]) { const f = mesh(GEO.cyl, mat(0xfffdf6), sx * 0.19, h + 0.5, 0, 0.44, 0.04, 0.44); f.rotation.z = Math.PI / 2; g.add(f, mesh(GEO.box, mat(0x2e3440), sx * 0.22, h + 0.62, 0, 0.02, 0.3, 0.05), mesh(GEO.box, mat(0x2e3440), sx * 0.22, h + 0.5, 0.11, 0.02, 0.05, 0.24)); }
  return g;
}
/** Bảng giờ tàu xe: khung tối, các dòng chữ sáng. Mặt bảng hướng +x. */
export function timeBoard(w = 3.4, h = 1.9): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(GEO.box, mat(0x2e3440), 0, 0, 0, 0.14, h, w));
  for (let i = 0; i < 4; i++) { g.add(mesh(GEO.box, mat(i === 0 ? 0xf2c65c : 0x9fe0a8, { emissive: i === 0 ? 0xf2c65c : 0x6fd08a }), 0.08, h / 2 - 0.3 - i * 0.42, -w * 0.14, 0.02, 0.14, w * 0.5), mesh(GEO.box, mat(0xfffdf6, { emissive: 0xffffff }), 0.08, h / 2 - 0.3 - i * 0.42, w * 0.33, 0.02, 0.14, w * 0.18)); }
  return g;
}
/** Cột đèn sân bãi. */
export function lampPost(h = 5): THREE.Group {
  const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x4a5160), 0, h / 2, 0, 0.08, h, 0.08), mesh(GEO.box, mat(0x4a5160), -0.4, h, 0, 0.9, 0.08, 0.1), mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), -0.8, h - 0.1, 0, 0.2, 0.12, 0.2)); return g;
}
/** Cần cẩu bờ ở cảng: tháp, cabin, cần vươn ra biển (về -x). */
export function harbourCrane(h = 13): THREE.Group {
  const g = new THREE.Group(), y = mat(0xf2c65c), d = mat(0x3f5566);
  for (const x of [-1.4, 1.4]) for (const z of [-1.4, 1.4]) g.add(mesh(GEO.box, y, x, h / 2, z, 0.34, h, 0.34));
  for (let k = 2; k < h; k += 3) for (const z of [-1.4, 1.4]) { const b = mesh(GEO.box, y, 0, k, z, 4.0, 0.16, 0.16); b.rotation.z = k % 2 ? 0.75 : -0.75; g.add(b); }
  g.add(mesh(GEO.box, d, 0, h + 0.3, 0, 3.6, 0.6, 3.6), mesh(GEO.box, mat(0xfffaf0), 0.6, h + 1.5, 0, 2.2, 1.8, 2.4), mesh(GEO.box, mat(0x7fb9d9, { rough: 0.25 }), -0.52, h + 1.6, 0, 0.06, 1.0, 2.0));
  const boom = mesh(GEO.box, y, -6.5, h + 4.2, 0, 14, 0.4, 0.5); boom.rotation.z = -0.3; g.add(boom, mesh(GEO.box, d, 3.0, h + 1.2, 0, 2.2, 1.6, 2.2));
  g.add(mesh(GEO.box, d, -12.6, h + 2.6, 0, 0.06, 7.0, 0.06), mesh(GEO.box, d, -12.6, h - 1.0, 0, 0.5, 0.4, 0.5));
  return g;
}
/** Nhà kho mái tôn lượn sóng, cửa cuốn. Mặt chính hướng +z. */
export function warehouse(w = 14, d = 10, h = 5, roof = 0x6fb7d9): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(GEO.box, mat(0xf3ead2), 0, h / 2, 0, w, h, d));
  // Mái vòm tôn: nửa ống nằm dọc theo chiều rộng nhà, hơi dẹt
  const rg = new THREE.CylinderGeometry(d / 2 + 0.4, d / 2 + 0.4, w + 0.8, 18, 1, false, 0, Math.PI); rg.rotateZ(Math.PI / 2);
  g.add(mesh(rg, mat(roof), 0, h - 0.05, 0, 1, 0.42, 1));
  for (const x of [-w * 0.22, w * 0.22]) { g.add(mesh(GEO.box, mat(0xb9bfc9), x, h * 0.36, d / 2 + 0.02, w * 0.3, h * 0.72, 0.08)); for (let k = 0; k < 5; k++) g.add(mesh(GEO.box, mat(0x9aa1ab), x, 0.3 + k * h * 0.14, d / 2 + 0.07, w * 0.3, 0.05, 0.03)); }
  g.add(mesh(GEO.box, mat(0x4a5160), 0, 0.2, d / 2 + 1.2, w, 0.4, 2.4));
  return g;
}
/** Sọt, thùng hàng xếp chồng. */
export function crateStack(n = 4, color = 0xc99a68): THREE.Group {
  const g = new THREE.Group(), cols = [color, 0xb8875a, 0xd9b27c];
  for (let i = 0; i < n; i++) { const lvl = Math.floor(i / 2); g.add(mesh(GEO.box, mat(cols[i % 3]), (i % 2) * 0.95 - 0.47 + lvl * 0.12, 0.42 + lvl * 0.84, (i % 3) * 0.08, 0.86, 0.8, 0.86), mesh(GEO.box, mat(0x8a6a4a), (i % 2) * 0.95 - 0.47 + lvl * 0.12, 0.42 + lvl * 0.84, (i % 3) * 0.08, 0.9, 0.08, 0.9)); }
  return g;
}
/** Mây bông trên trời xa. */
export function cloud(r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) { const m = mesh(GEO.ball, mat(0xffffff, { rough: 1 }), k * 5 - 10 + r() * 2, r() * 2.4, r() * 3, 5 + r() * 3.4, 2.6 + r() * 1.6, 4.4); m.castShadow = false; m.receiveShadow = false; g.add(m); }
  return g;
}
