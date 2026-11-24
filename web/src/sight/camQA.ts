// Đo chất lượng máy quay tham quan từng khung (bài kiểm tools/ui-test/camera-qa.mjs): bọc renderer.render của cảnh đang chạy.
// - quay: góc yaw đổi mỗi khung, quy về 60 hình/giây; lỗi nếu > 6°/khung khi người chơi không kéo xoay và không mở thẻ.
// - che: tỉ lệ điểm trên lưới 7×11 mà tia từ máy quay chạm vật (không phải mặt đất dưới chân, không bị làm mờ) trước nhân vật.
// - cắt: khoảng cách máy quay tới hình học gần nhất (không bị làm mờ) nhỏ hơn mặt cắt gần của ống kính.
// Chỉ đọc cảnh qua window.__sightScene nên chạy được cả trên bản cũ (để so trước/sau).
import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import type { MeshBVH } from 'three-mesh-bvh';

export interface QARec { t: number; yaw60: number; user: boolean; card: boolean; occl: number | null; /** Tỉ lệ khung hình là mặt dưới mái/tán (chui gầm mái). */ roof: number | null; near: number | null; x: number; z: number; err: string[] }
type Sc = { world: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; player?: THREE.Object3D; state: { pos: THREE.Vector3 }; nearIdx: number | null; lookCount?: number; lookYaw?: number; isCut?: (p: THREE.Vector3, o?: THREE.Object3D) => boolean };

export function startCamQA(): void {
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree; THREE.Mesh.prototype.raycast = acceleratedRaycast;
  const out = { frames: [] as QARec[], errors: [] as QARec[] }; (window as unknown as { __camqa: typeof out }).__camqa = out;
  const wait = () => { const sc = (window as unknown as { __sightScene?: Sc }).__sightScene; if (!sc || !sc.renderer) { setTimeout(wait, 200); return; } hook(sc); };
  wait();
  function hook(sc: Sc) {
    const r = sc.renderer, orig = r.render.bind(r), ray = new THREE.Raycaster(), fwd = new THREE.Vector3(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3(), inv = new THREE.Matrix4(), nm = new THREE.Vector3();
    let lastYaw: number | null = null, lastT = performance.now(), lastLook = sc.lookCount ?? 0, n = 0, meshes: THREE.Mesh[] | null = null;
    const list = () => {
      if (meshes) return meshes; meshes = [];
      sc.world.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || !o.visible) return;
        let p: THREE.Object3D | null = o; while (p) { if (p === sc.player) return; p = p.parent; }
        const mat = m.material as THREE.Material; if (mat.transparent && (mat as THREE.MeshBasicMaterial).opacity < 0.6) return;
        if (!m.geometry.boundsTree) m.geometry.computeBoundsTree(); meshes!.push(m);
      });
      return meshes;
    };
    r.render = (scene: THREE.Object3D, cam: THREE.Camera) => {
      orig(scene, cam); if (scene !== sc.world || cam !== sc.camera) return;
      const now = performance.now(), dt = Math.max(1 / 120, (now - lastT) / 1000); lastT = now;
      sc.camera.getWorldDirection(fwd); const yaw = Math.atan2(fwd.x, -fwd.z);
      let d = lastYaw === null ? 0 : yaw - lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); lastYaw = yaw;
      const look = sc.lookCount ?? 0, user = look !== lastLook || Math.abs(sc.lookYaw ?? 0) > 1e-3; lastLook = look;
      const rec: QARec = { t: now, yaw60: Math.abs(d) * 180 / Math.PI * (1 / 60) / dt, user, card: sc.nearIdx !== null, occl: null, roof: null, near: null, x: sc.state.pos.x, z: sc.state.pos.z, err: [] };
      if (n++ % 8 === 0) {
        const ms = list(), cp = sc.camera.position, pp = sc.state.pos, pd = cp.distanceTo(tmp.set(pp.x, pp.y + 1.2, pp.z));
        let hit = 0, tot = 0, roof = 0;
        for (let iy = 0; iy < 11; iy++) for (let ix = 0; ix < 7; ix++) {
          tot++; ndc.set(-0.9 + ix * 0.3, -0.9 + iy * 0.18); ray.setFromCamera(ndc, sc.camera); ray.far = 30;
          const all = ray.intersectObjects(ms, false), first = all.find((h) => !sc.isCut?.(h.point, h.object));
          if (first && first.face) { nm.copy(first.face.normal).transformDirection(first.object.matrixWorld); if (nm.y < -0.4 && first.point.y > pp.y + 1.8) roof++; }
          const hs = all.filter((h) => h.distance < pd * 0.85);
          for (const h of hs) {
            if (sc.isCut?.(h.point, h.object)) continue;
            if (h.face) { nm.copy(h.face.normal).transformDirection(h.object.matrixWorld); if (nm.y > 0.7 && h.point.y < pp.y + 0.6) break; } // mặt đất phía trước: không tính là che
            hit++; break;
          }
        }
        rec.occl = hit / tot; rec.roof = roof / tot; if (rec.roof > 0.3) rec.err.push('gam-mai');
        let best = 9;
        for (const m of ms) {
          if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); tmp.copy(m.geometry.boundingSphere!.center).applyMatrix4(m.matrixWorld); if (tmp.distanceTo(cp) - m.geometry.boundingSphere!.radius * m.matrixWorld.getMaxScaleOnAxis() > best) continue;
          const bt = m.geometry.boundsTree as MeshBVH | undefined; if (!bt) continue; inv.copy(m.matrixWorld).invert(); tmp.copy(cp).applyMatrix4(inv);
          const h = bt.closestPointToPoint(tmp, undefined, 0, best); if (!h) continue;
          const wp = h.point.clone().applyMatrix4(m.matrixWorld); if (sc.isCut?.(wp, m)) continue; best = Math.min(best, wp.distanceTo(cp));
        }
        rec.near = best;
        if (rec.occl > 0.3) rec.err.push('che');
        if (best < sc.camera.near) rec.err.push('cat');
      }
      if (!user && !rec.card && rec.yaw60 > 6) rec.err.push('quay');
      out.frames.push(rec); if (rec.err.length) out.errors.push(rec);
      if (out.frames.length > 20000) out.frames.splice(0, 5000);
    };
  }
}
