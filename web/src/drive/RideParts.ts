// Mô hình dùng chung cho hoạt cảnh du lịch: phương tiện, nhân vật kéo vali, công trình điểm nhấn từng miền.
// Mọi phương tiện quay đầu về -z; cửa lên xuống ở bên +x (bên phải theo chiều chạy).
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { SCENERY, makeSign } from './DriveScene.ts';

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

export function buildFerry(): THREE.Group {
  const g = new THREE.Group(), white = mat(0xfffdf6), blue = mat(0x5aa9e6);
  g.add(mesh(GEO.box, white, 0, 0.9, 0.6, 5, 1.9, 14), mesh(GEO.box, blue, 0, 0.25, 0.6, 5.06, 0.6, 14.06));
  const bow = mesh(GEO.cone, white, 0, 0.9, -8.0, 2.5, 3.6, 0.95); bow.rotation.x = -Math.PI / 2; g.add(bow);
  g.add(mesh(GEO.box, white, 0, 2.7, 1.2, 4.2, 1.7, 9.6), mesh(GEO.box, glass(), 0, 2.8, 1.2, 4.26, 0.7, 8.8), mesh(GEO.box, white, 0, 4.2, 0.2, 3.4, 1.3, 4.6), mesh(GEO.box, glass(), 0, 4.4, -2.12, 3.0, 0.7, 0.06));
  g.add(mesh(GEO.box, mat(0xf2c65c), 0, 3.62, 1.2, 4.5, 0.14, 9.9), mesh(GEO.cyl, mat(0xf08a6c), 0, 5.6, 2.2, 0.6, 1.6, 0.6), mesh(GEO.cyl, mat(0x4a5160), 0, 6.45, 2.2, 0.62, 0.2, 0.62));
  g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 3.0, -5.9, 0.06, 2.6, 0.06), mesh(GEO.box, mat(0xe0342b), 0.5, 4.0, -5.9, 0.95, 0.6, 0.05), mesh(GEO.ball, mat(0xffd23f), 0.5, 4.0, -5.86, 0.15));
  g.add(mesh(GEO.box, mat(DOOR), 0.6, 2.55, -3.62, 0.9, 1.4, 0.06));
  for (const x of [-2.56, 2.56]) for (let i = 0; i < 4; i++) g.add(mesh(GEO.cyl, mat(0xf08a6c), x, 1.5, -2.8 + i * 2.6, 0.38, 0.14, 0.38));
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
  constructor(size = 1.3) {
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
    const bag = new THREE.Group(); bag.position.set(0.4, 0, -0.62); bag.rotation.x = 0.3;
    bag.add(mesh(GEO.box, mat(0xf08a6c), 0, 0.52, 0, 0.46, 0.7, 0.28), mesh(GEO.box, mat(0xd9482b), 0, 0.52, 0.15, 0.3, 0.42, 0.03), mesh(GEO.cyl, mat(0x4a5160), 0, 1.1, 0, 0.03, 0.5, 0.03));
    for (const x of [-0.17, 0.17]) { const w = mesh(GEO.cyl, mat(0x3a3f4a), x, 0.09, 0, 0.09, 0.07, 0.09); w.rotation.z = Math.PI / 2; bag.add(w); }
    b.add(this.arm, hold, bag);
    this.g.add(b); this.g.scale.setScalar(size);
  }
  /** Nhịp bước: phase tăng theo thời gian, moving = đang đi. */
  pose(phase: number, moving: boolean) {
    const s = moving ? Math.sin(phase) : 0;
    this.legs[0].rotation.x = s * 0.75; this.legs[1].rotation.x = -s * 0.75; this.arm.rotation.x = -s * 0.6;
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
