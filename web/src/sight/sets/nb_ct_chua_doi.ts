// Chùa Dơi (Mahatup), Sóc Trăng. Cổng chùa Khmer → vườn cây sao, cây dầu cao có hàng nghìn con dơi treo ngược →
// chánh điện mái ba tầng → tháp và lối ra. Trục z: bắc → nam; cổng ở phía nam.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cone, cyl, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { bigTree, khmerStupa, khmerTemple, land, nearPath } from './nb__kit.ts';

const PAVE = 0xd8cfbd;
function batCluster(r: () => number, n = 10): THREE.Group { const g = new THREE.Group(); for (let i = 0; i < n; i++) g.add(ball(0x2a2018, (r() - 0.5) * 3, -r() * 0.8, (r() - 0.5) * 3, 0.16, 0.32, 0.14)); return g; }

export function chuaDoi(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -260, -260, 260, 260, 0x6aa04c, 0, false);
  const path = [V(0, 0, 110), V(0, 0, 92), V(0, 0, 60), V(-20, 0, 40), V(-22, 0, 10), V(0, 0, -2), V(0, 0, -9), V(26, 0, -12), V(40, 0, -40)];
  for (let i = 1; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5); kit.add(box(PAVE, m.x, 0.03, m.z, 3.6, 0.06, a.distanceTo(b) + 2, Math.atan2(b.x - a.x, b.z - a.z))); }
  // cổng chùa Khmer: ba cửa mái nhọn, tượng rắn Naga hai bên
  kit.add(grp(0, 0, 96, 0, box(0xf2c64a, -5, 3, 0, 2, 6, 2), box(0xf2c64a, 5, 3, 0, 2, 6, 2), box(0xf2c64a, 0, 6.4, 0, 12, 1, 2.2), cone(0xd9551e, 0, 9.4, 0, 2.6, 5), cone(0xd9551e, -4.6, 8.2, 0, 1.4, 3), cone(0xd9551e, 4.6, 8.2, 0, 1.4, 3)));
  for (const s of [-1, 1]) { kit.add(box(0x6a8a5a, s * 7, 0.6, 92, 0.8, 1.2, 10)); for (let k = 0; k < 5; k++) kit.add(ball(0x5a7a4a, s * 7, 1.4 + k * 0.3, 88 + k * 0.4, 0.5 - k * 0.04, 0.5, 0.5)); }
  kit.live(label('Chùa Dơi (Mahatup)', 0, 13, 96, '#d9551e', 1.1));
  // vườn cây sao, cây dầu cao vút; dơi quạ treo thành chùm trên cành, vài con bay lượn
  for (let i = 0; i < 42; i++) { const x = -90 + r() * 160, z = -40 + r() * 140; if (nearPath(path, x, z, 6) || (Math.abs(x) < 16 && z > -30 && z < 14)) continue; const t = bigTree(r, 24 + r() * 10); t.position.set(x, 0, z); kit.add(t); for (let k = 0; k < 4; k++) { const b = batCluster(r); b.position.set(x + (r() - 0.5) * 6, 17 + r() * 8, z + (r() - 0.5) * 6); kit.add(b); } }
  const bats: THREE.Object3D[] = []; for (let i = 0; i < 16; i++) { const b = baked(grp(0, 0, 0, 0, ball(0x2a2018, 0, 0, 0, 0.2, 0.18, 0.3), box(0x2a2018, 0, 0, 0, 1.4, 0.04, 0.5))); kit.live(b); bats.push(b); }
  kit.onTick((t) => bats.forEach((b, i) => { const a = t * 0.3 + i * 0.4; b.position.set(-30 + Math.cos(a) * (20 + i), 22 + Math.sin(t + i) * 2, 40 + Math.sin(a) * (16 + i * 0.6)); b.rotation.y = -a; b.scale.x = 0.6 + Math.abs(Math.sin(t * 9 + i)) * 0.6; }));
  kit.live(label('Vườn dơi', -36, 12, 40, '#3a2a20', 0.9));
  // chánh điện
  const tm = khmerTemple(14, 26, 6); tm.position.set(0, 0, -30); kit.add(tm);
  kit.live(label('Chánh điện', 0, 22, -30, '#d9551e', 1));
  // tháp đựng tro cốt, tượng heo năm móng
  for (let i = 0; i < 5; i++) { const st = khmerStupa(7 + (i % 2) * 3); st.position.set(36 + i * 6, 0, -56); kit.add(st); }
  kit.add(grp(-26, 0, -6, 0.6, box(0xd8cfbd, 0, 0.4, 0, 3, 0.8, 2), ball(0xe8a0a0, 0, 1.6, 0, 1, 0.8, 1.4), ball(0xe8a0a0, 0, 1.8, -1.2, 0.5)));
  for (let i = 0; i < 10; i++) { const p = person(i, i % 3 === 0 ? 1 : 0, i % 4 === 0 ? 0xf2a03a : undefined); p.position.copy(path[1 + (i % 7)]); p.position.x += 1.8; p.rotation.y = r() * 6.28; kit.add(p); }
  return {
    path, half: 2, npcs: 4,
    stops: [
      { id: 'cong', at: V(0, 0, 104), look: V(0, 6, 96), cam: V(5, 4, 116) },
      { id: 'vuon_doi', at: V(-20, 0, 40), look: V(-30, 20, 40), cam: V(-12, 3, 48) },
      { id: 'chanh_dien', at: V(0, 0, -2), look: V(0, 8, -30), cam: V(6, 4, 8) },
      { id: 'loi_ra', at: V(40, 0, -40), look: V(48, 4, -56), cam: V(34, 4, -32) },
    ],
    sky: [0x78b8e8, 0xf2ecd8], fog: [0xe8e6d6, 90, 520],
    light: { ambient: 1.5, sun: 1.8, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(6, 0, 84), V(-14, 0, 22), V(30, 0, -26)],
  };
}
