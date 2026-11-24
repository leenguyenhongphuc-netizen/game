// Vịnh Hạ Long – đảo Bồ Hòn và hang Sửng Sốt. Trục x: tây → đông; z: bắc → nam.
// Bến tàu phía nam đảo → bậc đá lên lưng chừng vách → hang Sửng Sốt (ngăn ngoài, ngăn trong rộng như nhà hát) → cửa ra phía đông
// nhìn xuống vụng neo tàu → bậc xuống bến phía đông, nhìn sang đảo Ti Tốp.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, label, person, rock, signPost, stairs } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { LIME, karst } from './db__kit.ts';

const SEA = 0x2f9a9a, CAVE = 0xb7a58a, CF = 10; // cao độ sàn hang
export function haLong(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.add(box(0x2a6f70, 0, -4, 0, 1800, 1, 1800)); kit.water(SEA, 0, 0, 1800, 1800, -0.5, 0.82);
  // khối đảo Bồ Hòn: các tháp đá vôi quây lấy một thềm cao (lòng hang) — chừa lối vào nam và lối ra đông
  kit.add(box(0x8a8478, 0, CF - 5.2, -6, 34, 10, 30)); // khối nền dưới sàn hang
  kit.add(box(CAVE, 0, CF - 0.1, -6, 34, 0.2, 30));
  const ring: [number, number, number, number][] = [[-22, -24, 11, 34], [-4, -28, 12, 38], [16, -26, 11, 33], [26, -12, 9, 30], [-26, -4, 10, 30], [-22, 14, 10, 28], [22, 16, 9, 26], [-38, -20, 9, 24], [36, -30, 8, 22]];
  for (const [x, z, rr, h] of ring) kit.add(karst(x, z, rr, h, r, -3, 0x4f7f45));
  // trần hang: các khối đá treo cao (lớp trên, được làm mờ khi đứng dưới)
  for (let i = 0; i < 6; i++) kit.add(rock(LIME[i % 4], -12 + (i % 3) * 12, CF + 17 + r() * 2, -18 + Math.floor(i / 3) * 14, 7, 2.4, 6, r() * 3));
  // nhũ đá, măng đá, ánh đèn màu trong hang
  for (let i = 0; i < 36; i++) { const x = -14 + r() * 28, z = -18 + r() * 24; if (Math.abs(x) < 3.5 || Math.hypot(x - 8, z + 4) < 4) continue; i % 2 ? kit.add(cone(0xd8c8a8, x, CF + 13 - r() * 2, z, 0.5 + r() * 0.6, 3 + r() * 3).rotateX(Math.PI)) : kit.add(cone(0xcbb894, x, CF + 1 + r(), z, 0.4 + r() * 0.5, 2 + r() * 2.4)); }
  for (const [x, z, c] of [[-9, -12, 0x5ac8ff], [9, -14, 0xff7ad0], [-10, 2, 0x9aff7a], [10, 0, 0xffd06a]] as const) kit.add(bead(glow(c), x, CF + 0.5, z, 0.5));
  kit.add(rock(0xc8b48c, -6, CF + 2, -10, 2, 3.2, 1.6, 0.3)); // tảng đá hình "cột chống trời"
  kit.motes(40, 0x9fe6ff, 0.6, () => V(-12 + r() * 24, CF + 1 + r() * 6, -18 + r() * 22), (p, i, t) => { p.y = CF + 2 + Math.sin(t * 0.6 + i) * 2.4 + (i % 5); });
  // bậc đá từ bến nam lên cửa hang, bậc từ cửa ra đông xuống bến đông
  kit.add(box(0xc9c4b8, 0, 0.6, 40, 16, 1.2, 14), box(0xc9c4b8, 6, 0.6, 52, 6, 1.2, 14)); // bến nam
  kit.add(stairs(0xb8ae98, V(0, 1.2, 34), V(0, CF, 10), 3.4));
  kit.add(box(0xc9c4b8, 40, 0.6, 2, 14, 1.2, 12)); // bến đông
  kit.add(box(0xb8ae98, 22, CF - 0.1, 2, 10, 0.2, 5), box(0x8a8478, 22, CF - 5.2, 2, 10, 10, 5), stairs(0xb8ae98, V(27, CF, 2), V(36, 1.2, 2), 3.2));
  for (let i = 0; i < 12; i++) kit.add(cyl(0x7a5a3c, -1.9 + (i % 2) * 3.8, 1.2 + (i >> 1) * 1.5 + 0.5, 32 - (i >> 1) * 4, 0.05, 1)); // tay vịn
  // tàu tham quan neo ở bến, nhà chờ
  const tour = (x: number, z: number, ry: number, c = 0xf4f1ea) => grp(x, -0.3, z, ry, box(0x5a3a22, 0, 0.8, 0, 5, 1.4, 18), box(c, 0, 2.4, -1, 4.6, 1.8, 13), box(0x6fa8c8, 0, 2.5, -1, 4.7, 0.8, 12), box(c, 0, 4, -1, 4.8, 0.3, 14), box(0x8a4a2a, 0, 4.4, -3, 3, 0.6, 6), cone(0x5a3a22, 0, 0.8, 10.4, 2.5, 3).rotateX(Math.PI / 2), cyl(0xcfd6e0, 0, 6, -7, 0.05, 3.4), box(0xd8281e, 0.5, 7.3, -7, 1, 0.66, 0.03));
  kit.add(tour(14, 48, 0.1), tour(-14, 52, -0.15, 0xfff3d6), tour(56, 4, Math.PI / 2 + 0.1), tour(60, -18, Math.PI / 2 - 0.2, 0xfff3d6));
  kit.add(box(0xf1e3b8, -12, 2.6, 38, 8, 2.8, 5), box(0x8a4a2a, -12, 4.2, 38, 9, 0.4, 6));
  // vụng kín gió phía đông bắc, các đảo đá vôi trải khắp vịnh, đảo Ti Tốp phía đông
  for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = 90 + r() * 380, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x - 170, z - 40) < 50) continue; kit.add(karst(x, z, 6 + r() * 14, 18 + r() * 40, r, -3)); }
  const TT = grp(170, 0, 40); TT.add(karst(0, -10, 22, 46, r, -3, 0x5f8f4a), cyl(0xf6ecd0, 4, -0.5, 18, 30, 1, 12), box(0xf1e3b8, 18, 3, 12, 6, 2, 4), cyl(0xd8c8a0, 2, 46, -10, 1.6, 3)); kit.add(TT);
  for (let i = 0; i < 10; i++) { const k = rock(0x7f7f78, -60 + r() * 140, -0.3, -80 + r() * 160, 2 + r() * 3, 1 + r(), 2 + r() * 3); kit.add(k); }
  // khách tham quan
  for (let i = 0; i < 12; i++) { const p = person(i, i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0); if (i < 6) p.position.set(-6 + r() * 12, CF, -16 + r() * 18); else p.position.set(-6 + r() * 12, 1.2, 36 + r() * 8); p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Hang Sửng Sốt', 0, CF + 7, 12, '#5a5a54', 1.0), label('Đảo Ti Tốp', 170, 52, 30, '#2a7f9a', 2.2), label('Bến đảo Bồ Hòn', 0, 6, 46, '#1f6fae', 1.0));
  kit.add(signPost('Lối vào hang ↑', 3, 1.2, 33, '#5a3a22', 0.8));
  void ball;

  const path = [V(4, 1.2, 50), V(2, 1.2, 40), V(0, 1.2, 34), V(0, CF, 10), V(0, CF, 2), V(-2, CF, -8), V(4, CF, -16), V(12, CF, -4), V(16, CF, 2), V(27, CF, 2), V(36, 1.2, 2), V(42, 1.2, 2)];
  return {
    path, half: 1.6, npcs: 6, startYaw: 0,
    extras: [
      { frac: 0.45, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Vịnh Hạ Long được UNESCO ghi danh Di sản thiên nhiên thế giới năm 1994 và lần hai năm 2000.', q: 'Vịnh Hạ Long được UNESCO ghi danh Di sản thiên nhiên thế giới mấy lần?', options: ['Một lần', 'Hai lần', 'Ba lần'], answer: 1 },
      { frac: 0.95, kind: 'ngam_canh', name: 'Ngắm vịnh từ bến đông', fact: 'Phía đông đảo Bồ Hòn là đảo Ti Tốp với bãi tắm hình vầng trăng; giữa hai đảo là luồng tàu tham quan tấp nập.' },
    ],
    stops: [
      { id: 'ben_bo_hon', at: V(2, 1.2, 42), look: V(0, 14, 0) },
      { id: 'hang_sung_sot', at: V(0, CF, 4), look: V(0, CF + 4, -8), cam: V(0, CF + 3, 14) },
      { id: 'dinh_bo_hon', at: V(4, CF, -15), look: V(-6, CF + 3, -10) },
      { id: 'dao_ti_top', at: V(24, CF, 2), look: V(60, 4, -14) },
      { id: 'chot_ngam', at: V(42, 1.2, 2), look: V(170, 30, 30) },
    ],
    sky: [0x6fa6d8, 0xd8ecf2], fog: [0xcfe4ea, 160, 700],
    light: { ambient: 1.55, sun: 1.6, sunColor: 0xfff0d0, sunDir: [-0.4, 0.65, 0.5], ambientColor: 0xf0f6ff },
    shopSpots: [V(-6, 1.2, 44), V(42, 1.2, 6)],
  };
}
void THREE;
