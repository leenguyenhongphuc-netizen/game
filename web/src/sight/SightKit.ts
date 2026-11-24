// Bộ khung dùng chung cho cảnh đi bộ tham quan: khối dựng nhanh, lối đi có độ rộng, mái nhà, cây, người, nước, núi.
// Mỗi địa danh là một file trong sets/ gọi các hàm ở đây; phần tĩnh được gộp lưới và ghi màu vào đỉnh để ít lần vẽ.
import * as THREE from 'three';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { makeSign } from '../drive/RideKit.ts';

export const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
export type Tick = (time: number, dt: number, player: PlayerState) => void;
export interface PlayerState { pos: THREE.Vector3; s: number; seg: number; near: string | null }
export interface SightStopAt { id: string; at: THREE.Vector3; /** Vật cần nhìn khi mở thuyết minh. */ look?: THREE.Vector3; /** Chỗ đặt máy ảnh "bưu thiếp" khi mở thuyết minh; bỏ trống thì tự tính sau lưng nhân vật. */ cam?: THREE.Vector3 }
/** Chỗ đặt một quầy hàng trong cảnh; ry là hướng mặt quầy (0 = quay về +z). */
export interface ShopSpot { at: THREE.Vector3; ry?: number }
export interface SightSet {
  /** Lối đi: các điểm nối tiếp, y là cao độ mặt đường. */
  path: THREE.Vector3[];
  /** Nửa bề rộng lối đi (m). */
  half: number;
  stops: SightStopAt[];
  sky: [number, number];
  fog: [number, number, number];
  /** Cường độ ánh sáng nền, nắng và màu nắng. */
  light: { ambient: number; sun: number; sunColor?: number; sunDir?: [number, number, number]; ambientColor?: number };
  /** Hướng nhìn lúc xuất phát (radian, 0 = nhìn về -z tức hướng bắc). */
  startYaw?: number;
  /** Gọi khi người chơi mở thuyết minh một điểm dừng (ví dụ cho rồng phun lửa). */
  onStop?: (id: string) => void;
  npcs?: number;
  /** Các chỗ đặt quầy hàng (xe nước, gánh hàng rong…) theo thứ tự ưu tiên; bỏ trống thì tự rải dọc lối đi. */
  shopSpots?: (ShopSpot | THREE.Vector3)[];
  /** Trang trí bầu trời: tự chọn theo độ sáng của trời (sao, trăng khi tối; mây, chim khi sáng) hoặc tắt. */
  skyDecor?: 'auto' | 'none';
  /** Cường độ đèn hắt ngược hướng nắng để mặt khuất của công trình không tối sầm (mặc định 0.45). */
  fill?: number;
  /** Điểm tương tác phụ dọc tuyến (ngắm cảnh, hỏi đáp, vật đặc trưng); bỏ trống thì tự sinh hai điểm. */
  extras?: SightExtra[];
}
/** Điểm tương tác phụ: không bắt buộc để hoàn thành chuyến tham quan. */
export interface SightExtra {
  /** Vị trí trong cảnh; hoặc bỏ trống và cho frac (0–1 dọc lối đi) để tự đặt sát mép lối. */
  at?: THREE.Vector3; frac?: number; kind: 'ngam_canh' | 'hoi_dap' | 'thu_vat'; name: string; fact: string;
  /** hoi_dap: câu hỏi, ba đáp án và chỉ số đáp án đúng. */
  q?: string; options?: string[]; answer?: number;
  /** thu_vat: biểu tượng hiện trên nút. */
  emoji?: string;
}

const glowCache = new Map<number, THREE.MeshBasicMaterial>();
/** Chất liệu tự phát sáng (đèn lồng, cửa sổ sáng đèn): không chịu ánh sáng cảnh. */
export function glow(color: number): THREE.MeshBasicMaterial {
  let m = glowCache.get(color); if (!m) { m = new THREE.MeshBasicMaterial({ color }); glowCache.set(color, m); } return m;
}
type C = number | THREE.Material;
const M = (c: C): THREE.Material => typeof c === 'number' ? mat(c) : c;
export function box(c: C, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): THREE.Mesh { const o = mesh(GEO.box, M(c), x, y, z, sx, sy, sz); o.rotation.y = ry; return o; }
export function cyl(c: C, x: number, y: number, z: number, r: number, h: number, rz = r): THREE.Mesh { return mesh(GEO.cyl, M(c), x, y, z, r, h, rz); }
export function cone(c: C, x: number, y: number, z: number, r: number, h: number, rz = r): THREE.Mesh { return mesh(GEO.cone, M(c), x, y, z, r, h, rz); }
export function ball(c: C, x: number, y: number, z: number, sx: number, sy = sx, sz = sx): THREE.Mesh { return mesh(GEO.sphere, M(c), x, y, z, sx, sy, sz); }
const LOW = new THREE.IcosahedronGeometry(1, 0);
/** Khối cầu ít mặt cho vật nhỏ, số lượng nhiều (đèn lồng, trái cây, hoa). */
export function bead(c: C, x: number, y: number, z: number, sx: number, sy = sx, sz = sx): THREE.Mesh { return mesh(LOW, M(c), x, y, z, sx, sy, sz); }
export function grp(x: number, y: number, z: number, ry = 0, ...kids: THREE.Object3D[]): THREE.Group { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; if (kids.length) g.add(...kids); return g; }

