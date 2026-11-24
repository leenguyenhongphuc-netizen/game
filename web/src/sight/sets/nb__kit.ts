// Hình khối dùng chung cho các cảnh Nam Bộ: kênh rạch, dừa, nhà sàn ven sông, ghe xuồng, chùa Khmer, nhà thờ gạch,
// tràm, đước, tua-bin gió, sếu đầu đỏ, cáp treo, tượng lớn. Mỗi địa danh (nb_*.ts) ghép các khối này theo ảnh thật.
import * as THREE from 'three';
import { Kit, V, ball, bead, boat, box, cone, cyl, gable, glow, grp, hip, palm, person } from '../SightKit.ts';
import { baked, nipa } from './_extra.ts';

export const MEKONG = 0x8c8a5c, MEKONG_DEEP = 0x6f7048, GRASS = 0x7fb35a, GRASS2 = 0x6aa04c, MUD = 0x8a7350, DIRT = 0xc8ab7a;

/** Một mảng đất bằng (mặt trên y = top) từ (x0,z0) tới (x1,z1); kèm vài mảng cỏ đậm cho đỡ trơn. Không phủ lên sông. */
export function land(kit: Kit, x0: number, z0: number, x1: number, z1: number, c = GRASS, top = 0, patches = true): void {
  kit.add(box(c, (x0 + x1) / 2, top - 0.5, (z0 + z1) / 2, x1 - x0, 1, z1 - z0));
  if (!patches) return; const r = kit.r, n = Math.min(30, Math.round(((x1 - x0) * (z1 - z0)) / 2500));
  for (let i = 0; i < n; i++) { const w = 6 + r() * 20, d = 5 + r() * 16; kit.add(box(i % 2 ? GRASS2 : 0x8fc265, x0 + w / 2 + r() * (x1 - x0 - w), top + 0.005, z0 + d / 2 + r() * (z1 - z0 - d), w, 0.01, d)); }
}
/** Sông/kênh nằm ngang theo trục x ở z, rộng w (lòng sông hạ thấp để lưới đi bộ tự dừng ở bờ). */
export function river(kit: Kit, z: number, w: number, x0 = -450, x1 = 450, c = MEKONG): void {
  const cx = (x0 + x1) / 2, len = x1 - x0;
  kit.add(box(MEKONG_DEEP, cx, -2.2, z, len, 1, w)); // đáy
  kit.add(box(MUD, cx, -0.55, z - w / 2 - 0.6, len, 1.1, 1.6), box(MUD, cx, -0.55, z + w / 2 + 0.6, len, 1.1, 1.6)); // bờ đất
  kit.water(c, cx, z, len, w, -0.6, 0.94);
}
/** Kênh nằm dọc trục z ở x. */
export function riverZ(kit: Kit, x: number, w: number, z0: number, z1: number, c = MEKONG): void {
  const cz = (z0 + z1) / 2, len = z1 - z0;
  kit.add(box(MEKONG_DEEP, x, -2.2, cz, w, 1, len), box(MUD, x - w / 2 - 0.6, -0.55, cz, 1.6, 1.1, len), box(MUD, x + w / 2 + 0.6, -0.55, cz, 1.6, 1.1, len));
  kit.water(c, x, cz, w, len, -0.6, 0.94);
}
/** Dải dừa nước + dừa xiêm dọc bờ (x từ a tới b, ở z). */
export function bankGreen(kit: Kit, a: number, b: number, z: number, nipaOnly = false): void {
  const r = kit.r;
  for (let x = a; x < b; x += 3 + r() * 3) {
    const n = nipa(r, 4 + r() * 2.5); n.position.set(x, -0.5, z + (r() - 0.5) * 1.5); kit.add(n);
    if (!nipaOnly && r() < 0.45) { const p = coconut(r, 7 + r() * 4); p.position.set(x + 1, 0, z + (z > 0 ? 2.5 : -2.5) + r() * 2); kit.add(p); }
  }
}
/** Dừa xiêm: thân cong, buồng trái xanh dưới tán. */
export function coconut(r: () => number, h = 8): THREE.Group {
  const g = palm(r, h); const lean = (r() - 0.5) * 0.3; g.rotation.z = lean;
  for (let i = 0; i < 5; i++) { const a = i * 1.26; g.add(bead(0x6f9a3a, Math.cos(a) * 0.32, h - 0.6, Math.sin(a) * 0.32, 0.2)); }
  return g;
}
/** Nhà sàn ven sông Nam Bộ: cột gỗ, vách ván, mái tôn/lá, hiên ra nước. face: hướng mặt tiền (radian). */
export function stiltHouse(r: () => number, face = 0, w = 7, d = 6): THREE.Group {
  const wall = [0xd9c08a, 0xc9a26a, 0x9fc7c0, 0xe8d6b0][Math.floor(r() * 4)], roof = r() < 0.5 ? 0x9a5a3a : 0x8a9aa0;
  const g = grp(0, 0, 0, face);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) g.add(cyl(0x5a4330, sx * (w / 2 - 0.3), 0.6, sz * (d / 2 - 0.3), 0.12, 2.2));
  g.add(box(0x8a6a48, 0, 1.6, 0, w, 0.2, d), box(wall, 0, 2.9, -0.4, w - 0.4, 2.4, d - 1.4), gable(roof, 0, 4.1, -0.2, d + 0.6, 1.5, w + 0.8, Math.PI / 2));
  g.add(box(0x4a3020, -w / 5, 2.6, d / 2 - 1.08, 1.2, 1.9, 0.08), box(0x6a8aa0, w / 4, 3, d / 2 - 1.08, 1.4, 0.9, 0.08), box(0x8a6a48, 0, 1.75, d / 2 - 0.4, w, 0.1, 1.2));
  for (let i = 0; i < 5; i++) g.add(cyl(0x6a5038, -w / 2 + 0.6 + i * (w - 1.2) / 4, 2.25, d / 2 + 0.1, 0.04, 1.1)); // lan can hiên
  g.add(box(0x6a5038, 0, 2.8, d / 2 + 0.1, w, 0.06, 0.06));
  return g;
}
/** Xuồng ba lá có người chèo đội nón lá. */
export function rowBoat(i: number, hull = 0x6a5038, rower = true): THREE.Group {
  const g = boat(hull, 5.2); g.scale.set(0.9, 1, 1);
  if (rower) { const p = person(i, 1, [0xf3ead2, 0x3f6f8f, 0x8a4a6a][i % 3]); p.position.set(0, 0.2, 1.4); p.scale.setScalar(0.92); g.add(p, cyl(0x8a6a48, 0.5, 1.1, 1.1, 0.03, 2.6).rotateX(0.7)); }
  return g;
}
/** Ghe hàng chợ nổi: thân lớn, mui ván, cây bẹo treo hàng. goods: màu trái cây. */
export function marketBoat(r: () => number, goods: number[], len = 12): THREE.Group {
  const hull = [0x2f5f7a, 0x6a3a2a, 0x3a6a4a][Math.floor(r() * 3)];
  const g = grp(0, 0, 0, 0, ball(hull, 0, 0.2, 0, 1.6, 0.7, len / 2), box(0x9a7150, 0, 0.75, 0, 2.6, 0.12, len * 0.7), box(0xd2301e, 0, 0.6, -len / 2 + 0.6, 1.2, 0.3, 0.3));
  g.add(box(0x7a5a3c, 0, 1.7, len * 0.18, 2.4, 1.8, len * 0.3), gable(0x5a6a70, 0, 2.6, len * 0.18, 2.8, 0.8, len * 0.34)); // mui
  for (let i = 0; i < 14; i++) g.add(bead(goods[i % goods.length], (r() - 0.5) * 2, 1 + r() * 0.5, -len * 0.3 + r() * len * 0.35, 0.35 + r() * 0.2));
  // cây bẹo: sào cao treo mẫu hàng
  g.add(cyl(0x8a6a48, 0.4, 4.4, -len * 0.25, 0.06, 7));
  for (let k = 0; k < 4; k++) g.add(bead(goods[k % goods.length], 0.4, 7.4 - k * 0.55, -len * 0.25, 0.32));
  // mắt ghe hai bên mũi
  for (const s of [-1, 1]) g.add(bead(0xffffff, s * 1.45, 0.55, -len / 2 + 1.2, 0.2, 0.14, 0.05), bead(0x111111, s * 1.5, 0.55, -len / 2 + 1.2, 0.1, 0.09, 0.03));
  return g;
}
/** Chùa Khmer: nền cao có lan can, thân vàng nghệ, mái nhiều tầng dốc đứng ngói đỏ cam viền vàng, chóp đuôi rắn Naga. */
export function khmerTemple(w = 14, d = 24, h = 6): THREE.Group {
  const wall = 0xf2c64a, roof = 0xd9551e, roof2 = 0xb83a1c, gold = 0xffd24a, base = 0xe8e0d0;
  const g = new THREE.Group();
  g.add(box(base, 0, 0.6, 0, w + 4, 1.2, d + 4), box(0xd9cfbd, 0, 1.25, 0, w + 4.4, 0.1, d + 4.4));
  for (let i = 0; i < 4; i++) g.add(box(base, 0, 0.15 + i * 0.3, d / 2 + 2.4 + (3 - i) * 0.45, 4, 0.3, 0.45)); // bậc lên
  g.add(box(wall, 0, 1.2 + h / 2, 0, w, h, d));
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) g.add(cyl(0xffe8a0, s * (w / 2 + 0.6), 1.2 + h / 2, -d / 2 + 2 + i * (d - 4) / 5, 0.3, h), box(0x8a5a2a, s * (w / 2 + 0.02), 1.2 + h * 0.45, -d / 2 + 2 + i * (d - 4) / 5, 0.06, h * 0.5, 1.1));
  // mái ba tầng chồng nhau, càng lên càng hẹp
  const top = 1.2 + h;
  g.add(gable(roof, 0, top, 0, w + 2.4, 2.4, d + 1.4), gable(roof2, 0, top + 1.6, 0, w * 0.7, 3.2, d * 0.84), gable(roof, 0, top + 3.6, 0, w * 0.42, 3.2, d * 0.6));
  g.add(box(gold, 0, top + 6.8, 0, 0.16, 0.16, d * 0.6)); // nóc vàng
  // đầu đốc hình Naga uốn cong ở các góc mái
  for (const sz of [-1, 1]) for (const lv of [0, 1, 2]) { const yy = top + [0.4, 2.1, 4.0][lv], ww = [w + 2.4, w * 0.7, w * 0.42][lv] / 2, dd = [d + 1.4, d * 0.84, d * 0.6][lv] / 2; for (const sx of [-1, 1]) { const n = cone(gold, sx * ww, yy + 0.5, sz * dd, 0.12, 1.4); n.rotation.z = -sx * 0.7; g.add(n); } }
  // trán hồi tam giác mặt tiền vàng chạm
  g.add(box(gold, 0, top + 1.1, d / 2 + 0.72, w * 0.5, 1.6, 0.08), bead(0xd2301e, 0, top + 1.2, d / 2 + 0.78, 0.6, 0.6, 0.05));
  g.add(box(0x7a2a1a, 0, 1.2 + h * 0.36, d / 2 + 0.02, 2.4, h * 0.72, 0.08)); // cửa chính
  return g;
}
/** Tháp nhọn Khmer (tháp đựng tro cốt) cao h. */
export function khmerStupa(h = 7, c = 0xf2e2b0, gold = 0xffd24a): THREE.Group {
  return grp(0, 0, 0, 0, box(c, 0, 0.6, 0, 2.6, 1.2, 2.6), box(c, 0, 1.6, 0, 1.9, 0.8, 1.9), cyl(c, 0, 2.6, 0, 0.8, 1.2), cone(gold, 0, 2.6 + (h - 2.6) / 2 + 0.6, 0, 0.7, h - 2.6));
}
/** Nhà thờ gạch đỏ kiểu Roman–Gothic hai tháp chuông (mặt tiền quay về +z). */
export function brickChurch(s = 1): THREE.Group {
  const R = 0xb5523a, R2 = 0x9a4430, ST = 0xe8e0d0, SL = 0x5a6a78;
  const g = new THREE.Group();
  g.add(box(R, 0, 9 * s, -8 * s, 18 * s, 18 * s, 40 * s), gable(SL, 0, 18 * s, -8 * s, 18.6 * s, 6 * s, 40.6 * s));
  for (const sx of [-1, 1]) {
    const x = sx * 7.5 * s;
    g.add(box(R2, x, 15 * s, 12 * s, 6 * s, 30 * s, 6 * s), box(ST, x, 30.4 * s, 12 * s, 6.4 * s, 0.6 * s, 6.4 * s), box(R2, x, 33 * s, 12 * s, 4.6 * s, 5 * s, 4.6 * s), box(0x2a2a2a, x, 33 * s, 14.32 * s, 1.6 * s, 3 * s, 0.1 * s));
    g.add(cone(SL, x, 41 * s, 12 * s, 3.4 * s, 11 * s), cyl(0xe0d8c8, x, 47 * s, 12 * s, 0.06 * s, 2 * s), box(0xe0d8c8, x, 47.4 * s, 12 * s, 0.8 * s, 0.08 * s, 0.08 * s));
    for (let k = 0; k < 4; k++) g.add(box(ST, x, 4 + k * 6.5 * s, 15.05 * s, 6.2 * s, 0.3 * s, 0.1 * s));
    for (let k = 0; k < 3; k++) g.add(box(0x3a4a5a, x, 7 * s + k * 7 * s, 15.06 * s, 1.4 * s, 3.4 * s, 0.08 * s));
  }
  g.add(box(R, 0, 9 * s, 12 * s, 9 * s, 18 * s, 6 * s), gable(R2, 0, 18 * s, 12 * s, 9 * s, 4 * s, 6.2 * s, Math.PI / 2));
  g.add(box(0x3a2a20, 0, 3.4 * s, 15.06 * s, 3 * s, 6.8 * s, 0.1 * s), cyl(0x9fc3e0, 0, 12 * s, 15.06 * s, 2.2 * s, 0.1 * s).rotateX(Math.PI / 2), box(ST, 0, 15.6 * s, 15.06 * s, 8 * s, 0.4 * s, 0.1 * s));
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) g.add(box(0x3a4a5a, sx * 9.06 * s, 9 * s, -24 * s + i * 6 * s, 0.1 * s, 6 * s, 1.8 * s));
  return g;
}
/** Cây tràm: thân mảnh vỏ trắng xám, tán hẹp xanh xám. */
export function cajuput(r: () => number, h = 9): THREE.Group {
  return grp(0, 0, 0, 0, cyl(0xd8d2c4, 0, h * 0.42, 0, 0.13, h * 0.84), bead([0x5f8a52, 0x6a9a5a, 0x557d4a][Math.floor(r() * 3)], 0, h * 0.8, 0, 1.2 + r() * 0.5, h * 0.28, 1.2 + r() * 0.5), bead(0x6f9e5e, 0.4, h * 0.62, 0.2, 0.8, h * 0.16, 0.8));
}
/** Cây đước: rễ chống toả xuống bùn, tán tròn xanh đậm. */
export function mangrove(r: () => number, h = 7): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0x5a4a3a, 0, h * 0.5, 0, 0.16, h * 0.6), bead([0x2f6a3a, 0x3a7a42][Math.floor(r() * 2)], 0, h * 0.85, 0, 2.2 + r(), h * 0.3, 2.2 + r()));
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + r() * 0.3, root = cyl(0x6a5a46, Math.cos(a) * 0.6, h * 0.16, Math.sin(a) * 0.6, 0.05, h * 0.4); root.rotation.z = Math.cos(a) * 0.6; root.rotation.x = -Math.sin(a) * 0.6; g.add(root); }
  return g;
}
/** Cây cổ thụ tán rộng (cây dầu, cây sao) có rễ lồi. */
export function bigTree(r: () => number, h = 16): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0x6a5a48, 0, h * 0.4, 0, 0.7, h * 0.8));
  for (let i = 0; i < 5; i++) { const a = i * 1.25 + r() * 0.4; g.add(box(0x6a5a48, Math.cos(a) * 1.1, 0.35, Math.sin(a) * 1.1, 2, 0.7, 0.35, -a)); }
  for (let i = 0; i < 4; i++) g.add(bead([0x3f7a42, 0x4f8a4a, 0x356e3c][i % 3], (r() - 0.5) * 5, h * 0.82 + r() * 2, (r() - 0.5) * 5, 3.6 + r() * 1.5, 2.4, 3.6 + r() * 1.5));
  return g;
}
/** Tua-bin gió: trụ trắng, vỏ máy, ba cánh quay (cánh trả về để quay trong tick). */
export function turbine(h = 32): { base: THREE.Group; rotor: THREE.Group } {
  const base = grp(0, 0, 0, 0, cyl(0xeef0f2, 0, h / 2, 0, 0.9, h, 0.9), cyl(0xc8ccd0, 0, 0.6, 0, 1.6, 1.2), box(0xeef0f2, 0, h + 0.6, -0.6, 1.4, 1.4, 3.6));
  const rotor = grp(0, h + 0.6, 1.3); rotor.add(ball(0xeef0f2, 0, 0, 0, 0.6, 0.6, 0.9));
  for (let i = 0; i < 3; i++) { const bl = grp(0, 0, 0); bl.rotation.z = i * 2.094; bl.add(box(0xf6f7f8, 0, 8, 0, 0.9, 16, 0.18), box(0xd8281e, 0, 15.4, 0.02, 0.86, 0.8, 0.18)); rotor.add(bl); }
  return { base, rotor };
}
/** Sếu đầu đỏ: thân xám tro, cổ dài, đầu đỏ. */
export function sarus(): THREE.Group {
  return grp(0, 0, 0, 0, cyl(0x8a6a5a, -0.1, 0.5, 0, 0.025, 1), cyl(0x8a6a5a, 0.1, 0.5, 0, 0.025, 1), ball(0x9aa0a8, 0, 1.2, 0, 0.32, 0.36, 0.6), cyl(0xb8bcc2, 0, 1.75, -0.36, 0.06, 0.9).rotateX(0.25), ball(0xd8382a, 0, 2.2, -0.48, 0.12, 0.12, 0.14), cone(0x5a5a5a, 0, 2.2, -0.7, 0.04, 0.3).rotateX(-Math.PI / 2));
}
/** Cò trắng đậu (nhỏ). */
export function egretPerch(): THREE.Group { return grp(0, 0, 0, 0, ball(0xffffff, 0, 0.25, 0, 0.16, 0.2, 0.32), cyl(0xffffff, 0, 0.55, -0.2, 0.04, 0.4).rotateX(0.4), ball(0xffffff, 0, 0.78, -0.3, 0.08), cone(0xf2b020, 0, 0.78, -0.46, 0.025, 0.2).rotateX(-Math.PI / 2)); }
/** Đèn lồng giấy đỏ treo (phát sáng nhẹ). */
export function redLantern(x: number, y: number, z: number, s = 1): THREE.Group { return grp(x, y, z, 0, ball(glow(0xff4a2a), 0, 0, 0, 0.35 * s, 0.42 * s, 0.35 * s), cyl(0xffd24a, 0, 0.46 * s, 0, 0.18 * s, 0.1 * s), cyl(0xffd24a, 0, -0.46 * s, 0, 0.18 * s, 0.1 * s)); }
/** Hàng rào sắt sơn xanh thấp (dinh thự, công viên). */
export function railing(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, c = 0x2f5a4a, h = 1.1): void {
  const d = b.clone().sub(a), len = d.length(), ry = Math.atan2(d.x, d.z), n = Math.max(2, Math.round(len / 0.5));
  const mid = a.clone().lerp(b, 0.5);
  kit.add(box(c, mid.x, a.y + h, mid.z, 0.08, 0.08, len, ry), box(c, mid.x, a.y + 0.15, mid.z, 0.08, 0.08, len, ry));
  for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); kit.add(box(c, p.x, a.y + h / 2, p.z, 0.04, h, 0.04)); }
}
/** Cáp treo: dãy trụ thép từ a lên b và các cabin chạy theo cáp (cabin động). */
export function cableway(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, towers = 5, cabins = 8, color = 0xd8281e): void {
  const d = b.clone().sub(a);
  for (let i = 1; i < towers; i++) { const p = a.clone().lerp(b, i / towers); const th = 10; kit.add(cyl(0x8a8f96, p.x, p.y + th / 2 - 4, p.z, 0.4, th + 8), box(0x8a8f96, p.x, p.y + th + 0.2, p.z, 4, 0.4, 0.6, Math.atan2(d.x, d.z) + Math.PI / 2)); }
  const lift = V(0, 6.2, 0);
  for (const off of [-1, 1]) { const o = V(Math.cos(Math.atan2(d.x, d.z)) * off * 1.6, 0, -Math.sin(Math.atan2(d.x, d.z)) * off * 1.6); const p0 = a.clone().add(lift).add(o), p1 = b.clone().add(lift).add(o), mid = p0.clone().lerp(p1, 0.5), dd = p1.clone().sub(p0); const c = cyl(0x3a3a3a, mid.x, mid.y, mid.z, 0.04, dd.length()); c.quaternion.setFromUnitVectors(V(0, 1, 0), dd.clone().normalize()); kit.add(c); }
  const cars: THREE.Object3D[] = [];
  for (let i = 0; i < cabins; i++) { const g = baked(grp(0, 0, 0, 0, box(color, 0, -1.4, 0, 1.8, 1.6, 1.8), box(0x9fd0e8, 0, -1.2, 0, 1.86, 0.7, 1.86), box(0x3a3a3a, 0, -0.3, 0, 0.1, 1, 0.1))); kit.live(g); cars.push(g); }
  kit.onTick((t) => { cars.forEach((g, i) => { const up = i % 2 === 0, f = ((t * 0.012 + i / cabins) % 1), k = up ? f : 1 - f; const o = up ? 1.6 : -1.6; const yaw = Math.atan2(d.x, d.z); g.position.copy(a).lerp(b, k).add(lift); g.position.x += Math.cos(yaw) * o; g.position.z -= Math.sin(yaw) * o; g.rotation.y = yaw; }); });
}
/** Mái hiên tôn đơn giản (quán, chợ) — cao đủ để máy quay không chui gầm. */
export function canopy(c: number, w: number, d: number, h = 4.2): THREE.Group {
  const g = grp(0, 0, 0, 0, box(c, 0, h, 0, w, 0.12, d));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0x6a6a6a, sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2), 0.08, h));
  return g;
}
export { hip };
/** Điểm (x, z) có nằm trong khoảng d quanh đường gấp khúc path không (để rải cây, nhà mà không chắn lối). */
export function nearPath(path: THREE.Vector3[], x: number, z: number, d: number): boolean {
  for (let i = 1; i < path.length; i++) { const q = path[i - 1], p = path[i], dx = p.x - q.x, dz = p.z - q.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - q.x) * dx + (z - q.z) * dz) / l2)); if (Math.hypot(q.x + dx * t - x, q.z + dz * t - z) < d) return true; }
  return false;
}
