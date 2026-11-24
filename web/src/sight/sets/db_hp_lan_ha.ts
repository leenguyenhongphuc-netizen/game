// Cát Bà – vịnh Lan Hạ, Hải Phòng. Trục x: tây → đông; z: bắc → nam; biển ở phía nam.
// Phố biển thị trấn Cát Bà → bậc lên pháo đài Thần Công trên đồi → đường mòn rừng dưới vách đá có voọc Cát Bà
// → cầu phao ra làng chài nổi → bãi cát nhỏ ở vịnh Lan Hạ.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, grp, label, palm, person, rock, signPost, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { fishingBoat } from './_extra.ts';
import { karst } from './db__kit.ts';

const SHORE = 40, FY = 14; // bờ biển (z), cao độ thềm pháo đài
export function lanHa(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.add(box(0x1f6f72, 0, -4, 0, 1800, 1, 1800)); kit.water(0x2fa8a0, 0, 200, 1800, 1400, -0.5, 0.8);
  kit.add(box(0x6f8a4f, 0, -0.5, SHORE - 300, 600, 1, 600)); // đảo
  kit.add(box(0xc9c4b8, -40, 0.25, SHORE - 2, 120, 0.5, 6)); // kè phố biển
  // ---- thị trấn: dãy khách sạn nhiều màu, ô dù, cột đèn
  const COLS = [0xf9d2de, 0xbfe0e6, 0xf1e3b8, 0xd8e6d2, 0xfff3d6, 0xf3c9a8];
  for (let i = 0; i < 16; i++) { const x = -100 + i * 8.4, h = 10 + (i % 4) * 3, c = COLS[i % COLS.length]; kit.add(box(c, x, h / 2, 14, 7.6, h, 10)); for (let f = 1; f < h / 3; f++) kit.add(box(0x6a8aa0, x, f * 3 + 0.6, 19.06, 5, 1.4, 0.06), box(0xffffff, x, f * 3 - 0.2, 19.6, 6.4, 0.12, 1.1)); kit.add(box(0x3a6f8f, x, h + 0.3, 14, 7.8, 0.6, 10.2)); }
  for (let i = 0; i < 10; i++) { const x = -96 + i * 12; kit.add(grp(x, 0, 30, 0, cyl(0xd8d0c0, 0, 1.3, 0, 0.06, 2.6), cone([0xe2573c, 0x2a6fbf, 0xffd23f][i % 3], 0, 2.7, 0, 1.8, 0.7)), box(0x7a5a3c, x + 1.6, 0.4, 30, 1.2, 0.8, 0.8)); }
  // ---- đồi pháo đài Thần Công: thềm đá trên cao, hai khẩu pháo, hầm boong-ke
  kit.add(ball(0x4f7f45, -20, 0, -96, 44, FY + 8, 28), ball(0x5f8a4a, -56, 0, -64, 22, FY - 2, 26), box(0x8a8478, -20, FY / 2, -60, 26, FY, 22), box(0xb8ae98, -20, FY - 0.05, -60, 24, 0.1, 20));
  kit.add(stairs(0xb0a898, V(-20, 0, -30), V(-20, FY, -49), 3), stairs(0xb0a898, V(-9, FY, -60), V(16, 0, -60), 3));
  for (const s of [-1, 1]) { const g = grp(-20 + s * 6, FY, -66, s * 0.4, cyl(0x8a8478, 0, 0.5, 0, 2.2, 1), cyl(0x3a3a38, 0, 1.4, 1, 0.34, 4.4).rotateX(1.35), box(0x4a4a44, 0, 1.1, 0, 1.4, 0.6, 1.4)); kit.add(g); }
  kit.add(box(0x6f6a5e, -20, FY + 0.9, -70, 8, 1.8, 3), box(0x2a2a2a, -20, FY + 0.7, -68.46, 1.6, 1.2, 0.06));
  // ---- rừng nguyên sinh dưới vách đá vôi: đường mòn, voọc Cát Bà đầu vàng trên mỏm đá
  for (const [x, z, rr, h] of [[40, -70, 16, 46], [64, -40, 12, 40], [86, -76, 18, 52], [4, -110, 20, 50]] as const) kit.add(karst(x, z, rr, h, r, -1));
  for (let i = 0; i < 70; i++) { const x = 10 + r() * 110, z = -10 - r() * 120; if (Math.abs(z + 24) < 4 && x > 14 && x < 56) continue; const t = i % 4 ? tree(r, 1.3 + r() * 0.6, true) : palm(r, 7); t.position.set(x, 0, z); kit.add(t); }
  const langur = (x: number, y: number, z: number, ry: number) => grp(x, y, z, ry, ball(0x2a2622, 0, 0.6, 0, 0.36, 0.5, 0.3), ball(0xe8c25a, 0, 1.2, 0.05, 0.24, 0.26, 0.24), ball(0x2a2622, 0, 1.2, 0.18, 0.12), cyl(0x2a2622, 0, 0.2, -0.36, 0.04, 1.2).rotateX(0.5));
  for (const [x, y, z] of [[52, 7, -40], [56, 11, -42], [33, 9, -58], [70, 14, -36]] as const) kit.add(langur(x, y, z, r() * 6), rock(0x8e8e86, x, y - 0.6, z, 1.2, 0.6, 1.2));
  kit.add(signPost('Khu bảo tồn voọc Cát Bà', 34, 0, -20, '#3f6a3a', 0.8));
  // ---- cầu phao và làng chài nổi
  const PX = 44;
  for (let z = SHORE; z < 70; z += 3) kit.add(box(0x8a6a42, PX, 0.25, z + 1.5, 2.4, 0.3, 2.9), cyl(0x2f2f2f, PX - 1.1, -0.1, z + 1.5, 0.3, 0.4), cyl(0x2f2f2f, PX + 1.1, -0.1, z + 1.5, 0.3, 0.4));
  for (let i = 0; i < 10; i++) {
    const x = 20 + (i % 5) * 12, z = 76 + Math.floor(i / 5) * 14, c = [0x3f8fbf, 0x5aa86a, 0xe2a33c, 0xd2553a][i % 4];
    kit.add(box(0x7a5a3a, x, 0.25, z, 10, 0.3, 10), box(c, x - 1, 1.9, z - 1.5, 5.4, 3, 4.6), box(0x8a3a24, x - 1, 3.6, z - 1.5, 6, 0.4, 5.2), box(0x2f4f6a, x - 1, 1.2, z + 0.86, 1.2, 2, 0.06));
    for (let k = 0; k < 4; k++) kit.add(box(0x5a4a3a, x + 3 + (k % 2) * 1.2, 0.36, z + 2 + Math.floor(k / 2) * 1.6, 1.0, 0.1, 1.2));
  }
  for (let i = 0; i < 4; i++) kit.add(box(0x8a6a42, 32 + i * 12, 0.25, 76, 2.2, 0.3, 4), box(0x8a6a42, 32 + i * 12, 0.25, 90, 2.2, 0.3, 4)); // ván nối bè
  kit.add(box(0x8a6a42, PX, 0.25, 72, 2.4, 0.3, 4));
  for (let i = 0; i < 8; i++) { const b = fishingBoat([0x1f6fae, 0x2a8f8f, 0x8a3a24][i % 3], [0xd2301e, 0xffd23f][i % 2], 8 + r() * 3); b.position.set(-60 + r() * 50, -0.5, 60 + r() * 40); b.rotation.y = r() * 6; kit.add(b); }
  // ---- bãi cát nhỏ phía đông và các đảo đá vôi của vịnh Lan Hạ
  kit.add(box(0xf6ecd0, 110, -0.3, SHORE + 6, 44, 0.8, 22), box(0xf6ecd0, 110, 0, SHORE - 6, 44, 0.4, 12));
  for (let i = 0; i < 6; i++) kit.add(grp(96 + i * 6, 0.1, SHORE + 2, 0, cyl(0xd8d0c0, 0, 1.3, 0, 0.06, 2.6), cone([0xffd23f, 0xe2573c][i % 2], 0, 2.7, 0, 1.6, 0.6)));
  for (let i = 0; i < 46; i++) { const a = r() * 3.1, d = 120 + r() * 420, x = Math.cos(a) * d, z = SHORE + 40 + Math.sin(a) * d * 0.8; kit.add(karst(x, z, 5 + r() * 12, 14 + r() * 34, r, -3)); }
  for (let i = 0; i < 14; i++) { const p = person(i, i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0); p.position.set(i < 7 ? -90 + r() * 90 : 96 + r() * 26, i < 7 ? 0.5 : 0.1, i < 7 ? 26 + r() * 8 : SHORE - 2 + r() * 8); p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Thị trấn Cát Bà', -50, 22, 14, '#2a6f9a', 1.1), label('Pháo đài Thần Công', -20, FY + 8, -66, '#5a5a54', 1.0), label('Làng chài nổi', 44, 7, 82, '#2a8f8f', 1.0), label('Vịnh Lan Hạ', 110, 6, SHORE + 4, '#2a7f9a', 1.0));
  void bead;

  const path = [V(-70, 0.5, 34), V(-40, 0.5, 34), V(-20, 0, 26), V(-20, 0, -28), V(-20, FY, -50), V(-20, FY, -60), V(-10, FY, -60), V(16, 0, -60), V(24, 0, -24), V(50, 0, -24), V(PX, 0, 20), V(PX, 0.4, SHORE + 4), V(PX, 0.4, 70), V(PX, 0.4, 76), V(PX, 0.4, 70), V(PX, 0.4, SHORE + 2), V(70, 0, 34), V(104, 0.2, 36)];
  return {
    path, half: 1.4, npcs: 7, startYaw: Math.PI / 2,
    extras: [
      { frac: 0.45, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Voọc Cát Bà có bộ lông đen, đầu và vai màu vàng nhạt, chỉ sống trên quần đảo Cát Bà.', q: 'Loài linh trưởng quý hiếm chỉ có ở Cát Bà là loài nào?', options: ['Voọc Cát Bà', 'Vượn đen má trắng', 'Khỉ vàng'], answer: 0 },
      { frac: 0.92, kind: 'ngam_canh', name: 'Ngắm vịnh Lan Hạ', fact: 'Vịnh Lan Hạ nằm ở phía đông nam đảo Cát Bà, giáp vịnh Hạ Long, nổi tiếng với nước xanh ngọc và những bãi cát nhỏ dưới chân đảo đá.' },
    ],
    stops: [
      { id: 'thi_tran', at: V(-40, 0.5, 34), look: V(-50, 6, 14) },
      { id: 'phao_dai', at: V(-20, FY, -60), look: V(-20, FY + 1.4, -66) },
      { id: 'voc', at: V(48, 0, -24), look: V(54, 9, -40) },
      { id: 'lang_chai', at: V(PX, 0.4, 72), look: V(32, 2, 82) },
      { id: 'lan_ha', at: V(104, 0.2, 36), look: V(160, 10, 160) },
    ],
    sky: [0x6aaad8, 0xdcefee], fog: [0xd2e8ea, 160, 700],
    light: { ambient: 1.55, sun: 1.65, sunColor: 0xfff0d0, sunDir: [-0.3, 0.65, 0.6], ambientColor: 0xf0f6ff },
    shopSpots: [V(-56, 0.5, 30), V(54, 0, 30), V(96, 0.2, 34)],
  };
}
void THREE;
