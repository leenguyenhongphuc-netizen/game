// Hải Vân Quan. Trục x: tây → đông (biển ở phía ĐÔNG, núi ở phía tây); trục z: bắc → nam.
// Đi từ chân đèo phía nam (Đà Nẵng) lên, qua khúc cua tay áo, vòng lên đỉnh; cổng "Hải Vân Quan" nhìn về bắc (Huế),
// cổng "Thiên hạ đệ nhất hùng quan" nhìn về nam (Đà Nẵng). Phía bắc dưới chân đèo là đầm Lập An và vịnh Lăng Cô.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cone, cyl, gable, grp, label, forestMountain, person, rock, stall, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { bake as bakeIt, cloud, flagPole, slab, wave } from './_extra.ts';
import type { Spots } from './_extra.ts';

const ROAD = 0x55585c, ROCK = 0x8a7f72, GRASS = 0x5f9a58, BRICK = 0x9a5a40, MOSS = 0x6f7a52, SEA = 0x2f86c6;
export function haiVan(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r, H = 30;
  // biển bao quanh phía đông, nam, bắc; đất liền dựng lên trên
  kit.add(box(0x1f6aa8, 0, -4.6, 0, 1900, 1, 1900));
  kit.water(SEA, 0, 0, 1900, 1900, -3, 0.9);
  const path = [V(4, 0, 124), V(2, 2, 96), V(8, 6, 66), V(26, 10, 44), V(38, 13, 28), V(30, 16, 14), V(6, 20, 6), V(-10, 23, -8), V(0, 26, -26), V(22, 29, -44), V(30, H, -70), V(26, H, -92), V(12, H, -108), V(0, H, -109), V(0, H, -98), V(0, H, -86), V(0, H, -74), V(0, H, -64), V(-12, H, -58), V(-22, H, -62), V(-34, H, -78), V(-36, H, -100), V(-28, H, -119)];
  // thân núi: các tấm dốc dày bám theo đường, cỏ hai bên, vách đá phía biển
  for (let i = 0; i < 10; i++) { kit.add(slab(GRASS, path[i], path[i + 1], i === 3 || i === 4 ? 22 : 34, 60, -0.35), slab(ROCK, path[i], path[i + 1], 15, 60, -0.12)); }
  kit.pave(ROAD, path, 8.6, 0, 10, 0.2, 0.03);
  for (let i = 0; i < 10; i++) { const a = path[i], b = path[i + 1], n = Math.floor(a.distanceTo(b) / 5); for (let k = 0; k < n; k++) { const p = a.clone().lerp(b, (k + 0.5) / n); kit.add(box(0xf4f1ea, p.x, p.y + 0.06, p.z, 0.2, 0.05, 1.8, Math.atan2(b.x - a.x, b.z - a.z))); } }
  // hộ lan tôn sóng và cọc tiêu đỏ trắng phía vực (phía đông), ta-luy đá phía núi
  for (let i = 0; i < 10; i++) {
    kit.along(path[i], path[i + 1], 3.2, 4.9, () => grp(0, 0, 0, 0, box(0xf4f1ea, 0, 0.45, 0, 0.26, 0.9, 0.26), box(0xd2301e, 0, 0.75, 0, 0.28, 0.24, 0.28)), [i === 5 || i === 6 || i === 7 ? 1 : -1].map((s) => -s));
    kit.along(path[i], path[i + 1], 6, 4.6, () => box(0xc9ccd0, 0, 0.62, 0, 0.12, 0.3, 6.2, Math.atan2(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z)), [i === 5 || i === 6 || i === 7 ? 1 : -1].map((s) => -s));
  }
  // dãy núi Bạch Mã – Hải Vân phía tây, rừng trên sườn
  kit.add(forestMountain(0x3f7a4e, -150, -10, 150, 120, r, -3), forestMountain(0x4a8556, -110, 140, 120, 80, r, -3), forestMountain(0x3f7a4e, -370, -190, 170, 140, r, -3), forestMountain(0x558f5a, -60, -40, 70, 70, r, -3), forestMountain(0x4a8556, 20, 40, 60, 34, r, -3));
  for (let i = 0; i < 70; i++) { const k = Math.floor(r() * 9), p = path[k].clone().lerp(path[k + 1], r()), side = r() < 0.6 ? -1 : 1, off = 7 + r() * 11; const t = tree(r, 0.9 + r() * 0.9, r() < 0.6); t.position.set(p.x + side * off, p.y - 0.4, p.z + (r() - 0.5) * 6); if (Math.hypot(t.position.x - 40, t.position.z - 30) < 20 && side > 0) continue; kit.add(t); }
  for (let i = 0; i < 26; i++) { const k = Math.floor(r() * 9), p = path[k].clone().lerp(path[k + 1], r()); kit.add(rock(0x9a9084, p.x + (r() < 0.5 ? -1 : 1) * (5.6 + r() * 3), p.y + 0.2, p.z, 0.8 + r() * 1.2, 0.6 + r(), 0.8 + r(), r() * 3)); }
  // chân đèo: biển chỉ dẫn, xe máy phượt, biển báo đèo dốc
  kit.add(box(0x1f7a4a, -4.6, 3.4, 110, 0.2, 2.2, 5), cyl(0x8a8a8a, -4.6, 1.3, 108, 0.1, 2.6), cyl(0x8a8a8a, -4.6, 1.3, 112, 0.1, 2.6));
  kit.live(label('Đèo Hải Vân · 20 km', -4.2, 5.6, 110, '#1f7a4a', 0.7), label('Hầm Hải Vân ←', -6, 3.2, 118, '#2a5fa8', 0.5));
  const bike = (x: number, y: number, z: number, ry: number, c: number, i: number) => { const g = grp(x, y, z, ry, cyl(0x222222, 0, 0.32, 0.7, 0.32, 0.12).rotateZ(Math.PI / 2), cyl(0x222222, 0, 0.32, -0.7, 0.32, 0.12).rotateZ(Math.PI / 2), box(c, 0, 0.62, 0, 0.3, 0.36, 1.3), box(0x222222, 0, 0.86, 0.2, 0.34, 0.1, 0.7), box(0x8a8a8a, 0, 1.0, -0.55, 0.7, 0.06, 0.06)); const p = person(i, 2); p.position.set(0, 0.25, 0.1); p.scale.setScalar(0.92); g.add(p, ball([0xe2573c, 0xffffff, 0xffd23f][i % 3], 0, 1.84, 0.1, 0.3)); return g; };
  kit.add(bike(-2.2, 1.4, 104, 3.1, 0xd2301e, 1), bike(-2.4, 5, 72, 2.9, 0x2a6fbf, 2), bike(2.6, 21.6, -1, -2.4, 0x222222, 3));
  // khúc cua tay áo: biển cảnh báo, gương cầu lồi, xe tải bò lên, miếu nhỏ ven đường
  kit.add(cyl(0x8a8a8a, 44, 14.2, 30, 0.08, 3), cone(0xffd23f, 44, 15.9, 30, 0.9, 1.4), cyl(0x8a8a8a, 41, 14.2, 20, 0.08, 3), cyl(0xff8a3d, 41, 15.6, 20.1, 0.7, 0.08).rotateX(Math.PI / 2), cyl(0xcfe8f4, 41, 15.6, 20.16, 0.6, 0.06).rotateX(Math.PI / 2));
  kit.add(grp(31, 14.9, 23, 0.5, box(0x2a7f5a, 0, 1.5, 1.6, 2.3, 2.2, 2), box(0xbfe6ff, 0, 1.9, 2.62, 2, 0.9, 0.06), box(0xc9a36a, 0, 1.7, -1.6, 2.4, 2.4, 4.4), ...[-1, 1].flatMap((s) => [cyl(0x222222, s * 1.1, 0.5, 1.6, 0.5, 0.3).rotateZ(Math.PI / 2), cyl(0x222222, s * 1.1, 0.5, -2.4, 0.5, 0.3).rotateZ(Math.PI / 2)])));
  kit.add(grp(46, 12.4, 36, 0.8, box(0xd8c8a0, 0, 0.6, 0, 1.4, 1.2, 1.2), gable(0xa8322a, 0, 1.2, 0, 1.8, 0.7, 1.6), box(0xffd23f, 0, 0.7, 0.62, 0.5, 0.6, 0.04)));
  kit.live(label('Cua tay áo', 40, 19, 26, '#c9861c', 0.8));
  // mây vắt ngang lưng đèo, trôi chậm
  const clouds = [cloud(60, 17, 20, 6), cloud(-30, 24, -20, 7), cloud(80, 26, -70, 8), cloud(-70, 33, -110, 9), cloud(40, 9, 90, 5), cloud(70, 36, -150, 7)].map((c) => { const b = bakeLocal(c); kit.live(b); return b; });
  kit.onTick((t) => clouds.forEach((c, i) => { c.position.x += Math.sin(t * 0.07 + i * 1.7) * 0.012; c.position.z += Math.cos(t * 0.05 + i) * 0.008; }));
  // ---- đỉnh đèo: nền bằng, bãi xe, quán nước, cụm cửa ải
  kit.add(cyl(GRASS, 0, H - 30, -82, 62, 60, 50), cyl(0xa89a84, 0, H - 0.04, -86, 30, 0.1, 30), box(ROAD, 28, H - 0.02, -70, 18, 0.1, 40));
  // cổng Hải Vân Quan (phía bắc, mặt nhìn về Huế): thân gạch dày, vòm cuốn, lầu canh có mái
  const gate = (z: number, face: number, title: string, col: string) => {
    const g = grp(0, H, z, face < 0 ? 0 : Math.PI);
    g.add(box(BRICK, -4.6, 3.2, 0, 5.2, 6.4, 5.6), box(BRICK, 4.6, 3.2, 0, 5.2, 6.4, 5.6), box(BRICK, 0, 5.3, 0, 4.2, 2.2, 5.6), box(0x7a4a34, 0, 6.6, 0, 15, 0.5, 6.2));
    g.add(cyl(0x241a14, 0, 4.2, 0, 2, 5.7, 2).rotateX(Math.PI / 2), box(0x241a14, 0, 2.1, 0, 4, 4.2, 5.7));
    for (let i = 0; i < 9; i++) g.add(box(0x8a4f38, -6.4 + i * 1.6, 7.25, -2.6, 1.0, 0.9, 0.5), box(0x8a4f38, -6.4 + i * 1.6, 7.25, 2.6, 1.0, 0.9, 0.5));
    g.add(box(0xd8cfb8, 0, 6.3, -2.86, 5, 1.1, 0.1), box(0x3a3028, 0, 6.3, -2.9, 4.6, 0.8, 0.08));
    for (let i = 0; i < 14; i++) g.add(box(MOSS, -6.6 + r() * 13.2, 0.6 + r() * 5.4, -2.84, 0.5 + r() * 1.2, 0.3 + r() * 0.6, 0.06), box(0x6a3f2e, -6.6 + r() * 13.2, 0.6 + r() * 5.4, 2.84, 0.6 + r(), 0.3 + r() * 0.5, 0.06));
    for (let i = 0; i < 6; i++) g.add(ball(0x5f9a58, -7 + r() * 14, 7.1, -1 + r() * 2, 0.5 + r() * 0.5, 0.3, 0.5));
    kit.add(g); kit.live(label(title, 0, H + 10.4, z, col, 1.05));
  };
  gate(-98, -1, 'Hải Vân Quan', '#7a3f2a'); gate(-76, 1, 'Thiên hạ đệ nhất hùng quan', '#7a3f2a');
  // tường thành nối hai cổng, sân trong lát đá, bia di tích quốc gia
  for (const sx of [-1, 1]) { kit.add(box(BRICK, sx * 9.4, H + 2, -87, 2, 4, 26), box(0x7a4a34, sx * 9.4, H + 4.2, -87, 2.6, 0.4, 26.6)); for (let i = 0; i < 8; i++) kit.add(box(0x8a4f38, sx * 9.4, H + 4.8, -98 + i * 3.2, 2.4, 0.8, 1.2)); }
  kit.add(box(0x8f8a80, 0, H + 0.05, -87, 16, 0.12, 20), box(0x6f6a62, 5, H + 1.3, -87, 0.5, 2.2, 1.8), box(0x4a463f, 5, H + 0.2, -87, 1.2, 0.4, 2.4), box(0xd8cfb8, 4.72, H + 1.5, -87, 0.06, 1.4, 1.2));
  const fp = flagPole(11, 3); fp.pole.position.set(-5, H, -87); fp.flag.position.x = -5; fp.flag.position.y += H; fp.flag.position.z = -87; kit.add(fp.pole); kit.live(fp.flag); wave(kit, fp.flag);
  // lô cốt bê tông thời Pháp, Mỹ: khối thấp, lỗ châu mai, rêu phủ
  const bunker = (x: number, z: number, ry: number, s = 1) => { const g = grp(x, H, z, ry, cyl(0x8f8f88, 0, 1.3 * s, 0, 3.2 * s, 2.6 * s), cyl(0x7d7d76, 0, 2.8 * s, 0, 3.5 * s, 0.4 * s), box(0x1f1f1f, 0, 1.7 * s, 3.1 * s, 1.6 * s, 0.4 * s, 0.4), box(0x1f1f1f, 2.3 * s, 1.7 * s, 2.1 * s, 1.2 * s, 0.4 * s, 0.4, 0.8), box(0x1f1f1f, -1 * s, 1.1 * s, -3.1 * s, 1.1 * s, 2.2 * s, 0.4), ball(MOSS, 1, 2.9 * s, -0.6, 1.8 * s, 0.3, 1.5 * s), box(0x6f7a52, -2.4 * s, 0.9 * s, 2 * s, 0.8, 1.2, 0.1, -0.8)); kit.add(g); };
  bunker(-19, -51, 0.5); bunker(-30, -56, -0.4, 0.8); bunker(18, -60, 2.6, 0.7);
  kit.add(box(0x8f8f88, -24, H + 0.6, -48, 9, 1.2, 0.7, 0.3)); kit.live(label('Lô cốt cũ', -20, H + 6, -52, '#5a5a54', 0.7));
  // quán nước ven đèo, xe khách đỗ, khách chụp ảnh
  for (let i = 0; i < 4; i++) { const st = stall([0x2a6fbf, 0xe2573c, 0x2f8a5a, 0xffd23f][i], r); st.position.set(37, H, -56 - i * 7); st.rotation.y = -Math.PI / 2; kit.add(st); const p = person(i + 3, 1); p.position.set(38.4, H, -56 - i * 7); kit.add(p); kit.add(box(0xd2301e, 33.6, H + 0.4, -55 - i * 7, 0.7, 0.8, 0.7), box(0x2a6fbf, 33.6, H + 0.4, -57.4 - i * 7, 0.7, 0.8, 0.7)); }
  kit.add(grp(24, H, -62, 0.1, box(0xf4f1ea, 0, 1.8, 0, 2.6, 2.6, 9), box(0x2a6fbf, 0, 1.2, 0, 2.66, 0.5, 9.04), box(0x9fd0ea, 0, 2.3, 0, 2.66, 0.9, 8.2), ...[-1, 1].flatMap((s) => [cyl(0x222222, s * 1.2, 0.5, 3, 0.5, 0.3).rotateZ(Math.PI / 2), cyl(0x222222, s * 1.2, 0.5, -3, 0.5, 0.3).rotateZ(Math.PI / 2)])));
  for (let i = 0; i < 5; i++) { const p = person(i + 8); p.position.set(-4 + i * 2.2, H, -113 - (i % 2) * 1.6); p.rotation.y = Math.PI; kit.add(p); }
  // ---- đài ngắm cảnh phía tây bắc: sàn gỗ, lan can, ống nhòm
  kit.add(cyl(0x9a7150, -28, H + 0.1, -121, 7, 0.3), cyl(0x4a4a4a, -32, H + 0.9, -125, 0.1, 1.5), box(0x3f6f8f, -32, H + 1.7, -125.2, 0.3, 0.3, 0.8));
  for (let i = 0; i < 12; i++) { const a = Math.PI * (0.55 + i / 11 * 1.2); kit.add(cyl(0x7a5a3c, -28 + Math.cos(a + 1.5) * 6.8, H + 0.7, -121 + Math.sin(a + 1.5) * 6.8, 0.09, 1.2)); }
  kit.live(label('Vịnh Lăng Cô · đầm Lập An', -60, 12, -250, '#2a7f9a', 3.4));
  // ---- phía BẮC dưới chân đèo: đầm Lập An, dải cát trắng Lăng Cô, đường sắt ôm chân núi, cầu Lăng Cô
  kit.add(box(0x6fae62, -190, -3, -420, 420, 1.4, 320), box(0x53c7c0, -130, -2.2, -330, 150, 0.2, 130), box(0xfbf3d6, -40, -2.1, -300, 26, 0.3, 230), box(0xfbf3d6, -150, -2.1, -252, 200, 0.3, 14), box(0xffffff, -24, -2.2, -300, 5, 0.2, 230));
  for (let i = 0; i < 26; i++) kit.add(box([0xf1e3b8, 0xe9c9c0, 0xbfe0e6][i % 3], -46 + r() * 10, -1.2, -400 + i * 8, 4, 2, 4), cone(0xa8482f, -46 + r() * 2, 0.4, -400 + i * 8, 3.4, 1.4));
  kit.add(box(0xb9b2a4, -90, -1.2, -246, 110, 0.5, 2.2)); for (let i = 0; i < 9; i++) kit.add(cyl(0x9a958a, -140 + i * 12, -2.2, -246, 0.7, 2));
  kit.add(forestMountain(0x4a8556, -330, -480, 180, 130, r, -3), forestMountain(0x3f7a4e, -120, -560, 150, 90, r, -3));
  // đường sắt Bắc Nam và đoàn tàu bám sườn núi phía biển
  kit.add(box(0x6b6258, 62, 3.4, -150, 5, 0.4, 260), box(0x3a3a3a, 61, 3.7, -150, 0.2, 0.2, 260), box(0x3a3a3a, 63, 3.7, -150, 0.2, 0.2, 260), box(ROCK, 56, -0.6, -150, 14, 8, 260));
  const train = grp(62, 3.8, -170); train.add(box(0x1f5fa8, 0, 1.5, -16, 2.8, 2.8, 9), box(0xd2301e, 0, 1.0, -16, 2.86, 0.5, 9.04)); for (let i = 0; i < 4; i++) train.add(box([0xd2301e, 0x2f7d5a][i % 2], 0, 1.5, -5 + i * 10.4, 2.8, 2.8, 9.8), box(0xf4f1ea, 0, 2.1, -5 + i * 10.4, 2.86, 0.8, 8.6));
  const trainB = bakeLocal(train); kit.live(trainB); kit.onTick((t) => { trainB.position.z = -260 + ((t * 6) % 220); });
  // ---- phía NAM: vịnh Đà Nẵng, thành phố xa, bán đảo Sơn Trà
  kit.add(box(0x7fae6a, -260, -3, 330, 400, 1.4, 260), box(0xfbf3d6, -60, -2.4, 300, 14, 0.3, 240));
  for (let i = 0; i < 60; i++) { const h = 6 + r() * 26; kit.add(box([0xe8e4d8, 0xcfd8e0, 0xf1e3b8, 0xb9cfd6][i % 4], -80 - r() * 130, h / 2 - 2.4, 240 + r() * 190, 6 + r() * 6, h, 6 + r() * 6)); }
  kit.add(forestMountain(0x3f7a4e, 260, 330, 110, 70, r, -3), forestMountain(0x4a8556, 180, 370, 80, 50, r, -3), cyl(0xffffff, 150, 14, 345, 1.6, 12), ball(0xffffff, 150, 21, 345, 2));
  for (let i = 0; i < 7; i++) kit.add(grp(110 + r() * 160, -2.9, 60 + r() * 220, r() * 6, ball([0x2a6f9a, 0xd2553a, 0x3fa56a][i % 3], 0, 0.5, 0, 1.6, 1, 5), box(0xf4f1ea, 0, 1.6, 0.8, 1.8, 1.4, 2.6)));
  void cone; void THREE;

  kit.pave(0xb9a98f, path, 3.8, 10, path.length - 1, 0.14, 0.05);
  return {
    path, half: 2.2, npcs: 9, startYaw: 0,
    stops: [
      { id: 'chan_deo', at: V(3.6, 0.5, 118), look: V(20, 26, 20) },
      { id: 'cua_tay_ao', at: V(37, 12.8, 29), look: V(170, -6, 150) },
      { id: 'cong_ai', at: V(0, H, -109), look: V(0, H + 5, -98) },
      { id: 'de_nhat', at: V(0, H, -64), look: V(0, H + 5, -76) },
      { id: 'lo_cot', at: V(-14, H, -58.6), look: V(-19, H + 1.6, -51) },
      { id: 'vong_canh', at: V(-28, H, -119), look: V(-70, -8, -310) },
    ],
    sky: [0x4f9fe6, 0xe8f3fa], fog: [0xdcecf4, 140, 900],
    light: { ambient: 1.55, sun: 1.7, sunColor: 0xfff4dc, sunDir: [0.5, 0.9, 0.4] },
    shopSpots: [V(33, H, -52), V(-6, H, -116), V(-40, H, -84)],
  };
}
function bakeLocal(g: THREE.Group): THREE.Object3D { const p = g.position.clone(); g.position.set(0, 0, 0); const b = bakeIt(g); b.position.copy(p); return b; }
