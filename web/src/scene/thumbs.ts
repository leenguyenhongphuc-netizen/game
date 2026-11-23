// Ảnh xem trước 3D của đồ mua sắm và xe: dựng đúng mô hình trong game rồi chụp ra ảnh nhỏ.
// Chỉ dùng MỘT bộ vẽ ngoài màn hình cho cả lượt (iOS giới hạn số ngữ cảnh WebGL), vẽ lần lượt rồi huỷ ngay.
import * as THREE from 'three';
import { makeFarmer } from './World.ts';
import { buildGoodProp, buildHomeHouse } from './houses.ts';
import { buildPersonalRide, makeTruckKind } from './rides.ts';

export type ThumbKind = 'ao' | 'non' | 'phu_kien' | 'nha' | 'noi_that' | 'san_vuon' | 'xe' | 'xe_tai';
export interface ThumbAsk { id: string; kind: ThumbKind; color?: string }
const cache = new Map<string, string>();
const keyOf = (a: ThumbAsk) => `${a.kind}:${a.id}:${a.color ?? ''}`;
export const thumbOf = (a: ThumbAsk): string | undefined => cache.get(keyOf(a));

/** Dựng mô hình của một món và góc máy hợp với loại món. */
function subject(a: ThumbAsk): { obj: THREE.Object3D; yaw: number; pitch: number; crop?: [number, number] } | null {
  switch (a.kind) {
    case 'ao': return { obj: makeFarmer(0x5aa9e6, 'none', { ao: a.id, non: null }).root, yaw: 0.45, pitch: 0.12 };
    case 'non': return { obj: makeFarmer(0xf2efe6, 'none', { non: a.id }).root, yaw: 0.5, pitch: 0.1, crop: [1.45, 3.0] };
    case 'phu_kien': return { obj: makeFarmer(0xf2efe6, 'non_la', { phu_kien: a.id }).root, yaw: a.id === 'gui' || a.id === 'ba_lo' ? 2.5 : a.id === 'kinh_ram' ? 0.3 : 0.6, pitch: 0.14, crop: a.id === 'kinh_ram' ? [1.45, 2.6] : undefined };
    case 'nha': return { obj: buildHomeHouse(a.id, 0xfff6e2, 0xf08a6c, false), yaw: 0.6, pitch: 0.32 };
    case 'noi_that': case 'san_vuon': { const o = buildGoodProp(a.id); return o ? { obj: o, yaw: 0.6, pitch: 0.34 } : null; }
    case 'xe': { const r = buildPersonalRide(a.id); return r ? { obj: r.root, yaw: 0.95, pitch: 0.22 } : null; }
    case 'xe_tai': return { obj: makeTruckKind(a.id, a.color ? parseInt(a.color.slice(1), 16) : 0xf08a6c).root, yaw: 0.95, pitch: 0.24 };
  }
}

/** Chụp ảnh các món chưa có trong bộ nhớ đệm. Trả về số ảnh mới. */
export function renderThumbs(asks: ThumbAsk[], size = 176): number {
  const todo = asks.filter((a) => !cache.has(keyOf(a)));
  if (!todo.length) return 0;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' }); } catch { return 0; }
  renderer.setPixelRatio(1); renderer.setSize(size, size, false); renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a888, 1.25)); const sun = new THREE.DirectionalLight(0xfff2d8, 1.7); sun.position.set(3, 6, 5); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  let made = 0;
  for (const a of todo) {
    let sub: ReturnType<typeof subject> = null;
    try { sub = subject(a); } catch { sub = null; }
    if (!sub) { cache.set(keyOf(a), ''); continue; }
    const holder = new THREE.Group(); holder.add(sub.obj); scene.add(holder); holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    if (sub.crop) { box.min.y = sub.crop[0] * 1.18; box.max.y = Math.min(box.max.y, sub.crop[1] * 1.18); const hw = (box.max.y - box.min.y) * 0.62; box.min.x = -hw; box.max.x = hw; box.min.z = -hw; box.max.z = hw; }
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.y * 0.56, Math.hypot(s.x, s.z) * 0.5) * 1.06, dist = r / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(c.x + Math.sin(sub.yaw) * Math.cos(sub.pitch) * dist, c.y + Math.sin(sub.pitch) * dist, c.z + Math.cos(sub.yaw) * Math.cos(sub.pitch) * dist); cam.lookAt(c);
    renderer.render(scene, cam);
    try { cache.set(keyOf(a), renderer.domElement.toDataURL('image/webp', 0.86)); made++; } catch { cache.set(keyOf(a), ''); }
    scene.remove(holder);
    holder.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.boundingSphere && !SHARED.has(m.geometry)) m.geometry.dispose(); });
  }
  renderer.dispose(); renderer.forceContextLoss();
  return made;
}
import { GEO } from './plants.ts';
const SHARED = new Set<THREE.BufferGeometry>(Object.values(GEO));