// Lăng trụ tam giác đơn vị: rộng 1 theo x, cao 1, sâu 1 theo z, nóc chạy dọc z. Dùng làm mái hai dốc.
const PRISM = (() => {
  const a = [-0.5, 0, -0.5], b = [0.5, 0, -0.5], t = [0, 1, -0.5], a2 = [-0.5, 0, 0.5], b2 = [0.5, 0, 0.5], t2 = [0, 1, 0.5];
  const tri = [a, t, b, a2, b2, t2, a, a2, t2, a, t2, t, b, t, t2, b, t2, b2, a, b, b2, a, b2, a2].flat();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals(); return g;
})();
const HIP = new THREE.CylinderGeometry(0.02, 0.7071, 1, 4, 1).rotateY(Math.PI / 4); // mái bốn dốc, đáy 1×1
/** Mái hai dốc: nóc chạy dọc z (xoay ry để đổi hướng). y là mép dưới mái. */
export function gable(c: C, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0): THREE.Mesh { const o = mesh(PRISM, M(c), x, y, z, w, h, d); o.rotation.y = ry; return o; }
/** Mái bốn dốc (chóp). y là mép dưới mái. */
export function hip(c: C, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0): THREE.Mesh { const o = mesh(HIP, M(c), x, y + h / 2, z, w, h, d); o.rotation.y = ry; return o; }
/** Mái đình chùa: mái bốn dốc xoè rộng, bốn góc hất cong. */
export function templeRoof(c: C, x: number, y: number, z: number, w: number, h: number, d: number, tip: C = c): THREE.Group {
  const g = grp(x, y, z, 0, box(c, 0, 0.08, 0, w, 0.16, d), hip(c, 0, 0.14, 0, w * 0.96, h, d * 0.96), box(tip, 0, h + 0.1, 0, w * 0.34, 0.18, 0.2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const k = cone(tip, sx * w * 0.5, 0.3, sz * d * 0.5, 0.14, 0.7); k.rotation.z = -sx * 0.9; k.rotation.x = sz * 0.9; g.add(k); }
  return g;
}

export function tree(r: () => number, s = 1, dark = false): THREE.Group {
  const g = new THREE.Group(), a = dark ? 0x2f6b45 : 0x5cb85f, b = dark ? 0x3d8253 : 0x79c96d;
  g.add(cyl(0x7a5a3c, 0, 1.1 * s, 0, 0.22 * s, 2.2 * s), ball(a, -0.5 * s, 2.9 * s, 0.1, 1.3 * s), ball(b, 0.6 * s, 3.1 * s, -0.2, 1.4 * s), ball(a, 0.1 * s, 4 * s, 0.2, 1.25 * s));
  g.rotation.y = r() * 6; return g;
}
export function palm(r: () => number, h = 6): THREE.Group {
  const g = new THREE.Group(); const t = cyl(0x9a8160, 0.2, h / 2, 0, 0.17, h); t.rotation.z = -0.07; g.add(t);
  for (let i = 0; i < 7; i++) { const p = grp(0.4, h, 0, (i / 7) * 6.28 + r()); p.rotation.z = -0.5; p.add(ball(i % 2 ? 0x4c9f55 : 0x6fbf6a, 1.3, 0, 0, 1.5, 0.08, 0.36)); g.add(p); }
  return g;
}
export function bush(c: number, x: number, z: number, s = 1): THREE.Mesh { return ball(c, x, 0.4 * s, z, 0.9 * s, 0.6 * s, 0.8 * s); }
export function rock(c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): THREE.Mesh { const o = ball(c, x, y, z, sx, sy, sz); o.rotation.set(ry * 0.3, ry, ry * 0.2); return o; }
/** Núi xa: khối chóp nhiều tầng. */
export function mountain(c: number, x: number, z: number, radius: number, h: number, r: () => number, y = 0): THREE.Group {
  const g = grp(x, y, z);
  g.add(cone(c, 0, h / 2, 0, radius, h));
  for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = radius * (0.4 + r() * 0.4), hh = h * (0.45 + r() * 0.35); g.add(cone(c, Math.cos(a) * d, hh / 2, Math.sin(a) * d, radius * (0.5 + r() * 0.3), hh)); }
  return g;
}
const SHIRTS = [0xe2573c, 0x4aa3d8, 0xffd23f, 0x7ccf4f, 0xf29bc0, 0xf3ead2, 0x9b7fd6, 0xff8a3d];
/** Người (khách tham quan). hat: 0 không, 1 nón lá, 2 mũ lưỡi trai. */
export function person(i: number, hat = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0, shirtColor?: number): THREE.Group {
  const g = new THREE.Group(), skin = 0xf2c69c, shirt = shirtColor ?? SHIRTS[i % SHIRTS.length], pants = [0x4a5160, 0x6b5140, 0x3f5566][i % 3];
  g.add(cyl(shirt, 0, 1.08, 0, 0.27, 0.66, 0.2), ball(shirt, 0, 1.4, 0, 0.28, 0.15, 0.21), ball(skin, 0, 1.66, 0, 0.25));
  if (hat === 1) g.add(cone(0xf3e2ae, 0, 1.96, 0, 0.56, 0.32)); else if (hat === 2) g.add(ball(SHIRTS[(i + 2) % 8], 0, 1.82, 0, 0.26, 0.16, 0.26), box(SHIRTS[(i + 2) % 8], 0, 1.8, -0.26, 0.3, 0.04, 0.2)); else g.add(ball([0x3b2a17, 0x5a3d22][i % 2], 0, 1.76, 0.04, 0.27, 0.21, 0.26));
  for (const s of [-1, 1]) g.add(cyl(pants, s * 0.13, 0.38, 0, 0.1, 0.76), cyl(shirt, s * 0.34, 1.1, 0, 0.075, 0.5));
  return g;
}
/** Biển gỗ có chữ cắm trên cột. */
export function signPost(text: string, x: number, y: number, z: number, bg = '#7a4a22', scale = 1): THREE.Group {
  const sp = makeSign(text, bg); sp.scale.multiplyScalar(0.62 * scale); sp.position.y = 2.9 * scale; tameSign(sp);
  return grp(x, y, z, 0, cyl(0x7a5a3c, 0, 1.2 * scale, 0, 0.09, 2.4 * scale), sp);
}
/** Biển chữ lơ lửng (tên công trình). */
export function label(text: string, x: number, y: number, z: number, bg = '#7a4a22', scale = 1): THREE.Sprite { const sp = makeSign(text, bg); sp.scale.multiplyScalar(scale); sp.position.set(x, y, z); return tameSign(sp); }
const _wp = new THREE.Vector3();
/** Biển chữ không bao giờ phóng to che màn: lại gần thì thu nhỏ dần cho bề ngang trên màn giữ nguyên, sát quá (< 6 m) thì mờ hẳn. */
export function tameSign(sp: THREE.Sprite): THREE.Sprite {
  let bx = 0, by = 0;
  sp.onBeforeRender = (_r, _s, camera) => {
    if (!bx) { bx = sp.scale.x; by = sp.scale.y; }
    const d = sp.getWorldPosition(_wp).distanceTo(camera.position), pw = sp.parent ? sp.parent.getWorldScale(_wq).x : 1;
    const cam = camera as THREE.PerspectiveCamera, narrow = cam.aspect < 1 ? cam.aspect : 1; // màn dọc hẹp: biển phải nhỏ hơn nữa
    const k = Math.min(1, d / (bx * pw * (3.2 / narrow) * 0.62));
    sp.scale.set(bx * k, by * k, 1); sp.material.opacity = Math.max(0, Math.min(1, (d - 6) / 7)); sp.updateMatrixWorld();
  };
  return sp;
}
const _wq = new THREE.Vector3();
export function lampPost(x: number, y: number, z: number, h = 3.6, c = 0xffd98a): THREE.Group { return grp(x, y, z, 0, cyl(0x3d3a36, 0, h / 2, 0, 0.07, h), box(0x3d3a36, 0, h, 0, 0.5, 0.06, 0.06), ball(glow(c), 0.22, h - 0.2, 0, 0.17), ball(glow(c), -0.22, h - 0.2, 0, 0.17)); }
// Ba dáng đèn lồng Hội An: tròn, củ tỏi (phình dưới thon trên), trái trám (hai chóp úp vào nhau). Ít mặt vì số lượng rất nhiều.
const lathe = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 6);
const LANTERN_GEO = [
  lathe([[0.02, -1], [0.62, -0.72], [1, 0], [0.62, 0.72], [0.02, 1]]),
  lathe([[0.02, -1], [0.8, -0.78], [1, -0.2], [0.5, 0.55], [0.24, 1]]),
  lathe([[0.02, -1], [1, 0], [0.02, 1]]),
];
/** Đèn lồng treo: quả lụa phát sáng có đai gỗ và tua. Dáng (tròn, củ tỏi, trái trám) chọn theo màu. */
export function lantern(color: number, x: number, y: number, z: number, s = 1): THREE.Group {
  const k = (color >> 3) % 3, g = grp(x, y, z);
  const body = mesh(LANTERN_GEO[k], glow(color), 0, 0, 0, (k === 2 ? 0.2 : 0.24) * s, (k === 2 ? 0.36 : k === 1 ? 0.32 : 0.26) * s, (k === 2 ? 0.2 : 0.24) * s);
  g.add(body, box(0x3b2a17, 0, 0.3 * s, 0, 0.1 * s, 0.07 * s, 0.1 * s), box(0x3b2a17, 0, -0.3 * s, 0, 0.09 * s, 0.05 * s, 0.09 * s), box(0xc0281e, 0, -0.46 * s, 0, 0.035 * s, 0.26 * s, 0.035 * s));
  return g;
}
export const LANTERN_COLORS = [0xff5a4a, 0xffb347, 0xffe066, 0x7fe0c0, 0xff8fc8, 0xb59bff, 0x6ec8ff];
/** Dây đèn lồng giăng giữa hai điểm, võng xuống ở giữa. */
export function lanternString(a: THREE.Vector3, b: THREE.Vector3, n: number, r: () => number, sag = 0.7, s = 1): THREE.Group {
  const g = new THREE.Group(), mid = a.clone().lerp(b, 0.5), len = a.distanceTo(b);
  const wire = box(0x2b2b2b, mid.x, mid.y - sag * 0.5, mid.z, len, 0.03, 0.03); wire.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); g.add(wire);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t) + 0.35; g.add(lantern(LANTERN_COLORS[Math.floor(r() * LANTERN_COLORS.length)], p.x, p.y, p.z, s * (0.9 + r() * 0.4))); }
  return g;
}
/** Thuyền gỗ nhỏ. */
export function boat(c: number, len = 5, lit = false): THREE.Group {
  const g = new THREE.Group(); const hull = ball(c, 0, 0.15, 0, 0.8, 0.42, len / 2); g.add(hull, box(0x9a7150, 0, 0.42, 0, 1.2, 0.06, len * 0.6), box(0x7a5a3c, 0, 0.5, -len * 0.18, 1.1, 0.08, 0.3), box(0x7a5a3c, 0, 0.5, len * 0.18, 1.1, 0.08, 0.3));
  if (lit) g.add(lantern(0xffb347, 0, 1.5, -len * 0.3), cyl(0x3b2a17, 0, 1.05, -len * 0.3, 0.03, 1.3));
  return g;
}
export function stall(awning: number, r: () => number): THREE.Group {
  const g = new THREE.Group(); g.add(box(0x9a7150, 0, 0.5, 0, 2.2, 1, 1.1), box(awning, 0, 2.3, 0.2, 2.6, 0.08, 1.8), box(0xf3ead2, 0, 2.25, 1.05, 2.6, 0.24, 0.05));
  for (const s of [-1, 1]) g.add(cyl(0x7a5a3c, s * 1.15, 1.15, 0.9, 0.05, 2.3));
  for (let i = 0; i < 6; i++) g.add(bead([0xff8a3d, 0xffd23f, 0x7ccf4f, 0xe2573c][Math.floor(r() * 4)], -0.8 + (i % 3) * 0.8, 1.14, -0.2 + Math.floor(i / 3) * 0.4, 0.2));
  return g;
}

