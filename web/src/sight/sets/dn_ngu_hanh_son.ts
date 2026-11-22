// Ngũ Hành Sơn (ngọn Thuỷ Sơn). Trục x: tây → đông (biển Non Nước ở phía đông); trục z: bắc → nam.
// Làng đá Non Nước dưới chân núi phía nam; lên 156 bậc đá tới chùa Tam Thai; vào động Huyền Không trong lòng núi;
// ra Vọng Hải Đài nhìn biển; xuống núi theo cổng phía đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, glow, grp, label, lampPost, mountain, palm, person, rock, signPost, stairs, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const ROCK = 0x8f9690, ROCK2 = 0x7d857f, ROCK3 = 0xa3aaa2, WHITE = 0xf2efe8, TOP = 24;
/** Tượng đá trắng của làng nghề: 0 Phật ngồi, 1 Quan Âm đứng, 2 sư tử đá, 3 bình đá. */
function statue(kind: number, s = 1): THREE.Group {
  const g = new THREE.Group(); g.add(box(0xd8d4ca, 0, 0.25 * s, 0, 1.3 * s, 0.5 * s, 1.3 * s));
  if (kind === 0) g.add(ball(WHITE, 0, 0.8 * s, 0, 0.75 * s, 0.4 * s, 0.6 * s), ball(WHITE, 0, 1.4 * s, 0, 0.5 * s, 0.6 * s, 0.4 * s), ball(WHITE, 0, 2.15 * s, 0, 0.32 * s), bead(WHITE, 0, 2.5 * s, 0, 0.14 * s));
  else if (kind === 1) g.add(cone(WHITE, 0, 1.7 * s, 0, 0.55 * s, 2.6 * s), ball(WHITE, 0, 2.9 * s, 0, 0.36 * s, 0.4 * s, 0.34 * s), ball(WHITE, 0, 3.2 * s, 0, 0.3 * s), cone(WHITE, 0, 3.6 * s, 0, 0.26 * s, 0.5 * s));
  else if (kind === 2) g.add(ball(WHITE, 0, 0.95 * s, 0.1 * s, 0.5 * s, 0.5 * s, 0.75 * s), ball(WHITE, 0, 1.55 * s, -0.5 * s, 0.42 * s), ball(WHITE, 0, 1.5 * s, -0.5 * s, 0.56 * s, 0.5 * s, 0.3 * s), cyl(WHITE, -0.25 * s, 0.7 * s, -0.5 * s, 0.14 * s, 0.6 * s), cyl(WHITE, 0.25 * s, 0.7 * s, -0.5 * s, 0.14 * s, 0.6 * s));
  else g.add(ball(WHITE, 0, 1.2 * s, 0, 0.6 * s, 0.75 * s, 0.6 * s), cyl(WHITE, 0, 2.05 * s, 0, 0.26 * s, 0.5 * s), cyl(WHITE, 0, 2.3 * s, 0, 0.4 * s, 0.1 * s));
  return g;
}
function pagoda(w: number, d: number, name: string): THREE.Group {
  const g = new THREE.Group(), RED = 0xa8322a, TILE = 0x9a5a3a;
  g.add(box(0x9a938a, 0, 0.3, 0, w + 2.4, 0.6, d + 2.4), box(0xf1e3b8, 0, 2.6, 0, w, 4, d), templeRoof(TILE, 0, 4.6, 0, w + 3, 1.9, d + 3, 0x6a3a2a), box(0xf1e3b8, 0, 6.9, 0, w * 0.5, 1.2, d * 0.5), templeRoof(TILE, 0, 7.5, 0, w * 0.66 + 1.4, 1.5, d * 0.66 + 1.4, 0x6a3a2a));
  for (let i = 0; i < 4; i++) g.add(cyl(RED, -w / 2 + 0.6 + i * (w - 1.2) / 3, 2.6, d / 2 + 0.7, 0.24, 4));
  g.add(box(0x4a2c1c, 0, 2.0, d / 2 + 0.03, 2.2, 2.9, 0.1), box(glow(0xffb347), 0, 2.0, d / 2 + 0.07, 1.4, 2.4, 0.06), box(RED, 0, 4.3, d / 2 + 0.78, 3, 0.7, 0.1), box(0xd9a83a, 0, 4.3, d / 2 + 0.84, 2.4, 0.36, 0.04));
  void name; return g;
}
export function nguHanhSon(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.add(box(0xd9cf9c, -120, -0.5, 0, 420, 1, 700), box(0xf0e3b4, 110, -0.5, 0, 46, 1, 700)); // đất liền và bãi cát Non Nước
  kit.water(0x3fa9c9, 380, 0, 500, 900, -0.25, 1);
  for (let z = -300; z < 300; z += 9) kit.add(box(0xffffff, 133 + Math.sin(z) * 1.5, -0.2, z, 2.2, 0.1, 7));
  // bốn ngọn còn lại: Kim Sơn, Thổ Sơn ở phía tây bắc, Hoả Sơn ở tây nam, Mộc Sơn ở phía đông nam gần biển
  const peaks: [string, number, number, number, number][] = [['Kim Sơn', -190, -150, 46, 60], ['Thổ Sơn', -230, -20, 70, 40], ['Hoả Sơn', -150, 150, 50, 70], ['Mộc Sơn', 60, 150, 36, 54]];
  for (const [name, x, z, rad, h] of peaks) { kit.add(mountain(ROCK2, x, z, rad, h, r), cyl(ROCK, x, h * 0.25, z, rad * 0.8, h * 0.5)); for (let i = 0; i < 14; i++) kit.add(bead(0x4f8a52, x + (r() - 0.5) * rad, h * (0.3 + r() * 0.4), z + (r() - 0.5) * rad, 5 + r() * 5)); kit.live(label(name, x, h + 12, z, '#5a6a5a', 3.2)); }
  // ---- thân núi Thuỷ Sơn: vách đá vôi dựng đứng, mặt bằng trên núi ở cao độ TOP, các chỏm đá và cây phủ
  kit.add(cyl(ROCK, 4, TOP / 2, -18, 44, TOP, 40), cyl(ROCK2, 4, TOP * 0.3, -18, 49, TOP * 0.6, 45), cyl(ROCK3, 4, TOP * 0.12, -18, 54, TOP * 0.24, 50));
  for (let i = 0; i < 46; i++) { const a = r() * 6.28, d = 40 + r() * 10; kit.add(rock([ROCK, ROCK2, ROCK3][i % 3], 4 + Math.cos(a) * d, 4 + r() * 16, -18 + Math.sin(a) * d * 0.9, 5 + r() * 5, 6 + r() * 8, 5 + r() * 5, r() * 3)); }
  for (let i = 0; i < 80; i++) { const a = r() * 6.28, d = 38 + r() * 16; kit.add(bead(i % 2 ? 0x4f8a52 : 0x66a864, 4 + Math.cos(a) * d, 3 + r() * 20, -18 + Math.sin(a) * d * 0.9, 2.5 + r() * 3)); }
  // chỏm núi chứa động Huyền Không (rỗng bên trong) và các chỏm khác
  const CX = -6, CZ = -40;
  kit.add(cyl(ROCK2, CX, TOP + 12, CZ, 19, 24, 18), cone(ROCK, CX + 3, TOP + 30, CZ - 2, 15, 16), cone(ROCK3, CX - 8, TOP + 26, CZ + 4, 9, 14));
  kit.add(cone(ROCK2, -30, TOP + 9, -6, 9, 22), cone(ROCK, 30, TOP + 6, -42, 8, 16), cone(ROCK3, -24, TOP + 5, 12, 6, 12));
  for (let i = 0; i < 40; i++) kit.add(bead(i % 2 ? 0x4f8a52 : 0x66a864, CX + (r() - 0.5) * 40, TOP + 20 + r() * 20, CZ + (r() - 0.5) * 36, 2 + r() * 3));
  kit.add(box(0xb9b09a, 4, TOP + 0.02, -6, 60, 0.1, 40));
  // ---- làng đá mỹ nghệ Non Nước (chân núi phía nam)
  kit.add(box(0x9a938a, 0, 0.03, 62, 60, 0.1, 9));
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    const x = -24 + i * 6 + (s > 0 ? 3 : 0); if (Math.abs(x) < 3.5) continue;
    kit.add(box(0xe9dcc0, x, 1.8, 62 + s * 10, 5.4, 3.6, 6), gable(0xa85a3a, x, 3.6, 62 + s * 10, 6.6, 1.5, 6, Math.PI / 2), box(0x3a3a3a, x, 1.4, 62 + s * 7.02, 3.4, 2.8, 0.1));
    const st = statue(i % 4, 0.8 + r() * 0.5); st.position.set(x - 1.2, 0, 62 + s * 5.6); st.rotation.y = s > 0 ? Math.PI : 0; kit.add(st);
    const st2 = statue((i + 2) % 4, 0.6 + r() * 0.4); st2.position.set(x + 1.4, 0, 62 + s * 5.9); st2.rotation.y = s > 0 ? Math.PI : 0; kit.add(st2);
  }
  const big = statue(1, 2.4); big.position.set(-9, 0, 50); kit.add(big); const lion = statue(2, 1.6); lion.position.set(8, 0, 50); lion.rotation.y = Math.PI; kit.add(lion);
  const carver = person(2, 1); carver.position.set(6, 0, 55.6); kit.add(carver, box(WHITE, 7.2, 0.5, 55.6, 1, 1, 1));
  kit.live(label('Làng đá mỹ nghệ Non Nước', 0, 7.6, 66, '#5a6a5a', 0.9));
  // ---- 156 bậc đá lên cổng Tam Thai
  kit.add(stairs(0xb9b09a, V(0, 0, 44), V(0, TOP, 14), 5, 40));
  for (const s of [-1, 1]) { kit.add(box(ROCK3, s * 2.9, TOP / 2 - 2, 29, 0.8, TOP + 3, 31).rotateX(0)); for (let i = 0; i < 6; i++) kit.add(rock(ROCK2, s * (4.6 + r() * 3), i * 4, 42 - i * 5, 2.5, 3.5, 3, r() * 3), bead(0x4f8a52, s * (4.4 + r() * 2), 2 + i * 4, 40 - i * 5, 2)); }
  kit.add(box(0xa8322a, -2.6, TOP + 2.4, 13, 0.7, 4.8, 0.7), box(0xa8322a, 2.6, TOP + 2.4, 13, 0.7, 4.8, 0.7), templeRoof(0x9a5a3a, 0, TOP + 4.8, 13, 8.4, 1.4, 2.6, 0x6a3a2a));
  kit.add(signPost('156 bậc đá', 3.4, 0, 46, '#5a6a5a', 0.9));
  // ---- chùa Tam Thai trên mặt bằng núi
  const tt = pagoda(12, 8, 'Tam Thai'); tt.position.set(-14, TOP, 2); tt.rotation.y = Math.PI / 2; kit.add(tt); kit.live(label('Chùa Tam Thai', -14, TOP + 11.6, 2, '#a8322a', 0.9));
  kit.add(cyl(0x7a7a72, -3, TOP + 0.6, 2, 0.9, 1.2), cyl(0x5a5a54, -3, TOP + 1.4, 2, 1.1, 0.4), box(0xa8322a, -3, TOP + 2.0, 2, 0.5, 0.9, 0.5));
  for (const [x, z] of [[-22, 12], [10, 6], [16, -8], [-20, -10], [22, 6]] as const) { const t = tree(r, 1.2, r() < 0.5); t.position.set(x, TOP, z); kit.add(t); }
  for (let i = 0; i < 5; i++) kit.add(lampPost(-8 + i * 5, TOP, 9.6, 3));
  // ---- động Huyền Không: vòm hang tối, lỗ thông thiên rọi nắng, tượng Phật trong hốc đá
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: 0x4f4a48, roughness: 1, side: THREE.BackSide })); dome.position.set(CX, TOP - 2, CZ); dome.scale.set(16, 20, 15.5); kit.live(dome);
  kit.add(box(0x6b645e, CX, TOP + 0.06, CZ, 34, 0.14, 33));
  kit.add(box(0x2a2624, -2, TOP + 2.6, -24.2, 5.4, 5.2, 1.6), box(ROCK2, -5.2, TOP + 2.8, -24, 1.4, 5.6, 2.2), box(ROCK2, 1.2, TOP + 2.8, -24, 1.4, 5.6, 2.2), box(ROCK, -2, TOP + 5.8, -24, 8, 1.2, 2.4));
  kit.live(label('Động Huyền Không', -2, TOP + 8.2, -22.6, '#4a4440', 0.9));
  const buddha = statue(0, 2.6); buddha.position.set(CX - 4, TOP + 3, CZ - 11.5); kit.add(buddha, box(0x5a544e, CX - 4, TOP + 1.5, CZ - 11.5, 6, 3, 4), ball(glow(0xffd98a), CX - 4, TOP + 6.6, CZ - 13.6, 3.2, 3.6, 0.3));
  kit.add(box(0x6a2a22, CX + 7, TOP + 1.2, CZ - 9, 3, 2.4, 2), templeRoof(0x9a5a3a, CX + 7, TOP + 2.4, CZ - 9, 4.4, 1.0, 3.2, 0x6a3a2a), box(glow(0xffb347), CX + 7, TOP + 1.2, CZ - 7.96, 1.4, 1.6, 0.06), cyl(0x8a7a5a, CX + 2, TOP + 0.6, CZ - 4, 0.6, 1.2), bead(glow(0xff8a3d), CX + 2, TOP + 1.4, CZ - 4, 0.16));
  for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 6 + r() * 8; kit.add(cone(0x5f5a56, CX + Math.cos(a) * d, TOP + 15 - r() * 3, CZ + Math.sin(a) * d, 0.5 + r() * 0.6, 3 + r() * 4).rotateX(Math.PI)); }
  for (let i = 0; i < 10; i++) { const a = r() * 6.28; kit.add(rock(0x5f5a56, CX + Math.cos(a) * 14, TOP + 2, CZ + Math.sin(a) * 13.5, 3, 4.5, 3, r() * 3)); }
  const shaftM = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z, t] of [[CX - 3, CZ - 5, 0.16], [CX + 5, CZ + 2, -0.12], [CX - 7, CZ + 4, 0.06]] as const) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.6, 18, 12, 1, true), shaftM); sh.position.set(x, TOP + 9, z); sh.rotation.z = t; kit.live(sh, new THREE.Mesh(new THREE.CircleGeometry(1.3, 12).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfffbe0 })).translateX(x - t * 9).translateY(TOP + 17.6).translateZ(z)); kit.add(cyl(glow(0xfff2c0), x + t * 9, TOP + 0.16, z, 2.4, 0.04)); }
  kit.motes(70, 0xfff2c0, 0.35, () => V(CX + (r() - 0.5) * 16, TOP + 1 + r() * 12, CZ + (r() - 0.5) * 14), (p, i, t) => { p.y += Math.sin(t * 0.6 + i) * 0.004; });
  // ---- Vọng Hải Đài: đài ngắm biển phía đông, có bia đá
  kit.add(stairs(0xb9b09a, V(14, TOP, -22), V(30, TOP + 6, -16), 3.6, 16), cyl(0xb9b09a, 36, TOP + 3, -14, 7, 6.1), cyl(ROCK2, 36, TOP - 2, -14, 9, 12));
  for (let i = 0; i < 12; i++) { const a = -1.2 + i * 0.22; kit.add(box(0xd8d4ca, 36 + Math.cos(a) * 6.6, TOP + 6.6, -14 + Math.sin(a) * 6.6, 0.3, 1.1, 0.3), box(0xd8d4ca, 36 + Math.cos(a + 0.11) * 6.6, TOP + 7.1, -14 + Math.sin(a + 0.11) * 6.6, 0.24, 0.16, 1.6, -a - 0.11)); }
  kit.add(box(0x7a7a72, 39, TOP + 7.2, -17, 1.2, 2.2, 0.4, 0.5), box(0x5a5a54, 39, TOP + 6.2, -17, 1.6, 0.4, 0.8, 0.5)); kit.live(label('Vọng Hải Đài', 30, TOP + 12.5, -20, '#5a6a5a', 0.7), label('Biển Non Nước', 150, 12, -14, '#2a7f9a', 5));
  for (let z = -200; z < 220; z += 16) { const p = palm(r, 7); p.position.set(96 + r() * 8, 0, z); kit.add(p); if (r() < 0.5) kit.add(box(0xf2efe8, 104 + r() * 6, 3, z + 6, 10, 6 + r() * 10, 12)); }
  // ---- xuống núi theo cổng phía đông
  kit.add(stairs(0xb9b09a, V(42, TOP + 6, -8), V(70, 0, 8), 4, 40), box(0xa8322a, 68, 2.4, 6, 0.7, 4.8, 0.7), box(0xa8322a, 72.4, 2.4, 10.4, 0.7, 4.8, 0.7), templeRoof(0x9a5a3a, 70.2, 4.8, 8.2, 8.4, 1.4, 2.6, 0x6a3a2a).rotateY(-0.5));
  for (let i = 0; i < 8; i++) kit.add(rock(ROCK2, 46 + i * 3.4 + (i % 2 ? 4 : -4), TOP - i * 3.6, -8 + i * 2 + (i % 2 ? -4 : 5), 3, 4, 3, r() * 3));
  kit.add(box(0x9a938a, 80, 0.03, 12, 22, 0.1, 9)); kit.live(label('Cổng xuống núi', 70.2, 8.4, 8.2, '#a8322a', 0.8));

  const path = [V(0, 0, 74), V(0, 0, 62), V(0, 0, 44), V(0, TOP, 14), V(0, TOP, 4), V(-4, TOP, -10), V(-2, TOP, -24), V(CX + 1, TOP, CZ + 6), V(CX - 1, TOP, CZ - 4), V(CX + 6, TOP, CZ + 4), V(4, TOP, -26), V(14, TOP, -22), V(30, TOP + 6, -16), V(37, TOP + 6, -13), V(42, TOP + 6, -8), V(70, 0, 8), V(84, 0, 12)];
  return {
    path, half: 1.9, npcs: 9, startYaw: 0,
    stops: [
      { id: 'lang_da', at: V(0, 0, 66), look: V(-9, 5, 50) },
      { id: 'bac_da', at: V(0, 0, 46), look: V(0, TOP, 14) },
      { id: 'tam_thai', at: V(0, TOP, 5), look: V(-12, TOP + 4, 2) },
      { id: 'huyen_khong', at: V(CX - 0.6, TOP, CZ - 2), look: V(CX - 4, TOP + 6, CZ - 11) },
      { id: 'vong_hai', at: V(36.4, TOP + 6, -13.4), look: V(160, 0, -6) },
      { id: 'loi_ra', at: V(80, 0, 11), look: V(60, 14, 2) },
    ],
    sky: [0x6fb6ee, 0xeef6fb], fog: [0xdbeaf2, 90, 620],
    light: { ambient: 1.5, sun: 1.6, sunColor: 0xfff4dc, sunDir: [0.6, 0.9, 0.4] },
  };
}
