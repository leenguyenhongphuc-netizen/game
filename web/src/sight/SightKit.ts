// Bộ khung dùng chung cho cảnh đi bộ tham quan: khối dựng nhanh, lối đi có độ rộng, mái nhà, cây, người, nước, núi.
// Mỗi địa danh là một file trong sets/ gọi các hàm ở đây; phần tĩnh được gộp lưới và ghi màu vào đỉnh để ít lần vẽ.
import * as THREE from 'three';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { makeSign } from '../drive/RideKit.ts';

export const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
export type Tick = (time: number, dt: number, player: PlayerState) => void;
export interface PlayerState { pos: THREE.Vector3; s: number; seg: number; near: string | null }
export interface SightStopAt { id: string; at: THREE.Vector3; /** Vật cần nhìn khi mở thuyết minh. */ look?: THREE.Vector3 }
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
  const sp = makeSign(text, bg); sp.scale.multiplyScalar(0.62 * scale); sp.position.y = 2.9 * scale;
  return grp(x, y, z, 0, cyl(0x7a5a3c, 0, 1.2 * scale, 0, 0.09, 2.4 * scale), sp);
}
/** Biển chữ lơ lửng (tên công trình). */
export function label(text: string, x: number, y: number, z: number, bg = '#7a4a22', scale = 1): THREE.Sprite { const sp = makeSign(text, bg); sp.scale.multiplyScalar(scale); sp.position.set(x, y, z); return sp; }
export function lampPost(x: number, y: number, z: number, h = 3.6, c = 0xffd98a): THREE.Group { return grp(x, y, z, 0, cyl(0x3d3a36, 0, h / 2, 0, 0.07, h), box(0x3d3a36, 0, h, 0, 0.5, 0.06, 0.06), ball(glow(c), 0.22, h - 0.2, 0, 0.17), ball(glow(c), -0.22, h - 0.2, 0, 0.17)); }
/** Đèn lồng treo: quả lụa phát sáng có chóp và tua. */
export function lantern(color: number, x: number, y: number, z: number, s = 1): THREE.Group { return grp(x, y, z, 0, ball(glow(color), 0, 0, 0, 0.26 * s, 0.32 * s, 0.26 * s), cyl(0x3b2a17, 0, 0.3 * s, 0, 0.09 * s, 0.07 * s), cyl(0xc0281e, 0, -0.42 * s, 0, 0.03 * s, 0.24 * s)); }
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
  for (let i = 0; i < 6; i++) g.add(ball([0xff8a3d, 0xffd23f, 0x7ccf4f, 0xe2573c][Math.floor(r() * 4)], -0.8 + (i % 3) * 0.8, 1.14, -0.2 + Math.floor(i / 3) * 0.4, 0.2));
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
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.1, transparent: opacity < 1, opacity });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m); o.position.set(x, y, z); this.live(o);
    this.onTick((t) => { o.position.y = y + Math.sin(t * 0.9) * 0.03; }); return o;
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
