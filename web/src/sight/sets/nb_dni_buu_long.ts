// Khu du lịch Bửu Long, Biên Hoà. Hồ Long Ẩn nằm giữa vách đá xám (moong đá cũ), cầu sang đảo nhỏ giữa hồ,
// chùa Bửu Phong trên đồi phía bắc. Trục x: tây → đông; hồ ở giữa cảnh.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cone, cyl, grp, label, person, rock, stairs, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { land, railing } from './nb__kit.ts';

const ROCK = [0x8a8a86, 0x9a9690, 0x7a7a76, 0xa8a49c], PAVE = 0xcfc4ae, WATER = 0x3f8a8a;

export function buuLong(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  // nền: bờ nam (lối vào), bờ đông, đồi chùa phía bắc; hồ ở giữa (x -60..40, z -40..20)
  land(kit, -260, 20, 260, 220, 0x6aa04c, 0, false);
  land(kit, 40, -200, 260, 20, 0x6aa04c, 0, false);
  land(kit, -260, -200, 40, -40, 0x5f9446, 0, false);
  land(kit, -260, -40, -60, 20, 0x6aa04c, 0, false);
  kit.add(box(0x2f5a5a, -10, -4, -10, 100, 1, 60)); kit.water(WATER, -10, -10, 100, 60, -1.2, 0.9);
  // vách đá dựng quanh hồ
  for (let i = 0; i < 46; i++) { const side = i % 4; const x = side === 0 ? -60 + r() * 100 : side === 1 ? -60 + r() * 100 : side === 2 ? -62 : 42, z = side === 0 ? -42 : side === 1 ? 22 : -40 + r() * 60, h = 4 + r() * 9; if (side === 1 && x > -8 && x < 8) continue; kit.add(box(ROCK[i % 4], x, h / 2 - 1.5, z, 4 + r() * 6, h, 3 + r() * 3, r() * 0.4)); }
  for (let i = 0; i < 16; i++) kit.add(rock(ROCK[i % 4], -50 + r() * 80, -1.2, -30 + r() * 40, 1 + r() * 2, 0.8 + r(), 1 + r() * 2, r() * 6));
  // đảo giữa hồ có chòi bát giác, cầu nối từ bờ nam
  kit.add(cyl(ROCK[1], -10, -1.6, -12, 9, 3), cyl(0x6aa04c, -10, -0.05, -12, 8.4, 0.1));
  kit.add(grp(-10, 0, -14, 0, cyl(0xd9cfbd, 0, 0.15, 0, 3.2, 0.3), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => cyl(0x8a3a2a, Math.cos(i * 0.785) * 2.6, 1.6, Math.sin(i * 0.785) * 2.6, 0.12, 2.8)), cone(0x8f4a36, 0, 4, 0, 3.6, 1.8)));
  kit.add(box(0x9a7150, -10, 0, 9.5, 3, 0.3, 17)); railing(kit, V(-11.5, 0, 1), V(-11.5, 0, 18), 0x8a3a2a, 1); railing(kit, V(-8.5, 0, 1), V(-8.5, 0, 18), 0x8a3a2a, 1);
  for (let i = 0; i < 4; i++) kit.add(grp(-40 + i * 12, -1.1, 4 - (i % 2) * 16, r() * 6, ball(0xffd23f, 0, 0.4, 0, 0.9, 0.5, 1.4), ball(0xffffff, 0, 1, -0.6, 0.4)));
  // lối dạo lát đá bờ nam, cổng khu du lịch
  kit.add(box(PAVE, -10, 0.04, 36, 200, 0.08, 6));
  kit.add(box(0xb8322a, -100, 3, 30, 1.2, 6, 1.2), box(0xb8322a, -100, 3, 42, 1.2, 6, 1.2), box(0xffd24a, -100, 6.4, 36, 1.4, 1, 14)); kit.live(label('Khu du lịch Bửu Long', -100, 9, 36, '#b8322a', 1.1));
  for (let x = -90; x < 80; x += 10) { const t = tree(r, 1.3, r() < 0.4); t.position.set(x + r() * 3, 0, 44 + r() * 4); kit.add(t); }
  // đồi chùa phía bắc: bậc đá lên sân chùa Bửu Phong ở cao độ 10
  const HY = 10;
  kit.add(box(0x5f9446, 90, HY / 2 - 0.5, -67, 90, HY, 46), box(PAVE, 90, HY + 0.02, -60, 40, 0.06, 24));
  kit.add(stairs(0xb8b0a2, V(80, 0, -24), V(80, HY, -44), 3.4, 30));
  const pag = grp(92, HY, -70, 0, box(0xf2d08a, 0, 2.2, 0, 16, 4.4, 10), templeRoof(0xb85a2a, 0, 4.4, 0, 18, 2.4, 12, 0xffd24a), box(0x8a2a1a, 0, 1.6, 5.05, 3, 3.2, 0.1));
  kit.add(pag, grp(104, HY, -56, 0, box(0xe8e0d0, 0, 0.5, 0, 9, 1, 3), ball(0xf2f0ea, 0, 1.6, 0, 4, 0.9, 1)));
  kit.live(label('Chùa Bửu Phong', 92, HY + 11, -70, '#b85a2a', 1));
  for (let i = 0; i < 14; i++) { const t = tree(r, 1.2 + r() * 0.5, true); t.position.set(60 + r() * 60, HY, -88 + r() * 6); kit.add(t); }
  for (let i = 0; i < 10; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.set(-60 + i * 12, 0, 34 + (i % 2) * 3); p.rotation.y = r() * 6.28; kit.add(p); }

  const path = [V(-110, 0, 36), V(-90, 0, 36), V(-50, 0, 34), V(-12, 0, 30), V(-10, 0, 18), V(-10, 0, 2), V(-10, 0, 18), V(-10, 0, 30), V(30, 0, 34), V(70, 0, 28), V(80, 0, -24), V(80, HY, -44), V(88, HY, -56), V(98, HY, -60)];
  return {
    path, half: 1.8, npcs: 4,
    stops: [
      { id: 'cong', at: V(-94, 0, 36), look: V(-100, 5, 36), cam: V(-86, 3, 42) },
      { id: 'ho_long_an', at: V(-50, 0, 34), look: V(-30, 2, -20), cam: V(-54, 5, 40) },
      { id: 'cau_treo', at: V(-10, 0, 4), look: V(-10, 2, -14), cam: V(-6, 4, 12) },
      { id: 'chua_buu_phong', at: V(88, HY, -56), look: V(92, HY + 4, -70), cam: V(84, HY + 4, -46) },
      { id: 'loi_ra', at: V(98, HY, -60), look: V(-10, 0, -10), cam: V(100, HY + 5, -52) },
    ],
    sky: [0x6ab0e4, 0xeee8d6], fog: [0xe4e8dc, 120, 620],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff2d6, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(-80, 0, 40), V(40, 0, 38), V(84, HY, -52)],
  };
}
