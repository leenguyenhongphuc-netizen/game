// Phố cổ Hội An lúc chạng vạng. Trục x: tây → đông; trục z: bắc → nam.
// Ba dãy phố chạy đông–tây song song sông Hoài ở phía nam: Trần Phú (z=0), Nguyễn Thái Học (z=26), Bạch Đằng ven sông (z=48).
// Chùa Cầu ở đầu TÂY Trần Phú, bắc qua một lạch nhỏ; Hội quán Phúc Kiến ở phía bắc Trần Phú về phía đông; chợ ở đầu ĐÔNG.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, bench, bicycle, bin, boat, box, cone, cyclo, cyl, gable, glow, grp, hip, incenseUrn, label, lampPost, lantern, lanternString, LANTERN_COLORS, palm, person, potPlant, reflection, shopSign, stall, stele, templeRoof, tree, wayPost } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const WALLS = [0xf0b93a, 0xf6c653, 0xe6a82e, 0xf8d476, 0xf0b93a, 0xf4e7c4], ROOFS = [0x7a4a36, 0x8a5540, 0x6a5a40, 0x74482f], MOSS = [0x5f6a44, 0x6a7350, 0x54603c], WOOD = 0x4a2c1c, WARM = 0xffd98a, SHUT = [0x3f7f6a, 0x4a6f8f, 0x3f6f5f, 0x6a5a3a];
// ---- mặt tiền dán ảnh nét cao: /art/tex/hoi-an-pho.jpg là dải nhà phố nhìn thẳng (2048×581), dùng bốn căn giữa.
const TEX_W = 2048, TEX_H = 581, HOUSE_X: [number, number][] = [[359, 690], [702, 1018], [1035, 1361], [1373, 1704]];
const PY = { roof: [64, 143], upper: [143, 528], lower: [343, 528], awning: [302, 343] } as const;
/** Gom các tấm phẳng dán ảnh vào một lưới duy nhất (một lần vẽ). */
class Facades {
  private pos: number[] = []; private uv: number[] = []; private nor: number[] = [];
  /** a: dưới trái, b: dưới phải, c: trên phải, d: trên trái (nhìn từ phía trước). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, x0: number, x1: number, py: readonly [number, number]): void {
    const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize(), u0 = x0 / TEX_W, u1 = x1 / TEX_W, v0 = 1 - py[1] / TEX_H, v1 = 1 - py[0] / TEX_H;
    for (const [p, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]] as const) { this.pos.push(p.x, p.y, p.z); this.uv.push(u, v); this.nor.push(n.x, n.y, n.z); }
  }
  build(): THREE.Mesh {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}art/tex/hoi-an-pho.jpg`); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 });
    return new THREE.Mesh(g, m);
  }
}
let FAC: Facades | null = null;
type LocalQuad = { p: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]; x: [number, number]; py: readonly [number, number] };
/** Nhà phố Hội An: tường vàng nghệ, mái ngói nâu rêu, cửa gỗ sẫm, mái hiên, đèn lồng, đôi khi có giàn hoa giấy. Mặt tiền quay về +z, gốc ở giữa chân mặt tiền.
 *  Khi đang gom mặt tiền dán ảnh (FAC), mặt tiền, mái hiên và mái trước là ảnh nét cao; phần khối chỉ còn thân nhà, mái, cột hiên và đèn lồng. */
export function shophouse(w: number, d: number, floors: number, r: () => number, lit = true, detail = true): THREE.Group {
  const g = new THREE.Group(), wall = WALLS[Math.floor(r() * WALLS.length)], roof = ROOFS[Math.floor(r() * ROOFS.length)], h = floors === 2 ? 6.2 : 3.9;
  g.add(box(wall, 0, h / 2, -d / 2, w - 0.12, h, d));
  g.add(gable(roof, 0, h, -d / 2, d + 0.5, 1.7, w, Math.PI / 2), box(0xf1e6c8, -w / 2 + 0.12, h + 0.5, -d / 2, 0.24, 1.3, d * 0.86), box(0xf1e6c8, w / 2 - 0.12, h + 0.5, -d / 2, 0.24, 1.3, d * 0.86));
  const awY = floors === 2 ? 3.05 : 2.75;
  const aw = box(roof, 0, awY, 0.75, w - 0.1, 0.12, 1.7); aw.rotation.x = 0.32; g.add(aw);
  for (const s of [-1, 1]) g.add(cyl(WOOD, s * (w / 2 - 0.25), awY / 2 - 0.1, 1.35, 0.07, awY - 0.25));
  for (const s of [-1, 1]) if (r() < 0.75) g.add(lantern(LANTERN_COLORS[Math.floor(r() * LANTERN_COLORS.length)], s * (w / 2 - 0.7), awY - 0.6, 1.5));
  if (r() < 0.3) { const sx = r() < 0.5 ? -1 : 1; for (let i = 0; i < 5; i++) g.add(bead(i % 2 ? 0xe85aa0 : 0xf07ab8, sx * (w / 2 - 0.4 - r() * 1.4), 3.3 + r() * 1.2, 1.0 + r() * 0.8, 0.5 + r() * 0.3)); g.add(cyl(0x5a4a34, sx * (w / 2 - 0.3), 1.6, 1.3, 0.06, 3.2)); }
  if (r() < 0.35) g.add(box(0x8a6a48, (r() - 0.5) * 2, 0.3, 1.5, 0.9, 0.6, 0.5), ball(0x5cb85f, (r() - 0.5) * 2, 0.9, 1.5, 0.4));
  if (FAC) {
    const hx = HOUSE_X[Math.floor(r() * HOUSE_X.length)], x0 = -w / 2 + 0.06, x1 = w / 2 - 0.06, zf = 0.03, q: LocalQuad[] = [];
    q.push({ p: [V(x0, 0, zf), V(x1, 0, zf), V(x1, h, zf), V(x0, h, zf)], x: hx, py: floors === 2 ? PY.upper : PY.lower });
    // mái hiên và mái trước: ảnh ngói nằm theo đúng mặt dốc
    const c = Math.cos(0.32) * 0.86, sn = Math.sin(0.32) * 0.86;
    q.push({ p: [V(x0, awY - sn + 0.08, 0.75 + c), V(x1, awY - sn + 0.08, 0.75 + c), V(x1, awY + sn + 0.08, 0.75 - c), V(x0, awY + sn + 0.08, 0.75 - c)], x: hx, py: PY.awning });
    q.push({ p: [V(x0, h + 0.04, 0.26), V(x1, h + 0.04, 0.26), V(x1, h + 1.72, -d / 2), V(x0, h + 1.72, -d / 2)], x: hx, py: PY.roof });
    g.userData.quads = q;
    if (detail) for (const sx of [-1, 1]) if (r() < 0.4) { const pp = potPlant([0xe85aa0, 0xffd23f, 0xf3ead2][Math.floor(r() * 3)], 0.9); pp.position.set(sx * (w / 2 - 0.5), 0, 1.75); g.add(pp); }
    return g;
  }
  g.add(box(0x8a7a66, 0, 0.18, 0.03, w - 0.1, 0.36, 0.1));
  // cửa gỗ tầng trệt
  const dw = Math.min(2.2, w * 0.42); g.add(box(WOOD, 0, 1.25, 0.04, dw, 2.5, 0.12), box(0x2a1a12, 0, 1.2, 0.08, dw * 0.46, 2.3, 0.08));
  for (const s of [-1, 1]) if (w > 4.6) g.add(box(WOOD, s * (w / 2 - 0.9), 1.5, 0.04, 1.0, 1.5, 0.1), box(lit && r() < 0.6 ? glow(WARM) : 0x3a2a20, s * (w / 2 - 0.9), 1.5, 0.08, 0.7, 1.2, 0.06));
  if (floors === 2) {
    g.add(box(WOOD, 0, 3.75, 0.5, w - 0.3, 0.1, 1.0), box(WOOD, 0, 4.15, 0.98, w - 0.3, 0.7, 0.06));
    const n = w > 5.4 ? 3 : 2; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * (w / n) * 0.86; g.add(box(0x3f6f5f, x, 4.9, 0.04, 1.0, 1.5, 0.1), box(lit && r() < 0.55 ? glow(WARM) : 0x2a332e, x, 4.9, 0.08, 0.6, 1.2, 0.06)); }
  }
  g.add(box(0x2a1a12, 0, 2.72, 0.12, Math.min(2.4, w * 0.5), 0.4, 0.06), box(0xd9a83a, 0, 2.72, 0.16, Math.min(2.0, w * 0.4), 0.16, 0.03));
  if (detail) {
    const slope = Math.atan2(1.7, (d + 0.5) / 2), sl = Math.hypot(1.7, (d + 0.5) / 2), n = Math.max(3, Math.round(w / 1.5)), shut = SHUT[Math.floor(r() * SHUT.length)];
    for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * w - w / 2; g.add(box(i % 3 === 1 ? MOSS[Math.floor(r() * 3)] : shade2(roof, 0.86), x, h + 0.9, -d / 2 + (d + 0.5) / 4, 0.2, 0.1, sl).rotateX(slope)); }
    g.add(box(shade2(wall, 0.8), 0, 0.62, 0.02, w - 0.14, 0.5, 0.06), box(0xf4ead0, 0, h - 0.16, 0.03, w - 0.1, 0.3, 0.08));
    if (floors === 2) { const m = w > 5.4 ? 3 : 2; for (let i = 0; i < m; i++) { const x = (i - (m - 1) / 2) * (w / m) * 0.86; for (const sx of [-1, 1]) g.add(box(shut, x + sx * 0.72, 4.9, 0.1, 0.36, 1.5, 0.05)); } }
    if (r() < 0.6) { const sg = shopSign(Math.min(1.8, w * 0.36), r() < 0.5 ? 0x7a2e22 : 0x2a1a12); sg.position.set((r() - 0.5) * (w - 2.4), 3.42, 1.62); g.add(sg); }
  }
  return g;
}
const shade2 = (c: number, k: number): number => new THREE.Color(c).multiplyScalar(k).getHex();
/** Chuyển các tấm dán ảnh của một căn nhà đã đặt vào lưới chung. */
function flush(h: THREE.Group): void {
  const q = h.userData.quads as LocalQuad[] | undefined; if (!q || !FAC) return; h.updateMatrix();
  for (const k of q) { const [a, b, c, d] = k.p.map((v) => v.applyMatrix4(h.matrix)); FAC.quad(a, b, c, d, k.x[0], k.x[1], k.py); }
}
/** Một dãy nhà phố từ x0 tới x1; face = +1 mặt tiền quay về nam (+z), -1 quay về bắc. Bỏ trống các khoảng trong gaps. */
export function shopRow(kit: Kit, x0: number, x1: number, zFront: number, face: number, depth: number, gaps: [number, number][], lit = true, detail = true): void {
  let x = x0; const r = kit.r;
  while (x < x1 - 3.6) {
    const w = Math.min(x1 - x, 4.4 + r() * 2.4), gap = gaps.find(([a, b]) => x < b && x + w > a);
    if (gap) { if (gap[0] - x > 3.6) { const ww = gap[0] - x; const h = shophouse(ww, depth, r() < 0.7 ? 2 : 1, r, lit, detail); h.position.set(x + ww / 2, 0, zFront); h.rotation.y = face > 0 ? 0 : Math.PI; kit.add(h); flush(h); } x = gap[1]; continue; }
    const h = shophouse(w, depth, r() < 0.68 ? 2 : 1, r, lit, detail); h.position.set(x + w / 2, 0, zFront); h.rotation.y = face > 0 ? 0 : Math.PI; kit.add(h); flush(h); x += w;
  }
}

