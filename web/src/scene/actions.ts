// Động tác làm vườn của nhân vật: tư thế tay, thân theo từng loại việc và đạo cụ cầm tay (cuốc, bình tưới, kéo, sọt…).
import * as THREE from 'three';

export type WorkKind = 'cuoc' | 'trong' | 'tuoi' | 'bon' | 'co' | 'tia' | 'phun' | 'thu';
export interface WorkBody { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Group; armR: THREE.Group }

const M = (c: number, rough = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
const box = (m: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const cyl = (m: THREE.Material, r: number, h: number, x = 0, y = 0, z = 0, r2 = r) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 8), m); o.position.set(x, y, z); return o; };
const ball = (m: THREE.Material, r: number, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m); o.position.set(x, y, z); return o; };

/** Đạo cụ gắn vào bàn tay (gốc toạ độ ở bàn tay, trục −y dọc theo cánh tay). `pro`: công cụ tốt hơn từ cấp 10. */
export function makeTool(kind: WorkKind, pro: boolean): THREE.Group {
  const g = new THREE.Group(), wood = M(0x8a5a2b), steel = M(0xb9c2cc, 0.4);
  if (kind === 'cuoc') {
    if (pro) { // máy xới mini
      g.add(box(M(0xd8442e), 0.34, 0.24, 0.3, 0, -0.5, 0.55), cyl(steel, 0.17, 0.3, 0, -0.68, 0.55).rotateZ(Math.PI / 2), cyl(wood, 0.03, 0.75, 0, -0.2, 0.25).rotateX(-0.9));
    } else { g.add(cyl(wood, 0.035, 1.1, 0, -0.1, 0.42).rotateX(Math.PI / 2 - 0.25), box(steel, 0.26, 0.05, 0.2, 0, -0.32, 0.95)); }
  } else if (kind === 'tuoi') {
    if (pro) { g.add(cyl(M(0x2f9e5a), 0.04, 0.6, 0, 0, 0.3).rotateX(Math.PI / 2), cyl(steel, 0.07, 0.14, 0, 0, 0.66, 0.03).rotateX(Math.PI / 2)); }
    else { g.add(cyl(M(0x3d8fd8), 0.17, 0.3, 0, -0.05, 0.12), cyl(M(0x3d8fd8), 0.03, 0.42, 0, 0.02, 0.42).rotateX(Math.PI / 2 - 0.5), ball(M(0x2b6fb0), 0.07, 0, 0.12, 0.6)); }
  } else if (kind === 'bon') { g.add(cyl(M(0xcaa46a), 0.16, 0.22, 0, -0.02, 0.1, 0.19), ball(M(0x6b4a2f), 0.14, 0, 0.08, 0.1)); }
  else if (kind === 'tia') { g.add(box(steel, 0.04, 0.04, 0.36, 0.03, 0, 0.2), box(steel, 0.04, 0.04, 0.36, -0.03, 0, 0.2), box(M(0xe2573c), 0.12, 0.06, 0.16, 0, 0, 0)); }
  else if (kind === 'phun') { g.add(cyl(M(0xf2c94c), 0.12, 0.34, 0, -0.05, 0.05), cyl(steel, 0.022, 0.6, 0, 0.05, 0.4).rotateX(Math.PI / 2), ball(steel, 0.05, 0, 0.05, 0.72)); }
  else if (kind === 'thu') { g.add(cyl(M(0xd9a35b), 0.2, 0.26, 0, -0.1, 0.12, 0.26), ball(M(0xff8a3d), 0.1, 0.06, 0.05, 0.12), ball(M(0xffd23f), 0.1, -0.07, 0.06, 0.1), ball(M(0x7ccf4f), 0.09, 0, 0.08, 0.2)); }
  else if (kind === 'trong') { g.add(cyl(M(0x6b4a2f), 0.08, 0.12, 0, -0.02, 0.1), cyl(M(0x4caf3f), 0.015, 0.22, 0, 0.14, 0.1), ball(M(0x7ccf4f), 0.07, 0.05, 0.25, 0.1), ball(M(0x4caf3f), 0.06, -0.05, 0.22, 0.1)); }
  else { g.add(ball(M(0x7ccf4f), 0.09, 0, 0, 0.08), ball(M(0x4caf3f), 0.07, 0.05, 0.06, 0.1)); } // nắm cỏ
  g.position.y = -0.46; g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return g;
}
/** Tay nào cầm đạo cụ. */
export const toolHand = (kind: WorkKind): 'L' | 'R' => (kind === 'thu' ? 'L' : 'R');
/** Thời điểm "chạm đất" trong động tác (0..1): lúc đó mới gửi lệnh và bắn hiệu ứng. */
export const HIT_AT = 0.55;

/** Đặt tư thế tại tiến độ k (0..1). t là đồng hồ cảnh để rung/lắc nhẹ. */
export function poseWork(b: WorkBody, kind: WorkKind, k: number, t: number, pro: boolean) {
  const ease = (x: number) => x * x * (3 - 2 * x), up = k < HIT_AT ? ease(k / HIT_AT) : 1 - ease((k - HIT_AT) / (1 - HIT_AT)); // 0 → 1 (chạm) → 0
  const L = b.armL.rotation, R = b.armR.rotation, root = b.root;
  root.rotation.x = 0; root.position.y = 0; L.x = 0; R.x = 0;
  if (kind === 'cuoc') {
    if (pro) { L.x = R.x = -1.0; root.position.y = Math.abs(Math.sin(t * 40)) * 0.03; root.rotation.x = 0.1; }
    else { const swing = k < HIT_AT ? -2.7 + 2.1 * ease(k / HIT_AT) * ease(k / HIT_AT) : -0.6 - 0.9 * ease((k - HIT_AT) / (1 - HIT_AT)); L.x = R.x = swing; root.rotation.x = 0.28 * up; }
  } else if (kind === 'trong' || kind === 'co') { root.position.y = -0.3 * up; root.rotation.x = 0.35 * up; R.x = -0.5 - 0.7 * up; L.x = -0.3 - 0.6 * up; if (kind === 'co') R.x = -1.2 + (k > HIT_AT ? -0.9 * ease((k - HIT_AT) / (1 - HIT_AT)) : 0.5 * up); }
  else if (kind === 'tuoi') { R.x = -1.15 - 0.25 * up + Math.sin(t * 9) * 0.05; L.x = -0.5 * up; root.rotation.x = 0.1 * up; }
  else if (kind === 'bon') { L.x = -1.0; R.x = -1.1 + Math.sin(k * Math.PI * 4) * 0.5; root.rotation.x = 0.12; }
  else if (kind === 'tia') { R.x = -1.9 + Math.sin(k * Math.PI * 6) * 0.18; L.x = -1.5 * up; }
  else if (kind === 'phun') { R.x = -1.3 + Math.sin(t * 7) * 0.12; L.x = -0.9; root.rotation.x = 0.06; }
  else { L.x = -0.9; R.x = -2.3 + 1.4 * (k < HIT_AT ? 0 : ease((k - HIT_AT) / (1 - HIT_AT))) + Math.sin(k * Math.PI * 2) * 0.2; } // thu hái: với lên rồi bỏ vào sọt
}
