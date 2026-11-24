// Cù Lao Chàm (Hòn Lao, Bãi Làng). Trục x: tây → đông; trục z: bắc → nam. Biển và đất liền ở phía TÂY, núi đảo ở phía đông.
// Tàu cập cầu cảng Bãi Làng; vào làng gặp bảng "nói không với túi ni lông"; giếng cổ và chùa Hải Tạng nằm sâu trong xóm phía bắc;
// Bãi Chồng ở phía nam dọc bờ tây; chợ Tân Hiệp ngay cạnh cầu cảng.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import {
  Kit, V, ball, basketBoat, bead, beachSet, bench, box, cone, cyl, fishingBoat, flag, gable, glow, grp, hammock, hill, hip, label, netRack, palm, person, potPlant, rock, shade,
  speedboat, stall, templeRoof, tree,
} from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const SAND = 0xf3e6b8, BRICK = 0xb4673e, CONC = 0xcfcabd;
const WALLS = [0xf1e3b8, 0xbfe0e6, 0xf3d9a0, 0xe9c9c0, 0xd9e8c4, 0xf6f1e4, 0xf0c9a0], ROOFS = [0xa85a3a, 0xb8643c, 0x8f4a34, 0xc2714a];
export function cuLaoCham(kit: Kit, _s: Sight): SightSet {
  const r = kit.r, shore = (z: number) => -6 + Math.sin(z * 0.03) * 7 + (z > 60 ? (z - 60) * 0.12 : 0); // mép nước theo z
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  // ---- biển: đáy cát sáng gần bờ nhìn xuyên qua nước trong, xa dần sang xanh ngọc đậm
  kit.add(box(0x2a8a8c, -380, -3.6, 0, 700, 1, 1300), box(0x58b9b0, -62, -2.9, 30, 90, 1, 620), box(0xcfe6c0, -22, -2.2, 30, 40, 1, 600));
  kit.water(0x38bccb, -350, 0, 720, 1300, -0.3, 0.66);
  for (let z = -230; z < 300; z += 8) { const sx = shore(z); kit.add(box(SAND, sx + 15, -0.7, z, 30, 1.6, 8.2), box(0xfffaf0, sx - 0.5, -0.24, z, 2.2, 0.06, 8.2), box(0xe9dba8, sx + 3, 0.105, z, 5, 0.02, 8.2)); }
  // ---- đảo: thảm cỏ nhiều sắc, Hòn Lao nhiều lớp phủ rừng phía đông, mỏm núi hai đầu
  kit.add(box(0x86b060, 160, -0.5, 30, 300, 1.2, 560));
  for (let i = 0; i < 46; i++) { const x = 30 + r() * 110, z = -220 + r() * 480; kit.add(box([0x7aa856, 0x93bd6a, 0x6f9f50][i % 3], x, 0.105 + (i % 3) * 0.004, z, 8 + r() * 16, 0.02, 6 + r() * 14, r() * 3)); }
  for (const [x, z, rx, rz, h] of [[150, 10, 70, 150, 62], [215, -60, 90, 150, 104], [250, 80, 100, 170, 128], [330, 0, 130, 230, 150], [130, -170, 70, 90, 54], [140, 210, 80, 100, 60], [95, -110, 34, 60, 26], [100, 150, 40, 70, 30]] as const)
    kit.add(hill(x, z, rx, rz, h, r));
  for (let i = 0; i < 38; i++) { const t = tree(r, 1.6 + r() * 1.4, r() < 0.5); t.position.set(62 + r() * 46, 0, -200 + r() * 430); kit.add(t); }
  // các hòn nhỏ ngoài khơi: Hòn Dài, Hòn Mồ, Hòn Tai, Hòn Lá… có vành đá và bọt sóng; dải đất liền Hội An mờ xa phía tây
  for (const [x, z, s] of [[-190, -230, 46], [-260, -70, 30], [-140, 310, 34], [-320, 200, 24], [-230, 60, 14]] as const)
    kit.add(hill(x, z, s, s * 0.7, s * 0.62, r, [0x3f7a4e, 0x4d8c58, 0x356f48]), bead(0x8a8f88, x, 0.4, z, s * 1.04, 2.4, s * 0.74), bead(0xfffaf0, x, -0.26, z, s * 1.12, 0.1, s * 0.82));
  kit.add(box(0xb9cfd6, -700, 3, 0, 40, 8, 1500), box(0xc9dbe0, -690, 9, -200, 30, 8, 500));
  // san hô, cá và rong dưới làn nước trong sát bờ
  for (let i = 0; i < 110; i++) { const z = -70 + r() * 270, x = shore(z) - 4 - r() * 30; kit.add(bead([0xff7a6a, 0xffb347, 0xf29bc0, 0x9b7fd6, 0xfff0a0][i % 5], x, -1.9 + r() * 0.5, z, 0.7 + r() * 0.9, 0.5 + r() * 0.8, 0.7 + r() * 0.9)); }
  for (let i = 0; i < 30; i++) { const z = 60 + r() * 120, x = shore(z) - 6 - r() * 24; kit.add(cone([0xff7a6a, 0xffb347, 0xf29bc0][i % 3], x, -1.6, z, 0.3, 1.6)); }
  kit.motes(40, 0xffd23f, 0.5, () => { const z = -20 + r() * 200; return V(shore(z) - 4 - r() * 24, -1.0 - r() * 0.6, z); }, (p, i, t, dt) => { p.z += Math.sin(t * 0.6 + i) * 0.9 * dt; p.x += Math.cos(t * 0.5 + i * 2) * 0.5 * dt; });

  // ---- cầu cảng Bãi Làng: mặt bê tông có gờ, cọc neo, lan can xanh trắng, ca nô cao tốc một bên, ghe gỗ một bên
  const PX0 = -62, PY = 1.3;
  kit.add(box(CONC, (PX0 + 2) / 2, PY - 0.3, 0, 2 - PX0, 0.6, 6.4), box(CONC, PX0 - 4, PY - 0.3, -6, 12, 0.6, 18.4), box(0xe9e4d6, (PX0 + 2) / 2, PY + 0.012, 0, 2 - PX0, 0.02, 0.5));
  for (const s of [-1, 1]) kit.add(box(0xf2c230, (PX0 + 2) / 2, PY + 0.06, s * 3.05, 2 - PX0, 0.14, 0.3));
  for (let x = PX0; x < 0; x += 7) for (const s of [-1, 1]) kit.add(cyl(0x9a958a, x, -1.3, s * 2.6, 0.42, 3.4), bead(0x24262b, x + 3.5, 0.55, s * 3.35, 0.2, 0.5, 0.5));
  for (const s of [-1, 1]) for (let x = PX0 + 2; x < 0; x += 4) kit.add(box(0x2f6fb0, x, PY + 0.55, s * 2.9, 0.14, 1.1, 0.14), box(0xf4f1ea, x + 2, PY + 1.02, s * 2.9, 4, 0.12, 0.12), box(0xf4f1ea, x + 2, PY + 0.58, s * 2.9, 4, 0.08, 0.08));
  for (let x = PX0 + 6; x < -4; x += 14) kit.add(cyl(0x2b2f36, x, PY + 0.22, 2.2, 0.2, 0.44), cyl(0xf2c230, x, PY + 0.46, 2.2, 0.26, 0.08), cyl(0x3d3a36, x + 7, PY + 1.9, -2.6, 0.06, 3.8), ball(glow(0xfff2c2), x + 7, PY + 3.8, -2.6, 0.2));
  const fl = flag(7); fl.position.set(PX0 - 8, PY, -13); kit.add(fl);
  kit.add(box(0xf4f1ea, PX0 - 6, PY + 1.5, -12.5, 5, 3, 3.4), hip(0x2f6fb0, PX0 - 6, PY + 3, -12.5, 6, 1, 4.4), box(0x9fd8f0, PX0 - 6, PY + 1.7, -10.78, 3.4, 1.1, 0.06)); // chòi bán vé đầu cầu
  // tàu khách lớn cập đầu cầu, ca nô xếp hàng phía nam, ghe gỗ phía bắc
  const ship = grp(PX0 - 4, -0.4, 9, Math.PI / 2); ship.add(bead(0x2a6f9a, 0, 0.5, 0, 2.8, 1.5, 9.5), box(0xf4f1ea, 0, 1.9, 0, 4.6, 0.3, 15), box(0xf4f1ea, 0, 3.2, -1.5, 3.6, 2.4, 7), box(0xbfe6ff, 0, 3.4, -1.5, 3.66, 1.0, 6), box(0xd2553a, 0, 4.6, -1.5, 4.2, 0.24, 8), cyl(0x3d3a36, 0, 6, -3, 0.08, 3), box(0xd2301e, 0.5, 7.0, -3, 1.0, 0.7, 0.04)); kit.add(ship);
  for (let i = 0; i < 4; i++) { const b = speedboat([0x2a6f9a, 0xe2573c, 0x2f8a5a, 0xf2a02a][i], 8); b.position.set(-48 + i * 11.5, -0.3, 6.6); b.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.12; kit.add(b); }
  for (let i = 0; i < 3; i++) { const b = fishingBoat([0x2a6f9a, 0x2f8a5a, 0x1f5f8a][i], [0xd2553a, 0xf2c230, 0xd2553a][i], 9); b.position.set(-44 + i * 14, -0.35, -7.4); b.rotation.y = -Math.PI / 2 + (r() - 0.5) * 0.12; kit.add(b); }
  for (let i = 0; i < 7; i++) { const b = fishingBoat(pick([0x2a6f9a, 0x2f8a5a, 0x1f5f8a]), pick([0xd2553a, 0xf2c230]), 7 + r() * 2); const z = 22 + i * 10; b.position.set(shore(z) - 9 - (i % 3) * 7, -0.35, z); b.rotation.y = 1.0 + r() * 1.2; kit.add(b); }
  // một chiếc ca nô chạy ngang ngoài khơi và hai ghe dập dềnh (chuyển động)
  const run = speedboat(0xe2573c, 8), wake = box(0xfffaf0, 0, -0.1, 7, 1.6, 0.04, 9); run.add(wake); run.userData.keepParts = false; kit.live(run);
  kit.onTick((t) => { const u = (t * 0.035) % 1, z = -260 + u * 560; run.position.set(-120 - Math.sin(u * 6.28) * 30, -0.25 + Math.sin(t * 5) * 0.05, z); run.rotation.y = Math.PI; });
  kit.live(label('Cầu cảng Bãi Làng', -30, 7.2, 0, '#2a6f9a', 1.0));

  // ---- cổng chào đảo: hai trụ, mái ngói nhỏ, băng tên; quảng trường lát gạch sau cổng
  kit.add(box(0xf4f1ea, 6, 2.6, -3.9, 0.9, 5.2, 0.9), box(0xf4f1ea, 6, 2.6, 3.9, 0.9, 5.2, 0.9), box(0x2a6f9a, 6, 0.5, -3.9, 1.1, 1, 1.1), box(0x2a6f9a, 6, 0.5, 3.9, 1.1, 1, 1.1), box(0x2a6f9a, 6, 5.5, 0, 0.7, 1.1, 9.2), templeRoof(0xa85a3a, 6, 6.05, 0, 2.2, 0.9, 10.4, 0x7a3a26));
  kit.live(label('Cù Lao Chàm', 6, 8.4, 0, '#2a6f9a', 1.1));
  kit.add(box(0xd9cdb2, 15, 0.03, 0, 18, 0.06, 16)); for (let i = 0; i < 5; i++) kit.add(box(0xc9bb9c, 7.5 + i * 3.6, 0.065, 0, 0.12, 0.02, 16));
  // bảng "Nói không với túi ni lông": nền xanh, vòng tròn đỏ gạch chéo chiếc túi, bên cạnh là chiếc làn mây
  const board = grp(17, 0, 7, -2.74); board.add(cyl(0x7a5a3c, -2, 1.6, 0, 0.12, 3.2), cyl(0x7a5a3c, 2, 1.6, 0, 0.12, 3.2), box(0x2f8a5a, 0, 2.6, 0, 5, 2.6, 0.16), box(0xf4f1ea, 0, 2.6, 0.1, 4.6, 2.2, 0.04), cyl(0xd2301e, -1.2, 2.5, 0.16, 0.86, 0.06).rotateX(Math.PI / 2), cyl(0xf4f1ea, -1.2, 2.5, 0.18, 0.68, 0.06).rotateX(Math.PI / 2), box(0xb9d4e0, -1.2, 2.38, 0.22, 0.56, 0.66, 0.02), box(0xb9d4e0, -1.2, 2.78, 0.22, 0.3, 0.2, 0.02), box(0xd2301e, -1.2, 2.5, 0.24, 1.6, 0.2, 0.04).rotateZ(0.8), box(0x9a7150, 1.2, 2.2, 0.14, 0.9, 0.7, 0.3), cyl(0x9a7150, 1.2, 2.7, 0.14, 0.4, 0.06).rotateX(Math.PI / 2), box(0x2f8a5a, 1.2, 3.3, 0.14, 1.6, 0.24, 0.02)); kit.add(board);
  kit.live(label('Nói không với túi ni lông', 17, 5.4, 7, '#2f8a5a', 0.8));
  const lady = person(4, 1, 0x9b7fd6); lady.position.set(14.4, 0, 9.4); lady.add(box(0x9a7150, 0.44, 0.9, 0, 0.4, 0.44, 0.5)); kit.add(lady);

  // ---- làng chài Bãi Làng: nhà nhiều kiểu, nhiều màu; hiên, chậu hoa, rào thấp
  const house = (x: number, z: number, ry: number) => {
    const t = Math.floor(r() * 5), w = 5.4 + r() * 2.8, c = pick(WALLS), rf = pick(ROOFS), g = grp(x, 0, z, ry), tr = shade(c, 0.78);
    if (t <= 1) { // nhà cấp bốn mái ngói có hiên
      g.add(box(c, 0, 1.7, 0, w, 3.4, 6), box(tr, 0, 0.3, 0, w + 0.1, 0.6, 6.1), gable(rf, 0, 3.4, 0, 7, 1.4 + r() * 0.6, w + 0.8, Math.PI / 2), box(0x4a2c1c, -w / 6, 1.25, 3.04, 1.3, 2.3, 0.1), box(0x3f6f8f, w / 3.4, 1.9, 3.04, 1.2, 1.1, 0.1), box(0xf4f1ea, w / 3.4, 1.9, 3.06, 0.08, 1.1, 0.1),
        box(rf, 0, 2.95, 3.9, w, 0.1, 1.8), cyl(tr, -w / 2 + 0.3, 1.45, 4.6, 0.09, 2.9), cyl(tr, w / 2 - 0.3, 1.45, 4.6, 0.09, 2.9));
    } else if (t === 2) { // nhà hai tầng làm homestay, ban công
      g.add(box(c, 0, 3.1, 0, w, 6.2, 6), box(tr, 0, 0.3, 0, w + 0.1, 0.6, 6.1), hip(rf, 0, 6.2, 0, w + 1, 1.5, 7), box(0xe9e4d6, 0, 3.25, 3.5, w, 0.16, 1.1), box(0xf4f1ea, 0, 3.8, 4.0, w, 0.08, 0.08), box(0x4a2c1c, 0, 1.25, 3.04, 1.4, 2.3, 0.1), box(0x4a2c1c, 0, 4.4, 3.04, 1.2, 2.0, 0.1),
        box(0x3f6f8f, -w / 3, 4.6, 3.04, 1.1, 1.1, 0.1), box(0x3f6f8f, w / 3, 4.6, 3.04, 1.1, 1.1, 0.1), box(0x3f6f8f, w / 3, 1.9, 3.04, 1.1, 1.1, 0.1));
      for (let i = 0; i <= 4; i++) g.add(box(0xf4f1ea, -w / 2 + (i * w) / 4, 3.55, 4.0, 0.08, 0.5, 0.08));
    } else if (t === 3) { // quán mái bằng có bạt che, bàn ghế trước cửa
      const aw = pick([0xe2573c, 0x2f6fb0, 0xf2a02a, 0x2f8a5a]);
      g.add(box(c, 0, 1.6, 0, w, 3.2, 5.4), box(0xd8d2c4, 0, 3.3, 0, w + 0.4, 0.2, 5.8), box(aw, 0, 2.7, 3.7, w, 0.08, 2.2).rotateX(0.22), box(0x2f2620, 0, 1.3, 2.74, w * 0.7, 2.2, 0.1), box(0xd9a35b, -1, 0.7, 4.2, 1.1, 0.08, 1.1), cyl(0x7a5a3c, -1, 0.35, 4.2, 0.07, 0.7), bead(0xe2573c, -0.2, 0.3, 4.2, 0.22, 0.3, 0.22), bead(0x2f6fb0, -1.8, 0.3, 4.2, 0.22, 0.3, 0.22));
    } else { // nhà mái tôn xanh, tường sơn sáng
      g.add(box(c, 0, 1.6, 0, w, 3.2, 6), gable(pick([0x5f9fc0, 0x6fae8a, 0x8a94a0]), 0, 3.2, 0, 7, 1.1, w + 0.6, Math.PI / 2), box(0x4a2c1c, w / 5, 1.2, 3.04, 1.3, 2.2, 0.1), box(0x3f6f8f, -w / 3.4, 1.9, 3.04, 1.2, 1.0, 0.1));
    }
    if (r() < 0.7) { const p = potPlant(pick([0xe85aa0, 0xffd23f, 0xff8a3d, 0xf3ead2]), 0.9 + r() * 0.4); p.position.set(-w / 2 + 0.7, 0, 4.4); g.add(p); }
    if (r() < 0.4) { const p = potPlant(pick([0xe85aa0, 0xffd23f]), 0.9); p.position.set(w / 2 - 0.6, 0, 4.5); g.add(p); }
    kit.add(g);
  };
  for (let i = 0; i < 9; i++) { house(30 + i * 9.4, -9.6, 0); if (i > 1) house(30 + i * 9.4, 9.6, Math.PI); }
  for (let i = 0; i < 8; i++) { if (i !== 3) house(22 - 13.4, -22 - i * 9.4, Math.PI / 2); house(22 + 12.6, -22 - i * 9.4, -Math.PI / 2); }
  for (let i = 0; i < 6; i++) house(36, 21 + i * 10, -Math.PI / 2);
  for (let i = 0; i < 46; i++) { const z = -200 + r() * 450, x = shore(z) + 15 + r() * 11; if (Math.abs(z) < 9 || (z > 98 && z < 128)) continue; const p = palm(r, 6 + r() * 3.5); p.position.set(x, 0, z); p.rotation.z = (r() - 0.5) * 0.16; kit.add(p); }
  // đời sống làng chài: giàn phơi lưới, thúng chai, sào phơi cá, chậu hoa giấy, ghế đá
  for (let i = 0; i < 4; i++) { const n = netRack(4.6, [0x5f9fa8, 0x4f8f6a, 0x5f7fb0][i % 3]); n.position.set(shore(22 + i * 7) + 9, 0, 23 + i * 7); kit.add(n); }
  for (let i = 0; i < 9; i++) { const z = -44 + i * 9 + (i > 4 ? 60 : 0), b = basketBoat(0.9 + r() * 0.3, i % 3 === 0); b.position.set(shore(z) + 5 + r() * 4, 0, z); b.rotation.y = r() * 6; kit.add(b); }
  for (let i = 0; i < 3; i++) { const z = -16 - i * 7; kit.add(cyl(0x7a5a3c, shore(z) + 10, 0.6, z - 2, 0.06, 1.2), cyl(0x7a5a3c, shore(z) + 10, 0.6, z + 2, 0.06, 1.2), box(0xd9c7a0, shore(z) + 10, 1.2, z, 1.4, 0.05, 4.4)); for (let k = 0; k < 6; k++) kit.add(bead([0xc9824a, 0xb86a3a, 0xd9a06a][k % 3], shore(z) + 9.7 + (k % 2) * 0.6, 1.26, z - 1.6 + k * 0.65, 0.22, 0.03, 0.3)); }
  for (let i = 0; i < 12; i++) { const z = -96 + i * 8; kit.add(bead([0xe85aa0, 0xff7ab8, 0xd24a8a][i % 3], 14.2 + (i % 2) * 11.6, 1.0, z, 0.9, 0.7, 0.9), cyl(0x7a5a3c, 14.2 + (i % 2) * 11.6, 0.4, z, 0.08, 0.8)); }
  const bn = bench(0x9a8f80); bn.position.set(19, 0, -8); bn.rotation.y = Math.PI / 2; kit.add(bn);
  // quán hải sản sát biển: mái lá, bàn dài, dù
  const QZ = -14, qx = shore(QZ) + 9;
  kit.add(box(0xd9a35b, qx, 0.1, QZ, 8, 0.2, 7), gable(0xc9a45a, qx, 3.1, QZ, 8.4, 1.4, 9, Math.PI / 2));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0x7a5a3c, qx + sx * 3.6, 1.55, QZ + sz * 3, 0.12, 3.1));
  for (let i = 0; i < 3; i++) { kit.add(box(0xb98a52, qx - 2.4 + i * 2.4, 0.86, QZ, 1.5, 0.08, 1.5), cyl(0x7a5a3c, qx - 2.4 + i * 2.4, 0.5, QZ, 0.08, 0.72), bead([0xe2573c, 0xffb347, 0xf4f1ea][i], qx - 2.4 + i * 2.4, 0.96, QZ, 0.34, 0.08, 0.34)); const p = person(i + 7, i % 2); p.position.set(qx - 2.4 + i * 2.4, 0.2, QZ + 1.2); p.rotation.y = Math.PI; kit.add(p); }
  kit.live(label('Quán hải sản Bãi Làng', qx, 5.6, QZ, '#b0642a', 0.6));

  // ---- giếng cổ Chăm (xóm Cấm, chân núi): thành tròn gạch, sân lát, mái che nhỏ bốn cột, cây cổ thụ
  const WX = 22, WZ = -52;
  kit.add(box(0xb9ad98, WX + 9, 0.1, WZ, 10.4, 0.2, 10.4), box(0xa89a84, WX + 9, 0.16, WZ, 8.4, 0.12, 8.4), cyl(BRICK, WX + 9, 0.72, WZ, 1.9, 1.2), cyl(0x9c5632, WX + 9, 0.3, WZ, 2.1, 0.3), cyl(0x163f4e, WX + 9, 1.26, WZ, 1.5, 0.1), cyl(0x9c5632, WX + 9, 1.32, WZ, 2.0, 0.14), cyl(0x163f4e, WX + 9, 1.34, WZ, 1.46, 0.14));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0x7a4a2a, WX + 9 + sx * 2.5, 1.9, WZ + sz * 2.5, 0.12, 3.5), box(BRICK, WX + 9 + sx * 4.6, 0.7, WZ + sz * 4.6, 0.8, 1.4, 0.8), cone(0x9c5632, WX + 9 + sx * 4.6, 1.75, WZ + sz * 4.6, 0.6, 0.7));
  kit.add(hip(0xa85a3a, WX + 9, 3.6, WZ, 6.6, 1.3, 6.6), cyl(0x8a6a48, WX + 6.2, 0.5, WZ + 2.6, 0.36, 0.6), cyl(0x5a4a34, WX + 9, 2.6, WZ, 0.05, 1.9), cyl(0x8a6a48, WX + 9, 1.7, WZ, 0.26, 0.4));
  for (let i = 0; i < 3; i++) kit.add(box(0xd9a35b, WX + 12.4, 0.5 + i * 0.01, WZ + 3 - i * 1.1, 0.5, 0.6, 0.5)); // chum gánh nước
  const t1 = tree(r, 2.4); t1.position.set(WX + 17, 0, WZ - 5); kit.add(t1); const t2 = tree(r, 1.9, true); t2.position.set(WX + 15, 0, WZ + 7); kit.add(t2);
  kit.live(label('Giếng cổ Chăm', WX + 9, 6.6, WZ - 3, '#9c5632', 0.6));

  // ---- chùa Hải Tạng: tam quan, sân gạch, chính điện mái ngói cong, tựa núi nhìn ra thung lũng ruộng nhỏ
  const HX = 30, HZ = -122, hz = grp(HX, 0, HZ);
  hz.add(box(0xe9dcc0, -3.6, 2.2, 16, 1.5, 4.4, 1.5), box(0xe9dcc0, 3.6, 2.2, 16, 1.5, 4.4, 1.5), box(0xe9dcc0, -8.4, 1.7, 16, 1.2, 3.4, 1.2), box(0xe9dcc0, 8.4, 1.7, 16, 1.2, 3.4, 1.2), templeRoof(0x8a4a36, 0, 4.4, 16, 9, 1.5, 3, 0x5a2a20), templeRoof(0x8a4a36, -6, 3.4, 16, 5, 1.1, 2.4, 0x5a2a20), templeRoof(0x8a4a36, 6, 3.4, 16, 5, 1.1, 2.4, 0x5a2a20),
    box(0xe9dcc0, -15, 1.1, 16, 12, 2.2, 0.6), box(0xe9dcc0, 15, 1.1, 16, 12, 2.2, 0.6), box(0xc9b8a0, 0, 0.06, 8.6, 24, 0.12, 13.6));
  hz.add(box(0xb9b2a4, 0, 0.45, 0, 23, 0.9, 14.6), box(0xb9b2a4, 0, 0.2, 7.9, 8, 0.4, 1.6), box(0xf1e3b8, 0, 3.1, 0, 18, 4.4, 10), templeRoof(0x8a4a36, 0, 5.3, 0, 22, 2.6, 14, 0x5a2a20), templeRoof(0x8a4a36, 0, 7.6, 0, 12, 1.6, 8, 0x5a2a20), box(0xf1e3b8, 0, 6.9, 0, 10, 1.6, 6), box(glow(0xffb347), 0, 2.7, 5.06, 3, 3, 0.1), box(0x7a1f1a, 0, 4.6, 5.3, 4.4, 0.7, 0.1), box(glow(0xffd23f), 0, 4.6, 5.36, 3.6, 0.3, 0.04));
  for (let i = 0; i < 6; i++) hz.add(cyl(0xa8322a, -7.5 + i * 3, 3.1, 5.8, 0.28, 4.4));
  hz.add(cyl(0x7a7a72, 0, 0.9, 10.6, 1, 1.0), cyl(0x5a5a54, 0, 1.6, 10.6, 1.2, 0.3), cyl(0x8a6a2a, 0, 2.0, 10.6, 0.5, 0.5));
  for (const sx of [-1, 1]) { const p = potPlant(0xf3ead2, 1.6); p.position.set(sx * 6, 0.12, 11); hz.add(p); hz.add(bead(0x9a958a, sx * 2.6, 0.7, 14, 0.5, 0.7, 0.8), box(0x8d8478, sx * 2.6, 0.2, 14, 1.1, 0.4, 1.4)); }
  // thung lũng ruộng bậc thấp trước chùa, có bờ
  for (let i = 0; i < 8; i++) { const fx = (i % 4) * 8.6 - 34, fz = 24 + Math.floor(i / 4) * 9; hz.add(box([0x8fd67c, 0x79c96d, 0xa6dd80, 0x6fbf66][i % 4], fx, 0.06, fz, 8, 0.12, 8.4), box(0x9a8160, fx + 4.2, 0.12, fz, 0.5, 0.24, 8.8), box(0x9a8160, fx, 0.12, fz + 4.4, 8.8, 0.24, 0.5)); hz.add(box([0x8fd67c, 0x79c96d, 0xa6dd80, 0x6fbf66][(i + 2) % 4], -fx + 6, 0.06, fz + 2, 8, 0.12, 8.4), box(0x9a8160, -fx + 1.8, 0.12, fz + 2, 0.5, 0.24, 8.8)); }
  kit.add(hz); kit.live(label('Chùa Hải Tạng', HX, 11.4, HZ, '#8a4a36', 1.0));
  for (let i = 0; i < 14; i++) { const t = tree(r, 1.6 + r() * 1.2, r() < 0.6); t.position.set(HX - 24 + r() * 48, 0, HZ - 11 - r() * 12); kit.add(t); }

  // ---- Bãi Chồng: những tảng đá tròn xếp chồng, bãi cát trắng, võng và dù dưới hàng dừa
  const BZ = 112, bx = shore(BZ) + 6;
  kit.add(box(0xfbf3d6, bx + 6, 0.11, BZ, 40, 0.02, 46));
  for (const [x, z, s] of [[0, 0, 3.4], [5, -5, 2.4], [-2, 6, 2.8], [7, 5, 2.0], [-7, -3, 2.2], [-4, -9, 1.8]] as const) { kit.add(rock(0xb9aa98, bx + x, s * 0.6, BZ + z, s, s * 0.8, s * 0.9, x), rock(0xa89a88, bx + x + 0.6, s * 1.75, BZ + z - 0.4, s * 0.74, s * 0.6, s * 0.7, z), rock(0xc4b6a4, bx + x - 0.3, s * 2.6, BZ + z + 0.2, s * 0.5, s * 0.4, s * 0.48, s)); }
  kit.add(rock(0xd0c3b0, bx + 0.2, 10.6, BZ, 1.1, 0.9, 1.0, 1));
  for (let i = 0; i < 18; i++) kit.add(rock(pick([0xa89a88, 0xb9aa98, 0x9a8f80]), bx - 12 + r() * 20, 0.3, BZ - 14 + r() * 30, 1 + r() * 1.6, 0.8 + r(), 1 + r() * 1.2, r() * 3));
  for (let i = 0; i < 4; i++) { const b = beachSet([0xe2573c, 0x4aa3d8, 0xffd23f, 0x7ccf4f][i]); b.position.set(bx + 11 + i * 3.6, 0.1, BZ + 13); b.rotation.y = -Math.PI / 2; kit.add(b); }
  for (let i = 0; i < 3; i++) { const h = hammock([0xe2573c, 0x2f6fb0, 0xf2a02a][i]); h.position.set(bx + 20, 0.1, BZ - 14 + i * 5); h.rotation.y = 0.3; kit.add(h); const p = palm(r, 7); p.position.set(bx + 21.8, 0, BZ - 15 + i * 5); kit.add(p); }
  kit.add(box(0xd9a35b, bx + 22, 1.5, BZ + 6, 3, 3, 3), cone(0xc9a45a, bx + 22, 3.7, BZ + 6, 2.6, 1.4), box(0x4aa3d8, bx + 22, 1.5, BZ + 4.46, 1.6, 1.2, 0.06)); // chòi nước dừa
  kit.live(label('Bãi Chồng', bx, 14.4, BZ, '#8a7a5a', 1.0));

  // ---- chợ Tân Hiệp cạnh cầu cảng: nhà lồng nhỏ, sạp hải sản khô, bánh ít lá gai, rau rừng
  const MX = 16, MZ = 26;
  kit.add(box(0xb9ad98, MX + 2, 0.04, MZ, 21, 0.08, 17), gable(0x6fb0cf, MX + 2, 4.2, MZ, 13, 2, 19, Math.PI / 2), box(0xf4f1ea, MX + 2, 4.5, MZ + 6.6, 7, 0.9, 0.12), box(0x2a6f9a, MX + 2, 4.5, MZ + 6.68, 6.4, 0.5, 0.06));
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) kit.add(cyl(0xd8d2c4, MX + 2 + sx * 8, 2.1, MZ + sz * 5.4, 0.24, 4.2));
  for (let i = 0; i < 6; i++) { const st = stall([0x4aa3d8, 0xe2573c, 0xffd23f][i % 3], r); st.scale.setScalar(0.85); st.position.set(MX - 4 + (i % 3) * 5.6, 0, MZ - 3 + Math.floor(i / 3) * 6); st.rotation.y = Math.PI * Math.floor(i / 3); kit.add(st); const p = person(i + 2, 1); p.position.set(MX - 4 + (i % 3) * 5.6, 0, MZ - 4.4 + Math.floor(i / 3) * 8.8); kit.add(p); }
  // dãy mẹt hàng trước chợ: mực khô, cá khô, bánh ít lá gai (gói lá xanh hình tháp), rau rừng bó
  for (let i = 0; i < 8; i++) { const x = MX - 6 + i * 2.2, z = MZ + 9.4; kit.add(box(0x9a7150, x, 0.7, z, 1.8, 0.08, 1.2), cyl(0xd9c08a, x, 0.78, z, 0.7, 0.05)); for (let k = 0; k < 5; k++) { const a = k * 1.26; if (i % 3 === 0) kit.add(bead(0xe9c8a0, x + Math.cos(a) * 0.36, 0.84, z + Math.sin(a) * 0.36, 0.2, 0.03, 0.12)); else if (i % 3 === 1) kit.add(cone(0x3f6a3a, x + Math.cos(a) * 0.36, 0.94, z + Math.sin(a) * 0.36, 0.14, 0.26)); else kit.add(bead(0x5fae4a, x + Math.cos(a) * 0.36, 0.9, z + Math.sin(a) * 0.36, 0.2, 0.12, 0.14)); } }
  kit.live(label('Chợ Tân Hiệp', MX + 2, 8, MZ, '#2a6f9a', 0.9));
  // ---- vật đặc trưng: cua đá trên mỏm đá ven lối ra Bãi Chồng
  const CZ = 96, cx = shore(CZ) + 14.6, crab = grp(cx, 0.86, CZ, 0.6);
  crab.add(bead(0x6a3a5a, 0, 0.22, 0, 0.42, 0.2, 0.34), bead(0x8a4a6a, 0, 0.3, 0.04, 0.3, 0.12, 0.22), bead(0xc0503a, -0.5, 0.2, -0.26, 0.2, 0.12, 0.14), bead(0xc0503a, 0.5, 0.2, -0.26, 0.2, 0.12, 0.14), bead(0x1d1d1d, -0.12, 0.42, -0.26, 0.04), bead(0x1d1d1d, 0.12, 0.42, -0.26, 0.04));
  for (let i = 0; i < 6; i++) crab.add(box(0x6a3a5a, (i < 3 ? -1 : 1) * 0.52, 0.12, -0.1 + (i % 3) * 0.16, 0.36, 0.05, 0.05).rotateZ((i < 3 ? 1 : -1) * 0.5));
  kit.add(rock(0x9a8f80, cx, 0.3, CZ, 1.3, 0.9, 1.1, 2), crab);
  void ball; void THREE;

  const path = [V(PX0, PY, 0), V(-4, PY, 0), V(4, 0, 0), V(16, 0, 0), V(22, 0, 0), V(22, 0, -52), V(22, 0, -100), V(HX, 0, HZ + 24), V(22.5, 0, -94), V(16.5, 0, -50), V(13, 0, 12), V(shore(60) + 12, 0, 60), V(shore(96) + 12, 0, 98), V(bx + 14, 0, BZ - 6), V(shore(70) + 22, 0, 72), V(26, 0, 46), V(MX + 3, 0, MZ + 13)];
  kit.pave(0xb9a98f, path, 3.8, 2, 10); kit.pave(0xe6d6a8, path, 3.2, 10, path.length - 1, 0.1, 0.03);
  return {
    path, half: 1.9, npcs: 12,
    stops: [
      { id: 'cau_cang', at: V(-46, PY, 0), look: V(60, 30, 10) },
      { id: 'bang_tui', at: V(14, 0, 0), look: V(17, 2.6, 7) },
      { id: 'gieng_co', at: V(22, 0, -50), look: V(WX + 9, 1, WZ) },
      { id: 'chua_hai_tang', at: V(HX - 0.4, 0, HZ + 25), look: V(HX, 5, HZ + 6) },
      { id: 'bai_chong', at: V(bx + 13.4, 0, BZ - 6.4), look: V(bx, 4, BZ) },
      { id: 'cho_dao', at: V(MX + 3.4, 0, MZ + 14), look: V(MX + 2, 3, MZ) },
    ],
    extras: [
      { at: V(-22, PY, -2.3), kind: 'ngam_canh', name: 'Ngắm Hòn Lao từ cầu cảng', fact: 'Hòn Lao là đảo lớn nhất trong tám hòn của Cù Lao Chàm, rừng phủ gần kín sườn núi. Dân đảo sống quây quần ở Bãi Làng và Bãi Hương bên bờ tây, phía khuất gió.' },
      { at: V(24.7, 0, -24), kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Năm 2009 UNESCO công nhận Cù Lao Chàm – Hội An là khu dự trữ sinh quyển thế giới.', q: 'Năm 2009, UNESCO công nhận Cù Lao Chàm là gì?', options: ['Di sản văn hoá thế giới', 'Khu dự trữ sinh quyển thế giới', 'Công viên địa chất toàn cầu'], answer: 1 },
      { at: V(cx, 0, CZ), kind: 'thu_vat', emoji: '🦀', name: 'Cua đá Cù Lao Chàm', fact: 'Cua đá sống trong hốc đá trên núi, mai màu tím nâu. Để giữ loài này, đảo chỉ cho bán những con đủ lớn và dán nhãn sinh thái lên từng con.' },
    ],
    sky: [0x4fb0f0, 0xe6f6fb], fog: [0xd2ecf4, 170, 900],
    light: { ambient: 1.6, sun: 1.7, sunColor: 0xfff6dc, sunDir: [-0.4, 0.9, 0.3] },
  };
}
