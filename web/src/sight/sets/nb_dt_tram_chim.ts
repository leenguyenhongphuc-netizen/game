// Vườn quốc gia Tràm Chim. Bến xuồng → đường đê đắp giữa đồng ngập (lối đi duy nhất trên mặt nước) → rừng tràm →
// tháp quan sát chim gỗ nhìn ra đồng cỏ năng có sếu đầu đỏ → đầm sen. Trục x: tây → đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, bead, box, cone, cyl, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { cajuput, egretPerch, land, nearPath, rowBoat, sarus } from './nb__kit.ts';

const DIKE = 0xa8905e, MARSH = 0x6a7a4a, REED = [0x9aa65a, 0x8a9a4a, 0xb0b468];
function reeds(r: () => number, n = 9): THREE.Group { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const h = 1 + r() * 1.4, c = cone(REED[i % 3], (r() - 0.5) * 1.6, h / 2 - 0.6, (r() - 0.5) * 1.6, 0.08, h); c.rotation.z = (r() - 0.5) * 0.3; g.add(c); } return g; }

export function tramChim(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  // đồng ngập toàn cảnh; đê đất cao hơn mặt nước làm lối đi
  kit.add(box(0x4a5a34, 0, -2, 0, 900, 1, 900)); kit.water(MARSH, 0, 0, 900, 900, -0.55, 0.88);
  const dike = (a: THREE.Vector3, b: THREE.Vector3, w = 5) => { const m = a.clone().lerp(b, 0.5); kit.add(box(DIKE, m.x, -0.5, m.z, w, 1, a.distanceTo(b) + w, Math.atan2(b.x - a.x, b.z - a.z)), box(0x7a9a4a, m.x, 0.01, m.z, w - 1.4, 0.02, a.distanceTo(b) + w - 1, Math.atan2(b.x - a.x, b.z - a.z))); };
  const path = [V(-120, 0, 10), V(-100, 0, 10), V(-60, 0, 4), V(-20, 0, -12), V(20, 0, -14), V(50, 0, 0), V(64, 0, 14), V(90, 0, 18)];
  for (let i = 0; i < path.length - 1; i++) dike(path[i], path[i + 1]);
  land(kit, -160, -10, -110, 40, 0x7aa04a, 0, false);
  // bến xuồng có nhà chờ mái lá, xuồng máy neo
  kit.add(box(0x8a6a48, -110, 0.1, 22, 8, 0.2, 10), grp(-118, 0, 20, 0, box(0xa08a62, 0, 1.4, 0, 6, 2.8, 4), cone(0xc4a46a, 0, 3.6, 0, 4.6, 1.8)));
  for (let i = 0; i < 4; i++) { const b = rowBoat(i, [0x3a6a5a, 0x6a5038][i % 2], i % 2 === 0); b.position.set(-104 + i * 4, -0.55, 30); b.rotation.y = 0.2; kit.add(b); }
  kit.live(label('Bến xuồng Tràm Chim', -114, 6, 20, '#3a6a5a', 1));
  // rừng tràm trên mặt nước hai bên đê
  for (let i = 0; i < 220; i++) { const x = -90 + r() * 120, z = -80 + r() * 160; if (nearPath(path, x, z, 6)) continue; const t = cajuput(r, 8 + r() * 4); t.position.set(x, -0.55, z); kit.add(t); }
  for (let i = 0; i < 160; i++) { const x = (r() - 0.5) * 400, z = (r() - 0.5) * 400; if (Math.abs(x) < 120 && Math.abs(z) < 40) continue; const g = reeds(r); g.position.set(x, 0, z); kit.add(g); }
  for (let i = 0; i < 30; i++) { const e = egretPerch(); e.position.set(-80 + r() * 100, 8 + r() * 3, -60 + r() * 120); e.rotation.y = r() * 6.28; kit.add(e); }
  // tháp quan sát chim: tháp gỗ 4 chân, sàn trên cao, mái lá
  const TX = 34, TZ = -26;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0x7a5a3c, TX + sx * 2, 5, TZ + sz * 2, 0.2, 10));
  kit.add(box(0x8a6a48, TX, 10, TZ, 5.4, 0.3, 5.4), cone(0xc4a46a, TX, 12.4, TZ, 4.4, 2.6), box(0x8a6a48, TX, 5, TZ + 2.4, 1.2, 0.1, 10).rotateX(1.1));
  for (let i = 0; i < 4; i++) kit.add(box(0x7a5a3c, TX, 2 + i * 2.2, TZ, 4.4, 0.12, 0.12, i % 2 ? 0.8 : -0.8));
  kit.live(label('Tháp quan sát chim', TX, 16, TZ, '#7a5a3c', 0.9));
  // đồng cỏ năng phía bắc có sếu đầu đỏ
  kit.add(box(0x8a9a5a, 40, -0.35, -90, 160, 0.3, 80));
  for (let i = 0; i < 9; i++) { const s = sarus(); s.position.set(10 + r() * 60, -0.2, -70 - r() * 40); s.rotation.y = r() * 6.28; kit.add(s); }
  // đầm sen phía đông
  for (let i = 0; i < 140; i++) { const x = 70 + r() * 50, z = 26 + r() * 40; kit.add(bead(0x3f8a3a, x, -0.5, z, 0.8 + r() * 0.5, 0.05, 0.8 + r() * 0.5)); if (i % 3 === 0) kit.add(bead(0xf29bc0, x, 0.1, z, 0.22, 0.28, 0.22), cyl(0x4f8a3a, x, -0.2, z, 0.03, 0.6)); }
  kit.live(label('Đầm sen', 92, 5, 40, '#c84a7a', 0.9));
  for (let i = 0; i < 8; i++) { const p = person(i, i % 2 ? 1 : 0); p.position.copy(path[1 + (i % 6)]); p.position.x += 1.8; p.rotation.y = r() * 6.28; kit.add(p); }
  // xuồng chạy trên kênh song song đê
  const boats: THREE.Object3D[] = []; for (let i = 0; i < 3; i++) { const b = baked(rowBoat(i + 3, 0x3a6a5a)); kit.live(b); boats.push(b); }
  kit.onTick((t) => boats.forEach((b, i) => { const k = ((t * 0.02 + i / 3) % 1); b.position.set(-100 + k * 200, -0.55, 40 + i * 6); b.rotation.y = Math.PI / 2; }));
  void bead;
  return {
    path, half: 1.8, npcs: 4,
    stops: [
      { id: 'ben_xuong', at: V(-104, 0, 10), look: V(-104, 0, 30), cam: V(-110, 4, 2) },
      { id: 'rung_tram', at: V(-60, 0, 4), look: V(-50, 5, 30), cam: V(-66, 3, -4) },
      { id: 'thap_quan_sat', at: V(20, 0, -14), look: V(40, 2, -80), cam: V(16, 5, -6) },
      { id: 'dong_sen', at: V(90, 0, 18), look: V(92, 0, 40), cam: V(84, 4, 10) },
    ],
    sky: [0x7ab8e4, 0xeef0dc], fog: [0xe0e8d4, 120, 620],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff2d4, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(-110, 0, 14), V(52, 0, 4), V(84, 0, 14)],
  };
}
