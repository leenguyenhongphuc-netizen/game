// Chùa Bái Đính, Ninh Bình. Trục x: tây → đông; z: bắc → nam; chùa dựng trên sườn núi, càng vào trong càng cao.
// Tam quan (nam) → giữa hai dãy hành lang La Hán → gác chuông → điện Pháp Chủ trên thềm cao → bảo tháp 13 tầng phía tây.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, glow, grp, incenseUrn, label, mountain, person, signPost, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { RED, STONE, TILE, hall, karst, landWithLakes, lotus, northRoof, pagoda, tamQuan } from './db__kit.ts';

const T = [[0, 0, 150], [0, 3, 30], [0, 8, -20], [0, 15, -60]] as const;
export function baiDinh(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  const LAKE = { x: -80, z: 170, rx: 50, rz: 22 };
  landWithLakes(kit, -260, -200, 260, 260, [LAKE], 0x7a9a5a, { kerb: 0x9a958a, water: 0x4f8f8a });
  lotus(kit, LAKE, 40, r);
  for (let i = 1; i < T.length; i++) { const [, y, z] = T[i], [, , zp] = T[i - 1]; const len = i === 1 ? 70 : 36; kit.add(box(0x9a9384, 0, y / 2 - 0.05, z - len / 2 + 14, 90, y, len), box(0xc9c0aa, 0, y - 0.03, z - len / 2 + 14, 88, 0.06, len)); kit.add(stairs(0xb8ae98, V(0, T[i - 1][1], Math.min(zp, z + 14 + 6) + 0.1), V(0, y, z + 14 - 0.4), 8)); }
  kit.add(box(0xc9c0aa, 0, 0.03, 120, 14, 0.06, 80)); // sân lát trước
  // núi sau chùa
  for (const [x, z, rr, h] of [[-70, -150, 50, 70], [40, -170, 60, 80], [140, -100, 40, 60], [-160, -90, 40, 56]] as const) kit.add(mountain(0x4f7f48, x, z, rr, h, r));
  for (let i = 0; i < 16; i++) kit.add(karst(-240 + r() * 480, -200 + r() * 60, 10 + r() * 10, 30 + r() * 30, r));
  // tam quan lớn
  kit.add(tamQuan(0, 112, 0, 6, 0xd8cfb8)); kit.add(grp(0, 0, 112, 0, northRoof(0, 8.4, 0, 12, 4, 2)));
  // hành lang La Hán: hai dãy nhà cột dài ở sân trước, tượng đá xanh xếp hàng
  for (const s of [-1, 1]) {
    const x = s * 24;
    kit.add(box(STONE, x, 0.2, 78, 8, 0.4, 56), northRoof(x, 3.8, 78, 8, 56, 1.6, TILE), box(0x8a6a42, x + s * 3.6, 2.1, 78, 0.4, 3.4, 56));
    for (let k = 0; k <= 12; k++) kit.add(cyl(RED, x - s * 3.6, 2.1, 51 + k * 4.5, 0.22, 3.4), cyl(RED, x + s * 2.4, 2.1, 51 + k * 4.5, 0.22, 3.4));
    for (let k = 0; k < 22; k++) { const z = 52 + k * 2.5, g = grp(x + s * 1.6, 0.4, z, -s * Math.PI / 2, box(0x6f7a72, 0, 0.3, 0, 0.8, 0.6, 0.8), cyl(0x7f8a80, 0, 1.0, 0, 0.32, 1.0, 0.26), ball(0x7f8a80, 0, 1.68, 0, 0.24)); kit.add(g); }
  }
  // gác chuông giữa sân
  const [, y1, z1] = T[1];
  const gc = grp(0, y1, z1 - 10); gc.add(box(STONE, 0, 0.5, 0, 14, 1, 14)); for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]] as const) gc.add(cyl(RED, x, 4, z, 0.36, 7));
  gc.add(northRoof(0, 7.4, 0, 11, 11, 1.4), box(0x8a3a24, 0, 9.4, 0, 7, 1.8, 7), northRoof(0, 10.3, 0, 9, 9, 2)); gc.add(cyl(0x6a5a2a, 0, 5.2, 0, 1.6, 3, 1.6), ball(0x6a5a2a, 0, 6.7, 0, 1.6, 0.7, 1.6)); kit.add(gc);
  // điện Pháp Chủ trên thềm cao, tượng Phật đồng
  const [, y3, z3] = T[3];
  const pc = grp(0, y3, z3 - 12); pc.add(hall(0, 0, 34, 16, 6, 0, { twoTier: true, lit: true }), cyl(0xb08a3a, 0, 4.6, -1, 2.2, 7.4), ball(0xb08a3a, 0, 9, -1, 1.6)); kit.add(pc);
  const urn = incenseUrn(); urn.position.set(6, y3, z3 + 6); urn.scale.setScalar(1.6); kit.add(urn);
  const [, y2, z2] = T[2]; kit.add(hall(0, z2 - 6, 26, 10, 4.4, 0, { lit: true }).translateY(y2));
  for (let i = 0; i < 14; i++) kit.add(bead(glow(0xff5a3a), -13 + i * 2, y3 + 7.2, z3 - 3.6, 0.3, 0.38, 0.3));
  // bảo tháp 13 tầng phía tây
  const bt = pagoda(13, 9, 3.6, 0xe8dcc0, TILE, 0.92); bt.position.set(-74, 0, 120); kit.add(bt);
  kit.add(box(0xc9c0aa, -40, 0.03, 120, 60, 0.06, 6));
  // cây, khách hành hương
  for (let i = 0; i < 40; i++) { const t = tree(r, 1.2 + r() * 0.5, i % 2 === 0), s = i % 2 ? 1 : -1; t.position.set(s * (36 + r() * 30), 0, 140 - r() * 200); if (t.position.z < 40) t.position.y = t.position.z < -20 ? (t.position.z < -60 ? 15 : 8) : 3; kit.add(t); }
  for (let i = 0; i < 18; i++) { const z = 130 - r() * 210; let y = 0; for (const [, ty, tz] of T) if (z < tz + 14) y = ty; const p = person(i, i % 2 ? 1 : 0, i % 4 ? undefined : 0x8a5a32); p.position.set((r() - 0.5) * 30, y, z); if (Math.abs(p.position.x) > 18 && Math.abs(p.position.x) < 30) p.position.x *= 0.5; p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Tam quan chùa Bái Đính', 0, 13, 112, '#9a3f2a', 1.0), label('Hành lang La Hán', 24, 9, 78, '#5a5a54', 0.9), label('Gác chuông', 0, y1 + 15, z1 - 10, '#8a3a24', 0.9), label('Điện Pháp Chủ', 0, y3 + 16, z3 - 12, '#9a3f2a', 1.0), label('Bảo tháp', -74, 62, 120, '#6a5a48', 1.4));
  kit.add(signPost('Bảo tháp ←', -10, 0, 124, '#5a3a22', 0.8));
  void THREE;

  const p2 = [V(0, 0, 150), V(0, 0, 124), V(-58, 0, 120), V(0, 0, 124), V(0, 0, 104), V(-14, 0, 80), V(-14, 0, 60), V(0, 0, 52), V(0, y1, 42), V(-10, y1, 32), V(-10, y1, 6), V(0, y1, 3), V(0, y2, -8), V(-16, y2, -12), V(-16, y2, -36), V(0, y2, -39), V(0, y3, -48), V(0, y3, -52)];
  return {
    path: p2, half: 1.6, npcs: 7, startYaw: 0,
    extras: [
      { frac: 0.4, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Hai dãy hành lang của chùa Bái Đính đặt 500 tượng La Hán bằng đá xanh.', q: 'Hành lang chùa Bái Đính có bao nhiêu tượng La Hán?', options: ['100', '500', '1.000'], answer: 1 },
      { frac: 0.95, kind: 'ngam_canh', name: 'Ngắm từ thềm điện Pháp Chủ', fact: 'Từ thềm cao nhìn xuống là hai dãy hành lang, gác chuông và cánh đồng, núi đá vôi Gia Viễn trải xa.' },
    ],
    stops: [
      { id: 'tam_quan', at: V(0, 0, 124), look: V(0, 6, 112) },
      { id: 'hanh_lang_la_han', at: V(-14, 0, 70), look: V(-22.4, 1.6, 70) },
      { id: 'gac_chuong', at: V(-10, y1, 14), look: V(0, y1 + 6, z1 - 10) },
      { id: 'dien_phap_chu', at: V(0, y3, -52), look: V(0, y3 + 4, z3 - 12) },
      { id: 'bao_thap', at: V(-58, 0, 120), look: V(-74, 20, 120) },
    ],
    sky: [0x7fb0d8, 0xf0e4c8], fog: [0xe6e0cc, 140, 560],
    light: { ambient: 1.5, sun: 1.7, sunColor: 0xffe8c0, sunDir: [0.3, 0.65, 0.6], ambientColor: 0xfff4e4 },
    shopSpots: [V(10, 0, 140), V(10, y1, 10), V(-30, 0, 116)],
  };
}
