// Thánh địa Mỹ Sơn buổi sớm có sương. Trục x: tây → đông; trục z: bắc → nam.
// Khách vào từ phía bắc, qua cầu suối Khe Thẻ, theo lối rừng tới nhóm tháp B–C–D ở giữa thung lũng, sang nhóm A phía đông (chỉ còn nền),
// rồi vòng về nhà múa. Núi Răng Mèo (Mahaparvata) đứng ở phía nam.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, mountain, palm, person, rock, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const BRICK = 0xb4593c, BRICK2 = 0x9c4a32, BRICK3 = 0xc46a48, MOSS = 0x6f7a48, SAND = 0xbcae90, DARK = 0x3a2420;
/** Tháp chính (kalan): thân vuông có trụ ốp, cửa giả ba mặt, tiền sảnh quay về đông (+x), ba tầng mái thu nhỏ dần có tháp góc. */
export function kalan(size: number, r: () => number, ruined = 0): THREE.Group {
  const g = new THREE.Group(), s = size, h = s * 1.25;
  g.add(box(BRICK2, 0, s * 0.12, 0, s * 1.22, s * 0.24, s * 1.22), box(BRICK, 0, s * 0.24 + h / 2, 0, s, h, s));
  for (const a of [0, 1, 2, 3]) {
    const d = grp(0, 0, 0, a * Math.PI / 2);
    for (const k of [-0.38, -0.19, 0.19, 0.38]) d.add(box(BRICK3, s * 0.51, s * 0.24 + h / 2, s * k, s * 0.06, h * 0.96, s * 0.09));
    if (a !== 0) d.add(box(BRICK2, s * 0.54, s * 0.24 + h * 0.36, 0, s * 0.1, h * 0.62, s * 0.3), box(DARK, s * 0.57, s * 0.24 + h * 0.32, 0, s * 0.06, h * 0.46, s * 0.16), gable(BRICK2, s * 0.54, s * 0.24 + h * 0.67, 0, s * 0.34, s * 0.22, s * 0.12, Math.PI / 2));
    g.add(d);
  }
  // tiền sảnh phía đông
  g.add(box(BRICK, s * 0.72, s * 0.24 + h * 0.3, 0, s * 0.5, h * 0.6, s * 0.52), box(DARK, s * 0.98, s * 0.24 + h * 0.24, 0, s * 0.06, h * 0.42, s * 0.24), gable(BRICK2, s * 0.72, s * 0.24 + h * 0.6, 0, s * 0.6, s * 0.3, s * 0.56, Math.PI / 2), box(SAND, s * 1.02, s * 0.1, 0, s * 0.3, s * 0.2, s * 0.4));
  let y = s * 0.24 + h;
  for (let t = 0; t < 3 - ruined; t++) {
    const k = [0.86, 0.64, 0.44][t], th = s * [0.42, 0.34, 0.28][t];
    g.add(box(BRICK2, 0, y + s * 0.04, 0, s * (k + 0.12), s * 0.08, s * (k + 0.12)), box(t % 2 ? BRICK : BRICK3, 0, y + s * 0.08 + th / 2, 0, s * k, th, s * k));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(BRICK2, sx * s * k * 0.5, y + s * 0.2, sz * s * k * 0.5, s * 0.13, s * 0.3, s * 0.13), cone(BRICK2, sx * s * k * 0.5, y + s * 0.44, sz * s * k * 0.5, s * 0.09, s * 0.2));
    y += s * 0.08 + th;
  }
  if (!ruined) g.add(cone(SAND, 0, y + s * 0.22, 0, s * 0.16, s * 0.44), box(SAND, 0, y + s * 0.03, 0, s * 0.3, s * 0.06, s * 0.3));
  for (let i = 0; i < 9; i++) g.add(bead(MOSS, (r() - 0.5) * s, s * 0.3 + r() * (y - s * 0.3), (r() < 0.5 ? -1 : 1) * s * 0.5, s * (0.07 + r() * 0.08), s * 0.05, s * 0.1));
  for (let i = 0; i < 5; i++) g.add(bead(0x6aa052, (r() - 0.5) * s * 0.8, y * (0.5 + r() * 0.5), (r() - 0.5) * s * 0.8, s * 0.12));
  return g;
}
/** Nhà dài (mandapa) không mái: tường gạch có cửa sổ chấn song. Dài theo x. */
function longHall(len: number, w: number, h: number, r: () => number): THREE.Group {
  const g = new THREE.Group(); g.add(box(BRICK2, 0, 0.2, 0, len + 0.6, 0.4, w + 0.6));
  for (const sz of [-1, 1]) { g.add(box(BRICK, 0, 0.4 + h / 2, sz * w / 2, len, h, 0.6)); for (let i = 0; i < 3; i++) g.add(box(DARK, -len / 3 + i * len / 3, 0.4 + h * 0.55, sz * (w / 2 + 0.02), len * 0.14, h * 0.4, 0.66), box(SAND, -len / 3 + i * len / 3, 0.4 + h * 0.55, sz * (w / 2 + 0.06), 0.14, h * 0.4, 0.7)); }
  for (const sx of [-1, 1]) g.add(box(BRICK, sx * len / 2, 0.4 + h / 2, 0, 0.6, h, w), box(DARK, sx * (len / 2 + 0.02), 0.4 + h * 0.4, 0, 0.66, h * 0.8, w * 0.3));
  for (let i = 0; i < 6; i++) g.add(bead(MOSS, (r() - 0.5) * len, 0.4 + h, (r() < 0.5 ? -1 : 1) * w / 2, 0.5, 0.2, 0.4));
  return g;
}
/** Tháp kho (kosagrha, như B5): thân chữ nhật, mái cong hình thuyền/yên ngựa hai đầu vểnh. */
function boatTower(r: () => number): THREE.Group {
  const g = new THREE.Group(); g.add(box(BRICK2, 0, 0.3, 0, 7.4, 0.6, 4.6), box(BRICK, 0, 3.1, 0, 6.6, 5, 3.8));
  for (const k of [-2.4, -0.8, 0.8, 2.4]) for (const sz of [-1, 1]) g.add(box(BRICK3, k, 3.1, sz * 1.94, 0.5, 4.8, 0.16));
  for (const sz of [-1, 1]) g.add(box(DARK, 0, 2.4, sz * 2.0, 1.0, 2.6, 0.12));
  g.add(box(BRICK2, 0, 5.75, 0, 7.0, 0.3, 4.2));
  for (let i = 0; i < 9; i++) { const t = (i - 4) / 4, y = 6.4 + t * t * 1.5, w = 3.7 - Math.abs(t) * 0.9; g.add(box(i % 2 ? BRICK : BRICK3, t * 3.3, y, 0, 0.84, 1.3 - Math.abs(t) * 0.2, w), cyl(BRICK2, t * 3.3, y + 0.55, 0, w * 0.5, 0.84).rotateZ(Math.PI / 2)); }
  for (let i = 0; i < 5; i++) g.add(bead(MOSS, (r() - 0.5) * 6, 6 + r(), (r() - 0.5) * 3, 0.5, 0.2, 0.5));
  return g;
}
function lingaYoni(): THREE.Group { return grp(0, 0, 0, 0, box(SAND, 0, 0.35, 0, 2.6, 0.7, 2.6), box(0xa89a7c, 0, 0.82, 0, 2.2, 0.26, 2.2), box(0xa89a7c, 0, 0.82, 1.5, 0.5, 0.2, 0.9), cyl(0x9a8c70, 0, 1.0, 0, 0.9, 0.16), cyl(0xc9bca0, 0, 1.5, 0, 0.42, 0.9), ball(0xc9bca0, 0, 1.95, 0, 0.42, 0.36, 0.42)); }

