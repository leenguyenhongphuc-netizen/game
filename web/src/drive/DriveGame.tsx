// Màn lái xe tải / lái tàu giữa hai vùng trồng. Tự chứa CSS, phủ kín màn hình.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../../shared/catalog.ts';
import { DriveScene } from './DriveScene.ts';
import type { Mode } from './DriveScene.ts';

const CSS = `
.dg  position: fixed; left: var(--vx, 0px); top: var(--vy, 0px); width: var(--vw, 100%); height: var(--vh, 100%); z-index: 1000; background: #dff3fb; overflow: hidden; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #3b2a17; touch-action: none; user-select: none; -webkit-user-select: none; }
.dg-scene { position: absolute; inset: 0; }
.dg-top { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 10px; right: 10px; display: grid; gap: 6px; pointer-events: none; }
.dg-bar { background: #fff6dc; border: 3px solid #7a4a22; border-radius: 18px; box-shadow: 0 4px 0 #56310f; padding: 6px 12px 8px; }
.dg-names { display: flex; justify-content: space-between; gap: 8px; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; font-weight: 800; font-size: 0.95rem; }
.dg-names span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dg-track { position: relative; height: 12px; border-radius: 8px; background: #e8d6a6; border: 2px solid #cdb67c; margin: 16px 12px 2px; }
.dg-fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: linear-gradient(#6fd45c, #4caf3f); }
.dg-icon { position: absolute; top: -21px; font-size: 1.5rem; transform: translateX(-50%) scaleX(-1); transition: left 0.15s linear; }
.dg-stats { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dg-pill { background: #7a4a22; color: #fff7d6; border: 3px solid #56310f; border-radius: 999px; padding: 2px 12px; font-family: 'Baloo 2', sans-serif; font-weight: 800; box-shadow: 0 3px 0 #2e1905; font-variant-numeric: tabular-nums; }
.dg-cancel { pointer-events: auto; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; background: #f6e7bd; border: 2px solid #7a4a22; border-radius: 12px; box-shadow: 0 3px 0 #7a4a22; padding: 4px 12px; min-height: 40px; cursor: pointer; color: inherit; }
.dg-center { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.dg-count { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 7rem; color: #fff3b0; -webkit-text-stroke: 4px #56310f; paint-order: stroke fill; animation: dg-pop 0.9s ease-out; }
.dg-bump { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 2.2rem; color: #fff; -webkit-text-stroke: 3px #c0391f; paint-order: stroke fill; animation: dg-float 1s ease-out forwards; white-space: nowrap; pointer-events: none; }
.dg-bump.good { -webkit-text-stroke-color: #2f7d26; }
.dg-card { pointer-events: auto; background: #fff6dc; border: 3px solid #7a4a22; border-radius: 22px; box-shadow: 0 6px 0 #56310f, 0 14px 30px #0005; padding: 18px 22px; text-align: center; max-width: min(360px, calc(100% - 32px)); display: grid; gap: 10px; animation: dg-pop 0.3s ease-out; }
.dg-card h2 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 1.6rem; line-height: 1.15; }
.dg-card p { margin: 0; color: #7a6547; }
.dg-row { display: flex; gap: 8px; }
.dg-row button { flex: 1; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; min-height: 46px; border-radius: 14px; border: 2px solid #7a4a22; background: #f6e7bd; box-shadow: 0 4px 0 #7a4a22; cursor: pointer; color: inherit; }
.dg-row button.go { background: linear-gradient(#6fd45c, #4caf3f); border-color: #2f7d26; box-shadow: 0 4px 0 #2f7d26; color: #fff; }
.dg-hint { position: absolute; bottom: max(18px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); background: #fffdf4ee; border: 2px solid #e3cf9a; border-radius: 999px; padding: 4px 14px; font-weight: 600; font-size: 0.9rem; white-space: nowrap; pointer-events: none; }
.dg-flash { position: absolute; inset: 0; background: #ffffff; display: grid; place-items: center; animation: dg-flash 1.2s ease-in-out forwards; pointer-events: none; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.8rem; color: #3f8fd6; text-align: center; padding: 20px; }
.dg-fail { position: absolute; inset: 40% 24px auto; text-align: center; background: #fff6dc; border-radius: 14px; padding: 16px; }
@keyframes dg-pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes dg-float { from { opacity: 0; transform: translate(-50%, 20px) scale(0.6); } 25% { opacity: 1; transform: translate(-50%, 0) scale(1.1); } to { opacity: 0; transform: translate(-50%, -50px) scale(1); } }
@keyframes dg-flash { 0% { opacity: 0; } 25%, 60% { opacity: 0.92; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .dg-count, .dg-card, .dg-bump, .dg-flash { animation-duration: 0.01s; } }
`;

