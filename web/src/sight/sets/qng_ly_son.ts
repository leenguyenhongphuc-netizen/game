// Đảo Lý Sơn (Đảo Lớn). Trục x: tây → đông; trục z: bắc → nam. Đất liền (cảng Sa Kỳ) ở phía tây nam, Đảo Bé ở phía tây bắc.
// Cảng ở bờ tây nam → ruộng tỏi giữa đảo → Âm linh tự phía tây → cổng Tò Vò bờ tây bắc → Hang Câu dưới chân núi Thới Lới phía đông bắc
// → lên miệng núi lửa Thới Lới ở đầu đông → xuống chợ đảo.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, glow, grp, label, palm, person, rock, signPost, stall, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { basket, fishingBoat, flagPole, wave } from './_extra.ts';
import type { Spots } from './_extra.ts';

const SOIL = 0x9a4a30, SAND = 0xfdf6e0, BASALT = 0x2e2a2a, SEA = 0x1f9fc0, GARLIC = 0x4fae4a, RX = 125, RZ = 78;
const HX = 92, HZ = -18, HR = 46, HH = 24; // núi Thới Lới
const hillY = (x: number, z: number) => { const d = Math.hypot(x - HX, z - HZ) / HR; return d >= 1 ? 0 : HH * Math.sqrt(1 - d * d); };
export function lySon(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.add(box(0x146f96, 0, -3.4, 0, 1900, 1, 1900)); kit.water(SEA, 0, 0, 1900, 1900, -0.5, 0.8);
  // thân đảo: thềm đá ngầm màu ngọc, viền cát trắng, nền đất đỏ bazan
  kit.add(cyl(0x4fc4c8, 0, -1.4, 0, RX + 26, 1, RZ + 22), cyl(SAND, 0, -0.62, 0, RX + 5, 1, RZ + 5), cyl(SOIL, 0, -0.5, 0, RX, 1, RZ));
  const inside = (x: number, z: number, k = 1) => (x / (RX * k)) ** 2 + (z / (RZ * k)) ** 2 < 1;
  // đá bazan đen rải quanh bờ
  for (let i = 0; i < 90; i++) { const a = r() * 6.28, k = 0.99 + r() * 0.07; kit.add(rock(i % 3 ? BASALT : 0x4a4442, Math.cos(a) * RX * k, -0.2, Math.sin(a) * RZ * k, 1 + r() * 2.4, 0.6 + r() * 1.2, 1 + r() * 2, r() * 3)); }
  // núi Thới Lới (miệng núi lửa đã tắt) ở đầu đông và núi Giếng Tiền nhỏ phía tây
  kit.add(ball(0x6f8f4a, HX, 0, HZ, HR, HH, HR), ball(0x7f9a52, HX - 6, 0, HZ + 6, HR * 0.8, HH * 0.9, HR * 0.86), ball(0x6f8f4a, -96, 0, -30, 26, 15, 22));
  kit.add(cyl(0x5a4a3a, HX + 6, HH - 2.4, HZ - 4, 16, 3, 14), cyl(0x3a2f2a, HX + 6, HH - 1.3, HZ - 4, 14.6, 1, 12.6)); // lòng chảo
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3fc0d8, roughness: 0.2 })); lake.position.set(HX + 6, HH - 0.72, HZ - 4); lake.scale.set(13, 1, 11.2); kit.live(lake);
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28; kit.add(rock([0x5a4a3a, 0x6a5a48, 0x4a3f36][i % 3], HX + 6 + Math.cos(a) * 16.6, HH - 0.6 + r(), HZ - 4 + Math.sin(a) * 14.6, 2 + r() * 1.6, 1.4 + r() * 1.4, 2 + r(), r() * 3)); }
  for (let i = 0; i < 50; i++) { const a = r() * 6.28, d = 20 + r() * 24, x = HX + Math.cos(a) * d, z = HZ + Math.sin(a) * d; if (z < HZ - 30) continue; kit.add(ball([0x5f8a44, 0x7fa856][i % 2], x, hillY(x, z) + 0.2, z, 1.4 + r() * 1.6, 0.8 + r() * 0.6, 1.4 + r() * 1.6)); }
  // ---- lối đi
  const flat = [V(-70, 1.3, 102), V(-70, 1.3, 70), V(-70, 0, 62), V(-56, 0, 44), V(-40, 0, 24), V(-64, 0, 13), V(-74, 0, 9), V(-70, 0, -22), V(-62, 0, -50), V(-61, 0, -59), V(-22, 0, -57), V(30, 0, -60), V(58, 0, -62), V(73, 0, -61.5)];
  const climb: THREE.Vector3[] = []; const leg = (x0: number, z0: number, x1: number, z1: number) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3.2); for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; climb.push(V(x, hillY(x, z) + 0.12, z)); } };
  leg(73, -61.5, 60, -46); leg(60, -46, 62, -28); leg(62, -28, 76, -14); leg(76, -14, 85, -7); leg(85, -7, 74, 6); leg(74, 6, 56, 14); leg(56, 14, 38, 24); leg(38, 24, 16, 34);
  const path = [...flat, ...climb];
  kit.pave(0xe0c8a0, path, 3.4, 2, 13, 0.1, 0.03); kit.pave(0xc9b08a, path, 3, 13, path.length - 1, 0.5, 0.06);
  // ---- cảng Lý Sơn: cầu cảng bê tông, tàu cao tốc, ghe cá xanh đỏ, đê chắn sóng, nhà chờ
  kit.add(box(0xc9c4b8, -70, 0.9, 84, 7, 0.8, 44), box(0xc9c4b8, -78, 0.9, 100, 22, 0.8, 8)); for (let z = 66; z < 106; z += 6) for (const s of [-1, 1]) kit.add(cyl(0x9a958a, -70 + s * 3, -1, z, 0.5, 3.4), cyl(0xffd23f, -70 + s * 3.2, 1.6, z, 0.16, 0.6));
  const fast = grp(-62, -0.3, 92, 0.05, box(0xffffff, 0, 1.3, 0, 5.4, 1.8, 22), box(0xff7a1a, 0, 0.7, 0, 5.5, 0.5, 22.1), box(0x2a4a6a, 0, 2.5, -1, 5, 1.2, 15), box(0xffffff, 0, 3.4, -1, 5.2, 0.3, 15.4), box(0x2a4a6a, 0, 3.9, -6, 4, 0.8, 4), cone(0xffffff, 0, 1.3, -13.5, 2.7, 5).rotateX(-Math.PI / 2), cyl(0x8a8a8a, 0, 5.4, -4, 0.06, 2.4), box(0xd61f26, 0.5, 6.2, -4, 0.9, 0.6, 0.04)); kit.add(fast);
  for (let i = 0; i < 9; i++) { const b = fishingBoat([0x1f6fae, 0x2a8f8f, 0x1f5f9a][i % 3], [0xd2301e, 0xffd23f][i % 2], 10 + r() * 4); b.position.set(-110 + (i % 5) * 7 + r() * 3, -0.5, 78 + Math.floor(i / 5) * 12 + r() * 4); b.rotation.y = 0.2 + (r() - 0.5) * 0.5; kit.add(b); }
  for (let i = 0; i < 14; i++) kit.add(rock(0x6a6460, -30 - i * 0.6, 0, 76 + i * 3.4, 2.4, 1.6, 2.4, i));
  kit.add(box(0xf1e3b8, -58, 2, 66, 12, 4, 6), gable(0x2a6fbf, -58, 4, 66, 7, 1.6, 13, Math.PI / 2), box(0xbfe6ff, -58, 2.2, 62.96, 8, 1.6, 0.1));
  for (let i = 0; i < 5; i++) { const p = person(i + 1, i % 2 ? 2 : 1); p.position.set(-72 + (i % 2) * 3, 1.3, 76 + i * 4); p.rotation.y = i; kit.add(p, box([0xe2573c, 0x2a6fbf, 0x3a3a3a][i % 3], -72 + (i % 2) * 3 + 0.5, 1.6, 76 + i * 4, 0.4, 0.6, 0.3)); }
  kit.live(label('Cảng Lý Sơn', -70, 8.4, 76, '#1f6fae', 1.1), signPost('Sa Kỳ 30 km ←', -66, 1.3, 98, '#2a4a6a', 0.8));
  // làng An Vĩnh quanh cảng: nhà mái bằng, mái ngói, dừa
  for (let i = 0; i < 26; i++) { const x = -100 + (i % 9) * 11 + r() * 3, z = 34 + Math.floor(i / 9) * 10 + r() * 2; if (!inside(x, z, 0.93) || Math.hypot(x + 62, z - 52) < 11 || (x > -50 && z < 44)) continue; const c = [0xf1e3b8, 0xbfe0e6, 0xf9d2de, 0xfff3d6][i % 4], h = 3.2 + (i % 3) * 1.6; kit.add(box(c, x, h / 2, z, 7, h, 6), i % 2 ? box(0xe8e4d8, x, h + 0.2, z, 7.4, 0.4, 6.4) : gable(0xa8482f, x, h, z, 6.6, 1.5, 7.6, Math.PI / 2), box(0x3f6f8f, x, 1.2, z - 3.04, 1.2, 2.2, 0.08)); }
  for (let i = 0; i < 20; i++) { const a = 1.2 + r() * 2.2, k = 0.9 + r() * 0.07, p = palm(r, 6 + r() * 3); p.position.set(Math.cos(a) * RX * k, 0, Math.sin(a) * RZ * k); kit.add(p); }
  // ---- ruộng tỏi: ô vuông CÁT TRẮNG phủ trên đất đỏ bazan, hàng tỏi xanh, bờ đá đen xếp khan, nông dân tưới nước
  const nearPath = (x: number, z: number, m: number) => { for (let i = 2; i < flat.length - 1; i++) { const a = flat[i], b = flat[i + 1], t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / a.distanceToSquared(b))); if (Math.hypot(x - a.x - (b.x - a.x) * t, z - a.z - (b.z - a.z) * t) < m) return true; } return false; };
  for (let gx = -58; gx <= 46; gx += 9) for (let gz = -44; gz <= 28; gz += 9) {
    const x = gx + (r() - 0.5), z = gz + (r() - 0.5); if (!inside(x, z, 0.86) || nearPath(x, z, 6.4) || hillY(x + 5, z) > 0 || Math.hypot(x - 16, z - 40) < 16 || Math.hypot(x + 86, z - 6) < 22) continue;
    kit.add(box(SAND, x, 0.08, z, 7.6, 0.16, 7.6)); const green = r() < 0.8;
    if (green) for (let i = 0; i < 6; i++) kit.add(box(GARLIC, x - 3 + i * 1.2, 0.3, z, 0.34, 0.36, 6.8)); else for (let i = 0; i < 12; i++) kit.add(bead(0xffffff, x - 3 + (i % 4) * 2, 0.26, z - 2.4 + Math.floor(i / 4) * 2.4, 0.28), bead(0xe8dcf0, x - 2.6 + (i % 4) * 2, 0.24, z - 2 + Math.floor(i / 4) * 2.4, 0.24));
    for (let i = 0; i < 4; i++) kit.add(box(BASALT, x + [0, 0, -4.1, 4.1][i], 0.26, z + [-4.1, 4.1, 0, 0][i], i < 2 ? 8.6 : 0.6, 0.5, i < 2 ? 0.6 : 8.6));
  }
  for (let i = 0; i < 6; i++) { const x = -44 + i * 5.2 + r() * 2, z = 14 + (i % 3) * 5, f = person(i + 2, 1, [0x6f8a9a, 0x9b7fd6, 0xc98a5a][i % 3]); if (nearPath(x, z, 2.6)) continue; f.position.set(x, 0.16, z); f.rotation.y = r() * 6; kit.add(f, cyl(0x4a8f6a, x + 0.5, 1.0, z, 0.2, 0.4), cone(0x9fd8f0, x + 0.9, 0.6, z, 0.3, 0.8)); }
  kit.add(cyl(0x8f8a80, -30, 0.5, 30, 1.6, 1), cyl(0x3fa8c8, -30, 1.02, 30, 1.4, 0.04), box(0x8a6a48, -36, 0.5, 31, 2.4, 0.9, 1.4)); for (let i = 0; i < 12; i++) kit.add(bead(0xffffff, -37 + (i % 6) * 0.4, 1.1, 30.7 + Math.floor(i / 6) * 0.5, 0.2));
  kit.live(label('Ruộng tỏi Lý Sơn', -40, 6.6, 16, '#3f8a3a', 1.0));
  // ---- Âm linh tự và tượng đài Hải đội Hoàng Sa
  const AX = -92, AZ = 8;
  kit.add(box(0xd9c8b0, AX + 2, 0.06, AZ, 30, 0.12, 26));
  kit.add(box(0xf1dfb0, AX + 14, 2, AZ - 4, 1.3, 4, 1.3), box(0xf1dfb0, AX + 14, 2, AZ + 4, 1.3, 4, 1.3), box(0xf1dfb0, AX + 14, 1.5, AZ - 8, 1, 3, 1), box(0xf1dfb0, AX + 14, 1.5, AZ + 8, 1, 3, 1), templeRoof(0x9a3f2a, AX + 14, 4, AZ, 3, 1.2, 10.6, 0x5a2a20), templeRoof(0x9a3f2a, AX + 14, 3, AZ - 8, 2.4, 0.9, 3, 0x5a2a20), templeRoof(0x9a3f2a, AX + 14, 3, AZ + 8, 2.4, 0.9, 3, 0x5a2a20));
  kit.add(box(0xb9b2a4, AX - 4, 0.4, AZ, 12, 0.8, 16), box(0xf1dfb0, AX - 5, 2.6, AZ, 8, 3.6, 13), templeRoof(0x9a3f2a, AX - 4.6, 4.4, AZ, 11, 2.2, 17, 0x5a2a20), box(glow(0xffb347), AX - 0.96, 2.2, AZ, 0.1, 2.6, 2.6)); for (let i = 0; i < 4; i++) kit.add(cyl(0xa8322a, AX + 0.6, 2.6, AZ - 6 + i * 4, 0.26, 3.6));
  kit.add(cyl(0x6f6a62, AX + 6, 0.8, AZ, 0.9, 0.9), cyl(0x4a463f, AX + 6, 1.4, AZ, 1.1, 0.3));
  // tượng đài: ba người lính Hải đội Hoàng Sa bằng đá bên tấm bia
  const mon = grp(AX + 6, 0, AZ - 20, 0.3); mon.add(cyl(0xb9b2a4, 0, 0.4, 0, 7, 0.8), cyl(0x9a958a, 0, 1.2, 0, 5, 0.8), box(0x8f8a80, 2.6, 5, -0.6, 2.2, 6.6, 1), box(0xd8cfb8, 2.6, 5.2, -0.08, 1.5, 4.2, 0.06));
  const STONE = 0xa8a39a; for (let i = 0; i < 3; i++) { const sx = -2.6 + i * 1.7, s = 2.1 - (i === 1 ? 0 : 0.2); mon.add(cyl(STONE, sx, 1.6 + 1.1 * s, 0.3 * (i - 1), 0.36 * s, 1.5 * s, 0.28 * s), ball(STONE, sx, 1.6 + 2.2 * s, 0.3 * (i - 1), 0.3 * s), cone(STONE, sx, 1.6 + 2.62 * s, 0.3 * (i - 1), 0.5 * s, 0.26 * s), cyl(STONE, sx - 0.2 * s, 1.6 + 0.2 * s, 0.3 * (i - 1), 0.13 * s, 0.9 * s), cyl(STONE, sx + 0.2 * s, 1.6 + 0.2 * s, 0.3 * (i - 1), 0.13 * s, 0.9 * s)); if (i === 1) mon.add(cyl(STONE, sx + 0.9, 4.6, 0, 0.07, 5.4), box(STONE, sx + 0.9, 7.2, 0.4, 0.06, 0.5, 0.8)); }
  kit.add(mon); const fp0 = flagPole(9, 2.6); fp0.pole.position.set(AX + 12, 0, AZ - 14); kit.add(fp0.pole); fp0.flag.position.set(AX + 12, fp0.flag.position.y, AZ - 14); kit.live(fp0.flag); wave(kit, fp0.flag);
  for (let i = 0; i < 6; i++) { const t = tree(r, 1.3 + r() * 0.6, true); t.position.set(AX - 12 + r() * 4, 0, AZ - 12 + i * 5); kit.add(t); }
  kit.live(label('Âm linh tự', AX - 2, 10, AZ, '#9a3f2a', 1.0), label('Tượng đài Hải đội Hoàng Sa', AX + 6, 10.6, AZ - 20, '#5a5a54', 0.8));
  // ---- cổng Tò Vò: vòm đá bazan đen bên mép nước, mặt trời chiều lọt qua vòm
  const TX = -64, TZ = -71;
  const arch = grp(TX, -0.5, TZ, 0.34); arch.add(rock(BASALT, -3.2, 2.2, 0, 2, 3.4, 2.4, 0.4), rock(0x3a3432, -3.6, 0.6, 0.8, 2.8, 1.4, 3, 1), rock(BASALT, 3.4, 2.4, 0, 2.2, 3.6, 2.6, 2), rock(0x3a3432, 4.2, 0.6, -0.6, 3, 1.5, 3, 0.3), rock(BASALT, 0, 5.3, 0, 5.6, 1.5, 2.6, 0.1), rock(0x3a3432, -1.6, 6, 0.3, 2.4, 0.9, 2, 1.4), rock(0x4a4442, 2, 6.1, -0.2, 2.2, 0.8, 1.8, 2.2));
  kit.add(arch); for (let i = 0; i < 16; i++) kit.add(rock(i % 2 ? BASALT : 0x3a3432, TX - 14 + r() * 28, -0.3, TZ - 3 + r() * 9, 1 + r() * 2, 0.5 + r(), 1 + r() * 2, r() * 3));
  kit.add(box(0x3a3432, TX + 2, -0.3, TZ + 5, 22, 0.5, 9));
  const sun = ball(glow(0xfff0b0), -196, 44, -470, 24); const halo = ball(new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.35, depthWrite: false }), -196, 44, -468, 40); kit.live(sun, halo);
  kit.motes(50, 0xffe0a0, 2.2, (i) => V(-66 - i * 2.6 + (r() - 0.5) * 16, -0.3, -84 - i * 7.4), (p, i, t) => { p.y = -0.34 + Math.sin(t * 2 + i) * 0.06; });
  for (let i = 0; i < 3; i++) { const p = person(i + 6, i % 2 ? 2 : 0); p.position.set(TX + 6 + i * 1.6, 0, TZ + 8 + i); p.rotation.y = 0.4; kit.add(p); }
  kit.live(label('Cổng Tò Vò', TX, 9.6, TZ, '#2e2a2a', 0.9));
  // Đảo Bé (An Bình) phía tây bắc: đảo thấp, bãi cát trắng, vài mái nhà
  kit.add(cyl(SAND, -270, -0.5, -250, 46, 1, 30), cyl(0x6f9a52, -270, -0.2, -250, 38, 1.4, 22), ball(0x5f8a44, -262, 0.4, -252, 20, 9, 14), cyl(0x4fc4c8, -270, -1.3, -250, 60, 1, 42)); for (let i = 0; i < 6; i++) kit.add(box(0xf4f1ea, -292 + i * 6, 1.4, -238 + (i % 2) * 3, 4, 2, 4));
  kit.live(label('Đảo Bé', -270, 16, -250, '#2a7f9a', 2.4));
  // đất liền Quảng Ngãi mờ xa phía tây nam
  kit.add(box(0x8aa6b0, -700, 4, 300, 60, 12, 1100));
  // ---- Hang Câu: vách núi dựng đứng nhiều lớp trầm tích, chân vách bị sóng khoét hàm ếch, nước trong xanh
  const CX = 80, CZ = -58, LAY = [0x6a6460, 0xc9a45a, 0x9a7a52, 0xd9bc78, 0x7a6a5a, 0xb08a54, 0x8a8078, 0xcfae66, 0x6f6258];
  for (let i = 0; i < LAY.length; i++) { const y = 3.2 + i * 2.5, inset = i < 2 ? 5.4 - i * 2.6 : (i % 2) * 0.8, zs = 31 - i * 0.8; kit.add(box(LAY[i], CX + inset + 11 + i * 0.3, y, CZ + (i % 3 - 1) * 0.6, 22, 2.56, zs)); for (let k = 0; k < 4; k++) kit.add(box(LAY[(i + 3 + k) % 9], CX + inset + i * 0.3 - 0.06, y - 0.6 + r() * 1.2, CZ - 13 + r() * 26, 0.14, 0.3 + r() * 0.5, 3 + r() * 6)); }
  kit.add(box(0x1f1a18, CX + 3.4, 1.5, CZ, 5, 3.8, 24), ball(0x6f8f4a, CX + 14, 25.4, CZ, 13, 2.6, 17), ball(0x6f8f4a, 104, 13, -50, 26, 13, 20));
  for (let i = 0; i < 14; i++) kit.add(rock(i % 2 ? 0x6a6460 : BASALT, CX - 3 + r() * 5, -0.1, CZ - 14 + r() * 28, 1 + r() * 1.6, 0.7 + r(), 1 + r() * 1.6, r() * 3));
  kit.add(cyl(0x58d8d0, CX - 6, -0.46, CZ - 24, 34, 0.1, 14), box(0x4a4442, 66, -0.3, -62.5, 20, 0.5, 7));
  for (let i = 0; i < 14; i++) kit.add(bead([0xff7a6a, 0xffb347, 0xf29bc0, 0x9b7fd6][i % 4], CX - 30 + r() * 44, -1.3, CZ - 16 - r() * 14, 1 + r(), 0.6, 1 + r()));
  kit.live(label('Hang Câu', CX - 1, 18, CZ, '#7a6a5a', 1.1));
  // ---- đỉnh Thới Lới: cột cờ Tổ quốc, đài ngắm, lan can
  const FX = 88, FZ = -4, FY = hillY(FX, FZ);
  kit.add(cyl(0xb9b2a4, FX, FY + 0.2, FZ, 5, 0.8), cyl(0x9a958a, FX, FY + 0.8, FZ, 3, 0.6), box(0xa8322a, FX, FY + 1.6, FZ, 1.6, 1.2, 1.6));
  const fp = flagPole(18, 5.4); fp.pole.position.set(FX, FY + 2, FZ); kit.add(fp.pole); fp.flag.position.set(FX, FY + 2 + fp.flag.position.y, FZ); kit.live(fp.flag); wave(kit, fp.flag, 1.8);
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; kit.add(cyl(0xf4f1ea, FX + Math.cos(a) * 4.8, FY + 1, FZ + Math.sin(a) * 4.8, 0.1, 1.2)); }
  kit.live(label('Cột cờ Thới Lới', FX, FY + 24, FZ, '#a8322a', 1.0), label('Hồ nước ngọt', HX + 6, HH + 4, HZ - 4, '#2a7f9a', 0.8));
  // ---- chợ đảo: sạp tỏi bện chùm treo thành dây, rổ hành tím, rong biển, gỏi tỏi
  const MX = 12, MZ = 42;
  kit.add(box(0xd9c8b0, MX, 0.05, MZ, 26, 0.1, 18), gable(0x2a8f8f, MX, 4.4, MZ + 2, 12, 1.8, 24, Math.PI / 2)); for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) kit.add(cyl(0xd8d2c4, MX + sx * 11, 2.2, MZ + 2 + sz * 5, 0.22, 4.4));
  for (let i = 0; i < 6; i++) {
    const sx = MX - 8 + (i % 3) * 8, sz = MZ - 3.4 + Math.floor(i / 3) * 9, st = stall([0xe2573c, 0x2a8f8f, 0xffd23f][i % 3], r); st.position.set(sx, 0.1, sz); st.rotation.y = Math.floor(i / 3) * Math.PI; kit.add(st);
    for (let k = 0; k < 6; k++) { const bx = sx - 1 + k * 0.4; for (let j = 0; j < 5; j++) kit.add(bead(k % 3 === 2 ? 0xa860a8 : 0xfdfaf0, bx, 2.1 - j * 0.2, sz + (Math.floor(i / 3) ? -1 : 1) * 1.05, 0.11)); }
    const b = basket(i % 2 ? 0xa860a8 : 0xfdfaf0, 1.1); b.position.set(sx + 1.6, 0.1, sz + (Math.floor(i / 3) ? -1.6 : 1.6)); kit.add(b); const p = person(i + 4, 1, [0x9b7fd6, 0x6f8a9a, 0xc98a5a][i % 3]); p.position.set(sx, 0.1, sz + (Math.floor(i / 3) ? 1.3 : -1.3)); p.rotation.y = Math.floor(i / 3) ? Math.PI : 0; kit.add(p);
  }
  kit.live(label('Chợ đảo · Tỏi Lý Sơn', MX, 8.4, MZ + 2, '#2a8f8f', 1.0));
  void cone; void ball;

  const last = path[path.length - 1];
  return {
    path, half: 2.1, npcs: 10, startYaw: 0,
    stops: [
      { id: 'cang', at: V(-70, 1.3, 84), look: V(0, 16, 0) },
      { id: 'ruong_toi', at: V(-41, 0, 25), look: V(-28, 0.4, 6) },
      { id: 'am_linh_tu', at: V(-74, 0, 9), look: V(AX - 3, 4, AZ) },
      { id: 'cong_to_vo', at: V(-61, 0, -59), look: V(TX - 1, 3, TZ) },
      { id: 'hang_cau', at: V(71, 0, -61), look: V(CX + 6, 13, CZ + 1) },
      { id: 'thoi_loi', at: V(85, hillY(85, -7) + 0.12, -7), look: V(FX + 1, FY + 14, FZ + 0.4) },
      { id: 'cho_dao', at: last.clone(), look: V(MX, 2.6, MZ + 2) },
    ],
    sky: [0x4f86cc, 0xffcf96], fog: [0xf4d2a8, 150, 900],
    light: { ambient: 1.5, sun: 1.8, sunColor: 0xffd9a0, sunDir: [-0.5, 0.55, -0.7], ambientColor: 0xfff0e0 },
    shopSpots: [V(-64, 0, 56), V(-56, 0, -44), V(24, 0.2, 30)],
  };
}
