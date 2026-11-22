// Bộ đồ nghề dùng chung của hoạt cảnh du lịch và xuất khẩu: bảng màu từng miền, gộp lưới, nền trời, biển chữ, cây cối nhà cửa.
// Tách riêng khỏi màn lái xe để hai phần thay đổi độc lập.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh } from '../scene/plants.ts';

export interface Theme { ground: number; road: number; kinds: string[]; mountains: number | null }
export const THEMES: Record<Zone, Theme> = {
  bac: { ground: 0xa9d672, road: 0x9aa1ab, kinds: ['leaf', 'leaf', 'house', 'rice', 'rock', 'pole', 'leaf'], mountains: 0xa9cbbd },
  trung: { ground: 0xd6dc94, road: 0x9aa1ab, kinds: ['leaf', 'dune', 'house', 'palm', 'pole', 'dune', 'rock'], mountains: 0xc9d3b4 },
  taynguyen: { ground: 0xb4cf78, road: 0xdc9a78, kinds: ['pine', 'pine', 'bush', 'house', 'pole', 'pine', 'rock'], mountains: 0x9cc79a },
  nam: { ground: 0xa4d977, road: 0xa3aab4, kinds: ['palm', 'palm', 'rice', 'pond', 'house', 'pole', 'rice'], mountains: null },
  dao: { ground: 0xf0e3b4, road: 0xe6d3a0, kinds: ['palm', 'palm', 'rock', 'house', 'palm', 'pole', 'dune'], mountains: null },
};

/** Gộp các khối cùng chất liệu thành một lưới (bản rút gọn, đủ dùng cho vật trang trí). */
export function bake(root: THREE.Group, shadow = false): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    const k = m.material as THREE.Material; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) { const m = new THREE.Mesh(mergeGeometries(geos, false), material); m.castShadow = shadow; m.receiveShadow = false; out.add(m); }
  return out;
}
export function gradient(top: number, bottom: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#' + new THREE.Color(top).getHexString()); grad.addColorStop(0.6, '#' + new THREE.Color(bottom).getHexString());
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeSign(text: string, bg: string, fg = '#ffffff'): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!; g.font = '800 50px "Baloo 2", "Be Vietnam Pro", sans-serif';
  const w = Math.min(496, g.measureText(text).width + 60);
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect((512 - w) / 2 - 6, 8, w + 12, 112, 22); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect((512 - w) / 2, 14, w, 100, 18); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66, 460);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(7, 1.75, 1); return sp;
}

