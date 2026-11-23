// Trang thử nông trại lớn: /fields-test.html (cần đăng nhập sẵn bằng tài khoản nhà nông cấp ≥ 5).
// Trái: bảng Cánh đồng thật (gọi API). Phải: cảnh 3D các khối ruộng (lớp FieldsLayer như trong xóm) + đếm lần vẽ.
// ?gia=2000 dựng thêm cánh đồng giả cho đủ số ô để đo lần vẽ, không cần dữ liệu máy chủ.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import './styles.css';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { FieldsPanel } from './fields.tsx';
import type { FieldsData, HeliTourData } from './fields.tsx';
import { HeliTour } from './drive/HeliTour.tsx';
import { FieldsLayer } from './scene/fields.ts';
import type { FieldLite } from './scene/fields.ts';

const q = new URLSearchParams(location.search), fake = Number(q.get('gia') ?? 0);
function fakeFields(tiles: number): FieldLite[] {
  const colors = ['#6fbf4a', '#9ccf3e', '#e8c547', '#4f9e3a'], out: FieldLite[] = [];
  for (let i = 0, left = Math.round(tiles / 100); left > 0; i++) {
    const b = Math.min(10, left); left -= b;
    out.push({ id: -1 - i, blocks: b, cropId: 'xoai', progress: (i % 4) / 3, color: colors[i % 4], job: i === 0 ? { method: 'may', machine: 'may_cay', startedAt: Date.now(), endsAt: Date.now() + 3600_000 } : i === 1 ? { method: 'drone', machine: 'drone', startedAt: Date.now(), endsAt: Date.now() + 3600_000 } : null });
  }
  return out;
}

function Preview({ fields }: { fields: FieldLite[] }) {
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<FieldsLayer | null>(null);
  const [calls, setCalls] = useState<{ total: number; base: number } | null>(null);
  useEffect(() => {
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); host.current!.appendChild(r.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xa9dcf5);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f3e, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(30, 60, 20); scene.add(sun);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x86b04a })); g.position.y = -0.05; scene.add(g);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 900); cam.position.set(0, 70, 40); cam.lookAt(0, 0, -60);
    const L = new FieldsLayer(); layer.current = L; scene.add(L.group);
    const size = () => { const w = host.current!.clientWidth, h = host.current!.clientHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    size(); addEventListener('resize', size);
    let t = 0, n = 0;
    r.setAnimationLoop(() => {
      t += 1 / 60; L.update(t, Date.now(), cam.position);
      L.group.visible = false; r.render(scene, cam); const base = r.info.render.calls;
      L.group.visible = true; r.render(scene, cam);
      if (++n % 30 === 0) setCalls({ total: r.info.render.calls, base });
    });
    (window as unknown as { __fieldsLayer?: FieldsLayer }).__fieldsLayer = L;
    return () => { r.setAnimationLoop(null); L.dispose(); r.dispose(); r.domElement.remove(); removeEventListener('resize', size); };
  }, []);
  useEffect(() => { layer.current?.set(fields); }, [fields]);
  const tiles = fields.reduce((s, f) => s + f.blocks * 100, 0);
  return (
    <div style={{ position: 'relative', minHeight: 320, flex: 1 }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <p id="calls" style={{ position: 'absolute', left: 8, top: 8, margin: 0, background: '#fffdf4', borderRadius: 8, padding: '4px 8px', fontWeight: 700 }}>
        {tiles.toLocaleString('vi-VN')} ô · lần vẽ: {calls ? `${calls.total} (cánh đồng +${calls.total - calls.base})` : '…'}
      </p>
    </div>
  );
}

function Page() {
  const [me, setMe] = useState<Me | null>(null);
  const [fields, setFields] = useState<FieldLite[]>(fake ? fakeFields(fake) : []);
  const [tour, setTour] = useState<HeliTourData | null>(null);
  useEffect(() => { if (!fake) api<Me>('GET', '/api/me').then(setMe).catch(() => setMe(null)); }, []);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', background: 'var(--paper, #fff8e7)' }}>
      {!fake && (
        <div style={{ width: 'min(100%, 420px)', padding: 12, boxSizing: 'border-box' }}>
          {me ? <FieldsPanel me={me} refresh={() => void api<Me>('GET', '/api/me').then(setMe)} onTour={setTour} onFields={(d: FieldsData) => setFields(d.fields)} /> : <p>Chưa đăng nhập.</p>}
        </div>
      )}
      <Preview fields={fields} />
      {tour && <HeliTour tour={tour} onDone={() => setTour(null)} />}
      {fake ? <button style={{ position: 'fixed', right: 8, bottom: 8 }} onClick={() => setTour({ fee: 3_000_000, own: false, fields: fields.map((f) => ({ ...f, regionName: 'Cao Lãnh', name: 'Xoài', emoji: '🥭', stepName: null })) } as unknown as HeliTourData)}>🚁 Bay thử</button> : null}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>);
