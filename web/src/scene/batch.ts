// Gộp lưới theo màu đỉnh: mọi khối màu trơn trong một cụm dùng chung MỘT chất liệu nên cả cụm chỉ tốn một lần vẽ.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SHARED = new Map<string, THREE.Material>();
const WHITE = new THREE.Color(1, 1, 1);
type AnyMat = THREE.MeshStandardMaterial & THREE.MeshLambertMaterial & THREE.MeshBasicMaterial;

/** Chất liệu dùng chung (đọc màu từ đỉnh) tương đương với chất liệu màu trơn `m`; null nếu `m` không gộp được theo màu đỉnh. */
function sharedFor(m: THREE.Material): THREE.Material | null {
  const s = m as AnyMat;
  if (s.map || s.transparent || s.vertexColors || s.alphaTest > 0 || s.wireframe || !s.color || s.visible === false || s.depthTest === false || s.depthWrite === false || s.fog === false) return null;
  let key: string;
  if (s.isMeshStandardMaterial) {
    if (s.emissive.getHex() !== 0 || s.metalness > 0.05 || s.normalMap || s.roughnessMap) return null;
    key = `std|${s.roughness >= 0.7 ? 'r' : Math.round(s.roughness * 10)}|${s.side}|${s.flatShading ? 1 : 0}`;
    if (!SHARED.has(key)) SHARED.set(key, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: s.roughness >= 0.7 ? 0.9 : s.roughness, metalness: 0, side: s.side, flatShading: s.flatShading }));
  } else if (s.isMeshLambertMaterial) {
    if (s.emissive.getHex() !== 0) return null;
    key = `lam|${s.side}|${s.flatShading ? 1 : 0}`;
    if (!SHARED.has(key)) SHARED.set(key, new THREE.MeshLambertMaterial({ vertexColors: true, side: s.side, flatShading: s.flatShading }));
  } else if (s.isMeshBasicMaterial) {
    key = `bas|${s.side}`;
    if (!SHARED.has(key)) SHARED.set(key, new THREE.MeshBasicMaterial({ vertexColors: true, side: s.side }));
  } else return null;
  return SHARED.get(key)!;
}

/** Gộp mọi lưới dưới `root` (toạ độ thế giới của root, coi root ở gốc) thành ít lưới nhất có thể. Vật không phải lưới bị bỏ qua. */
export function bakeColored(root: THREE.Object3D, shadow = false, receive = false): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const src = m.material as THREE.Material, vc = sharedFor(src), keepUv = !vc && !!(src as AnyMat).map;
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && !(keepUv && n === 'uv') && !(!vc && n === 'color' && (src as AnyMat).vertexColors)) g.deleteAttribute(n);
    if (vc) {
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = (src as AnyMat).color ?? WHITE;
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const k = vc ?? src; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(geos, false); for (const g of geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material); m.castShadow = shadow && !material.transparent; m.receiveShadow = receive; out.add(m);
  }
  return out;
}
