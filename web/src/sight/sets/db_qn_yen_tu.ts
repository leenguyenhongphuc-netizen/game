// Yên Tử, Quảng Ninh. Trục x: tây → đông; z: bắc → nam; đường hành hương leo từ nam lên đỉnh phía bắc.
// Chùa Giải Oan bên suối (chân núi) → vườn tháp Huệ Quang → chùa Hoa Yên lưng chừng núi → ga cáp treo → chùa Đồng trên đỉnh.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, incenseUrn, label, person, rock, signPost, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { STONE, bamboo, hall, northRoof, pagoda } from './db__kit.ts';

const T = [[0, 0, 110], [0, 9, 74], [0, 20, 40], [0, 31, 6], [0, 42, -30]] as const; // bậc thềm: x, y, z
const BRONZE = 0xb08a3a, BRONZE_D = 0x8a6a2a;
export function yenTu(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.ground(0x5f8a4a, 900);
  // núi: các khối đồi lớn dồn về phía bắc, chừa hành lang bậc đá giữa
  for (const [x, z, rx, rz, h] of [[-46, 30, 40, 70, 34], [48, 26, 42, 72, 36], [-30, -40, 40, 40, 52], [34, -44, 40, 40, 54], [0, -86, 70, 40, 70], [-80, -10, 50, 80, 40], [86, -6, 50, 80, 42]] as const)
    kit.add(ball(0x3f6f42, x, 0, z, rx, h, rz), ball(0x4f7f48, x + 6, h * 0.3, z - 6, rx * 0.7, h * 0.8, rz * 0.7));
  // các thềm và bậc đá nối nhau
  for (let i = 0; i < T.length; i++) {
    const [x, y, z] = T[i]; if (y > 0) kit.add(box(0x8a7f6a, x, y / 2 - 0.1, z, 26, y, 22), box(STONE, x, y - 0.05, z, 24, 0.1, 20));
    if (i < T.length - 1) { const [x2, y2, z2] = T[i + 1]; kit.add(stairs(0xb8ae98, V(x, y, z - 10), V(x2, y2, z2 + 10), 3.2)); }
  }
  // suối và chùa Giải Oan
  kit.water(0x5fb8c8, -18, 118, 10, 60, -0.2, 0.85);
  kit.add(hall(10, 120, 9, 6, 3, -Math.PI / 2), grp(-18, 0, 110, 0, box(STONE, 0, 0.4, 0, 3, 0.6, 12)));
  for (let i = 0; i < 6; i++) kit.add(rock(0x8a8a80, -18 + (r() - 0.5) * 8, 0, 100 + i * 8, 1.4 + r(), 0.6, 1.2 + r()));
  // vườn tháp Huệ Quang: tháp đá nhiều tầng
  const [, y1, z1] = T[1];
  const hq = pagoda(4, 3.2, 2.2, 0xc8bca4, 0x8a7a64, 0.8); hq.position.set(-7, y1, z1 - 4); kit.add(hq);
  for (let i = 0; i < 8; i++) { const p = pagoda(2 + (i % 3), 1.4, 1.4, 0xbab0a0, 0x7a6a58, 0.78); p.position.set((i % 2 ? 1 : -1) * (5 + Math.floor(i / 2) * 1.6), y1, z1 + 4 - (i % 4) * 2); if (Math.abs(p.position.x) < 3) continue; kit.add(p); }
  // chùa Hoa Yên: tam bảo, nhà tổ, cây đại cổ thụ
  const [, y2, z2] = T[2];
  const hy = grp(0, y2, z2 - 8); hy.add(hall(0, 0, 14, 7, 3.4, 0, { lit: true }), hall(-9, 6, 5, 4, 2.6, Math.PI / 2)); kit.add(hy);
  const urn = incenseUrn(); urn.position.set(0, y2, z2 - 1); kit.add(urn);
  for (const s of [-1, 1]) { const t = grp(s * 10, y2, z2 + 4, 0, cyl(0x8a7a64, 0, 2.2, 0, 0.6, 4.4)); for (let k = 0; k < 6; k++) t.add(ball(0xfdf6e0, (r() - 0.5) * 4, 4.6 + r() * 1.4, (r() - 0.5) * 4, 0.9, 0.5, 0.9)); t.add(ball(0x4f7f48, 0, 5, 0, 2.6, 1.4, 2.6)); kit.add(t); } // cây đại hoa trắng
  // ga cáp treo phía đông chùa Hoa Yên, dây cáp lên gần đỉnh
  const [, y3, z3] = T[3];
  const ga = grp(16, y3, z3, 0, box(0xe8e4d8, 0, 2.2, 0, 8, 4.4, 8), box(0x2a6f9a, 0, 4.6, 0, 9, 0.5, 9), box(0x9fd0f0, 0, 2, 4.02, 6, 2.4, 0.06)); kit.add(ga);
  const A = V(16, y3 + 5, z3), B = V(40, y3 + 60, 300), C = V(16, 54, -60);
  for (const [p, q] of [[B, A], [A, C]] as const) { const d = q.clone().sub(p), m = cyl(0x2a2a2a, 0, 0, 0, 0.05, d.length()); m.position.copy(p.clone().add(q).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); kit.add(m); }
  for (const z of [140, 80]) kit.add(cyl(0xcfd6e0, 30 - (z - 80) * 0.04, (y3 + 30) / 2, z, 0.5, y3 + 34));
  const cabins: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) { const c = grp(0, 0, 0, 0, box([0xd8281e, 0xffd23f, 0x2a6fbf][i % 3], 0, -1.4, 0, 2, 1.8, 2), box(0x9fd0f0, 0, -1.2, 0, 2.06, 0.8, 1.6), cyl(0x3a3a3a, 0, -0.2, 0, 0.05, 0.6)); kit.live(c); cabins.push(c); }
  kit.onTick((t) => cabins.forEach((c, i) => { const u = ((t * 0.012 + i / 6) % 1); const seg = u < 0.5 ? [B, A, u * 2] as const : [A, C, (u - 0.5) * 2] as const; c.position.copy(seg[0]).lerp(seg[1], seg[2]); }));
  // chùa Đồng trên đỉnh, mây trôi quanh
  const [, y4, z4] = T[4];
  kit.add(rock(0x7a7a70, -8, y4, z4 - 4, 5, 3, 4, 1), rock(0x6f6f66, 9, y4, z4 - 6, 4, 2.4, 4, 2));
  const dong = grp(0, y4, z4 - 4); dong.add(box(0x9a958a, 0, 0.5, 0, 8, 1, 7), box(BRONZE, 0, 2.2, 0, 4.6, 2.6, 3.6), box(BRONZE_D, 0, 2, 1.82, 1.6, 2.2, 0.06), northRoof(0, 3.5, 0, 5.6, 4.6, 1.4, BRONZE)); kit.add(dong);
  kit.add(bead(glow(0xffcf6a), 0, y4 + 2.2, z4 - 2.1, 0.3));
  // rừng tùng, tre trúc dọc đường
  for (let i = 0; i < 90; i++) {
    const z = 130 - r() * 190, side = i % 2 ? 1 : -1, x = side * (8 + r() * 40); let y = 0;
    for (const [, ty, tz] of T) if (Math.abs(z - tz) < 11 && Math.abs(x) < 13) y = ty;
    const t = i % 5 === 0 ? bamboo(r, 0.8) : i % 3 === 0 ? grp(0, 0, 0, 0, cyl(0x6a5038, 0, 3, 0, 0.3, 6), cone(0x2f5f3a, 0, 6.5, 0, 2.2, 5), cone(0x3f6f42, 0, 8.8, 0, 1.6, 4)) : tree(r, 1.2 + r() * 0.6, true);
    t.position.set(x, y, z); kit.add(t);
  }
  // người hành hương, áo nâu, nón lá
  for (let i = 0; i < 12; i++) { const k = i % T.length, [, ty, tz] = T[k]; const p = person(i, i % 2 ? 1 : 0, i % 3 ? undefined : 0x8a5a32); p.position.set((r() - 0.5) * 16, ty, tz + (r() - 0.5) * 12); if (Math.abs(p.position.x) < 2.2) p.position.x += 4; p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Chùa Giải Oan', 10, 9, 120, '#9a3f2a', 0.9), label('Vườn tháp Huệ Quang', -7, y1 + 14, z1 - 4, '#6a5a48', 0.9), label('Chùa Hoa Yên', 0, y2 + 9, z2 - 8, '#9a3f2a', 1.0), label('Cáp treo Yên Tử', 16, y3 + 8, z3, '#2a6f9a', 0.9), label('Chùa Đồng · 1.068 m', 0, y4 + 7, z4 - 4, '#8a6a2a', 1.0));
  kit.add(signPost('Đỉnh Yên Tử ↑', 3, 0, 102, '#5a3a22', 0.8));
  void bead;

  const path: THREE.Vector3[] = [V(0, 0, 128), V(0, 0, 120)];
  for (let i = 0; i < T.length; i++) { const [x, y, z] = T[i]; if (i) path.push(V(x, y, z + 9)); path.push(V(x, y, z - 9)); }
  return {
    path, half: 1.5, npcs: 6, startYaw: 0,
    extras: [
      { frac: 0.3, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Năm 1299 vua Trần Nhân Tông nhường ngôi, lên Yên Tử tu hành và lập Thiền phái Trúc Lâm, dòng thiền mang bản sắc Việt.', q: 'Ai lập nên Thiền phái Trúc Lâm Yên Tử?', options: ['Lý Thái Tổ', 'Trần Nhân Tông', 'Lê Thánh Tông'], answer: 1 },
      { frac: 0.95, kind: 'ngam_canh', name: 'Ngắm biển mây', fact: 'Đỉnh Yên Tử cao khoảng 1.068 m, sáng sớm thường chìm trong mây; trời trong có thể nhìn thấy cả vịnh Hạ Long xa xa.' },
    ],
    stops: [
      { id: 'chua_giai_oan', at: V(0, 0, 120), look: V(10, 3, 120) },
      { id: 'thap_to', at: V(0, y1, z1 + 2), look: V(-7, y1 + 6, z1 - 4) },
      { id: 'chua_hoa_yen', at: V(0, y2, z2 + 2), look: V(0, y2 + 3, z2 - 8) },
      { id: 'cap_treo', at: V(4, y3, z3), look: V(16, y3 + 3, z3) },
      { id: 'chua_dong', at: V(0, y4, z4 + 4), look: V(0, y4 + 2.4, z4 - 4) },
    ],
    sky: [0x7fb0d8, 0xe6eef2], fog: [0xdfe8ec, 90, 480],
    light: { ambient: 1.55, sun: 1.5, sunColor: 0xfff2d8, sunDir: [0.3, 0.7, 0.5], ambientColor: 0xf2f6ff },
    shopSpots: [V(8, 0, 128), V(-8, y2, z2 + 6), V(-6, y4, z4 + 6)],
  };
}
