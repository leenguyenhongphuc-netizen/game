// Hoạt cảnh nhập máy: tàu container cập cảng và cẩu dỡ → thông quan ở cổng hải quan → xe đầu kéo chở máy về xưởng.
// Dựng lại từ các cảnh của hoạt cảnh xuất khẩu (đổi thứ tự và lời thuyết minh). Không có nút bỏ qua.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { RideScene } from './RideScene.ts';
import { exportPlan } from './ExportSets.ts';
import { RIDE_CSS, RideHud } from './RideHud.tsx';
import type { RideStep } from './RideHud.tsx';

/** Phần của đơn nhập máy mà hoạt cảnh cần (khớp `ImportOrder` trong workshop.tsx). */
export interface ImportRideOrder { name: string; origin: string; flag?: string; port: string; total?: number }

const STEPS: RideStep[] = [{ icon: '🚢', label: 'Tàu cập cảng' }, { icon: '🛃', label: 'Thông quan' }, { icon: '🚛', label: 'Về xưởng' }, { icon: '🏭', label: 'Tới nơi' }];

export function ImportRide(props: { order: ImportRideOrder; onDone: () => void }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const cb = useRef(props); cb.current = props;
  const [stage, setStage] = useState<{ caption: string; index: number }>({ caption: '', index: 0 });
  const [frac, setFrac] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [failed, setFailed] = useState(false);
  const finish = () => { if (done.current) return; done.current = true; cb.current.onDone(); };
  const o = props.order, port = o.port.replace(/^Cảng\s+/i, '');

  useEffect(() => {
    let scene: RideScene | null = null, timer = 0;
    try {
      // Cảnh 1: cảng nước sâu, cẩu giàn làm hàng. Cảnh 2: cổng hải quan ở cảng cạn. Cảnh 3: xe container chạy cao tốc.
      const sea = exportPlan({ mode: 'tau_lon', fromName: port, marketName: 'Việt Nam', specialtyName: o.name, kg: 0 });
      const land = exportPlan({ mode: 'container', fromName: 'Xưởng nhà', marketName: 'Xưởng nhà', specialtyName: o.name, kg: 0 });
      const captions = [
        `Tàu container từ ${o.origin} cập ${o.port}, cẩu giàn dỡ container chở ${o.name}`,
        `Khai hải quan, nộp thuế nhập khẩu và thuế giá trị gia tăng rồi thông quan`,
        `Xe đầu kéo chở ${o.name} chạy cao tốc về xưởng`,
      ];
      const acts = [sea[0], land[2], land[1]];
      scene = new RideScene(host.current!, {
        mode: 'xe_khach', fromRegionId: o.origin, toRegionId: `nhap:${o.name}`, seconds: 0,
        plan: acts.map((mk, i) => () => ({ ...mk(), stage: i + 1, caption: captions[i] })),
        onStage: (_n, caption, index) => { setStage({ caption, index }); setFrac(0); },
        onStep: setFrac,
        onArrive: () => { setArrived(true); timer = window.setTimeout(finish, 2800); },
      });
    } catch {
      setFailed(true); setArrived(true); timer = window.setTimeout(finish, 2800);
    }
    return () => { window.clearTimeout(timer); scene?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = STEPS.length, current = arrived ? n - 1 : stage.index;
  return (
    <div className="tr" role="dialog" aria-label={`Nhập khẩu ${o.name} từ ${o.origin}`} data-stage={stage.index + 1} data-cleared={arrived ? '1' : '0'}>
      <style>{RIDE_CSS}</style>
      <div ref={host} className="tr-scene" />
      <RideHud icon={o.flag ?? '🚢'} from={o.origin} to="Xưởng của bạn" note={o.port}
        steps={STEPS} current={current} frac={frac} finished={arrived}
        status={arrived ? 'Máy nhập khẩu · đã thông quan' : `Máy nhập khẩu · bước ${stage.index + 1}/${n - 1}`} caption={failed ? '' : stage.caption}>
        {arrived && (
          <div className="tr-arrive" role="status">
            <section className="tr-card">
              <span className="stamp">Đã thông quan</span>
              <div className="big"><span aria-hidden="true">{o.flag ?? '⚙️'} </span>{o.name}</div>
              <p>đang trên đường về xưởng. Khi máy tới, mở bảng Xưởng để lắp vào dàn máy.</p>
            </section>
          </div>
        )}
        {failed && <p className="tr-fail">Thiết bị chưa bật đồ hoạ 3D nên không chiếu được đoạn phim nhập máy.</p>}
      </RideHud>
    </div>
  );
}
