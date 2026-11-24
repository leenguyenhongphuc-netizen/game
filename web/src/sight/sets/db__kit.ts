// Khối dựng dùng chung cho các cảnh vùng Đồng bằng sông Hồng: nền đất có hồ (đi không lọt xuống nước), đình chùa Bắc Bộ
// (mái ngói mũi hài, đầu đao cong, cột son), tam quan, cầu cong, tháp nhiều tầng, núi đá vôi, sen, cây đa, tre.
import * as THREE from 'three';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, hip, rock, strip } from '../SightKit.ts';

export const TILE = 0x8a3a24, TILE_D = 0x6a2a1a, RED = 0xa8322a, WOOD = 0x6b3f22, PLASTER = 0xefe2c4, STONE = 0xb4ad9f, BRICK = 0xa8543a, MOSS = 0x6f7d5a;
export const LIME = [0x8e8e86, 0x9a978c, 0x7f7f78, 0xa6a296];

export interface Lake { x: number; z: number; rx: number; rz: number }
const inLake = (x: number, z: number, l: Lake, pad = 0) => ((x - l.x) / (l.rx + pad)) ** 2 + ((z - l.z) / (l.rz + pad)) ** 2 < 1;
/**
 * Mặt đất cao `y` phủ khung [x0,x1]×[z0,z1] trừ các hồ (hồ là chỗ trũng: lưới đi bộ dừng ở mép nước).
 * Dựng theo từng dải dọc z rộng `step` m; thêm kè đá quanh hồ và mặt nước.
 */
export function landWithLakes(kit: Kit, x0: number, z0: number, x1: number, z1: number, lakes: Lake[], c: number, opts: { step?: number; water?: number; kerb?: number; y?: number; floor?: number } = {}): void {
  const step = opts.step ?? 2, y = opts.y ?? 0;
  for (let z = z0; z < z1; z += step) {
    const zc = z + step / 2; let run = x0;
    for (let x = x0; x <= x1; x += 0.5) {
      const wet = x < x1 && lakes.some((l) => inLake(x, zc, l));
      if (wet || x >= x1) { if (x - run > 0.2) kit.add(box(c, (run + x) / 2, y - 0.5, zc, x - run, 1, step)); run = x + 0.5; }
    }
  }
  for (const l of lakes) {
    kit.add(cyl(opts.floor ?? 0x3f5a46, l.x, y - 2.6, l.z, l.rx + 1, 0.4, l.rz + 1));
    const n = Math.max(24, Math.round((l.rx + l.rz) * 0.9));
    if (opts.kerb !== undefined) for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2; kit.add(strip(opts.kerb, V(l.x + Math.cos(a) * l.rx, y - 0.1, l.z + Math.sin(a) * l.rz), V(l.x + Math.cos(b) * l.rx, y - 0.1, l.z + Math.sin(b) * l.rz), 0.7, 0.35, 0.18)); }
    kit.water(opts.water ?? 0x3f8f86, l.x, l.z, l.rx * 2.2, l.rz * 2.2, y - 0.55, 0.9);
  }
}
export function wet(lakes: Lake[], x: number, z: number, pad = 0): boolean { return lakes.some((l) => inLake(x, z, l, pad)); }

