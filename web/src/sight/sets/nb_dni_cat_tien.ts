// Vườn quốc gia Cát Tiên. Bến phà bờ nam sông Đồng Nai → cầu phao sang bờ bắc → lối mòn dưới tán rừng già:
// cây tung cổ thụ, trạm cứu hộ gấu, Bàu Sấu, trung tâm du khách. Trục x: tây → đông; sông chảy theo trục x ở z = 30.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, gable, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { bigTree, land, river } from './nb__kit.ts';

const FOREST = 0x4a6a3a, TRAIL = 0xb8955e, WOOD = 0x8a6a48;
function jungleTree(r: () => number): THREE.Group {
  const h = 14 + r() * 10, g = grp(0, 0, 0, 0, cyl(0x6a5a46, 0, h / 2, 0, 0.4 + r() * 0.3, h));
  for (let i = 0; i < 3; i++) g.add(bead([0x2f5a2f, 0x3a6a36, 0x467a3e][i], (r() - 0.5) * 4, h - 1 + i * 1.4, (r() - 0.5) * 4, 3.4 + r() * 2, 2.2, 3.4 + r() * 2));
  if (r() < 0.4) g.add(cyl(0x4a7a3a, 0.5, h * 0.5, 0, 0.05, h * 0.9)); // dây leo
  return g;
}
function bear(): THREE.Group { return grp(0, 0, 0, 0, ball(0x1f1a16, 0, 0.6, 0, 0.6, 0.5, 0.9), ball(0x1f1a16, 0, 0.9, -0.85, 0.36), ball(0xe8d8b0, 0, 0.8, -1.14, 0.14), bead(0xf2e6c0, 0, 0.75, -0.5, 0.3, 0.12, 0.05), ...[[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5]].map(([x, z]) => cyl(0x1f1a16, x, 0.25, z, 0.13, 0.5))); }

