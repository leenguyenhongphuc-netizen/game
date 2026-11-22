// Nâng cấp đất của một thửa: cải tạo đất, tưới nhỏ giọt, nhà màng, cảm biến — mỗi hạng mục 5 cấp.
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import './progress.css';

type Kind = 'cai_tao' | 'tuoi' | 'nha_mang' | 'cam_bien';
interface Row { kind: Kind; name: string; emoji: string; note: string; effect: string; basePrice: number; level: number; maxLevel: number; nextCost: number | null; needLevel: number | null; canUpgrade: boolean }
interface Data { plotId: number; factory: boolean; level: number; cash: number; upgrades: Row[] }

const O = '#56310f', S = { stroke: O, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
/** Hình minh hoạ tự vẽ cho từng hạng mục. */
const ART: Record<Kind, JSX.Element> = {
  cai_tao: (
    <>
      <path d="M4 44h64v24H4z" fill="#8a5a2b" {...S} /><path d="M4 44q8-6 16 0t16 0 16 0 16 0" fill="#a8703a" {...S} />
      <path d="M14 56q5-4 9 0t9 0" fill="none" stroke="#f3b6a0" strokeWidth="3.4" strokeLinecap="round" /><circle cx="33" cy="56" r="1.4" fill={O} />
      <path d="M36 44V26" {...S} strokeWidth={2.6} /><path d="M36 32c-9 0-12-5-12-11 8 0 12 4 12 11zM36 28c0-7 4-11 12-11 0 8-4 11-12 11z" fill="#7ccf4f" {...S} />
      <path d="M50 10h12l2 8H48z" fill="#f4efe2" {...S} /><path d="M52 22l-2 6M57 22v7M62 22l2 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </>),
  tuoi: (
    <>
      <path d="M4 50h64v18H4z" fill="#8a5a2b" {...S} /><path d="M2 40h68" stroke="#2c2c2c" strokeWidth="5" strokeLinecap="round" />
      {[14, 36, 58].map((x) => <g key={x}><path d={`M${x} 40v6`} stroke="#2c2c2c" strokeWidth="3" /><path d={`M${x} 49q-3 4 0 6 3-2 0-6z`} fill="#4aa3d8" stroke="#2f6fa0" strokeWidth="1.2" /><path d={`M${x} 50V30`} {...S} /><path d={`M${x} 34c-6 0-8-3-8-8 6 0 8 3 8 8zM${x} 31c0-5 3-8 8-8 0 6-3 8-8 8z`} fill="#7ccf4f" {...S} strokeWidth={1.6} /></g>)}
      <circle cx="58" cy="12" r="7" fill="#fff" {...S} /><path d="M58 8v4l3 2" fill="none" {...S} strokeWidth={1.8} />
    </>),
  nha_mang: (
    <>
      <path d="M4 56h64v12H4z" fill="#8a5a2b" {...S} /><path d="M8 56V30q28-26 56 0v26" fill="#dff3ff" fillOpacity="0.85" {...S} />
      <path d="M22 56V20M36 56V14M50 56V20M8 38h56" stroke="#8fb7cc" strokeWidth="1.8" /><path d="M16 56c0-6 3-9 7-9M30 56c0-8 3-12 7-12M46 56c0-6 3-9 7-9" fill="none" stroke="#4caf3f" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 10l4 6M16 6l3 7M60 6l-3 7" stroke="#4aa3d8" strokeWidth="2.2" strokeLinecap="round" />
    </>),
  cam_bien: (
    <>
      <path d="M4 54h64v14H4z" fill="#8a5a2b" {...S} /><path d="M34 54V24" {...S} strokeWidth={3} /><rect x="24" y="12" width="20" height="14" rx="3" fill="#f4efe2" {...S} />
      <circle cx="30" cy="19" r="2.4" fill="#4caf3f" /><path d="M35 17h6M35 21h4" stroke={O} strokeWidth="1.6" strokeLinecap="round" /><path d="M34 54v8" stroke="#b9c4cc" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 10q6 6 0 12M55 6q10 10 0 20M18 10q-6 6 0 12M13 6q-10 10 0 20" fill="none" stroke="#4aa3d8" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M52 54c0-7 3-10 8-10M10 54c0-6 3-9 7-9" fill="none" stroke="#4caf3f" strokeWidth="3" strokeLinecap="round" />
    </>),
};
/** Tác dụng cộng dồn ở một cấp, viết cho người đọc. */
const FX: Record<Kind, (lv: number) => string> = {
  cai_tao: (lv) => `+${lv * 5}% sản lượng mỗi ô`,
  tuoi: (lv) => `chờ mỗi bước ngắn hơn ${lv * 5}%`,
  nha_mang: (lv) => `bớt ${lv * 15}% mức chậm do thời tiết xấu`,
  cam_bien: (lv) => `nới ${lv * 20}% hạn chăm trước khi bị tính trễ`,
};

/** Bảng nâng cấp đất. `onChanged` gọi sau mỗi lần nâng cấp để App tải lại tiền và vườn. */
export function LandUpgrades({ plotId, me, onChanged }: { plotId: number; me: Me; onChanged: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [just, setJust] = useState<string | null>(null);
  const load = useCallback(() => api<Data>('GET', `/api/plots/${plotId}/upgrades`).then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e instanceof Error ? e.message : 'Không tải được.')), [plotId]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });

  if (loadError) return <p className="error" role="alert">{loadError}</p>;
  if (!data) return <p className="hint">Đang xem thửa đất…</p>;
  if (data.factory || data.upgrades.length === 0) return <div className="land-up"><p className="hint">Thửa này là nhà xưởng nên không có nâng cấp đất. Chủ xưởng nâng cấp máy trong bảng Xưởng.</p></div>;
  const cash = Math.max(data.cash, me.user.cash);
  return (
    <div className="land-up" data-plot={plotId}>
      <p className="muted">Nâng cấp tính cho cả thửa và giữ mãi. Mỗi hạng mục có 5 cấp, cấp càng cao càng cần cấp nhân vật cao hơn.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {just && <p className="notice" role="status">{just}</p>}
      {data.upgrades.map((u) => {
        const max = u.level >= u.maxLevel, lack = u.nextCost !== null && cash < u.nextCost, lowLv = u.needLevel !== null && data.level < u.needLevel;
        return (
          <section className="lu-card" key={u.kind} data-kind={u.kind} data-level={u.level}>
            <svg viewBox="0 0 72 72" aria-hidden="true">{ART[u.kind]}</svg>
            <div>
              <strong>{u.name}</strong>
              <div className="lu-dots" role="img" aria-label={`Cấp ${u.level} trên ${u.maxLevel}`}>{Array.from({ length: u.maxLevel }, (_, i) => <i key={i} className={i < u.level ? 'on' : ''} />)}</div>
              <p>{u.note}</p>
            </div>
            <div className="lu-fx">
              <div className="now-next">
                {u.level > 0 ? <>Đang có: <b>{FX[u.kind](u.level)}</b></> : <>Chưa nâng cấp</>}
                {!max && <><br />Lên cấp {u.level + 1}: <b>{FX[u.kind](u.level + 1)}</b></>}
                {max && <><br /><span className="lu-max">Đã đạt cấp cao nhất</span></>}
                {!max && lowLv && <><br /><small className="error">Cần nhân vật cấp {u.needLevel} (bạn đang cấp {data.level}).</small></>}
              </div>
              {!max && (
                <button type="button" className="go" disabled={act.busy || !u.canUpgrade || lack || lowLv}
                  onClick={() => act.run(async () => { const r = await api<{ level: number; cost: number }>('POST', `/api/plots/${plotId}/upgrade`, { kind: u.kind }); setJust(`${u.name} đã lên cấp ${r.level}: ${FX[u.kind](r.level)}.`); })}>
                  Nâng cấp<small>{lack ? 'chưa đủ tiền' : fmtMoney(u.nextCost ?? 0)}</small>
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