export type Prefab = () => THREE.Group;
export const SCENERY: Record<string, Prefab> = {
  leaf: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 0.9, 0, 0.2, 1.8, 0.2), mesh(GEO.ball, mat(0x5cb85f), -0.5, 2.3, 0.1, 1.1), mesh(GEO.ball, mat(0x79c96d), 0.6, 2.4, -0.1, 1.15), mesh(GEO.ball, mat(0x9bdc84), 0, 3.2, 0.1, 1.2)); return g; },
  pine: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 0.7, 0, 0.18, 1.4, 0.18)); for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(i % 2 ? 0x4f9f6a : 0x66b47c), 0, 1.8 + i * 1.0, 0, 1.4 - i * 0.33, 1.7, 1.4 - i * 0.33)); return g; },
  palm: () => { const g = new THREE.Group(), h = 4.2; const t = mesh(GEO.cyl, mat(0xa98a62), 0.15, h / 2, 0, 0.16, h, 0.16); t.rotation.z = -0.08; g.add(t); for (let i = 0; i < 7; i++) { const p = new THREE.Group(); p.position.set(0.32, h, 0); p.rotation.y = (i / 7) * 6.28; p.rotation.z = -0.5; p.add(mesh(GEO.sphere, mat(i % 2 ? 0x5cb85f : 0x8fd67c), 1.05, 0, 0, 1.2, 0.07, 0.32)); g.add(p); } return g; },
  house: () => { const g = new THREE.Group(), roofs = [0xf08a6c, 0x6fb7d9, 0xf2b25c, 0xa98bd6]; const c = roofs[Math.floor(Math.random() * roofs.length)]; g.add(mesh(GEO.box, mat(0xfff6e2), 0, 1.1, 0, 3.6, 2.2, 2.8)); const r = mesh(new THREE.CylinderGeometry(0.01, 2.4, 1.5, 4, 1), mat(c), 0, 2.95, 0, 1.2, 1, 0.95); r.rotation.y = Math.PI / 4; g.add(r, mesh(GEO.box, mat(0x9a7150), 0, 0.8, 1.42, 0.7, 1.4, 0.06), mesh(GEO.box, mat(0xa9dcf2), -1.1, 1.3, 1.42, 0.6, 0.6, 0.06)); return g; },
  rice: () => { const g = new THREE.Group(), gold = Math.random() < 0.4; g.add(mesh(GEO.box, mat(gold ? 0xe6cf6a : 0x8fd67c), 0, 0.06, 0, 7, 0.1, 5), mesh(GEO.box, mat(0xc9b98a), 0, 0.08, 0, 7.3, 0.06, 0.2), mesh(GEO.box, mat(0xc9b98a), 0, 0.08, 2.5, 7.3, 0.06, 0.2)); for (let i = 0; i < 6; i++) g.add(mesh(GEO.box, mat(gold ? 0xd9bd4e : 0x79c96d), -3 + i * 1.2, 0.16, 0, 0.3, 0.14, 4.6)); return g; },
  rock: () => { const g = new THREE.Group(); g.add(mesh(GEO.sphere, mat(0xb9c0c4), 0, 0.6, 0, 1.3, 0.9, 1.1), mesh(GEO.sphere, mat(0xa3acb2), 1.0, 0.4, 0.4, 0.8, 0.55, 0.7)); return g; },
  pole: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0xb9b2a4), 0, 2.6, 0, 0.1, 5.2, 0.1), mesh(GEO.box, mat(0xb9b2a4), 0, 4.8, 0, 1.6, 0.1, 0.1), mesh(GEO.ball, mat(0x6b7280), -0.7, 4.95, 0, 0.09), mesh(GEO.ball, mat(0x6b7280), 0.7, 4.95, 0, 0.09)); return g; },
  dune: () => { const g = new THREE.Group(); g.add(mesh(GEO.ball, mat(0xf3e3ae), 0, -0.4, 0, 4.2, 1.5, 3.2), mesh(GEO.ball, mat(0xead596), 2.6, -0.5, 1.2, 2.6, 1.1, 2.2), mesh(GEO.cone, mat(0x8fd67c), -1, 1.1, 0.5, 0.12, 0.6, 0.12)); return g; },
  bush: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.add(mesh(GEO.ball, mat((i + j) % 2 ? 0x479c52 : 0x5cb85f), -1.6 + i * 1.6, 0.5, -0.8 + j * 1.6, 0.7, 0.6, 0.7), mesh(GEO.ball, mat(0xc0281e), -1.4 + i * 1.6, 0.9, -0.6 + j * 1.6, 0.09)); return g; },
  pond: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, mat(0x8fd8ea, { rough: 0.25 }), 0, 0.05, 0, 3.2, 0.08, 2.4), mesh(GEO.cyl, mat(0x5cb85f), 1, 0.1, 0.5, 0.5, 0.03, 0.5), mesh(GEO.cone, mat(0xf29bc0), 1, 0.3, 0.5, 0.14, 0.3, 0.14), mesh(GEO.cyl, mat(0x5cb85f), -1.2, 0.1, -0.6, 0.4, 0.03, 0.4)); return g; },
  islet: () => { const g = new THREE.Group(); g.add(mesh(GEO.ball, mat(0xf0e3b4), 0, -0.2, 0, 4, 1.0, 3.2), mesh(GEO.ball, mat(0xa9d672), 0.3, 0.5, 0, 2.6, 1.0, 2.0)); const p = SCENERY.palm(); p.position.set(0.5, 1.0, 0); p.scale.setScalar(0.8); g.add(p); return g; },
  ghe: () => { const g = new THREE.Group(), c = [0x6fb7d9, 0xf08a6c, 0x8fd67c][Math.floor(Math.random() * 3)]; g.add(mesh(GEO.box, mat(c), 0, 0.3, 0, 1.5, 0.7, 4), mesh(GEO.box, mat(0xfff6dc), 0, 0.72, 0, 1.6, 0.1, 4.1), mesh(GEO.cyl, mat(0x9a6238), 0, 1.6, 0.3, 0.05, 2, 0.05), mesh(GEO.box, mat(0xfff6dc), 0.02, 1.8, -0.4, 0.04, 1.3, 1.2)); return g; },
  seastone: () => { const g = new THREE.Group(); g.add(mesh(GEO.sphere, mat(0x8f9aa3), 0, 0.3, 0, 1.6, 1.2, 1.3), mesh(GEO.sphere, mat(0xa3acb2), 1.2, 0.1, 0.5, 0.9, 0.7, 0.8)); return g; },
};
