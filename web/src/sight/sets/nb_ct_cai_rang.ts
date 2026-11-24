// Chợ nổi Cái Răng (sông Cần Thơ). Người chơi đi trên cầu tàu dài từ bến ra giữa sông rồi dọc dãy phao nối (bè gỗ)
// giữa chợ: ghe lớn neo hai bên có cây bẹo treo hàng, xuồng hủ tiếu – cà phê len lỏi. Sông chảy theo trục x, bờ ở phía bắc.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cyl, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { coconut, land, marketBoat, rowBoat, stiltHouse } from './nb__kit.ts';

const DECK = 0x8a6a48, FRUITS = [[0x3f8a3a, 0xd8382a], [0xffd23f, 0x8fbf3a], [0x6a9a3a, 0xf2e6a0], [0xff8a3d, 0xffd23f], [0x9a3a6a, 0x3f7a3a]];

export function caiRang(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  // sông rộng chiếm gần hết cảnh, bờ bắc có nhà sàn, cây dừa; bờ nam xa
  land(kit, -400, -300, 400, -40, 0x6aa04c, 0, false); land(kit, -400, 160, 400, 300, 0x6aa04c, 0, false);
  kit.add(box(0x5a5a3a, 0, -3, 60, 800, 1, 200)); kit.water(0x8a8458, 0, 60, 800, 200, -0.7, 0.95);
  for (let i = 0; i < 20; i++) { const h = stiltHouse(r, 0, 7, 6); h.position.set(-180 + i * 19, -1.6, -36); kit.add(h); }
  for (let i = 0; i < 40; i++) { const c = coconut(r, 8 + r() * 4); c.position.set(-200 + r() * 400, 0, -48 - r() * 20); kit.add(c); }
  for (let i = 0; i < 16; i++) { const h = stiltHouse(r, Math.PI, 7, 6); h.position.set(-160 + i * 22, -1.6, 166); kit.add(h); }
  // bến Ninh Kiều nhỏ ở bờ bắc và cầu tàu dài ra giữa sông, rồi bè phao chạy dọc chợ
  kit.add(box(0xd8d0c0, -60, 0.05, -50, 30, 0.1, 16));
  const deck = (a: THREE.Vector3, b: THREE.Vector3, w = 3.2) => { const m = a.clone().lerp(b, 0.5); kit.add(box(DECK, m.x, -0.12, m.z, w, 0.24, a.distanceTo(b) + w, Math.atan2(b.x - a.x, b.z - a.z))); };
  const path = [V(-60, 0, -52), V(-60, 0, -40), V(-60, 0, 0), V(-60, 0, 40), V(-30, 0, 50), V(10, 0, 50), V(50, 0, 50), V(80, 0, 50), V(100, 0, 40)];
  for (let i = 1; i < path.length - 1; i++) deck(path[i], path[i + 1]);
  for (let i = 2; i < path.length; i++) for (const o of [-1.4, 1.4]) { const p = path[i]; kit.add(cyl(0x3a5a6a, p.x + (i < 4 ? o : 0), -0.6, p.z + (i >= 4 ? o : 0), 0.4, 0.6)); }
  kit.add(box(DECK, -60, -0.12, -20, 0.1, 1.2, 40).translateX(1.7), box(DECK, -60, -0.12, -20, 0.1, 1.2, 40).translateX(-1.7));
  kit.live(label('Bến Ninh Kiều', -60, 6, -50, '#2f6a8a', 1));
  // ghe lớn neo dọc hai bên bè, cây bẹo cao treo mẫu hàng
  for (let i = 0; i < 18; i++) { const side = i % 2 ? 1 : -1, x = -40 + Math.floor(i / 2) * 15 + r() * 3; const b = marketBoat(r, FRUITS[i % 5], 11 + r() * 4); b.position.set(x, -0.7, 50 + side * (7 + r() * 3)); b.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.3; kit.add(b); const p = person(i, i % 2 ? 1 : 0); p.position.set(x + 2, 0.1, 50 + side * 6); p.rotation.y = side > 0 ? Math.PI : 0; kit.add(p); }
  for (let i = 0; i < 10; i++) { const b = marketBoat(r, FRUITS[(i + 2) % 5], 12); b.position.set(-120 + r() * 260, -0.7, 90 + r() * 50); b.rotation.y = r() * 6.28; kit.add(b); }
  kit.live(label('Chợ nổi Cái Răng', 20, 14, 50, '#8a3a2a', 1.3));
  // xuồng hủ tiếu, cà phê bơi giữa chợ: xuồng nhỏ có nồi bốc khói
  const sampans: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) { const s = rowBoat(i + 2, 0x5a4330); s.add(cyl(0x8a8a8a, 0, 0.6, -0.8, 0.45, 0.6), cyl(0xd8382a, 0, 0.95, -0.8, 0.46, 0.08)); const sb = baked(s); kit.live(sb); sampans.push(sb); }
  kit.onTick((t) => sampans.forEach((s, i) => { const k = (t * 0.018 + i / 6) % 1, side = i % 2 ? 1 : -1; s.position.set(-50 + k * 140, -0.7, 50 + side * 16 + Math.sin(t * 0.6 + i) * 1.2); s.rotation.y = Math.PI / 2; }));
  kit.motes(24, 0xf2f2f2, 1.6, () => V(-50 + r() * 140, 1.2 + r(), 34 + r() * 32), (p, i, t, dt) => { const s = sampans[i % 6]; if (p.y > 3) { p.copy(s.position); p.y = 1.2; } p.y += dt * 0.6; void t; });
  // ghe máy chở khách chạy qua
  const tour = baked(grp(0, -0.7, 0, 0, box(0x2f6a8a, 0, 0.5, 0, 2.6, 1, 10), box(0xe8e0d0, 0, 1.6, 0.6, 2.4, 1.2, 6), box(0x2f6a8a, 0, 2.3, 0.6, 2.8, 0.12, 6.6))); kit.live(tour);
  kit.onTick((t) => { const k = (t * 0.01) % 1; tour.position.set(200 - k * 400, -0.7, 110); tour.rotation.y = -Math.PI / 2; });
  void ball;
  return {
    path, half: 1.4, npcs: 4,
    stops: [
      { id: 'ben_ninh_kieu', at: V(-60, 0, -46), look: V(-30, 2, 60), cam: V(-66, 4, -56) },
      { id: 'cay_beo', at: V(-30, 0, 50), look: V(-25, 6, 42), cam: V(-38, 4, 56) },
      { id: 'ghe_hang', at: V(10, 0, 50), look: V(16, 1, 58), cam: V(4, 4, 44) },
      { id: 'hu_tieu', at: V(50, 0, 50), look: V(60, 0.5, 34), cam: V(44, 4, 56) },
      { id: 'loi_ra', at: V(100, 0, 40), look: V(60, 2, 50), cam: V(106, 4, 34) },
    ],
    sky: [0xf2c890, 0xfbe6c8], fog: [0xf2dcc0, 120, 640],
    light: { ambient: 1.5, sun: 1.7, sunColor: 0xffd8a0, sunDir: [0.8, 0.5, 0.3] },
    shopSpots: [V(-52, 0, -48), V(-10, 0, 52), V(70, 0, 52)],
  };
}
