// Màn lái xe tải của Thương lái (có thể kèm chặng phà). Tự chứa CSS, phủ kín màn hình.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../../shared/catalog.ts';
import { DriveScene } from './DriveScene.ts';
import type { DriveHud, DriveSummary } from './DriveScene.ts';

export interface DrivePlan { km: number; needsBoat: boolean; seconds: number; tolls: number; tollFee: number; fuelNeededL: number; junctions: { atKm: number; dir: 'L' | 'R'; name: string }[]; stationsAtKm: number[] }
export interface DriveResult { refuelL: number; detourKm: number }

const CSS = `
.dg { position: fixed; left: var(--vx, 0px); top: var(--vy, 0px); width: var(--vw, 100%); height: var(--vh, 100%); z-index: 1000; background: #dff3fb; overflow: hidden; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #3b2a17; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; font-size: 14px; line-height: 1.25; }
.dg *, .dg *::before { box-sizing: border-box; }
.dg-scene { position: absolute; inset: 0; }
.dg-top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; pointer-events: none; }
.dg-bar { background: #fff6dc; border: 3px solid #7a4a22; border-radius: 16px; box-shadow: 0 3px 0 #56310f; padding: 4px 10px 6px; min-width: 0; }
.dg-names { display: flex; justify-content: space-between; gap: 8px; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; font-weight: 800; font-size: 0.92rem; }
.dg-names span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.dg-names small { flex: none; font-weight: 700; color: #7a6547; font-size: 0.78rem; align-self: center; }
.dg-track { position: relative; height: 10px; border-radius: 8px; background: #e8d6a6; border: 2px solid #cdb67c; margin: 13px 12px 0; }
.dg-fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: linear-gradient(#6fd45c, #4caf3f); }
.dg-icon { position: absolute; top: -19px; font-size: 1.25rem; transform: translateX(-50%) scaleX(-1); transition: left 0.15s linear; }
.dg-cancel { pointer-events: auto; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; background: #f6e7bd; border: 2px solid #7a4a22; border-radius: 12px; box-shadow: 0 3px 0 #7a4a22; padding: 4px 10px; min-height: 44px; min-width: 44px; cursor: pointer; color: inherit; align-self: stretch; }
.dg-nav { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; background: #1f8a4c; color: #fff; border: 3px solid #fff; border-radius: 14px; box-shadow: 0 3px 0 #0f5a30; padding: 4px 10px 4px 6px; min-height: 44px; font-weight: 700; font-size: 0.9rem; }
.dg-nav.urgent { background: #e2622b; box-shadow: 0 3px 0 #9c3a12; animation: dg-pulse 0.7s ease-in-out infinite alternate; }
.dg-nav b { flex: none; width: 34px; height: 34px; border-radius: 10px; background: #ffffff; color: #1f8a4c; display: grid; place-items: center; font-size: 1.5rem; line-height: 1; font-weight: 800; }
.dg-nav.urgent b { color: #e2622b; }
.dg-nav span { min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dg-side { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.dg-stat { background: #fff6dcf2; border: 2px solid #7a4a22; border-radius: 14px; box-shadow: 0 3px 0 #56310f; padding: 6px 9px; display: grid; gap: 3px; font-weight: 700; font-size: 0.8rem; font-variant-numeric: tabular-nums; min-width: 132px; max-width: 46%; }
.dg-stat div { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.dg-stat i { font-style: normal; flex: none; width: 1.2em; text-align: center; }
.dg-gauge { flex: 1; height: 9px; min-width: 40px; border-radius: 6px; background: #e8d6a6; border: 1.5px solid #cdb67c; overflow: hidden; }
.dg-gauge u { display: block; height: 100%; background: linear-gradient(#ffd23f, #f0a51e); text-decoration: none; }
.dg-gauge.low u { background: #e0342b; }
.dg-stat .low { color: #c0281e; }
.dg-map { width: 116px; height: 116px; border-radius: 16px; border: 3px solid #7a4a22; box-shadow: 0 3px 0 #56310f; background: #e9f3d8f2; display: block; flex: none; }
.dg-warn { position: absolute; left: 50%; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 96px); transform: translateX(-50%); max-width: calc(100% - 24px); background: #c0281e; color: #fff; border: 3px solid #fff; border-radius: 14px; padding: 5px 12px; font-weight: 800; font-size: 0.88rem; text-align: center; pointer-events: none; box-shadow: 0 3px 0 #7d150e; }
.dg-bottom { position: absolute; left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; pointer-events: none; }
.dg-steer { pointer-events: auto; width: 82px; height: 82px; border-radius: 50%; border: 4px solid #7a4a22; background: #fff6dce6; box-shadow: 0 5px 0 #56310f; font-size: 2.1rem; line-height: 1; color: #7a4a22; cursor: pointer; touch-action: none; padding: 0; font-family: inherit; }
.dg-steer.on { transform: translateY(4px); box-shadow: 0 1px 0 #56310f; background: #ffd98a; }
.dg-speed { background: #7a4a22; color: #fff7d6; border: 3px solid #56310f; border-radius: 16px; padding: 2px 14px 4px; font-family: 'Baloo 2', sans-serif; font-weight: 800; box-shadow: 0 3px 0 #2e1905; font-variant-numeric: tabular-nums; text-align: center; margin-bottom: 8px; }
.dg-speed strong { font-size: 1.5rem; line-height: 1.1; display: block; }
.dg-speed small { font-size: 0.74rem; font-weight: 700; opacity: 0.9; white-space: nowrap; }
.dg-center { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; padding: 12px; }
.dg-count { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 7rem; color: #fff3b0; -webkit-text-stroke: 4px #56310f; paint-order: stroke fill; animation: dg-pop 0.9s ease-out; }
.dg-bump { position: absolute; left: 50%; top: 46%; transform: translateX(-50%); font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.45rem; color: #fff; background: #c0391f; border: 3px solid #fff; border-radius: 16px; padding: 2px 14px; animation: dg-float 1.9s ease-out forwards; text-align: center; max-width: calc(100% - 28px); width: max-content; pointer-events: none; box-shadow: 0 4px 0 #0003; }
.dg-bump.good { background: #2f9d46; }
.dg-bump.info { background: #2f6fd0; }
.dg-card { pointer-events: auto; background: #fff6dc; border: 3px solid #7a4a22; border-radius: 22px; box-shadow: 0 6px 0 #56310f, 0 14px 30px #0005; padding: 14px 18px; text-align: center; width: min(360px, 100%); max-height: 100%; overflow: auto; display: grid; gap: 8px; animation: dg-pop 0.3s ease-out; }
.dg-card h2 { margin: 0; font-family: 'Baloo 2', sans-serif; font-size: 1.45rem; line-height: 1.15; }
.dg-card p { margin: 0; color: #7a6547; }
.dg-sum { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; text-align: left; font-weight: 600; font-size: 0.92rem; }
.dg-sum li { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1.5px dashed #e3cf9a; padding-bottom: 3px; }
.dg-sum li b { font-variant-numeric: tabular-nums; text-align: right; }
.dg-sum li.bad b { color: #c0281e; }
.dg-row { display: flex; gap: 8px; }
.dg-row button { flex: 1; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; min-height: 46px; border-radius: 14px; border: 2px solid #7a4a22; background: #f6e7bd; box-shadow: 0 4px 0 #7a4a22; cursor: pointer; color: inherit; }
.dg-row button.go { background: linear-gradient(#6fd45c, #4caf3f); border-color: #2f7d26; box-shadow: 0 4px 0 #2f7d26; color: #fff; }
.dg-hint { position: absolute; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 100px); left: 50%; transform: translateX(-50%); background: #fffdf4ee; border: 2px solid #e3cf9a; border-radius: 14px; padding: 4px 12px; font-weight: 600; font-size: 0.84rem; text-align: center; max-width: calc(100% - 24px); width: max-content; pointer-events: none; }
.dg-flash { position: absolute; inset: 0; background: #ffffff; display: grid; place-items: center; animation: dg-flash 1.6s ease-in-out forwards; pointer-events: none; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.6rem; color: #3f8fd6; text-align: center; padding: 20px; }
.dg-fail { position: absolute; inset: 40% 24px auto; text-align: center; background: #fff6dc; border-radius: 14px; padding: 16px; }
@keyframes dg-pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes dg-pulse { to { filter: brightness(1.18); } }
@keyframes dg-float { from { opacity: 0; transform: translate(-50%, 16px) scale(0.7); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1.05); } 80% { opacity: 1; transform: translate(-50%, 0) scale(1); } to { opacity: 0; transform: translate(-50%, -24px) scale(1); } }
@keyframes dg-flash { 0% { opacity: 0; } 25%, 65% { opacity: 0.94; } 100% { opacity: 0; } }
@media (max-height: 480px) {
  .dg-top { grid-template-columns: minmax(150px, 30%) minmax(0, 1fr) auto; gap: 5px; }
  .dg-nav { grid-column: auto; grid-row: 1; order: 2; min-height: 40px; font-size: 0.84rem; }
  .dg-bar { grid-row: 1; padding: 2px 9px 4px; } .dg-cancel { grid-row: 1; grid-column: 3; }
  .dg-track { margin-top: 11px; height: 8px; } .dg-icon { font-size: 1.05rem; top: -16px; }
  .dg-map { width: 94px; height: 94px; } .dg-stat { font-size: 0.76rem; padding: 4px 8px; }
  .dg-steer { width: 70px; height: 70px; } .dg-bump { top: 40%; font-size: 1.2rem; }
  .dg-warn { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 4px); max-width: 46%; font-size: 0.8rem; } .dg-hint { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 64px); max-width: 52%; }
  .dg-bottom { bottom: max(8px, env(safe-area-inset-bottom)); } .dg-speed { position: absolute; left: 92px; bottom: 0; margin: 0; } .dg-speed strong { font-size: 1.2rem; }
  .dg-card { padding: 10px 14px; gap: 5px; width: min(440px, 100%); } .dg-card h2 { font-size: 1.2rem; } .dg-sum { grid-template-columns: 1fr 1fr; column-gap: 14px; font-size: 0.84rem; }
}
@media (min-width: 700px) and (min-height: 481px) { .dg { font-size: 16px; } .dg-top { max-width: 720px; margin: 0 auto; } .dg-map { width: 150px; height: 150px; } }
@media (prefers-reduced-motion: reduce) { .dg-count, .dg-card, .dg-bump, .dg-flash, .dg-nav.urgent { animation-duration: 0.01s; } }
`;

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ';
const num = (n: number, d = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function DriveGame(props: {
  fromRegionId: string; toRegionId: string;
  plan: DrivePlan;
  fuelL: number;
  truck: { tankL: number; lPer100km: number; fuelPrice: number };
  etc: number;
  cash: number;
  truckColor: string;
  onFinish: (r: DriveResult) => void;
  onCancel: () => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<DriveScene | null>(null);
  const finished = useRef(false);
  const cb = useRef(props); cb.current = props;
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<DriveHud | null>(null);
  const [bump, setBump] = useState<{ id: number; text: string; kind: string } | null>(null);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [sum, setSum] = useState<DriveSummary | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [steer, setSteer] = useState(0);
  const from = REGIONS[props.fromRegionId]?.name ?? 'Nơi đi', to = REGIONS[props.toRegionId]?.name ?? 'Nơi đến';

  useEffect(() => {
    let id = 0;
    try {
      scene.current = new DriveScene(host.current!, {
        fromRegionId: props.fromRegionId, toRegionId: props.toRegionId, plan: props.plan, fuelL: props.fuelL, truck: props.truck, etc: props.etc, truckColor: props.truckColor,
        onTick: setHud,
        onBump: (text, kind) => setBump({ id: ++id, text, kind }),
        onFlash: (text) => setFlash({ id: ++id, text }),
        onArrive: (s) => setSum(s),
      });
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

  // Tới nơi: hiện bảng tổng kết rồi báo ra ngoài đúng một lần
  useEffect(() => {
    if (!sum) return;
    const t = setTimeout(() => { if (!finished.current) { finished.current = true; cb.current.onFinish({ refuelL: sum.refuelL, detourKm: sum.detourKm }); } }, 2600);
    return () => clearTimeout(t);
  }, [sum]);

  // Bản đồ nhỏ
  useEffect(() => {
    const c = mapRef.current, s = scene.current; if (!c || !s) return;
    const r = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * r), h = Math.round(c.clientHeight * r);
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); if (g) s.drawMap(g, w, h);
  }, [hud]);

  const hold = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } scene.current?.setSteer(dir); setSteer(dir); },
    onPointerUp: () => { scene.current?.setSteer(0); setSteer(0); },
    onPointerCancel: () => { scene.current?.setSteer(0); setSteer(0); },
    onLostPointerCapture: () => { scene.current?.setSteer(0); setSteer(0); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const boat = hud?.mode === 'boat', arrived = !!sum;
  const pct = Math.min(100, Math.max(0, (hud?.progress ?? 0) * 100));
  const fuel = hud?.fuel ?? props.fuelL, tank = Math.max(1, props.truck.tankL), low = fuel / tank < 0.15;
  const etcLeft = hud?.etcLeft ?? props.etc, cashLeft = props.cash - (hud?.spent ?? 0);
  return (
    <div className="dg" role="application" aria-label={`Lái ${boat ? 'phà' : 'xe'} từ ${from} tới ${to}`}>
      <style>{CSS}</style>
      <div className="dg-scene" ref={host} />
      {failed && <p className="dg-fail">Thiết bị này chưa bật đồ hoạ 3D nên không lái được. <button className="dg-cancel" onClick={() => props.onCancel()}>Quay lại</button></p>}
      <div className="dg-top">
        <div className="dg-bar">
          <div className="dg-names"><span>{from}</span><small>còn {num(Math.max(0, hud?.kmLeft ?? props.plan.km))} km</small><span>{to}</span></div>
          <div className="dg-track"><div className="dg-fill" style={{ width: `${pct}%` }} /><span className="dg-icon" style={{ left: `${pct}%` }} aria-hidden="true">{boat ? '⛴' : '🚚'}</span></div>
        </div>
        <button className="dg-cancel" onClick={() => setAsking(true)} disabled={arrived}>Huỷ chuyến</button>
        {hud && !arrived && <div className={`dg-nav ${hud.nav.urgent ? 'urgent' : ''}`} role="status"><b aria-hidden="true">{hud.nav.icon}</b><span>{hud.nav.text}</span></div>}
        <div className="dg-side">
          <div className="dg-stat" aria-label="Xăng, ETC và tiền mặt">
            <div className={low ? 'low' : ''}><i aria-hidden="true">⛽</i><span className={`dg-gauge ${low ? 'low' : ''}`}><u style={{ width: `${Math.min(100, (fuel / tank) * 100)}%` }} /></span></div>
            <div className={low ? 'low' : ''}><i /> {num(fuel, 1)} lít · ~{num(hud?.range ?? (fuel / Math.max(1, props.truck.lPer100km)) * 100)} km</div>
            <div><i aria-hidden="true">🎫</i> ETC {vnd(etcLeft)}</div>
            <div><i aria-hidden="true">💵</i> {vnd(cashLeft)}</div>
          </div>
          <canvas className="dg-map" ref={mapRef} aria-label="Bản đồ chỉ đường" />
        </div>
      </div>
      {bump && <div key={bump.id} className={`dg-bump ${bump.kind}`} role="status">{bump.text}</div>}
      {hud?.warn && !arrived && <div className="dg-warn" role="alert">⚠ {hud.warn}</div>}
      {flash && <div key={flash.id} className="dg-flash">{flash.text}</div>}
      {!failed && (
        <div className="dg-bottom">
          <button className={`dg-steer ${steer < 0 ? 'on' : ''}`} aria-label="Lái sang trái" {...hold(-1)}>◀</button>
          <div className="dg-speed"><strong>{hud?.kmh ?? 0}</strong><small>km/h</small></div>
          <button className={`dg-steer ${steer > 0 ? 'on' : ''}`} aria-label="Lái sang phải" {...hold(1)}>▶</button>
        </div>
      )}
      <div className="dg-center">
        {count > 0 && !failed && <div key={count} className="dg-count">{count}</div>}
        {sum && (
          <div className="dg-card" role="status">
            <h2>🎉 Đã tới {to}</h2>
            <ul className="dg-sum">
              <li><span>Quãng đường</span><b>{num(sum.km)} km</b></li>
              <li className={sum.detourKm > 0 ? 'bad' : ''}><span>Đi lố, vòng lại</span><b>{sum.detourKm > 0 ? `+${num(sum.detourKm)} km` : 'Không'}</b></li>
              <li><span>Xăng đã dùng</span><b>{num(sum.fuelUsed, 1)} lít</b></li>
              <li><span>Đổ thêm dọc đường</span><b>{sum.refuelL > 0 ? `${num(sum.refuelL, 1)} lít · ${vnd(sum.refuelCost)}` : 'Không'}</b></li>
              <li><span>Phí đường bộ ({sum.tollCount} trạm)</span><b>{vnd(sum.tollEtc + sum.tollCash)}</b></li>
              {sum.tollCash > 0 && <li className="bad"><span>Trong đó trả tiền mặt +20%</span><b>{vnd(sum.tollCash)}</b></li>}
              {sum.ranDry && <li className="bad"><span>Hết xăng giữa đường</span><b>Tốn phí cứu hộ</b></li>}
            </ul>
          </div>
        )}
        {asking && !arrived && (
          <div className="dg-card" role="alertdialog" aria-label="Huỷ chuyến">
            <h2>Huỷ chuyến đi?</h2><p>Bạn sẽ quay về nơi xuất phát và chưa tới được {to}.</p>
            <div className="dg-row"><button className="go" onClick={() => setAsking(false)}>Lái tiếp</button><button onClick={() => { if (!finished.current) { finished.current = true; props.onCancel(); } }}>Huỷ chuyến</button></div>
          </div>
        )}
      </div>
      {count <= 0 && hud && hud.progress < 0.06 && !arrived && !hud.warn && <div className="dg-hint">Kéo ngang, bấm ◀ ▶ hoặc phím ← → để đổi làn · theo biển xanh và bản đồ</div>}
    </div>
  );
}
