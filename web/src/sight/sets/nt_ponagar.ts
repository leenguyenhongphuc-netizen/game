// Tháp Bà Ponagar trên đồi Cù Lao, Nha Trang, Khánh Hòa. Trục x: tây → đông; z: bắc → nam. Sông Cái ở phía NAM chân đồi.
// Khách lên bậc đá từ phía đông, qua tiền đình (mandapa) còn hai hàng cột gạch tròn ở tầng giữa, lên tầng trên cùng có tháp chính
// cao ~23 m và các tháp phụ, rồi ra mép sân nhìn xuống cửa sông Cái, cầu Xóm Bóng và thuyền đánh cá.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, label, palm, person, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { coracle, fishingBoat } from './_extra.ts';
import { BRICK, BRICK2, kalan, saddleTower } from './nt_common.ts';

const STONE = 0xa89a7c, GRASS = 0x8ab45e;
export function ponagar(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.ground(GRASS, 900);
  // ba tầng nền: tầng dưới (y 2), tầng giữa có mandapa (y 5), tầng trên có tháp (y 9); tường kè đá ong
  kit.add(box(STONE, 0, 1, -20, 90, 2, 70), box(STONE, -4, 3.5, -26, 64, 3, 50), box(0xbcae90, -10, 7, -34, 46, 4, 34));
  kit.add(stairs(STONE, V(52, 0, -20), V(45, 2, -20), 5, 8), stairs(STONE, V(36, 2, -20), V(28, 5, -20), 5, 10), stairs(STONE, V(18, 5, -24), V(13, 9, -24), 4, 14));
  // tiền đình: 2 hàng × 5 cột gạch tròn to, đứng trơ không mái
  for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) kit.add(cyl(BRICK, 26 - i * 3.4, 5 + 3.2, -24 + sz * 5, 0.75, 6.4), cyl(BRICK2, 26 - i * 3.4, 5 + 6.5, -24 + sz * 5, 0.9, 0.3));
  // tháp chính lớn, tháp nam, tháp tây bắc, tháp mái thuyền
  const main = kalan(10.5, r); main.position.set(-8, 9, -30); kit.add(main);
  const t2 = kalan(5.6, r); t2.position.set(-8, 9, -44); kit.add(t2);
  const t3 = kalan(4.4, r, 1); t3.position.set(-24, 9, -40); kit.add(t3);
  const t4 = saddleTower(6.4, 4, 5); t4.position.set(-22, 9, -24); kit.add(t4);
  kit.live(label('Tháp chính · Po Inư Nagar', -8, 34, -30, '#9c4a32', 1.0));
  // người đi lễ, khay lễ vật
  for (let i = 0; i < 10; i++) { const p = person(i, i % 3 === 0 ? 1 : 0, [0xf3ead2, 0xd9a83a, 0xe2573c, 0x9b7fd6][i % 4]); p.position.set(i < 5 ? 16 + (i % 5) * 3 : -4 + (i % 5) * 3, i < 5 ? 5 : 9, i < 5 ? -21 : -18); kit.add(p); }
  // ---- sông Cái phía nam, cầu Xóm Bóng, thuyền đánh cá, thuyền thúng
  kit.add(box(0x2a5f7a, 0, -2.4, 60, 900, 1, 70)); kit.water(0x3f8fb0, 0, 60, 900, 70, -0.4, 0.92);
  kit.add(box(0xcfc8b8, -40, 3, 60, 8, 0.8, 72)); for (let i = 0; i < 6; i++) kit.add(box(0xb8b0a0, -40, 1.2, 28 + i * 13, 6, 3, 2));
  for (let i = 0; i < 5; i++) { const f = fishingBoat([0x2a6f9a, 0x18a558, 0xd2301e, 0x2a6fbf, 0xffd23f][i], 0xf4f1ea, 11); f.position.set(-10 + i * 16, -0.3, 52 + (i % 2) * 10); f.rotation.y = 0.3 * i; kit.add(f); }
  for (let i = 0; i < 6; i++) { const c = coracle(1.1); c.position.set(30 + i * 5, -0.3, 44); kit.add(c); }
  kit.live(label('Cầu Xóm Bóng', -40, 10, 60, '#2d6f73', 0.9));
  // phố phía bắc, đồi và núi xa, hàng dừa ven sông
  for (let i = 0; i < 14; i++) { const x = -120 + i * 18, h = 8 + r() * 10; kit.add(box([0xf1e3b8, 0xd9e6ee, 0xe9d2c0][i % 3], x, h / 2, -110 - r() * 20, 12, h, 12)); }
  for (let i = 0; i < 20; i++) { const p = palm(r, 7 + r() * 3); p.position.set(-120 + i * 12, 0, 22); kit.add(p); }
  for (let i = 0; i < 30; i++) { const t = tree(r, 1.2 + r() * 0.6); const x = -70 + r() * 140, z = -100 + r() * 40; if (x > -40 && x < 50 && z > -64) continue; t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 6; i++) kit.add(forestMountain(0x5d8f6a, -380 + i * 140, -360, 120, 90 + r() * 50, r));
  void BRICK2;

  const path = [V(70, 0, -18), V(56, 0, -20), V(52, 0, -20), V(45, 2, -20), V(36, 2, -20), V(28, 5, -20), V(22, 5, -24), V(18, 5, -24), V(13, 9, -24), V(4, 9, -20), V(0, 9, -20), V(-12, 9, -20), V(-26, 9, -18), V(-30, 9, -20)];
  return {
    path, half: 1.8, npcs: 9, startYaw: -Math.PI / 2,
    stops: [
      { id: 'bac_da', at: V(56, 0, -20), look: V(-8, 20, -30) },
      { id: 'mandapa', at: V(27, 5, -24), look: V(16, 8, -24), cam: V(38, 10, -36) },
      { id: 'thap_chinh', at: V(4, 9, -20), look: V(-8, 18, -30), cam: V(16, 12, -10) },
      { id: 'thap_nam', at: V(-12, 9, -20), look: V(-22, 8, -30), cam: V(-2, 13, -6) },
      { id: 'nhin_song_cai', at: V(-26, 9, -18), look: V(-40, 2, 60) },
    ],
    sky: [0x4aa0ea, 0xe6f2f8], fog: [0xdcecf4, 120, 700],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff0d0, sunDir: [0.7, 0.9, 0.2] },
    shopSpots: [V(62, 0, -26), V(60, 0, -12)],
  };
}
