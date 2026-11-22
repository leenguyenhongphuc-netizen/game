// Hoạt cảnh chuyến du lịch: ra bến xe trước xóm, xe đưa đón, lên tàu/máy bay, đi qua cảnh quan rồi tới nơi.
// Là một trải nghiệm trọn vẹn nên không có nút bỏ qua. Tự chứa CSS, phủ kín màn hình.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { REGIONS } from '../../../shared/catalog.ts';
import { RideScene } from './RideScene.ts';
import type { RideMode } from './RideScene.ts';
import { RIDE_CSS, RideHud } from './RideHud.tsx';
import type { RideStep } from './RideHud.tsx';

export type { RideMode };

/** CSS riêng của taxi: ba nút nhìn quanh và ô đồng hồ tính tiền. */
const TAXI_CSS = `
.tr-look { position: absolute; left: 0; right: 0; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 76px); display: flex; justify-content: center; align-items: center; gap: 10px; pointer-events: none; }
.tr-look button { pointer-events: auto; min-width: 56px; min-height: 56px; border-radius: 999px; border: 3px solid #7a4a22; background: #fff8e4; color: #3b2a17; box-shadow: 0 4px 0 #56310f, 0 8px 16px #0003; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; font-weight: 800; font-size: 0.86rem; line-height: 1.1; padding: 4px 14px; cursor: pointer; touch-action: manipulation; }
.tr-look button:active { transform: translateY(3px); box-shadow: 0 1px 0 #56310f; }
.tr-look button.mid { min-width: 48px; min-height: 48px; background: #ffd95e; font-size: 0.78rem; }
.tr-look button b { display: block; font-size: 1.15rem; line-height: 1; }
.tr-meter { background: #12161c !important; color: #ff6a4a !important; border-color: #56310f !important; }
.tr-meter small { color: #ffd23f; font-size: 0.7em; margin-right: 6px; }
@media (max-height: 480px) {
  .tr-look { bottom: max(8px, env(safe-area-inset-bottom)); justify-content: space-between; padding: 0 max(12px, env(safe-area-inset-left)) 0 max(12px, env(safe-area-inset-right)); }
  .tr-look button { min-width: 48px; min-height: 48px; padding: 2px 10px; font-size: 0.74rem; }
  .tr-look button.mid { position: absolute; left: max(12px, env(safe-area-inset-left)); bottom: 58px; }
  .tr.taxi-cabin .tr-cap { left: 110px; right: 110px; }
}
`;

const INFO: Record<RideMode, { icon: string; name: string }> = {
  xe_khach: { icon: '🚌', name: 'Xe khách' }, tau_hoa: { icon: '🚆', name: 'Tàu hoả' }, may_bay: { icon: '✈️', name: 'Máy bay' }, tau_thuy: { icon: '⛴️', name: 'Tàu thuỷ' }, taxi: { icon: '🚕', name: 'Taxi' },
};

/** Các bước của từng loại hành trình, theo đúng thứ tự cảnh; xe khách không có bước trung chuyển. */
const STEPS: Record<RideMode, RideStep[]> = {
  xe_khach: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚌', label: 'Lên xe' }, { icon: '🛣️', label: 'Trên đường' }, { icon: '📍', label: 'Tới nơi' }],
  tau_hoa: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚐', label: 'Xe ra ga' }, { icon: '🚉', label: 'Lên tàu' }, { icon: '🚆', label: 'Trên đường' }, { icon: '📍', label: 'Tới ga' }],
  may_bay: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚕', label: 'Xe ra sân bay' }, { icon: '🛫', label: 'Lên máy bay' }, { icon: '✈️', label: 'Đang bay' }, { icon: '🛬', label: 'Hạ cánh' }],
  tau_thuy: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚐', label: 'Xe ra cảng' }, { icon: '⚓', label: 'Lên tàu' }, { icon: '⛴️', label: 'Ra khơi' }, { icon: '📍', label: 'Cập bến' }],
  taxi: [{ icon: '📱', label: 'Gọi xe' }, { icon: '🚕', label: 'Lên xe' }, { icon: '🛣️', label: 'Trên đường' }, { icon: '📍', label: 'Tới nơi' }],
};