export function mySon(kit: Kit, _s: Sight): SightSet {
  const r = kit.r, G = 0x86b060;
  kit.ground(G, 900);
  // núi bao quanh thung lũng; Răng Mèo ở phía nam có đỉnh nhọn lệch như chiếc răng
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28, d = 230 + r() * 60; if (Math.abs(a - Math.PI / 2) < 0.35) continue; kit.add(mountain(i % 2 ? 0x5d8f6a : 0x6a9c70, Math.cos(a) * d, Math.sin(a) * d, 90 + r() * 50, 70 + r() * 60, r)); }
  kit.add(mountain(0x4f8362, 10, 300, 130, 150, r), cone(0x457858, 26, 150, 292, 30, 90), cone(0x4f8362, -8, 128, 300, 26, 60));
  // suối Khe Thẻ chảy tây → đông ở phía bắc, một nhánh chảy xuống giữa nhóm BCD và nhóm A
  kit.add(box(0x6a8a5a, 0, -0.3, -84, 400, 0.7, 13)); kit.water(0x6fb0b4, 0, -84, 400, 9, 0.06, 0.9);
  kit.add(box(0x6a8a5a, 26, -0.3, 0, 8, 0.7, 170)); kit.water(0x6fb0b4, 26, 0, 5, 170, 0.06, 0.9);
  for (let i = 0; i < 40; i++) kit.add(rock(0x9aa29a, -150 + r() * 300, 0.2, -84 + (r() - 0.5) * 9, 0.5 + r(), 0.4, 0.5 + r(), r() * 3));
  for (let i = 0; i < 20; i++) kit.add(rock(0x9aa29a, 26 + (r() - 0.5) * 5, 0.2, -70 + r() * 150, 0.4 + r() * 0.6, 0.3, 0.5, r() * 3));
  // cổng khu di tích
  kit.add(box(BRICK, -5, 2.5, -124, 2, 5, 2), box(BRICK, 5, 2.5, -124, 2, 5, 2), box(BRICK2, 0, 5.3, -124, 14, 0.7, 2.4), gable(BRICK3, 0, 5.6, -124, 2.6, 1.4, 14.6, Math.PI / 2), box(0xe9d9b0, 14, 2, -126, 10, 4, 6), gable(0x8a4a36, 14, 4, -126, 7, 1.6, 11, Math.PI / 2));
  kit.live(label('Khu di tích Mỹ Sơn', 0, 8.2, -124, '#9c4a32', 1.0));
  // cầu gỗ qua suối
  kit.add(box(0x8a6a48, 0, 0.5, -84, 4.4, 0.24, 15)); for (const s of [-1, 1]) { kit.add(box(0x6b4a2c, s * 2.1, 1.3, -84, 0.14, 0.14, 15)); for (let i = 0; i < 6; i++) kit.add(box(0x6b4a2c, s * 2.1, 0.9, -90.5 + i * 2.6, 0.14, 0.9, 0.14)); }
  kit.add(signPost('Suối Khe Thẻ', 4.5, 0, -93, '#2d6f73', 0.9));

  // ---- nhóm B, C, D: hai tháp chính B1 (chỉ còn nền đá) và C1 quay mặt về đông; D1, D2 là hai nhà dài phía đông
  kit.add(box(0x9c8f72, -8, 0.06, 6, 52, 0.12, 44));
  const c1 = kalan(7.5, r); c1.position.set(-18, 0, -6); kit.add(c1);
  kit.add(box(SAND, -18, 0.6, 12, 9, 1.2, 9), box(0xa89a7c, -18, 1.3, 12, 7.6, 0.3, 7.6)); const ly = lingaYoni(); ly.position.set(-18, 1.4, 12); kit.add(ly);
  const b5 = boatTower(r); b5.position.set(-5, 0, 22); kit.add(b5);
  const b3 = kalan(4.6, r); b3.position.set(-24, 0, 24); kit.add(b3);
  const b4 = kalan(3.6, r, 1); b4.position.set(-27, 0, 5); kit.add(b4);
  const c2 = kalan(3.4, r, 1); c2.position.set(-8, 0, -16); kit.add(c2);
  const d1 = longHall(15, 5.5, 3.6, r); d1.position.set(8, 0, 12); kit.add(d1);
  const d2 = longHall(15, 5.5, 3.6, r); d2.position.set(8, 0, -6); kit.add(d2);
  const gate = kalan(3.2, r, 2); gate.position.set(-5, 0, 3); kit.add(gate);
  for (let i = 0; i < 7; i++) { kit.add(box(SAND, 2 + i * 1.6, 0.5, 4 + (i % 2) * 0.6, 0.5, 1.0 + (i % 3) * 0.3, 0.5), box(0xa89a7c, -30 + r() * 44, 0.25, -22 + r() * 50, 1 + r(), 0.5, 0.7)); }
  kit.live(label('Tháp C1', -18, 17.5, -6, '#9c4a32', 0.8), label('Tháp B5', -5, 10.5, 22, '#9c4a32', 0.7), label('Nền tháp B1', -18, 5.2, 12, '#7a6a4a', 0.7));

  // ---- nhóm A: tháp A1 đã sập, chỉ còn nền, gạch vỡ và hố bom phủ cỏ
  kit.add(box(BRICK2, 52, 0.7, 30, 13, 1.4, 13), box(BRICK, 52, 1.8, 30, 10.6, 0.9, 10.6));
  for (const [x, z, h] of [[47.5, 25.5, 3.6], [56.5, 25.5, 2.2], [47.5, 34.5, 1.6], [56.5, 34.5, 4.4], [52, 25.3, 1.3]] as const) kit.add(box(BRICK3, x, 2.2 + h / 2, z, 1.6, h, 1.6), bead(MOSS, x, 2.3 + h, z, 0.8, 0.3, 0.8));
  for (let i = 0; i < 46; i++) kit.add(box(i % 3 ? BRICK : BRICK2, 52 + (r() - 0.5) * 22, 0.2 + r() * 2.2 * (r() < 0.4 ? 1 : 0.2), 30 + (r() - 0.5) * 22, 0.5 + r() * 1.2, 0.3 + r() * 0.5, 0.4 + r(), r() * 3));
  kit.add(lingaYoni().translateX(52).translateY(2.2).translateZ(30));
  for (const [x, z, s] of [[40, 44, 5], [64, 16, 4]] as const) { kit.add(cyl(0x5f8a4a, x, 0.04, z, s, 0.1), cyl(0x4f7a40, x, 0.07, z, s * 0.66, 0.1), cyl(0x46703a, x, 0.1, z, s * 0.34, 0.1)); for (let i = 0; i < 8; i++) kit.add(bead(0x7fae5a, x + Math.cos(i * 0.8) * s, 0.2, z + Math.sin(i * 0.8) * s, 1.0, 0.4, 1.0)); }
  kit.add(signPost('Hố bom', 43, 0, 39, '#5a4a34', 0.8)); kit.live(label('Nền tháp A1', 52, 8.2, 30, '#9c4a32', 0.8));
  const a10 = kalan(3.4, r, 2); a10.position.set(62, 0, 40); kit.add(a10);

  // ---- nhà biểu diễn múa Chăm: nhà sàn mái lá, sân khấu thấp, vũ nữ Apsara
  const nm = grp(64, 0, -40);
  nm.add(box(0x8a6a48, 0, 0.5, 0, 16, 1, 10), gable(0xb9a36a, 0, 5.4, 0, 14, 3.2, 19, Math.PI / 2), box(BRICK, 0, 3, -4.6, 15, 4.4, 0.4), box(0xd9a83a, 0, 3.4, -4.3, 5, 2.6, 0.1));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) nm.add(cyl(0x6b4a2c, sx * 7.4, 3.2, sz * 4.4, 0.2, 4.6));
  for (let i = 0; i < 4; i++) { const d = person(i, 0, [0xd9a83a, 0xe2573c][i % 2]); d.position.set(-4.5 + i * 3, 1, -1); d.add(cone(0xd9a83a, 0, 2.05, 0, 0.16, 0.5)); nm.add(d); }
  for (let i = 0; i < 8; i++) nm.add(box(0x6b4a2c, -6 + (i % 4) * 4, 0.3, 8 + Math.floor(i / 4) * 2.4, 3, 0.2, 0.6));
  kit.add(nm); kit.live(label('Nhà biểu diễn múa Chăm', 64, 10.6, -40, '#9c4a32', 0.8));

  // ---- rừng quanh lối đi
  const path = [V(0, 0, -138), V(0, 0, -124), V(0, 0, -92), V(0, 0.62, -90), V(0, 0.62, -78), V(0, 0, -76), V(-4, 0, -54), V(6, 0, -34), V(8, 0, -20), V(-3, 0, 3), V(-9, 0, 12), V(4, 0, 24), V(22, 0, 26), V(24, 0.5, 28), V(28, 0.5, 28), V(30, 0, 28), V(42, 0, 31), V(46, 0, 14), V(50, 0, -10), V(64, 0, -30)];
  kit.pave(0xc9b08a, path, 4.6);
  kit.add(box(0x8a6a48, 26, 0.38, 28, 7, 0.22, 4.4));
  const clear = (x: number, z: number) => path.some((p) => Math.hypot(p.x - x, p.z - z) < 7) || (Math.abs(x + 8) < 30 && Math.abs(z - 6) < 26) || (Math.abs(x - 52) < 16 && Math.abs(z - 30) < 16) || (Math.abs(x - 64) < 12 && Math.abs(z + 36) < 12) || Math.abs(z + 84) < 8;
  for (let i = 0; i < 260; i++) { const x = -130 + r() * 260, z = -150 + r() * 260; if (clear(x, z)) continue; const t = r() < 0.15 ? palm(r, 6 + r() * 3) : tree(r, 1.1 + r() * 1.3, r() < 0.7); t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 120; i++) { const x = -90 + r() * 180, z = -130 + r() * 200; if (!clear(x, z)) kit.add(bead(r() < 0.5 ? 0x5a9a4a : 0x79b860, x, 0.4, z, 1 + r(), 0.7, 1 + r())); }
  kit.motes(60, 0xfff4c8, 0.5, () => V(-40 + r() * 100, 1 + r() * 8, -60 + r() * 100), (p, i, t) => { p.y += Math.sin(t * 0.5 + i) * 0.003; p.x += Math.cos(t * 0.3 + i) * 0.004; });
  return {
    path, half: 2.1, npcs: 9,
    stops: [
      { id: 'cong', at: V(0, 0, -131), look: V(0, 5, -124) },
      { id: 'suoi', at: V(0, 0.62, -86), look: V(30, 0, -84) },
      { id: 'nhom_bcd', at: V(7, 0, -26), look: V(-14, 8, -4) },
      { id: 'linga', at: V(-8.4, 0, 11), look: V(-18, 2, 12) },
      { id: 'nhom_a', at: V(40, 0, 30.4), look: V(52, 2.5, 30) },
      { id: 'nha_mua', at: V(62, 0, -32), look: V(64, 3, -40) },
    ],
    sky: [0x8fc4ea, 0xf4f1dc], fog: [0xdfe9d8, 50, 330],
    light: { ambient: 1.55, sun: 1.5, sunColor: 0xfff0cf, sunDir: [0.7, 0.8, -0.3] },
  };
}
