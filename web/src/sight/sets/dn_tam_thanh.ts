// Làng bích hoạ Tam Thanh (thôn Trung Thanh). Trục x: tây → đông (biển ở phía ĐÔNG, sông Trường Giang phía tây); trục z: bắc → nam.
// Vào làng từ phía nam, đi dọc đường làng cát giữa hai dãy nhà vẽ tranh, qua đường thuyền thúng, rẽ ra bến cá rồi bãi biển.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, palm, person, signPost } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { basket, casuarina, coracle, fishingBoat, painted, panel } from './_extra.ts';
import type { Spots } from './_extra.ts';

const SAND = 0xf6e8c2, ROADC = 0xcbbf9f, SEA = 0x2a8fcf;
type G = CanvasRenderingContext2D;
const circ = (g: G, x: number, y: number, r: number, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
const fish = (g: G, x: number, y: number, s: number, c: string, flip = 1) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 26 * s, 13 * s, 0, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(x - flip * 22 * s, y); g.lineTo(x - flip * 42 * s, y - 14 * s); g.lineTo(x - flip * 42 * s, y + 14 * s); g.fill(); circ(g, x + flip * 14 * s, y - 3 * s, 3.4 * s, '#fff'); circ(g, x + flip * 15 * s, y - 3 * s, 1.6 * s, '#222'); };
const waves = (g: G, w: number, y: number, c: string) => { g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, y + Math.sin(x * 0.08) * 7); g.stroke(); };
const face = (g: G, x: number, y: number, r: number, hair: string) => { circ(g, x, y, r, '#f2c69c'); g.fillStyle = hair; g.beginPath(); g.arc(x, y - r * 0.2, r, Math.PI, 0); g.fill(); circ(g, x - r * 0.35, y + r * 0.05, r * 0.09, '#222'); circ(g, x + r * 0.35, y + r * 0.05, r * 0.09, '#222'); g.strokeStyle = '#a0402a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + r * 0.3, r * 0.34, 0.2, 2.9); g.stroke(); };
/** Tám bức bích hoạ hồn nhiên vẽ đời sống làng chài. */
const MURALS: ((g: G, w: number, h: number) => void)[] = [
  (g, w, h) => { g.fillStyle = '#7fd0e8'; g.fillRect(0, 0, w, h); waves(g, w, h - 70, '#2a8fcf'); waves(g, w, h - 40, '#1f6fae'); g.fillStyle = '#1f6fae'; g.fillRect(0, h - 36, w, 36); circ(g, w - 70, 60, 34, '#ffd23f'); g.fillStyle = '#d2301e'; g.beginPath(); g.moveTo(120, h - 96); g.lineTo(330, h - 96); g.lineTo(290, h - 50); g.lineTo(150, h - 50); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(220, h - 100); g.lineTo(220, 40); g.lineTo(310, h - 110); g.fill(); g.fillStyle = '#ffe14a'; g.fillRect(140, h - 80, 170, 8); fish(g, 80, h - 20, 0.6, '#ff8a3d'); fish(g, 400, h - 18, 0.7, '#ffd23f', -1); },
  (g, w, h) => { g.fillStyle = '#ffe9b0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a8f8f'; g.lineWidth = 2; for (let i = 0; i < 22; i++) { g.beginPath(); g.moveTo(180 + i * 16, 110); g.lineTo(140 + i * 20, h); g.stroke(); g.beginPath(); g.moveTo(170, 120 + i * 9); g.lineTo(w, 110 + i * 10); g.stroke(); } g.fillStyle = '#7a4ac0'; g.beginPath(); g.ellipse(120, h - 50, 80, 86, 0, 0, 6.3); g.fill(); face(g, 120, 96, 46, '#d8d8d8'); g.fillStyle = '#f3e2ae'; g.beginPath(); g.moveTo(40, 70); g.lineTo(120, 14); g.lineTo(200, 70); g.fill(); g.fillStyle = '#f2c69c'; g.fillRect(170, 150, 60, 16); },
  (g, w, h) => { g.fillStyle = '#1f6fae'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) fish(g, 40 + (i * 97) % w, 34 + (i * 53) % (h - 60), 0.7 + (i % 3) * 0.3, ['#ff8a3d', '#ffd23f', '#f29bc0', '#7fe0c0', '#fff'][i % 5], i % 2 ? 1 : -1); for (let i = 0; i < 16; i++) circ(g, (i * 71) % w, (i * 37) % h, 5, 'rgba(255,255,255,0.6)'); g.fillStyle = '#18a558'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(30 + i * 58, h, 9, 50 + (i % 3) * 20, 0.2, 0, 6.3); g.fill(); } },
  (g, w, h) => { g.fillStyle = '#bfe9c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff8a3d'; g.beginPath(); g.ellipse(w / 2, h - 30, 86, 100, 0, 0, 6.3); g.fill(); face(g, w / 2, 92, 56, '#3b2a17'); fish(g, w / 2, h - 80, 1.9, '#4aa3d8'); circ(g, w / 2 - 70, h - 74, 16, '#f2c69c'); circ(g, w / 2 + 70, h - 74, 16, '#f2c69c'); for (let i = 0; i < 6; i++) circ(g, 40 + i * 90, 30 + (i % 2) * 22, 10, '#ffd23f'); },
  (g, w, h) => { g.fillStyle = '#fff3d6'; g.fillRect(0, 0, w, h); const C = ['#e2573c', '#f29bc0', '#ffd23f', '#9b7fd6', '#ff8a3d']; for (let i = 0; i < 9; i++) { const x = 40 + i * 54, y = 60 + (i % 3) * 30; g.strokeStyle = '#18a558'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 14, (h + y) / 2, x, y); g.stroke(); for (let k = 0; k < 6; k++) circ(g, x + Math.cos(k) * 18, y + Math.sin(k) * 18, 13, C[i % 5]); circ(g, x, y, 10, '#fff7c0'); g.fillStyle = '#18a558'; g.beginPath(); g.ellipse(x + 20, h - 50, 20, 9, -0.5, 0, 6.3); g.fill(); } },
  (g, w, h) => { g.fillStyle = '#a8dcf0'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6e8c2'; g.fillRect(0, h - 50, w, 50); g.fillStyle = '#2a5f8a'; g.beginPath(); g.ellipse(170, h - 110, 150, 70, 0, 0, 6.3); g.fill(); g.fillStyle = '#e8f4f8'; g.beginPath(); g.ellipse(190, h - 84, 110, 34, 0, 0, 3.2); g.fill(); g.fillStyle = '#2a5f8a'; g.beginPath(); g.moveTo(300, h - 120); g.lineTo(400, h - 190); g.lineTo(380, h - 110); g.lineTo(410, h - 60); g.fill(); circ(g, 80, h - 130, 9, '#fff'); circ(g, 82, h - 130, 4, '#222'); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(140, h - 180); g.quadraticCurveTo(120, 30, 90, 50); g.moveTo(140, h - 180); g.quadraticCurveTo(170, 30, 200, 54); g.stroke(); },
  (g, w, h) => { g.fillStyle = '#ffd98a'; g.fillRect(0, 0, w, h); g.fillStyle = '#a8482f'; g.beginPath(); g.moveTo(0, 120); g.lineTo(w / 2, 40); g.lineTo(w, 120); g.fill(); g.fillStyle = '#3a3a3a'; g.beginPath(); g.ellipse(250, 96, 44, 24, 0, 0, 6.3); g.fill(); circ(g, 296, 76, 20, '#3a3a3a'); g.beginPath(); g.moveTo(282, 62); g.lineTo(288, 40); g.lineTo(298, 60); g.moveTo(300, 60); g.lineTo(312, 42); g.lineTo(314, 66); g.fill(); circ(g, 290, 74, 4, '#ffe14a'); circ(g, 304, 74, 4, '#ffe14a'); g.strokeStyle = '#3a3a3a'; g.lineWidth = 8; g.beginPath(); g.moveTo(208, 96); g.quadraticCurveTo(170, 60, 190, 40); g.stroke(); g.fillStyle = '#4aa3d8'; g.fillRect(60, 150, 90, 90); g.fillStyle = '#7a4a22'; g.fillRect(330, 140, 70, h - 140); fish(g, 110, 196, 0.8, '#fff'); },
  (g, w, h) => { g.fillStyle = '#f29bc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(60, 40, 150, 170); g.fillStyle = '#bfe9ff'; g.fillRect(74, 54, 122, 100); face(g, 135, 110, 36, '#3b2a17'); face(g, 330, 120, 46, '#222'); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(330, h - 30, 80, 76, 0, 0, 6.3); g.fill(); g.fillStyle = '#d2301e'; g.fillRect(250, 30, 14, 60); g.fillStyle = '#2a6fbf'; g.fillRect(250, 50, 14, 14); g.fillStyle = '#8a8a8a'; g.fillRect(380, 60, 50, 8); g.fillRect(396, 50, 8, 30); },
];
export function tamThanh(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r, shore = (z: number) => 74 + Math.sin(z * 0.03) * 4;
  kit.add(box(SAND, -10, -0.5, 0, 192, 1, 1200));
  kit.add(box(0x1f78b4, 500, -1.8, 0, 800, 1, 1200)); kit.water(SEA, 500, 0, 820, 1200, -0.3, 0.86);
  for (let z = -300; z < 300; z += 7) kit.add(box(0xffffff, shore(z) + 13 + r() * 3, -0.22, z, 1.6, 0.06, 6.4), box(0xe6d6a8, shore(z) + 6, 0.02, z, 14, 0.04, 7.2));
  const surf = [0, 1, 2].map((i) => { const m = box(0xffffff, 0, -0.2, 0, 1.4, 0.07, 500); m.userData.o = i * 12; kit.live(m); return m; }); kit.onTick((t) => surf.forEach((m) => { const k = ((t * 3 + m.userData.o) % 36) / 36; m.position.x = 128 - k * 36; m.scale.x = 0.6 + (1 - k) * 2; }));
  // sông Trường Giang phía tây, bờ bên kia có ruộng và dừa
  kit.add(box(0x3a86a0, -150, -1.5, 0, 90, 1, 1200)); kit.water(0x58a8c0, -150, 0, 92, 1200, -0.35, 0.9); kit.add(box(0x8fc66a, -420, -0.4, 0, 450, 1, 1200));
  for (let i = 0; i < 20; i++) { const p = palm(r, 7 + r() * 3); p.position.set(-102 - r() * 4, 0, -280 + i * 30); kit.add(p); }
  // ---- đường làng: bê tông nhạt giữa cát, dây điện, cột điện
  kit.add(box(ROADC, 0, 0.03, 20, 5.4, 0.08, 220), box(ROADC, 16, 0.03, -30, 5, 0.08, 30, -0.75));
  for (let z = -80; z < 120; z += 26) kit.add(cyl(0x8a8a82, 3.6, 3.6, z, 0.12, 7.2), box(0x8a8a82, 3.6, 6.6, z, 1.6, 0.1, 0.1));
  // ---- nhà cấp bốn thấp có tường vẽ tranh: mỗi nhà một bức bích hoạ quay ra đường
  const MAT = MURALS.map((d) => painted(512, 256, d));
  const WALLC = [0xfff3d6, 0xbfe9f4, 0xffe1c0, 0xd9f0c8, 0xf9d2de, 0xe6dcf6];
  const house = (side: number, z: number, i: number) => {
    const w = 9.4 + (i % 3), x = side * 8.6, g = grp(x, 0, z, side > 0 ? -Math.PI / 2 : Math.PI / 2); // mặt +z cục bộ quay ra đường
    const c = WALLC[i % 6]; g.add(box(c, 0, 1.7, 0, w, 3.4, 7), gable([0xa8482f, 0x7a8a9a, 0xc0563a][i % 3], 0, 3.4, 0, 8.2, 1.5, w + 0.8, Math.PI / 2), box([0x2a8f8f, 0x2a6fbf, 0x18a558, 0xd2301e][i % 4], w / 2 - 1.1, 1.3, 3.54, 1.3, 2.6, 0.08), box(0x7a8a9a, 0, 0.2, 3.9, w, 0.4, 0.8));
    kit.add(g); const mw = w - 3.2; kit.live(panel(MAT[i % 8], x - side * 3.56, 1.75, z - side * 1.0, mw, 2.9, side > 0 ? -Math.PI / 2 : Math.PI / 2));
    if (i % 2 === 0) kit.add(grp(x - side * 4.4, 0, z - side * (w / 2 - 0.8), 0, cyl(0xc0563a, 0, 0.3, 0, 0.36, 0.6), ball([0xf29bc0, 0xe2573c, 0xffd23f][i % 3], 0, 0.9, 0, 0.5, 0.4, 0.5)));
  };
  let n = 0; for (let z = 104; z > -16; z -= 13) { house(-1, z, n++); house(1, z - 5, n++); }
  // tranh vẽ cả trên tường rào, bồn nước, bậc thềm
  for (let i = 0; i < 6; i++) { const z = 96 - i * 20, side = i % 2 ? 1 : -1; kit.add(box(0xf4f1ea, side * 3.4, 0.6, z - 7, 0.3, 1.2, 4.4)); kit.live(panel(MAT[(i + 3) % 8], side * 3.22, 0.62, z - 7, 4.2, 1.1, side > 0 ? -Math.PI / 2 : Math.PI / 2)); }
  for (let i = 0; i < 4; i++) kit.add(cyl([0x4aa3d8, 0xffd23f, 0xf29bc0, 0x7ccf4f][i], (i % 2 ? 1 : -1) * 3.5, 0.7, 84 - i * 27, 0.7, 1.4), bead(0xffffff, (i % 2 ? 1 : -1) * 3.5 - (i % 2 ? 1 : -1) * 0.6, 0.8, 84 - i * 27, 0.24));
  // người làng: bà cụ vá lưới trước hiên, thợ cắt tóc đầu ngõ, trẻ con, khách chụp ảnh
  const granny = person(4, 1, 0x7a4ac0); granny.position.set(-3.8, -0.4, 70); granny.rotation.y = -1.57; kit.add(granny, box(0x3f9f9f, -2.9, 0.4, 70, 1.6, 0.04, 2.4, 0.2), box(0x8a6a48, -4.2, 0.2, 70, 0.6, 0.4, 0.6));
  kit.add(grp(3.9, 0, 52, 0, cyl(0x8a8a8a, 0, 0.35, 0, 0.06, 0.7), box(0xd2301e, 0, 0.75, 0, 0.6, 0.12, 0.6), box(0xd2301e, 0.28, 1.1, 0, 0.08, 0.7, 0.6), box(0xbfe9ff, 0.9, 1.6, 0, 0.06, 1, 0.8), cyl(0x7a5a3c, 0.94, 0.8, 0, 0.04, 1.6)));
  const barber = person(7, 0, 0xffffff); barber.position.set(3.2, 0, 52.6); barber.rotation.y = 2.4; const client = person(2, 0, 0x4aa3d8); client.position.set(3.9, -0.26, 52); client.rotation.y = 1.57; kit.add(barber, client);
  for (let i = 0; i < 3; i++) { const k = person(i + 5, i === 1 ? 2 : 0, [0xffd23f, 0xe2573c, 0x7ccf4f][i]); k.scale.setScalar(0.66); k.position.set(-2 + i * 1.4, 0, 30 + (i % 2)); k.rotation.y = i; kit.add(k); } kit.add(bead(0xffffff, -0.6, 0.2, 31.6, 0.2));
  const photog = person(9, 2, 0x9b7fd6); photog.position.set(2.4, 0, 88); photog.rotation.y = -1.2; kit.add(photog, box(0x222222, 2.0, 1.5, 87.6, 0.3, 0.2, 0.2));
  // ---- cổng đầu làng và bảng giới thiệu
  kit.add(box(0x2a8f8f, -3.4, 2.4, 116, 0.5, 4.8, 0.5), box(0xe2573c, 3.4, 2.4, 116, 0.5, 4.8, 0.5), box(0xffd23f, 0, 4.8, 116, 7.6, 0.9, 0.4), ...[0, 1, 2, 3, 4].map((i) => fishShape([0xff8a3d, 0x4aa3d8, 0xf29bc0, 0x7ccf4f, 0xffffff][i], -2.8 + i * 1.4, 5.7, 116, 0.5)));
  kit.live(label('Làng bích hoạ Tam Thanh', 0, 7.6, 116, '#2a8f8f', 1.1));
  // ---- đường thuyền thúng: thuyền thúng cũ vẽ hoa văn dựng nghiêng dọc hai bên đường
  const PAT = [0xe2573c, 0x2a6fbf, 0xffd23f, 0x18a558, 0xf29bc0, 0xffffff, 0x9b7fd6, 0xff8a3d];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, z = 6 - Math.floor(i / 2) * 5.2, c = PAT[i % 8], c2 = PAT[(i + 3) % 8];
    const g = grp(side * 4.3, 1.25, z, side > 0 ? -Math.PI / 2 : Math.PI / 2); g.rotation.x = 0;
    const disc = grp(0, 0, 0, 0, cyl(c, 0, 0, 0, 1.2, 0.3).rotateX(Math.PI / 2 - 0.22), cyl(0xe2c58a, 0, 0, 0.02, 1.27, 0.1).rotateX(Math.PI / 2 - 0.22), cyl(c2, 0, 0.03, 0.2, 0.7, 0.06).rotateX(Math.PI / 2 - 0.22), cyl(0xffffff, 0, 0.04, 0.24, 0.32, 0.06).rotateX(Math.PI / 2 - 0.22));
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; disc.add(bead(PAT[(i + k) % 8], Math.cos(a) * 0.95, Math.sin(a) * 0.93 + 0.05, 0.2 - Math.sin(a) * 0.2, 0.14, 0.14, 0.05)); }
    g.add(disc, cyl(0x7a5a3c, 0, -0.7, -0.5, 0.05, 1.3).rotateX(-0.5)); kit.add(g);
  }
  kit.live(label('Đường thuyền thúng', 0, 5.6, -6, '#c9861c', 0.9));
  // lưới phơi, giàn phơi cá, vại nước mắm
  for (let i = 0; i < 4; i++) { const x = 9 + i * 0.5, z = -4 - i * 7; kit.add(cyl(0x7a5a3c, x, 1.1, z, 0.06, 2.2), cyl(0x7a5a3c, x + 6, 1.1, z - 1, 0.06, 2.2), box([0x3f9f9f, 0x5f8fbf, 0x4f9f7f][i % 3], x + 3, 1.5, z - 0.5, 6.2, 1.2, 0.05, 0.16)); for (let k = 0; k < 6; k++) kit.add(bead([0xff8a3d, 0xffffff][k % 2], x + 0.4 + k, 2.14, z - 0.06 - k * 0.16, 0.12)); }
  for (let i = 0; i < 3; i++) { kit.add(box(0x9a7c5a, -10, 0.9, -8 - i * 5, 4.4, 0.06, 2.6), ...[-1, 1].flatMap((s) => [cyl(0x7a5a3c, -10 + s * 2, 0.45, -7 - i * 5, 0.05, 0.9), cyl(0x7a5a3c, -10 + s * 2, 0.45, -9 - i * 5, 0.05, 0.9)])); for (let k = 0; k < 14; k++) kit.add(ball(0xc9b28a, -11.8 + (k % 7) * 0.6, 0.96, -8.6 - i * 5 + Math.floor(k / 7) * 1.1, 0.24, 0.03, 0.09)); }
  for (let i = 0; i < 8; i++) kit.add(cyl(0x6a4a34, -15 + (i % 4) * 1.5, 0.6, -30 - Math.floor(i / 4) * 1.6, 0.6, 1.2), cone(0xb59a5a, -15 + (i % 4) * 1.5, 1.4, -30 - Math.floor(i / 4) * 1.6, 0.7, 0.5));
  kit.live(signPost('Nước mắm Tam Thanh', -13, 0, -27, '#6a4a34', 0.8));
  // ---- bến cá: ghe gỗ xanh đỏ kéo lên bãi, thuyền thúng, rổ cá, người gánh cá, cờ
  const BX = 56, BZ = -46;
  for (let i = 0; i < 7; i++) { const b = fishingBoat([0x1f6fae, 0x2a8f8f, 0x1f5f9a][i % 3], [0xd2301e, 0xffd23f][i % 2], 10 + r() * 3); b.position.set(BX + 7 + (i % 2) * 9, -0.1, BZ - 6 + i * 8); b.rotation.set(0, 1.5 + (r() - 0.5) * 0.4, (r() - 0.5) * 0.16); kit.add(b); }
  for (let i = 0; i < 8; i++) { const c = coracle(1.1, 0xe2c58a, [0x2a5f8a, 0x6a5038][i % 2]); c.position.set(BX - 8 + (i % 4) * 3.4, 0, BZ + 6 + Math.floor(i / 4) * 3.4); kit.add(c); }
  for (let i = 0; i < 10; i++) { const b = basket([0xc0c8cc, 0xb9c8d6, 0xd9a06a][i % 3], 1.1); b.position.set(BX - 10 + (i % 5) * 1.6, 0, BZ - 4 + Math.floor(i / 5) * 1.6); kit.add(b); }
  for (let i = 0; i < 5; i++) { const p = person(i + 3, 1, [0x9b7fd6, 0x6f8a9a, 0xe2573c][i % 3]); p.position.set(BX - 9 + i * 2.2, 0, BZ - 6.4 + (i % 2) * 4.6); p.rotation.y = i; kit.add(p); }
  kit.live(label('Bến cá', BX, 7.4, BZ, '#1f6fae', 1.0));
  // ---- bãi biển Tam Thanh: bãi vắng, hàng phi lao, chòi lá, xích đu
  for (let i = 0; i < 46; i++) { const c = casuarina(r, 7 + r() * 4); c.position.set(30 + r() * 20, 0, -70 - r() * 150 + (i % 3) * 4); kit.add(c); } for (let i = 0; i < 20; i++) { const c = casuarina(r, 7 + r() * 4); c.position.set(34 + r() * 14, 0, 0 + r() * 200); kit.add(c); }
  for (let i = 0; i < 3; i++) kit.add(grp(64, 0, -92 - i * 12, 0, cyl(0x7a5a3c, -1.4, 1.3, -1.4, 0.08, 2.6), cyl(0x7a5a3c, 1.4, 1.3, -1.4, 0.08, 2.6), cyl(0x7a5a3c, -1.4, 1.3, 1.4, 0.08, 2.6), cyl(0x7a5a3c, 1.4, 1.3, 1.4, 0.08, 2.6), cone(0xb59a5a, 0, 3.2, 0, 2.9, 1.4), box(0x9a7150, 0, 0.5, 0, 2.6, 0.1, 2.6)));
  kit.add(grp(75, 0, -68, 0.2, cyl(0x7a5a3c, -1.2, 1.5, 0, 0.08, 3), cyl(0x7a5a3c, 1.2, 1.5, 0, 0.08, 3), box(0x7a5a3c, 0, 3, 0, 2.8, 0.12, 0.12), box(0xd2301e, 0, 0.8, 0, 1.2, 0.08, 0.4), cyl(0xe8e4d8, -0.5, 1.9, 0, 0.02, 2.2), cyl(0xe8e4d8, 0.5, 1.9, 0, 0.02, 2.2)));
  for (let i = 0; i < 5; i++) { const b = fishingBoat(0x1f6fae, 0xd2301e, 9); b.position.set(190 + r() * 200, -0.4, -260 + i * 110); b.rotation.y = r() * 3; kit.add(b); }
  kit.live(label('Bãi biển Tam Thanh', 66, 7.4, -84, '#1f6fae', 1.0));
  void ball; void THREE;

  const path = [V(0, 0, 124), V(0, 0, 108), V(0, 0, 60), V(0, 0, 10), V(0, 0, -20), V(8, 0, -30), V(30, 0, -42), V(46, 0, -46), V(56, 0, -62), V(66, 0, -76)];
  return {
    path, half: 2.2, npcs: 8,
    stops: [
      { id: 'dau_lang', at: V(0, 0, 122), look: V(0, 4.4, 116) },
      { id: 'tuong_tranh', at: V(0.6, 0, 86), look: V(-5, 1.8, 92) },
      { id: 'thuyen_thung', at: V(0, 0, 4), look: V(-4.3, 1.3, -4) },
      { id: 'ben_ca', at: V(44, 0, -45.6), look: V(BX + 8, 1.5, BZ - 4) },
      { id: 'bai_bien', at: V(66, 0, -76), look: V(110, 0, -140) },
    ],
    sky: [0x3f9fee, 0xe6f6fb], fog: [0xdff0f6, 130, 800],
    light: { ambient: 1.75, sun: 1.8, sunColor: 0xfff6dc, sunDir: [0.3, 1, 0.3] },
    shopSpots: [V(3.6, 0, 112), V(-3.6, 0, 20), V(40, 0, -40)],
  };
}
function fishShape(c: number, x: number, y: number, z: number, s: number): THREE.Group { return grp(x, y, z, 0, ball(c, 0, 0, 0, s, s * 0.5, 0.1), cone(c, -s * 1.1, 0, 0, s * 0.5, s * 0.6, 0.1).rotateZ(-Math.PI / 2)); }
