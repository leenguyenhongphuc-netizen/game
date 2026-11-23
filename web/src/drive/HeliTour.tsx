// Hoạt cảnh bay trực thăng tham quan cánh đồng (sau POST /api/farm/heli/tour). Hai góc nhìn: cabin và bên ngoài; có nút kết thúc.
// App nối: const [tour, setTour] = useState<HeliTourData | null>(null); … {tour && <HeliTour tour={tour} onDone={() => setTour(null)} />}
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { HeliTourScene } from './HeliTourScene.ts';
import type { HeliView } from './HeliTourScene.ts';
import type { FieldLite } from '../scene/fields.ts';
import { RIDE_CSS, RideHud } from './RideHud.tsx';
import type { RideStep } from './RideHud.tsx';

export interface HeliTourInput { fee: number; own: boolean; fields: (FieldLite & { regionName: string; name: string | null; emoji: string | null; stepName: string | null })[] }

const STEPS: RideStep[] = [{ icon: '🛫', label: 'Cất cánh' }, { icon: '🌾', label: 'Bay vòng ruộng' }, { icon: '🛬', label: 'Hạ cánh' }];
const HELI_CSS = `.tr .heli-views{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:calc(max(12px,env(safe-area-inset-bottom)) + 76px);display:flex;gap:6px;z-index:5}
.tr .heli-views button{min-height:44px;padding:4px 12px;border-radius:12px;border:2px solid #fff;background:rgba(20,40,60,.55);color:#fff;font-weight:700}
.tr .heli-views button[aria-pressed='true']{background:#ffd23f;color:#3a2a00;border-color:#c99a00}
.tr .heli-list{margin:6px 0 0;padding:0;list-style:none;display:grid;gap:3px;font-size:.85rem;text-align:left}`;

export function HeliTour({ tour, onDone }: { tour: HeliTourInput; onDone: () => void }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<HeliTourScene | null>(null);
  const [frac, setFrac] = useState(0);
  const [view, setView] = useState<HeliView>('ngoai');
  const [landed, setLanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef(onDone); cb.current = onDone;

  useEffect(() => {
    try {
      scene.current = new HeliTourScene(host.current!, { fields: tour.fields, onStep: setFrac, onDone: () => setLanded(true) });
    } catch { setFailed(true); setLanded(true); }
    (window as unknown as { __heli?: HeliTourScene | null }).__heli = scene.current;
    return () => { scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { scene.current?.setView(view); }, [view]);

  const tiles = tour.fields.reduce((s, f) => s + f.blocks * 100, 0);
  const current = landed ? 2 : frac < 0.12 ? 0 : frac < 0.9 ? 1 : 2;
  const seg = current === 0 ? frac / 0.12 : current === 1 ? (frac - 0.12) / 0.78 : (frac - 0.9) / 0.1;
  const caption = current === 0 ? 'Trực thăng cất cánh từ mép ruộng' : current === 1 ? `Bay vòng trên ${tiles.toLocaleString('vi-VN')} ô ruộng của bạn` : 'Hạ cánh về sân nhà';
  return (
    <div className="tr" role="dialog" aria-label="Bay trực thăng tham quan ruộng" data-cleared={landed ? '1' : '0'} data-view={view}>
      <style>{RIDE_CSS + HELI_CSS}</style>
      <div ref={host} className="tr-scene" />
      <div className="heli-views" role="group" aria-label="Góc nhìn">
        <button aria-pressed={view === 'cabin'} onClick={() => setView('cabin')}>🪟 Cabin</button>
        <button aria-pressed={view === 'ngoai'} onClick={() => setView('ngoai')}>🚁 Bên ngoài</button>
        <button onClick={() => cb.current()}>✕ Kết thúc</button>
      </div>
      <RideHud icon="🚁" from="Sân nhà" to="Cánh đồng" note={tour.own ? 'Trực thăng riêng' : `Thuê chuyến bay · ${tour.fee.toLocaleString('vi-VN')} đ`}
        steps={STEPS} current={current} frac={Math.max(0, Math.min(1, seg))} finished={landed}
        status={landed ? 'Đã hạ cánh' : 'Đang bay tham quan'} caption={failed ? '' : caption}>
        {landed && (
          <div className="tr-arrive" role="status">
            <section className="tr-card">
              <span className="stamp">Đã hạ cánh</span>
              <div className="big">🌾 {tiles.toLocaleString('vi-VN')} ô ruộng</div>
              <ul className="heli-list">
                {tour.fields.map((f) => <li key={f.id}>{f.emoji ?? '🟫'} {f.name ?? 'Ruộng trống'} · {f.blocks} khối · {f.regionName}{f.stepName ? ` · ${f.stepName}` : ''}</li>)}
              </ul>
              <button className="wide" onClick={() => cb.current()}>Về vườn</button>
            </section>
          </div>
        )}
        {failed && <p className="tr-fail">Thiết bị chưa bật đồ hoạ 3D nên không chiếu được chuyến bay.</p>}
      </RideHud>
    </div>
  );
}