export function hoiAn(kit: Kit, _s: Sight): SightSet {
  const r = kit.r, STONE = 0xa9987e, QUAY = 0x8f8474;
  FAC = new Facades();
  // ---- nền đất: bờ tây lạch, khu phố, bờ An Hội bên kia sông; nước nằm thấp hơn mặt phố
  kit.add(box(0x7f9a62, -200, -1.5, 0, 205, 3, 220), box(STONE, 22, -1.5, -24, 221, 3, 152), box(0x7f9a62, 0, -1.5, 150, 600, 3, 116), box(0x7f9a62, 240, -1.5, 0, 215, 3, 220));
  kit.water(0x1f6f86, 0, 40, 700, 400, -1.0, 1);
  kit.add(box(0x3fb0a0, -93, -0.96, -20, 13.2, 0.04, 120)); // lạch nước xanh ngọc dưới Chùa Cầu, khác hẳn màu đường và màu sông
  // ---- lát phố
  const lanes = [-70, -10, 50];
  for (const z of [0, 26]) { kit.add(box(0xa89a84, 22, 0.02, z, 221, 0.1, 6.4)); for (let x = -86; x < 132; x += 2.4) kit.add(box(0x978a75, x, 0.075, z, 0.06, 0.02, 6.2)); for (const sz of [-1, 1]) kit.add(box(0x7f7566, 22, 0.09, z + sz * 3.0, 221, 0.06, 0.3)); }
  kit.add(box(0xb09f86, 22, 0.02, 48, 221, 0.1, 7.6), box(QUAY, 22, -0.2, 52.1, 221, 0.6, 0.5));
  for (const x of lanes) kit.add(box(0xb7a78c, x, 0.02, 24, 6.4, 0.1, 54));
  kit.add(box(0xb7a78c, 100, 0.02, 24, 6.4, 0.1, 54), box(0xb7a78c, -112, 0.02, 2, 26, 0.1, 9));
  // ---- các dãy nhà
  const gaps: [number, number][] = [...lanes, 100].map((x) => [x - 3.4, x + 3.4] as [number, number]);
  shopRow(kit, -86, 132, -3.3, 1, 10, [...gaps.filter(([a]) => a < -5 || a > 60), [6, 34]]);        // bắc Trần Phú (chừa Hội quán)
  shopRow(kit, -86, 132, 3.3, -1, 9.5, [...gaps, [11, 29]]); shopRow(kit, -86, 132, 22.7, 1, 9.5, [...gaps, [-58, -42]]);            // giữa Trần Phú và Nguyễn Thái Học
  shopRow(kit, -86, 96, 29.3, -1, 7.4, [...gaps, [-55, -45]]); shopRow(kit, -86, 96, 44.3, 1, 7.4, gaps, true); // nam Nguyễn Thái Học, lưng ra sông
  shopRow(kit, -170, -101, -4.6, 1, 9, [[-124, -116]]); shopRow(kit, -170, -101, 9.2, -1, 9, [[-124, -104]]);
  // ---- cổng phố đi bộ ở đầu tây
  kit.add(cyl(WOOD, -120, 2.6, -1.6, 0.22, 5.2), cyl(WOOD, -120, 2.6, 7.6, 0.22, 5.2), box(WOOD, -120, 5.0, 3, 0.3, 0.5, 10), box(0x6a4a3a, -120, 5.5, 3, 1.2, 0.16, 10.6));
  kit.add(lanternString(V(-120, 4.7, -1.4), V(-120, 4.7, 7.4), 5, r, 0.3));
  kit.live(label('Phố cổ Hội An', -120, 6.6, 3, '#7a2e22', 1.0));

  // ---- Chùa Cầu: bắc qua lạch (x từ -99.6 tới -86.4), thân gỗ đỏ sẫm, mái ngói âm dương, miếu nhỏ ở phía bắc
  const bx = -93, deckY = (x: number) => 0.95 * Math.max(0, 1 - ((x - bx) / 6.6) ** 2);
  for (let i = 0; i < 6; i++) { const x0 = bx - 6.6 + i * 2.2, xm = x0 + 1.1, y = deckY(xm); const pl = box(0x6b4a34, xm, y - 0.12, 0, 2.3, 0.22, 5.4); pl.rotation.z = Math.atan2(deckY(x0 + 2.2) - deckY(x0), 2.2); kit.add(pl); }
  for (const px of [-4.4, -1.5, 1.5, 4.4]) for (const pz of [-2.3, 2.3]) kit.add(box(0x9a9488, bx + px, -0.4, pz, 0.8, 2.6, 0.8));
  for (const px of [-3, 0, 3]) kit.add(box(0x7f776b, bx + px, 0.25, 0, 0.5, 0.5, 5.6));
  for (const sz of [-1, 1]) {
    kit.add(box(0x8f2a20, bx, 1.5, sz * 2.7, 12.4, 1.15, 0.16), box(0x5c2018, bx, 2.12, sz * 2.7, 12.6, 0.14, 0.26), box(0x5c2018, bx, 4.3, sz * 2.7, 12.6, 0.22, 0.24));
    for (let i = 0; i < 7; i++) kit.add(box(0x5c2018, bx - 6 + i * 2, 2.6, sz * 2.7, 0.24, 4.2, 0.24));
    for (let i = 0; i < 6; i++) kit.add(box(0x8f3a2a, bx - 5 + i * 2, 1.5, sz * 2.74, 1.4, 0.7, 0.06));
  }
  kit.add(gable(0x4f6b4a, bx, 4.4, 0, 7.4, 1.7, 13.4, Math.PI / 2), gable(0x446040, bx, 5.3, 0, 5.0, 1.5, 5.2, Math.PI / 2), box(0x3d443a, bx, 6.86, 0, 5.6, 0.16, 0.3), box(0x3d443a, bx, 6.14, 0, 13.8, 0.14, 0.26));
  for (const s of [-1, 1]) { const k = cone(0x3d443a, bx + s * 7.0, 6.3, 0, 0.14, 0.9); k.rotation.z = -s * 1.1; kit.add(k); for (let i = 0; i < 9; i++) kit.add(box(0x6a755f, bx - 6 + i * 1.5, 5.2, s * 1.9, 0.18, 0.1, 3.6).rotateX(s * 0.44)); }
  // hai đầu cầu: cổng xây vôi hồng xám có vòm, tượng khỉ (đầu tây) và chó (đầu đông)
  for (const s of [-1, 1]) {
    const ex = bx + s * 6.5;
    for (const sz of [-1, 1]) kit.add(box(0xb86a5a, ex, 2.2, sz * 2.2, 0.7, 4.4, 1.3), box(0x9a4a3a, ex + s * 0.1, 1.2, sz * 3.4, 0.5, 0.5, 0.5), ball(s < 0 ? 0x8a6a4a : 0x9a8a7a, ex + s * 0.1, 1.72, sz * 3.4, 0.24, 0.3, 0.24), ball(s < 0 ? 0x8a6a4a : 0x9a8a7a, ex + s * 0.1, 2.14, sz * 3.4, 0.17));
    kit.add(box(0xb86a5a, ex, 4.5, 0, 0.7, 0.9, 5.7), box(0x7a2e22, ex + s * 0.38, 4.45, 0, 0.08, 0.5, 2.2), box(0xd9a83a, ex + s * 0.43, 4.45, 0, 0.04, 0.24, 1.7), gable(0x5b6652, ex, 4.95, 0, 6.6, 0.9, 1.5, Math.PI / 2));
    kit.add(lantern(0xff5a4a, ex + s * 0.5, 3.5, -1.2, 1.2), lantern(0xffb347, ex + s * 0.5, 3.5, 1.2, 1.2));
  }
  kit.add(box(0xd9b08a, bx, 2.6, -4.6, 4.6, 3.4, 3.4), gable(0x5b6652, bx, 4.3, -4.6, 5.4, 1.3, 4.2, 0), box(0x7a2e22, bx, 2.0, -2.86, 1.6, 2.4, 0.1), box(glow(0xffb347), bx, 2.0, -2.9, 0.9, 1.8, 0.1), box(0x8d8478, bx, -0.4, -4.6, 4.8, 2.8, 3.6));
  kit.live(label('Chùa Cầu', bx, 8.3, 0, '#5c2018', 0.9));
  // bờ kè lạch, cây, thuyền con
  for (const s of [-1, 1]) kit.add(box(QUAY, bx + s * 6.9, -0.2, 30, 0.5, 0.6, 46), box(QUAY, bx + s * 6.9, -0.2, -40, 0.5, 0.6, 72));
  const bt = boat(0x4a7f8f, 4.2, true); bt.position.set(bx + 1.5, -0.95, 14); bt.rotation.y = 0.2; kit.add(bt);
  for (const [x, z] of [[-112, 16], [-104, -9], [-83, 9.5], [-108, 26]] as const) { const t = tree(r, 1.1, true); t.position.set(x, 0, z); kit.add(t); }

  // ---- Nhà cổ Tấn Ký: mặt tiền gỗ sẫm ở phía nam Nguyễn Thái Học
  const tk = grp(-50, 0, 29.3, Math.PI);
  tk.add(box(0xe9d9b0, 0, 3.1, -4, 9.6, 6.2, 8), gable(0x5f5a44, 0, 6.2, -4, 8.6, 1.8, 9.8, Math.PI / 2), box(WOOD, 0, 1.5, 0.06, 9.0, 3.0, 0.14), box(0x2a1a12, 0, 1.3, 0.12, 2.0, 2.5, 0.08));
  for (const s of [-1, 1]) tk.add(box(0x3a2216, s * 3.0, 1.5, 0.14, 2.2, 2.2, 0.06), box(glow(WARM), s * 3.0, 1.7, 0.1, 1.5, 1.2, 0.04), cyl(WOOD, s * 4.5, 1.7, 1.4, 0.12, 3.4), lantern(0xff5a4a, s * 2.2, 2.7, 1.3, 1.3));
  const aw = box(0x5f5a44, 0, 3.5, 0.9, 9.6, 0.14, 2.0); aw.rotation.x = 0.3; tk.add(aw, box(0x2a1a12, 0, 4.4, 0.1, 3.6, 0.8, 0.08), box(0xd9a83a, 0, 4.4, 0.15, 3.0, 0.36, 0.04));
  for (let i = 0; i < 4; i++) tk.add(box(0x3f6f5f, -3.3 + i * 2.2, 5.3, 0.06, 1.2, 1.1, 0.1));
  kit.add(tk); kit.live(label('Nhà cổ Tấn Ký', -50, 7.4, 28.6, '#4a2c1c', 0.8));

  // ---- Hội quán Phúc Kiến: cổng tam quan hồng, nhiều tầng mái ngói xanh, sân trong và chính điện phía sau
  const hq = grp(20, 0, -5.4);
  const PINK = 0xe79a98, TILE = 0x3f8a68, RED = 0xb8322a;
  hq.add(box(PINK, 0, 2.8, 0, 6.2, 5.6, 1.2), box(PINK, -7.2, 2.1, 0, 5.4, 4.2, 1.0), box(PINK, 7.2, 2.1, 0, 5.4, 4.2, 1.0), box(0xf4e9dc, 0, 5.75, 0, 6.6, 0.3, 1.5));
  for (const [x, w, h] of [[0, 2.6, 3.6], [-7.2, 2.0, 2.8], [7.2, 2.0, 2.8]] as const) hq.add(box(0x2a1a12, x, h / 2, 0.02, w, h, 1.3), cyl(0x2a1a12, x, h, 0.02, w / 2, 1.3).rotateX(Math.PI / 2), box(RED, x, h / 2 - 0.2, 0.3, w * 0.9, h - 0.4, 0.1));
  hq.add(templeRoof(TILE, 0, 5.9, 0, 8.2, 1.3, 3.0, RED), box(PINK, 0, 7.9, 0, 4.2, 1.5, 0.9), templeRoof(TILE, 0, 8.6, 0, 6.0, 1.2, 2.6, RED), box(PINK, 0, 10.3, 0, 2.4, 1.0, 0.7), templeRoof(TILE, 0, 10.8, 0, 4.0, 1.1, 2.2, RED));
  for (const s of [-1, 1]) hq.add(templeRoof(TILE, s * 7.2, 4.2, 0, 6.6, 1.1, 2.6, RED), box(0xf4e9dc, s * 3.6, 2.4, 0.1, 0.5, 4.8, 1.3), ball(0xd8d2c4, s * 4.2, 0.9, 2.4, 0.6, 0.9, 0.6), box(0x8d8478, s * 4.2, 0.2, 2.4, 1.0, 0.4, 1.0), lantern(0xff5a4a, s * 1.9, 4.6, 1.0, 1.5));
  hq.add(box(RED, 0, 7.9, 0.5, 2.6, 0.9, 0.08), box(0xd9a83a, 0, 7.9, 0.56, 2.1, 0.44, 0.04));
  // sân trong + chính điện
  hq.add(box(0xb7a78c, 0, 0.03, -11, 22, 0.1, 20), box(0xd9c7a0, 0, 3, -23, 16, 6, 8), templeRoof(TILE, 0, 6, -23, 19, 2.4, 11, RED), box(RED, 0, 1.6, -18.9, 5, 3.2, 0.14), box(glow(0xffb347), 0, 1.6, -18.84, 3, 2.6, 0.1));
  for (const s of [-1, 1]) { hq.add(cyl(RED, s * 4, 2.2, -18.4, 0.3, 4.4), cyl(RED, s * 7, 2.2, -18.4, 0.3, 4.4), box(PINK, s * 11.4, 2, -11, 0.6, 4, 20)); const t = tree(r, 0.9); t.position.set(s * 7, 0, -9); hq.add(t); }
  hq.add(cyl(0x8d8478, 0, 0.5, -10, 1.6, 1.0), ball(0x6b7a5a, 0, 1.5, -10, 0.9, 1.1, 0.9));
  kit.add(hq); kit.live(label('Hội quán Phúc Kiến', 20, 13.3, -5.4, '#b8322a', 0.9));

  // ---- đèn lồng giăng ngang phố
  for (let x = -80; x < 130; x += 9) if (!gaps.some(([a, b]) => x > a - 2 && x < b + 2)) kit.add(lanternString(V(x, 5.4, -3.1), V(x, 5.4, 3.1), 4, r, 0.5));
  for (let x = -80; x < 96; x += 11) kit.add(lanternString(V(x, 5.4, 22.9), V(x, 5.4, 29.1), 4, r, 0.5));
  for (const [z0, z1] of [[4.5, 21.5], [30.5, 40]] as const) for (let z = z0; z <= z1; z += 2.1) kit.add(lanternString(V(46.8, 5.3 + (r() - 0.5) * 0.6, z), V(53.2, 5.3 + (r() - 0.5) * 0.6, z), 5, r, 0.6, 0.95));
  for (const z of [8, 14, 19, 33, 39]) for (const s of [-1, 1]) { const st = stall([0xe2573c, 0xffd23f, 0x4aa3d8][Math.floor(r() * 3)], r); st.scale.setScalar(0.7); st.position.set(50 + s * 2.6, 0, z); st.rotation.y = s * Math.PI / 2; for (let i = 0; i < 5; i++) st.add(lantern(LANTERN_COLORS[i], -1.2 + i * 0.6, 1.9, 1.0, 0.9)); kit.add(st); }
  kit.live(label('Phố đèn lồng', 50, 7.2, 12, '#7a2e22', 0.8));

  // ---- bến sông Hoài: kè đá, bậc xuống nước, thuyền nan thắp đèn, cầu An Hội, bờ An Hội bên kia
  for (let x = -84; x < 130; x += 12) { kit.add(lampPost(x, 0, 51.4, 3.8)); if (r() < 0.6) { const p = palm(r, 5.5); p.position.set(x + 5, 0, 51); kit.add(p); } }
  for (const x of [30, 62]) for (let i = 0; i < 4; i++) kit.add(box(QUAY, x, -0.2 - i * 0.22, 52.6 + i * 0.5, 6, 0.24, 0.6));
  const boats: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) { const b = boat([0x5a4030, 0x4a7f8f, 0x8a3a2a][i % 3], 5 + r() * 2, true); b.position.set(-60 + i * 22 + r() * 8, -0.95, 55 + r() * 24); b.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.5; if (i % 2) b.add(person(i).translateY(0.3).translateZ(1)); boats.push(b); kit.live(b); }
  kit.onTick((t) => boats.forEach((b, i) => { b.position.y = -0.95 + Math.sin(t * 1.3 + i) * 0.05; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.04; if (i % 3 === 0) { b.position.x += 0.012; if (b.position.x > 150) b.position.x = -110; } }));
  // cầu An Hội (ngay phía đông cửa lạch), giăng đèn
  const ab = grp(-72, 0, 71);
  ab.add(box(0x8d8478, 0, 0.3, 0, 5, 0.4, 40)); for (let i = 0; i < 5; i++) ab.add(box(0x7f776b, 0, -0.5, -16 + i * 8, 4, 1.6, 0.8));
  for (const s of [-1, 1]) { ab.add(box(0x5c2018, s * 2.4, 1.0, 0, 0.14, 0.14, 40)); for (let i = 0; i < 14; i++) ab.add(box(0x5c2018, s * 2.4, 0.75, -19 + i * 2.9, 0.12, 0.6, 0.12), lantern(LANTERN_COLORS[i % 7], s * 2.4, 2.6 + Math.sin(i / 13 * Math.PI) * 1.4, -19 + i * 2.9, 1.2)); }
  kit.add(ab); kit.live(label('Cầu An Hội', -72, 6.2, 60, '#5c2018', 0.8));
  // bờ An Hội: dãy nhà sáng đèn và chợ đêm
  shopRow(kit, -150, 180, 96, -1, 9, [[-76, -68]], true, false);
  for (let x = -60; x < 150; x += 7) { kit.add(lantern(LANTERN_COLORS[Math.floor(r() * 7)], x, 3.2, 93, 1.6), lantern(LANTERN_COLORS[Math.floor(r() * 7)], x + 3, 4.0, 93.4, 1.6)); }
  kit.add(box(QUAY, 15, -0.2, 91.8, 340, 0.6, 0.5));
  // hoa đăng trôi trên sông
  kit.motes(150, 0xffb866, 1.5, () => V(-110 + r() * 250, -0.86, 54 + r() * 34), (p, i, t, dt) => { p.x += (0.5 + (i % 5) * 0.08) * dt; p.z += Math.sin(t * 0.3 + i) * 0.004; if (p.x > 150) p.x = -110; });
  kit.live(label('Sông Hoài', 40, 3.4, 62, '#2d5f73', 0.8));

  // ---- Chợ Hội An ở đầu đông: nhà lồng vàng mái ngói đỏ, sạp hàng phía trước
  const cho = grp(113, 0, 34);
  cho.add(box(0xe9b647, 0, 3.2, 0, 22, 6.4, 20), hip(0x8a4a36, 0, 6.4, 0, 24, 3.4, 22), box(0xf1e6c8, 0, 8.4, 0, 9, 1.6, 8), hip(0x8a4a36, 0, 9.2, 0, 10.5, 1.8, 9.5));
  for (let i = 0; i < 5; i++) cho.add(box(0x2a1a12, -11.05, 1.7, -7 + i * 3.6, 0.1, 3.4, 2.4), box(glow(WARM), -11.1, 2.0, -7 + i * 3.6, 0.06, 2.4, 1.6));
  for (let i = 0; i < 5; i++) cho.add(box(0x2a1a12, -8 + i * 4, 1.7, 10.05, 2.6, 3.4, 0.1), box(glow(WARM), -8 + i * 4, 2.0, 10.1, 1.8, 2.4, 0.06));
  kit.add(cho); kit.live(label('Chợ Hội An', 104, 8.6, 46, '#8a4a36', 0.9));
  for (let i = 0; i < 6; i++) { const st = stall([0xe2573c, 0x4aa3d8, 0xffd23f, 0x7ccf4f][i % 4], r); st.position.set(84 + i * 4.4, 0, 45.2); st.rotation.y = 0; st.add(lantern(0xffb347, 0, 2.0, 1.0)); kit.add(st); }
  for (let i = 0; i < 3; i++) { const p = person(i + 3, 1); p.position.set(86 + i * 9, 0, 44.6); kit.add(p); }
  kit.add(box(0x8a6a48, 104, 0.5, 50.6, 3, 0.1, 1.6), cyl(0xffd23f, 104, 0.62, 50.6, 0.5, 0.12), cyl(0xf3ead2, 103.2, 0.64, 50.6, 0.3, 0.14), cyl(0xf3ead2, 104.8, 0.64, 50.6, 0.3, 0.14));

  // ---- chi tiết đường phố: xe đạp, xích lô, ghế đá, biển chỉ đường, thùng rác, giếng cổ, bia di sản, lư hương
  for (let x = -80; x < 128; x += 13) { if (gaps.some(([a, b]) => x > a - 3 && x < b + 3)) continue; const k = Math.floor(r() * 5), z = r() < 0.5 ? -2.55 : 2.55, o = k === 0 ? bicycle([0x3f6f8f, 0x8f3a2a, 0x2f7d6a][Math.floor(r() * 3)]) : k === 1 ? cyclo() : k === 2 ? bench(0x7a5a3c) : k === 3 ? potPlant(0xe85aa0, 1.3) : bicycle(0x555555); o.position.set(x, 0, z); o.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.3; kit.add(o); }
  for (let x = -78; x < 92; x += 17) { if (gaps.some(([a, b]) => x > a - 3 && x < b + 3)) continue; const o = r() < 0.5 ? cyclo(0x8f3a2a) : bicycle(); o.position.set(x, 0, 26 + (r() < 0.5 ? -2.5 : 2.5)); o.rotation.y = Math.PI / 2; kit.add(o); }
  for (const [x, z] of [[-73.4, -3], [-13.4, 23], [46.6, -3], [53.4, 45]] as const) { const w = wayPost(); w.position.set(x, 0, z); kit.add(w); }
  for (const [x, z] of [[-66, 2.7], [-6, 28.7], [56, 2.7], [70, 51]] as const) { const o = bin(); o.position.set(x, 0, z); kit.add(o); }
  const bia = stele(); bia.position.set(-116.5, 0, -1); bia.rotation.y = -0.5; kit.add(bia);
  // sân nhỏ đối diện nhà Tấn Ký và trước Hội quán: giếng cổ, ghế, chậu hoa
  kit.add(box(0xa89a84, -50, 0.02, 18.2, 16, 0.1, 9.6), cyl(0x8d8478, -45.5, 0.45, 17, 0.9, 0.9), cyl(0x1f6f86, -45.5, 0.86, 17, 0.7, 0.1), box(0xa89a84, 20, 0.02, 8.2, 18, 0.1, 9.6));
  for (const [x, z, ry] of [[-55, 15.5, 0], [-47, 14.6, 0.4], [14, 10.5, 0.2], [26, 10.5, -0.2]] as const) { const o = bench(0x8d8478); o.position.set(x, 0, z); o.rotation.y = ry; kit.add(o); }
  for (const [x, z] of [[-57, 20], [-43.4, 20.6], [12.4, 5.6], [27.6, 5.6], [12.4, 12], [27.6, 12]] as const) { const o = potPlant(0xffd23f, 1.5); o.position.set(x, 0, z); kit.add(o); }
  { const t = tree(r, 0.9); t.position.set(-55, 0, 18.4); kit.add(t); const u = incenseUrn(); u.position.set(20, 0, -0.4 - 2.4); u.scale.setScalar(0.9); kit.add(u); }
  // vệt đèn phản chiếu trên sông Hoài và khói bếp
  for (let x = -84; x < 130; x += 12) kit.add(reflection(0xffd98a, x, -0.93, 57, 0.8, 8, false, 0.14));
  for (let x = -60; x < 150; x += 7) kit.add(reflection(LANTERN_COLORS[Math.floor(r() * 7)], x, -0.93, 86, 0.9, 9, false, 0.22));
  kit.motes(24, 0xcfc6c0, 2.4, (i) => V([-30, 70, 118][i % 3], 9 + (i % 8), [-10, 14, 30][i % 3]), (p, i, _t, dt) => { p.y += 0.7 * dt; p.x += 0.25 * dt; if (p.y > 17) { p.y = 8.6; p.x = [-30, 70, 118][i % 3]; } });

  kit.live(FAC.build()); FAC = null;
  // ---- lối đi
  const path = [V(-134, 0, 3), V(-112, 0, 5), V(-103, 0, 0.6), V(-99.4, 0.1, 0), V(-96.3, 0.7, 0), V(-93, 0.95, 0), V(-89.7, 0.7, 0), V(-86.6, 0.1, 0), V(-70, 0, 0), V(-70, 0, 26), V(-10, 0, 26), V(-10, 0, 0), V(50, 0, 0), V(50, 0, 48), V(104, 0, 48)];
  return {
    path, half: 2.5, npcs: 14,
    stops: [
      { id: 'cong', at: V(-126, 0, 3.6), look: V(-120, 4.4, 3), cam: V(-134.5, 2.4, 4.2) },
      { id: 'chua_cau', at: V(-107, 0, 3.4), look: V(-93.5, 3.0, 0), cam: V(-104.5, 2.3, 15.5) },
      { id: 'nha_co', at: V(-56, 0, 24.4), look: V(-50, 3.4, 29.6), cam: V(-50, 3.3, 13.9) },
      { id: 'hoi_quan', at: V(14, 0, 1.6), look: V(20, 6.4, -5.4), cam: V(20, 2.6, 11.6) },
      { id: 'pho_den_long', at: V(50, 0, 9), look: V(50, 3.8, 24), cam: V(50, 2.5, 2.2) },
      { id: 'song_hoai', at: V(50, 0, 48.6), look: V(30, -0.5, 84), cam: V(57.5, 4.4, 50.6) },
      { id: 'cho', at: V(92, 0, 49), look: V(108, 5, 38), cam: V(80.5, 4.4, 51.2) },
    ],
    shopSpots: [{ at: V(-62, 0, -2.3), ry: 0 }, { at: V(-22, 0, 28.3), ry: Math.PI }, { at: V(34, 0, 2.3), ry: Math.PI }, { at: V(47.6, 0, 27), ry: Math.PI / 2 }, { at: V(70, 0, 45.4), ry: 0 }, { at: V(-114, 0, 7.4), ry: Math.PI }],
    sky: [0x27306a, 0xf5a66e], fog: [0x8a6f8a, 90, 380], fill: 0.7,
    light: { ambient: 1.55, ambientColor: 0xd6cff2, sun: 1.1, sunColor: 0xffbf96, sunDir: [-0.7, 0.55, 0.5] },
  };
}
