// Văn Miếu – Quốc Tử Giám, Hà Nội. Trục x: tây → đông; z: bắc → nam. Năm lớp sân nối nhau theo trục nam – bắc:
// Văn Miếu Môn (nam) → Đại Trung Môn → Khuê Văn Các → giếng Thiên Quang giữa hai dãy bia tiến sĩ → Đại Thành Môn → điện Đại Thành (bắc).
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, glow, grp, incenseUrn, label, lampPost, person, potPlant, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { BRICK, PLASTER, RED, STONE, TILE, banyan, hall, landWithLakes, lotus, northRoof, tamQuan, turtleStele } from './db__kit.ts';

const W = 34; // nửa bề ngang khu
export function vanMieu(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  const WELL = { x: 0, z: -2, rx: 8, rz: 8 }, HO = { x: -60, z: 120, rx: 26, rz: 12 }; // giếng Thiên Quang; hồ Văn trước cổng
  landWithLakes(kit, -150, -180, 150, 200, [WELL, HO], 0x8fb070, { kerb: 0x9a8f7a, water: 0x3f8a7a });
  // đường lát gạch trục giữa và sân cỏ
  kit.add(box(0xc9b89a, 0, 0.02, 20, 6, 0.05, 230));
  for (const z of [80, 40, -40, -88]) kit.add(box(0xa8c58a, -18, 0.015, z + 15, 22, 0.03, 26), box(0xa8c58a, 18, 0.015, z + 15, 22, 0.03, 26));
  // tường bao gạch vồ có mái ngói, chia năm lớp sân; cổng ở giữa trục
  const wall = (z: number, gate: number) => {
    for (const s of [-1, 1]) { const len = W - gate / 2; kit.add(box(BRICK, s * (gate / 2 + len / 2), 1.5, z, len, 3, 0.8), box(TILE, s * (gate / 2 + len / 2), 3.1, z, len + 0.2, 0.3, 1.3)); }
  };
  for (const s of [-1, 1]) kit.add(box(BRICK, s * W, 1.5, 15, 0.8, 3, 230), box(TILE, s * W, 3.1, 15, 1.3, 0.3, 230));
  kit.add(box(BRICK, 0, 1.5, -100, W * 2, 3, 0.8));
  // 1. Văn Miếu Môn: cổng hai tầng mái
  const gate1 = grp(0, 0, 130); for (const s of [-1, 1]) gate1.add(box(PLASTER, s * 3.4, 3, 0, 2.2, 6, 2.4), box(PLASTER, s * 7, 2, 0, 3, 4, 2)); gate1.add(box(PLASTER, 0, 6.4, 0, 9, 1.6, 2.4), box(0x9a3a24, 0, 6.4, 1.22, 5, 0.9, 0.04), northRoof(0, 7.2, 0, 10, 3.2, 1.3), box(PLASTER, 0, 8.9, 0, 6, 1.2, 2), northRoof(0, 9.5, 0, 7.4, 2.6, 1.2)); kit.add(gate1);
  for (const s of [-1, 1]) kit.add(box(BRICK, s * (W / 2 + 6), 1.5, 130, W - 12, 3, 0.8), box(TILE, s * (W / 2 + 6), 3.1, 130, W - 11, 0.3, 1.3));
  kit.add(grp(0, 0, 150, 0, box(STONE, -5, 2.2, 0, 1, 4.4, 1), box(STONE, 5, 2.2, 0, 1, 4.4, 1), bead(STONE, -5, 4.7, 0, 0.6), bead(STONE, 5, 4.7, 0, 0.6))); // nghi môn trụ biểu
  // 2. Đại Trung Môn
  wall(84, 10); kit.add(tamQuan(0, 84, 0, 6));
  // 3. Khuê Văn Các: gác hai tầng, bốn trụ gạch, tầng trên gỗ có cửa sổ tròn
  wall(36, 10);
  const kv = grp(0, 0, 36);
  for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]] as const) kv.add(box(0xe8dcc0, x, 2.5, z, 1.6, 5, 1.6));
  kv.add(box(0xd8cfb8, 0, 5.2, 0, 8.4, 0.4, 8.4), northRoof(0, 5.3, 0, 9.6, 9.6, 0.9, TILE), box(0x8a2a20, 0, 7, 0, 5, 2.8, 5));
  for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) { const o = cyl(0xf3e2ae, sx * 2.52, 7, sz * 2.52, 0.95, 0.06, 0.95); o.rotation.set(sz ? Math.PI / 2 : 0, 0, sx ? Math.PI / 2 : 0); kv.add(o); for (let k = 0; k < 6; k++) kv.add(box(0x8a2a20, sx * 2.56 + (sz ? (k - 2.5) * 0.3 : 0), 7, sz * 2.56 + (sx ? (k - 2.5) * 0.3 : 0), sx ? 0.04 : 0.06, 1.8, sz ? 0.04 : 0.06)); }
  kv.add(northRoof(0, 8.4, 0, 6.6, 6.6, 1.6, TILE)); kit.add(kv);
  for (const s of [-1, 1]) kit.add(grp(s * 9, 0, 36, 0, box(PLASTER, 0, 1.6, 0, 3, 3.2, 1.2), northRoof(0, 3.2, 0, 3.8, 1.8, 0.6)));
  // 4. sân Thiên Quang: giếng vuông kè đá, hai dãy nhà bia, 82 bia trên lưng rùa
  kit.add(box(0xc9c0aa, 0, 0.04, -2, 22, 0.06, 22));
  for (let i = 0; i < 4; i++) kit.add(box(0x9a8f7a, [0, 0, -8.6, 8.6][i], 0.3, -2 + [-8.6, 8.6, 0, 0][i], i < 2 ? 17.8 : 0.6, 0.6, i < 2 ? 0.6 : 17.8));
  for (const s of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const x = s * (16 + row * 6);
      kit.add(box(STONE, x, 0.12, -2, 4.6, 0.24, 46), northRoof(x, 3.6, -2, 5, 46, 1.2, TILE));
      for (let k = 0; k <= 8; k++) kit.add(cyl(RED, x - 2.1, 1.8, -24 + k * 5.5, 0.14, 3.6), cyl(RED, x + 2.1, 1.8, -24 + k * 5.5, 0.14, 3.6));
      for (let k = 0; k < 10; k++) { const b = turtleStele(0x8a857a); b.position.set(x, 0.24, -21.5 + k * 4.6); b.rotation.y = -s * Math.PI / 2; kit.add(b); }
    }
  }
  lotus(kit, WELL, 10, r);
  // 5. Đại Thành Môn và sân Đại Bái, điện Đại Thành
  wall(-40, 10); kit.add(tamQuan(0, -40, 0, 6));
  kit.add(box(0xd0c4a6, 0, 0.05, -66, 40, 0.1, 40));
  kit.add(hall(0, -74, 30, 10, 4, 0, { twoTier: false, lit: true }), hall(0, -90, 28, 9, 4.4, 0, { twoTier: true, lit: true }));
  for (const s of [-1, 1]) kit.add(hall(s * 24, -62, 6, 16, 3, s * Math.PI / 2)); // tả vu, hữu vu
  const urn = incenseUrn(); urn.position.set(0, 0, -62); kit.add(urn);
  for (let i = 0; i < 2; i++) { const c = grp((i ? 1 : -1) * 6, 0, -62, 0, box(STONE, 0, 0.4, 0, 1.6, 0.8, 1.6), ball(0x6a5a3a, 0, 1.4, 0, 0.6, 0.7, 0.9), cyl(0x6a5a3a, 0, 2.2, -0.3, 0.12, 1.2)); kit.add(c); } // hạc đứng trên lưng rùa
  for (let i = 0; i < 12; i++) kit.add(bead(glow(0xff5a3a), -8 + i * 1.45, 4.3, -68.7, 0.24, 0.3, 0.24));
  // cây đa, cây muỗm, cây bàng cổ thụ trong các sân
  for (const [x, z] of [[-22, 110], [22, 104], [-24, 66], [22, 58], [-12, 14], [14, 20], [-24, -110], [24, -120]] as const) { const t = banyan(r, 0.55 + r() * 0.2); t.position.set(x, 0, z); kit.add(t); }
  for (let i = 0; i < 18; i++) { const t = tree(r, 1 + r() * 0.5, i % 2 === 0); const s = i % 2 ? 1 : -1; t.position.set(s * (26 + r() * 4), 0, 120 - i * 13); kit.add(t); }
  for (let i = 0; i < 10; i++) { const p = potPlant([0xe85aa0, 0xffd23f, 0xe2573c][i % 3], 1.2); p.position.set((i % 2 ? 1 : -1) * 8, 0, 120 - i * 10); kit.add(p); }
  // hồ Văn trước cổng, phố Quốc Tử Giám
  kit.add(grp(HO.x, 0, HO.z, 0, box(STONE, 0, -0.1, 0, 8, 0.6, 5.6), hall(0, 0, 5, 4, 2.4, 0)));
  for (let i = 0; i < 12; i++) { const c = [0xf3d27a, 0xf1e3b8, 0xd8e6d2, 0xf9d2c4][i % 4], h = 7 + (i % 3) * 2; kit.add(box(c, -100 + i * 18, h / 2, 176, 16, h, 10), box(0x8a4a2a, -100 + i * 18, h + 0.3, 176, 16.4, 0.6, 10.4)); }
  for (let i = 0; i < 8; i++) kit.add(lampPost((i % 2 ? 1 : -1) * 4, 0, 150 - i * 30, 3.6));
  // học trò mặc áo dài, du khách
  for (let i = 0; i < 18; i++) { const p = person(i, i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 0, i % 4 === 0 ? 0x2a4aa0 : undefined); p.position.set((r() - 0.5) * 40, 0, 140 - r() * 230); if (Math.abs(p.position.x) > W - 3 && p.position.z < 128) continue; p.rotation.y = r() * 6; kit.add(p); }
  kit.live(label('Văn Miếu Môn', 0, 13, 130, '#9a3f2a', 1.0), label('Khuê Văn Các', 0, 12.6, 36, '#8a2a20', 1.0), label('Giếng Thiên Quang', 0, 4.6, -2, '#2a6f7a', 0.9), label('Điện Đại Thành', 0, 12, -82, '#9a3f2a', 1.0));
  kit.add(signPost('Phố Quốc Tử Giám', 14, 0, 160, '#2a4a6a', 0.8));
  void cyl; void RED;

  const path = [V(0, 0, 162), V(0, 0, 140), V(0, 0, 126), V(0, 0, 100), V(0, 0, 84), V(0, 0, 60), V(0, 0, 44), V(0, 0, 36), V(0, 0, 26), V(-11, 0, 12), V(-11, 0, -16), V(0, 0, -26), V(0, 0, -40), V(0, 0, -56), V(0, 0, -64)];
  return {
    path, half: 3, npcs: 4, startYaw: 0,
    extras: [
      { frac: 0.55, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Bia tiến sĩ đặt trên lưng rùa đá, rùa tượng trưng cho sự trường tồn. 82 tấm bia ghi tên các tiến sĩ khoa thi 1442 đến 1779.', q: 'Bia tiến sĩ ở Văn Miếu đặt trên lưng con vật nào?', options: ['Rồng', 'Rùa', 'Hạc'], answer: 1 },
      { frac: 0.4, kind: 'ngam_canh', name: 'Ngắm Khuê Văn Các', fact: 'Khuê Văn Các nhỏ nhưng cân đối, bốn mặt cửa tròn như những tia sao Khuê toả sáng, nơi các nho sĩ xưa bình văn.' },
    ],
    stops: [
      { id: 'van_mieu_mon', at: V(0, 0, 140), look: V(0, 6, 130) },
      { id: 'khue_van_cac', at: V(0, 0, 46), look: V(0, 7, 36) },
      { id: 'bia_tien_si', at: V(-11, 0, -4), look: V(-19, 1.6, -4), cam: V(-4, 3.2, 4) },
      { id: 'dai_thanh', at: V(0, 0, -64), look: V(0, 4, -76) },
    ],
    sky: [0x7aaed8, 0xf3dcb4], fog: [0xe6dcc6, 120, 460],
    light: { ambient: 1.45, sun: 1.75, sunColor: 0xffe0b0, sunDir: [0.4, 0.6, 0.5], ambientColor: 0xfff2e0 },
    shopSpots: [V(10, 0, 156), V(-10, 0, 100), V(12, 0, -50)],
  };
}