export function catTien(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -260, 40, 260, 200, 0x6a8a4a, 0, false); // bờ nam
  land(kit, -260, -260, 260, 20, FOREST, 0, false); // bờ bắc, rừng
  river(kit, 30, 20, -260, 260, 0x7a8a5e);
  // bến phà bờ nam, cầu phao bắc qua sông, chiếc phà neo cạnh
  kit.add(box(0x9a958a, 0, 0.05, 52, 8, 0.1, 16), box(WOOD, 0, 0.1, 30, 3.6, 0.3, 24));
  for (let z = 20; z <= 40; z += 4) kit.add(cyl(0x3a5a6a, -1.6, -0.3, z, 0.4, 0.6), cyl(0x3a5a6a, 1.6, -0.3, z, 0.4, 0.6));
  kit.add(grp(9, -0.5, 30, 0, box(0x3a5a7a, 0, 0.4, 0, 8, 0.9, 16), box(0xe8e0d0, 0, 1.6, -4, 4, 1.8, 3), box(0x7a2a2a, 0, 2.6, -4, 4.4, 0.2, 3.4)));
  kit.live(label('Bến phà Cát Tiên', 0, 6, 46, '#3a5a7a', 1));
  // rừng già bờ bắc: nhiều tầng tán, chừa lối mòn
  const path = [V(0, 0, 60), V(0, 0, 46), V(0, 0.25, 30), V(0, 0, 14), V(-14, 0, 2), V(-40, 0, -8), V(-64, 0, -22), V(-50, 0, -50), V(-20, 0, -66), V(14, 0, -62), V(40, 0, -48), V(56, 0, -30), V(70, 0, -12)];
  const near = (x: number, z: number, d: number) => path.some((p, i) => { if (i === 0) return false; const q = path[i - 1], dx = p.x - q.x, dz = p.z - q.z, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - q.x) * dx + (z - q.z) * dz) / l2)); return Math.hypot(q.x + dx * t - x, q.z + dz * t - z) < d; });
  for (let i = 0; i < 260; i++) { const x = (r() - 0.5) * 480, z = -250 + r() * 262; if (near(x, z, 6)) continue; const t = jungleTree(r); t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 140; i++) { const x = (r() - 0.5) * 300, z = -150 + r() * 160; if (near(x, z, 3)) continue; kit.add(ball([0x3f6a36, 0x527a40][i % 2], x, 0.6, z, 1 + r(), 0.7, 1 + r())); }
  for (let i = 0; i < path.length - 1; i++) { if (i < 3) continue; const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5); kit.add(box(TRAIL, m.x, 0.02, m.z, 3, 0.04, a.distanceTo(b) + 2, Math.atan2(b.x - a.x, b.z - a.z))); }
  // cây tung cổ thụ: rễ bạnh lớn cao quá đầu người
  const TX = -72, TZ = -26;
  const tung = bigTree(r, 30); tung.position.set(TX, 0, TZ); tung.scale.set(1.3, 1, 1.3); kit.add(tung);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; kit.add(box(0x7a6a56, TX + Math.cos(a) * 2.2, 1.6, TZ + Math.sin(a) * 2.2, 3.4, 3.2, 0.4, -a)); }
  kit.add(box(WOOD, TX + 5, 0.4, TZ + 3, 5, 0.1, 2.4)); kit.live(label('Cây tung 400 năm', TX, 8, TZ, '#4a3a24', 0.9));
  // trạm cứu hộ gấu: hàng rào lưới, nhà gỗ, gấu ngựa
  const BX = -24, BZ = -82;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.28; kit.add(cyl(0x8a8f96, BX + Math.cos(a) * 12, 1.6, BZ + Math.sin(a) * 10, 0.08, 3.2)); }
  for (let i = 0; i < 4; i++) { const b = bear(); b.position.set(BX - 6 + i * 4, 0, BZ - 3 + (i % 2) * 3); b.rotation.y = r() * 6.28; kit.add(b); }
  kit.add(grp(BX + 6, 0, BZ - 6, 0, box(WOOD, 0, 1.4, 0, 5, 2.8, 4), gable(0x6a4a30, 0, 2.8, 0, 4.6, 1.4, 5.4, Math.PI / 2)), box(0x8a6a48, BX - 4, 1.6, BZ + 2, 3, 0.3, 0.3), cyl(0x8a6a48, BX - 4, 0.8, BZ + 2, 0.2, 1.6));
  kit.live(label('Trạm cứu hộ gấu', BX, 6, BZ, '#4a3a24', 0.9));
  // Bàu Sấu: đầm nước giữa rừng, cá sấu nổi lưng
  const SX = 44, SZ = -80;
  kit.add(box(0x3f4a2a, SX, -1.6, SZ, 50, 1, 30)); kit.water(0x5a6a3e, SX, SZ, 50, 30, -0.5, 0.95);
  for (let i = 0; i < 4; i++) kit.add(grp(SX - 14 + i * 9, -0.45, SZ + (r() - 0.5) * 12, r() * 6.28, ball(0x3a4a2a, 0, 0, 0, 0.5, 0.18, 1.8), ball(0x3a4a2a, 0, 0.05, -1.8, 0.3, 0.14, 0.6)));
  kit.add(box(WOOD, SX - 6, 0.8, SZ + 18, 10, 0.15, 3), box(WOOD, SX - 6, 1.6, SZ + 19.4, 10, 0.1, 0.1)); kit.live(label('Bàu Sấu', SX, 5, SZ, '#3a5a3a', 1));
  // trung tâm du khách
  kit.add(grp(78, 0, -4, -0.6, box(0xd8c8a0, 0, 2, 0, 14, 4, 8), gable(0x6a4a30, 0, 4, 0, 9, 2.2, 15, Math.PI / 2), box(0x4a3020, 0, 1.4, 4.05, 2, 2.8, 0.1)));
  for (let i = 0; i < 8; i++) { const p = person(i, i % 2 ? 2 : 0); p.position.copy(path[3 + i]); p.position.x += 1.6; p.rotation.y = r() * 6.28; kit.add(p); }
  kit.motes(40, 0xfff0a0, 1.2, () => V((r() - 0.5) * 120, 1 + r() * 6, -80 + r() * 90), (p, i, t) => { p.y += Math.sin(t * 2 + i) * 0.003; });
  return {
    path, half: 1.8, npcs: 4,
    stops: [
      { id: 'ben_pha', at: V(0, 0, 46), look: V(9, 1.5, 30), cam: V(-6, 4, 56) },
      { id: 'cay_tung', at: V(-64, 0, -22), look: V(TX, 6, TZ), cam: V(-58, 3, -16) },
      { id: 'cuu_ho_gau', at: V(-20, 0, -66), look: V(BX, 1, BZ), cam: V(-16, 4, -62) },
      { id: 'bau_sau', at: V(40, 0, -48), look: V(SX, 0, SZ), cam: V(36, 5, -42) },
      { id: 'nha_trung_bay', at: V(70, 0, -12), look: V(78, 2, -4), cam: V(64, 4, -18) },
    ],
    sky: [0x7ab4d8, 0xdfe8d4], fog: [0xc8d8c0, 50, 260],
    light: { ambient: 1.4, sun: 1.5, sunColor: 0xfff2d0, sunDir: [-0.3, 1, 0.4] },
    shopSpots: [V(5, 0, 56), V(-30, 0, -4), V(60, 0, -22)],
  };
}
