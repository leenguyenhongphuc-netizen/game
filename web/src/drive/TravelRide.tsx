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

const INFO: Record<RideMode, { icon: string; name: string }> = {
  xe_khach: { icon: '🚌', name: 'Xe khách' }, tau_hoa: { icon: '🚆', name: 'Tàu hoả' }, may_bay: { icon: '✈️', name: 'Máy bay' }, tau_thuy: { icon: '⛴️', name: 'Tàu thuỷ' },
};

/** Các bước của từng loại hành trình, theo đúng thứ tự cảnh; xe khách không có bước trung chuyển. */
const STEPS: Record<RideMode, RideStep[]> = {
  xe_khach: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚌', label: 'Lên xe' }, { icon: '🛣️', label: 'Trên đường' }, { icon: '📍', label: 'Tới nơi' }],
  tau_hoa: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚐', label: 'Xe ra ga' }, { icon: '🚉', label: 'Lên tàu' }, { icon: '🚆', label: 'Trên đường' }, { icon: '📍', label: 'Tới ga' }],
  may_bay: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚕', label: 'Xe ra sân bay' }, { icon: '🛫', label: 'Lên máy bay' }, { icon: '✈️', label: 'Đang bay' }, { icon: '🛬', label: 'Hạ cánh' }],
  tau_thuy: [{ icon: '🚶', label: 'Ra bến xe' }, { icon: '🚐', label: 'Xe ra cảng' }, { icon: '⚓', label: 'Lên tàu' }, { icon: '⛴️', label: 'Ra khơi' }, { icon: '📍', label: 'Cập bến' }],
};

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
  const [stage, setStage] = useState<{ n: number; caption: string; index: number }>({ n: 0, caption: '', index: 0 });
  const [frac, setFrac] = useState(0);
  const [failed, setFailed] = useState(false);
  const from = REGIONS[props.fromRegionId]?.name ?? 'Nơi đi', to = REGIONS[props.toRegionId]?.name ?? 'Nơi đến';
  const finish = () => { if (done.current) return; done.current = true; cb.current.onFinish(); };

  useEffect(() => {
    let scene: RideScene | null = null, timer = 0, last = -1;
    try {
      scene = new RideScene(host.current!, {
        mode: props.mode, fromRegionId: props.fromRegionId, toRegionId: props.toRegionId, seconds: props.seconds,
        onTick: (p) => { const r = Math.round(p * 200); if (r !== last) { last = r; setProgress(p); } },
        onStage: (n, caption, index) => { setStage({ n, caption, index }); setFrac(0); if (n === 5) setProgress(1); },
        onStep: setFrac,
        onArrive: () => { setArrived(true); timer = window.setTimeout(finish, 1700); },
      });
    } catch {
      setFailed(true); timer = window.setTimeout(finish, 1800); // không có đồ hoạ 3D thì báo rồi vẫn cho tới nơi
    }
    return () => { window.clearTimeout(timer); scene?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const info = INFO[props.mode], left = Math.max(0, Math.round(props.km * (1 - progress)));
  const status = arrived ? `${info.name} · đã tới nơi` : stage.n === 4 ? `${info.name} · còn ${left.toLocaleString('vi-VN')} km` : `${info.name} · bước ${stage.index + 1}/${STEPS[props.mode].length}`;
  return (
    <div className="tr" role="dialog" aria-label={`Hành trình ${info.name} từ ${from} tới ${to}`} data-stage={stage.n}>
      <style>{RIDE_CSS}</style>
      <div ref={host} className="tr-scene" />
      <RideHud icon={info.icon} from={from} to={to} note={`${Math.round(props.km).toLocaleString('vi-VN')} km`}
        steps={STEPS[props.mode]} current={stage.index} frac={frac} finished={arrived} status={status} caption={failed ? '' : stage.caption}>
        {arrived && <div className="tr-arrive" role="status"><div>Đã tới {to}</div></div>}
        {failed && <p className="tr-fail">Thiết bị chưa bật đồ hoạ 3D nên không chiếu được đoạn phim hành trình.</p>}
      </RideHud>
    </div>
  );
}
