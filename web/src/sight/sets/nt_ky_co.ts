// Kỳ Co – Eo Gió, bán đảo Phương Mai, Quy Nhơn (nay thuộc Gia Lai). Trục x: tây → đông (biển ở phía ĐÔNG); z: bắc → nam.
// Phía bắc là Eo Gió: hai mỏm núi đá ôm lấy eo biển, lối bê tông men vách có lan can, tượng Phật trắng trên mỏm đá bắc.
// Đi xuống phía nam tới bãi Kỳ Co nước xanh ngọc, cuối bãi là đá granite tròn chồng nhau; làng chài Nhơn Lý ở phía tây.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, grp, hill, label, lampPost, palm, person, signPost, strip } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { baked, basket, coracle, fishingBoat, umbrella } from './_extra.ts';
import { boulders, whiteStatue } from './nt_common.ts';

const SAND = 0xf4e6c0, WET = 0xe2cf9c, ROCK = [0x8a8278, 0x9a9288, 0x7d766c, 0xa59c90], SCRUB = [0x6f8f4a, 0x7f9a52, 0x8aa25a, 0x5f7f42];
export function kyCo(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  // biển: đáy thấp hẳn, nước nông màu ngọc sát bờ, xanh thẫm ngoài khơi
  kit.add(box(0x1c8fa8, 300, -2.4, 0, 600, 1, 900)); kit.water(0x2ec4c0, 110, 0, 140, 900, -0.25, 0.8); kit.water(0x1a6fa8, 360, 0, 360, 900, -0.3, 0.95);
  kit.add(box(SAND, -10, -0.5, 0, 100, 1, 900), box(WET, 42, -0.46, 10, 10, 1, 160), box(0xc9b08a, -160, -0.5, 0, 200, 1, 900));
  // sóng vỗ bờ Kỳ Co
  const waves = [0, 1, 2, 3].map((i) => { const m = box(0xffffff, 50, -0.12, 10, 1.2, 0.06, 150); m.userData.o = i * 8; kit.live(m); return m; });
  kit.onTick((t) => waves.forEach((w) => { const k = ((t * 2.6 + w.userData.o) % 32) / 32; w.position.x = 80 - k * 34; w.scale.x = 0.6 + (1 - k) * 2; }));
  // ---- Eo Gió: hai mỏm núi đá phủ cây bụi, khe biển giữa hai mỏm
  kit.add(hill(46, -196, 60, 30, 34, r, SCRUB), hill(96, -176, 34, 26, 26, r, SCRUB), hill(96, -74, 34, 22, 22, r, SCRUB), hill(-100, -190, 70, 50, 44, r, SCRUB));
  for (let i = 0; i < 70; i++) { const z = r() < 0.5 ? -140 + r() * 20 : -95 + r() * 18; kit.add(box(ROCK[i % 4], 40 + r() * 60, -1 + r() * 3, z, 2 + r() * 4, 2 + r() * 3, 2 + r() * 4, r() * 3)); }
  // lối bê tông men vách: bậc lên từ bãi xe, chạy dọc mép đá phía bắc eo, lan can trắng
  const walk = [V(0, 0, -150), V(14, 3, -140), V(30, 6, -136), V(48, 6, -132), V(62, 6.5, -124), V(70, 6.5, -112)];
  for (let i = 0; i < walk.length - 1; i++) { kit.add(strip(0xd8d2c4, walk[i], walk[i + 1], 3, 0.5)); kit.add(box(0x8a8278, (walk[i].x + walk[i + 1].x) / 2, walk[i].y - 2.2, (walk[i].z + walk[i + 1].z) / 2, 3.4, 4, 6)); }
  for (let i = 1; i < walk.length - 1; i++) for (let k = 0; k < 4; k++) { const p = walk[i].clone().lerp(walk[i + 1], k / 4); kit.add(cyl(0xf4f1ea, p.x + 1.4, p.y + 0.6, p.z + 1.2, 0.06, 1.2)); }
  for (let i = 1; i < walk.length - 1; i++) kit.add(strip(0xf4f1ea, walk[i].clone().setY(walk[i].y + 1.1).add(V(1.4, 0, 1.2)), walk[i + 1].clone().setY(walk[i + 1].y + 1.1).add(V(1.4, 0, 1.2)), 0.1, 0.1));
  kit.add(box(0xd8d2c4, 70, 6.2, -108, 8, 0.5, 6)); // đài ngắm cuối lối
  // tượng Phật trắng trên mỏm đá bắc nhìn ra biển
  kit.add(box(ROCK[0], 92, 4, -150, 12, 12, 12)); const st = whiteStatue(7); st.position.set(92, 10, -150); st.rotation.y = -Math.PI / 2; kit.add(st);
  kit.live(label('Eo Gió', 40, 16, -118, '#2d6f73', 1.0), label('Tượng Phật Tịnh xá Ngọc Hoà', 92, 24, -150, '#7a4a22', 0.8));
  kit.add(signPost('Eo Gió', -4, 0, -156, '#2d6f73', 1));
  // ---- bãi Kỳ Co: dù, người tắm, ca nô chở khách
  const UC = [0xe2573c, 0x2a6fbf, 0xffd23f, 0x18a558];
  for (let i = 0; i < 10; i++) { const u = umbrella(UC[i % 4]); u.position.set(14 + (i % 2) * 8, 0, -28 + Math.floor(i / 2) * 9); kit.add(u); }
  for (let i = 0; i < 8; i++) { const p = person(i, 0, UC[i % 4]); p.position.set(48 + r() * 18, -1.0, -30 + r() * 60); kit.add(p); }
  const boat = baked(grp(0, 0, 0, 0, box(0xf4f1ea, 0, 0.5, 0, 2.6, 1, 8), box(0x2a6fbf, 0, 1.1, 0, 2.7, 0.2, 8.2), box(0xf4f1ea, 0, 1.6, 1, 2, 1, 2.6), person(2, 2, 0xffd23f).translateY(1).translateZ(-2)));
  boat.position.set(90, -0.3, 0); kit.live(boat);
  kit.onTick((t) => { const k = (t * 0.05) % 1; boat.position.set(160 - k * 110, -0.3 + Math.sin(t * 2) * 0.08, -40 + Math.sin(k * 3) * 30); boat.rotation.y = 0.2; });
  kit.live(label('Bãi Kỳ Co', 30, 9, -10, '#1c8fa8', 1.0));
  // ---- bãi đá cuối bãi: granite tròn nhẵn chồng lên nhau
  boulders(kit, 50, 46, 26, 14, 2.6, ROCK); boulders(kit, 70, 60, 14, 10, 3.4, ROCK);
  kit.add(hill(60, 120, 60, 40, 30, r, SCRUB));
  // ---- làng chài Nhơn Lý phía tây: nhà mái tôn xanh đỏ, thuyền thúng, rổ cá phơi
  for (let i = 0; i < 12; i++) { const x = -40 - (i % 4) * 14, z = 30 + Math.floor(i / 4) * 16, c = [0xf1e3b8, 0xd9e6ee, 0xe9d2c0][i % 3]; kit.add(box(c, x, 2.2, z, 9, 4.4, 8), box([0x2a6fbf, 0xd2301e, 0x18a558][i % 3], x, 4.6, z, 10, 0.3, 9)); }
  for (let i = 0; i < 8; i++) { const c = coracle(1.1 + r() * 0.2); c.position.set(-6 + (i % 4) * 4, 0, 56 + Math.floor(i / 4) * 4.5); kit.add(c); }
  for (let i = 0; i < 6; i++) { const b = basket([0xb9c8d6, 0xd9a06a][i % 2], 1.1); b.position.set(-16 + i * 2, 0, 46); kit.add(b); }
  for (let i = 0; i < 3; i++) { const f = fishingBoat([0x2a6f9a, 0x18a558, 0xd2301e][i], 0xffd23f, 10); f.position.set(70 + i * 14, -0.3, 90 + i * 6); f.rotation.y = 0.4; kit.add(f); }
  for (let i = 0; i < 4; i++) { const p = person(i + 3, 1, [0x9b7fd6, 0x4aa3d8][i % 2]); p.position.set(-10 + i * 3, 0, 50); kit.add(p); }
  kit.live(label('Làng chài Nhơn Lý', -40, 9, 44, '#7a4a22', 0.9));
  for (let i = 0; i < 30; i++) { const p = palm(r, 6 + r() * 3); const z = -60 + r() * 170, x = -24 - r() * 40; if (Math.abs(z - 46) < 26 && x > -40) continue; p.position.set(x, 0, z); kit.add(p); }
  for (let z = -60; z < 30; z += 14) kit.add(lampPost(2, 0, z, 4, 0xfff3c4));

  const path = [V(-4, 0, -160), V(0, 0, -150), V(14, 3, -140), V(30, 6, -136), V(48, 6, -132), V(62, 6.5, -124), V(70, 6.5, -110), V(62, 6.5, -124), V(48, 6, -132), V(30, 6, -136), V(14, 3, -140), V(0, 0, -150), V(4, 0, -90), V(20, 0, -40), V(30, 0, 0), V(34, 0, 34), V(14, 0, 50), V(-4, 0, 50)];
  return {
    path, half: 2.2, npcs: 10, startYaw: 0.6,
    stops: [
      { id: 'eo_gio', at: V(48, 6, -132), look: V(60, 2, -110) },
      { id: 'tuong_phat', at: V(70, 6.5, -110), look: V(92, 14, -150) },
      { id: 'bai_ky_co', at: V(26, 0, -10), look: V(90, 0, -10), cam: V(30, 5, -2) },
      { id: 'bai_da', at: V(36, 0, 34), look: V(52, 2, 48) },
      { id: 'lang_chai', at: V(-4, 0, 50), look: V(-2, 0.5, 60), cam: V(-14, 7, 38) },
    ],
    sky: [0x2f94ee, 0xdff3fb], fog: [0xd6eef8, 140, 800],
    light: { ambient: 1.65, sun: 1.9, sunColor: 0xfff4d6, sunDir: [0.6, 1, 0.2] },
    shopSpots: [V(-8, 0, -148), V(6, 0, -30), V(-14, 0, 40)],
  };
}
