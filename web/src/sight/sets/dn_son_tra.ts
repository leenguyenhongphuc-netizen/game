// Bán đảo Sơn Trà – chùa Linh Ứng Bãi Bụt. Trục x: tây → đông; trục z: bắc → nam. Núi Sơn Trà ở phía bắc, biển ở phía nam và tây;
// bờ biển Đà Nẵng cong dài về phía nam tới Ngũ Hành Sơn. Chùa tựa lưng vào núi, tượng Quan Thế Âm 67 m quay mặt ra biển.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, label, lampPost, forestMountain, palm, rock, stairs, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const WHITE = 0xf6f4ee, WH2 = 0xe6e3da, RED = 0xa8322a, TILE = 0xb8623a, Y0 = 14;
/** Voọc chà vá chân nâu: lưng xám, vai đen, cẳng chân nâu đỏ, cẳng tay trắng, mặt vàng cam viền râu trắng, đuôi trắng dài. */
function douc(): THREE.Group {
  const g = new THREE.Group();
  g.add(ball(0x8a8f96, 0, 0.55, 0, 0.3, 0.42, 0.28), ball(0x2a2a2e, 0, 0.84, 0, 0.3, 0.16, 0.26), ball(0xf2f0ea, 0, 1.08, 0.02, 0.22, 0.2, 0.2), ball(0xf0a23a, 0, 1.08, 0.14, 0.14, 0.15, 0.1), ball(0x3a2a22, 0, 1.2, 0.0, 0.19, 0.1, 0.17));
  for (const s of [-1, 1]) g.add(bead(0x2a2a2e, s * 0.05, 1.1, 0.23, 0.025), cyl(0x2a2a2e, s * 0.3, 0.7, 0.05, 0.07, 0.34), cyl(0xf2f0ea, s * 0.36, 0.42, 0.14, 0.06, 0.34), cyl(0x2a2a2e, s * 0.17, 0.3, 0.14, 0.09, 0.3).rotateX(1.2), cyl(0x8a3a26, s * 0.2, 0.12, 0.34, 0.07, 0.36));
  g.add(cyl(0xf2f0ea, 0, -0.12, -0.26, 0.045, 1.0), ball(0xf2f0ea, 0, 0.36, -0.2, 0.2, 0.12, 0.12));
  return g;
}
export function sonTra(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.water(0x2f9fc4, 0, 300, 2400, 1400, -0.3, 1);
  // núi Sơn Trà phía bắc phủ rừng; sườn thoải xuống biển phía nam
  kit.add(box(0x6a9c62, 0, Y0 / 2 - 1, -30, 520, Y0, 150), box(0x5f9058, 0, Y0 / 2 - 5, 56, 520, Y0 - 8, 60), forestMountain(0x3f7a4e, -40, -400, 300, 190, r, 0), forestMountain(0x4a8556, 280, -330, 220, 130, r), forestMountain(0x4a8556, -340, -300, 200, 110, r));
  for (let i = 0; i < 230; i++) { const x = -230 + r() * 460, z = -110 + r() * 150; if (Math.abs(x) < 64 && z > -62 && z < 44) continue; if (x > 60 && x < 150 && z > -40 && z < 30 && r() < 0.8) continue; const t = tree(r, 1.4 + r() * 1.8, r() < 0.75); t.position.set(x, z > 44 ? Y0 - 8 : Y0, z); kit.add(t); }
  for (let i = 0; i < 60; i++) kit.add(rock(0x8a8f88, -240 + r() * 480, 1, 86 + r() * 8, 3 + r() * 3, 2 + r() * 2, 3 + r() * 3, r() * 3));
  // đường Hoàng Sa ven biển
  kit.add(box(0x6f7682, 0, Y0 - 7.9, 70, 520, 0.2, 9), box(0xf4f1ea, 0, Y0 - 7.5, 75, 520, 0.7, 0.4));
  for (let x = -240; x < 240; x += 16) { kit.add(lampPost(x, Y0 - 8, 75.4, 5, 0xfff0c0)); if (r() < 0.6) { const p = palm(r, 7); p.position.set(x + 8, Y0 - 8, 64); kit.add(p); } }
  kit.live(label('Đường Hoàng Sa', 30, Y0 - 1, 74, '#3a4a5a', 1.0));
  // bờ biển Đà Nẵng cong về phía nam, phố xá và Ngũ Hành Sơn ở xa
  for (let i = 0; i < 60; i++) { const t = i / 59, x = -330 - Math.sin(t * 1.4) * 180 + t * 260, z = 150 + t * 780; kit.add(box(0xf0e3b4, x, -0.6, z, 60, 1, 22, 0.5 - t * 0.6), box(0xffffff, x + 31, -0.25, z + 6, 3, 0.1, 18, 0.5 - t * 0.6)); if (i % 2 === 0) kit.add(box([0xf2efe8, 0xdfe6ee, 0xe9dcc0][i % 3], x - 44 - r() * 30, 8 + r() * 26, z, 14, 16 + r() * 52, 14)); }
  for (const [x, z, h] of [[-60, 900, 60], [-100, 930, 46], [-30, 950, 40], [-130, 900, 36], [-80, 980, 50]] as const) kit.add(cone(0x7d8a86, x, h / 2, z, h * 0.5, h), bead(0x4f8a52, x, h * 0.6, z, h * 0.3));
  kit.live(label('Biển Mỹ Khê', -210, 30, 420, '#2a7f9a', 9), label('Ngũ Hành Sơn', -70, 84, 920, '#5a6a5a', 14));
  // ---- cổng tam quan chùa Linh Ứng (trên bậc thang từ đường ven biển lên)
  kit.add(stairs(0xcfc8b8, V(0, Y0 - 8, 64), V(0, Y0, 44), 9, 22));
  const gateG = grp(0, Y0, 40);
  for (const [x, w, h] of [[0, 5, 6.4], [-7.4, 3.6, 5], [7.4, 3.6, 5]] as const) { gateG.add(box(WH2, x - w / 2 - 0.6, h / 2, 0, 1.2, h, 1.6), box(WH2, x + w / 2 + 0.6, h / 2, 0, 1.2, h, 1.6), box(WH2, x, h + 0.4, 0, w + 2.4, 0.8, 1.8), templeRoof(TILE, x, h + 0.8, 0, w + 4.4, 1.4, 3.4, RED)); }
  gateG.add(box(WH2, 0, 9.3, 0, 4.4, 1.6, 1.4), templeRoof(TILE, 0, 10.1, 0, 7, 1.4, 3.2, RED), box(RED, 0, 6.6, 0.84, 3.6, 0.9, 0.08), box(0xd9a83a, 0, 6.6, 0.9, 3, 0.44, 0.04));
  kit.add(gateG); kit.live(label('Chùa Linh Ứng', 0, Y0 + 14.2, 40, '#a8322a', 1.1));
  // ---- sân chùa lát đá, hai hàng tượng La Hán đá trắng, cây cảnh, chính điện tựa núi
  kit.add(box(0xcfc8b8, 0, Y0 + 0.03, -6, 120, 0.1, 96));
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const z = 30 - i * 5.4; kit.add(box(0xb9b2a4, s * 6.4, Y0 + 0.4, z, 1.4, 0.8, 1.4), ball(WHITE, s * 6.4, Y0 + 1.3, z, 0.55, 0.7, 0.5), ball(WHITE, s * 6.4, Y0 + 2.2, z, 0.34), cyl(0x8a6a48, s * 11, Y0 + 0.4, z + 2.4, 0.9, 0.8), bead(0x3f7a4e, s * 11, Y0 + 1.6, z + 2.4, 1.1, 0.8, 1.1), bead(0x4f8a52, s * 11.3, Y0 + 2.5, z + 2.2, 0.7, 0.5, 0.7)); }
  const hall = grp(46, Y0, -44);
  hall.add(box(0xb9b2a4, 0, 0.6, 0, 34, 1.2, 20), box(0xf1e3b8, 0, 4.4, 0, 28, 6.4, 14), templeRoof(TILE, 0, 7.6, 0, 33, 3, 19, RED), box(0xf1e3b8, 0, 11.4, 0, 16, 1.8, 8), templeRoof(TILE, 0, 12.3, 0, 21, 2.4, 12, RED));
  for (let i = 0; i < 8; i++) hall.add(cyl(RED, -12.6 + i * 3.6, 4.4, 8, 0.36, 6.4)); hall.add(box(glow(0xffb347), 0, 3.8, 7.06, 6, 4.4, 0.1), stairs(0xcfc8b8, V(0, 0, 16), V(0, 1.2, 11), 12, 4));
  kit.add(hall); kit.live(label('Chính điện', 46, Y0 + 18.4, -44, '#a8322a', 1.0));
  // ---- tượng Quan Thế Âm cao 67 m trên toà sen, quay mặt ra biển (nam)
  const QX = -34, QZ = -36, q = grp(QX, Y0, QZ);
  q.add(cyl(0xb9b2a4, 0, 1.5, 0, 20, 3, 20), cyl(WH2, 0, 4.2, 0, 15, 2.4, 15), cyl(WHITE, 0, 7.4, 0, 12.4, 4, 12.4));
  for (let k = 0; k < 2; k++) for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + k * 0.2, rr = 13.6 - k * 2.2; const p = cone(k ? WHITE : WH2, Math.cos(a) * rr, 7.6 + k * 2.6, Math.sin(a) * rr, 2.7, 6.2, 1.2); p.rotation.y = -a; p.rotation.z = -0.55 + k * 0.2; q.add(p); }
  // thân tượng: áo dài xoè dưới, thon dần lên vai
  const robe = (y: number, h: number, r0: number, r1: number, c = WHITE) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 16), (ball(c, 0, 0, 0, 1).material as THREE.Material)); m.position.set(0, y + h / 2, 0); return m; };
  q.add(robe(10, 20, 9.4, 7.4), robe(30, 16, 7.4, 6.2, WH2), robe(46, 8, 6.2, 6.8), ball(WHITE, 0, 55, 0, 7.2, 3.4, 5.4), cyl(WHITE, 0, 58.2, 0, 2.2, 3), ball(WHITE, 0, 62, 0.3, 3.8, 4.4, 3.8), ball(WH2, 0, 66, -0.5, 3.2, 3.6, 3.4), cone(WHITE, 0, 69.6, -0.8, 1.8, 4), ball(0xd9a83a, 0, 64.6, 3.6, 0.5, 0.5, 0.3));
  q.add(robe(40, 24, 9.2, 4.4, WH2).translateZ(-1.6), ball(0xe2d9c8, 0, 61.6, 3.1, 2.3, 2.9, 1.2));
  // tay phải bắt ấn giơ lên, tay trái cầm bình cam lồ
  q.add(cyl(WHITE, -7.4, 47, 2.4, 1.7, 10).rotateZ(-0.2), cyl(WHITE, -7.2, 50.6, 5.4, 1.3, 7).rotateX(1.0), ball(WHITE, -7.2, 54.4, 7.2, 1.4, 2.2, 1.0), cyl(WHITE, 7.4, 47, 2.4, 1.7, 10).rotateZ(0.2), cyl(WHITE, 6.4, 43.4, 6, 1.3, 7).rotateX(1.4), ball(WH2, 5.8, 44.6, 9, 1.5, 2.2, 1.5), cyl(WH2, 5.8, 47.4, 9, 0.6, 2));
  for (let i = 0; i < 9; i++) q.add(box(WH2, -6 + i * 1.5, 12 + (i % 3) * 5, 8.6 - Math.abs(i - 4) * 0.5, 0.5, 26, 0.5));
  q.add(box(0x4a2c1c, 0, 5.4, 12.5, 4, 5, 0.3), box(glow(0xffb347), 0, 5.2, 12.7, 2.6, 4, 0.1));
  kit.add(q, stairs(0xcfc8b8, V(QX, Y0, QZ + 30), V(QX, Y0 + 3, QZ + 20), 12, 9)); kit.live(label('Tượng Quan Thế Âm · 67 m', QX, Y0 + 80, QZ, '#5a6a7a', 2.4));
  for (let i = 0; i < 7; i++) kit.add(lampPost(QX - 21 + i * 7, Y0, QZ + 31, 3.6, 0xfff0c0));
  // ---- lối mòn ngắm voọc: rừng rậm phía đông, voọc ngồi trên cành
  const TX = 96, TZ = -8;
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 8 + r() * 22, tx = TX + Math.cos(a) * d, tz = TZ + Math.sin(a) * d * 0.8; if (tz > TZ - 4 && tz < TZ + 22 && Math.abs(tx - TX - 2) < 14) continue; const t = tree(r, 2 + r() * 1.4, r() < 0.6); t.position.set(tx, Y0, tz); kit.add(t); }
  const big = grp(TX + 5, Y0, TZ - 6); big.add(cyl(0x6a5038, 0, 4.5, 0, 0.7, 9), ball(0x3f7a4e, 0, 12, -1, 6, 4, 5), ball(0x4f8a52, -3, 10.6, -1, 4, 3, 4), box(0x6a5038, -2.6, 4.1, 2.0, 5.4, 0.4, 0.5, 0.1), box(0x6a5038, 2.8, 5.0, 2.4, 5, 0.36, 0.46, -0.1)); kit.add(big);
  const troop: THREE.Group[] = [];
  for (const [x, y, z, ry] of [[-3.4, 4.3, 2.2, 0.5], [-1.5, 5.0, 1.7, 0.2], [2.2, 5.6, 2.2, -0.3], [3.8, 5.0, 2.8, -0.7], [-0.4, 0, 4.6, 0.1]] as const) { const d = douc(); d.scale.setScalar(1.9); d.position.set(TX + 5 + x, Y0 + y, TZ - 6 + z); d.rotation.y = ry; troop.push(d); kit.live(d); }
  kit.onTick((t) => troop.forEach((d, i) => { d.rotation.z = Math.sin(t * 1.4 + i * 2) * 0.07; d.position.y += Math.sin(t * 2 + i) * 0.0015; }));
  kit.live(label('Voọc chà vá chân nâu', TX + 5, Y0 + 15.5, TZ - 6, '#3f7a4e', 0.9));
  // ---- điểm vọng cảnh: mỏm đá nhô ra phía nam, có lan can
  const PX = 120, PZ = 40;
  kit.add(cyl(0x8a8f88, PX, Y0 / 2, PZ, 9, Y0, 8), cyl(0xcfc8b8, PX, Y0 + 0.05, PZ, 8.4, 0.1, 7.4), rock(0x7d857f, PX + 8, 3, PZ + 6, 7, 8, 6, 1), rock(0x8a8f88, PX - 9, 4, PZ + 4, 6, 9, 6, 2));
  for (let i = 0; i < 11; i++) { const a = 0.3 + i * 0.25; kit.add(box(0xf4f1ea, PX + Math.cos(a) * 8, Y0 + 0.6, PZ + Math.sin(a) * 7, 0.2, 1.2, 0.2), box(0xf4f1ea, PX + Math.cos(a + 0.12) * 8, Y0 + 1.15, PZ + Math.sin(a + 0.12) * 7, 0.16, 0.16, 2.1, -a - 0.12 + Math.PI / 2)); }
  kit.add(box(0x6b4a2c, PX - 4, Y0 + 0.5, PZ - 3, 3, 0.2, 0.8), box(0x6b4a2c, PX - 4, Y0 + 0.25, PZ - 3, 0.2, 0.5, 0.6)); kit.live(label('Điểm vọng cảnh', PX, Y0 + 5.6, PZ - 6, '#3f7a4e', 0.8));

  const path = [V(-50, Y0 - 8, 70), V(0, Y0 - 8, 70), V(0, Y0 - 8, 64), V(0, Y0, 44), V(0, Y0, 30), V(-8, Y0, 14), V(QX + 10, Y0, QZ + 38), V(0, Y0, -2), V(30, Y0, 0), V(70, Y0, 2), V(TX - 4, Y0, TZ + 4), V(TX + 6, Y0, TZ + 8), V(110, Y0, 20), V(PX, Y0, PZ - 2), V(PX, Y0, PZ + 3)];
  kit.pave(0xb9a98f, path, 3.6, 8);
  return {
    path, half: 2.2, npcs: 10,
    extras: [
      { frac: 0.2, kind: 'ngam_canh', name: 'Ngắm vịnh Đà Nẵng', fact: 'Bán đảo Sơn Trà nhô ra biển như một bức bình phong chắn gió cho vịnh Đà Nẵng; rừng ở đây là khu bảo tồn thiên nhiên.' },
      { frac: 0.45, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: 'Tượng Quan Thế Âm ở chùa Linh Ứng Bãi Bụt cao 67 m, đứng trên toà sen, bên trong có 17 tầng.', q: 'Tượng Quan Thế Âm ở chùa Linh Ứng Sơn Trà cao bao nhiêu mét?', options: ['37 m', '67 m', '97 m'], answer: 1 },
    ],
    stops: [
      { id: 'duong_ven_bien', at: V(-34, Y0 - 8, 70), look: V(-200, 0, 300) },
      { id: 'cong_chua', at: V(0, Y0 - 8, 62), look: V(0, Y0 + 7, 40) },
      { id: 'tuong_quan_am', at: V(0, Y0, 31), look: V(QX, Y0 + 50, QZ) },
      { id: 'voc', at: V(TX + 5, Y0, TZ + 7.6), look: V(TX + 5, Y0 + 4.6, TZ - 4) },
      { id: 'vong_canh', at: V(PX, Y0, PZ + 2), look: V(-60, 0, 500) },
    ],
    sky: [0x5aaeec, 0xeaf5fb], fog: [0xd6e9f4, 140, 1100],
    light: { ambient: 1.55, sun: 1.6, sunColor: 0xfff4dc, sunDir: [0.4, 0.9, 0.6] },
  };
}
