// Cồn Phụng (Bến Tre cũ). Bến cồn → sân Đạo Dừa (chín cột rồng, bản đồ đắp nổi) → lò kẹo dừa → đường xe ngựa rợp dừa.
// Sông Tiền bao quanh phía nam. Trục x: tây → đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { coconut, land, nearPath, river } from './nb__kit.ts';

const LANE = 0xc8ab7a, DRAGON = [0x2a9a5a, 0xd8382a, 0xf2c64a];

function dragonPillar(c: number, h = 9): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0xe8e0d0, 0, h / 2, 0, 0.45, h));
  for (let k = 0; k < 14; k++) { const a = k * 0.9; g.add(bead(c, Math.cos(a) * 0.55, 0.6 + k * (h - 1.4) / 14, Math.sin(a) * 0.55, 0.32)); }
  g.add(ball(c, 0.5, h - 0.2, 0, 0.5, 0.4, 0.6), cone(0xffd24a, 0.5, h + 0.3, 0, 0.12, 0.5));
  return g;
}
function horseCart(): THREE.Group {
  return grp(0, 0, 0, 0, ball(0x8a5a3a, 0, 1.3, -2.2, 0.4, 0.5, 0.9), ball(0x8a5a3a, 0, 1.9, -2.9, 0.22, 0.3, 0.36), ...[[-0.2, -1.7], [0.2, -1.7], [-0.2, -2.7], [0.2, -2.7]].map(([x, z]) => cyl(0x6a4a2a, x, 0.5, z, 0.06, 1)),
    box(0xc83a2a, 0, 1.2, 0, 1.6, 0.8, 2.2), box(0x3a6a8a, 0, 2.4, 0, 1.8, 0.1, 2.4), cyl(0x3a2a1a, 0.9, 0.6, 0.4, 0.6, 0.1).rotateZ(Math.PI / 2), cyl(0x3a2a1a, -0.9, 0.6, 0.4, 0.6, 0.1).rotateZ(Math.PI / 2));
}

