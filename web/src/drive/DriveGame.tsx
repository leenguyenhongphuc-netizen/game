// Màn lái xe tải của Thương lái (có thể kèm chặng phà). Tự chứa CSS, phủ kín màn hình.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../../shared/catalog.ts';
import { DriveScene } from './DriveScene.ts';
import type { DriveHud, DriveSummary, DriveTicket, View } from './DriveScene.ts';

export interface DrivePlan { km: number; needsBoat: boolean; seconds: number; tolls: number; tollFee: number; fuelNeededL: number; junctions: { atKm: number; dir: 'L' | 'R'; name: string }[]; stationsAtKm: number[] }
/** `speeding`: số km/h vượt quá ở mỗi lần bị CSGT lập biên bản (máy chủ tự tính tiền phạt theo luật). */
export interface DriveResult { refuelL: number; detourKm: number; speeding?: number[] }

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
.dg-nav { grid-column: 1 / -1; grid-row: 2; display: flex; align-items: center; gap: 8px; background: #1f8a4c; color: #fff; border: 3px solid #fff; border-radius: 14px; box-shadow: 0 3px 0 #0f5a30; padding: 4px 10px 4px 6px; min-height: 44px; font-weight: 700; font-size: 0.9rem; }
.dg-nav.urgent { background: #e2622b; box-shadow: 0 3px 0 #9c3a12; animation: dg-pulse 0.7s ease-in-out infinite alternate; }
.dg-nav b { flex: none; width: 34px; height: 34px; border-radius: 10px; background: #ffffff; color: #1f8a4c; display: grid; place-items: center; font-size: 1.5rem; line-height: 1; font-weight: 800; }
.dg-nav.urgent b { color: #e2622b; }
.dg-nav span { min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dg-side { grid-column: 1 / -1; grid-row: 3; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.dg-stat { background: #fff6dcf2; border: 2px solid #7a4a22; border-radius: 14px; box-shadow: 0 3px 0 #56310f; padding: 6px 9px; display: grid; gap: 3px; font-weight: 700; font-size: 0.8rem; font-variant-numeric: tabular-nums; min-width: 132px; max-width: 46%; }
.dg-stat div { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.dg-stat i { font-style: normal; flex: none; width: 1.2em; text-align: center; }
.dg-gauge { flex: 1; height: 9px; min-width: 40px; border-radius: 6px; background: #e8d6a6; border: 1.5px solid #cdb67c; overflow: hidden; }
.dg-gauge u { display: block; height: 100%; background: linear-gradient(#ffd23f, #f0a51e); text-decoration: none; }
.dg-gauge.low u { background: #e0342b; }
.dg-stat .low { color: #c0281e; }
.dg-map { width: 116px; height: 116px; border-radius: 16px; border: 3px solid #7a4a22; box-shadow: 0 3px 0 #56310f; background: #e9f3d8f2; display: block; flex: none; }
.dg-warn { grid-column: 1 / -1; justify-self: center; max-width: 100%; background: #c0281e; color: #fff; border: 3px solid #fff; border-radius: 14px; padding: 4px 12px; font-weight: 800; font-size: 0.86rem; text-align: center; box-shadow: 0 3px 0 #7d150e; }
.dg-bottom { position: absolute; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: end; gap: 6px; pointer-events: none; }
.dg-left, .dg-right { display: grid; gap: 8px; justify-items: start; }
.dg-right { justify-items: end; }
.dg-pair { display: flex; gap: 6px; align-items: flex-end; }
.dg-steer { pointer-events: auto; width: 64px; height: 64px; border-radius: 50%; border: 3px solid #7a4a22; background: #fff6dce6; box-shadow: 0 5px 0 #56310f; font-size: 1.7rem; line-height: 1; color: #7a4a22; cursor: pointer; touch-action: none; padding: 0; font-family: inherit; }
.dg-steer.on, .dg-pedal.on { transform: translateY(4px); box-shadow: 0 1px 0 #56310f; filter: brightness(1.12); }
.dg-pedal { pointer-events: auto; touch-action: none; cursor: pointer; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; color: #fff; border: 3px solid #56310f; box-shadow: 0 5px 0 #56310f; padding: 0; display: grid; place-items: center; line-height: 1.05; font-size: 0.82rem; letter-spacing: 0.02em; }
.dg-pedal i { font-style: normal; font-size: 1.25rem; display: block; }
.dg-pedal.brake { width: 66px; height: 58px; border-radius: 14px; background: repeating-linear-gradient(0deg, #c0392b 0 7px, #a93226 7px 9px); }
.dg-pedal.gas { width: 60px; height: 92px; border-radius: 14px 14px 20px 20px; background: repeating-linear-gradient(0deg, #2f9d46 0 7px, #27853a 7px 9px); }
.dg-mini { display: flex; gap: 6px; }
.dg-mini button { pointer-events: auto; touch-action: manipulation; cursor: pointer; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 0.78rem; min-width: 48px; height: 48px; padding: 0 6px; border-radius: 14px; border: 2.5px solid #7a4a22; background: #fff6dcee; box-shadow: 0 3px 0 #56310f; color: #56310f; line-height: 1.05; }
.dg-mini button b { display: block; font-size: 1.05rem; line-height: 1; }
.dg-mini button.on { background: #ffd23f; }
.dg-mini button.rev { background: #e0342b; color: #fff; border-color: #7d150e; }
.dg-mini button:disabled { opacity: 0.45; }
.dg-dash { justify-self: center; align-self: end; display: grid; justify-items: center; gap: 3px; margin-bottom: 2px; position: relative; }
.dg-dial { position: relative; width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle at 50% 42%, #3d434c, #1c1f24 72%); border: 3px solid #0e0f12; box-shadow: 0 3px 0 #0008, inset 0 0 0 2px #5a626e; color: #fff; display: grid; place-items: center; font-family: 'Baloo 2', sans-serif; font-variant-numeric: tabular-nums; }
.dg-dial svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dg-dial strong { font-size: 1.7rem; line-height: 1; margin-top: 12px; position: relative; }
.dg-dial small { position: absolute; bottom: 15px; left: 0; right: 0; text-align: center; font-size: 0.6rem; opacity: 0.8; font-weight: 700; letter-spacing: 0.04em; }
.dg-dial.over strong { color: #ff5a4d; } .dg-dial.over { animation: dg-pulse 0.5s ease-in-out infinite alternate; }
.dg-limit { position: absolute; top: -12px; right: -14px; width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 5px solid #d7261c; color: #16181c; display: grid; place-items: center; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 0.9rem; box-shadow: 0 2px 0 #0005; line-height: 1; }
.dg-limit.over { animation: dg-blink 0.45s steps(2) infinite; }
.dg-odo { background: #16181c; color: #e8f6d8; border: 2px solid #5a626e; border-radius: 8px; padding: 1px 7px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 700; font-size: 0.72rem; letter-spacing: 0.06em; white-space: nowrap; display: flex; gap: 6px; align-items: center; }
.dg-odo em { font-style: normal; background: #2f9d46; color: #fff; border-radius: 4px; padding: 0 5px; font-family: 'Baloo 2', sans-serif; } .dg-odo em.r { background: #e0342b; }
.dg-sleep { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 55%, #0000 35%, #000 100%); transition: opacity 0.6s; }
.dg-ticket { text-align: left; width: min(380px, 100%); gap: 6px; }
.dg-ticket h2 { text-align: center; color: #1f4fa8; font-size: 1.25rem; }
.dg-ticket .big { text-align: center; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.7rem; color: #c0281e; line-height: 1.1; }
.dg-ticket small { color: #7a6547; display: block; line-height: 1.3; }
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
.dg-hint { position: absolute; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 168px); left: 50%; transform: translateX(-50%); background: #fffdf4ee; border: 2px solid #e3cf9a; border-radius: 14px; padding: 4px 12px; font-weight: 600; font-size: 0.84rem; text-align: center; max-width: calc(100% - 24px); width: max-content; pointer-events: none; }
.dg-flash { position: absolute; inset: 0; background: #ffffff; display: grid; place-items: center; animation: dg-flash 1.6s ease-in-out forwards; pointer-events: none; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.6rem; color: #3f8fd6; text-align: center; padding: 20px; }
.dg-fail { position: absolute; inset: 40% 24px auto; text-align: center; background: #fff6dc; border-radius: 14px; padding: 16px; }
@keyframes dg-pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes dg-pulse { to { filter: brightness(1.18); } }
@keyframes dg-float { from { opacity: 0; transform: translate(-50%, 16px) scale(0.7); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1.05); } 80% { opacity: 1; transform: translate(-50%, 0) scale(1); } to { opacity: 0; transform: translate(-50%, -24px) scale(1); } }
@keyframes dg-blink { 50% { background: #ffd0cc; } }
@keyframes dg-flash { 0% { opacity: 0; } 25%, 65% { opacity: 0.94; } 100% { opacity: 0; } }
@media (max-height: 480px) {
  .dg-top { grid-template-columns: minmax(150px, 30%) minmax(0, 1fr) auto; gap: 5px; }
  .dg-nav { grid-column: 2; grid-row: 1; min-height: 40px; font-size: 0.84rem; }
  .dg-bar { grid-row: 1; grid-column: 1; padding: 2px 9px 4px; } .dg-side { grid-row: 2; } .dg-cancel { grid-row: 1; grid-column: 3; }
  .dg-track { margin-top: 11px; height: 8px; } .dg-icon { font-size: 1.05rem; top: -16px; }
  .dg-map { width: 94px; height: 94px; } .dg-stat { font-size: 0.76rem; padding: 4px 8px; }
  .dg-steer { width: 58px; height: 58px; } .dg-bump { top: 40%; font-size: 1.2rem; } .dg-pedal.gas { height: 72px; } .dg-pedal.brake { height: 50px; } .dg-dial { width: 78px; height: 78px; } .dg-dial strong { font-size: 1.35rem; margin-top: 9px; } .dg-dial small { bottom: 11px; } .dg-mini button { height: 44px; min-width: 46px; } .dg-right { grid-auto-flow: column; align-items: end; } .dg-left { gap: 4px; }
  .dg-warn { font-size: 0.8rem; padding: 2px 10px; } .dg-hint { bottom: auto; top: calc(max(8px, env(safe-area-inset-top)) + 54px); max-width: 44%; } .dg-dash { justify-self: end; margin-right: 6px; }
  .dg-bottom { bottom: max(8px, env(safe-area-inset-bottom)); }
  .dg-card { padding: 10px 14px; gap: 5px; width: min(440px, 100%); } .dg-card h2 { font-size: 1.2rem; } .dg-sum { grid-template-columns: 1fr 1fr; column-gap: 14px; font-size: 0.84rem; }
}
@media (max-width: 400px) and (min-height: 481px) { .dg-steer { width: 56px; height: 56px; font-size: 1.45rem; } .dg-pedal.brake { width: 56px; height: 54px; font-size: 0.72rem; } .dg-pedal.gas { width: 54px; height: 86px; } .dg-dial { width: 84px; height: 84px; } .dg-dial strong { font-size: 1.45rem; } .dg-dial small { bottom: 12px; } .dg-mini button { min-width: 46px; font-size: 0.72rem; padding: 0 4px; } .dg-odo { font-size: 0.66rem; padding: 1px 5px; } .dg-bottom { gap: 2px; } }
@media (min-width: 700px) and (min-height: 481px) { .dg { font-size: 16px; } .dg-top { max-width: 720px; margin: 0 auto; } .dg-map { width: 150px; height: 150px; } }
@media (prefers-reduced-motion: reduce) { .dg-count, .dg-card, .dg-bump, .dg-flash, .dg-nav.urgent { animation-duration: 0.01s; } }
`;

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ';
const compass = (deg: number) => ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
function readView(): View { try { return localStorage.getItem('vv-drive-view') === 'pov' ? 'pov' : 'chase'; } catch { return 'chase'; } }
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
  const [pedal, setPedal] = useState<'' | 'gas' | 'brake'>('');
  const [ticket, setTicket] = useState<DriveTicket | null>(null);
  const from = REGIONS[props.fromRegionId]?.name ?? 'Nơi đi', to = REGIONS[props.toRegionId]?.name ?? 'Nơi đến';

  useEffect(() => {
    let id = 0;
    try {
      scene.current = new DriveScene(host.current!, {
        fromRegionId: props.fromRegionId, toRegionId: props.toRegionId, plan: props.plan, fuelL: props.fuelL, truck: props.truck, etc: props.etc, truckColor: props.truckColor,
        view: readView(), cruise: (window as unknown as { __driveAuto?: boolean }).__driveAuto === true,
        onPolice: setTicket,
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
  // Lời nhắc cách lái chỉ hiện ít giây đầu, không che xe suốt đoạn đường.
  const [hint, setHint] = useState(true);
  useEffect(() => { if (count > 0) return; const t = setTimeout(() => setHint(false), 7000); return () => clearTimeout(t); }, [count <= 0]);

  // Tới nơi: hiện bảng tổng kết rồi báo ra ngoài đúng một lần
  useEffect(() => {
    if (!sum) return;
    const t = setTimeout(() => { if (!finished.current) { finished.current = true; cb.current.onFinish({ refuelL: sum.refuelL, detourKm: sum.detourKm, speeding: sum.speeding }); } }, sum.speeding.length ? 4200 : 2600);
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

  const press = (which: 'gas' | 'brake') => {
    const set = (v: number) => { if (which === 'gas') scene.current?.setThrottle(v); else scene.current?.setBrake(v); setPedal(v ? which : ''); };
    return {
      onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } set(1); },
      onPointerUp: () => set(0), onPointerCancel: () => set(0), onLostPointerCapture: () => set(0),
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  };
  const toggleView = () => { const v: View = hud?.view === 'pov' ? 'chase' : 'pov'; scene.current?.setView(v); try { localStorage.setItem('vv-drive-view', v); } catch { /* bỏ qua */ } };
  const boat = hud?.mode === 'boat', arrived = !!sum;
  const speedNow = boat ? Math.round((hud?.knots ?? 0) * 10) / 10 : hud?.kmh ?? 0, dialMax = boat ? 16 : 160, sweep = Math.min(1, speedNow / dialMax);
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
        {hud?.warn && !arrived && <div className="dg-warn" role="alert">⚠ {hud.warn}</div>}
      </div>
      {bump && <div key={bump.id} className={`dg-bump ${bump.kind}`} role="status">{bump.text}</div>}
      {flash && <div key={flash.id} className="dg-flash">{flash.text}</div>}
      {!failed && (
        <div className="dg-bottom">
          <div className="dg-left">
            <div className="dg-mini">
              <button className={hud?.view === 'pov' ? 'on' : ''} aria-label={hud?.view === 'pov' ? 'Đổi sang góc nhìn sau xe' : 'Đổi sang góc nhìn trong ca-bin'} aria-pressed={hud?.view === 'pov'} onClick={toggleView}><b aria-hidden="true">🎥</b>{hud?.view === 'pov' ? 'Ca-bin' : 'Sau xe'}</button>
              <button className={hud?.cruise ? 'on' : ''} aria-label="Ga tự động giữ đúng tốc độ biển báo" aria-pressed={!!hud?.cruise} onClick={() => scene.current?.setCruise(!hud?.cruise)}><b aria-hidden="true">A</b>Ga tự động</button>
            </div>
            <div className="dg-pair">
              <button className={`dg-steer ${steer < 0 ? 'on' : ''}`} aria-label="Lái sang trái" {...hold(-1)}>◀</button>
              <button className={`dg-steer ${steer > 0 ? 'on' : ''}`} aria-label="Lái sang phải" {...hold(1)}>▶</button>
            </div>
          </div>
          <div className="dg-dash" aria-label={boat ? `Tốc độ ${num(speedNow, 1)} hải lý một giờ` : `Tốc độ ${speedNow} km/h, giới hạn ${hud?.limit ?? 0}`}>
            <div className={`dg-dial ${hud?.over ? 'over' : ''}`}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="#5a626e" strokeWidth="6" strokeLinecap="round" />
                <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke={hud?.over ? '#ff5a4d' : '#6fd45c'} strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${sweep * 100} 100`} />
                {!boat && hud && hud.limit > 0 && <line x1="50" y1="6" x2="50" y2="17" stroke="#ff5a4d" strokeWidth="3" strokeLinecap="round" transform={`rotate(${-135 + 270 * Math.min(1, hud.limit / dialMax)} 50 50)`} />}
              </svg>
              <strong>{boat ? num(speedNow, 1) : speedNow}</strong><small>{boat ? 'hải lý/giờ' : 'km/h'}</small>
              {!boat && hud && hud.limit > 0 && <span className={`dg-limit ${hud.over ? 'over' : ''}`} aria-hidden="true">{hud.limit}</span>}
            </div>
            <div className="dg-odo">{boat ? <><em>⛴</em>{String(Math.round(hud?.heading ?? 0)).padStart(3, '0')}° · {compass(hud?.heading ?? 0)}</> : <><em className={hud?.gear === 'R' ? 'r' : ''}>{hud?.gear ?? 'D'}</em>ODO {(hud?.odo ?? 0).toFixed(1).padStart(6, '0').replace('.', ',')}</>}</div>
          </div>
          <div className="dg-right">
            {!boat && <div className="dg-mini">
              <button className={hud?.gear === 'R' ? 'rev' : ''} aria-label={hud?.gear === 'R' ? 'Về số tiến' : 'Gài số lùi (chỉ khi xe đã dừng)'} aria-pressed={hud?.gear === 'R'} disabled={!hud?.canReverse && hud?.gear !== 'R'} onClick={() => scene.current?.setGear(hud?.gear === 'R' ? 'D' : 'R')}><b aria-hidden="true">{hud?.gear === 'R' ? 'D' : 'R'}</b>{hud?.gear === 'R' ? 'Số tiến' : 'Số lùi'}</button>
            </div>}
            <div className="dg-pair">
              <button className={`dg-pedal brake ${pedal === 'brake' ? 'on' : ''}`} aria-label={boat ? 'Giảm máy' : 'Đạp thắng'} {...press('brake')}><span><i aria-hidden="true">⏹</i>{boat ? 'GIẢM' : 'THẮNG'}</span></button>
              <button className={`dg-pedal gas ${pedal === 'gas' ? 'on' : ''}`} aria-label={boat ? 'Tăng máy' : 'Đạp ga'} {...press('gas')}><span><i aria-hidden="true">▲</i>{boat ? 'MÁY' : 'GA'}</span></button>
            </div>
          </div>
        </div>
      )}
      {hud && hud.tired > 0.8 && !arrived && <div className="dg-sleep" style={{ opacity: Math.min(0.75, (hud.tired - 0.8) * 4) }} aria-hidden="true" />}
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
              {sum.rests > 0 && <li><span>Ghé trạm dừng nghỉ</span><b>{sum.rests} lần</b></li>}
              <li className={sum.speeding.length ? 'bad' : ''}><span>Phạt quá tốc độ{sum.speeding.length ? ` (${sum.speeding.length} lần)` : ''}</span><b>{sum.speeding.length ? vnd(sum.fineTotal) : 'Không vi phạm 👍'}</b></li>
            </ul>
          </div>
        )}
        {ticket && !arrived && (
          <div className="dg-card dg-ticket" role="alertdialog" aria-label="Biên bản vi phạm tốc độ">
            <h2>🚨 CSGT · Biên bản vi phạm</h2>
            <ul className="dg-sum">
              <li><span>Tốc độ đo được</span><b>{ticket.kmh} km/h</b></li>
              <li><span>Tốc độ tối đa cho phép</span><b>{ticket.limit} km/h</b></li>
              <li className="bad"><span>Vượt quá</span><b>{ticket.over} km/h</b></li>
            </ul>
            <div className="big">Phạt {vnd(ticket.fine)}</div>
            <small>Lỗi: ô tô chạy {ticket.label}. Khung phạt {vnd(ticket.min)} – {vnd(ticket.max)}{ticket.points ? `, trừ ${ticket.points} điểm giấy phép lái xe` : ''}. Trong game tính mức giữa khung và trừ vào tiền mặt.</small>
            <small>Căn cứ: Điều 6 Nghị định 168/2024/NĐ-CP. Chạy đúng biển tròn viền đỏ bên đường — vừa an toàn vừa đỡ tốn xăng.</small>
            <div className="dg-row"><button className="go" onClick={() => { scene.current?.resume(); setTicket(null); }}>Đã hiểu, chạy đúng tốc độ</button></div>
          </div>
        )}
        {asking && !arrived && (
          <div className="dg-card" role="alertdialog" aria-label="Huỷ chuyến">
            <h2>Huỷ chuyến đi?</h2><p>Bạn sẽ quay về nơi xuất phát và chưa tới được {to}.</p>
            <div className="dg-row"><button className="go" onClick={() => setAsking(false)}>Lái tiếp</button><button onClick={() => { if (!finished.current) { finished.current = true; props.onCancel(); } }}>Huỷ chuyến</button></div>
          </div>
        )}
      </div>
      {count <= 0 && hud && hint && !arrived && !hud.warn && <div className="dg-hint">{boat ? 'Giữ MÁY để tàu chạy · ◀ ▶ bẻ lái · đi giữa phao đỏ và phao xanh' : 'Giữ GA để chạy, THẮNG để giảm tốc · ◀ ▶ đổi làn · chạy đúng biển tròn đỏ'}</div>}
    </div>
  );
}
