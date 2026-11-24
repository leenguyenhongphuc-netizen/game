// Cầu Rồng – sông Hàn ban đêm. Trục x: tây → đông (biển ở phía đông); trục z: bắc → nam. Sông Hàn chảy bắc–nam ở giữa.
// Đi từ bờ tây (đường Bạch Đằng) gần cầu sông Hàn ở phía bắc, xuôi về nam, lên Cầu Rồng đi sang bờ đông tới đầu rồng,
// rồi ngược lên bắc theo bờ đông tới tượng cá chép hoá rồng và cầu tàu Tình yêu.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, bench, bicycle, bin, boat, box, cone, cyl, flag, glow, grp, label, lampPost, palm, potPlant, reflection, stairs, tree, wayPost } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const GOLD = 0xffc530, W = 62; // nửa bề rộng sông
function tower(r: () => number, w: number, h: number, c: number): THREE.Group {
  const g = new THREE.Group(); g.add(box(c, 0, h / 2, 0, w, h, w));
  const lit = [0xffe9a8, 0xbfe6ff, 0xffd98a][Math.floor(r() * 3)];
  for (let y = 3; y < h - 2; y += 3.2) for (const s of [-1, 1]) if (r() < 0.75) g.add(box(glow(lit), (r() - 0.5) * w * 0.3, y, s * (w / 2 + 0.03), w * (0.3 + r() * 0.5), 1.2, 0.06), box(glow(lit), s * (w / 2 + 0.03), y, (r() - 0.5) * w * 0.3, 0.06, 1.2, w * (0.3 + r() * 0.5)));
  if (h > 40) g.add(box(glow([0xff5a7a, 0x6ec8ff, 0xffc530][Math.floor(r() * 3)]), 0, h + 0.4, 0, w * 0.9, 0.5, w * 0.9));
  return g;
}
export function cauRong(kit: Kit, _s: Sight): SightSet {
  const r = kit.r, DECK = 9;
  kit.add(box(0x5a6274, -W - 150, -1.5, 0, 300, 3, 700), box(0x5a6274, W + 150, -1.5, 0, 300, 3, 700));
  kit.water(0x1f6aa8, 0, 0, W * 2 + 2, 700, -1.2, 1); // nước xanh lam sáng, tách hẳn khỏi kè đá xám và thân rồng vàng
  // kè đá, lan can, đèn và hàng cây hai bờ
  for (const s of [-1, 1]) {
    kit.add(box(0xb5ad9c, s * (W + 0.2), -0.3, 0, 0.8, 1.2, 700), box(0xc9c0ae, s * (W + 5), 0.03, 0, 9, 0.1, 700), box(0x3a3f4a, s * (W + 16), 0.02, 0, 12, 0.08, 700), box(0xf4f1ea, s * (W + 0.4), 0.95, 0, 0.14, 0.14, 700));
    for (let z = -240; z < 240; z += 6) kit.add(box(0xa89f8e, s * (W + 5), 0.085, z, 9, 0.02, 0.08), box(0xf3ead2, s * (W + 16), 0.07, z, 0.16, 0.02, 2.4));
    // đèn bờ sông và phố xá hắt xuống mặt nước
    for (let z = -235; z < 240; z += 14) kit.add(reflection([0xfff0c0, 0xff6ad0, 0x6ec8ff, 0xffc530][Math.abs(Math.round(z / 14)) % 4], s * (W - 9), -1.14, z, 1.2, 16, true, 0.22));
    for (let z = -240; z < 240; z += 3) kit.add(box(0xf4f1ea, s * (W + 0.4), 0.5, z, 0.12, 0.9, 0.12));
    for (let z = -235; z < 240; z += 14) { kit.add(lampPost(s * (W + 1.6), 0, z, 4.6, 0xfff0c0)); if (Math.abs(z) > 12) { const t = r() < 0.5 ? palm(r, 6) : tree(r, 1, true); t.position.set(s * (W + 9.4), 0, z + 6); kit.add(t); } }
    // phố xá sáng đèn
    for (let z = -250; z < 250; z += 15 + r() * 8) { if (Math.abs(z) < 14) continue; const h = 12 + r() * r() * 80, w = 9 + r() * 5; const t = tower(r, w, h, [0x3c4458, 0x4a5068, 0x55586a][Math.floor(r() * 3)]); t.position.set(s * (W + 28 + r() * 6), 0, z); kit.add(t); if (r() < 0.6) { const t2 = tower(r, 10, 20 + r() * 70, 0x343a4c); t2.position.set(s * (W + 52 + r() * 20), 0, z + 5); kit.add(t2); } }
  }
  // vòng quay Mặt Trời xa phía nam bờ tây
  const wheel = grp(-W - 60, 46, 300); wheel.add(new THREE.Mesh(new THREE.TorusGeometry(38, 0.7, 6, 40), glow(0xff5ad0))); for (let i = 0; i < 12; i++) wheel.add(box(glow(0x6ec8ff), 0, 0, 0, 76, 0.3, 0.3).rotateZ(i * Math.PI / 12));
  kit.live(wheel); kit.onTick((t) => { wheel.rotation.z = t * 0.05; }); kit.add(box(0x555a68, -W - 60, 22, 300, 3, 46, 3));

  // ---- cầu sông Hàn (phía bắc, z = -150): cầu dây văng, trụ tháp giữa sông, dây và lan can phát sáng
  const sh = grp(0, 0, -150);
  sh.add(box(0xf4f6fa, 0, 4.2, 0, W * 2 + 30, 0.9, 12), box(0x4a5262, 0, 4.68, 0, W * 2 + 30, 0.06, 8)); for (const x of [-40, 0, 40]) sh.add(box(0xd9dee6, x, 1.4, 0, 5, 5.2, 9));
  for (const s of [-1, 1]) { sh.add(box(0xe8ecf2, 0, 20, s * 4.6, 2.4, 32, 1.6), box(glow(0x6ec8ff), 0, 5.4, s * 6, W * 2 + 30, 0.25, 0.2)); for (let i = 1; i <= 7; i++) for (const d of [-1, 1]) { const x = d * i * 7.4, len = Math.hypot(x, 31 - i * 3.2), c = box(glow([0xff6ad0, 0x7ad8ff, 0xfff0a0][i % 3]), x / 2, 4.6 + (31 - i * 3.2) / 2, s * 4.6, len, 0.16, 0.16); c.rotation.z = -Math.atan2(31 - i * 3.2, x); sh.add(c); } }
  sh.add(box(0xe8ecf2, 0, 36, 0, 2.4, 1.6, 11));
  kit.add(sh); kit.live(label('Cầu sông Hàn', 0, 42, -150, '#2a5f9a', 2.2));

  // ---- Cầu Rồng (z = 0): mặt cầu vồng nhẹ, rồng thép vàng uốn ba nhịp chạy giữa cầu, đầu ở bờ ĐÔNG hướng ra biển
  const yDeck = (x: number) => DECK * Math.max(0, 1 - (x / (W + 34)) ** 2);
  for (let i = -24; i < 24; i++) { const x0 = i * 4, x1 = x0 + 4, xm = x0 + 2, y = yDeck(xm); const d = box(0xaeb6c2, xm, y - 0.4, 0, 4.1, 0.8, 22); kit.add(box(0x4a5262, xm, y + 0.02, 0, 4.1, 0.06, 12.6).rotateZ(Math.atan2(yDeck(x1) - yDeck(x0), 4))); d.rotation.z = Math.atan2(yDeck(x1) - yDeck(x0), 4); kit.add(d); for (const s of [-1, 1]) { kit.add(box(0xf4f1ea, xm, y + 1.0, s * 10.8, 4.1, 0.12, 0.12), box(0xf4f1ea, xm, y + 0.5, s * 10.8, 0.12, 1.0, 0.12), box(0xd3cdbf, xm, y + 0.06, s * 8.6, 4.1, 0.12, 4.2)); if (i % 3 === 0) kit.add(bead(glow(0xfff0c0), xm, y + 1.3, s * 10.8, 0.22)); } }
  for (const x of [-W + 14, -20, 20, W - 14]) kit.add(box(0x8f98a6, x, yDeck(x) / 2 - 1.4, 0, 5, yDeck(x) + 1.6, 16), box(0x7a8494, x, -0.6, 0, 9, 1.6, 20));
  // thân rồng: đường cong y(x) gồm nhịp giữa cao và hai nhịp bên thấp hơn
  const L = W + 26, bodyY = (x: number) => yDeck(x) + 2.2 + Math.max(0, Math.sin(((x + L) / (2 * L)) * Math.PI * 3)) * (Math.abs(x) < L / 3 ? 21 : 12) + (Math.sin(((x + L) / (2 * L)) * Math.PI * 3) < 0 ? Math.sin(((x + L) / (2 * L)) * Math.PI * 3) * 1.6 : 0);
  const N = 84, body = new THREE.Group();
  for (let i = 0; i < N; i++) {
    const x0 = -L + (i / N) * 2 * L, x1 = -L + ((i + 1) / N) * 2 * L, y0 = bodyY(x0), y1 = bodyY(x1), len = Math.hypot(x1 - x0, y1 - y0), th = 1.5 - Math.abs(i - N / 2) / N * 0.7;
    const sgm = cyl(glow(i % 6 === 0 ? 0xffe680 : GOLD), (x0 + x1) / 2, (y0 + y1) / 2, 0, th, len * 1.12); sgm.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; body.add(sgm);
    if (i % 2 === 0) { const f = cone(glow(0xff9a2a), (x0 + x1) / 2, (y0 + y1) / 2 + th + 0.5, 0, 0.5, 1.5, 0.22); f.rotation.z = Math.atan2(y1 - y0, x1 - x0) + 0.5; body.add(f); }
    if (i % 3 === 0 && (y0 + y1) / 2 - yDeck((x0 + x1) / 2) > 5) for (const s of [-1, 1]) body.add(box(0xcfd6e0, (x0 + x1) / 2, ((y0 + y1) / 2 + yDeck((x0 + x1) / 2)) / 2, s * 0.9, 0.12, (y0 + y1) / 2 - yDeck((x0 + x1) / 2), 0.12));
  }
  // đuôi (bờ tây) xoè như cánh sen, đầu rồng (bờ đông) há miệng, sừng, râu, mắt đỏ
  const tail = grp(-L - 2, bodyY(-L) + 1, 0); for (let i = 0; i < 5; i++) { const f = cone(glow(i % 2 ? GOLD : 0xff9a2a), 0, 2.4, 0, 0.9, 5.4, 0.3); f.position.set(-1.5, 2.4 - Math.abs(i - 2) * 0.5, 0); f.rotation.z = 0.7 + (i - 2) * 0.32; tail.add(f); } body.add(tail);
  const head = grp(L + 2.5, bodyY(L) + 2.6, 0);
  head.add(ball(glow(GOLD), 0, 1.2, 0, 2.6, 2.1, 2.0), box(glow(GOLD), 3.1, 1.9, 0, 3.6, 1.0, 2.4), box(glow(0xffe680), 2.9, -0.2, 0, 3.0, 0.7, 2.0), box(glow(0xc0281e), 2.6, 0.8, 0, 2.6, 0.8, 1.5), ball(glow(GOLD), 4.6, 2.5, 0, 0.7, 0.6, 1.1));
  for (const s of [-1, 1]) { head.add(ball(glow(0xff2a2a), 1.4, 2.4, s * 1.5, 0.45), cone(glow(0xffe680), -1.4, 4.0, s * 1.1, 0.32, 3.6).rotateZ(0.7), cone(glow(0xff9a2a), -1.6, 2.2, s * 2.3, 0.4, 2.6).rotateZ(1.2), cyl(glow(0xffe680), 5.6, 1.2, s * 1.2, 0.08, 3.2).rotateZ(-1.0)); for (let i = 0; i < 4; i++) head.add(cone(0xffffff, 1.9 + i * 0.7, 1.2, s * 0.9, 0.14, 0.5).rotateX(Math.PI)); }
  for (let i = 0; i < 5; i++) head.add(cone(glow(0xff9a2a), -2.2 - i * 0.2, 2.0 - i * 0.7, 0, 0.5, 2.6, 1.6).rotateZ(1.3));
  head.rotation.z = -0.12; body.add(head); kit.add(body);
  kit.live(label('Cầu Rồng', 0, 40, 0, '#b8322a', 3));
  // lửa phun từ miệng rồng khi tới điểm dừng đầu rồng
  let fire = 0; const mouth = V(L + 7.4, bodyY(L) + 3.2, 0);
  kit.motes(120, 0xff8a2a, 2.0, () => mouth.clone().setY(-50), (p, i, t, dt) => {
    if (fire > t) { if (p.y < -40 || p.x > mouth.x + 26) { if (r() < 0.2) p.set(mouth.x, mouth.y + (r() - 0.5), (r() - 0.5) * 1.2); } else { p.x += (14 + (i % 7)) * dt; p.y += ((i % 5) - 1.6) * 0.9 * dt; p.z += ((i % 9) - 4) * 0.5 * dt; } }
    else if (p.y > -40) { p.x += 12 * dt; if (p.x > mouth.x + 26) p.y = -50; }
  });
  let clock = 0; kit.onTick((t) => { clock = t; if (Math.floor(t / 14) % 2 === 1 && fire < t) fire = t + 5; });

  // ---- bờ đông: tượng cá chép hoá rồng (đá trắng, phun nước) và cầu tàu Tình yêu treo đèn tim đỏ
  const carp = grp(W + 4, 0, -52, -Math.PI / 2);
  carp.add(box(0x8d8478, 0, 0.6, 0, 5, 1.2, 5), cyl(0xf4f1ea, 0, 2.2, 0, 1.3, 2.2), ball(0xf4f1ea, 0, 4.4, 0, 1.6, 2.6, 1.3), ball(0xf4f1ea, 0, 7.2, 0.9, 1.3, 1.5, 1.5), box(0xf4f1ea, 0, 7.0, 2.3, 1.2, 0.5, 1.4), box(0xe6e2d8, 0, 6.4, 2.2, 1.0, 0.4, 1.2));
  for (const s of [-1, 1]) carp.add(cone(0xf4f1ea, s * 0.7, 8.9, 0.4, 0.2, 1.6).rotateX(-0.5), ball(0x3a3a3a, s * 0.8, 7.6, 1.7, 0.16), cone(0xf4f1ea, s * 1.7, 4.4, 0, 0.3, 1.8, 1.0).rotateZ(-s * 1.2));
  for (let i = 0; i < 6; i++) carp.add(cone(0xf4f1ea, 0, 3.4 + i * 0.6, -1.3 + i * 0.05, 0.3, 0.9, 0.9).rotateX(-0.7));
  carp.add(cone(0xf4f1ea, 0, 1.6, -1.6, 1.4, 2.0, 0.4).rotateX(-1.1));
  // đầu rồng: mõm dài há miệng, râu, bờm; thân có hàng vây lưng và vảy; đuôi cong lên
  carp.add(box(0xf4f1ea, 0, 7.5, 2.9, 0.9, 0.36, 1.2), box(0xe6e2d8, 0, 6.5, 2.8, 0.8, 0.3, 1.1), box(0xc0281e, 0, 6.95, 2.6, 0.5, 0.3, 0.8));
  for (const s of [-1, 1]) carp.add(cyl(0xe6e2d8, s * 0.5, 7.0, 3.2, 0.05, 1.4).rotateX(0.9).rotateZ(s * 0.5), cone(0xe6e2d8, s * 1.0, 8.0, -0.2, 0.3, 1.5, 0.12).rotateX(-0.9));
  for (let i = 0; i < 5; i++) for (let k = -1; k <= 1; k++) carp.add(cone(0xe6e2d8, k * 0.8, 3.0 + i * 0.75, 1.15 - Math.abs(k) * 0.5, 0.34, 0.5, 0.12).rotateX(2.6));
  carp.add(cone(0xf4f1ea, 0, 2.6, -2.6, 1.6, 2.6, 0.3).rotateX(-2.2), cone(0xf4f1ea, 0, 3.8, -2.2, 1.0, 2.0, 0.25).rotateX(-1.6));
  for (let i = 0; i < 10; i++) carp.add(bead(0xdfeeff, Math.cos(i * 0.63) * 2.6, 0.5, Math.sin(i * 0.63) * 2.6, 0.3, 0.5, 0.3));
  kit.add(carp); kit.live(label('Cá chép hoá rồng', W + 6, 11.4, -52, '#2a5f9a', 1.0));
  kit.motes(40, 0xbfe6ff, 0.6, () => V(W + 1.6, 6.6, -52), (p, i, t, dt) => { p.x -= (4 + (i % 4)) * dt; p.y += (2 - (p.x - W) * -0.5) * dt - 0.05; if (p.y < -1 || p.x < W - 12) p.set(W + 1.6, 6.6, -52 + (r() - 0.5) * 0.4); });
  // cầu tàu Tình yêu: vươn ra sông về phía tây
  const PZ = -84;
  kit.add(box(0x8a6a48, W - 16, 0.4, PZ, 36, 0.3, 6)); for (let i = 0; i < 6; i++) for (const s of [-1, 1]) kit.add(cyl(0x5a4a34, W - 31 + i * 6, -0.6, PZ + s * 2.6, 0.22, 2.4));
  for (const s of [-1, 1]) { kit.add(box(0xf4f1ea, W - 16, 1.5, PZ + s * 2.9, 36, 0.1, 0.1)); for (let i = 0; i < 13; i++) { kit.add(box(0xf4f1ea, W - 33 + i * 2.9, 1.0, PZ + s * 2.9, 0.1, 1.0, 0.1)); if (i % 2 === 0 && s < 0) { const hx = W - 33 + i * 2.9, hz = PZ + s * 2.9; kit.add(cyl(0x3d3a36, hx, 2.6, hz, 0.06, 3.2), bead(glow(0xff2a4a), hx - 0.28, 4.5, hz, 0.42), bead(glow(0xff2a4a), hx + 0.28, 4.5, hz, 0.42), cone(glow(0xff2a4a), hx, 3.9, hz, 0.62, 0.9, 0.36).rotateX(Math.PI)); } } }
  for (let i = 0; i < 16; i++) kit.add(box([0xd9a83a, 0xc0c4cc, 0xe2573c][i % 3], W - 30 + i * 1.7, 1.2, PZ + 2.9 + (i % 2) * 0.06, 0.3, 0.36, 0.1));
  kit.live(label('Cầu tàu Tình yêu', W - 2, 6.4, PZ, '#c0284a', 0.6));
  // du thuyền thắp đèn trên sông
  const ships: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) { const s = grp((r() - 0.5) * 70, -1.1, -110 + i * 55 + (i > 1 ? 30 : 0)); s.add(ball(0xf4f1ea, 0, 0.3, 0, 2.6, 1.0, 9), box(0xf4f1ea, 0, 1.8, 0, 3.8, 1.6, 11), box(glow([0xff6ad0, 0x6ec8ff, 0xffe680][i % 3]), 0, 2.0, 0, 3.9, 0.5, 11.1), box(0xf4f1ea, 0, 3.2, -1, 3.0, 1.2, 6), box(glow(0xffe9a8), 0, 3.3, -1, 3.06, 0.5, 6.1)); ships.push(s); kit.live(s); }
  kit.onTick((_t, dt) => ships.forEach((s, i) => { s.position.z += (i % 2 ? 1 : -1) * 1.6 * dt; if (s.position.z > 240) s.position.z = -240; if (s.position.z < -240) s.position.z = 240; if (Math.abs(s.position.z) < 6) s.position.x = Math.max(-18, Math.min(18, s.position.x)); }));
  const b = boat(0x4a7f8f, 5, true); b.position.set(-W + 9, -1.15, -60); kit.add(b);
  void clock;

  // bóng rồng vàng và dây văng hắt xuống nước
  for (let x = -54; x <= 54; x += 9) kit.add(reflection(GOLD, x, -1.14, 20, 5, 22, false, 0.2), reflection(GOLD, x, -1.14, -20, 5, 22, false, 0.2));
  for (let x = -48; x <= 48; x += 12) kit.add(reflection([0xff6ad0, 0x7ad8ff, 0xfff0a0][Math.abs(x / 12) % 3], x, -1.14, -134, 4, 18, false, 0.2));
  // chi tiết bờ sông: ghế đá, chậu hoa, xe đạp, biển chỉ đường, thùng rác, cột cờ
  for (const s of [-1, 1]) for (let z = -228; z < 232; z += 14) { if (Math.abs(z) < 34) continue; const k = Math.abs(Math.round(z / 14)) % 4, o = k === 0 ? bench(0xd8d2c4) : k === 1 ? potPlant([0xe85aa0, 0xffd23f][Math.abs(z) % 2], 1.6) : k === 2 ? bench(0x9a7150) : bin(); o.position.set(s * (W + 2.6), 0, z + 7); o.rotation.y = s * Math.PI / 2; kit.add(o); }
  for (const [x, z] of [[-W - 7.6, -170], [-W - 7.6, -40], [W + 7.6, 32], [W + 7.6, -66]] as const) { const o = wayPost(0x2a5f9a, 0xb8322a); o.position.set(x, 0, z); kit.add(o); }
  for (const [x, z] of [[-W - 8, -120], [W + 8, -30]] as const) { const o = bicycle(0xe2573c); o.position.set(x, 0, z); kit.add(o); }
  for (const [x, z] of [[-W - 8.6, -200], [W + 9, -60]] as const) { const o = flag(9); o.position.set(x, 0, z); kit.add(o); }
  const WX = -W - 4.6, EX = W + 4.6, SW = 8.6, yW = yDeck(WX), yE = yDeck(74); // vỉa hè hai bên mặt cầu
  // lên cầu bằng bậc thang ở bờ tây, đi vỉa hè phía bắc sang đông, vòng trước đầu rồng, về vỉa hè phía nam rồi xuống bậc thang bờ đông
  const path = [V(WX, 0, -196), V(WX, 0, -160), V(WX, 0, -30), V(WX, yW, -13), V(WX, yW, -SW)];
  for (let x = -60; x <= 90; x += 6) path.push(V(x, yDeck(x), -SW));
  path.push(V(97, 0, -SW), V(105, 0, -SW), V(105, 0, SW), V(97, 0, SW));
  for (let x = 90; x >= 78; x -= 6) path.push(V(x, yDeck(x), SW));
  path.push(V(74, yE, SW), V(74, yE, 13), V(74, 0, 26), V(EX, 0, 26), V(EX, 0, -52), V(EX, 0, PZ), V(EX - 6, 0.55, PZ), V(W - 32, 0.55, PZ));
  kit.add(stairs(0x8f96a2, V(WX, 0, -30), V(WX, yW, -13), 4.6), stairs(0x8f96a2, V(74, yE, 13), V(74, 0, 26), 4.6), box(0x8f96a2, WX, yW - 0.3, -11, 4.6, 0.6, 5), box(0x8f96a2, 74, yE - 0.3, 11.5, 4.6, 0.6, 4), box(0x6f7682, 101, 0.03, 0, 12, 0.1, 24));
  return {
    path, half: 2.2, npcs: 12,
    stops: [
      { id: 'bo_tay', at: V(WX, 0, -188), look: V(-6, 12, -30), cam: V(-63.1, 4.6, -186) },
      { id: 'cau_song_han', at: V(WX, 0, -128), look: V(0, 16, -150), cam: V(WX - 2.4, 3.0, -116) },
      { id: 'dau_rong', at: V(105, 0, 0), look: V(L + 5, bodyY(L) + 3.4, 0), cam: V(113, 2.6, 21) },
      { id: 'ca_chep', at: V(EX, 0, -44), look: V(W + 4, 5.6, -52), cam: V(W + 2.2, 2.4, -37.5) },
      { id: 'cau_tinh_yeu', at: V(W - 30, 0.55, PZ), look: V(W - 24, 4, -10), cam: V(W - 15, 5.2, PZ - 17) },
    ],
    shopSpots: [{ at: V(WX - 3.4, 0, -150), ry: Math.PI / 2 }, { at: V(WX - 3.4, 0, -70), ry: Math.PI / 2 }, { at: V(109.5, 0, -9), ry: -Math.PI / 2 }, { at: V(EX + 3.4, 0, -20), ry: -Math.PI / 2 }, { at: V(EX + 3.4, 0, -70), ry: -Math.PI / 2 }],
    onStop: (id) => { if (id === 'dau_rong') fire = clock + 9; },
    sky: [0x0b1230, 0x4a3470], fog: [0x232a55, 160, 700], fill: 0.6,
    light: { ambient: 1.6, ambientColor: 0xbcc6ff, sun: 0.8, sunColor: 0xdfe6ff, sunDir: [0.3, 1, 0.4] },
  };
}