/** Tấm đường/lát nền chạy theo một đoạn thẳng (kể cả dốc). */
export function strip(c: C, a: THREE.Vector3, b: THREE.Vector3, width: number, thick = 0.12, lift = 0): THREE.Mesh {
  const mid = a.clone().lerp(b, 0.5), d = b.clone().sub(a), flat = Math.hypot(d.x, d.z), len = d.length();
  const o = mesh(GEO.box, M(c), mid.x, mid.y - thick / 2 + lift, mid.z, width, thick, len + (flat > 0.01 ? width * 0.5 : 0));
  o.rotation.order = 'YXZ'; o.rotation.y = Math.atan2(d.x, d.z); o.rotation.x = -Math.atan2(d.y, flat); return o;
}
/** Bậc thang đá nối hai điểm. */
export function stairs(c: number, a: THREE.Vector3, b: THREE.Vector3, width: number, steps?: number): THREE.Group {
  const g = new THREE.Group(), n = steps ?? Math.max(2, Math.round(Math.abs(b.y - a.y) / 0.32)), d = b.clone().sub(a), ry = Math.atan2(d.x, d.z), run = Math.hypot(d.x, d.z) / n;
  for (let i = 0; i < n; i++) { const p = a.clone().lerp(b, (i + 0.5) / n), top = a.y + (b.y - a.y) * ((i + 1) / n), low = Math.min(a.y, b.y) - 0.4; g.add(box(i % 2 ? c : shade(c, 0.93), p.x, (top + low) / 2, p.z, width, top - low, run * 1.02, ry)); }
  return g;
}
export function shade(c: number, k: number): number { const col = new THREE.Color(c).multiplyScalar(k); return col.getHex(); }

