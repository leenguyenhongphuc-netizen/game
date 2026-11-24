// Địa đạo Củ Chi (khu Bến Dược). Rừng cao su, tre gai, lối đất đỏ đá ong; nắp hầm ngụy trang, bếp Hoàng Cầm,
// miệng hầm cho khách xuống, nhà trưng bày mái lá. Trục x: tây → đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, person } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { land } from './nb__kit.ts';

const LEAF = 0x8a6a3e, RED = 0xb0582a, THATCH = 0xc4a46a, BAMBOO = 0x8fae4a;
function rubber(r: () => number, h = 13): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0x9a8a74, 0, h * 0.4, 0, 0.22, h * 0.8));
  for (let i = 0; i < 3; i++) g.add(bead([0x3f6e38, 0x4f7e40, 0x5a8a48][i], (r() - 0.5) * 2.6, h * 0.82 + i * 0.7, (r() - 0.5) * 2.6, 2.4 + r(), 1.6, 2.4 + r()));
  g.add(cyl(0x5a4a3a, 0.22, 1.3, 0, 0.12, 0.2), box(0xf3ead2, 0.18, 1.6, 0, 0.02, 0.6, 0.3)); // chén hứng mủ
  return g;
}
function bamboo(r: () => number): THREE.Group { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.8, h = 6 + r() * 4, s = cyl(BAMBOO, Math.cos(a) * d, h / 2, Math.sin(a) * d, 0.07, h); s.rotation.z = (r() - 0.5) * 0.3; g.add(s, bead(0x5f9a3a, Math.cos(a) * d * 2, h, Math.sin(a) * d * 2, 1.1, 0.7, 1.1)); } return g; }
function thatchHut(w: number, d: number, h: number, low = false): THREE.Group {
  const g = grp(0, 0, 0, 0, gable(THATCH, 0, low ? 0.2 : h, 0, w + 1, low ? h : 2.6, d + 1));
  if (!low) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0x6a5038, sx * w / 2, h / 2, sz * d / 2, 0.12, h)); g.add(box(0xa08a62, 0, h * 0.35, -d / 2, w, h * 0.7, 0.1)); }
  return g;
}

