// Tượng Chúa Kitô Vua trên Núi Nhỏ, Vũng Tàu. Lối bậc đá vòng lên sườn núi từ phía bắc; đỉnh là sân tượng,
// phía đông là Bãi Sau và biển. Trục x: tây → đông; z: bắc → nam. Mặt núi cao dần về đỉnh ở (0, TOP, -20).
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bench, box, cone, cyl, grp, label, person, stairs, strip, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { casuarina } from './_extra.ts';
import { land } from './nb__kit.ts';

const STONE = 0xb8b0a2, STATUE = 0xf2efe8, HILL = [0x4f8a4a, 0x5f9a52, 0x3f7a40];
const TOP = 22;

export function vungTau(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -300, -300, 90, 300, 0x6aa04c, 0, false);
  // biển Bãi Sau phía đông
  kit.add(box(0xe8d6a8, 120, -0.3, 0, 60, 1, 600), box(0x2f6f8a, 340, -2.4, 0, 400, 1, 600)); kit.water(0x3f8fb0, 340, 0, 400, 600, -0.5, 0.9);
  // núi: khối nón cụt thoai thoải (dốc ~22°), đỉnh bằng bán kính 16 m ở cao độ TOP
  const hillGeo = new THREE.CylinderGeometry(16, 70, TOP, 48, 4); const hillMesh = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ color: HILL[0] })); hillMesh.position.set(0, TOP / 2, -20); kit.add(hillMesh);
  for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 22 + r() * 40; kit.add(ball(HILL[1 + (i % 2)], Math.cos(a) * d, TOP * (70 - d) / 54 - 0.6, -20 + Math.sin(a) * d, 4 + r() * 4, 1.2, 4 + r() * 4)); }
  // lối bậc đá: từ chân núi (phía nam) vòng lên đỉnh
  // cao độ mặt núi theo khoảng cách tới tâm (0, -20): mỗi vòng đất cao TOP/8
  const yAt = (d: number) => Math.max(0, Math.min(TOP, TOP * (70 - d) / 54));
  const path = [V(-40, 0, 76), V(-40, 0, 58)];
  for (let i = 0; i < 13; i++) { const d = 64 - i * 4.4, a = 2.0 - i * 0.42; path.push(V(Math.cos(a) * d, yAt(d), -20 + Math.sin(a) * d)); }
  path.push(V(0, TOP, -6), V(0, TOP, -12));
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if (b.y - a.y > 0.4) kit.add(stairs(STONE, a, b, 3, Math.round((b.y - a.y) / 0.25)), strip(STONE, a, b, 3.4, 0.6, -0.25)); else kit.add(box(STONE, (a.x + b.x) / 2, Math.max(a.y, b.y) - 0.05, (a.z + b.z) / 2, 3.2, 0.12, a.distanceTo(b) + 3, Math.atan2(b.x - a.x, b.z - a.z)));
  }
  for (let i = 0; i < 110; i++) { const a = r() * 6.28, d = 14 + r() * 54, y = yAt(d); const x = Math.cos(a) * d, z = -20 + Math.sin(a) * d; if (path.some((p) => Math.hypot(p.x - x, p.z - z) < 5)) continue; const t = r() < 0.5 ? tree(r, 1 + r() * 0.6, true) : casuarina(r, 6 + r() * 3); t.position.set(x, y, z); kit.add(t); }
  // cổng chân núi
  kit.add(box(STONE, -44, 2.2, 52, 1, 4.4, 1), box(STONE, -36, 2.2, 52, 1, 4.4, 1), box(0xe8e0d0, -40, 4.7, 52, 10, 0.8, 1.2), cone(0xc8bfae, -40, 5.6, 52, 1.2, 1.2));
  kit.live(label('Tượng Chúa Kitô Vua', -40, 8, 52, '#5a6a8a', 1));
  // tượng các tông đồ dọc đường
  for (let i = 0; i < 6; i++) { const p = path[3 + i * 2], s = grp(p.x + 2.6, p.y, p.z + 1.2, 0, box(STONE, 0, 0.5, 0, 1, 1, 1), cyl(STATUE, 0, 1.6, 0, 0.32, 1.4), ball(STATUE, 0, 2.5, 0, 0.24)); kit.add(s); }
  for (let i = 0; i < 4; i++) { const b = bench(); const p = path[4 + i * 2]; b.position.set(p.x - 2.4, p.y, p.z); kit.add(b); }
  // sân đỉnh núi, bệ và tượng 32 m dang tay (bệ quay về hướng biển)
  kit.add(cyl(0xd8d2c4, 0, TOP - 0.2, -20, 16, 0.4), cyl(STONE, 0, TOP + 0.6, -24, 5, 1.2), cyl(0xc8c0b0, 0, TOP + 2.6, -24, 3.4, 4));
  kit.add(cyl(0xd8d2c4, 0, TOP + 0.1, -10, 5, 0.2));
  const st = grp(0, TOP + 4.6, -24, 0);
  st.add(cyl(STATUE, 0, 9, 0, 2.4, 18, 2.8), cyl(STATUE, 0, 2, 0, 3.2, 4), cone(STATUE, 0, 0.6, 0, 3.6, 2.4));
  st.add(box(STATUE, 0, 19, 0, 18.4, 2, 2.2), ball(STATUE, 9.2, 19, 0, 1.1), ball(STATUE, -9.2, 19, 0, 1.1)); // hai tay dang
  st.add(ball(STATUE, 0, 21.8, 0, 1.9, 2.3, 1.9), cyl(STATUE, 0, 20.2, 0, 1, 1.2), box(STATUE, 0, 12, 2.6, 4, 12, 0.6));
  for (let i = 0; i < 5; i++) st.add(box(0xe2ddd2, -1.6 + i * 0.8, 9, 2.4, 0.2, 16, 0.3)); // nếp áo
  kit.add(st);
  // lan can quanh sân đỉnh và người ngắm cảnh
  for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.28; if (Math.abs(a - 1.57) < 0.25) continue; kit.add(box(0xd8d2c4, Math.cos(a) * 15.6, TOP + 0.5, -20 + Math.sin(a) * 15.6, 0.2, 1, 2.4, -a)); }
  for (let i = 0; i < 10; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); const a = r() * 6.28; p.position.set(Math.cos(a) * (8 + r() * 5), TOP, -20 + Math.sin(a) * (8 + r() * 5)); p.rotation.y = r() * 6.28; kit.add(p); }
  // ngọn hải đăng và mũi Nghinh Phong phía xa
  kit.add(cyl(0xffffff, 150, 5, -180, 1.6, 10), cone(0xd8281e, 150, 11, -180, 2, 2), cyl(0x4f8a4a, 150, -1, -180, 30, 2));
  kit.live(label('Bãi Sau', 120, 4, 40, '#2f6f8a', 1));
  return {
    path, half: 1.6, npcs: 4,
    stops: [
      { id: 'chan_nui', at: V(-40, 0, 60), look: V(-40, 5, 52), cam: V(-34, 3, 66) },
      { id: 'tuong_thanh', at: path[7], look: V(path[7].x + 2.6, path[7].y + 1.6, path[7].z + 1.2), cam: V(path[7].x - 3, path[7].y + 3, path[7].z + 6) },
      { id: 'chan_tuong', at: V(0, TOP, -6), look: V(0, TOP + 16, -24), cam: V(6, TOP + 3, 5) },
      { id: 'vai_tuong', at: V(0, TOP, -12), look: V(120, 0, 10), cam: V(-4, TOP + 7, -16) },
      { id: 'xuong_nui', at: path[11], look: V(120, 0, 30), cam: V(path[11].x - 4, path[11].y + 4, path[11].z - 4) },
    ],
    sky: [0x5aa8e8, 0xf0ead8], fog: [0xe0e8ec, 160, 760],
    light: { ambient: 1.6, sun: 1.9, sunColor: 0xfff2d8, sunDir: [0.5, 0.9, 0.4] },
    shopSpots: [V(-44, 0, 68), V(-6, TOP, -4), V(8, TOP, -6)],
  };
}
