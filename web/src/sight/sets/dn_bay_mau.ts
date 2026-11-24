// Rừng dừa Bảy Mẫu (Cẩm Thanh). Trục x: tây → đông; trục z: bắc → nam. Cửa Đại và biển ở phía đông bắc.
// Cả tuyến đi TRÊN NƯỚC bằng thuyền thúng: bến thuyền phía nam → lạch dừa nước → bãi múa thúng → chỗ quăng chài → bia di tích → nhà lá dừa.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, palm, person, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { baked, coracle, egret, hollowCoracle, nipa } from './_extra.ts';
import type { Spots } from './_extra.ts';

const WATER = 0x8ec9b4, DEEP = 0x4f8f7c, MUD = 0x6a5a40, BANK = 0x7a9a4a, WY = -0.42, BY = -0.24;
export function bayMau(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.add(box(DEEP, 0, -2.2, 0, 900, 1, 900)); kit.water(WATER, 0, 0, 900, 900, WY, 0.82);
  const path = [V(0, BY, 78), V(0, BY, 60), V(-2, BY, 40), V(-10, BY, 22), V(-14, BY, 4), V(-8, BY, -14), V(0, BY, -30), V(10, BY, -44), V(18, BY, -58), V(14, BY, -74), V(10, BY, -88), V(2, BY, -100), V(-10, BY, -112), V(-14, BY, -124)];
  const HALF = 3;
  // khoảng nước rộng (không mọc dừa): quanh lối đi, bãi múa thúng, chỗ quăng chài
  const open = (x: number, z: number) => { let d = 1e9; for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (a.distanceToSquared(b) || 1))); d = Math.min(d, Math.hypot(x - a.x - (b.x - a.x) * t, z - a.z - (b.z - a.z) * t)); } return d < HALF + 3.4 || Math.hypot(x - 2, z + 30) < 15 || Math.hypot(x - 26, z + 56) < 12 || (Math.abs(x) < 22 && z > 56) || z > 84 || Math.hypot(x - 26, z + 90) < 12 || (x < -14 && z < -112) || x < -112; };
  // rừng dừa nước: bụi dày hai bên lạch, gốc ngập nước trên các gò bùn thấp
  for (let i = 0; i < 520; i++) { const x = -90 + r() * 180, z = -150 + r() * 250; if (open(x, z)) continue; const n = nipa(r, 5 + r() * 3.5); n.position.set(x, WY - 0.1, z); n.scale.setScalar(0.9 + r() * 0.5); kit.add(n); if (i % 5 === 0) kit.add(ball(MUD, x, WY - 0.05, z, 2.4 + r() * 2, 0.3, 2.2 + r() * 2)); }
  // hàng dừa nước sát mép lạch, tàu lá vươn ra che lối
  const keepClear = (x: number, z: number) => Math.hypot(x - 2, z + 30) < 13 || z > 54 || Math.hypot(x - 26, z + 90) < 15 || Math.hypot(x - 24, z + 57) < 11 || (x < -13 && z < -110) || Math.hypot(x - 14, z + 72) < 6;
  for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], d = b.clone().sub(a), len = d.length(), n = Math.max(1, Math.floor(len / 3.4)), nx = -d.z / len, nz = d.x / len; for (let k = 0; k < n; k++) for (const sd of [-1, 1]) { const q = a.clone().lerp(b, (k + 0.5) / n), x = q.x + nx * (HALF + 4.6) * sd, z = q.z + nz * (HALF + 4.6) * sd; if (keepClear(x, z) || open(x, z)) continue; const nn = nipa(r, 6 + r() * 2.5); nn.position.set(x, WY - 0.1, z); kit.add(nn); } }
  // nền xa: bờ đất, dừa cao, phía đông bắc thấp thoáng Cửa Đại và biển
  kit.add(box(BANK, 0, -0.5, 250, 900, 1.2, 300), box(BANK, -260, -0.5, 0, 300, 1.2, 900), box(0xf3e6b8, 250, -0.5, -260, 300, 1.1, 60), box(0x2f8fd0, 320, -0.44, -420, 500, 1.1, 260));
  for (let i = 0; i < 40; i++) { const p = palm(r, 8 + r() * 4); p.position.set(-130 + r() * 30 - (i % 2) * 120 * 0, 0.1, -150 + i * 8); kit.add(p); } for (let i = 0; i < 22; i++) { const p = palm(r, 8 + r() * 4); p.position.set(-110 + i * 11, 0.1, 104 + r() * 10); kit.add(p); }
  // ---- bến thuyền thúng: cầu gỗ, nhà chờ mái lá, hàng chục thuyền thúng neo, áo phao cam
  kit.add(box(0x9a7150, 0, 0.5, 92, 30, 0.3, 14), box(0x9a7150, 0, 0.5, 80, 5, 0.3, 12)); for (let x = -14; x <= 14; x += 4) for (const z of [86, 98]) kit.add(cyl(0x6a5038, x, -0.6, z, 0.2, 2.4)); for (const x of [-2.4, 2.4]) for (const z of [75, 81]) kit.add(cyl(0x6a5038, x, -0.6, z, 0.18, 2.4));
  kit.add(box(0xf1dfb0, 0, 2.3, 97, 16, 3, 5), gable(0xb59a5a, 0, 3.8, 96, 9, 2.2, 20, Math.PI / 2), box(0x9a7150, 0, 1.2, 94.4, 10, 1.2, 0.3)); for (let i = 0; i < 9; i++) kit.add(box(0xff7a1a, -4 + i, 2.2, 94.3, 0.7, 0.9, 0.2));
  for (let i = 0; i < 26; i++) { const c = coracle(1.2, 0xe2c58a, [0x6a5038, 0x7a5a3c, 0x5a4a38][i % 3]); c.position.set((i % 2 ? -1 : 1) * (5 + Math.floor(i / 2) % 5 * 3.2), WY - 0.25, 62 + Math.floor(i / 10) * 5 + (i % 5) * 1.4); if (Math.abs(c.position.x) < 4.6) continue; kit.add(c, cyl(0xb89a5a, c.position.x + 0.5, WY + 0.5, c.position.z, 0.04, 1.6).rotateZ(1.1)); }
  for (let i = 0; i < 5; i++) { const p = person(i + 1, 1, [0x9b7fd6, 0x4aa3d8, 0xc98a5a][i % 3]); p.position.set(-6 + i * 3, 0.65, 88 + (i % 2) * 2); kit.add(p); }
  kit.live(label('Bến thuyền thúng Bảy Mẫu', 0, 8.6, 92, '#3f7a3a', 1.1));
  // thuyền thúng chở khách: người chèo đội nón lá đứng lắc mái chèo, hai khách mặc áo phao
  const tourBoat = (x: number, z: number, i: number, spin = false) => {
    const g = grp(x, WY - 0.2, z, r() * 6, coracle(1.25));
    const rower = person(i, 1, [0x6f8a9a, 0x9b7fd6, 0xc98a5a][i % 3]); rower.position.set(0, 0.3, -0.5); rower.scale.setScalar(0.9); g.add(rower, cyl(0xb89a5a, 0.3, 1.2, -1.0, 0.04, 2.4).rotateX(0.5), box(0xb89a5a, 0.3, 0.2, -1.6, 0.24, 0.5, 0.04));
    for (const s of [-1, 1]) { const p = person(i + s + 4, i % 2 ? 2 : 1, 0xff7a1a); p.position.set(s * 0.38, -0.15, 0.4); p.scale.setScalar(0.82); g.add(p); }
    const b = baked(g); kit.live(b); const bx = x, bz = z, ph = r() * 6;
    kit.onTick((t) => { if (spin) { b.rotation.y = t * 3.4; b.position.y = WY - 0.2 + Math.sin(t * 6.8) * 0.07; b.rotation.z = Math.sin(t * 3.4) * 0.16; } else { b.position.x = bx + Math.sin(t * 0.25 + ph) * 2.2; b.position.z = bz + Math.cos(t * 0.2 + ph) * 2.6; b.rotation.y = Math.sin(t * 0.3 + ph) * 1.2; b.position.y = WY - 0.2 + Math.sin(t * 1.4 + ph) * 0.04; } });
  };
  tourBoat(9, 46, 1); tourBoat(-20, 14, 2); tourBoat(-10, -22, 3); tourBoat(24, -72, 5);
  // ---- lạch dừa nước: biển gỗ, cò trắng đậu trên tàu lá, lờ bắt cua, bèo
  kit.live(signPost('Lạch dừa nước', -6.4, WY, 36, '#3f7a3a', 0.9));
  for (let i = 0; i < 12; i++) { const e = egret(); const k = Math.floor(r() * (path.length - 2)), p = path[k].clone().lerp(path[k + 1], r()); e.position.set(p.x + (r() < 0.5 ? -1 : 1) * (HALF + 1.6 + r() * 1.5), WY + 0.1 + (i % 3 === 0 ? 2.6 : 0), p.z); e.rotation.y = r() * 6; kit.add(e); }
  for (let i = 0; i < 9; i++) { const k = Math.floor(r() * (path.length - 2)), p = path[k].clone().lerp(path[k + 1], r()); kit.add(cyl(0xc9a36a, p.x + (i % 2 ? -1 : 1) * (HALF + 1.2), WY + 0.2, p.z, 0.34, 0.9).rotateZ(1.4), cyl(0x8a6a48, p.x + (i % 2 ? -1 : 1) * (HALF + 0.8), WY + 0.4, p.z + 0.6, 0.04, 1.8)); }
  for (let i = 0; i < 60; i++) { const k = Math.floor(r() * (path.length - 1)), p = path[k].clone().lerp(path[Math.min(path.length - 1, k + 1)], r()); kit.add(cyl(0x5fae4f, p.x + (r() - 0.5) * 9, WY + 0.02, p.z + (r() - 0.5) * 4, 0.3 + r() * 0.3, 0.03)); }
  // ---- bãi múa thúng: khoảng nước rộng, thuyền xoay tít tung bọt trắng, khách vỗ tay xem
  tourBoat(6, -32, 7, true); tourBoat(-9, -37, 8); tourBoat(12, -22, 9);
  kit.motes(40, 0xffffff, 0.6, () => V(6, WY + 0.2, -32), (p, i, t) => { const a = t * 3.4 + i * 0.6, d = 1.5 + ((t * 2 + i * 0.37) % 1) * 2.4; p.set(6 + Math.cos(a) * d, WY + 0.15 + Math.sin(((t * 2 + i * 0.37) % 1) * 3.14) * 0.9, -32 + Math.sin(a) * d); });
  kit.live(label('Bãi múa thúng', 4, 7.4, -36, '#c9861c', 1.0));
  // ---- chỗ quăng chài: ngư dân đứng trên thuyền gỗ tung lưới xoè tròn
  const FX = 26, FZ = -57;
  kit.add(grp(FX, WY - 0.1, FZ, 0.6, ball(0x6a5038, 0, 0.2, 0, 0.9, 0.5, 3.4), box(0x8a6a48, 0, 0.55, 0, 1.3, 0.08, 4.6)));
  const fisher = person(4, 1, 0x6f8a9a); fisher.position.set(FX, WY + 0.5, FZ); fisher.rotation.y = 1.9; kit.add(fisher, basket2(FX - 0.6, WY + 0.5, FZ + 1.4));
  const net = new THREE.Mesh(new THREE.ConeGeometry(1, 0.5, 18, 3, true), new THREE.MeshBasicMaterial({ color: 0xf4f6f0, wireframe: true, transparent: true, opacity: 0.9 })); kit.live(net);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 5, 22).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9aa39a })); kit.live(rim);
  kit.onTick((t) => { const k = (t * 0.28) % 1, fly = Math.min(1, k / 0.55), s = 0.4 + fly * 3.4, x = FX - 1.5 - fly * 5.5, y = WY + 2.4 + Math.sin(fly * 3.14) * 2.6 - (k > 0.55 ? (k - 0.55) / 0.45 * 2.2 : 0) - fly * 1.6, z = FZ + 0.6 + fly * 2; net.position.set(x, y + 0.25 * s * 0.3, z); net.scale.set(s, s * 0.6, s); rim.position.set(x, y, z); rim.scale.setScalar(s); net.visible = rim.visible = k < 0.96; });
  kit.live(label('Quăng chài', FX - 2, 7, FZ, '#3f6f8f', 0.9));
  // ---- bia di tích trên gò đất: bia đá, ngôi sao đỏ, bậc lên, cờ, hàng dừa
  const MX = 26, MZ = -90;
  kit.add(cyl(BANK, MX, 0.1, MZ, 11, 1.4, 9), cyl(0xb9b2a4, MX, 0.9, MZ, 4.6, 0.3), box(0x8f8a80, MX, 1.4, MZ, 3.4, 0.7, 1.6), box(0x6f6a62, MX, 3.4, MZ, 2.4, 3.4, 0.6), box(0xd8cfb8, MX - 0.02, 3.3, MZ + 0.32, 1.8, 2.2, 0.04).rotateY(0), cone(0x6f6a62, MX, 5.5, MZ, 1.4, 0.9, 0.5));
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.42, 5), new THREE.MeshBasicMaterial({ color: 0xd61f26, side: THREE.DoubleSide })); star.position.set(MX - 1.26, 4.3, MZ + 0.2); star.rotation.set(0, -Math.PI / 2, Math.PI / 10); kit.live(star);
  kit.add(box(0xd8cfb8, MX - 1.24, 3.1, MZ, 0.04, 1.6, 0.4), box(0x9a7150, MX - 8.6, 0.3, MZ + 0.6, 5, 0.24, 2.2), cyl(0xd8d8d8, MX + 3, 3.4, MZ - 1, 0.06, 5.6), box(0xd61f26, MX + 3.8, 5.6, MZ - 1, 1.5, 1, 0.05));
  for (let i = 0; i < 5; i++) { const p = palm(r, 7 + r() * 2); p.position.set(MX + 4 + r() * 5, 0.7, MZ - 5 + i * 2.6); kit.add(p); } for (let i = 0; i < 6; i++) kit.add(bead([0xffd23f, 0xffffff][i % 2], MX - 2.2, 1.9, MZ - 1 + i * 0.4, 0.14));
  kit.live(label('Di tích căn cứ rừng dừa Bảy Mẫu', MX, 8.6, MZ, '#8a2a22', 0.8));
  // ---- nhà lá dừa: nhà sàn mái lá trên cọc, sàn gỗ ra mép nước, bàn kết châu chấu, nhẫn lá dừa
  const HX = -22, HZ = -126;
  kit.add(box(BANK, HX - 20, -0.3, HZ - 4, 56, 1.2, 40));
  const hutL = (x: number, z: number, ry: number, s = 1) => { const g = grp(x, 0.3, z, ry); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0x6a5038, sx * 2.6 * s, 0.6, sz * 2 * s, 0.14, 1.8)); g.add(box(0x9a7150, 0, 1.3, 0, 6.4 * s, 0.2, 5 * s), box(0xc9a877, 0, 2.5, -1 * s, 5.6 * s, 2.2, 2.6 * s), gable(0xa8894a, 0, 3.5, 0, 6 * s, 2.2, 7.6 * s, Math.PI / 2), box(0x8a6f3a, 0, 3.56, 2.9 * s, 7.6 * s, 0.14, 0.5), box(0x3a2a20, -1 * s, 2.3, 0.32 * s, 1, 1.8, 0.06)); kit.add(g); };
  hutL(HX, HZ, 0.4); hutL(HX - 12, HZ - 6, 0.1, 0.9); hutL(HX - 4, HZ - 14, -0.2, 0.8);
  kit.add(box(0x9a7150, -15, 0.2, -127, 5, 0.24, 9, 0.3), box(0x8a6a48, HX + 3.4, 1.9, HZ + 3.2, 2.6, 0.1, 1.2));
  for (let i = 0; i < 7; i++) kit.add(cone(0x7ccf4f, HX + 2.4 + i * 0.32, 2.06, HZ + 3.2, 0.06, 0.34).rotateZ(1.3), bead(0x9be07a, HX + 2.4 + i * 0.32, 2.0, HZ + 2.9, 0.07));
  const crafter = person(6, 1, 0x9b7fd6); crafter.position.set(HX + 3.4, 1.4, HZ + 2); kit.add(crafter); const kid = person(2, 0, 0xffd23f); kid.scale.setScalar(0.7); kid.position.set(HX + 4.6, 1.4, HZ + 4.4); kid.rotation.y = 3.4; kit.add(kid);
  for (let i = 0; i < 8; i++) { const t = i % 2 ? palm(r, 8 + r() * 3) : tree(r, 1.2 + r(), true); t.position.set(HX - 30 + r() * 30, 0.3, HZ - 18 + r() * 8); kit.add(t); }
  kit.live(label('Nhà lá dừa', HX, 8.4, HZ, '#8a6f3a', 1.0));
  // ---- thuyền thúng của người chơi: bám theo nhân vật, có người chèo ngồi sau
  const mine = hollowCoracle(1.35, 0.8); const rower = person(12, 1, 0x6f8a9a); rower.scale.setScalar(0.86); rower.position.set(0, -0.36, 0.86); const oar = cyl(0xb89a5a, 0.5, 0.5, 1.5, 0.04, 2.6); oar.rotation.x = -0.7; mine.add(bakedLocal(rower), oar); kit.live(mine);
  let lx = path[0].x, lz = path[0].z, head = 0;
  kit.onTick((t, dt, pl) => { const dx = pl.pos.x - lx, dz = pl.pos.z - lz; if (Math.hypot(dx, dz) > 0.002) { const want = Math.atan2(dx, dz) + Math.PI; let d = want - head; d = Math.atan2(Math.sin(d), Math.cos(d)); head += d * Math.min(1, dt * 4); oar.rotation.z = Math.sin(t * 5) * 0.5; } lx = pl.pos.x; lz = pl.pos.z; mine.position.set(pl.pos.x, BY + 0.02 + Math.sin(t * 1.7) * 0.03, pl.pos.z); mine.rotation.set(Math.sin(t * 1.3) * 0.03, head, Math.cos(t * 1.1) * 0.03); });
  void bead; void cone;

  return {
    path, half: HALF, npcs: 0, startYaw: 0,
    stops: [
      { id: 'ben_thuyen', at: V(0, BY, 72), look: V(0, 3, 96) },
      { id: 'lach_dua', at: V(-10.6, BY, 21), look: V(-16, 5, -6) },
      { id: 'mua_thung', at: V(-1, BY, -28), look: V(6, 0.6, -32) },
      { id: 'quang_chai', at: V(17.2, BY, -57), look: V(FX - 3, 1.6, FZ + 1) },
      { id: 'can_cu', at: V(11.4, BY, -86), look: V(MX, 3.4, MZ) },
      { id: 'nha_la', at: V(-13.6, BY, -123), look: V(HX, 3, HZ) },
    ],
    sky: [0x6fb8ee, 0xe8f6e6], fog: [0xd6ecd8, 70, 520],
    light: { ambient: 1.7, sun: 1.6, sunColor: 0xfff6d6, sunDir: [0.4, 1, 0.3] },
    shopSpots: [V(-8, 0.65, 90), V(-18, 0.4, -122), V(8, 0.65, 90)],
  };
}
function basket2(x: number, y: number, z: number): THREE.Group { return grp(x, y, z, 0, cyl(0xc9a36a, 0, 0.2, 0, 0.36, 0.4), cyl(0x9fb0b8, 0, 0.4, 0, 0.3, 0.05)); }
function bakedLocal(g: THREE.Group): THREE.Object3D { return baked(g); }