/** Mái ngói Bắc Bộ: hai tầng dốc, bờ nóc đắp, bốn đầu đao cong vút. y là mép mái. */
export function northRoof(x: number, y: number, z: number, w: number, d: number, h = 1.6, c = TILE, ry = 0): THREE.Group {
  const g = grp(x, y, z, ry);
  g.add(box(c, 0, 0.06, 0, w + 0.6, 0.14, d + 0.6), hip(c, 0, 0.1, 0, w, h, d), box(TILE_D, 0, h + 0.12, 0, w * 0.62, 0.26, 0.34));
  for (const sx of [-1, 1]) {
    g.add(bead(TILE_D, sx * w * 0.31, h + 0.4, 0, 0.26, 0.38, 0.14)); // con kìm hai đầu nóc
    for (const sz of [-1, 1]) { const k = cone(TILE_D, sx * (w / 2 + 0.25), 0.55, sz * (d / 2 + 0.25), 0.16, 1.1); k.rotation.z = -sx * 0.75; k.rotation.x = sz * 0.75; g.add(k); }
  }
  g.add(ball(0xd8b04a, 0, h + 0.5, 0, 0.26)); // nghê/hoả châu giữa nóc
  return g;
}
/** Toà đình/chùa: nền đá, hàng cột son, vách gỗ, cửa bức bàn, mái hai tầng. */
export function hall(x: number, z: number, w: number, d: number, h = 3.4, ry = 0, opts: { roof?: number; wall?: number; twoTier?: boolean; lit?: boolean } = {}): THREE.Group {
  const g = grp(x, 0, z, ry), wall = opts.wall ?? WOOD;
  g.add(box(STONE, 0, 0.3, 0, w + 1.6, 0.6, d + 1.6), box(0x9d968a, 0, 0.62, 0, w + 1.8, 0.06, d + 1.8));
  g.add(box(wall, 0, 0.6 + h / 2, -0.4, w - 0.4, h, d - 1.6));
  const n = Math.max(3, Math.round(w / 2.2));
  for (let i = 0; i <= n; i++) { const cx = -w / 2 + (i * w) / n; for (const cz of [d / 2 - 0.2, -d / 2 + 0.2]) g.add(cyl(RED, cx, 0.6 + h / 2, cz, 0.2, h)); }
  for (let i = 0; i < n; i++) { const cx = -w / 2 + ((i + 0.5) * w) / n; g.add(box(opts.lit ? glow(0xffc46a) : 0x8a5a32, cx, 0.6 + h * 0.42, d / 2 - 1.18, (w / n) * 0.78, h * 0.78, 0.08)); for (let k = 0; k < 4; k++) g.add(box(0x4a2a16, cx - (w / n) * 0.3 + k * (w / n) * 0.2, 0.6 + h * 0.42, d / 2 - 1.12, 0.05, h * 0.74, 0.04)); }
  g.add(box(0x5a3020, 0, 0.6 + h + 0.12, 0, w + 0.2, 0.24, d + 0.2));
  if (opts.twoTier) { g.add(northRoof(0, 0.6 + h + 0.1, 0, w + 1.4, d + 1.4, 1.0, opts.roof ?? TILE), box(wall, 0, 0.6 + h + 1.4, 0, w * 0.7, 1.2, d * 0.6), northRoof(0, 0.6 + h + 2.0, 0, w * 0.86, d * 0.8, 1.5, opts.roof ?? TILE)); }
  else g.add(northRoof(0, 0.6 + h + 0.1, 0, w + 1.4, d + 1.4, 1.8, opts.roof ?? TILE));
  return g;
}
/** Tam quan: ba lối, lối giữa cao, mái chồng. Mặt cổng quay về +z; lối giữa rộng `gap` để đi qua. */
export function tamQuan(x: number, z: number, ry = 0, gap = 3, c = PLASTER): THREE.Group {
  const g = grp(x, 0, z, ry);
  for (const s of [-1, 1]) {
    g.add(box(c, s * (gap / 2 + 0.5), 2.6, 0, 1, 5.2, 1.4), box(c, s * (gap / 2 + 3.1), 1.9, 0, 1, 3.8, 1.2), box(c, s * (gap / 2 + 1.8), 3.4, 0, 1.8, 0.5, 1.2));
    g.add(northRoof(s * (gap / 2 + 1.8), 3.7, 0, 3.4, 1.8, 0.9));
    g.add(box(0x2a2a2a, s * (gap / 2 + 1.8), 1.3, 0.62, 1.1, 2.4, 0.04));
  }
  g.add(box(c, 0, 5.4, 0, gap + 2, 0.6, 1.4), box(0x9a3a24, 0, 5.4, 0.72, gap * 0.8, 0.44, 0.04), northRoof(0, 5.7, 0, gap + 2.8, 2.2, 1.3));
  return g;
}
/** Cầu cong đi được: chuỗi đoạn lát từ a tới b, giữa vồng lên `arch` m, có lan can son. */
export function archBridge(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, width: number, arch: number, c = RED, deck = 0x7a4a2a, n = 12): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t); p.y += Math.sin(t * Math.PI) * arch; pts.push(p); }
  const d = b.clone().sub(a).setY(0).normalize(), nx = -d.z, nz = d.x;
  for (let i = 0; i < n; i++) {
    kit.add(strip(deck, pts[i], pts[i + 1], width, 0.24, 0));
    for (const s of [-1, 1]) {
      const p = pts[i], q = pts[i + 1];
      kit.add(strip(c, V(p.x + nx * s * width / 2, p.y + 0.9, p.z + nz * s * width / 2), V(q.x + nx * s * width / 2, q.y + 0.9, q.z + nz * s * width / 2), 0.14, 0.12));
      kit.add(cyl(c, p.x + nx * s * width / 2, p.y + 0.45, p.z + nz * s * width / 2, 0.07, 0.9));
    }
    if (i % 3 === 1) kit.add(cyl(c, pts[i].x, pts[i].y - 1.4, pts[i].z, 0.18, 2.6));
  }
  return pts;
}
/** Tháp nhiều tầng mái cong (tháp Rùa, tháp Hoà Phong, bảo tháp): tầng nhỏ dần. */
export function pagoda(levels: number, w: number, h: number, c = PLASTER, roof = TILE, shrink = 0.84): THREE.Group {
  const g = new THREE.Group(); let y = 0, ww = w;
  for (let i = 0; i < levels; i++) {
    g.add(box(c, 0, y + h / 2, 0, ww, h, ww));
    for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) g.add(box(0x3a2a20, sx * (ww / 2 + 0.01), y + h * 0.5, sz * (ww / 2 + 0.01), sx ? 0.04 : ww * 0.34, h * 0.55, sz ? 0.04 : ww * 0.34));
    g.add(northRoof(0, y + h, 0, ww + 0.6, ww + 0.6, 0.5 + ww * 0.08, roof));
    y += h + 0.5 + ww * 0.08; ww *= shrink;
  }
  g.add(cone(0xd8b04a, 0, y + 0.5, 0, 0.3, 1.4), ball(0xd8b04a, 0, y + 0.1, 0, 0.36));
  return g;
}
/** Núi đá vôi dạng tháp (karst): vách xám dựng đứng, đỉnh phủ cây xanh. */
export function karst(x: number, z: number, r: number, h: number, rnd: () => number, y = 0, green = 0x4f7f45): THREE.Group {
  const g = grp(x, y, z, rnd() * 6);
  const c = LIME[Math.floor(rnd() * LIME.length)];
  g.add(cyl(c, 0, h * 0.45, 0, r, h * 0.9, r * 0.82), ball(c, 0, h * 0.86, 0, r * 0.86, h * 0.22, r * 0.72));
  g.add(ball(green, r * 0.1, h * 0.98, 0, r * 0.8, h * 0.14, r * 0.66), ball(0x5f8f4a, -r * 0.3, h * 0.7, r * 0.4, r * 0.45, h * 0.16, r * 0.4));
  for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; g.add(ball(i % 2 ? 0x56864a : green, Math.cos(a) * r * 0.82, h * (0.3 + rnd() * 0.4), Math.sin(a) * r * 0.7, r * 0.3, h * 0.08, r * 0.24)); }
  g.add(rock(shadeLime(c), r * 0.5, h * 0.2, r * 0.5, r * 0.5, h * 0.24, r * 0.36, rnd() * 3));
  return g;
}
const shadeLime = (c: number) => new THREE.Color(c).multiplyScalar(0.86).getHex();
/** Lá sen và hoa sen nổi trên mặt hồ (gộp lưới). */
export function lotus(kit: Kit, l: Lake, n: number, rnd: () => number, y = -0.48): void {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * 0.88, x = l.x + Math.cos(a) * l.rx * d, z = l.z + Math.sin(a) * l.rz * d;
    kit.add(cyl(i % 3 ? 0x4f8f45 : 0x5fa050, x, y, z, 0.5 + rnd() * 0.5, 0.04));
    if (i % 4 === 0) kit.add(cyl(0x4f8f45, x, y + 0.4, z, 0.03, 0.8), bead(i % 8 ? 0xf3a0c0 : 0xfff2f6, x, y + 0.88, z, 0.22, 0.26, 0.22));
  }
}
/** Cây đa cổ thụ: thân to, rễ phụ buông, tán rộng thấp. */
export function banyan(rnd: () => number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0x6a5038, 0, 1.6 * s, 0, 0.9 * s, 3.2 * s, 1.1 * s));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + rnd(); g.add(cyl(0x7a6048, Math.cos(a) * 2.6 * s, 1.9 * s, Math.sin(a) * 2.6 * s, 0.07 * s, 3.8 * s)); }
  for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, d = rnd() * 2.4 * s; g.add(ball(i % 2 ? 0x3f7a45 : 0x4f8a4e, Math.cos(a) * d, (4.4 + rnd()) * s, Math.sin(a) * d, (2.6 + rnd()) * s, 1.5 * s, (2.4 + rnd()) * s)); }
  g.rotation.y = rnd() * 6; return g;
}
/** Bụi tre: nhiều thân cao mảnh, ngọn nghiêng. */
export function bamboo(rnd: () => number, s = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, d = rnd() * 0.6 * s, h = (6 + rnd() * 3) * s, t = cyl(0x7f9a4a, Math.cos(a) * d, h / 2, Math.sin(a) * d, 0.08 * s, h); t.rotation.z = (rnd() - 0.5) * 0.24; g.add(t); }
  g.add(ball(0x6f9a4a, 0, 6.6 * s, 0, 1.8 * s, 1.8 * s, 1.6 * s), ball(0x5f8a3e, 0.8 * s, 7.6 * s, 0.4, 1.3 * s, 1.4 * s, 1.2 * s));
  return g;
}
/** Bia đá trên lưng rùa (Văn Miếu). Rùa quay về +z. */
export function turtleStele(c = 0x8f8a7c): THREE.Group {
  return grp(0, 0, 0, 0, ball(c, 0, 0.32, 0, 0.62, 0.32, 0.9), ball(c, 0, 0.3, 0.95, 0.22, 0.18, 0.28), box(c, 0, 1.25, -0.05, 0.9, 1.5, 0.16), ball(c, 0, 2.0, -0.05, 0.46, 0.26, 0.09), box(0x6f6a5e, 0, 1.2, 0.04, 0.7, 1.0, 0.02));
}
/** Thuyền nan chở khách (đò Tràng An, đò Tam Cốc): lòng thuyền đi được nên không cần. */
export function sampan(c = 0x6b4a2a, rower = true, i = 0): THREE.Group {
  const g = grp(0, 0, 0, 0, box(c, 0, 0.25, 0, 1.4, 0.5, 6), cone(c, 0, 0.25, 3.4, 0.7, 1.2).rotateX(Math.PI / 2), cone(c, 0, 0.25, -3.4, 0.7, 1.2).rotateX(-Math.PI / 2), box(0x8a6a42, 0, 0.52, 0, 1.2, 0.06, 5.4));
  if (rower) { g.add(cyl(i % 2 ? 0x3a6f9a : 0x9a3a2a, 0, 1.05, -2.4, 0.22, 0.9), ball(0xf2c69c, 0, 1.68, -2.4, 0.2), cone(0xf3e2ae, 0, 1.92, -2.4, 0.46, 0.26), cyl(0x8a6a42, 0.5, 0.9, -2.1, 0.04, 2.4).rotateX(0.6)); }
  return g;
}
export { V };
