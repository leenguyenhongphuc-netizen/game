// Cánh đồng điện gió Bạc Liêu. Cổng nhà máy trên bờ → cầu bê tông dài chạy ra bãi bồi giữa hàng tua-bin → chân tua-bin.
// Biển ở phía nam, bãi bùn có cây mắm. Trục x: tây → đông.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, grp, label, person, stairs } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { land, mangrove, turbine } from './nb__kit.ts';

const CONC = 0xd8d4cc, MUDC = 0x8a7a5a, SEA = 0x7a9a9a;

export function dienGio(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -300, -300, 300, -20, 0x7aa85a, 0, false);
  kit.add(box(MUDC, 0, -0.9, 200, 600, 0.6, 440)); kit.add(box(0x4a5a5a, 0, -3, 200, 600, 1, 440)); kit.water(SEA, 0, 260, 900, 600, -0.75, 0.85);
  // cầu bê tông ra biển trên trụ
  const path = [V(0, 0, -50), V(0, 0, -26), V(0, 1, -12), V(0, 1, 60), V(0, 1, 130), V(0, 1, 190), V(16, 1, 196)];
  kit.add(stairs(CONC, V(0, 0, -26), V(0, 1, -12), 4, 5), box(CONC, 0, 0.5, -11, 4, 1, 2));
  for (let z = -10; z < 194; z += 6) kit.add(cyl(0xc8c4bc, -1.6, -0.2, z, 0.3, 2), cyl(0xc8c4bc, 1.6, -0.2, z, 0.3, 2));
  kit.add(box(CONC, 0, 0.85, 92, 4, 0.3, 204), box(0x5a8a9a, -2, 1.5, 92, 0.08, 0.08, 204), box(0x5a8a9a, 2, 1.5, 92, 0.08, 0.08, 204), box(CONC, 8, 0.85, 196, 16, 0.3, 6));
  for (let z = -10; z < 194; z += 3) for (const x of [-2, 2]) kit.add(cyl(0x5a8a9a, x, 1.2, z, 0.03, 0.7));
  // hàng tua-bin hai bên cầu (cánh quay)
  const rotors: { r: import('three').Object3D; s: number }[] = [];
  for (let i = 0; i < 12; i++) for (const side of [-1, 1]) { const { base, rotor } = turbine(34); const x = side * (26 + (i % 2) * 6), z = 10 + i * 18; base.position.set(x, -0.6, z); base.rotation.y = Math.PI; kit.add(base); kit.add(cyl(0xc8c4bc, x, -0.4, z, 2.4, 1)); const rb = baked(rotor); rb.position.set(x, -0.6 + 34.6, z - 1.3); rb.rotation.y = Math.PI; kit.live(rb); rotors.push({ r: rb, s: 0.8 + r() * 0.4 }); if (i % 3 === 0) kit.add(box(CONC, x / 2, 0.85, z, Math.abs(x) - 2, 0.3, 2)); }
  kit.onTick((t) => rotors.forEach((o, i) => { o.r.rotation.z = t * o.s + i; }));
  // cây mắm mọc lan trên bãi bồi gần bờ
  for (let i = 0; i < 80; i++) { const x = (r() - 0.5) * 300, z = -10 + r() * 60; if (Math.abs(x) < 8) continue; const m = mangrove(r, 4 + r() * 3); m.position.set(x, -0.6, z); kit.add(m); }
  // cổng nhà máy, nhà điều hành
  kit.add(grp(0, 0, -40, 0, box(0x2a6a9a, -6, 2.4, 0, 1.2, 4.8, 1.2), box(0x2a6a9a, 6, 2.4, 0, 1.2, 4.8, 1.2), box(0xf2f2f2, 0, 5, 0, 13.4, 1, 1.4)), grp(-30, 0, -50, 0, box(0xe8e4dc, 0, 3, 0, 18, 6, 10), box(0x6aa0c8, 0, 3.4, 5.05, 16, 2.4, 0.1)));
  kit.live(label('Nhà máy điện gió Bạc Liêu', 0, 8, -40, '#2a6a9a', 1.1));
  for (let i = 0; i < 12; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.set((i % 2 ? 0.8 : -0.8), 1, -4 + i * 15); p.rotation.y = r() * 6.28; kit.add(p); }
  return {
    path, half: 1.4, npcs: 4,
    stops: [
      { id: 'cong', at: V(0, 0, -46), look: V(0, 4, -40), cam: V(6, 3, -56) },
      { id: 'cau_di_bo', at: V(0, 1, 60), look: V(0, 10, 140), cam: V(-3, 4, 48) },
      { id: 'chan_tua_bin', at: V(16, 1, 196), look: V(26, 20, 208), cam: V(10, 3, 188) },
      { id: 'loi_ra', at: V(0, 1, 130), look: V(0, 4, -40), cam: V(3, 5, 140) },
    ],
    sky: [0x78b8ea, 0xf0f0e4], fog: [0xe4ece8, 160, 760],
    light: { ambient: 1.6, sun: 1.9, sunColor: 0xfff4dc, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(-8, 0, -46), V(8, 0, -46), V(-14, 0, -30)],
  };
}
