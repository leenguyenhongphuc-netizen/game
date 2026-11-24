// Máy quay tham quan kiểu "cần lò xo" (spring arm): từ đầu nhân vật chiếu ngược ra sau bằng chùm 5 tia lên lớp vật CỨNG
// (tường, nhà, vách, đồi) dựng BVH (three-mesh-bvh, nhanh trên điện thoại). Vật MẢNH hoặc Ở TRÊN CAO (cột, thân cây, mái sạp,
// tán cây, mái hiên) không kéo máy quay vào mà được LÀM MỜ bằng shader: mọi mảnh nằm giữa máy quay và nhân vật, sát ống kính,
// hoặc mái ngay trên đầu khi nhân vật đứng dưới mái đều bị chấm thưa (dither) nên nhìn xuyên qua — không đổi góc, không giật.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Đồng phục dùng chung cho mọi chất liệu có "khoét nhìn xuyên". */
export const cutU = {
  uCam: { value: new THREE.Vector3() }, uHead: { value: new THREE.Vector3(0, -1000, 0) },
  /** Tâm vùng khoét mái (chân nhân vật) và độ khoét 0..1 khi đứng dưới mái. */
  uRoofC: { value: new THREE.Vector3(0, -1000, 0) }, uRoof: { value: 0 },
};
const CUT_R0 = 0.55, CUT_R1 = 1.05, LENS_R0 = 0.55, LENS_R1 = 1.2, ROOF_R0 = 5, ROOF_R1 = 8, ROOF_UP = 1.9;
/** Vật trên cao/khung trò chơi (lớp làm mờ) quanh ống kính: mờ trong 2,6 m, rõ dần tới 4,2 m — không bao giờ ngồi lọt trong rừng nan hoa, mái. */
const OVER_LENS0 = 2.6, OVER_LENS1 = 4.2;

