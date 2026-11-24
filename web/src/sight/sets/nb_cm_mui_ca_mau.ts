// Mũi Cà Mau. Lối gỗ xuyên rừng đước → cột mốc toạ độ GPS 0001 → biểu tượng con tàu hướng ra biển → tháp ngắm cảnh
// nhìn nơi biển Đông gặp vịnh Thái Lan. Đất mũi nhô về phía nam (z dương), biển bao ba phía.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cone, cyl, flag, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { land, mangrove, nearPath } from './nb__kit.ts';

const DECK = 0x8a6a48, MUD = 0x7a6a50, SEA = 0x5a8aa0, CONC = 0xe8e4dc;

export function muiCaMau(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.add(box(0x3a4a4a, 0, -3, 0, 900, 1, 900)); kit.water(SEA, 0, 0, 900, 900, -0.7, 0.9);
  // bãi bùn rừng đước (thấp, ngập triều) và nền đất khu tham quan
  kit.add(box(MUD, 0, -0.6, -60, 260, 0.6, 220));
  land(kit, -40, 30, 40, 80, 0x8aa86a, 0, false);
  const path = [V(0, 0, -130), V(0, 0.4, -110), V(-14, 0.4, -80), V(10, 0.4, -50), V(-6, 0.4, -20), V(0, 0, 10), V(0, 0, 40), V(-14, 0, 60), V(0, 0, 72), V(18, 0, 64)];
  // lối gỗ trên cọc qua rừng đước
  for (let i = 0; i < 5; i++) { const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5), ry = Math.atan2(b.x - a.x, b.z - a.z); kit.add(box(DECK, m.x, 0.25, m.z, 2.6, 0.3, a.distanceTo(b) + 2.6, ry)); const n = Math.round(a.distanceTo(b) / 3); for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); for (const s of [-1, 1]) kit.add(cyl(0x5a4a36, p.x + Math.cos(ry) * s * 1.2, -0.3, p.z - Math.sin(ry) * s * 1.2, 0.08, 1.4), cyl(0x5a4a36, p.x + Math.cos(ry) * s * 1.2, 0.9, p.z - Math.sin(ry) * s * 1.2, 0.05, 1)); } }
  for (let i = 0; i < 260; i++) { const x = -120 + r() * 240, z = -165 + r() * 190; if (nearPath(path, x, z, 3.6)) continue; const t = mangrove(r, 6 + r() * 4); t.position.set(x, -0.3, z); kit.add(t); }
  kit.add(box(0x8a6a48, 0, 0.1, -132, 8, 0.2, 6)); kit.live(label('Vườn quốc gia Mũi Cà Mau', 0, 6, -132, '#3a6a3a', 1));
  // cột mốc toạ độ GPS 0001
  const MX = -14, MZ = 56;
  kit.add(box(0xd8d0c0, MX, 0.3, MZ, 6, 0.6, 6), box(0xb8b0a0, MX, 2.6, MZ, 1.6, 4.4, 1.6), cone(0xd8382a, MX, 5.4, MZ, 1.2, 1.4), box(0x2a4a7a, MX, 3, MZ + 0.82, 1.2, 1.4, 0.04));
  kit.live(label('Cột mốc GPS 0001', MX, 8.4, MZ, '#2a4a7a', 0.9));
  // biểu tượng con tàu: mũi tàu bê tông trắng hướng ra biển, cột buồm cờ đỏ
  const ship = grp(0, 0, 92, 0);
  const hull = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), new THREE.MeshLambertMaterial({ color: CONC })); hull.scale.set(1, 0.5, 1); hull.position.set(0, 2.4, 0); ship.add(hull);
  ship.add(box(CONC, 0, 2.6, -8, 10, 4, 6), box(0x2a6a9a, 0, 4.8, -6, 10.4, 0.3, 14));
  const f = flag(14); f.position.set(0, 4.8, -6); ship.add(f);
  kit.add(ship, box(0xd8d0c0, 0, 0.05, 84, 30, 0.1, 12));
  kit.live(label('Biểu tượng con tàu – Đất Mũi', 0, 20, 92, '#2a6a9a', 1.1));
  // tháp ngắm cảnh bê tông nhiều tầng
  const TX = 26, TZ = 64;
  for (let k = 0; k < 5; k++) kit.add(box(CONC, TX, k * 3.4 + 1.6, TZ, 6 - k * 0.5, 0.3, 6 - k * 0.5), cyl(0xd8382a, TX, k * 3.4 + 3.2, TZ, 0.12, 3.2));
  kit.add(cone(0x2a6a9a, TX, 19.6, TZ, 2.4, 2));
  kit.live(label('Tháp ngắm cảnh', TX, 24, TZ, '#2a6a9a', 0.8));
  for (let i = 0; i < 12; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.copy(path[5 + (i % 5)]); p.position.x += 2; p.rotation.y = r() * 6.28; kit.add(p); }
  // hòn Khoai phía xa đông nam, tàu cá
  kit.add(cone(0x3f6a42, 300, 10, 260, 40, 36), cone(0x4f7a4a, 340, 8, 280, 26, 26));
  return {
    path, half: 1.2, npcs: 4,
    stops: [
      { id: 'rung_duoc', at: V(-14, 0.4, -80), look: V(-30, 3, -90), cam: V(-8, 4, -72) },
      { id: 'cot_moc', at: V(-14, 0, 60), look: V(MX, 3, MZ), cam: V(-8, 3, 66) },
      { id: 'con_tau', at: V(0, 0, 72), look: V(0, 5, 94), cam: V(-20, 7, 64) },
      { id: 'thap_ngam', at: V(18, 0, 64), look: V(200, 4, 200), cam: V(14, 5, 58) },
    ],
    sky: [0x6ab0e4, 0xf0ecd8], fog: [0xe0e8e4, 120, 640],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff2d8, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(-6, 0, 38), V(12, 0, 46), V(-20, 0, 40)],
  };
}
