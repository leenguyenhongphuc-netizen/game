// Chùa Dâu (Diên Ứng tự), Thuận Thành, Bắc Ninh. Trục x: tây → đông; z: bắc → nam. Chùa giữa cánh đồng lúa vùng Luy Lâu.
// Cổng chùa (nam) → tháp Hoà Phong giữa sân → các toà chùa nối nhau thờ Pháp Vân → sân hội phía đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, incenseUrn, label, person, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { BRICK, MOSS, banyan, bamboo, hall, landWithLakes, lotus, northRoof, tamQuan } from './db__kit.ts';

export function chuaDau(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  const AO = { x: 46, z: 40, rx: 16, rz: 12 };
  landWithLakes(kit, -220, -200, 220, 220, [AO], 0x86a85e, { kerb: 0x9a8f7a, water: 0x5f9a7a });
  lotus(kit, AO, 22, r);
  // ruộng lúa xanh quanh chùa (dải ô), bờ ruộng
  for (let i = 0; i < 40; i++) { const x = -200 + (i % 8) * 50, z = -180 + Math.floor(i / 8) * 80; if (Math.abs(x) < 70 && Math.abs(z) < 110) continue; kit.add(box(i % 3 ? 0x8fc85a : 0xb8d86a, x, 0.04, z, 46, 0.08, 70), box(0x9a8a5a, x, 0.1, z + 35, 46, 0.2, 1)); }
  // tường bao và cổng chùa
  kit.add(box(0xc9b89a, 0, 0.03, 0, 26, 0.06, 150));
  kit.add(box(0xe8dcc0, -40, 1.2, 0, 0.8, 2.4, 150), box(0x8a3a24, -40, 2.5, 0, 1.4, 0.3, 150));
  for (const [z, len] of [[-37.5, 75], [42.5, 65]] as const) kit.add(box(0xe8dcc0, 40, 1.2, z, 0.8, 2.4, len), box(0x8a3a24, 40, 2.5, z, 1.4, 0.3, len)); // cổng ngách phía đông ra sân hội
  kit.add(box(0xe8dcc0, -26, 1.2, 75, 28, 2.4, 0.8), box(0xe8dcc0, 26, 1.2, 75, 28, 2.4, 0.8));
  kit.add(tamQuan(0, 75, 0, 6));
  // tháp Hoà Phong: tháp gạch nung ba tầng còn lại, bốn tượng Thiên Vương bốn góc
  const TZ = 30, tp = grp(0, 0, TZ);
  tp.add(box(0x9a8a72, 0, 0.3, 0, 9, 0.6, 9));
  let y = 0.6; for (let i = 0; i < 3; i++) { const w = 6.6 - i * 1.2, h = i ? 4 : 6; tp.add(box(BRICK, 0, y + h / 2, 0, w, h, w)); for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) tp.add(box(0x2a1a12, sx * (w / 2 + 0.01), y + h * 0.42, sz * (w / 2 + 0.01), sx ? 0.04 : 1.4, h * 0.5, sz ? 0.04 : 1.4)); tp.add(box(0x7a3a26, 0, y + h + 0.2, 0, w + 0.8, 0.4, w + 0.8)); y += h + 0.4; }
  tp.add(box(MOSS, 0, y + 0.3, 0, 2.6, 0.6, 2.6), ball(0x5f7a4a, 0.4, y + 0.8, 0, 0.8, 0.5, 0.7));
  for (const [x, z] of [[-3, 3], [3, 3], [-3, -3], [3, -3]] as const) tp.add(cyl(0x8a857a, x, 1.6, z, 0.34, 2, 0.26), ball(0x8a857a, x, 2.8, z, 0.28)); // Thiên Vương ngồi góc tháp
  for (let i = 0; i < 4; i++) tp.add(bead(0x4f8a3e, (r() - 0.5) * 3, y - 2 - i * 2.2, 3.2, 0.5, 0.3, 0.2)); // cây cỏ mọc trên tường tháp cổ
  kit.add(tp);
  // các toà chùa nối nhau phía sau tháp: tiền đường, thiêu hương, thượng điện, hậu đường
  kit.add(hall(0, 4, 18, 8, 3.4, 0), hall(0, -14, 14, 7, 3.6, 0, { lit: true }), hall(0, -32, 16, 8, 3.8, 0, { twoTier: true, lit: true }));
  for (const s of [-1, 1]) kit.add(hall(s * 28, -10, 6, 40, 3, Math.PI / 2 * s * 0)); // hai dãy hành lang
  const urn = incenseUrn(); urn.position.set(0, 0, 14); kit.add(urn);
  for (let i = 0; i < 10; i++) kit.add(bead(glow(0xff6a3a), -8 + i * 1.8, 4, -10.5, 0.24, 0.3, 0.24));
  // sân hội: cờ ngũ sắc, cột cờ, kiệu rước
  for (let i = 0; i < 12; i++) { const x = 52 + (i % 4) * 6, z = -20 + Math.floor(i / 4) * 8; kit.add(cyl(0xcfd6e0, x, 3, z, 0.05, 6), box([0xd8281e, 0xffd23f, 0x2a6fbf, 0x3fa04a, 0xffffff][i % 5], x + 0.6, 5.4, z, 1.2, 0.9, 0.03)); }
  kit.add(grp(70, 0, -2, 0, box(0xd8281e, 0, 1.4, 0, 2.4, 1.6, 3.4), northRoof(0, 2.2, 0, 2.6, 3.6, 0.8, 0xd8a028), cyl(0x8a3a24, -0.6, 0.6, 2.4, 0.08, 1.2), cyl(0x8a3a24, 0.6, 0.6, 2.4, 0.08, 1.2)));
  kit.add(box(0xc9b89a, 60, 0.03, -6, 40, 0.06, 36));
  // cây đa, tre làng, nhà dân quanh
  for (const [x, z] of [[-18, 50], [20, 56], [-22, -50], [30, 66]] as const) { const t = banyan(r, 0.6 + r() * 0.2); t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 26; i++) { const t = i % 3 ? bamboo(r, 0.9) : tree(r, 1.2, true); const a = r() * 6.28, d = 92 + r() * 40; t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); kit.add(t); }
  for (let i = 0; i < 10; i++) { const x = -120 + (i % 5) * 18, z = 110 + Math.floor(i / 5) * 18; kit.add(box(0xe8dcc0, x, 1.6, z, 9, 3.2, 6), northRoof(x, 3.2, z, 9, 6, 1.4, 0x9a4a2a), box(0x6a4a2a, x, 1.2, z + 3.02, 1.4, 2.2, 0.06)); }
  for (let i = 0; i < 14; i++) { const p = person(i, i % 3 === 0 ? 1 : 0, i % 4 === 0 ? 0x8a5a32 : undefined); p.position.set((r() - 0.5) * 30 + (i > 9 ? 60 : 0), 0, (r() - 0.5) * 90); p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Chùa Dâu', 0, 11, 75, '#9a3f2a', 1.0), label('Tháp Hoà Phong', 0, y + 4, TZ, '#7a3a26', 1.0), label('Sân hội chùa Dâu', 62, 9, -6, '#d8281e', 0.9));
  kit.add(signPost('Luy Lâu', 8, 0, 92, '#2a4a6a', 0.8));
  void cone; void THREE;

  const path = [V(0, 0, 100), V(0, 0, 82), V(0, 0, 66), V(-10, 0, 30), V(-12, 0, 10), V(-12, 0, -2), V(-14, 0, -24), V(0, 0, -24), V(20, 0, -24), V(21, 0, 14), V(34, 0, 5), V(46, 0, 5), V(56, 0, -6)];
  return {
    path, half: 1.6, npcs: 7, startYaw: 0,
    extras: [
      { frac: 0.5, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Tứ Pháp là bốn vị thần Mây, Mưa, Sấm, Chớp của cư dân trồng lúa nước; bà Dâu là Pháp Vân, thần Mây.', q: 'Pháp Vân, bà chúa chùa Dâu, là thần gì?', options: ['Thần Mây', 'Thần Sấm', 'Thần Lúa'], answer: 0 },
      { frac: 0.2, kind: 'ngam_canh', name: 'Ngắm tháp cổ', fact: 'Tháp Hoà Phong ngày nay chỉ còn ba tầng; tường gạch phủ rêu, có cả cây nhỏ mọc trên đỉnh tháp.' },
    ],
    stops: [
      { id: 'cong_chua', at: V(0, 0, 84), look: V(0, 4, 75) },
      { id: 'thap_hoa_phong', at: V(-10, 0, 30), look: V(0, 8, TZ) },
      { id: 'dien_phap_van', at: V(0, 0, -24), look: V(0, 3, -32) },
      { id: 'hoi_chua', at: V(56, 0, -6), look: V(66, 3, -6) },
    ],
    sky: [0x86b6dc, 0xf6e6c4], fog: [0xe8e2cc, 140, 560],
    light: { ambient: 1.5, sun: 1.7, sunColor: 0xffe8c0, sunDir: [-0.3, 0.65, 0.6], ambientColor: 0xfff4e4 },
    shopSpots: [V(12, 0, 96), V(10, 0, 50), V(48, 0, 4)],
  };
}
