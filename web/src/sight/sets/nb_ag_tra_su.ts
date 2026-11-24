// Rừng tràm Trà Sư (Tịnh Biên). Bến xuồng máy → kênh phủ bèo tấm xanh giữa rừng tràm → cầu tre dài xuyên rừng →
// tháp quan sát nhìn ra dãy Thất Sơn. Người chơi đi trên đường đê, cầu tre và sàn gỗ nổi; mặt nước ngập dưới tán tràm.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cone, cyl, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { cajuput, egretPerch, land, nearPath, rowBoat } from './nb__kit.ts';

const BAMBOO = 0xc8b06a, DUCKWEED = 0x7cc23a;

export function traSu(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.add(box(0x3a4a2a, 0, -2.2, 0, 900, 1, 900));
  // mặt nước phủ bèo tấm: lớp nước xanh lá sáng, gợn nhẹ
  kit.water(DUCKWEED, 0, 0, 900, 900, -0.6, 1);
  land(kit, -170, 30, -110, 80, 0x7aa04a, 0, false);
  const path = [V(-140, 0, 60), V(-120, 0, 50), V(-100, 0.6, 40), V(-60, 0.6, 30), V(-20, 0.6, 14), V(20, 0.6, 6), V(60, 0.6, -6), V(90, 0.6, -20), V(104, 0.6, -30)];
  // cầu tre: mặt sàn nan tre trên cọc, lan can tre
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5), len = a.distanceTo(b), ry = Math.atan2(b.x - a.x, b.z - a.z);
    kit.add(box(BAMBOO, m.x, a.y - 0.1, m.z, 2.4, 0.2, len + 2.4, ry));
    const n = Math.round(len / 2.4); for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n), nx = Math.cos(ry), nz = -Math.sin(ry); for (const s of [-1, 1]) kit.add(cyl(0x9a8248, p.x + nx * s * 1.1, -0.2, p.z + nz * s * 1.1, 0.07, 2.4)); }
    for (const s of [-1, 1]) kit.add(box(0xb09a58, m.x + Math.cos(ry) * s * 1.15, a.y + 0.9, m.z - Math.sin(ry) * s * 1.15, 0.08, 0.08, len, ry));
  }
  // bến xuồng máy: nhà chờ, xuồng tắc ráng
  kit.add(box(0x8a6a48, -126, 0.1, 50, 10, 0.2, 6), grp(-150, 0, 56, 0, box(0xa08a62, 0, 1.6, 0, 8, 3.2, 5), cone(0xc4a46a, 0, 4.2, 0, 6, 2)));
  for (let i = 0; i < 4; i++) { const b = rowBoat(i, [0x3a6a5a, 0x2f5a7a][i % 2], i % 2 === 0); b.position.set(-130 + i * 4, -0.55, 58); kit.add(b); }
  kit.live(label('Rừng tràm Trà Sư', -140, 7, 56, '#3a6a3a', 1.1));
  // rừng tràm dày hai bên
  for (let i = 0; i < 360; i++) { const x = -160 + r() * 320, z = -120 + r() * 220; if (nearPath(path, x, z, 3.4) || (x < -108 && z > 28)) continue; const t = cajuput(r, 9 + r() * 5); t.position.set(x, -0.6, z); kit.add(t); }
  for (let i = 0; i < 60; i++) { const e = egretPerch(); e.position.set(-100 + r() * 200, 10 + r() * 4, -80 + r() * 140); e.rotation.y = r() * 6.28; kit.add(e); }
  // kênh xuồng chèo (không có cây), xuồng chèo tay rẽ bèo
  const boats: THREE.Object3D[] = []; for (let i = 0; i < 4; i++) { const b = baked(rowBoat(i + 2, 0x6a5038)); kit.live(b); boats.push(b); }
  kit.onTick((t) => boats.forEach((b, i) => { const k = (t * 0.012 + i / 4) % 1; b.position.set(-90 + k * 180, -0.55, 30 - k * 40 + (i % 2) * 6); b.rotation.y = Math.atan2(180, -40); }));
  // tháp quan sát cuối cầu
  const TX = 110, TZ = -36;
  kit.add(box(0x8a6a48, TX - 4, 0.5, TZ + 4, 10, 0.2, 8));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0x7a5a3c, TX + sx * 2.4, 7, TZ + sz * 2.4, 0.22, 14));
  for (let k = 0; k < 4; k++) kit.add(box(0x8a6a48, TX, 3.4 + k * 3.4, TZ, 5.6, 0.2, 5.6));
  kit.add(cone(0xc4a46a, TX, 16.4, TZ, 4.4, 2.6));
  kit.live(label('Tháp quan sát', TX, 21, TZ, '#7a5a3c', 0.9));
  // dãy Thất Sơn phía tây xa
  for (let i = 0; i < 7; i++) kit.add(cone([0x5a7a6a, 0x6a8a74, 0x7a948a][i % 3], -360 + i * 70, 20, -320, 40 + r() * 20, 40 + r() * 30));
  for (let i = 0; i < 8; i++) { const p = person(i, i % 2 ? 1 : 0); p.position.copy(path[2 + (i % 6)]); p.position.x += 0.6; p.rotation.y = r() * 6.28; kit.add(p); }
  return {
    path, half: 1.1, npcs: 4,
    stops: [
      { id: 'ben_xuong', at: V(-126, 0, 50), look: V(-124, 0, 58), cam: V(-134, 4, 42) },
      { id: 'tham_beo', at: V(-60, 0.6, 30), look: V(-40, 0, 40), cam: V(-66, 4, 24) },
      { id: 'cau_tre', at: V(20, 0.6, 6), look: V(60, 1, -6), cam: V(12, 4, 12) },
      { id: 'thap_quan_sat', at: V(104, 0.6, -30), look: V(TX, 10, TZ), cam: V(96, 4, -22) },
    ],
    sky: [0x7ab8e4, 0xeef0dc], fog: [0xdfe8d4, 70, 420],
    light: { ambient: 1.6, sun: 1.7, sunColor: 0xfff2d4, sunDir: [-0.3, 1, 0.4] },
    shopSpots: [V(-136, 0, 44), V(-152, 0, 44), V(-118, 0, 62)],
  };
}