export class Kit {
  /** Phần tĩnh: sẽ được gộp lưới. */
  readonly stat = new THREE.Group();
  /** Phần động, biển chữ, hạt: giữ nguyên. */
  readonly dyn = new THREE.Group();
  readonly ticks: Tick[] = [];
  readonly r: () => number;
  constructor(seed: number) { this.r = rng(seed); }
  add(...o: THREE.Object3D[]): this { this.stat.add(...o); return this; }
  live(...o: THREE.Object3D[]): this { this.dyn.add(...o); return this; }
  onTick(f: Tick): void { this.ticks.push(f); }
  ground(c: number, size = 900, y = 0, x = 0, z = 0): void { this.add(box(c, x, y - 0.5, z, size, 1, size)); }
  /** Mặt nước phẳng hơi bóng, gợn nhẹ bằng cách trôi lên xuống. */
  water(c: number, x: number, z: number, w: number, d: number, y = -0.35, opacity = 0.92): THREE.Mesh {
    const tex = waves().clone(); tex.needsUpdate = true; tex.userData = { own: true }; tex.repeat.set(Math.max(1, w / 26), Math.max(1, d / 26));
    const m = new THREE.MeshStandardMaterial({ color: c, map: tex, roughness: 0.22, metalness: 0.15, transparent: opacity < 1, opacity });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m); o.position.set(x, y, z); this.live(o);
    this.onTick((t) => { o.position.y = y + Math.sin(t * 0.9) * 0.03; tex.offset.set(t * 0.012, t * 0.02); }); return o;
  }
  /** Lát đường theo cả lối đi. */
  pave(c: C, path: THREE.Vector3[], width: number, from = 0, to = path.length - 1, thick = 0.12, lift = 0.02): void { for (let i = from; i < to; i++) this.add(strip(c, path[i], path[i + 1], width, thick, lift)); }
  /** Rải vật dọc hai bên một đoạn. */
  along(a: THREE.Vector3, b: THREE.Vector3, gap: number, off: number, make: (side: number, i: number) => THREE.Object3D | null, sides: number[] = [-1, 1]): void {
    const d = b.clone().sub(a), len = d.length(), n = Math.max(1, Math.floor(len / gap)), nx = -d.z / len, nz = d.x / len;
    for (let i = 0; i < n; i++) for (const s of sides) { const p = a.clone().lerp(b, (i + 0.5) / n), o = make(s, i); if (o) { o.position.set(p.x + nx * off * s, p.y, p.z + nz * off * s); this.add(o); } }
  }
  /** Chùm đốm sáng trôi (hoa đăng, đom đóm, bụi nắng). */
  motes(n: number, color: number, size: number, place: (i: number) => THREE.Vector3, drift: (p: THREE.Vector3, i: number, t: number, dt: number) => void): THREE.Points {
    const pos = new Float32Array(n * 3), pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) { const p = place(i); pts.push(p); pos.set([p.x, p.y, p.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const o = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: dot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    o.frustumCulled = false; this.live(o);
    this.onTick((t, dt) => { for (let i = 0; i < n; i++) { drift(pts[i], i, t, dt); pos[i * 3] = pts[i].x; pos[i * 3 + 1] = pts[i].y; pos[i * 3 + 2] = pts[i].z; } g.attributes.position.needsUpdate = true; });
    return o;
  }
}
let dotTex: THREE.CanvasTexture | null = null;
export function dot(): THREE.CanvasTexture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c); return dotTex;
}

