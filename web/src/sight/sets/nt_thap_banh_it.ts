// Tháp Bánh Ít (tháp Bạc), Tuy Phước, Bình Định (nay thuộc Gia Lai). Trục x: tây → đông; z: bắc → nam.
// Đồi thoải mọc cỏ và cây bụi; bậc đá đi lên từ phía nam: tháp Cổng ở sườn thấp, tháp Bia mái thuyền ở lưng chừng,
// tháp Chính (kalan) và tháp Hoả trên đỉnh. Phía tây là cánh đồng lúa và sông Kôn, quốc lộ 1 và cầu đường sắt ở xa.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, grp, label, person, signPost, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { BRICK2, kalan, saddleTower } from './nt_common.ts';

const GRASS = 0x9ab865, DRY = 0xb8b070, RICE = 0x8cc45a, PATHC = 0xc9b08a;
export function thapBanhIt(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.ground(GRASS, 900);
  // đồi: các tầng tròn thấp dần ra ngoài (mỗi tầng 1,6 m), đỉnh ở (0, 9.6, -40)
  const HX = 0, HZ = -40, tiers = [[70, 1.6], [56, 3.2], [44, 4.8], [33, 6.4], [24, 8.0], [16, 9.6]] as const;
  for (const [rad, h] of tiers) kit.add(cyl(h > 8 ? DRY : GRASS, HX, h / 2, HZ, rad, h, rad * 0.86));
  // bậc đá từ chân đồi phía nam lên đỉnh, có chiếu nghỉ ở các tầng
  // mép các tầng theo trục lối (x = 0): z = 20, 8, −2, −12, −19,4, −26,2
  const flights: [number, number, number][] = [[26, 20, 0], [14, 8, 1.6], [4, -2, 3.2], [-6, -12, 4.8], [-14, -19.4, 6.4], [-21, -26.2, 8]];
  for (const [z0, z1, y] of flights) kit.add(stairs(0xa89a7c, V(0, y, z0), V(0, y + 1.6, z1), 3.2, 5));
  // tháp Cổng ở sườn thấp (tầng 2), tháp Bia ở tầng 4 phía đông lối, tháp Chính + tháp Hoả trên đỉnh
  const cong = kalan(3.4, r, 1); cong.position.set(-7, 1.6, 15); cong.rotation.y = Math.PI / 2; kit.add(cong);
  const bia = saddleTower(5.2, 3.6, 4.4); bia.position.set(10, 6.4, -16); kit.add(bia);
  const chinh = kalan(7.2, r); chinh.position.set(-2, 9.6, -44); chinh.rotation.y = Math.PI / 2; kit.add(chinh);
  const hoa = saddleTower(6, 4, 5); hoa.position.set(10, 9.6, -38); hoa.rotation.y = Math.PI / 2; kit.add(hoa);
  kit.add(box(BRICK2, -2, 9.7, -30, 7, 0.2, 4));
  kit.live(label('Tháp Chính', -2, 26, -44, '#9c4a32', 0.9), label('Tháp Bia', 10, 16, -16, '#9c4a32', 0.7), label('Tháp Cổng', -7, 11, 15, '#9c4a32', 0.7));
  kit.add(signPost('Cụm tháp Bánh Ít', 4, 0, 40, '#9c4a32', 1));
  // cây bụi, keo lá tràm rải trên sườn đồi (tránh lối bậc)
  for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = 18 + r() * 52, x = HX + Math.cos(a) * d, z = HZ + Math.sin(a) * d * 0.86; if (Math.abs(x) < 6 && z > -34) continue; if (Math.hypot(x + 7, z - 15) < 6 || Math.hypot(x - 10, z + 16) < 7) continue; const tier = [...tiers].reverse().find(([rad]) => Math.hypot(x - HX, (z - HZ) / 0.86) < rad); const y = tier ? tier[1] : 0; if (r() < 0.5) kit.add(grp(x, y, z, 0, ...[0, 1, 2].map((k) => box(0x6f8f4a, (r() - 0.5) * 1.4, 0.4 + k * 0.1, (r() - 0.5) * 1.4, 1 + r(), 0.8, 1 + r())))); else { const t = tree(r, 0.9 + r() * 0.6, true); t.position.set(x, y, z); kit.add(t); } }
  // ---- đồng lúa và sông Kôn phía tây, quốc lộ và cầu đường sắt
  for (let i = 0; i < 24; i++) { const x = -180 + (i % 6) * 22, z = -120 + Math.floor(i / 6) * 40; if (Math.hypot(x - HX, z - HZ) < 80) continue; kit.add(box(i % 3 ? RICE : 0x7ab850, x, 0.05, z, 20, 0.1, 36), box(0x8a7a4a, x + 10.5, 0.15, z, 1, 0.3, 36)); }
  kit.add(box(0x5f8a7a, -260, -2.4, 0, 60, 1, 900)); kit.water(0x6f9fa8, -260, 0, 56, 900, -0.4, 0.92);
  kit.add(box(0x5a5d62, 90, 0.03, 0, 14, 0.06, 900)); for (let z = -400; z < 400; z += 10) kit.add(box(0xf4f1ea, 90, 0.07, z, 0.2, 0.02, 4));
  kit.add(box(0x6a5a4a, -260, 6, 40, 70, 1.2, 5)); for (let i = 0; i < 6; i++) kit.add(box(0x8a8a8a, -290 + i * 12, 3, 40, 1.4, 6, 4)); for (let i = 0; i < 7; i++) kit.add(box(0x5a6a7a, -292 + i * 10, 7.4, 40, 1.4, 2.4, 4.4));
  for (let i = 0; i < 4; i++) { const p = person(i, 1, [0xffd23f, 0x4aa3d8, 0xe2573c, 0xf3ead2][i]); p.position.set(-140 + i * 9, 0, -40 + (i % 2) * 6); p.rotation.x = 0.5; kit.add(p); }
  for (let i = 0; i < 8; i++) kit.add(forestMountain(i % 2 ? 0x5d8f6a : 0x6a9c70, -400 + i * 110, -420 - r() * 60, 100, 60 + r() * 50, r));
  for (let i = 0; i < 4; i++) kit.add(forestMountain(0x6a9c70, 420, -200 + i * 140, 100, 50 + r() * 40, r));
  for (let i = 0; i < 30; i++) { const t = tree(r, 1.3 + r() * 0.5); t.position.set(40 + r() * 40, 0, 40 + r() * 140); kit.add(t); }

  const path = [V(4, 0, 46), V(0, 0, 28), V(0, 1.6, 18), V(0, 1.6, 15), V(0, 3.2, 6), V(0, 3.2, 5), V(0, 4.8, -3), V(0, 4.8, -5), V(0, 6.4, -13), V(0, 8.0, -20.5), V(0, 9.6, -27), V(-14, 9.6, -36), V(-14, 9.6, -48)];
  return {
    path, half: 1.6, npcs: 6, startYaw: 0,
    stops: [
      { id: 'chan_doi', at: V(2, 0, 38), look: V(-2, 16, -44) },
      { id: 'thap_cong', at: V(0, 1.6, 15), look: V(-7, 5, 15), cam: V(6, 6, 26) },
      { id: 'thap_bia', at: V(1, 6.4, -13), look: V(10, 9, -16), cam: V(-7, 12, -3) },
      { id: 'thap_chinh', at: V(-12, 9.6, -32), look: V(-2, 16, -44), cam: V(-20, 13, -20) },
      { id: 'nhin_song_kon', at: V(-14, 9.6, -48), look: V(-200, 0, -40) },
    ],
    sky: [0x6fb3e6, 0xf6eed8], fog: [0xe8ecdc, 90, 520],
    light: { ambient: 1.55, sun: 1.7, sunColor: 0xffe8c4, sunDir: [-0.5, 0.8, 0.5] },
    shopSpots: [V(10, 0, 44), V(-6, 0, 46)],
  };
}
