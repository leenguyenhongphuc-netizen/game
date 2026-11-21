// Hoạt cảnh hành trình du lịch: xem phương tiện đã mua vé đi qua cảnh quan tới nơi đến. Tự chứa CSS, phủ kín màn hình.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../../shared/catalog.ts';
import { RideScene } from './RideScene.ts';
import type { RideMode } from './RideScene.ts';

export type { RideMode };

const INFO: Record<RideMode, { icon: string; name: string }> = {
  xe_khach: { icon: '🚌', name: 'Xe khách' }, tau_hoa: { icon: '🚆', name: 'Tàu hoả' }, may_bay: { icon: '✈️', name: 'Máy bay' }, tau_thuy: { icon: '⛴️', name: 'Tàu thuỷ' },
};

const CSS = `
.tr  position: fixed; left: var(--vx, 0px); top: var(--vy, 0px); width: var(--vw, 100%); height: var(--vh, 100%); z-index: 1000; background: #dff3fb; overflow: hidden; font-family: 'Be Vietnam Pro', system-ui, sans-serif; color: #3b2a17; user-select: none; -webkit-user-select: none; }
.tr-scene { position: absolute; inset: 0; }
.tr-top { position: absolute; top: max(10px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); right: max(10px, env(safe-area-inset-right)); display: grid; gap: 6px; pointer-events: none; }
.tr-bar { background: #fff6dc; border: 3px solid #7a4a22; border-radius: 18px; box-shadow: 0 4px 0 #56310f; padding: 6px 12px 8px; min-width: 0; }
.tr-title { display: flex; align-items: center; gap: 6px; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; font-weight: 800; font-size: clamp(0.85rem, 3.6vw, 1.05rem); min-width: 0; }
.tr-title span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tr-title b { flex-shrink: 0; }
.tr-track { position: relative; height: 12px; border-radius: 8px; background: #e8d6a6; border: 2px solid #cdb67c; margin: 16px 12px 2px; }
.tr-fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: linear-gradient(#7fd0f5, #2a7fd6); }
.tr-icon { position: absolute; top: -21px; font-size: 1.5rem; transform: translateX(-50%) scaleX(-1); }
.tr-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tr-pill { background: #7a4a22; color: #fff7d6; border: 3px solid #56310f; border-radius: 999px; padding: 2px 12px; font-family: 'Baloo 2', sans-serif; font-weight: 800; box-shadow: 0 3px 0 #2e1905; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tr-skip { pointer-events: auto; font: inherit; font-family: 'Baloo 2', sans-serif; font-weight: 700; color: inherit; background: #f6e7bd; border: 2px solid #7a4a22; border-radius: 12px; box-shadow: 0 3px 0 #7a4a22; padding: 4px 14px; min-height: 40px; cursor: pointer; white-space: nowrap; }
.tr-skip:active { transform: translateY(2px); box-shadow: 0 1px 0 #7a4a22; }
.tr-skip:focus-visible { outline: 3px solid #1f6feb; outline-offset: 2px; }
.tr-arrive { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; pointer-events: none; }
.tr-arrive div { font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: clamp(1.8rem, 8vw, 3.4rem); line-height: 1.1; text-align: center; color: #fff3b0; -webkit-text-stroke: 3px #56310f; paint-order: stroke fill; text-shadow: 0 4px 0 #0003; animation: tr-pop 0.4s cubic-bezier(0.2, 1.6, 0.4, 1); }
.tr-fail { position: absolute; inset: 40% 24px auto; text-align: center; background: #fff6dc; border-radius: 14px; padding: 16px; }
@keyframes tr-pop { from { transform: scale(0.5); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tr-arrive div { animation: none; } }
`;

export function TravelRide(props: {
  mode: RideMode;
  fromRegionId: string; toRegionId: string;
  km: number; seconds: number;
  onFinish: () => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const cb = useRef(props); cb.current = props;
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [failed, setFailed] = useState(false);
  const from = REGIONS[props.fromRegionId]?.name ?? 'Nơi đi', to = REGIONS[props.toRegionId]?.name ?? 'Nơi đến';
  const finish = () => { if (done.current) return; done.current = true; cb.current.onFinish(); };

  useEffect(() => {
    let scene: RideScene | null = null, timer = 0, last = -1;
    try {
      scene = new RideScene(host.current!, {
        mode: props.mode, fromRegionId: props.fromRegionId, toRegionId: props.toRegionId, seconds: props.seconds,
        onTick: (p) => { const r = Math.round(p * 200); if (r !== last) { last = r; setProgress(p); } },
        onArrive: () => { setArrived(true); timer = window.setTimeout(finish, 1200); },
      });
    } catch {
      setFailed(true); timer = window.setTimeout(finish, 1500); // không có đồ hoạ 3D thì vẫn cho tới nơi
    }
    return () => { window.clearTimeout(timer); scene?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = INFO[props.mode], left = Math.max(0, Math.round(props.km * (1 - progress)));
  return (
    <div className="tr" role="dialog" aria-label={`Hành trình ${info.name} từ ${from} tới ${to}`}>
      <style>{CSS}</style>
      <div ref={host} className="tr-scene" />
      <div className="tr-top">
        <div className="tr-bar">
          <div className="tr-title"><b aria-hidden="true">{info.icon}</b><span>{from}</span><b aria-hidden="true">→</b><span>{to}</span></div>
          <div className="tr-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="tr-fill" style={{ width: `${progress * 100}%` }} />
            <div className="tr-icon" style={{ left: `${progress * 100}%` }} aria-hidden="true">{info.icon}</div>
          </div>
        </div>
        <div className="tr-row">
          <span className="tr-pill">{info.name} · còn {left.toLocaleString('vi-VN')} km</span>
          <button className="tr-skip" onClick={finish}>Bỏ qua ⏭</button>
        </div>
      </div>
      {arrived && <div className="tr-arrive" role="status"><div>Đã tới {to}</div></div>}
      {failed && <p className="tr-fail">Thiết bị chưa bật đồ hoạ 3D nên bỏ qua đoạn phim hành trình.</p>}
    </div>
  );
}