// ------------------------------------------------------------------ bổ sung: nước có vân, chi tiết đường phố, người đi bộ, quầy hàng
let waveTex: THREE.CanvasTexture | null = null;
/** Hoạ tiết gợn sóng xám–trắng, lặp được; nhân với màu nước. */
export function waves(): THREE.CanvasTexture {
  if (waveTex) return waveTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, 256, 256);
  const r = rng(77);
  for (let i = 0; i < 170; i++) { const x = r() * 256, y = r() * 256, w = 14 + r() * 46, l = r(); g.strokeStyle = l < 0.5 ? `rgba(255,255,255,${0.25 + r() * 0.5})` : `rgba(70,80,90,${0.18 + r() * 0.3})`; g.lineWidth = 1.2 + r() * 2.2; g.lineCap = 'round'; for (const ox of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + w / 2, y - 3 - r() * 3, x + ox + w, y); g.stroke(); } }
  waveTex = new THREE.CanvasTexture(c); waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.colorSpace = THREE.SRGBColorSpace; return waveTex;
}
const reflCache = new Map<string, THREE.MeshBasicMaterial>();
/** Vệt sáng đèn phản chiếu trên mặt nước (đặt sát mặt nước, kéo dài theo z hoặc x). Thêm bằng kit.add để được gộp lưới. */
export function reflection(color: number, x: number, y: number, z: number, w: number, len: number, alongX = false, opacity = 0.5): THREE.Mesh {
  const key = `${color}|${opacity}`; let m = reflCache.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }); reflCache.set(key, m); }
  const o = new THREE.Mesh(REFL, m); o.position.set(x, y, z); o.scale.set(alongX ? len : w, 1, alongX ? w : len); return o;
}
const REFL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function bicycle(c = 0x3f6f8f): THREE.Group {
  const g = new THREE.Group(), tor = new THREE.TorusGeometry(0.34, 0.035, 5, 12);
  for (const z of [-0.55, 0.55]) { const w = mesh(tor, mat(0x2a2a2a), 0, 0.36, z); w.rotation.y = Math.PI / 2; g.add(w); }
  g.add(box(c, 0, 0.62, 0, 0.05, 0.05, 1.0), box(c, 0, 0.5, -0.2, 0.05, 0.5, 0.05).rotateX(0.5), box(c, 0, 0.62, 0.5, 0.05, 0.7, 0.05).rotateX(-0.25), box(0x2a2a2a, 0, 0.96, 0.4, 0.5, 0.04, 0.04), box(0x4a2c1c, 0, 0.9, -0.25, 0.16, 0.06, 0.26), box(0x9a7150, 0, 0.95, 0.72, 0.36, 0.26, 0.26));
  return g;
}
/** Xích lô: ghế khách phía trước có mui, người đạp phía sau. */
export function cyclo(c = 0x2f7d6a): THREE.Group {
  const g = bicycle(0x555555); g.position.z = -0.7; const o = new THREE.Group(); o.add(g);
  const tor = new THREE.TorusGeometry(0.34, 0.035, 5, 12);
  for (const x of [-0.5, 0.5]) { const w = mesh(tor, mat(0x2a2a2a), x, 0.36, 0.75); w.rotation.y = Math.PI / 2; o.add(w); }
  o.add(box(c, 0, 0.55, 0.75, 0.9, 0.16, 0.9), box(0xc0281e, 0, 0.75, 0.6, 0.8, 0.26, 0.5), box(c, 0, 0.95, 0.32, 0.86, 0.6, 0.1), box(c, 0, 1.6, 0.6, 0.96, 0.06, 0.9), box(0x3a3a3a, -0.46, 1.25, 0.3, 0.04, 0.7, 0.04), box(0x3a3a3a, 0.46, 1.25, 0.3, 0.04, 0.7, 0.04));
  return o;
}
export function bench(c = 0x9a8f80): THREE.Group { return grp(0, 0, 0, 0, box(c, 0, 0.45, 0, 1.7, 0.1, 0.5), box(c, -0.7, 0.22, 0, 0.14, 0.44, 0.44), box(c, 0.7, 0.22, 0, 0.14, 0.44, 0.44)); }
export function potPlant(flower = 0xe85aa0, s = 1): THREE.Group { return grp(0, 0, 0, 0, cyl(0xa8562f, 0, 0.26 * s, 0, 0.3 * s, 0.52 * s), ball(0x4c9f55, 0, 0.78 * s, 0, 0.42 * s, 0.36 * s, 0.42 * s), bead(flower, 0.16 * s, 0.98 * s, 0.1 * s, 0.13 * s), bead(flower, -0.2 * s, 0.92 * s, -0.08 * s, 0.12 * s), bead(flower, 0, 1.04 * s, -0.16 * s, 0.11 * s)); }
/** Bia đá có mái che nhỏ. */
export function stele(c = 0x8d8478): THREE.Group { return grp(0, 0, 0, 0, box(c, 0, 0.2, 0, 1.2, 0.4, 0.7), box(shade(c, 1.12), 0, 1.15, 0, 0.8, 1.5, 0.16), ball(shade(c, 1.12), 0, 1.9, 0, 0.4, 0.22, 0.08)); }
/** Lư hương đồng, có khói nhang (đốm đỏ). */
export function incenseUrn(c = 0x8a6a2a): THREE.Group { const g = grp(0, 0, 0, 0, box(0x8d8478, 0, 0.3, 0, 1.1, 0.6, 1.1), ball(c, 0, 0.95, 0, 0.5, 0.42, 0.5), cyl(c, 0, 1.3, 0, 0.52, 0.1)); for (const [x, z] of [[-0.12, 0], [0.1, 0.1], [0, -0.12]] as const) g.add(box(0x7a2e22, x, 1.6, z, 0.025, 0.6, 0.025), bead(glow(0xff5a3a), x, 1.92, z, 0.035)); for (const sx of [-1, 1]) g.add(cyl(c, sx * 0.4, 0.5, 0, 0.06, 0.3)); return g; }
/** Cờ đỏ sao vàng trên cột. */
export function flag(h = 7): THREE.Group { return grp(0, 0, 0, 0, cyl(0xcfd6e0, 0, h / 2, 0, 0.06, h), box(0xd8281e, 0.75, h - 0.5, 0, 1.5, 1.0, 0.03), bead(glow(0xffd23f), 0.75, h - 0.5, 0.03, 0.2, 0.2, 0.02), bead(glow(0xffd23f), 0.75, h - 0.5, -0.03, 0.2, 0.2, 0.02)); }
/** Bảng chỉ dẫn hai cánh trên cột. */
export function wayPost(a = 0x2f7d6a, b = 0x7a4a22): THREE.Group { return grp(0, 0, 0, 0, cyl(0x5a4a34, 0, 1.3, 0, 0.07, 2.6), box(a, 0.42, 2.3, 0, 0.9, 0.26, 0.05), box(b, -0.42, 1.95, 0, 0.9, 0.26, 0.05), box(0xf3ead2, 0.42, 2.3, 0.03, 0.6, 0.06, 0.01), box(0xf3ead2, -0.42, 1.95, 0.03, 0.6, 0.06, 0.01)); }
/** Thùng rác đôi. */
/** Bảng thuyết minh di tích: khung gỗ, mặt bảng kem có tiêu đề và các dòng chữ giả. */
export function infoBoard(c = 0x7a4a22): THREE.Group { const g = grp(0, 0, 0, 0, cyl(c, -0.55, 0.7, 0, 0.05, 1.4), cyl(c, 0.55, 0.7, 0, 0.05, 1.4), box(c, 0, 1.2, 0, 1.3, 0.86, 0.06), box(0xf6ecd0, 0, 1.2, 0.035, 1.16, 0.72, 0.02), box(0xb8322a, 0, 1.44, 0.05, 0.8, 0.1, 0.01), gable(c, 0, 1.63, 0, 0.3, 0.14, 1.46, Math.PI / 2)); for (let i = 0; i < 4; i++) g.add(box(0x8a7a66, i % 2 ? -0.06 : 0, 1.28 - i * 0.11, 0.05, i % 2 ? 0.86 : 0.98, 0.035, 0.01)); return g; }
export function bin(): THREE.Group { return grp(0, 0, 0, 0, cyl(0x2f7d26, -0.24, 0.42, 0, 0.2, 0.84), cyl(0xe2a33c, 0.24, 0.42, 0, 0.2, 0.84), box(0x3a3a3a, 0, 0.9, 0, 0.9, 0.06, 0.4)); }
/** Bảng hiệu gỗ treo ngang (không chữ, có vạch giả chữ thếp vàng). */
export function shopSign(w = 1.8, bg = 0x2a1a12, fg = 0xd9a83a): THREE.Group { const g = grp(0, 0, 0, 0, box(bg, 0, 0, 0, w, 0.42, 0.06)); const n = Math.max(2, Math.round(w / 0.42)); for (let i = 0; i < n; i++) g.add(box(fg, (i - (n - 1) / 2) * (w * 0.8 / n), 0, 0.04, w * 0.5 / n, 0.2, 0.02)); return g; }
/** Mây thấp ít mặt. */
export function cloud(s = 1, c = 0xffffff): THREE.Group { return grp(0, 0, 0, 0, bead(c, 0, 0, 0, 7 * s, 2.4 * s, 4 * s), bead(c, 5 * s, 0.6 * s, 1, 5 * s, 2.2 * s, 3.4 * s), bead(c, -5.4 * s, 0.2 * s, -1, 4.6 * s, 1.8 * s, 3 * s)); }