export function cuChi(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -260, -200, 260, 200, LEAF, 0, false);
  for (let i = 0; i < 60; i++) kit.add(box([0x9a7a46, 0x7a5a32, 0xa88a52][i % 3], (r() - 0.5) * 400, 0.005, (r() - 0.5) * 300, 3 + r() * 9, 0.01, 2 + r() * 7, r() * 3));
  // lối đất đỏ
  const path = [V(-120, 0, 0), V(-100, 0, 0), V(-70, 0, 6), V(-40, 0, 2), V(-12, 0, -6), V(18, 0, -2), V(46, 0, 6), V(74, 0, 2), V(100, 0, 0), V(116, 0, -10)];
  for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], m = a.clone().lerp(b, 0.5), d = b.clone().sub(a); kit.add(box(RED, m.x, 0.02, m.z, 3.2, 0.04, d.length() + 2, Math.atan2(d.x, d.z))); }
  // rừng cao su xếp hàng + bụi tre
  for (let x = -170; x < 170; x += 10) for (let z = -120; z < 120; z += 9) { if (Math.abs(z - 2) < 9 && x > -126 && x < 122) continue; if ((x * 7 + z * 3) % 5 === 0) continue; const t = rubber(r, 11 + r() * 4); t.position.set(x + (r() - 0.5) * 1.2, 0, z + (r() - 0.5) * 1.2); kit.add(t); }
  for (let i = 0; i < 24; i++) { const b = bamboo(r); b.position.set(-115 + i * 10 + r() * 4, 0, (i % 2 ? 1 : -1) * (7 + r() * 4)); kit.add(b); }
  // cổng khu di tích
  kit.add(box(0x8a8478, -112, 3, -5, 1.2, 6, 1.2), box(0x8a8478, -112, 3, 5, 1.2, 6, 1.2), box(0xb8322a, -112, 6.4, 0, 1.4, 1.4, 12), gable(0x6a5a48, -112, 7.1, 0, 2.2, 1, 13));
  kit.live(label('Khu di tích Địa đạo Củ Chi', -112, 10, 0, '#b8322a', 1.1));
  // nắp hầm bí mật: lỗ vuông nhỏ trong lớp lá, nắp gỗ nhấc lên, người lính chui lên nửa người
  const HX = -70, HZ = 12;
  kit.add(box(0x3a2a1a, HX, 0.01, HZ, 0.6, 0.02, 0.45), box(0x7a5a3a, HX + 0.7, 0.08, HZ, 0.62, 0.08, 0.48), box(LEAF, HX + 0.7, 0.13, HZ, 0.62, 0.03, 0.48));
  const soldier = baked(grp(HX, -0.9, HZ, 0, person(4, 0, 0x2f3a2a), cone(0x3a4a32, 0, 1.85, 0, 0.5, 0.25))); kit.live(soldier);
  kit.onTick((t) => { soldier.position.y = -0.9 + (Math.sin(t * 0.6) > 0.3 ? 0.4 : 0); });
  for (let i = 0; i < 6; i++) kit.add(bead(0x6a4a2a, HX + (r() - 0.5) * 3, 0.05, HZ + (r() - 0.5) * 3, 0.3, 0.05, 0.3));
  kit.live(label('Nắp hầm', HX, 3.2, HZ, '#5a4a32', 0.7));
  // bếp Hoàng Cầm: chòi lá thấp sát đất, khói toả ra từ các lỗ thông xa bếp, sát mặt đất
  const KX = -12, KZ = -16;
  const hut = thatchHut(6, 4, 1.6, true); hut.position.set(KX, 0, KZ); kit.add(hut, box(0x3a2a1a, KX, 0.3, KZ + 2.6, 1.6, 0.6, 0.1));
  for (let i = 0; i < 3; i++) kit.add(box(0x2a1a10, KX + 6 + i * 4, 0.02, KZ - 4 - i * 2, 0.5, 0.02, 0.5));
  kit.motes(24, 0xdcd6cc, 2.2, () => V(KX + 6 + Math.floor(r() * 3) * 4, 0.2 + r() * 0.6, KZ - 4 - Math.floor(r() * 3) * 2), (p, i, _t, dt) => { p.y += dt * 0.12; p.x += dt * (0.5 + (i % 3) * 0.2); if (p.y > 1.2) { p.y = 0.2; p.x = KX + 6 + (i % 3) * 4; } });
  kit.live(label('Bếp Hoàng Cầm', KX, 4.4, KZ, '#5a4a32', 0.8));
  // miệng hầm cho khách xuống: hố đất đỏ có bậc, mái che tôn thấp quanh, khách xếp hàng
  const TX = 46, TZ = 14;
  kit.add(box(0x8a3a1a, TX, -0.6, TZ, 2.4, 1.2, 1.2), box(0x5a2a10, TX, -1.2, TZ, 1.6, 0.1, 0.8), box(0x7a5a3c, TX, 3.4, TZ, 6, 0.1, 5));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0x6a5038, TX + sx * 2.8, 1.7, TZ + sz * 2.3, 0.08, 3.4));
  for (let i = 0; i < 4; i++) { const p = person(i + 2, i % 2 ? 0 : 2); p.position.set(TX - 6 + i * 1.2, 0, TZ - 3); p.rotation.y = 1.4; kit.add(p); }
  kit.live(label('Đoạn hầm cho khách', TX, 6.4, TZ, '#8a3a1a', 0.8));
  // hố bom và xác xe tăng M41 cạnh lối đi
  kit.add(cyl(0x6a4a2a, 18, -0.3, 18, 4, 0.6), cyl(0x4a3a24, 18, -0.55, 18, 3, 0.1));
  kit.add(grp(76, 0, -14, 0.6, box(0x4a4a3a, 0, 0.9, 0, 3, 1.2, 5.6), box(0x3a3a2e, 0, 0.45, 0, 3.4, 0.9, 6), ball(0x4a4a3a, 0, 1.8, 0, 1.1, 0.55, 1.2), cyl(0x3a3a2e, 0, 1.9, -2.2, 0.11, 3.6).rotateX(Math.PI / 2)));
  // nhà trưng bày mái lá lớn
  const MX = 116, MZ = -24;
  const hall = thatchHut(16, 10, 3.4); hall.position.set(MX, 0, MZ); kit.add(hall);
  for (let i = 0; i < 3; i++) kit.add(box(0x9a8a6a, MX - 5 + i * 5, 1, MZ - 1, 3, 2, 2), box(0x7a5a3a, MX - 5 + i * 5, 2.05, MZ - 1, 2.8, 0.1, 1.8));
  kit.live(label('Nhà trưng bày', MX, 8, MZ, '#5a4a32', 1));
  void ball;
  return {
    path, half: 2.2, npcs: 4,
    stops: [
      { id: 'cong', at: V(-104, 0, 0), look: V(-112, 5, 0), cam: V(-96, 3, 7) },
      { id: 'nap_ham', at: V(-70, 0, 6), look: V(HX, 0.6, HZ), cam: V(-73, 3.4, 4) },
      { id: 'ham_bep', at: V(-12, 0, -6), look: V(KX, 1, KZ), cam: V(-12, 4, 2) },
      { id: 'duong_ham', at: V(46, 0, 6), look: V(TX, 0, TZ), cam: V(40, 5, 4) },
      { id: 'nha_truyen_thong', at: V(116, 0, -10), look: V(MX, 3, MZ), cam: V(110, 5, -2) },
    ],
    sky: [0x7ab8e0, 0xe8e4cc], fog: [0xd8dcc4, 60, 320],
    light: { ambient: 1.5, sun: 1.6, sunColor: 0xfff0c8, sunDir: [-0.4, 1, 0.3] },
    shopSpots: [V(-94, 0, -4), V(30, 0, -6), V(104, 0, 5)],
  };
}
