// Biển Mỹ Khê. Trục x: tây → đông (biển ở phía ĐÔNG); trục z: bắc → nam. Sơn Trà và tượng Quan Âm ở phía BẮC.
// Từ công viên Biển Đông đi dọc lối dạo ven đường Võ Nguyên Giáp, xuống bãi cát, qua chòi cứu hộ, bến thuyền thúng rồi tới phố hải sản.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, lampPost, mountain, palm, person, rock, signPost, stall } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { basket, baked, coracle, flagPole, pigeon, tower, umbrella, wave } from './_extra.ts';
import type { Spots } from './_extra.ts';

const SAND = 0xfaf0cf, WET = 0xe3d3a4, SEA = 0x1f8fd0, ROAD = 0x5a5d62, WALK = 0xe2a98a;
export function myKhe(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r, shore = (z: number) => 34 + Math.sin(z * 0.02) * 3;
  kit.add(box(0x1a78b8, 400, -2.2, 0, 800, 1, 1400)); kit.water(SEA, 420, 0, 800, 1400, -0.25, 0.86);
  // bãi cát rộng, dải cát ướt sát mép sóng, nền phố phía tây
  kit.add(box(SAND, 10, -0.5, 0, 64, 1, 1000), box(WET, 37, -0.46, 0, 12, 1, 1000), box(0xcfc8b8, -230, -0.5, 0, 420, 1, 1000));
  // sóng bạc đầu chạy vào bờ
  const waves = [0, 1, 2, 3, 4].map((i) => { const m = box(0xffffff, 60, -0.14, 0, 1.6, 0.08, 520); m.userData.o = i * 9; kit.live(m); return m; });
  kit.onTick((t) => waves.forEach((w) => { const k = ((t * 3.2 + w.userData.o) % 45) / 45; w.position.x = 82 - k * 46; w.scale.x = 0.7 + (1 - k) * 2.2; w.position.y = -0.2 + Math.sin(k * 3.14) * 0.16; }));
  for (let z = -300; z < 300; z += 7) kit.add(box(0xffffff, shore(z) + 3 + r() * 2, -0.02, z, 1.2 + r(), 0.05, 6.4));
  // ---- đường Võ Nguyên Giáp: hai chiều, dải phân cách trồng dừa, lối dạo lát gạch hồng, lan can thấp
  kit.add(box(ROAD, -30, 0.02, 0, 18, 0.1, 1000), box(0x7fae5a, -30, 0.1, 0, 2, 0.2, 1000), box(WALK, -15, 0.3, 0, 12, 0.6, 1000), box(0xf4f1ea, -9.2, 0.75, 0, 0.5, 0.5, 1000));
  for (let z = -300; z < 300; z += 9) kit.add(box(0xf4f1ea, -25.5, 0.09, z, 0.2, 0.04, 4), box(0xf4f1ea, -34.5, 0.09, z, 0.2, 0.04, 4));
  for (let z = -290; z < 300; z += 13) { const p = palm(r, 7 + r() * 2); p.position.set(-11, 0.6, z); kit.add(p); if (z % 2 === 0) { const q = palm(r, 6); q.position.set(-30, 0.2, z + 6); kit.add(q); } kit.add(lampPost(-19.5, 0.6, z + 6, 5.5, 0xfff3c4)); }
  for (let i = 0; i < 10; i++) { const z = -260 + i * 56 + r() * 20, dir = i % 2 ? 1 : -1, c = [0xf4f1ea, 0xd2301e, 0x2a6fbf, 0x3a3a3a, 0x18a558][i % 5]; kit.add(grp(dir > 0 ? -25.6 : -34.4, 0.1, z, 0, box(c, 0, 0.7, 0, 1.9, 0.9, 4.2), box(0x9fd0ea, 0, 1.4, -0.2, 1.7, 0.7, 2.2), ...[-1, 1].flatMap((s) => [cyl(0x222222, s * 0.9, 0.35, 1.3, 0.35, 0.2).rotateZ(Math.PI / 2), cyl(0x222222, s * 0.9, 0.35, -1.3, 0.35, 0.2).rotateZ(Math.PI / 2)]))); }
  // dãy khách sạn cao tầng phía tây đường
  const HC = [0xf4f1ea, 0xd9e6ee, 0xf1e3b8, 0xbfd6e6, 0xe9d2c0, 0xcfe0d8];
  for (let i = 0; i < 34; i++) { const z = -300 + i * 18, h = 26 + r() * 60, t = tower(HC[i % 6], 13 + r() * 4, h, 14, [0x6fb0e0, 0x8fc4e8, 0x5a9fcf][i % 3]); t.position.set(-52 - r() * 6, 0, z); kit.add(t); if (i % 2) { const t2 = tower(HC[(i + 3) % 6], 16, 40 + r() * 80, 16); t2.position.set(-84, 0, z + 6); kit.add(t2); } kit.add(box([0xe2573c, 0x2a6fbf, 0x18a558, 0xffd23f][i % 4], -44.9, 3.4, z, 0.3, 1.2, 9)); }
  // ---- bán đảo Sơn Trà phía bắc, tượng Quan Âm trắng chùa Linh Ứng trên sườn núi
  kit.add(mountain(0x3f7a4e, 170, -620, 190, 150, r), mountain(0x4a8556, 60, -640, 150, 110, r), mountain(0x3f7a4e, 300, -560, 150, 100, r), box(SAND, 40, -0.4, -520, 120, 1, 60));
  kit.add(ball(0x4a8556, 96, 8, -508, 46, 34, 40));
  kit.add(cyl(0xffffff, 96, 58, -500, 3.4, 30), ball(0xffffff, 96, 77, -500, 4.2), cone(0xffffff, 96, 84, -500, 2.4, 6), cyl(0xf4f1ea, 96, 41, -500, 8, 3), box(0xa8482f, 80, 40, -492, 22, 5, 10));
  // tàu hàng và thuyền câu ngoài khơi
  for (let i = 0; i < 6; i++) kit.add(grp(150 + r() * 260, -0.2, -300 + r() * 600, r() * 3, box([0x3a4a6a, 0xa83a2a, 0x2a6f5a][i % 3], 0, 1.4, 0, 6, 3, 30), box(0xf4f1ea, 0, 5, 10, 5, 4, 6)));
  // ---- công viên Biển Đông: quảng trường, tượng đài, đàn bồ câu trắng, chuồng chim
  const PZ = -92;
  kit.add(cyl(0xd9c8b0, -4, 0.32, PZ, 24, 0.66, 20), cyl(0xf4f1ea, -4, 0.9, PZ - 4, 5, 0.6), cyl(0xe8e4d8, -4, 1.4, PZ - 4, 3.4, 0.5));
  kit.add(cone(0xffffff, -4, 6.4, PZ - 4, 1.1, 10), ball(0xffffff, -2.2, 8.6, PZ - 4, 2.6, 0.5, 1.2), ball(0xffffff, -5.8, 8.6, PZ - 4, 2.6, 0.5, 1.2), ball(0xffffff, -4, 11.8, PZ - 4, 0.8));
  kit.add(grp(-18, 0.66, PZ + 8, 0.6, cyl(0x7a5a3c, 0, 1.6, 0, 0.14, 3.2), box(0x2a8f6a, 0, 3.6, 0, 2.6, 1.6, 2.6), cone(0xa8482f, 0, 4.9, 0, 2.2, 1.2), ...[-0.7, 0, 0.7].map((x) => cyl(0x1f1f1f, x, 3.6, 1.32, 0.26, 0.06).rotateX(Math.PI / 2))));
  for (let i = 0; i < 46; i++) { const a = r() * 6.28, d = r() * 15, p = pigeon(i % 9 === 0 ? 0xbfc4c8 : 0xffffff); p.position.set(-4 + Math.cos(a) * d, 0.66, PZ + 4 + Math.sin(a) * d * 0.7); p.rotation.y = r() * 6; kit.add(p); }
  const flock = new THREE.Group(); for (let i = 0; i < 14; i++) { const p = pigeon(); p.position.set((r() - 0.5) * 9, r() * 3, (r() - 0.5) * 9); p.add(ball(0xffffff, 0.22, 0.2, 0, 0.26, 0.03, 0.12), ball(0xffffff, -0.22, 0.2, 0, 0.26, 0.03, 0.12)); flock.add(p); }
  const fl = baked(flock); kit.live(fl); kit.onTick((t) => { fl.position.set(-4 + Math.cos(t * 0.5) * 13, 6.5 + Math.sin(t * 1.3) * 1.6, PZ + Math.sin(t * 0.5) * 10); fl.rotation.y = -t * 0.5; });
  for (let i = 0; i < 5; i++) { kit.add(box(0x7a5a3c, -16 + i * 6, 1.0, PZ + 16, 2.2, 0.12, 0.7), box(0x7a5a3c, -16 + i * 6, 1.4, PZ + 16.3, 2.2, 0.6, 0.1)); }
  const kid = person(2, 2, 0xffd23f); kid.scale.setScalar(0.7); kid.position.set(0, 0.66, PZ + 6); kid.rotation.y = 2; kit.add(kid, basket(0xf3d9a0, 0.5).translateX(0.6).translateY(0.66).translateZ(PZ + 6.6));
  kit.live(label('Công viên Biển Đông', -4, 15.6, PZ - 4, '#2a6fbf', 1.1));
  // ---- bãi cát: dù, ghế nằm, bóng chuyền bãi biển, người tắm, lâu đài cát
  const UC = [0xe2573c, 0x2a6fbf, 0xffd23f, 0x18a558, 0xff8a3d];
  for (let i = 0; i < 16; i++) { const u = umbrella(UC[i % 5]); u.position.set(6 + (i % 2) * 7, 0, -66 + Math.floor(i / 2) * 7.4); u.rotation.y = Math.PI / 2; kit.add(u); if (i % 3 === 0) { const p = person(i, 0, UC[(i + 2) % 5]); p.position.set(7 + (i % 2) * 7, -0.4, -65.4 + Math.floor(i / 2) * 7.4); p.rotation.x = -1.3; kit.add(p); } }
  kit.add(cyl(0x8a8a8a, 22, 1.3, -52, 0.07, 2.6), cyl(0x8a8a8a, 22, 1.3, -44, 0.07, 2.6), box(0xffffff, 22, 2.1, -48, 0.04, 0.9, 8), box(0x2a6fbf, 22, 2.56, -48, 0.06, 0.08, 8), bead(0xffd23f, 21, 3.4, -47, 0.24));
  for (let i = 0; i < 4; i++) { const p = person(i + 5, 0, UC[i]); p.position.set(22 + (i < 2 ? -3 : 3), 0, -50 + (i % 2) * 4); p.rotation.y = i < 2 ? -1.57 : 1.57; kit.add(p); }
  kit.add(grp(18, 0, -30, 0, cyl(0xe9d8a8, 0, 0.3, 0, 1.2, 0.6), cyl(0xe9d8a8, 0, 0.9, 0, 0.7, 0.6), cone(0xe9d8a8, 0, 1.5, 0, 0.4, 0.6), cone(0xe9d8a8, 0.9, 0.8, 0.4, 0.3, 0.5), bead(0xd2301e, 0, 1.9, 0, 0.1)));
  for (let i = 0; i < 9; i++) { const z = -70 + i * 13 + r() * 6, p = person(i + 1, 0, UC[i % 5]); p.position.set(shore(z) + 6 + r() * 12, -1.0, z); kit.add(p); if (i % 3 === 0) kit.add(cyl([0xff8fc8, 0xffd23f, 0x7fe0c0][i % 3], shore(z) + 6, -0.1, z + 1.4, 0.7, 0.24)); }
  // người lướt ván trên sóng, mô tô nước
  const surf = baked(grp(0, 0, 0, 0, box(0xfff3a0, 0, 0.1, 0, 0.7, 0.1, 2.6), person(3, 0, 0x2a6fbf).translateY(0.1))); kit.live(surf);
  kit.onTick((t) => { const k = (t * 0.12) % 1; surf.position.set(74 - k * 30, -0.2 + Math.sin(t * 2) * 0.15, -20 + Math.sin(t * 0.4) * 10); surf.rotation.set(0, 1.2, Math.sin(t * 1.5) * 0.12); });
  kit.add(grp(64, -0.2, 20, 0.8, box(0xd2301e, 0, 0.4, 0, 1.1, 0.6, 3), box(0xffffff, 0, 0.8, -0.3, 0.9, 0.3, 1.2), person(6, 2).translateY(0.5)));
  // ---- chòi cứu hộ: chòi gỗ trắng đỏ trên cột, cờ đỏ vàng, phao tròn, dây phao giới hạn khu tắm
  const LX = 24, LZ = 0;
  const hut = grp(LX, 0, LZ, -Math.PI / 2); for (const sx of [-1, 1]) for (const sz of [-1, 1]) hut.add(cyl(0xf4f1ea, sx * 1.3, 1.4, sz * 1.3, 0.12, 2.8));
  hut.add(box(0xf4f1ea, 0, 2.8, 0, 3.4, 0.2, 3.4), box(0xd2301e, 0, 3.9, -0.4, 3, 2, 2.4), box(0xf4f1ea, 0, 3.9, 0.82, 2, 1, 0.06), gable(0xf4f1ea, 0, 4.9, -0.2, 3.8, 0.9, 3.6), box(0xf4f1ea, 0, 1.4, 2.5, 1.2, 0.12, 3.4).rotateX(0.82), cyl(0xff8a3d, 1.56, 3.8, 0.4, 0.5, 0.16).rotateZ(Math.PI / 2), cyl(0xffffff, 1.6, 3.8, 0.4, 0.3, 0.18).rotateZ(Math.PI / 2));
  kit.add(hut); const guard = person(4, 2, 0xffd23f); guard.position.set(LX + 0.6, 3, LZ + 0.2); guard.rotation.y = -1.57; kit.add(guard, box(0xd2301e, LX + 2.6, 0.5, LZ + 3, 0.5, 0.16, 2.4));
  for (const dz of [-14, 14]) { const f = flagPole(5, 1.4); f.pole.position.set(LX + 4, 0, LZ + dz); kit.add(f.pole, box(0xffd23f, LX + 4.8, 3.86, LZ + dz, 1.4, 0.46, 0.06)); f.flag.position.set(LX + 4, 4.3, LZ + dz); f.flag.children.slice(1).forEach((c) => (c.visible = false)); f.flag.scale.y = 0.5; kit.live(f.flag); wave(kit, f.flag, 2.6); }
  for (let i = 0; i < 22; i++) { const a = i / 21 * Math.PI; kit.add(bead(i % 2 ? 0xff8a3d : 0xffffff, shore(0) + 4 + Math.sin(a) * 24, -0.1, -30 + i * 2.9, 0.34)); }
  kit.live(label('Cứu hộ · chỉ tắm trong vùng phao', LX, 8.2, LZ, '#d2301e', 0.7));
  // ---- bến thuyền thúng và chợ cá sáng trên cát
  const CZ = 46;
  for (let i = 0; i < 9; i++) { const c = coracle(1.15 + r() * 0.2, 0xe2c58a, [0x6a5038, 0x2a5f8a, 0x7a5a3c][i % 3]); c.position.set(20 + (i % 3) * 4.4 + r(), 0, CZ - 4 + Math.floor(i / 3) * 4.6); if (i % 4 === 0) { c.rotation.z = 1.25; c.position.y = 0.9; } kit.add(c); }
  for (let i = 0; i < 6; i++) { const b = basket([0xb9c8d6, 0xd9a06a, 0xc0c8cc][i % 3], 1.2); b.position.set(12 + (i % 3) * 2, 0, CZ - 2 + Math.floor(i / 3) * 2.4); kit.add(b); for (let k = 0; k < 4; k++) kit.add(rock(0xcfd8de, 12 + (i % 3) * 2 + (r() - 0.5) * 0.5, 0.62, CZ - 2 + Math.floor(i / 3) * 2.4 + (r() - 0.5) * 0.5, 0.26, 0.06, 0.1, r() * 3)); }
  for (let i = 0; i < 5; i++) { const p = person(i + 2, 1, [0x9b7fd6, 0x4aa3d8, 0xe2573c][i % 3]); p.position.set(10.6 + i * 1.8, 0, CZ + 2.8 + (i % 2)); p.rotation.y = 3; kit.add(p); }
  kit.add(grp(shore(CZ) + 9, -0.3, CZ + 6, 0.5, ball(0x2a6f9a, 0, 0.4, 0, 1.4, 0.9, 5), box(0xd2301e, 0, 0.95, 0, 2.2, 0.12, 7), box(0xf4f1ea, 0, 1.6, 1.4, 1.6, 1.2, 2)), box(0x5f8a8f, 16, 0.9, CZ + 9, 5, 0.04, 3, 0.3), cyl(0x7a5a3c, 13.6, 0.6, CZ + 8.4, 0.05, 1.2), cyl(0x7a5a3c, 18.4, 0.6, CZ + 9.6, 0.05, 1.2));
  kit.live(label('Bến thuyền thúng', 22, 5.4, CZ, '#7a5a3c', 0.8));
  // ---- phố hải sản: dãy quán mái tôn màu, bể hải sản, bàn ghế nhựa, biển hiệu mì Quảng
  const FZ = 96;
  for (let i = 0; i < 7; i++) { const z = FZ - 12 + i * 8, c = [0xe2573c, 0x2a6fbf, 0x18a558, 0xff8a3d][i % 4]; kit.add(box(0xf1e3b8, -4, 2.3, z, 6, 3.4, 7), box(c, -4, 4.3, z, 7.6, 0.2, 7.6), box(c, -8.2, 3.5, z, 1.6, 0.14, 7.2), box(0x9fd8ea, -7.6, 1.4, z + 2, 0.9, 1, 1.8), box(0x6f7a80, -7.6, 0.75, z + 2, 1, 0.3, 1.9)); for (let k = 0; k < 2; k++) kit.add(cyl(0xf4f1ea, -10.6, 1.2, z - 2 + k * 3, 0.6, 0.06), cyl(0x8a8a8a, -10.6, 0.9, z - 2 + k * 3, 0.05, 0.6), box([0xd2301e, 0x2a6fbf][k], -11.5, 0.9, z - 2 + k * 3, 0.5, 0.5, 0.5), box([0xd2301e, 0x2a6fbf][k], -9.7, 0.9, z - 2 + k * 3, 0.5, 0.5, 0.5)); }
  for (let i = 0; i < 3; i++) { const st = stall([0xe2573c, 0xffd23f, 0x2a6fbf][i], r); st.position.set(-18, 0.6, FZ - 6 + i * 9); st.rotation.y = Math.PI / 2; kit.add(st); const p = person(i + 6, 1); p.position.set(-19.4, 0.6, FZ - 6 + i * 9); kit.add(p); }
  kit.live(label('Hải sản · Mì Quảng', -6, 7.4, FZ + 4, '#d2301e', 0.9), signPost('Bãi tắm Mỹ Khê', -8, 0.6, -40, '#2a6fbf', 1.1));
  void cone; void ball;

  const path = [V(-12, 0.62, -116), V(-6, 0.68, -100), V(-2, 0.68, -84), V(-12, 0.62, -68), V(-6, 0.3, -58), V(2, 0, -52), V(14, 0, -38), V(17, 0, -16), V(19, 0, -2), V(17, 0, 20), V(16, 0, 38), V(15, 0, 54), V(4, 0, 68), V(-8, 0.4, 76), V(-13, 0.62, 86), V(-13.4, 0.62, 104)];
  kit.add(box(0xd9c8b0, -5, 0.26, -57, 7, 0.5, 5, 0.6));
  return {
    path, half: 2.4, npcs: 12, startYaw: 0.4,
    stops: [
      { id: 'cong_vien', at: V(-3, 0.68, -86), look: V(-4, 7, PZ - 4) },
      { id: 'bai_cat', at: V(13, 0, -39), look: V(96, 40, -500) },
      { id: 'choi_cuu_ho', at: V(19, 0, -3), look: V(LX + 2, 3.4, LZ + 2) },
      { id: 'thuyen_thung', at: V(15.6, 0, 40), look: V(24, 0.6, CZ + 2) },
      { id: 'pho_bien', at: V(-13.3, 0.62, 100), look: V(-4, 3, FZ + 6) },
    ],
    sky: [0x2f94ee, 0xdff3fb], fog: [0xd6eef8, 160, 900],
    light: { ambient: 1.7, sun: 1.9, sunColor: 0xfff6dc, sunDir: [0.5, 1, -0.2] },
    shopSpots: [V(-16, 0.6, -60), V(8, 0, -8), V(-16, 0.6, 80)],
  };
}