export interface Walker { g: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[] }
/** Người đi bộ có tay chân rời để đung đưa theo bước. Chưa gộp lưới: nơi gọi tự gộp từng phần. */
export function walker(i: number): Walker {
  const g = new THREE.Group(), skin = [0xf2c69c, 0xe8b88a, 0xf6d3ae][i % 3], shirt = SHIRTS[i % SHIRTS.length], pants = [0x4a5160, 0x6b5140, 0x3f5566, 0x8a8f9a][i % 4], hat = i % 4;
  const body = new THREE.Group(); body.add(cyl(shirt, 0, 1.08, 0, 0.27, 0.66, 0.2), ball(shirt, 0, 1.4, 0, 0.28, 0.15, 0.21), ball(skin, 0, 1.66, 0, 0.25));
  if (hat === 1) body.add(cone(0xf3e2ae, 0, 1.96, 0, 0.56, 0.32)); else if (hat === 2) body.add(ball(SHIRTS[(i + 2) % 8], 0, 1.82, 0, 0.26, 0.16, 0.26), box(SHIRTS[(i + 2) % 8], 0, 1.8, -0.26, 0.3, 0.04, 0.2)); else body.add(ball([0x3b2a17, 0x5a3d22][i % 2], 0, 1.76, 0.04, 0.27, 0.21, 0.26));
  if (i % 5 === 0) body.add(box(0x2a2a2a, 0, 1.2, -0.24, 0.16, 0.12, 0.1)); // máy ảnh đeo cổ
  if (i % 5 === 2) body.add(box(SHIRTS[(i + 3) % 8], 0, 1.2, 0.24, 0.36, 0.44, 0.16)); // ba lô
  g.add(body); const legs: THREE.Object3D[] = [], arms: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.13, 0.76, 0); leg.add(cyl(pants, 0, -0.38, 0, 0.1, 0.76), box(0x4a3a2a, 0, -0.74, -0.05, 0.17, 0.08, 0.28)); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(sx * 0.34, 1.34, 0); arm.add(cyl(shirt, 0, -0.24, 0, 0.075, 0.5), ball(skin, 0, -0.5, 0, 0.08)); arms.push(arm);
    g.add(leg, arm);
  }
  return { g, legs, arms };
}

/** Mô hình quầy hàng theo loại: nuoc_mia, hang_rong, ca_phe, tap_hoa, dac_san, luu_niem (loại lạ dùng quầy đặc sản). Mặt quầy quay về +z. */
export function shopModel(kind: string, r: () => number): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'nuoc_mia' || kind === 'nuoc') {
    g.add(box(0x3f9f6a, 0, 0.75, 0, 1.6, 0.9, 0.8), box(0xcfd6e0, 0, 1.24, 0, 1.66, 0.08, 0.86), box(0xcfd6e0, -0.35, 1.6, 0, 0.5, 0.6, 0.5), cyl(0x8a8f9a, -0.35, 1.6, 0.28, 0.16, 0.1).rotateX(Math.PI / 2));
    for (let i = 0; i < 5; i++) g.add(cyl(0xb7c95a, 0.5 + (i % 2) * 0.12, 1.7, -0.25 + i * 0.1, 0.045, 1.5).rotateZ(0.12 * (i - 2)));
    for (const x of [0.1, 0.36]) g.add(cyl(0xe8f0c0, x, 1.4, 0.24, 0.07, 0.2));
    for (const x of [-0.6, 0.6]) { const w = mesh(new THREE.TorusGeometry(0.28, 0.04, 5, 10), mat(0x2a2a2a), x, 0.3, 0.42); g.add(w); }
    g.add(cyl(0x5a4a34, 0.75, 1.5, -0.38, 0.03, 1.6), cyl(0x5a4a34, -0.75, 1.5, -0.38, 0.03, 1.6), box(0xffd23f, 0, 2.3, 0, 1.9, 0.06, 1.1), box(0x2f7d26, 0, 2.22, 0.56, 1.9, 0.2, 0.04));
  } else if (kind === 'hang_rong') {
    // gánh hàng rong: đòn gánh, hai thúng, người bán ngồi ghế thấp
    g.add(box(0x7a5a3c, 0, 1.0, 0, 2.2, 0.05, 0.06));
    for (const s of [-1, 1]) { g.add(cyl(0xc9a66b, s * 0.95, 0.3, 0, 0.42, 0.36), cyl(0x5a4a34, s * 0.95, 0.66, 0, 0.02, 0.7)); for (let i = 0; i < 6; i++) g.add(bead([0xff8a3d, 0xffd23f, 0x7ccf4f, 0xf3ead2][Math.floor(r() * 4)], s * 0.95 + (r() - 0.5) * 0.5, 0.52, (r() - 0.5) * 0.5, 0.11)); }
    const p = person(4, 1, 0x8a5a9a); p.scale.setScalar(0.82); p.position.set(0, -0.28, -0.6); g.add(p, box(0xd8281e, 0, 0.14, -0.6, 0.36, 0.28, 0.36));
  } else if (kind === 'ca_phe') {
    g.add(box(0x6b4a34, 0, 0.55, -0.5, 1.5, 1.1, 0.6), box(0x2a1a12, 0, 1.12, -0.5, 1.6, 0.06, 0.7), cyl(0xcfd6e0, -0.4, 1.36, -0.5, 0.11, 0.42), cone(0xcfd6e0, -0.4, 1.66, -0.5, 0.13, 0.16), cyl(0xf3ead2, 0.2, 1.22, -0.5, 0.07, 0.14), cyl(0xf3ead2, 0.45, 1.22, -0.45, 0.07, 0.14));
    for (const [x, z] of [[-0.7, 0.5], [0.7, 0.6]] as const) { g.add(cyl(0xd8281e, x, 0.22, z, 0.2, 0.44), cyl(0x3f6fbf, x + 0.5 * Math.sign(x) * -1, 0.14, z + 0.3, 0.16, 0.28)); }
    g.add(box(0x8a6a48, 0, 0.36, 0.55, 0.5, 0.05, 0.5), cyl(0x5a4a34, 0, 0.18, 0.55, 0.04, 0.36), cyl(0xf3ead2, 0, 0.44, 0.55, 0.06, 0.1));
    g.add(cyl(0x5a4a34, 0, 1.3, -0.9, 0.04, 2.6), cone(0xc0281e, 0, 2.5, -0.5, 1.5, 0.5));
  } else if (kind === 'tap_hoa') {
    g.add(box(0xf1e6c8, 0, 1.3, -0.7, 2.6, 2.6, 0.2), box(0x4aa3d8, 0, 2.5, 0, 2.8, 0.08, 1.7), box(0x2f6f9f, 0, 2.38, 0.84, 2.8, 0.26, 0.04), box(0x9a7150, 0, 0.45, 0.2, 2.4, 0.9, 0.7));
    for (let j = 0; j < 3; j++) { g.add(box(0x9a7150, 0, 1.2 + j * 0.45, -0.56, 2.3, 0.05, 0.3)); for (let i = 0; i < 8; i++) g.add(box([0xe2573c, 0xffd23f, 0x4aa3d8, 0x7ccf4f, 0xf3ead2, 0xff8a3d][Math.floor(r() * 6)], -1 + i * 0.28, 1.36 + j * 0.45, -0.56, 0.18, 0.26, 0.16)); }
    for (let i = 0; i < 5; i++) g.add(cyl([0x6ec8ff, 0xffe066, 0xff8fc8][i % 3], -0.9 + i * 0.4, 1.02, 0.2, 0.06, 0.24));
    for (const s of [-1, 1]) g.add(cyl(0x7a5a3c, s * 1.3, 1.25, 0.8, 0.04, 2.5));
  } else if (kind === 'luu_niem') {
    g.add(box(0x7a4a22, 0, 0.5, 0, 2.0, 1.0, 0.9), box(0xc0281e, 0, 1.02, 0, 2.1, 0.05, 1.0), box(0x7a4a22, 0, 2.3, 0, 2.2, 0.08, 1.2));
    for (const s of [-1, 1]) g.add(cyl(0x7a5a3c, s * 1.0, 1.15, 0.45, 0.04, 2.3), cyl(0x7a5a3c, s * 1.0, 1.15, -0.45, 0.04, 2.3));
    for (let i = 0; i < 5; i++) g.add(lantern(LANTERN_COLORS[(i * 2) % 7], -0.8 + i * 0.4, 1.95, 0.55, 0.6));
    for (let i = 0; i < 4; i++) g.add(cone(0xf3e2ae, -0.7 + i * 0.45, 1.14, 0.1, 0.2, 0.12), box([0x4aa3d8, 0xe2573c, 0xffd23f, 0x7ccf4f][i], -0.7 + i * 0.45, 1.16, -0.25, 0.22, 0.22, 0.04));
  } else {
    const st = stall([0xe2573c, 0x2f7d6a, 0xffb347][Math.floor(r() * 3)], r); g.add(st); g.add(box(0x7a4a22, 0, 2.62, 1.05, 1.6, 0.3, 0.05), box(0xffd23f, 0, 2.62, 1.08, 1.2, 0.12, 0.02));
    for (let i = 0; i < 3; i++) g.add(box(0xc9a66b, -0.7 + i * 0.7, 0.2, 0.9, 0.5, 0.4, 0.4));
  }
  return g;
}