export function conPhung(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -220, -200, 220, 50, 0x6aa04c, 0, false);
  river(kit, 110, 120, -400, 400);
  const path = [V(-80, 0, 62), V(-80, 0, 44), V(-50, 0, 30), V(-20, 0, 24), V(10, 0, 14), V(40, 0, 6), V(70, 0, -4), V(100, 0, -14), V(130, 0, -10)];
  for (let i = 1; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5); kit.add(box(LANE, m.x, 0.02, m.z, 3.6, 0.04, a.distanceTo(b) + 2, Math.atan2(b.x - a.x, b.z - a.z))); }
  kit.add(box(0x8a6a48, -80, 0.1, 58, 6, 0.2, 16)); for (let z = 52; z <= 64; z += 4) kit.add(cyl(0x6a5038, -82.6, -0.6, z, 0.12, 1.6), cyl(0x6a5038, -77.4, -0.6, z, 0.12, 1.6));
  kit.live(label('Bến Cồn Phụng', -80, 6, 52, '#2f6a8a', 1));
  // sân Đạo Dừa: nền xi măng, chín cột rồng ba màu, bản đồ Việt Nam đắp nổi, tháp chuông
  const DX = -20, DZ = -10;
  kit.add(box(0xd8d0c0, DX, 0.05, DZ, 36, 0.1, 22));
  for (let i = 0; i < 9; i++) { const p = dragonPillar(DRAGON[i % 3], 9 + (i % 2) * 2); p.position.set(DX - 14 + i * 3.5, 0, DZ - 6); kit.add(p); }
  // bản đồ Việt Nam đắp nổi hình chữ S trên hồ nước nhỏ
  kit.add(box(0x6ab4d8, DX, 0.2, DZ + 3, 14, 0.2, 8));
  const S = [[-0.5, -3], [-1, -2], [-0.6, -1], [0.2, 0], [0.4, 1], [0, 2], [-0.6, 2.8], [-1.2, 3.4]];
  S.forEach(([x, z], i) => kit.add(bead(0x6aa04c, DX + x * 1.6, 0.45, DZ + 3 + z * 0.9, 0.7 - Math.abs(i - 3) * 0.05, 0.25, 0.55)));
  kit.add(grp(DX + 14, 0, DZ - 2, 0, box(0xf2c64a, 0, 4, 0, 2.6, 8, 2.6), cone(0xd8382a, 0, 9.4, 0, 2.2, 2.8), cyl(0xc8a040, 0, 6, 0, 0.7, 1.2)));
  kit.live(label('Di tích Đạo Dừa', DX, 15, DZ, '#2a9a5a', 1));
  // lò kẹo dừa: nhà mái lá, chảo lớn, bàn cán, người gói kẹo
  const KX = 40, KZ = -14;
  kit.add(grp(KX, 0, KZ, 0, box(0xa08a62, 0, 1.6, -3, 12, 3.2, 0.2), gable(0xc4a46a, 0, 3.4, 0, 7.6, 1.8, 13, Math.PI / 2), ...[-5.6, 0, 5.6].flatMap((x) => [cyl(0x6a5038, x, 1.7, -3.4, 0.12, 3.4), cyl(0x6a5038, x, 1.7, 3.4, 0.12, 3.4)])));
  for (let i = 0; i < 2; i++) kit.add(cyl(0x5a4a3a, KX - 3 + i * 3, 0.5, KZ - 1, 0.9, 1), cyl(0x3a2a1a, KX - 3 + i * 3, 1.02, KZ - 1, 0.8, 0.06), cyl(0xc8904a, KX - 3 + i * 3, 1.06, KZ - 1, 0.7, 0.04));
  kit.add(box(0x8a6a48, KX + 3.4, 0.8, KZ + 1, 3, 0.1, 1.6)); for (let i = 0; i < 20; i++) kit.add(box(0xf6f0e0, KX + 2.2 + (i % 5) * 0.5, 0.88, KZ + 0.5 + Math.floor(i / 5) * 0.3, 0.3, 0.06, 0.14));
  for (let i = 0; i < 3; i++) { const p = person(i + 6, 0, [0xf3ead2, 0x8a4a6a, 0x3f6f8f][i]); p.position.set(KX - 3 + i * 3, 0, KZ + 1.4); p.rotation.y = Math.PI; kit.add(p); }
  kit.motes(14, 0xffffff, 1.6, () => V(KX - 3 + Math.floor(r() * 2) * 3, 1.2 + r(), KZ - 1), (p, i, _t, dt) => { p.y += dt * 0.5; if (p.y > 3) p.y = 1.2; p.x += Math.sin(i + p.y) * 0.002; });
  kit.live(label('Lò kẹo dừa', KX, 6.6, KZ, '#8a5a2a', 0.9));
  // rừng dừa hai bên lối, xe ngựa chạy
  for (let i = 0; i < 180; i++) { const x = -210 + r() * 420, z = -190 + r() * 235; if (nearPath(path, x, z, 5) || (Math.abs(x - DX) < 20 && Math.abs(z - DZ) < 14) || (Math.abs(x - KX) < 8 && Math.abs(z - KZ) < 6)) continue; const c = coconut(r, 7 + r() * 5); c.position.set(x, 0, z); kit.add(c); }
  const cart = baked(horseCart()); kit.live(cart);
  kit.onTick((t) => { const k = (Math.sin(t * 0.08) + 1) / 2, i = Math.min(path.length - 2, 5 + Math.floor(k * 2.99)), f = k * 3 - (i - 5), a = path[i], b = path[i + 1]; cart.position.copy(a).lerp(b, Math.max(0, Math.min(1, f))); cart.position.z += 2.6; cart.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI; });
  for (let i = 0; i < 8; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.copy(path[2 + (i % 6)]); p.position.x += 1.8; p.rotation.y = r() * 6.28; kit.add(p); }
  return {
    path, half: 2, npcs: 4,
    stops: [
      { id: 'ben', at: V(-80, 0, 54), look: V(-60, 0, 90), cam: V(-86, 4, 44) },
      { id: 'dao_dua', at: V(-20, 0, 24), look: V(DX, 5, DZ - 4), cam: V(-14, 5, 32) },
      { id: 'lo_keo', at: V(40, 0, 6), look: V(KX, 1, KZ - 1), cam: V(44, 4, 12) },
      { id: 'xe_ngua', at: V(100, 0, -14), look: V(120, 2, -20), cam: V(94, 4, -6) },
    ],
    sky: [0x78b8e8, 0xf0ecd8], fog: [0xe8e6d0, 100, 520],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(-74, 0, 40), V(10, 0, 20), V(76, 0, 2)],
  };
}