export function DriveGame(props: {
  fromRegionId: string; toRegionId: string;
  km: number; seconds: number; needsBoat: boolean; truckColor: string;
  onFinish: () => void; onCancel: () => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<DriveScene | null>(null);
  const finished = useRef(false);
  const cb = useRef(props); cb.current = props;
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<{ progress: number; kmh: number; mode: Mode }>({ progress: 0, kmh: 0, mode: 'truck' });
  const [bump, setBump] = useState<{ id: number; text: string } | null>(null);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [arrived, setArrived] = useState(false);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const from = REGIONS[props.fromRegionId]?.name ?? 'Nơi đi', to = REGIONS[props.toRegionId]?.name ?? 'Nơi đến';

  useEffect(() => {
    let id = 0;
    try {
      scene.current = new DriveScene(host.current!, {
        fromRegionId: props.fromRegionId, toRegionId: props.toRegionId, seconds: Math.min(90, Math.max(15, props.seconds)), needsBoat: props.needsBoat, truckColor: props.truckColor,
        onTick: setHud,
        onBump: (text) => setBump({ id: ++id, text }),
        onLeg: (mode) => { setFlash({ id: ++id, text: mode === 'boat' ? '⛵ Xuống bến, lên tàu ra khơi!' : '🚚 Cập bến, lên xe chạy tiếp!' }); setHud((h) => ({ ...h, mode })); },
        onArrive: () => setArrived(true),
      });
      setHud((h) => ({ ...h, mode: scene.current!.debug().mode }));
      (window as unknown as { __drive?: DriveScene }).__drive = scene.current;
    } catch { setFailed(true); }
    return () => { scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đếm ngược 3-2-1 rồi mới cho xe chạy
  useEffect(() => {
    if (failed) return;
    if (count <= 0) { scene.current?.start(); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [count, failed]);

  // Tới nơi: hiện thông báo khoảng 1,5 giây rồi báo ra ngoài đúng một lần
  useEffect(() => {
    if (!arrived) return;
    const t = setTimeout(() => { if (!finished.current) { finished.current = true; cb.current.onFinish(); } }, 1500);
    return () => clearTimeout(t);
  }, [arrived]);

  const boat = hud.mode === 'boat';
  const pct = Math.min(100, Math.max(0, hud.progress * 100));
  return (
    <div className="dg" role="application" aria-label={`Lái ${boat ? 'tàu' : 'xe'} từ ${from} tới ${to}`}>
      <style>{CSS}</style>
      <div className="dg-scene" ref={host} />
      {failed && <p className="dg-fail">Thiết bị này chưa bật đồ hoạ 3D nên không lái được. <button className="dg-cancel" onClick={() => props.onCancel()}>Quay lại</button></p>}
      <div className="dg-top">
        <div className="dg-bar">
          <div className="dg-names"><span>{from}</span><span>{to}</span></div>
          <div className="dg-track"><div className="dg-fill" style={{ width: `${pct}%` }} /><span className="dg-icon" style={{ left: `${pct}%` }} aria-hidden="true">{boat ? '⛵' : '🚚'}</span></div>
        </div>
        <div className="dg-stats">
          <span className="dg-pill">Còn {Math.max(0, Math.round(props.km * (1 - hud.progress)))} km</span>
          <span className="dg-pill">{hud.kmh} km/h</span>
          <button className="dg-cancel" onClick={() => setAsking(true)} disabled={arrived}>Huỷ chuyến</button>
        </div>
      </div>
      {bump && <div key={bump.id} className={`dg-bump ${/Tăng tốc/.test(bump.text) ? 'good' : ''}`} role="status">{bump.text}</div>}
      {flash && <div key={flash.id} className="dg-flash">{flash.text}</div>}
      <div className="dg-center">
        {count > 0 && !failed && <div key={count} className="dg-count">{count}</div>}
        {arrived && <div className="dg-card" role="status"><h2>🎉 Đã tới {to}</h2><p>Chuyến đi {Math.round(props.km)} km đã xong.</p></div>}
        {asking && !arrived && (
          <div className="dg-card" role="alertdialog" aria-label="Huỷ chuyến">
            <h2>Huỷ chuyến đi?</h2><p>Bạn sẽ quay về nơi xuất phát và chưa tới được {to}.</p>
            <div className="dg-row"><button className="go" onClick={() => setAsking(false)}>Lái tiếp</button><button onClick={() => { if (!finished.current) { finished.current = true; props.onCancel(); } }}>Huỷ chuyến</button></div>
          </div>
        )}
      </div>
      {count <= 0 && hud.progress < 0.12 && !arrived && <div className="dg-hint">Kéo ngang hoặc bấm ← → để lái · né chướng ngại, nhặt can vàng</div>}
    </div>
  );
}
