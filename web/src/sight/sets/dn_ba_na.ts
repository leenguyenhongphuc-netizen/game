// Bà Nà – Cầu Vàng. Trục x: tây → đông; trục z: bắc → nam. Ga cáp treo ở chân núi phía đông nam, cáp kéo lên hướng tây bắc.
// Lên tới nơi là Cầu Vàng (dải cầu cong màu vàng trên hai bàn tay đá), rồi vườn hoa Le Jardin, cuối cùng là Làng Pháp trên đỉnh.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, glow, grp, hip, label, lampPost, forestMountain, rock, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const STONE = 0x8a8f88, STONE2 = 0x767c76, MOSSY = 0x6f8a5a, GOLD = 0xe9b530, H = 70;
/** Bàn tay đá khổng lồ ngửa lên đỡ cầu: cẳng tay, lòng bàn tay, năm ngón cong; loang rêu. Ngón hướng về +z. */
function hand(r: () => number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(STONE2, 0, -14 * s, -3 * s, 3.4 * s, 24 * s, 3 * s).rotateX(0.2), ball(STONE, 0, 0, 0, 5.2 * s, 2.2 * s, 5.6 * s));
  for (let i = 0; i < 4; i++) { const x = (-3.6 + i * 2.4) * s, len = [5.6, 6.6, 6.2, 5][i] * s; g.add(cyl(STONE, x, 1.2 * s, 5.4 * s, 1.0 * s, len).rotateX(1.25), cyl(i % 2 ? STONE2 : STONE, x, 4.2 * s, 9.6 * s, 0.9 * s, len * 0.8).rotateX(0.45), ball(STONE2, x, 6.8 * s, 10.6 * s, 0.9 * s)); }
  g.add(cyl(STONE, -6 * s, 1.0 * s, 0.6 * s, 1.1 * s, 5 * s).rotateZ(1.0).rotateX(0.5), cyl(STONE2, -8.2 * s, 3.4 * s, 2.6 * s, 0.95 * s, 4 * s).rotateX(0.5), ball(STONE2, -8.2 * s, 5.4 * s, 3.6 * s, 0.95 * s));
  for (let i = 0; i < 22; i++) g.add(bead(MOSSY, (r() - 0.5) * 9 * s, (r() - 0.3) * 6 * s, (r() - 0.2) * 10 * s, (0.6 + r()) * s, 0.4 * s, (0.6 + r()) * s));
  return g;
}
export function baNa(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.ground(0x6a9c62, 1400, 0);
  // núi rừng: sườn núi lớn dưới tuyến cáp và đỉnh Bà Nà
  kit.add(forestMountain(0x4f8a5a, -60, -60, 260, H - 30, r, -6), cyl(0x5a9560, -46, H / 2 - 1, -112, 52, H, 62), cyl(0x4f8a5a, -46, H / 2 - 8, -112, 62, H - 14, 72), cyl(0x5a9560, 2, H / 2 - 1, 2, 13, H, 13), forestMountain(0x457f52, 240, -220, 200, 90, r), forestMountain(0x5a9560, -330, 120, 210, 80, r), forestMountain(0x4a8556, 60, -420, 240, 110, r));
  for (let i = 0; i < 240; i++) { const a = r() * 6.28, d = 30 + r() * 230, x = -60 + Math.cos(a) * d, z = -60 + Math.sin(a) * d, y = Math.max(0, (H - 30) * (1 - d / 260)) - 6; if (Math.hypot((x + 46) / 64, (z + 112) / 74) < 1 || Math.hypot(x - 2, z - 2) < 15) continue; const t = tree(r, 1.6 + r() * 1.6, r() < 0.7); t.position.set(x, y, z); kit.add(t); }
  // mây dưới chân
  const clouds: THREE.Mesh[] = [], cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86, depthWrite: false });
  for (let i = 0; i < 26; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cm); const a = r() * 6.28, d = 110 + r() * 140; c.position.set(-80 + Math.cos(a) * d, H - 16 + r() * 12, -80 + Math.sin(a) * d * 0.9); c.scale.set(22 + r() * 24, 5 + r() * 4, 16 + r() * 16); clouds.push(c); kit.live(c); }
  kit.onTick((_t, dt) => clouds.forEach((c, i) => { c.position.x += (0.6 + (i % 4) * 0.2) * dt; if (c.position.x > 220) c.position.x = -380; }));
  // ---- ga cáp treo chân núi
  const A = V(120, 2, 120), B = V(4, H, 4); // hai đầu tuyến cáp
  kit.add(box(0x9a938a, 132, 0.03, 132, 40, 0.1, 40), box(0xf1e3b8, 146, 4, 116, 16, 8, 14), hip(0xa85a3a, 146, 8, 116, 19, 3.4, 17), box(glow(0xffe9a8), 146, 5, 123.06, 8, 2, 0.1), box(0x3a3a3a, 138, 2.4, 119, 0.2, 4.8, 4));
  kit.live(label('Ga cáp treo Bà Nà', 146, 13.6, 116, '#a85a3a', 1.0));
  for (let i = 0; i < 6; i++) { const t = tree(r, 1.3); t.position.set(112 + r() * 46, 0, 146 + r() * 8); kit.add(t); }
  // tuyến cáp: trụ, dây và các cabin
  const dir = B.clone().sub(A), len = dir.length(), yawC = Math.atan2(dir.x, dir.z);
  for (const off of [-3, 3]) { const c = box(0x3a3a3a, (A.x + B.x) / 2, (A.y + B.y) / 2 + 5.4, (A.z + B.z) / 2, 0.14, 0.14, len + 30); c.position.x += Math.cos(yawC) * off; c.position.z -= Math.sin(yawC) * off; c.rotation.order = 'YXZ'; c.rotation.y = yawC; c.rotation.x = -Math.atan2(dir.y, Math.hypot(dir.x, dir.z)); kit.add(c); }
  for (const t of [0.22, 0.5, 0.78]) { const p = A.clone().lerp(B, t); for (const sd of [-1, 1]) kit.add(cyl(0xd8d2c4, p.x + Math.cos(yawC) * 7 * sd, p.y / 2 - 6, p.z - Math.sin(yawC) * 7 * sd, 0.7, p.y + 23)); kit.add(box(0xd8d2c4, p.x, p.y + 5.6, p.z, 15, 0.6, 0.8, yawC)); }
  const cabin = (c: number): THREE.Group => grp(0, 0, 0, yawC, box(c, 0, 1.3, 0, 2.6, 0.3, 3), box(c, 0, 3.5, 0, 2.6, 0.3, 3), box(0xbfe6ff, 0, 2.4, 1.46, 2.4, 1.9, 0.06), box(0xbfe6ff, 0, 2.4, -1.46, 2.4, 1.9, 0.06), box(0x3a3a3a, 0, 4.5, 0, 0.16, 1.8, 0.16), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(c, sx * 1.26, 2.4, sz * 1.44, 0.14, 2.0, 0.14))));
  const cabs: { g: THREE.Group; t: number; side: number }[] = [];
  for (let i = 0; i < 8; i++) { const g = cabin([0xe2573c, 0x4aa3d8, 0xffd23f, 0x7ccf4f][i % 4]); cabs.push({ g, t: i / 8, side: i % 2 ? 1 : -1 }); kit.live(g); }
  // cabin của người chơi: đi theo người chơi trên đoạn cáp (sàn và nóc trong suốt để không che tầm nhìn)
  const mine = grp(0, 0, 0, yawC, box(0xe2573c, 0, -0.1, 0, 2.8, 0.2, 3.4), box(0x3a3a3a, 0, 4.6, 0, 0.16, 1.6, 0.16), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0xe2573c, sx * 1.36, 1.7, sz * 1.66, 0.14, 3.4, 0.14))), box(0xe2573c, 0, 3.5, 0, 2.8, 0.2, 3.4), box(0xe2573c, 1.36, 0.5, 0, 0.1, 1.0, 3.4), box(0xe2573c, -1.36, 0.5, 0, 0.1, 1.0, 3.4));
  kit.live(mine);
  kit.onTick((t, _dt, pl) => {
    for (const c of cabs) { const k = (c.t + t * 0.012 * -c.side + 10) % 1, p = A.clone().lerp(B, k); c.g.position.set(p.x + Math.cos(yawC) * 3 * c.side, p.y - 0.4, p.z - Math.sin(yawC) * 3 * c.side); c.g.rotation.z = Math.sin(t * 0.8 + c.t * 9) * 0.03; }
    const on = pl.pos.y > 2.3 && pl.pos.y < H - 0.3 && pl.pos.x > B.x - 1; mine.visible = on; if (on) { mine.position.copy(pl.pos); mine.rotation.z = Math.sin(t * 1.1) * 0.02; }
  });
  kit.add(box(0x8a8f88, B.x - 2, H - 0.3, B.z - 2, 18, 0.6, 18), box(0xf1e3b8, B.x - 8, H + 3, B.z + 6, 8, 6, 6), hip(0x5a6a7a, B.x - 8, H + 6, B.z + 6, 10, 2.6, 8));
  kit.live(label('Ga Marseille', B.x - 8, H + 10.4, B.z + 6, '#5a6a7a', 0.9));

  // ---- Cầu Vàng: dải cầu cong hình cung, mặt gỗ, lan can vàng, viền hoa tím; hai bàn tay đá đỡ bên dưới
  const CXc = -40, CZc = -8, R = 46, a0 = 0.12, a1 = 1.5, bridgePt = (t: number) => V(CXc + Math.cos(a0 + (a1 - a0) * t) * R, H, CZc - Math.sin(a0 + (a1 - a0) * t) * R);
  const NB = 34; for (let i = 0; i < NB; i++) {
    const p0 = bridgePt(i / NB), p1 = bridgePt((i + 1) / NB), mid = p0.clone().lerp(p1, 0.5), ry = Math.atan2(p1.x - p0.x, p1.z - p0.z), l = p0.distanceTo(p1) * 1.04;
    kit.add(box(0x9a7150, mid.x, H - 0.12, mid.z, 5.4, 0.24, l, ry), box(GOLD, mid.x, H - 0.5, mid.z, 5.8, 0.5, l, ry));
    for (const s of [-1, 1]) { const ox = Math.cos(ry) * 2.8 * s, oz = -Math.sin(ry) * 2.8 * s; kit.add(box(GOLD, mid.x + ox, H + 1.15, mid.z + oz, 0.16, 0.16, l, ry), box(GOLD, mid.x + ox, H + 0.6, mid.z + oz, 0.12, 1.1, 0.12), box(0x7a5ac0, mid.x + ox * 1.12, H + 0.1, mid.z + oz * 1.12, 0.6, 0.36, l, ry), bead(i % 2 ? 0x9b7fd6 : 0xb59bff, mid.x + ox * 1.14, H + 0.36, mid.z + oz * 1.14, 0.4)); }
    if (i % 5 === 2) kit.add(cyl(GOLD, mid.x, H - 10, mid.z, 0.3, 19));
  }
  for (const [t, s] of [[0.3, 1.25], [0.72, 1.25]] as const) { const p = bridgePt(t), out = Math.atan2(p.x - CXc, p.z - CZc), h = hand(r, s); h.position.set(p.x - Math.sin(out) * (10.6 * s - 4.2), H - 6.8 * s + 3.6, p.z - Math.cos(out) * (10.6 * s - 4.2)); h.rotation.y = out; kit.add(h); }
  kit.live(label('Cầu Vàng', bridgePt(0.5).x - 6, H + 16, bridgePt(0.5).z + 6, '#b8860b', 1.3));
  kit.add(forestMountain(0x4f8a5a, CXc - 4, CZc - 4, 40, H - 4, r), cyl(0x5a9560, CXc - 6, (H - 3) / 2, CZc + 2, 27, H - 3));
  for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 6 + r() * 19; const t = tree(r, 1.2 + r(), r() < 0.6); t.position.set(CXc - 6 + Math.cos(a) * d, H - 3, CZc + 2 + Math.sin(a) * d); kit.add(t); }
  // ---- vườn hoa Le Jardin d'Amour
  const E = bridgePt(1), GX = E.x - 4, GZ = E.z - 26;
  kit.add(cyl(0x7fae5a, GX, H - 0.3, GZ, 30, 0.6, 24), box(0xc9bfa8, E.x, H + 0.02, E.z - 12, 5, 0.1, 26));
  const FL = [0xe2573c, 0xffd23f, 0xf29bc0, 0x9b7fd6, 0xffffff, 0xff8a3d];
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, bx = GX + Math.cos(a) * 14, bz = GZ + Math.sin(a) * 11; kit.add(cyl(0x5a8a4a, bx, H + 0.1, bz, 5, 0.3, 4)); for (let i = 0; i < 26; i++) { const aa = r() * 6.28, d = r() * 4.4; kit.add(bead(FL[(k + (i % 2)) % 6], bx + Math.cos(aa) * d, H + 0.45, bz + Math.sin(aa) * d * 0.8, 0.42)); } }
  kit.add(cyl(0xf4f1ea, GX, H + 0.5, GZ, 3.4, 1.0), cyl(0x8fd8ea, GX, H + 1.02, GZ, 3.0, 0.06), cyl(0xf4f1ea, GX, H + 1.8, GZ, 0.4, 2.4), cyl(0xf4f1ea, GX, H + 3, GZ, 1.4, 0.2));
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; kit.add(cyl(0xf4f1ea, GX + 18 + Math.cos(a) * 3, H + 1.6, GZ - 12 + Math.sin(a) * 3, 0.16, 3.2)); } kit.add(cone(0x7a5ac0, GX + 18, H + 4.2, GZ - 12, 3.8, 2.2), cyl(0xf4f1ea, GX + 18, H + 0.15, GZ - 12, 3.6, 0.3));
  for (let i = 0; i < 7; i++) kit.add(lampPost(GX - 16 + i * 5.4, H, GZ + 13, 3.2, 0xfff0c0));
  kit.live(label("Vườn hoa Le Jardin", GX, H + 7.2, GZ, '#7a5ac0', 1.0));
  // ---- Làng Pháp: quảng trường, lâu đài đá có tháp nhọn, nhà thờ
  const VX = GX - 6, VZ = GZ - 60;
  kit.add(cyl(0xa8a39a, VX, H - 0.3, VZ, 44, 0.6, 36), box(0xa8a39a, GX - 3, H - 0.3, GZ - 30, 8, 0.6, 30));
  const turret = (x: number, z: number, rad: number, h: number, roof = 0x4a5a6a) => { kit.add(cyl(0xb4ada0, x, H + h / 2, z, rad, h), cone(roof, x, H + h + rad * 1.3, z, rad * 1.25, rad * 2.6)); for (let y = 3; y < h - 1; y += 4) kit.add(box(glow(0xffe9a8), x, H + y, z + rad, 0.6, 1.2, 0.1)); };
  kit.add(box(0xb4ada0, VX - 14, H + 7, VZ - 14, 30, 14, 14), gable(0x4a5a6a, VX - 14, H + 14, VZ - 14, 15, 5, 31, Math.PI / 2), box(0x3a3a3a, VX - 14, H + 2.6, VZ - 6.96, 4, 5.2, 0.1));
  turret(VX - 29, VZ - 7, 3.2, 20); turret(VX + 1, VZ - 7, 3.2, 20); turret(VX - 14, VZ - 21, 4, 26, 0x5a4a6a); turret(VX - 29, VZ - 21, 2.6, 16); turret(VX + 1, VZ - 21, 2.6, 16);
  for (let i = 0; i < 6; i++) kit.add(box(glow(0xffe9a8), VX - 24 + i * 4, H + 9, VZ - 6.96, 1.6, 2.6, 0.1));
  // nhà thờ Saint Denis
  kit.add(box(0xa39c90, VX + 22, H + 6, VZ - 4, 10, 12, 18), gable(0x5a4a6a, VX + 22, H + 12, VZ - 4, 11, 5, 19, 0), box(0xa39c90, VX + 22, H + 12, VZ + 6.5, 5, 24, 5), cone(0x5a4a6a, VX + 22, H + 29, VZ + 6.5, 3.6, 10), box(0x3a3a3a, VX + 22, H + 2.4, VZ + 9.04, 2.4, 4.8, 0.1), cyl(glow(0xbfe6ff), VX + 22, H + 9.5, VZ + 9.06, 1.3, 0.1).rotateX(Math.PI / 2));
  // dãy nhà kiểu Pháp quanh quảng trường
  for (let i = 0; i < 7; i++) { const x = VX - 34 + i * 5.2, wc = [0xf1e3b8, 0xe9c9a0, 0xd9b0a0, 0xc9d3c0][i % 4]; kit.add(box(wc, x, H + 4.5, VZ + 24, 5, 9, 8), gable([0x8a4a36, 0x5a6a7a][i % 2], x, H + 9, VZ + 24, 5.2, 3, 8.4, 0)); for (const y of [2.4, 6]) kit.add(box(y < 3 ? 0x4a2c1c : glow(0xffe9a8), x, H + y, VZ + 19.96, 1.6, y < 3 ? 3.2 : 1.8, 0.1)); }
  kit.add(cyl(0xf4f1ea, VX - 6, H + 0.5, VZ + 6, 4.4, 1.0), cyl(0x8fd8ea, VX - 6, H + 1.02, VZ + 6, 4.0, 0.06), cyl(0xf4f1ea, VX - 6, H + 2.4, VZ + 6, 0.5, 3.6), ball(0xf4f1ea, VX - 6, H + 4.6, VZ + 6, 0.8));
  kit.live(label('Làng Pháp', VX - 10, H + 36, VZ - 14, '#5a4a6a', 1.6));
  for (let i = 0; i < 10; i++) kit.add(rock(0x7a8a72, VX + (r() - 0.5) * 100, H - 4, VZ - 40 - r() * 10, 6, 5, 6, r() * 3));
  void ball; void stairs;

  const path = [V(140, 0, 140), V(126, 0, 126), V(122, 0.2, 122), A.clone(), B.clone().add(V(1.2, 0, 1.2)), B.clone().add(V(-4, 0, -4))];
  path[3].y = 2.4; path[4].y = H;
  for (let i = 0; i <= 10; i++) path.push(bridgePt(i / 10));
  path.push(V(E.x, H, E.z - 12), V(GX + 4, H, GZ + 8), V(GX - 3, H, GZ - 14), V(GX - 3, H, GZ - 40), V(VX - 6, H, VZ + 12));
  path.splice(6, 0, V(bridgePt(0).x + 4, H, bridgePt(0).z + 5));
  kit.add(box(0x8a8f88, (B.x - 4 + bridgePt(0).x + 4) / 2, H - 0.3, (B.z - 4 + bridgePt(0).z + 5) / 2, 16, 0.6, 12));
  return {
    path, half: 1.9, npcs: 10,
    stops: [
      { id: 'ga_cap', at: V(128, 0, 128), look: V(60, 40, 60) },
      { id: 'cabin', at: A.clone().lerp(B, 0.5), look: V(-60, H + 4, -60) },
      { id: 'cau_vang', at: bridgePt(0.36), look: bridgePt(0.58).setY(H - 3), cam: V(CXc + Math.cos(0.2) * (R + 17), H + 3.2, CZc - Math.sin(0.2) * (R + 17)) },
      { id: 'vuon_hoa', at: V(GX + 3, H, GZ + 6), look: V(GX, H + 1, GZ) },
      { id: 'lang_phap', at: V(VX - 5.6, H, VZ + 13), look: V(VX - 14, H + 16, VZ - 14) },
    ],
    sky: [0x6fb6ee, 0xf2f7fb], fog: [0xe6eff5, 80, 520],
    light: { ambient: 1.55, sun: 1.5, sunColor: 0xfff4dc, sunDir: [-0.4, 0.9, 0.5] },
  };
}
