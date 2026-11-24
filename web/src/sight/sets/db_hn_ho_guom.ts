// Hồ Gươm (Hồ Hoàn Kiếm), Hà Nội. Trục x: tây → đông; z: bắc → nam. Hồ dài theo bắc – nam.
// Phố Đinh Tiên Hoàng bờ đông → cổng đền và Tháp Bút trên gò Độc Tôn → cầu Thê Húc sang đảo Ngọc → đền Ngọc Sơn
// → quay ra bờ đông, đi xuống phía nam ngắm Tháp Rùa giữa hồ → phố đi bộ đầu nam hồ.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, glow, grp, label, lampPost, person, signPost, tree, bench } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { PLASTER, RED, STONE, archBridge, banyan, hall, landWithLakes, lotus, northRoof, pagoda, wet } from './db__kit.ts';
import type { Lake } from './db__kit.ts';

const LAKE: Lake = { x: 0, z: 0, rx: 40, rz: 112 };
export function hoGuom(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  landWithLakes(kit, -170, -230, 190, 230, [LAKE], 0x9ab87a, { kerb: 0x8f8a80, water: 0x4f8f6a });
  // vành đá lát ven hồ và đường nhựa quanh
  for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, b = ((i + 1) / 64) * Math.PI * 2, k = 1.11; kit.add(box(0xd6cdb8, LAKE.x + Math.cos((a + b) / 2) * LAKE.rx * k, 0.02, LAKE.z + Math.sin((a + b) / 2) * LAKE.rz * 1.035, 6.4, 0.06, 11.4, -(a + b) / 2)); }
  kit.add(box(0x55565a, 64, 0.01, 0, 10, 0.04, 360), box(0x55565a, -64, 0.01, 0, 10, 0.04, 360), box(0x55565a, 0, 0.01, -150, 140, 0.04, 10), box(0x55565a, 0, 0.01, 150, 140, 0.04, 10));
  // ---- đảo Ngọc và đền Ngọc Sơn
  const IX = -8, IZ = -64;
  kit.add(cyl(0x8f8a80, IX, -0.55, IZ, 15.5, 1.1, 11.5), cyl(0xb8ae98, IX, -0.4, IZ, 14.6, 0.8, 10.6));
  kit.add(hall(IX - 3, IZ, 11, 8, 3.2, Math.PI / 2, { twoTier: true, lit: true }), hall(IX + 6, IZ, 7, 6, 2.8, Math.PI / 2));
  kit.add(grp(IX + 12.5, 0, IZ, -Math.PI / 2, box(PLASTER, -2.4, 1.8, 0, 1, 3.6, 1), box(PLASTER, 2.4, 1.8, 0, 1, 3.6, 1), northRoof(0, 3.6, 0, 6.4, 1.6, 0.9)));
  kit.add(banyan(r, 0.9).translateX(IX - 9).translateZ(IZ + 7), banyan(r, 0.8).translateX(IX + 2).translateZ(IZ - 7));
  for (let i = 0; i < 6; i++) kit.add(bead(glow(0xff5a3a), IX + 12, 3.2 - (i % 2) * 0.1, IZ - 3 + i * 1.2, 0.26, 0.34, 0.26));
  // cầu Thê Húc: gỗ sơn đỏ cong như con tôm, từ bờ đông sang đảo
  const bridge = archBridge(kit, V(LAKE.rx + 3, 0, IZ), V(IX + 14.5, 0, IZ), 3, 2.4, RED, 0x8a3428, 14);
  // ---- gò Độc Tôn: Tháp Bút, Đài Nghiên, cổng
  const TX = 62, TZ = -76;
  kit.add(cyl(0x9aa77a, TX, 0.5, TZ, 7, 1, 7), cyl(0x8f8a80, TX, 1.2, TZ, 2.6, 0.6));
  const but = grp(TX, 1.4, TZ, 0, box(0xe8e2d2, 0, 0.6, 0, 2.2, 1.2, 2.2)); let y = 1.2;
  for (let i = 0; i < 5; i++) { const w = 1.9 - i * 0.24; but.add(box(0xe0d8c4, 0, y + 1, 0, w, 2, w), box(0x8f8a80, 0, y + 2.08, 0, w + 0.4, 0.16, w + 0.4)); y += 2.2; }
  but.add(cyl(0xe0d8c4, 0, y + 0.8, 0, 0.12, 1.6, 0.12), cyl(0xe0d8c4, 0, y + 1.8, 0, 0.02, 0.6, 0.25)); kit.add(but);
  const GX = 50; kit.add(box(PLASTER, GX, 1.6, IZ + 3, 1.2, 3.2, 1.2), box(PLASTER, GX, 1.6, IZ - 3, 1.2, 3.2, 1.2), box(PLASTER, GX, 3.4, IZ, 1.2, 0.5, 7.2), northRoof(GX, 3.6, IZ, 1.8, 8, 0.7, 0x6a2a1a, 0));
  kit.add(ball(0x8f8a80, TX - 4, 1.2, TZ, 1.1, 0.6, 0.8)); // Đài Nghiên
  for (let i = 0; i < 3; i++) kit.add(bead(0x6f6a62, TX - 4 + (i - 1) * 0.8, 0.36, TZ + 0.6, 0.34, 0.24, 0.4)); // ba con cóc đỡ Đài Nghiên
  // ---- gò Rùa và Tháp Rùa giữa hồ
  const RX = -3, RZ = 22;
  kit.add(cyl(0x7a8a5a, RX, -0.4, RZ, 9, 1, 6.5), cyl(0x5f7f45, RX, 0.1, RZ, 7.2, 0.4, 5.4));
  for (let i = 0; i < 9; i++) { const t = tree(r, 0.7 + r() * 0.3, true); t.position.set(RX + (r() - 0.5) * 12, 0, RZ + (r() - 0.5) * 8); kit.add(t); }
  const rua = grp(RX, 0.3, RZ, 0.2);
  rua.add(box(0xd8cfba, 0, 1.4, 0, 6, 2.8, 4.4), box(0xd8cfba, 0, 3.6, 0, 4.4, 1.6, 3.4), box(0xd8cfba, 0, 5.2, 0, 2.6, 1.4, 2.2), box(0x8f8a80, 0, 2.86, 0, 6.4, 0.16, 4.8), box(0x8f8a80, 0, 4.46, 0, 4.8, 0.14, 3.8), box(0x8f8a80, 0, 5.96, 0, 3, 0.14, 2.6), ball(0xd8cfba, 0, 6.5, 0, 0.9, 0.6, 0.9));
  for (const s of [-1, 0, 1]) { rua.add(box(0x6a6258, s * 1.7, 1.2, 2.21, 0.9, 1.8, 0.04), box(0x6a6258, s * 1.7, 1.2, -2.21, 0.9, 1.8, 0.04)); if (s) rua.add(box(0x6a6258, s * 3.01, 1.2, 0, 0.04, 1.8, 0.9)); }
  for (const s of [-1, 1]) rua.add(box(0x6a6258, s * 1, 3.6, 1.71, 0.6, 1, 0.04), box(0x6a6258, 0, 5.2, s * 1.11, 0.6, 0.8, 0.04));
  kit.add(rua);
  lotus(kit, { x: -18, z: -20, rx: 12, rz: 18 }, 26, r);
  // ---- cây ven hồ: liễu rủ, lộc vừng, sấu, ghế đá, đèn
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + r() * 0.04, x = Math.cos(a) * (LAKE.rx + 9 + r() * 4), z = Math.sin(a) * (LAKE.rz + 10 + r() * 4);
    if (Math.hypot(x - TX, z - TZ) < 12 || (Math.abs(z - IZ) < 5 && x > 0)) continue;
    if (i % 3 === 0) { const w = grp(x, 0, z, r() * 6, cyl(0x6a5038, 0, 1.4, 0, 0.26, 2.8)); for (let k = 0; k < 4; k++) { const b = (k / 4) * 6.28; w.add(cyl(0x7fae5a, Math.cos(b) * 1.1, 2.4, Math.sin(b) * 1.1, 0.5, 3.4, 0.16)); } w.add(ball(0x8fbe62, 0, 4.1, 0, 1.8, 0.8, 1.8)); kit.add(w); }
    else { const t = i % 3 === 1 ? banyan(r, 0.5 + r() * 0.2) : tree(r, 1.1 + r() * 0.4); t.position.set(x, 0, z); kit.add(t); }
    if (i % 4 === 2) { const b = bench(); b.position.set(Math.cos(a) * (LAKE.rx + 5.6), 0, Math.sin(a) * (LAKE.rz + 6.4)); b.rotation.y = -a + Math.PI / 2; kit.add(b); }
    if (i % 5 === 0) kit.add(lampPost(Math.cos(a) * (LAKE.rx + 7), 0, Math.sin(a) * (LAKE.rz + 8.4), 3.8));
  }
  // ---- phố quanh hồ: nhà ống phố cổ phía bắc và tây, nhà kiểu Pháp phía đông, mái ngói, ban công, cờ
  const COLS = [0xf3d27a, 0xf1e3b8, 0xe8c9a8, 0xd8e6d2, 0xf9d2c4, 0xeadfcf];
  const row = (x0: number, z0: number, dx: number, dz: number, n: number, face: number, french: boolean) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + dx * i, z = z0 + dz * i, h = 6 + (i % 3) * 2.4 + (french ? 3 : 0), w = 5.4 + (i % 2), c = COLS[(i + (french ? 2 : 0)) % COLS.length];
      const g = grp(x, 0, z, face, box(c, 0, h / 2, 0, w, h, 9));
      for (let f = 1; f < h / 3; f++) g.add(box(0x6a8aa0, 0, f * 3 + 0.4, 4.52, w * 0.5, 1.5, 0.06), box(0x3f5a3a, 0, f * 3 - 0.4, 4.9, w * 0.62, 0.1, 0.8), box(0x5a4a3a, 0, f * 3 + 0.2, 5.28, w * 0.62, 0.7, 0.04));
      g.add(box(0x7a5030, 0, 1.4, 4.52, w * 0.7, 2.6, 0.06), box([0xe2573c, 0x2a6fbf, 0xffd23f][i % 3], 0, 3, 5.1, w * 0.9, 0.12, 1.4));
      g.add(french ? box(0x6a6a6a, 0, h + 0.5, 0, w + 0.2, 1, 9.2) : northRoof(0, h, 0, w + 0.2, 9, 1.4, 0x9a4a2a));
      kit.add(g);
    }
  };
  row(-100, -150, 7.2, 0, 28, 0, false); row(-110, -132, 0, 8.6, 30, Math.PI / 2, false); row(90, -132, 0, 9.2, 28, -Math.PI / 2, true); row(-100, 160, 7.4, 0, 27, Math.PI, true);
  for (const [x, z] of [[78, -40], [78, 60], [-78, 30]] as const) { const f = grp(x, 0, z, 0, cyl(0xcfd6e0, 0, 3, 0, 0.05, 6), box(0xd8281e, 0.6, 5.4, 0, 1.2, 0.8, 0.02)); kit.add(f); }
  // ---- phố đi bộ đầu nam hồ: người dạo, trò chơi dân gian, nhóm hát
  for (let i = 0; i < 16; i++) { const p = person(i, i % 4 === 0 ? 1 : i % 4 === 1 ? 2 : 0); p.position.set(-30 + r() * 70, 0, 128 + r() * 14); p.rotation.y = r() * 6; kit.add(p); }
  for (let i = 0; i < 3; i++) kit.add(box(0x3f6f8f, 10 + i * 12, 0.3, 136, 4, 0.6, 2), cyl(0xffd23f, 10 + i * 12, 0.9, 136, 0.6, 0.6));
  kit.live(label('Đền Ngọc Sơn', IX - 3, 9.6, IZ, '#9a3f2a', 1.0), label('Cầu Thê Húc', 24, 6.8, IZ - 2, '#a8322a', 0.9), label('Tháp Bút', TX, 15.4, TZ, '#5a5a54', 0.9), label('Tháp Rùa', RX, 10.6, RZ, '#5a5a54', 1.0), label('Phố đi bộ Hồ Gươm', 10, 6, 134, '#2a6f9a', 1.0));
  kit.add(signPost('Đinh Tiên Hoàng', 64, 0, -24, '#2a4a6a', 0.8));
  void ball; void cyl; void STONE; void pagoda; void wet;

  const path = [V(66, 0, -36), V(60, 0, -56), V(55, 0, -63), V(50, 0, IZ), V(LAKE.rx + 5, 0, IZ), ...bridge, V(IX + 9, 0, IZ), V(IX + 3, 0, IZ),
    V(IX + 9, 0, IZ), ...[...bridge].reverse(), V(LAKE.rx + 6, 0, IZ + 8), V(LAKE.rx + 6, 0, -10), V(LAKE.rx + 7, 0, 20), V(LAKE.rx + 3, 0, 70), V(28, 0, 112), V(12, 0, 132)];
  return {
    path: path.map((p) => p.clone()), half: 2.2, npcs: 14, startYaw: -Math.PI / 2 - 0.4,
    extras: [
      { frac: 0.62, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Theo truyền thuyết, sau khi đánh thắng quân Minh, vua Lê Lợi dạo thuyền trên hồ thì Rùa thần nổi lên xin lại thanh gươm báu, từ đó hồ mang tên Hoàn Kiếm.', q: 'Tên Hoàn Kiếm gắn với truyền thuyết nào?', options: ['Vua trả gươm cho Rùa thần', 'Vua đúc gươm bên hồ', 'Rùa thần dâng ngọc'], answer: 0 },
      { frac: 0.8, kind: 'ngam_canh', name: 'Ngắm hồ lúc chiều', fact: 'Hồ Gươm rộng khoảng 12 ha. Chiều tối, đèn quanh hồ và trên cầu Thê Húc bật sáng, phản chiếu xuống mặt nước.' },
    ],
    stops: [
      { id: 'thap_but', at: V(55, 0, -63), look: V(TX, 8, TZ) },
      { id: 'cau_the_huc', at: bridge[4].clone(), look: V(IX, 3, IZ) },
      { id: 'den_ngoc_son', at: V(IX + 3, 0, IZ), look: V(IX - 3, 3.4, IZ), cam: V(IX + 13, 4.2, IZ + 9) },
      { id: 'thap_rua', at: V(LAKE.rx + 7, 0, 20), look: V(RX, 4, RZ) },
      { id: 'pho_di_bo', at: V(12, 0, 132), look: V(0, 2, 140) },
    ],
    sky: [0x6fa6d8, 0xf6dcae], fog: [0xe8dcc4, 140, 520],
    light: { ambient: 1.5, sun: 1.7, sunColor: 0xffe2b0, sunDir: [-0.4, 0.6, -0.5], ambientColor: 0xfff4e4 },
    shopSpots: [V(58, 0, -20), V(56, 0, 60), V(-10, 0, 128)],
  };
}
void THREE;
