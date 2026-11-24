// Miếu Bà Chúa Xứ núi Sam, Châu Đốc. Quảng trường phía nam → miếu Bà mái ba tầng ngói xanh lưu ly (chữ "quốc") →
// lăng Thoại Ngọc Hầu bên kia đường, dựa lưng vào núi → chân núi Sam. Núi Sam nằm phía bắc cảnh. Trục x: tây → đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cyl, grp, incenseUrn, label, lantern, person, stairs, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { land, nearPath, redLantern } from './nb__kit.ts';

const PAVE = 0xd8d0c0, WALL = 0xf2e2b0, GREEN_TILE = 0x3f8a6a, GOLD = 0xffd24a, RED = 0xc8322a;

export function baChuaXu(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -300, -300, 300, 300, 0x6aa04c, 0, false);
  // núi Sam phía bắc
  const sam = new THREE.Mesh(new THREE.CylinderGeometry(40, 150, 90, 32, 3), new THREE.MeshLambertMaterial({ color: 0x4f7a42 })); sam.position.set(0, 44.9, -170); kit.add(sam);
  for (let i = 0; i < 50; i++) { const a = r() * 3.14 + 3.14, d = 50 + r() * 100; kit.add(ball([0x3f6a36, 0x5a8a48][i % 2], Math.cos(a) * d, 90 * (150 - d) / 110 - 2, -170 + Math.sin(a) * d * -1, 6 + r() * 6, 3, 6 + r() * 6)); }
  // quảng trường và đường lớn
  kit.add(box(PAVE, 0, 0.04, 40, 90, 0.08, 50), box(0x5a5e63, 0, 0.02, -40, 300, 0.04, 12));
  // miếu Bà: ba lớp mái ngói xanh, cột đỏ, hoành phi vàng, đèn lồng đỏ
  const MX = 0, MZ = 6;
  const m = grp(MX, 0, MZ);
  m.add(box(0xe8e0d0, 0, 0.5, 0, 34, 1, 26), box(WALL, 0, 3.6, 0, 28, 5.4, 20));
  m.add(templeRoof(GREEN_TILE, 0, 6.3, 0, 32, 2.4, 24, GOLD), box(WALL, 0, 8.4, 0, 16, 3, 12), templeRoof(GREEN_TILE, 0, 9.9, 0, 20, 2, 15, GOLD), box(WALL, 0, 11.6, 0, 8, 2.2, 7), templeRoof(GREEN_TILE, 0, 12.7, 0, 11, 1.8, 9, GOLD));
  for (let i = 0; i < 6; i++) m.add(cyl(RED, -12 + i * 4.8, 3.6, 11.2, 0.45, 5.2));
  m.add(box(0x8a2a1a, 0, 2.8, 10.05, 4, 4.4, 0.1), box(GOLD, 0, 5.6, 10.6, 8, 1, 0.12), box(RED, 0, 5.6, 10.66, 7.4, 0.7, 0.04));
  for (let i = 0; i < 6; i++) m.add(redLantern(-10 + i * 4, 5.2, 12, 1));
  kit.add(m); kit.live(label('Miếu Bà Chúa Xứ núi Sam', MX, 20, MZ, '#3f8a6a', 1.1));
  const urn = incenseUrn(); urn.position.set(0, 0, 26); urn.scale.setScalar(1.6); kit.add(urn);
  kit.motes(30, 0xe8e2d8, 2.4, () => V((r() - 0.5) * 2, 2.6 + r() * 6, 26 + (r() - 0.5) * 2), (p, i, _t, dt) => { p.y += dt * 0.8; p.x += Math.sin(p.y + i) * 0.01; if (p.y > 10) { p.y = 2.6; p.x = 0; } });
  for (let i = 0; i < 20; i++) kit.add(lantern(0xff4a2a, -40 + i * 4, 6 + Math.sin(i) * 0.3, 50));
  kit.add(cyl(0x6a6a6a, -42, 3, 50, 0.1, 6), cyl(0x6a6a6a, 40, 3, 50, 0.1, 6));
  // lăng Thoại Ngọc Hầu: bậc đá lên nền cao dựa lưng chân núi, cổng tam quan, mộ ba ngôi
  const LX = 0, LZ = -74, LY = 4;
  kit.add(box(0xb8b0a2, LX, LY / 2, -76.5, 60, LY, 37), stairs(0xb0a898, V(LX, 0, -48), V(LX, LY, -60), 6, 14));
  kit.add(grp(LX, LY, LZ + 6, 0, box(WALL, -6, 2.4, 0, 1.6, 4.8, 1.6), box(WALL, 6, 2.4, 0, 1.6, 4.8, 1.6), box(WALL, 0, 5, 0, 14, 1.2, 1.8), templeRoof(0x8f4a36, 0, 5.6, 0, 15, 1.4, 2.6, GOLD)));
  for (let i = 0; i < 3; i++) kit.add(grp(LX - 8 + i * 8, LY, LZ - 8, 0, box(0x9a948a, 0, 0.5, 0, 4, 1, 6), ball(0x8a847a, 0, 1.4, 0, 1.8, 1, 2.6), box(0x7a746a, 0, 1.6, -3.2, 2, 2.4, 0.4)));
  kit.live(label('Lăng Thoại Ngọc Hầu', LX, LY + 10, LZ, '#7a5a3a', 1));
  for (let i = 0; i < 30; i++) { const x = -140 + r() * 280, z = -100 + r() * 180; if (nearPath(path(), x, z, 8) || (Math.abs(x) < 36 && z > -90 && z < 70)) continue; const t = tree(r, 1.2 + r() * 0.5, r() < 0.4); t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 26; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.set(-30 + r() * 60, 0, 22 + r() * 36); p.rotation.y = Math.PI + (r() - 0.5); kit.add(p); }
  return {
    path: path(), half: 2.4, npcs: 4,
    stops: [
      { id: 'quang_truong', at: V(0, 0, 56), look: V(0, 8, 6), cam: V(8, 5, 70) },
      { id: 'mieu', at: V(0, 0, 30), look: V(0, 6, 16), cam: V(10, 5, 38) },
      { id: 'lang_thoai_ngoc_hau', at: V(0, LY, -62), look: V(LX, LY + 3, LZ + 6), cam: V(8, LY + 5, -54) },
      { id: 'chan_nui', at: V(26, LY, -70), look: V(0, 40, -170), cam: V(34, LY + 9, -52) },
    ],
    sky: [0x78b8e8, 0xf2ecd8], fog: [0xe8e6d6, 140, 700],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.6] },
    shopSpots: [V(-20, 0, 46), V(20, 0, 46), V(-16, 0, -44)],
  };
}
function path(): THREE.Vector3[] { return [V(0, 0, 76), V(0, 0, 56), V(0, 0, 30), V(14, 0, 22), V(40, 0, 10), V(30, 0, -36), V(0, 0, -44), V(0, 0, -48), V(0, 4, -60), V(0, 4, -62), V(26, 4, -70)]; }