// ------------------------------------------------------------------ ảnh cắt nền dán lên tấm phẳng (công trình chính nét cao)
export interface PhotoOpts {
  /** Coi điểm ảnh gần trắng (mọi kênh > ngưỡng, 0–255) là trong suốt — dùng khi ảnh còn nền trắng dưới vòm. */
  whiteKey?: number;
  /** Độ tự sáng (0–1) để ảnh không tối sầm khi cảnh là chiều tối. */
  glow?: number;
  /** Màu thay thế khi ảnh không tải được (tấm phẳng thành mảng màu trơn). */
  fallback?: number;
  /** Gọi khi ảnh lỗi, để cảnh hiện lại khối dựng cũ. */
  onError?: () => void;
}
/** Chất liệu ảnh cắt nền: alphaTest 0.5, hai mặt, sRGB, lọc bất đẳng hướng tối đa, có mipmap. Texture tự giải phóng khi rời cảnh. */
export function photoMat(file: string, opts: PhotoOpts = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false });
  const img = new Image(); img.decoding = 'async';
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
    if (opts.whiteKey) { const d = g.getImageData(0, 0, c.width, c.height), a = d.data, k = opts.whiteKey; for (let i = 0; i < a.length; i += 4) if (a[i] > k && a[i + 1] > k && a[i + 2] > k) a[i + 3] = 0; g.putImageData(d, 0, 0); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.userData = { own: true };
    m.map = t; if (opts.glow) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t; m.emissiveIntensity = opts.glow; } m.needsUpdate = true;
  };
  img.onerror = () => { m.color.set(opts.fallback ?? 0x9a8f80); m.alphaTest = 0; m.needsUpdate = true; opts.onError?.(); };
  img.src = `${import.meta.env.BASE_URL}art/tex/${file}`;
  return m;
}
/** Tấm phẳng đứng dán một phần ảnh: (x0,y0)–(x1,y1) tính theo tỉ lệ 0–1 từ góc TRÊN-TRÁI của ảnh. Tâm đáy tấm ở gốc, mặt quay về +z. */
export function photoPlane(m: THREE.Material, w: number, h: number, crop: [number, number, number, number] = [0, 0, 1, 1]): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), uv = g.attributes.uv as THREE.BufferAttribute, [x0, y0, x1, y1] = crop;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, x0 + uv.getX(i) * (x1 - x0), (1 - y1) + uv.getY(i) * (y1 - y0));
  return new THREE.Mesh(g, m);
}

