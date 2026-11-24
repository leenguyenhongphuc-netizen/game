// Phố Hiến, Hưng Yên. Trục x: tây → đông; z: bắc → nam. Phố cổ bên hồ Bán Nguyệt gần đê sông Hồng.
// Văn Miếu Xích Đằng → phố cổ → chùa Chuông (tam quan, giếng, hành lang La Hán) → đền Mẫu bên hồ Bán Nguyệt → vườn nhãn.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, glow, grp, incenseUrn, label, lantern, person, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { banyan, hall, landWithLakes, lotus, northRoof, tamQuan, turtleStele } from './db__kit.ts';

export function phoHien(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  const HO = { x: 60, z: 20, rx: 30, rz: 18 }, GIENG = { x: -4, z: -52, rx: 3, rz: 3 };
  landWithLakes(kit, -220, -200, 220, 220, [HO, GIENG], 0x8aa866, { kerb: 0x9a8f7a, water: 0x4f8f7a });
  lotus(kit, HO, 30, r);
  // đê sông Hồng phía tây, sông xa
  kit.add(box(0x7a9a5a, -160, 2, 0, 20, 4, 420)); kit.water(0x9a7a5a, -260, 0, 160, 420, -0.6, 0.9);
  // Văn Miếu Xích Đằng: cổng, sân bia, đại bái
  kit.add(box(0xc9b89a, -60, 0.03, 70, 24, 0.06, 60), tamQuan(-60, 96, 0, 6), hall(-60, 52, 16, 8, 3.6, 0, { twoTier: true, lit: true }));
  for (let i = 0; i < 6; i++) { const b = turtleStele(); b.position.set(-60 + (i % 2 ? 6 : -6), 0, 84 - Math.floor(i / 2) * 7); b.rotation.y = (i % 2 ? -1 : 1) * Math.PI / 2; kit.add(b); }
  // phố cổ: nhà ống mái ngói, đèn lồng, biển hiệu
  const COLS = [0xf3d27a, 0xf1e3b8, 0xe8c9a8, 0xd8e6d2];
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) { const z = 70 - i * 8, x = -22 + s * 9, c = COLS[(i + (s > 0 ? 1 : 0)) % 4], h = 5 + (i % 3); kit.add(box(c, x, h / 2, z, 8, h, 7.4), northRoof(x, h, z, 8, 7.4, 1.4, 0x9a4a2a, Math.PI / 2), box(0x6a4a2a, x - s * 4.02, 1.4, z, 0.06, 2.6, 3)); kit.add(lantern([0xff5a4a, 0xffb347][i % 2], x - s * 4.6, 3, z, 0.6)); }
  kit.add(box(0x9a9488, -22, 0.02, 34, 8, 0.04, 88));
  // chùa Chuông: tam quan, giếng, hành lang La Hán, tam bảo
  kit.add(tamQuan(-4, -26, 0, 6), box(0xc9b89a, -4, 0.03, -58, 30, 0.06, 56));
  kit.add(hall(-4, -76, 16, 8, 3.6, 0, { lit: true }), cyl(0x9a8f7a, GIENG.x, 0.3, GIENG.z, 3.6, 0.6));
  for (const s of [-1, 1]) { kit.add(box(0xb4ad9f, -4 + s * 13, 0.2, -54, 4, 0.4, 30), northRoof(-4 + s * 13, 3.2, -54, 4.4, 30, 1, 0x8a3a24)); for (let k = 0; k < 9; k++) kit.add(cyl(0xa8322a, -4 + s * 11.2, 1.7, -68 + k * 3.5, 0.14, 2.8), grp(-4 + s * 14, 0.4, -67 + k * 3.4, -s * Math.PI / 2, cyl(0x8a6a4a, 0, 0.7, 0, 0.3, 1, 0.24), ball(0xd8b080, 0, 1.4, 0, 0.24))); }
  const urn = incenseUrn(); urn.position.set(-4, 0, -64); kit.add(urn);
  // đền Mẫu bên hồ Bán Nguyệt, cây si buông rễ xuống nước
  kit.add(hall(62, -10, 10, 6, 3, 0, { lit: true }), banyan(r, 1).translateX(42).translateZ(4), banyan(r, 0.8).translateX(80).translateZ(2));
  for (let i = 0; i < 8; i++) kit.add(bead(glow(0xff5a3a), 58 + i * 1.2, 3.6, -6.6, 0.22, 0.3, 0.22));
  // vườn nhãn lồng: cây tán tròn trĩu quả
  for (let i = 0; i < 24; i++) { const x = 100 + (i % 6) * 9, z = -40 + Math.floor(i / 6) * 9; kit.add(grp(x, 0, z, r() * 6, cyl(0x6a5038, 0, 1.2, 0, 0.3, 2.4), ball(0x4f7f3a, 0, 3.4, 0, 3, 1.8, 3))); for (let k = 0; k < 5; k++) kit.add(bead(0xc9a868, x + (r() - 0.5) * 4, 2.2 + r(), z + (r() - 0.5) * 4, 0.24, 0.3, 0.24)); }
  for (let i = 0; i < 20; i++) { const t = tree(r, 1.1 + r() * 0.4); t.position.set(-120 + r() * 60, 0, -150 + r() * 300); kit.add(t); }
  for (let i = 0; i < 14; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.set(-22 + (r() - 0.5) * 6, 0, 70 - r() * 100); p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Văn Miếu Xích Đằng', -60, 12, 52, '#9a3f2a', 1.0), label('Chùa Chuông', -4, 11, -76, '#9a3f2a', 1.0), label('Đền Mẫu · hồ Bán Nguyệt', 62, 9, -10, '#2a6f7a', 0.9), label('Vườn nhãn lồng', 122, 7, -26, '#4f7f3a', 0.9));
  kit.add(signPost('Phố Hiến', -16, 0, 82, '#2a4a6a', 0.8));
  void THREE;

  const path = [V(-60, 0, 104), V(-60, 0, 90), V(-60, 0, 62), V(-40, 0, 76), V(-22, 0, 76), V(-22, 0, -8), V(-4, 0, -16), V(-4, 0, -30), V(-9, 0, -44), V(-9, 0, -64), V(8, 0, -66), V(30, 0, -20), V(56, 0, -1), V(74, 0, -2), V(90, 0, -14), V(104, 0, -26)];
  return {
    path, half: 1.6, npcs: 7, startYaw: 0,
    extras: [
      { frac: 0.3, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Câu "Thứ nhất kinh kỳ, thứ nhì Phố Hiến" nói Phố Hiến là đô thị sầm uất chỉ sau Thăng Long vào thế kỷ 16–17.', q: '"Thứ nhất kinh kỳ, thứ nhì..."?', options: ['Phố Hiến', 'Hội An', 'Phố Hiến và Hội An'], answer: 0 },
      { frac: 0.75, kind: 'ngam_canh', name: 'Ngắm hồ Bán Nguyệt', fact: 'Hồ hình nửa vầng trăng trước đền Mẫu, mùa hè sen nở kín mặt hồ.' },
    ],
    stops: [
      { id: 'van_mieu_xich_dang', at: V(-60, 0, 62), look: V(-60, 3, 52) },
      { id: 'chua_chuong', at: V(-4, 0, -18), look: V(-4, 4, -26) },
      { id: 'den_mau', at: V(60, 0, -1.5), look: V(62, 2.4, -10) },
      { id: 'vuon_nhan', at: V(104, 0, -26), look: V(112, 2.6, -32) },
    ],
    sky: [0x86b6dc, 0xf6e6c4], fog: [0xe8e2cc, 140, 560],
    light: { ambient: 1.5, sun: 1.7, sunColor: 0xffe8c0, sunDir: [0.3, 0.65, 0.6], ambientColor: 0xfff4e4 },
    shopSpots: [V(-14, 0, 40), V(-14, 0, 10), V(40, 0, -16)],
  };
}
