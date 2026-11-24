// Cù lao Thới Sơn (sông Tiền, Mỹ Tho). Bến ghe → lối đất giữa vườn trái cây → nhà đờn ca tài tử → bờ rạch dừa nước có
// xuồng ba lá chèo tay. Sông Tiền ở phía nam (z dương). Trục x: tây → đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, bead, box, cyl, gable, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { nipa } from './_extra.ts';
import { coconut, land, nearPath, river, riverZ, rowBoat, stiltHouse } from './nb__kit.ts';

const LANE = 0xc8ab7a, FRUIT = [0xffd23f, 0xd2301e, 0x8fbf3a, 0xff8a3d];
function fruitTree(r: () => number): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0x6a5038, 0, 1.2, 0, 0.18, 2.4), bead([0x3f7a3a, 0x4f8a3e][Math.floor(r() * 2)], 0, 3.2, 0, 2.2 + r() * 0.6, 1.6, 2.2 + r() * 0.6));
  const c = FRUIT[Math.floor(r() * 4)]; for (let i = 0; i < 5; i++) g.add(bead(c, (r() - 0.5) * 3, 2.2 + r() * 1.6, (r() - 0.5) * 3, 0.16));
  return g;
}

export function thoiSon(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -220, -220, 66, 60, 0x6aa04c, 0, false); land(kit, 74, -220, 220, 60, 0x6aa04c, 0, false);
  river(kit, 120, 120, -400, 400); // sông Tiền
  land(kit, -400, 180, 400, 260, 0x7aa85a, 0, false); // bờ Mỹ Tho xa
  for (let i = 0; i < 10; i++) { const h = 8 + r() * 18; kit.add(box(0xd8d4ca, -300 + i * 60, h / 2, 220, 14, h, 10)); }
  // rạch dừa nước xuyên cù lao, chạy dọc z ở x = 70
  riverZ(kit, 70, 7, -200, 60);
  // cầu tàu bến ghe ở bờ nam
  kit.add(box(0x8a6a48, -90, 0.1, 66, 6, 0.2, 14)); for (let z = 60; z <= 72; z += 4) kit.add(cyl(0x6a5038, -92.6, -0.6, z, 0.12, 1.6), cyl(0x6a5038, -87.4, -0.6, z, 0.12, 1.6));
  const ghe = grp(-80, -0.55, 70, Math.PI / 2, box(0x2f6a8a, 0, 0.5, 0, 3, 1.2, 14), box(0xe8e0d0, 0, 1.8, 1, 2.6, 1.4, 8), box(0x8a3a2a, 0, 2.6, 1, 3, 0.15, 8.6)); kit.add(ghe);
  kit.live(label('Bến ghe cù lao Thới Sơn', -90, 6, 60, '#2f6a8a', 1));
  // lối đất làng
  const path = [V(-90, 0, 72), V(-90, 0, 54), V(-70, 0, 40), V(-40, 0, 30), V(-10, 0, 20), V(20, 0, 18), V(44, 0, 10), V(62, 0, 0), V(64, 0, -20), V(62, 0, -44)];
  for (let i = 1; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5); kit.add(box(LANE, m.x, 0.02, m.z, 3.4, 0.04, a.distanceTo(b) + 2, Math.atan2(b.x - a.x, b.z - a.z))); }
  const near = (x: number, z: number, d: number) => nearPath(path, x, z, d);
  // vườn trái cây có mương nước
  for (let i = 0; i < 110; i++) { const x = -200 + r() * 260, z = -200 + r() * 250; if (near(x, z, 9) || (x > 60 && x < 80)) continue; const t = r() < 0.65 ? fruitTree(r) : coconut(r, 7 + r() * 4); t.position.set(x, 0, z); kit.add(t); }
  for (let k = 0; k < 6; k++) kit.add(box(0x6a7a4a, -60 + k * 16, -0.2, -60, 2, 0.4, 90));
  // nhà vườn: bàn trà mật ong, chòi đờn ca tài tử
  const HX = -40, HZ = 14;
  const h = stiltHouse(r, 0, 9, 7); h.position.set(HX, -1.2, HZ - 6); kit.add(h);
  kit.add(box(0x8a6a48, HX + 10, 0.8, HZ + 2, 4, 0.1, 2), cyl(0x6a5038, HX + 10, 0.4, HZ + 2, 0.12, 0.8)); for (let i = 0; i < 6; i++) kit.add(cyl(0xd8a040, HX + 8.6 + i * 0.5, 0.95, HZ + 2, 0.12, 0.2));
  const DX = 18, DZ = 6;
  kit.add(box(0x9a7150, DX, 0.3, DZ, 9, 0.6, 6), gable(0xa08a62, DX, 4, DZ, 6.6, 1.8, 10, Math.PI / 2)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0x6a5038, DX + sx * 4.2, 2, DZ + sz * 2.8, 0.12, 4));
  const band = [[0xf3ead2, 'đàn kìm'], [0x3f6f8f, 'đàn tranh'], [0x8a4a6a, 'ca']] as const;
  band.forEach(([c], i) => { const p = person(i + 4, 0, c); p.scale.setScalar(0.85); p.position.set(DX - 3 + i * 3, 0.6, DZ - 1); kit.add(p); if (i < 2) kit.add(box(0x8a5a2a, DX - 3 + i * 3, 1.4, DZ - 0.2, 1.1, 0.12, 0.3)); });
  kit.live(label('Đờn ca tài tử', DX, 7.4, DZ, '#8a4a6a', 0.9));
  // bờ rạch: dừa nước rợp hai bên, xuồng ba lá chèo tay chở khách
  for (let z = -190; z < 50; z += 3.2) for (const x of [65.6, 74.4]) { if (nearPath(path, x, z, 3.6)) continue; const n = nipa(r, 4 + r() * 2); n.position.set(x + (r() - 0.5) * 0.6, -0.5, z); kit.add(n); if (r() < 0.25) { const c = coconut(r, 7 + r() * 3); c.position.set(x + (x < 70 ? -2.5 : 2.5), 0, z); kit.add(c); } }
  const boats: THREE.Object3D[] = []; for (let i = 0; i < 4; i++) { const b = baked(rowBoat(i)); kit.live(b); boats.push(b); }
  kit.onTick((t) => boats.forEach((b, i) => { const k = ((t * 0.015 + i / 4) % 1); b.position.set(70 + (i % 2 ? 1.2 : -1.2), -0.55, -190 + k * 240); b.rotation.y = i % 2 ? 0 : Math.PI; }));
  for (let i = 0; i < 8; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.copy(path[2 + (i % 7)]); p.position.x += 2; p.rotation.y = r() * 6.28; kit.add(p); }
  kit.live(label('Rạch dừa nước', 70, 5, -30, '#3a6a3a', 0.9));
  return {
    path, half: 1.8, npcs: 4,
    stops: [
      { id: 'ben_ghe', at: V(-90, 0, 64), look: V(-80, 1.5, 70), cam: V(-96, 4, 56) },
      { id: 'vuon_trai_cay', at: V(-40, 0, 30), look: V(HX + 10, 1, HZ + 2), cam: V(-34, 4, 38) },
      { id: 'don_ca', at: V(20, 0, 18), look: V(DX, 2, DZ), cam: V(24, 4, 26) },
      { id: 'rach_dua', at: V(64, 0, -20), look: V(70, 0, -40), cam: V(60, 4, -12) },
      { id: 'loi_ra', at: V(62, 0, -44), look: V(70, 1, -60), cam: V(58, 4, -36) },
    ],
    sky: [0x78b8e8, 0xf0ecd8], fog: [0xe8e6d0, 110, 560],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(-84, 0, 50), V(0, 0, 24), V(58, 0, 4)],
  };
}
