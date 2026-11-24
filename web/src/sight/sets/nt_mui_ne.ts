// Đồi cát bay Mũi Né, Phan Thiết (nay thuộc Lâm Đồng). Trục x: tây → đông; z: bắc → nam. Biển ở phía NAM.
// Khách vào từ đường Huỳnh Thúc Kháng phía nam, leo lên các đồi cát vàng đỏ gợn sóng gió, lên đỉnh ngắm biển, xem trẻ em trượt cát,
// xe địa hình chạy quanh triền cát, rồi xuống làng chài Mũi Né có hàng trăm thuyền thúng neo sát bờ.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, grp, label, palm, person, signPost } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { baked, coracle, fishingBoat } from './_extra.ts';
import { cactus, dune, duneHeight } from './nt_common.ts';

const SAND = 0xe8b878, SAND2 = 0xdca468, SAND3 = 0xf0c88a;
function atv(c: number) { return grp(0, 0, 0, 0, box(c, 0, 0.7, 0, 1.2, 0.5, 2), box(0x2a2a2a, 0, 1.1, -0.2, 0.5, 0.3, 0.6), ...[-0.7, 0.7].flatMap((z) => [-0.7, 0.7].map((x) => box(0x1f1f1f, x, 0.35, z, 0.3, 0.7, 0.7))), person(3, 2, 0xe2573c).translateY(0.5)); }
export function muiNe(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.add(box(SAND, 0, -0.5, -60, 700, 1, 400), box(0xeedcb0, 0, -0.5, 170, 700, 1, 60));
  kit.add(box(0x1c7fa0, 0, -3, 360, 900, 1, 320)); kit.water(0x2a96b8, 0, 330, 900, 380, -0.35, 0.9);
  // các đồi cát: sườn đón gió thoải (phía đông), dốc sau khuất gió; đồi lớn ở giữa là chỗ trượt
  const dunes: [number, number, number, number, number, number][] = [[0, -40, 52, 11, 52, 0], [-80, -60, 44, 9, 40, -0.2], [80, -90, 54, 11, 44, 0.5], [-30, -140, 64, 14, 60, 0.1], [70, -170, 50, 10, 40, -0.4], [-120, -150, 44, 8, 36, 0.6]];
  const ground = (x: number, z: number) => Math.max(0, ...dunes.map(([cx, cz, rx, h, rz, ry]) => { const dx = x - cx, dz = z - cz, c = Math.cos(ry), s = Math.sin(ry); return duneHeight(dx * c - dz * s, dx * s + dz * c, rx, h, rz); }));
  const G = (x: number, z: number) => V(x, ground(x, z), z);
  dunes.forEach(([x, z, rx, h, rz, ry], i) => kit.add(dune([SAND, SAND2, SAND3][i % 3], x, z, rx, h, rz, ry)));
  // vết bánh xe, gợn cát, bụi cỏ, xương rồng ở chân đồi
  for (let i = 0; i < 30; i++) kit.add(box(SAND2, -100 + r() * 200, 0.02, 20 + r() * 40, 0.3, 0.04, 6 + r() * 6, r() * 3));
  for (let i = 0; i < 30; i++) { const c = cactus(0.6 + r() * 0.5); c.position.set(-160 + r() * 320, 0, 30 + r() * 30); if (Math.abs(c.position.x) > 20) kit.add(c); }
  // trẻ em trượt cát trên tấm nhựa
  const sliders = [0, 1, 2].map((i) => { const s = baked(grp(0, 0, 0, 0, box([0xe2573c, 0x2a6fbf, 0xffd23f][i], 0, 0.1, 0, 0.8, 0.05, 1.4), person(i + 4, 0, 0xffd23f).translateY(-0.3).rotateX(-0.6))); kit.live(s); return s; });
  kit.onTick((t) => sliders.forEach((s, i) => { const k = ((t * 0.18 + i * 0.33) % 1); const x = -8 + i * 6, z = -44 + k * 34; s.position.set(x, ground(x, z) + 0.1, z); s.rotation.x = -0.3; }));
  // xe địa hình chạy vòng quanh triền cát
  const atvs = [0, 1, 2, 3].map((i) => { const a = baked(atv([0xd2301e, 0xffd23f, 0x2a6fbf, 0x18a558][i])); kit.live(a); return a; });
  kit.onTick((t) => atvs.forEach((a, i) => { const ang = t * 0.18 + i * 1.57; const x = 100 + Math.cos(ang) * 34, z = 0 + Math.sin(ang) * 16; a.position.set(x, ground(x, z), z); a.rotation.y = -ang; }));
  kit.live(label('Đồi cát bay', 0, 22, -40, '#c06a2e', 1.1), label('Xe địa hình', 100, 8, 0, '#7a4a22', 0.7));
  // đường ven biển và làng chài phía nam: dừa, nhà mái tôn, thuyền thúng kín bờ, thuyền đánh cá ngoài khơi
  kit.add(box(0x5a5d62, 0, 0.03, 76, 700, 0.06, 10));
  for (let i = 0; i < 14; i++) { const x = -150 + i * 22, c = [0xf1e3b8, 0xd9e6ee, 0xe9d2c0][i % 3]; kit.add(box(c, x, 2.2, 100, 10, 4.4, 9), box([0x2a6fbf, 0xd2301e, 0x18a558][i % 3], x, 4.6, 100, 11, 0.3, 10)); }
  for (let i = 0; i < 16; i++) { const p = palm(r, 7 + r() * 3); p.position.set(-160 + i * 21, 0, 86); kit.add(p); }
  for (let i = 0; i < 40; i++) { const c = coracle(1.1 + r() * 0.2, 0xe2c58a, [0x2a5f8a, 0x6a5038, 0x18a558][i % 3]); c.position.set(-60 + (i % 10) * 6 + r(), -0.3, 160 + Math.floor(i / 10) * 7 + r() * 2); kit.add(c); }
  for (let i = 0; i < 5; i++) { const f = fishingBoat([0x2a6f9a, 0x18a558, 0xd2301e, 0x2a6fbf, 0xffd23f][i], 0xf4f1ea, 11); f.position.set(-80 + i * 40, -0.3, 230 + (i % 2) * 20); f.rotation.y = 0.5 * i; kit.add(f); }
  for (let i = 0; i < 6; i++) { const p = person(i, 1, [0x9b7fd6, 0x4aa3d8, 0xe2573c][i % 3]); p.position.set(-30 + i * 4, 0, 150); kit.add(p); }
  kit.live(label('Làng chài Mũi Né', 0, 10, 156, '#2d6f73', 0.9));
  kit.add(signPost('Đồi cát bay', 6, 0, 66, '#c06a2e', 1));
  for (let i = 0; i < 8; i++) { const p = person(i + 2, i % 2 ? 2 : 0, [0xf29bc0, 0x7ccf4f, 0x4aa3d8, 0xffd23f][i % 4]); const x = -14 + r() * 28, z = -8 + r() * 10; p.position.set(x, ground(x, z), z); kit.add(p); }

  const path = [G(0, 72), G(0, 40), G(0, 14), G(0, 0), G(0, -20), G(2, -40), G(-8, -50), G(-16, -24), G(-20, 0), G(30, 14), G(60, 14), G(30, 40), G(0, 120), G(-4, 150)];
  return {
    path, half: 2, npcs: 10, startYaw: 0,
    stops: [
      { id: 'chan_doi', at: V(0, 0, 20), look: V(0, 10, -40) },
      { id: 'dinh_doi', at: G(2, -40), look: V(0, 0, 220) },
      { id: 'truot_cat', at: G(-16, -24), look: V(-2, 6, -26) },
      { id: 'xe_dia_hinh', at: G(60, 14), look: V(90, 1, -20) },
      { id: 'lang_chai', at: V(-4, 0, 150), look: V(-30, 0, 170) },
    ],
    sky: [0x3a9eea, 0xf6eedc], fog: [0xf0e6d4, 140, 760],
    light: { ambient: 1.6, sun: 2.0, sunColor: 0xfff0cc, sunDir: [0.5, 0.9, 0.6] },
    shopSpots: [V(-10, 0, 62), V(12, 0, 62), V(-12, 0, 130)],
  };
}
