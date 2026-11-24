// Vịnh Vĩnh Hy, Ninh Hải, Ninh Thuận (nay thuộc Khánh Hòa). Trục x: tây → đông; z: bắc → nam. Vịnh mở ra biển ở phía ĐÔNG NAM.
// Cung đường ven biển chạy trên sườn núi phía bắc, đổ dốc xuống làng chài Vĩnh Hy ở đáy vịnh; bến có tàu đáy kính chạy vòng
// quanh rạn san hô, bè nuôi tôm hùm nổi giữa vịnh; bờ tây nam là bãi đá granite và rừng khô hạn Núi Chúa.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, grp, hill, label, person, signPost, strip } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { baked, coracle, fishingBoat } from './_extra.ts';
import { boulders, cactus } from './nt_common.ts';

const DRY = [0x9a9a5a, 0xa8a464, 0x8a8a52, 0xb0a870], ROCK = [0x9a9288, 0xa89f94, 0x8a8278, 0xb0a698], SAND = 0xeee0b8;
export function vinhHy(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.add(box(0x175f7a, 0, -4, 80, 900, 1, 700)); kit.water(0x1f9ab0, 0, 60, 900, 700, -0.35, 0.88);
  // núi Núi Chúa bao ba mặt vịnh (bắc, tây, nam), khô cằn màu cỏ cháy
  kit.add(hill(-40, -150, 160, 70, 70, r, DRY), hill(-200, 40, 80, 150, 60, r, DRY), hill(-40, 230, 160, 60, 55, r, DRY), hill(150, -170, 90, 50, 50, r, DRY));
  // bờ phía bắc: dải đất ven núi (y 0) có đường; làng chài và bến ở đáy vịnh phía tây bắc
  kit.add(box(SAND, -40, -0.5, -60, 260, 1, 60), box(SAND, -110, -0.5, 30, 60, 1, 140));
  // cung đường ven biển: dốc từ sườn núi (y 10) xuống làng
  const road = [V(120, 10, -80), V(70, 8, -76), V(30, 4, -70), V(0, 0.2, -62)];
  for (let i = 0; i < road.length - 1; i++) { kit.add(strip(0x5a5d62, road[i], road[i + 1], 7, 0.4)); kit.add(box(DRY[0], (road[i].x + road[i + 1].x) / 2, road[i].y / 2 - 1, (road[i].z + road[i + 1].z) / 2, 44, Math.max(1, road[i].y), 12)); }
  for (let i = 0; i < road.length - 1; i++) for (let k = 0; k < 6; k++) { const p = road[i].clone().lerp(road[i + 1], k / 6); kit.add(box(0xf4f1ea, p.x, p.y + 0.5, p.z + 3.8, 1.6, 0.6, 0.3), box(0xd2301e, p.x + 0.8, p.y + 0.5, p.z + 3.8, 0.8, 0.6, 0.32)); }
  kit.add(signPost('Vịnh Vĩnh Hy', 106, 10, -84, '#2d6f73', 1));
  // làng chài: nhà mái tôn, cầu cảng gỗ chìa ra vịnh
  for (let i = 0; i < 12; i++) { const x = -40 - (i % 6) * 13, z = -74 + Math.floor(i / 6) * 13, c = [0xf1e3b8, 0xd9e6ee, 0xe9d2c0][i % 3]; kit.add(box(c, x, 2.2, z, 9, 4.4, 9), box([0x2a6fbf, 0xd2301e, 0x18a558][i % 3], x, 4.6, z, 10, 0.3, 10)); }
  kit.add(strip(0x8a6a48, V(-10, 0.3, -38), V(-10, 0.3, 0), 4, 0.4)); for (let i = 0; i < 8; i++) kit.add(cyl(0x5a3d26, -12 + (i % 2) * 4, -1, -34 + Math.floor(i / 2) * 10, 0.2, 3));
  for (let i = 0; i < 6; i++) { const f = fishingBoat([0x2a6f9a, 0x18a558, 0xd2301e][i % 3], 0xf4f1ea, 9); f.position.set(-40 + i * 14, -0.3, -20 + (i % 2) * 12); f.rotation.y = 1.2 + i * 0.3; kit.add(f); }
  for (let i = 0; i < 8; i++) { const c = coracle(1.1); c.position.set(-30 + i * 4, -0.3, -30); kit.add(c); }
  kit.live(label('Bến Vĩnh Hy', -10, 7, -20, '#2d6f73', 0.9));
  // tàu đáy kính chạy vòng quanh rạn san hô
  const glass = baked(grp(0, 0, 0, 0, box(0xf4f1ea, 0, 0.6, 0, 3.4, 1.2, 10), box(0x2a6fbf, 0, 1.3, 0, 3.5, 0.2, 10.2), box(0x9fd8ea, 0, 0.1, 0, 2.4, 0.1, 6), box(0xf4f1ea, 0, 2.4, 0, 3.2, 0.15, 8), ...[-1, 1].flatMap((s) => [cyl(0xd8d2c4, s * 1.5, 1.8, -3, 0.06, 1.2), cyl(0xd8d2c4, s * 1.5, 1.8, 3, 0.06, 1.2)]), ...[0, 1, 2, 3].map((i) => person(i, 2).translateY(0.7).translateZ(-3 + i * 2))));
  kit.live(glass); kit.onTick((t) => { const a = t * 0.08; glass.position.set(40 + Math.cos(a) * 34, -0.3 + Math.sin(t * 1.6) * 0.05, 40 + Math.sin(a) * 24); glass.rotation.y = -a; });
  // rạn san hô thấy qua nước trong (ngay dưới mặt nước)
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = r() * 30; kit.add(box([0xe2573c, 0xffd23f, 0xff8fc8, 0x7fe0c0, 0x9b7fd6][i % 5], 40 + Math.cos(a) * d, -1.6, 40 + Math.sin(a) * d * 0.7, 1 + r() * 2, 0.6 + r(), 1 + r() * 2, r() * 3)); }
  // bè nuôi tôm hùm: khung gỗ nổi, chòi canh mái lá
  for (let i = 0; i < 4; i++) { const x = 80 + (i % 2) * 22, z = -10 + Math.floor(i / 2) * 20; kit.add(box(0x8a6a48, x, 0, z, 16, 0.4, 14)); for (let k = 0; k < 4; k++) kit.add(box(0x3a5a6a, x - 5 + (k % 2) * 10, -0.1, z - 3 + Math.floor(k / 2) * 6, 5, 0.3, 4)); kit.add(box(0xb8955a, x, 1.6, z, 4, 2.8, 4), box(0x8a6a3a, x, 3.2, z, 5, 0.4, 5)); }
  kit.live(label('Bè nuôi tôm hùm', 91, 8, 0, '#7a4a22', 0.8));
  // bãi đá ven vịnh phía tây nam, xương rồng và cây bụi khô
  kit.add(box(SAND, -70, -0.5, 90, 80, 1, 60)); boulders(kit, -70, 110, 30, 16, 3, ROCK); boulders(kit, -40, 120, 12, 8, 4, ROCK);
  for (let i = 0; i < 40; i++) { const c = cactus(0.8 + r() * 0.6); c.position.set(-140 + r() * 40, 0, -40 + r() * 140); kit.add(c); }
  kit.add(strip(SAND, V(-100, 0, -40), V(-90, 0, 70), 4, 0.05));
  for (let i = 0; i < 6; i++) { const p = person(i, 1, [0x4aa3d8, 0xe2573c, 0xffd23f][i % 3]); p.position.set(-30 + i * 5, 0, -50); kit.add(p); }

  const path = [V(120, 10, -80), V(70, 8, -76), V(30, 4, -70), V(0, 0.2, -62), V(-10, 0, -46), V(-10, 0.3, -36), V(-10, 0.3, -4), V(-10, 0.3, -36), V(-30, 0, -44), V(-90, 0, -40), V(-96, 0, 20), V(-90, 0, 70), V(-76, 0, 84)];
  return {
    path, half: 2.2, npcs: 8, startYaw: -Math.PI / 2,
    stops: [
      { id: 'deo', at: V(90, 9, -78), look: V(20, 0, 30) },
      { id: 'ben_vinh_hy', at: V(-10, 0, -46), look: V(-30, 2, -66) },
      { id: 'tau_day_kinh', at: V(-10, 0.3, -6), look: V(40, 0, 40) },
      { id: 'be_nuoi', at: V(-10, 0.3, -16), look: V(91, 2, 0) },
      { id: 'bai_da', at: V(-76, 0, 84), look: V(-70, 3, 110) },
    ],
    sky: [0x2f94ee, 0xe2f2fb], fog: [0xd6ecf6, 160, 900],
    light: { ambient: 1.6, sun: 2.0, sunColor: 0xfff2d4, sunDir: [0.4, 1, 0.3] },
    shopSpots: [V(0, 0, -52), V(-24, 0, -50), V(-92, 0, 30)],
  };
}
