// Ga Đà Lạt (ga xe lửa Đà Lạt), Lâm Đồng. Trục x: tây → đông; z: bắc → nam.
// Nhà ga quay mặt về phía BẮC ra sân trước, ba mái nhọn dốc đứng sơn ngói đỏ, mặt tiền vàng nhạt có ô kính màu.
// Sau nhà ga (phía nam) là sân ga, đường ray, đầu máy hơi nước trưng bày và đoàn tàu du lịch đi Trại Mát chạy về phía đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, gable, glow, grp, label, lampPost, person, signPost, stairs, strip } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { baked } from './_extra.ts';
import { pine } from './nt_common.ts';

const WALL = 0xf2dfa0, TRIM = 0xf4f1ea, ROOF = 0xb8452e, GRASS = 0x7fae5a;
function station(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(WALL, 0, 3.5, 0, 46, 7, 12), box(TRIM, 0, 7.2, 0, 47, 0.4, 13));
  // ba chóp mái nhọn ở mặt tiền (mặt −z), mái chính hai dốc phía sau
  for (const x of [-12, 0, 12]) { g.add(box(WALL, x, 9, -4, 9, 4, 4), gable(ROOF, x, 11, -4, 10, 9, 6, 0), box(TRIM, x, 9.4, -6.05, 4, 4, 0.1)); for (let k = 0; k < 4; k++) g.add(box(glow([0xd2301e, 0x2a6fbf, 0xffd23f, 0x18a558][k]), x - 1.5 + k, 9.4, -6.12, 0.9, 3.4, 0.05)); }
  g.add(gable(ROOF, 0, 7.4, 1.5, 9, 4, 46, Math.PI / 2));
  // cửa vòm, cửa sổ dọc mặt tiền
  for (let i = 0; i < 9; i++) g.add(box(0x6a4a32, -20 + i * 5, 2.4, -6.02, 2, 3.6, 0.1), box(glow(0xfff0c4), -20 + i * 5, 2.4, -6.06, 1.6, 3, 0.04));
  g.add(box(0x3a2a1a, 0, 1.6, -6.08, 4, 3.2, 0.1));
  // mái hiên sân ga phía sau
  g.add(box(0xcfc8b8, 0, 6, 10, 46, 0.3, 8)); for (let i = 0; i < 7; i++) g.add(cyl(0x5a6a7a, -21 + i * 7, 3, 13.6, 0.15, 6));
  return g;
}
function steam(): THREE.Group { const g = grp(0, 0, 0, 0, box(0x2a2a2a, 0, 1.2, 0, 2.6, 0.6, 12), cyl(0x1f1f1f, 0, 2.6, -1, 1.2, 8).rotateX(Math.PI / 2), cyl(0x1f1f1f, 0, 4, -4.4, 0.4, 1.4), box(0x1f1f1f, 0, 3.4, 3.6, 2.6, 3, 3), box(0xb8322a, 0, 1.6, -5.8, 2.8, 0.4, 0.3)); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) g.add(cyl(0xb8322a, s * 1.3, 0.8, -4 + i * 2.6, 0.75, 0.2).rotateZ(Math.PI / 2)); return g; }
function coach(c: number): THREE.Group { return grp(0, 0, 0, 0, box(c, 0, 2.2, 0, 2.8, 2.6, 12), box(0xf4f1ea, 0, 3.7, 0, 2.9, 0.4, 12.2), ...[-4, -1.5, 1, 3.5].map((z) => box(0x9fd0ea, 1.42, 2.5, z, 0.05, 1, 1.8)), ...[-4, -1.5, 1, 3.5].map((z) => box(0x9fd0ea, -1.42, 2.5, z, 0.05, 1, 1.8)), ...[-4, 4].flatMap((z) => [-1, 1].map((s) => cyl(0x222222, s * 1.1, 0.6, z, 0.5, 0.2).rotateZ(Math.PI / 2)))); }
export function gaDaLat(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.ground(GRASS, 900);
  kit.add(box(0xd9c8b0, 0, 0.05, -26, 70, 0.1, 30)); // sân trước lát đá
  const st = station(); st.position.set(0, 0, 0); kit.add(st);
  kit.live(label('Ga Đà Lạt', 0, 22, -4, '#b8452e', 1.1));
  // sân ga và đường ray phía nam
  kit.add(box(0xcfc8b8, 0, 0.4, 12, 60, 0.8, 8)); // thềm sân ga
  kit.add(stairs(0xcfc8b8, V(30, 0, 5.4), V(30, 0.8, 8.1), 3, 3), stairs(0xcfc8b8, V(-28, 0, 5.4), V(-28, 0.8, 8.1), 3, 3));
  for (const zr of [22, 30]) { kit.add(box(0x8a7a66, 0, 0.1, zr, 400, 0.2, 3.2)); for (const s of [-0.75, 0.75]) kit.add(box(0x6a6a6a, 0, 0.32, zr + s, 400, 0.14, 0.12)); for (let x = -200; x < 200; x += 1.4) kit.add(box(0x5a3d26, x, 0.2, zr, 0.3, 0.1, 2.6)); }
  const loco = steam(); loco.rotation.y = Math.PI / 2; loco.position.set(-34, 0.3, 22); kit.add(loco);
  kit.live(label('Đầu máy hơi nước', -34, 8, 22, '#3a3a3a', 0.8));
  // đoàn tàu du lịch Trại Mát chạy ra vào ga
  const train = baked(grp(0, 0, 0, 0, ...[0, 1, 2].map((i) => coach([0x2a6f9a, 0xb8452e, 0x2a6f9a][i]).translateZ(i * 12.8)), steam().translateZ(-12.8)));
  train.rotation.y = -Math.PI / 2; kit.live(train);
  kit.onTick((t) => { const k = (t * 0.03) % 1, x = k < 0.5 ? 20 + k * 2 * 180 : 200 - (k - 0.5) * 2 * 180; train.position.set(x, 0.3, 30); });
  // sân trước: bồn hoa, khách chụp ảnh, xe ngựa; đồi thông xung quanh
  for (let i = 0; i < 5; i++) kit.add(cyl(0xcfc8b8, -24 + i * 12, 0.4, -34, 2.4, 0.8), ...[0, 1, 2, 3, 4].map((k) => box([0xe85aa0, 0xffd23f, 0xf4f1ea][k % 3], -24 + i * 12 + Math.cos(k) * 1.4, 1, -34 + Math.sin(k) * 1.4, 0.5, 0.4, 0.5)));
  for (let i = 0; i < 10; i++) { const p = person(i, i % 3 === 0 ? 2 : 0, [0x9b7fd6, 0x4aa3d8, 0xe2573c, 0xffd23f, 0xf29bc0][i % 5]); p.position.set(-20 + i * 4, 0, -18 - (i % 3) * 3); p.rotation.y = Math.PI; kit.add(p); }
  for (const x of [-30, 30]) kit.add(lampPost(x, 0, -14, 4.4, 0xfff0c4));
  for (let i = 0; i < 110; i++) { const x = -200 + r() * 400, z = -200 + r() * 360; if (Math.abs(x) < 60 && z > -60 && z < 40) continue; if (Math.abs(z - 26) < 8) continue; if (Math.abs(x) < 8 && z < -40) continue; const p = pine(r, 12 + r() * 8); p.position.set(x, 0, z); kit.add(p); }
  for (let i = 0; i < 8; i++) kit.add(forestMountain(0x3d6e4a, -380 + i * 110, -380, 110, 70 + r() * 60, r));
  kit.add(strip(0x5a5d62, V(0, 0, -200), V(0, 0, -42), 8, 0.06), signPost('Ga Đà Lạt · Di tích quốc gia', 6, 0, -52, '#b8452e', 0.9));

  const path = [V(0, 0, -70), V(0, 0, -42), V(0, 0, -30), V(-18, 0, -20), V(-18, 0, -12), V(30, 0, -12), V(30, 0, 5), V(30, 0.8, 9), V(28, 0.8, 12), V(-20, 0.8, 12), V(-28, 0.8, 12), V(-28, 0.8, 16)];
  return {
    path, half: 2, npcs: 10, startYaw: 0,
    stops: [
      { id: 'san_ga', at: V(0, 0, -36), look: V(0, 8, -4) },
      { id: 'mai_nhon', at: V(-16, 0, -20), look: V(-12, 12, -4), cam: V(-26, 4, -38) },
      { id: 'sanh_doi', at: V(30, 0, -10), look: V(14, 4, 0), cam: V(44, 6, -26) },
      { id: 'dau_may', at: V(-26, 0.8, 14), look: V(-34, 3, 22) },
      { id: 'tau_trai_mat', at: V(20, 0.8, 14), look: V(60, 2, 30) },
    ],
    sky: [0x8fc4ea, 0xf2f0e6], fog: [0xe4ece6, 90, 520],
    light: { ambient: 1.6, sun: 1.5, sunColor: 0xfff2dc, sunDir: [-0.4, 0.8, -0.6] },
    shopSpots: [V(-10, 0, -50), V(12, 0, -50), V(40, 0.8, 12)],
  };
}