/** Hàm kiểm tra giống hệt shader (dùng cho bài kiểm camera-qa): điểm p có đang bị khoét (≥ 0,5) không. */
export function cutAmount(p: THREE.Vector3, roof: boolean): number {
  const c = cutU.uCam.value, h = cutU.uHead.value, ab = h.clone().sub(c), t = Math.max(0, Math.min(1, p.clone().sub(c).dot(ab) / Math.max(1e-6, ab.lengthSq())));
  let k = 0; const d = p.distanceTo(c.clone().addScaledVector(ab, t)); if (t > 0.02 && t < 0.9) k = Math.max(k, 1 - smooth(CUT_R0, CUT_R1, d));
  k = Math.max(k, 1 - smooth(LENS_R0, LENS_R1, p.distanceTo(c)));
  if (roof) { const r = cutU.uRoofC.value, hr = Math.hypot(p.x - r.x, p.z - r.z); if (p.y > r.y + ROOF_UP) k = Math.max(k, cutU.uRoof.value * (1 - smooth(ROOF_R0, ROOF_R1, hr))); k = Math.max(k, 1 - smooth(OVER_LENS0, OVER_LENS1, p.distanceTo(c))); }
  return k;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const cache = new Map<string, THREE.Material>();
/** Bản sao chất liệu có khoét nhìn xuyên; roof = thêm khoét mái quanh nhân vật. */
export function cutMaterial(m: THREE.Material, roof: boolean): THREE.Material {
  const key = `${m.uuid}|${roof ? 1 : 0}`; const hit = cache.get(key); if (hit) return hit;
  const c = m.clone();
  c.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cutU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCutWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCutWP; uniform vec3 uCam; uniform vec3 uHead; uniform vec3 uRoofC; uniform float uRoof;`)
      .replace('void main() {', `void main() {
  {
    vec3 ab = uHead - uCam; float t = clamp(dot(vCutWP - uCam, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float k = 0.0; float d = length(vCutWP - (uCam + ab * t));
    if (t > 0.02 && t < 0.9) k = max(k, 1.0 - smoothstep(${CUT_R0.toFixed(2)}, ${CUT_R1.toFixed(2)}, d));
    k = max(k, 1.0 - smoothstep(${LENS_R0.toFixed(2)}, ${LENS_R1.toFixed(2)}, length(vCutWP - uCam)));
    ${roof ? `if (vCutWP.y > uRoofC.y + ${ROOF_UP.toFixed(2)}) k = max(k, uRoof * (1.0 - smoothstep(${ROOF_R0.toFixed(1)}, ${ROOF_R1.toFixed(1)}, length(vCutWP.xz - uRoofC.xz)))); k = max(k, 1.0 - smoothstep(${OVER_LENS0.toFixed(1)}, ${OVER_LENS1.toFixed(1)}, length(vCutWP - uCam)));` : ''}
    float th = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (k * 0.88 > th) discard;
  }`);
  };
  c.customProgramCacheKey = () => `${m.customProgramCacheKey?.() ?? ''}|cut${roof ? 'R' : ''}`;
  cache.set(key, c); return c;
}
/** Áp khoét cho mọi lưới trong nhóm. */
export function applyCut(root: THREE.Object3D, roof: boolean) {
  root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) return; m.material = Array.isArray(m.material) ? m.material.map((x) => cutMaterial(x, roof)) : cutMaterial(m.material, roof); });
}
export function releaseCutCache() { for (const m of cache.values()) m.dispose(); cache.clear(); }

/** Gộp các lưới (toạ độ thế giới, chỉ vị trí) thành một BVH. */
export function bvhOf(meshes: THREE.Mesh[]): MeshBVH | null {
  const geos: THREE.BufferGeometry[] = [];
  for (const m of meshes) {
    const src = m.geometry as THREE.BufferGeometry; if (!src.attributes.position) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', src.attributes.position.clone()); if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(m.matrixWorld); geos.push(g.index ? g.toNonIndexed() : g);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
  return merged ? new MeshBVH(merged) : null;
}

const ray = new THREE.Ray(), tmp = new THREE.Vector3(), side = new THREE.Vector3(), up2 = new THREE.Vector3();
export class CamRig {
  constructor(readonly solid: MeshBVH | null, readonly over: MeshBVH | null) {}
  /** Khoảng thông theo hướng dir từ o, chùm 5 tia (giữa + 4 tia lệch r) — như quét một khối cầu. */
  cast(o: THREE.Vector3, dir: THREE.Vector3, max: number, r = 0.28): number {
    if (!this.solid) return max;
    side.set(-dir.z, 0, dir.x); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); up2.crossVectors(side, dir).normalize();
    let best = max;
    for (let i = 0; i < 5; i++) {
      tmp.copy(o); if (i === 1) tmp.addScaledVector(side, r); else if (i === 2) tmp.addScaledVector(side, -r); else if (i === 3) tmp.addScaledVector(up2, r); else if (i === 4) tmp.addScaledVector(up2, -r);
      ray.set(tmp, dir); const h = this.solid.raycastFirst(ray, THREE.DoubleSide, 0, best); if (h && h.distance < best) best = h.distance;
    }
    return best;
  }
  /** Khoảng cách từ p tới vật cứng gần nhất (tối đa max). */
  clearance(p: THREE.Vector3, max = 1): number { if (!this.solid) return max; const h = this.solid.closestPointToPoint(p, undefined, 0, max); return h ? h.distance : max; }
  /** Nhân vật đang đứng dưới mái (tia từ đầu đi thẳng lên chạm mái/tán trong 7 m). */
  underRoof(head: THREE.Vector3): boolean { if (!this.over) return false; ray.set(head, tmp.set(0, 1, 0)); return !!this.over.raycastFirst(ray, THREE.DoubleSide, 0, 7); }
  /** Tia bất kỳ lên vật cứng (dùng cho góc bưu thiếp). */
  hit(o: THREE.Vector3, dir: THREE.Vector3, max: number): number { if (!this.solid) return max; ray.set(o, dir); const h = this.solid.raycastFirst(ray, THREE.DoubleSide, 0, max); return h ? h.distance : max; }
}