export function TravelRide(props: {
  mode: RideMode;
  fromRegionId: string; toRegionId: string;
  km: number; seconds: number;
  /** Ghi đè tên nơi đến, ví dụ tên điểm tham quan. */
  toName?: string;
  /** Giá cước taxi, để đồng hồ tính tiền chạy tới đúng số này. */
  fare?: number;
  /** Taxi: cảnh bên phải đường. */
  sideHint?: 'bien' | 'song' | 'nui' | 'pho';
  onFinish: () => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RideScene | null>(null);
  const [meter, setMeter] = useState(0);
  const done = useRef(false);
  const cb = useRef(props); cb.current = props;
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [stage, setStage] = useState<{ n: number; caption: string; index: number }>({ n: 0, caption: '', index: 0 });
  const [frac, setFrac] = useState(0);
  const [failed, setFailed] = useState(false);
  const from = REGIONS[props.fromRegionId]?.name ?? 'Nơi đi', to = props.toName ?? REGIONS[props.toRegionId]?.name ?? 'Nơi đến';
  const finish = () => { if (done.current) return; done.current = true; cb.current.onFinish(); };

  useEffect(() => {
    let scene: RideScene | null = null, timer = 0, last = -1;
    try {
      scene = new RideScene(host.current!, {
        mode: props.mode, fromRegionId: props.fromRegionId, toRegionId: props.toRegionId, seconds: props.seconds,
        toName: props.toName, km: props.km, fare: props.fare, sideHint: props.sideHint, onMeter: setMeter,
        onTick: (p) => { const r = Math.round(p * 200); if (r !== last) { last = r; setProgress(p); } },
        onStage: (n, caption, index) => { setStage({ n, caption, index }); setFrac(0); if (n === 5) setProgress(1); },
        onStep: setFrac,
        onArrive: () => { setArrived(true); timer = window.setTimeout(finish, 1700); },
      });
      sceneRef.current = scene;
    } catch {
      setFailed(true); timer = window.setTimeout(finish, 1800); // không có đồ hoạ 3D thì báo rồi vẫn cho tới nơi
    }
    return () => { window.clearTimeout(timer); sceneRef.current = null; scene?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = INFO[props.mode], left = Math.max(0, Math.round(props.km * (1 - progress)));
  const fareText = props.mode === 'taxi' && stage.n >= 4 && meter > 0 ? ` · ${meter.toLocaleString('vi-VN')}đ` : '';
  const status = arrived ? `${info.name} · đã tới nơi${fareText}` : stage.n === 4 ? `${info.name} · còn ${left.toLocaleString('vi-VN')} km${fareText}` : `${info.name} · bước ${stage.index + 1}/${STEPS[props.mode].length}`;
  const cabin = props.mode === 'taxi' && stage.n === 4 && !arrived && !failed;
  const look = (d: number) => sceneRef.current?.look(d);
  return (
    <div className={cabin ? 'tr taxi-cabin' : 'tr'} role="dialog" aria-label={`Hành trình ${info.name} từ ${from} tới ${to}`} data-stage={stage.n}>
      <style>{RIDE_CSS}{props.mode === 'taxi' ? TAXI_CSS : ''}</style>
      <div ref={host} className="tr-scene" />
      <RideHud icon={info.icon} from={from} to={to} note={`${Math.round(props.km).toLocaleString('vi-VN')} km`}
        steps={STEPS[props.mode]} current={stage.index} frac={frac} finished={arrived} status={status} caption={failed ? '' : stage.caption}>
        {cabin && (
          <div className="tr-look">
            <button type="button" onClick={() => look(-1)} aria-label="Nhìn sang trái"><b aria-hidden="true">◀</b>Nhìn trái</button>
            <button type="button" className="mid" onClick={() => look(0)} aria-label="Nhìn thẳng phía trước">Nhìn thẳng</button>
            <button type="button" onClick={() => look(1)} aria-label="Nhìn sang phải"><b aria-hidden="true">▶</b>Nhìn phải</button>
          </div>
        )}
        {arrived && <div className="tr-arrive" role="status"><div>Đã tới {to}</div></div>}
        {failed && <p className="tr-fail">Thiết bị chưa bật đồ hoạ 3D nên không chiếu được đoạn phim hành trình.</p>}
      </RideHud>
    </div>
  );
}