// ---- hình dùng chung cho các địa danh biển đảo, làng chài
/** Đồi núi phủ rừng: chùm khối tròn dẹt nhiều sắc xanh, mặt lấm tấm tán cây — thay cho núi hình chóp phẳng. */
export function hill(x: number, z: number, rx: number, rz: number, h: number, r: () => number, tones: number[] = [0x2f6b45, 0x3f7a4e, 0x4d8c58, 0x5c9a60], y = 0): THREE.Group {
  const g = grp(x, y, z), n = 5 + Math.floor(r() * 3);
  g.add(bead(tones[1], 0, 0, 0, rx * 0.72, h, rz * 0.72));
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r(), d = 0.2 + r() * 0.4; g.add(bead(tones[i % tones.length], Math.cos(a) * rx * d, 0, Math.sin(a) * rz * d, rx * (0.5 + r() * 0.3), h * (0.45 + r() * 0.4), rz * (0.5 + r() * 0.3))); }
  const m = Math.round(Math.min(46, 10 + (rx + rz) / 7));
  for (let i = 0; i < m; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.8, s = ((rx + rz) / 2) * (0.07 + r() * 0.05); g.add(bead(tones[(i + (r() < 0.3 ? 1 : 0)) % tones.length], Math.cos(a) * rx * d, h * (1 - d * d) * 0.82, Math.sin(a) * rz * d, s, s * 0.62, s)); }
  return g;
}
/** Ca nô cao tốc chở khách: thân trắng sọc màu, kính chắn gió, mái che, máy đuôi tôm. Mũi hướng -z. */
export function speedboat(stripe = 0x2a6f9a, len = 8): THREE.Group {
  const k = len / 8;
  return grp(0, 0, 0, 0, bead(0xf6f4ee, 0, 0.35 * k, 0, 1.25 * k, 0.75 * k, 4.1 * k), box(stripe, 0, 0.62 * k, 0.2 * k, 2.3 * k, 0.16 * k, 6.4 * k), box(0xf6f4ee, 0, 0.82 * k, 0.4 * k, 2.1 * k, 0.24 * k, 5.6 * k),
    box(0x9fd8f0, 0, 1.35 * k, -1.5 * k, 1.8 * k, 0.8 * k, 0.1 * k), box(0xf6f4ee, 0, 2.05 * k, 0.3 * k, 2.0 * k, 0.1 * k, 3.8 * k), cyl(0xcfd6e0, -0.9 * k, 1.45 * k, 2.0 * k, 0.04 * k, 1.2 * k), cyl(0xcfd6e0, 0.9 * k, 1.45 * k, 2.0 * k, 0.04 * k, 1.2 * k),
    cyl(0xcfd6e0, -0.9 * k, 1.45 * k, -1.4 * k, 0.04 * k, 1.2 * k), cyl(0xcfd6e0, 0.9 * k, 1.45 * k, -1.4 * k, 0.04 * k, 1.2 * k), box(0x2b2f36, 0, 0.9 * k, 3.5 * k, 0.5 * k, 0.9 * k, 0.5 * k), box(0xe2573c, 0, 1.1 * k, 0.8 * k, 1.5 * k, 0.3 * k, 2.2 * k));
}
/** Ghe gỗ đánh cá sơn xanh đỏ có ca-bin nhỏ và cờ. Mũi hướng -z. */
export function fishingBoat(hull = 0x2a6f9a, trim = 0xd2553a, len = 9): THREE.Group {
  const k = len / 9;
  return grp(0, 0, 0, 0, bead(hull, 0, 0.3 * k, 0, 1.5 * k, 1.0 * k, 4.6 * k), box(trim, 0, 0.92 * k, 0, 2.7 * k, 0.16 * k, 7.6 * k), box(0xd9c7a0, 0, 0.98 * k, 0, 2.3 * k, 0.1 * k, 7 * k), box(0xf4f1ea, 0, 1.8 * k, 1.5 * k, 1.9 * k, 1.5 * k, 2.4 * k), box(0x3f6f8f, 0, 2.0 * k, 0.28 * k, 1.5 * k, 0.6 * k, 0.06 * k),
    box(trim, 0, 2.62 * k, 1.5 * k, 2.2 * k, 0.14 * k, 2.8 * k), cyl(0x5a4a34, 0, 2.6 * k, -1.2 * k, 0.06 * k, 3.4 * k), box(0xd8281e, 0.42 * k, 4.0 * k, -1.2 * k, 0.8 * k, 0.5 * k, 0.03 * k), bead(0x1d1d1d, 0, 1.3 * k, -4.2 * k, 0.16 * k, 0.16 * k, 0.1 * k), box(0xe2a33c, 0.9 * k, 1.25 * k, -1.6 * k, 0.6 * k, 0.4 * k, 0.9 * k));
}
/** Thúng chai (thuyền thúng tròn) úp hoặc ngửa trên bãi. */
export function basketBoat(s = 1, upside = false): THREE.Group {
  const g = grp(0, 0, 0, 0, bead(0x4a3a2a, 0, upside ? 0 : 0.42 * s, 0, 1.05 * s, 0.5 * s, 1.05 * s), cyl(0x8a6a48, 0, upside ? 0.06 : 0.44 * s, 0, 1.08 * s, 0.07 * s));
  if (!upside) g.add(cyl(0x2f2620, 0, 0.47 * s, 0, 0.95 * s, 0.03 * s), box(0x9a7150, 0.3 * s, 0.62 * s, 0, 0.1 * s, 0.05 * s, 1.5 * s));
  return g;
}
/** Giàn phơi lưới: hai cọc, lưới xanh rủ, phao cam. Dài theo trục z. */
export function netRack(len = 5, c = 0x5f9fa8): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0x7a5a3c, 0, 1, -len / 2, 0.07, 2), cyl(0x7a5a3c, 0, 1, len / 2, 0.07, 2), box(0x7a5a3c, 0, 1.96, 0, 0.06, 0.06, len), box(c, 0, 1.3, 0, 0.05, 1.3, len * 0.96), box(shade(c, 0.8), 0.04, 0.9, 0, 0.05, 0.5, len * 0.9));
  for (let i = 0; i < 5; i++) g.add(bead(0xff8a3d, 0, 1.92, -len / 2 + (i + 0.5) * (len / 5), 0.12));
  return g;
}
/** Võng mắc giữa hai thân cọc, treo dưới bóng dừa. Dài theo trục x. */
export function hammock(c = 0xe2573c): THREE.Group {
  return grp(0, 0, 0, 0, cyl(0x7a5a3c, -1.5, 0.9, 0, 0.09, 1.8), cyl(0x7a5a3c, 1.5, 0.9, 0, 0.09, 1.8), bead(c, 0, 0.78, 0, 1.35, 0.26, 0.5), box(0xf4f1ea, 0, 0.84, 0, 2.2, 0.04, 0.12));
}
/** Dù che nắng và ghế nằm bãi biển. */
export function beachSet(c = 0xffd23f): THREE.Group {
  return grp(0, 0, 0, 0, cyl(0xd8d2c4, 0, 1.2, 0, 0.05, 2.4), cone(c, 0, 2.5, 0, 1.6, 0.55), box(0xf4f1ea, 1.1, 0.28, 0.3, 0.7, 0.08, 1.9), box(0xf4f1ea, 1.1, 0.5, -0.5, 0.7, 0.5, 0.08), box(0x8a6a48, 1.1, 0.14, 0.3, 0.6, 0.24, 1.6));
}
/** Núi phủ rừng cùng tham số với mountain(): dùng thay núi hình chóp ở các địa danh có rừng. */
export function forestMountain(c: number, x: number, z: number, radius: number, h: number, r: () => number, y = 0): THREE.Group {
  return hill(x, z, radius, radius * 0.9, h, r, [shade(c, 0.82), c, shade(c, 1.12), shade(c, 0.94)], y);
}
