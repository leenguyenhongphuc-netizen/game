// Ao Bà Om (Trà Vinh). Ao gần vuông giữa cảnh, bờ đất cao trồng cây dầu cổ thụ rễ lồi; chùa Âng ở phía tây ao,
// bảo tàng văn hoá Khmer ở phía bắc. Lối dạo chạy trên bờ ao. Trục x: tây → đông.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { bigTree, khmerStupa, khmerTemple, land, nearPath } from './nb__kit.ts';

const BANK = 0xc8b088, POND = 0x4f8a7a;

export function aoBaOm(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  // ao 120 × 90 m ở giữa (x -20..100, z -45..45); bờ quanh ao
  land(kit, -260, -260, 260, -45, 0x6aa04c, 0, false); land(kit, -260, 45, 260, 260, 0x6aa04c, 0, false);
  land(kit, -260, -45, -20, 45, 0x6aa04c, 0, false); land(kit, 100, -45, 260, 45, 0x6aa04c, 0, false);
  kit.add(box(0x3a5a4a, 40, -2.4, 0, 120, 1, 90)); kit.water(POND, 40, 0, 120, 90, -1.1, 0.92);
  for (let i = 0; i < 4; i++) { const horiz = i < 2, z = i === 0 ? -48 : 48, x = i === 2 ? -23 : 103; kit.add(horiz ? box(BANK, 40, 0.03, z, 128, 0.06, 4) : box(BANK, x, 0.03, 0, 4, 0.06, 100)); }
  const path = [V(40, 0, 70), V(40, 0, 50), V(0, 0, 48), V(-23, 0, 30), V(-23, 0, 0), V(-23, 0, -30), V(0, 0, -48), V(40, 0, -48), V(60, 0, -62)];
  // hàng cây dầu cổ thụ rễ lồi quanh bờ
  for (let i = 0; i < 64; i++) { const side = i % 4, k = r(); const x = side < 2 ? -24 + k * 128 : side === 2 ? -29 : 109, z = side === 0 ? -54 : side === 1 ? 54 : -45 + k * 90; if (nearPath(path, x, z, 4) || (side === 2 && Math.abs(z) < 16)) continue; const t = bigTree(r, 22 + r() * 8); t.position.set(x, 0, z); kit.add(t); }
  // chùa Âng phía tây ao: cổng, chánh điện mái nhiều tầng, tháp nhọn
  const CX = -70, CZ = 0;
  const tm = khmerTemple(12, 22, 5.6); tm.position.set(CX, 0, CZ); tm.rotation.y = Math.PI / 2; kit.add(tm);
  for (const dz of [-24, 24]) { const st = khmerStupa(9); st.position.set(CX + 14, 0, CZ + dz); kit.add(st); }
  kit.add(grp(-40, 0, 0, Math.PI / 2, box(0xf2c64a, -4, 3, 0, 1.4, 6, 1.4), box(0xf2c64a, 4, 3, 0, 1.4, 6, 1.4), box(0xd9551e, 0, 6.6, 0, 11, 1.2, 2), box(0xffd24a, 0, 7.6, 0, 3, 1.4, 0.4)));
  kit.live(label('Chùa Âng (Angkorajaborey)', CX, 18, CZ, '#d9551e', 1.1));
  // bảo tàng văn hoá Khmer phía bắc: nhà mái nhọn nhỏ hơn
  const mu = khmerTemple(10, 16, 4.6); mu.position.set(10, 0, -84); kit.add(mu);
  kit.add(grp(-6, 0, -70, 0.3, box(0x8a3a2a, 0, 0.3, 0, 1.4, 0.4, 12), box(0xffd24a, 0, 0.6, -6, 1.2, 0.8, 0.6))); // ghe ngo trưng bày
  kit.live(label('Bảo tàng Văn hoá Khmer', 10, 15, -84, '#8a3a2a', 0.9));
  for (let i = 0; i < 12; i++) { const p = person(i, i % 4 === 0 ? 1 : 0, i % 3 === 0 ? 0xf2a03a : undefined); p.position.copy(path[1 + (i % 7)]); p.position.x += 1.6; p.rotation.y = r() * 6.28; kit.add(p); }
  return {
    path, half: 1.8, npcs: 4,
    stops: [
      { id: 'bo_ao', at: V(40, 0, 50), look: V(40, 0, 0), cam: V(34, 5, 58) },
      { id: 'cay_dau', at: V(0, 0, 48), look: V(-6, 3, 54), cam: V(8, 3, 42) },
      { id: 'chua_ang', at: V(-23, 0, 0), look: V(CX, 6, CZ), cam: V(-16, 5, 8) },
      { id: 'bao_tang', at: V(0, 0, -48), look: V(10, 4, -84), cam: V(6, 4, -40) },
    ],
    sky: [0x78b8e8, 0xf2ecd8], fog: [0xe8e6d6, 100, 560],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(46, 0, 60), V(-18, 0, 24), V(30, 0, -52)],
  };
}
