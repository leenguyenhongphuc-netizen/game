// Hoạt cảnh xuất khẩu: mỗi đường (xe tải, container, tàu hoả, hàng không, tàu nhỏ, tàu lớn) một đoạn phim ba cảnh,
// kết thúc bằng thẻ "Đã thông quan". Không có nút bỏ qua. Tự chứa CSS, phủ kín màn hình.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { ExportMode } from '../../../shared/rules.ts';
import { RideScene } from './RideScene.ts';
import { EXPORT_INFO, exportPlan } from './ExportSets.ts';
import { RIDE_CSS, RideHud } from './RideHud.tsx';

export type { ExportMode };

export function ExportRide(props: {
  mode: ExportMode;
  fromName: string; marketName: string;
  specialtyName: string; emoji: string; kg: number;
  onDone: () => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const cb = useRef(props); cb.current = props;
  const [stage, setStage] = useState<{ caption: string; index: number }>({ caption: '', index: 0 });
  const [frac, setFrac] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [failed, setFailed] = useState(false);
  const finish = () => { if (done.current) return; done.current = true; cb.current.onDone(); };
  const info = EXPORT_INFO[props.mode] ?? EXPORT_INFO.xe_tai, kg = props.kg.toLocaleString('vi-VN');

  useEffect(() => {
    let scene: RideScene | null = null, timer = 0;
    const mode = EXPORT_INFO[props.mode] ? props.mode : 'xe_tai';
    try {
      scene = new RideScene(host.current!, {
        mode: 'xe_khach', fromRegionId: props.fromName, toRegionId: props.marketName + mode, seconds: 0,
        plan: exportPlan({ mode, fromName: props.fromName, marketName: props.marketName, specialtyName: props.specialtyName, kg: props.kg }),
        sky: mode === 'hang_khong' ? [0x4fa8ee, 0xd8f0fc] : undefined,
        onStage: (_n, caption, index) => { setStage({ caption, index }); setFrac(0); },
        onStep: setFrac,
        onArrive: () => { setCleared(true); timer = window.setTimeout(finish, 2600); },
      });
    } catch {
      setFailed(true); setCleared(true); timer = window.setTimeout(finish, 2600); // không có đồ hoạ 3D thì vẫn báo thông quan
    }
    return () => { window.clearTimeout(timer); scene?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = info.steps.length, current = cleared ? n - 1 : stage.index;
  return (
    <div className="tr" role="dialog" aria-label={`Xuất khẩu ${props.specialtyName} bằng ${info.name} tới ${props.marketName}`} data-stage={stage.index + 1} data-cleared={cleared ? '1' : '0'}>
      <style>{RIDE_CSS}</style>
      <div ref={host} className="tr-scene" />
      <RideHud icon={info.icon} from={props.fromName} to={props.marketName} note={`${kg} kg`}
        steps={info.steps} current={current} frac={frac} finished={cleared}
        status={cleared ? `${info.name} · đã thông quan` : `${info.name} · bước ${stage.index + 1}/${n}`} caption={failed ? '' : stage.caption}>
        {cleared && (
          <div className="tr-arrive" role="status">
            <section className="tr-card">
              <span className="stamp">Đã thông quan</span>
              <div className="big"><span aria-hidden="true">{props.emoji} </span>{kg} kg {props.specialtyName}</div>
              <p>đang trên đường tới {props.marketName} bằng {info.by}</p>
            </section>
          </div>
        )}
        {failed && <p className="tr-fail">Thiết bị chưa bật đồ hoạ 3D nên không chiếu được đoạn phim xuất khẩu.</p>}
      </RideHud>
    </div>
  );
}
