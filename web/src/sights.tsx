// Bảng tham quan (bản đồ tỉnh + bắt taxi tới địa danh) và siêu thị đặc sản (mua hàng, ký gửi hàng).
import { useCallback, useEffect, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import { QUALITY_NAMES, fmtMoney } from '../../shared/rules.ts';
import type { Quality } from '../../shared/rules.ts';
import type { Sight } from '../../shared/sights.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { ProvinceMap, hasProvinceMap } from './map/ProvinceMap.tsx';
import { WhyLimit } from './trade.tsx';
import { useAction } from './ui.ts';

export type SightRow = Sight & { km: number; taxiFare: number; visits: number; done: boolean; stopsSeen: string[] };
export interface SightsData { province: string; regionId: string | null; here?: boolean; sights: SightRow[]; others: { province: string; count: number }[] }
export interface SightTrip { sight: SightRow; km: number; seconds: number; taxiFare: number; entryFee: number }

const ALL_REGIONS = Object.values(REGIONS);

/** Bản đồ tỉnh và danh sách địa danh; bấm "Bắt taxi" thì trừ tiền rồi báo cho App phát hoạt cảnh. */
export function SightsPanel({ me, refresh, onGo }: { me: Me; refresh: () => void; onGo: (trip: SightTrip) => void }) {
  const [data, setData] = useState<SightsData | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const act = useAction(refresh);
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    api<SightsData>('GET', `/api/sights${preview ? `?province=${encodeURIComponent(preview)}` : ''}`)
      .then((d) => { if (alive) { setData(d); setSel(null); } })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Không tải được danh sách điểm tham quan.'); });
    return () => { alive = false; };
  }, [preview]);
  if (loadError) return <p className="error">{loadError}</p>;
  if (!data) return <p className="hint">Đang mở bản đồ…</p>;

  const here = data.here !== false && !preview;
  const gates = ALL_REGIONS.filter((r) => r.province === data.province).map((r) => r.name);
  const others = data.others.filter((o) => o.province !== data.province);
  const go = (s: SightRow) => act.run(async () => {
    const r = await api<{ ok: boolean; km: number; taxiFare: number; entryFee: number; seconds: number }>('POST', `/api/sights/${s.id}/visit`, { mode: 'taxi' });
    onGo({ sight: s, km: r.km, seconds: r.seconds, taxiFare: r.taxiFare, entryFee: r.entryFee });
  });

  return (
    <div className="sights">
      <p className="muted">
        {data.sights.length === 0
          ? `${data.province} chưa dựng điểm tham quan. Đội làm game đang dựng dần từng tỉnh theo địa danh thật.`
          : here
            ? `Bạn đang ở ${data.province}. Chọn một địa danh trên bản đồ, bắt taxi tới nơi rồi đi bộ tham quan; lối ra của mỗi nơi dẫn sang siêu thị đặc sản.`
            : `Xem trước ${data.province}. Hãy tới ${gates.length ? gates.join(' hoặc ') : 'một vùng thuộc tỉnh này'} trước (mua vé hoặc lái xe tải ở thẻ Các vùng trồng), rồi mới bắt taxi đi tham quan được.`}
      </p>
      {data.sights.length > 0 && hasProvinceMap(data.province) && (
        <ProvinceMap province={data.province} sights={data.sights} regions={ALL_REGIONS} currentRegionId={here ? data.regionId : null} selectedId={sel}
          onSelect={(id) => { setSel(id); document.getElementById(`sight-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }} />
      )}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      <ol className="sight-list">
        {data.sights.map((s, i) => {
          const total = s.taxiFare + s.entryFee;
          return (
            <li key={s.id} id={`sight-${s.id}`} className={`sight${sel === s.id ? ' on' : ''}${s.done ? ' done' : ''}`}>
              <button type="button" className="sight-head" aria-expanded={sel === s.id} onClick={() => setSel(sel === s.id ? null : s.id)}>
                <span className="sight-num" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
                <span className="emoji" aria-hidden="true">{s.emoji}</span>
                <span className="grow">
                  <strong>{s.name}</strong>
                  <small>{s.formerProvince ? `${s.formerProvince} cũ · ` : ''}{s.stopsSeen.length}/{s.stops.length} điểm dừng đã xem{s.visits > 0 ? ` · đã tới ${s.visits} lần` : ''}</small>
                </span>
              </button>
              <p className="sight-blurb">{s.blurb}</p>
              {sel === s.id && (
                <ul className="sight-stops">
                  {s.stops.map((st, k) => <li key={st.id} className={s.stopsSeen.includes(st.id) ? 'seen' : ''}><span aria-hidden="true">{s.stopsSeen.includes(st.id) ? '✓' : k + 1}</span>{st.name}</li>)}
                </ul>
              )}
              <div className="sight-foot">
                <span className="sight-facts"><span>🚕 {s.km} km · {fmtMoney(s.taxiFare)}</span><span>🎟️ {s.entryFee > 0 ? fmtMoney(s.entryFee) : 'vào cửa tự do'}</span></span>
                {here
                  ? <button type="button" className="go" disabled={act.busy || me.user.cash < total} onClick={() => go(s)}>🚕 Bắt taxi tới đây<small>{me.user.cash < total ? 'không đủ tiền' : `hết ${fmtMoney(total)}`}</small></button>
                  : <small className="muted">Tới {data.province} mới đi được</small>}
              </div>
            </li>
          );
        })}
      </ol>
      {(others.length > 0 || preview) && (
        <div className="sight-others">
          <h3>Tỉnh, thành đã dựng điểm tham quan</h3>
          <div className="pick-row wrap">
            {preview && <button type="button" className="pick" onClick={() => setPreview(null)}><strong>Về nơi tôi đang ở</strong></button>}
            {others.map((o) => <button type="button" key={o.province} className="pick" onClick={() => setPreview(o.province)}><strong>{o.province}</strong><small>{o.count} địa danh</small></button>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- siêu thị đặc sản

export interface Shelf { id: number; specialtyId: string; quality: Quality; kg: number; price: number; refPrice: number; seller: string; mine: boolean; npc: boolean }
export interface Consignable { specialtyId: string; quality: Quality; kg: number; refPrice: number; minPrice: number; maxPrice: number }
export interface SupermarketData { province: string; here: boolean; shelves: Shelf[]; mine: Shelf[]; consignable: Consignable[]; earned: number; feeRatio: number; limits?: Record<string, number> }

const roundPrice = (v: number) => Math.round(v / 100) * 100;

function ShelfRow({ s, cash, here, busy, onBuy, maxKg }: { s: Shelf; cash: number; here: boolean; busy: boolean; onBuy: (kg: number) => void; maxKg: number }) {
  const sp = SPECIALTIES[s.specialtyId], top = Math.max(1, Math.min(s.kg, maxKg));
  const [kg, setKg] = useState(Math.min(top, 5));
  const n = Math.min(kg, top), step = top > 50 ? 10 : top > 10 ? 5 : 1, diff = Math.round((s.price / s.refPrice - 1) * 100);
  return (
    <div className="deal shelf">
      <span className="emoji" aria-hidden="true">{sp ? CROPS[sp.crop].emoji : '📦'}</span>
      <div className="grow">
        <strong>{sp?.name ?? s.specialtyId}</strong>
        <small>{QUALITY_NAMES[s.quality]} · {s.npc ? 'Hàng của siêu thị' : `${s.seller} ký gửi`}{sp ? ` · từ ${REGIONS[sp.regionId]?.name ?? ''}` : ''}</small>
        <small><b>{fmtMoney(s.price)}/kg</b> · <span className={diff > 0 ? 'up' : 'down'}>{diff === 0 ? 'bằng giá tham chiếu' : `${diff > 0 ? 'cao' : 'thấp'} hơn giá tham chiếu ${Math.abs(diff)}%`}</span> · còn {s.kg} kg</small>
      </div>
      {s.mine ? <small className="muted">Hàng của bạn</small> : (
        <div className="deal-buy">
          <div className="stepper">
            <button type="button" aria-label="Bớt" disabled={n <= 1} onClick={() => setKg(Math.max(1, n - step))}>−</button>
            <b>{n} kg</b>
            <button type="button" aria-label="Thêm" disabled={n >= top} onClick={() => setKg(Math.min(top, n + step))}>+</button>
          </div>
          <button type="button" className="go" disabled={busy || !here || cash < n * s.price} onClick={() => onBuy(n)}>Mua {fmtMoney(n * s.price)}</button>
        </div>
      )}
    </div>
  );
}

/** Siêu thị đặc sản của một tỉnh: kệ hàng do người chơi ký gửi, và chỗ ký gửi hàng của mình. */
export function SupermarketPanel({ me, province, refresh }: { me: Me; province: string; refresh: () => void }) {
  const [data, setData] = useState<SupermarketData | null>(null);
  const [tab, setTab] = useState<'mua' | 'kygui'>('mua');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [kg, setKg] = useState(0);
  const [price, setPrice] = useState(0);
  const load = useCallback(() => api<SupermarketData>('GET', `/api/supermarket?province=${encodeURIComponent(province)}`).then(setData).catch((e) => setLoadError(e instanceof Error ? e.message : 'Không mở được siêu thị.')), [province]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(useCallback(() => { void load(); refresh(); }, [load, refresh]));
  if (loadError) return <p className="error">{loadError}</p>;
  if (!data) return <p className="hint">Đang mở cửa siêu thị…</p>;

  const fee = data.feeRatio ?? 0.05, maxBuy = data.limits?.buyKg ?? 20;
  const item = data.consignable.find((c) => c.specialtyId + c.quality === pick) ?? null;
  const choose = (c: Consignable) => { setPick(c.specialtyId + c.quality); setKg(Math.min(c.kg, 50)); setPrice(roundPrice((c.minPrice + c.maxPrice) / 2)); };
  const gross = item ? kg * price : 0;
  return (
    <div className="super">
      <p className="muted">Siêu thị đặc sản {data.province}: hàng trên kệ là do thương lái và nhà vườn chở tới ký gửi. Bán hết thì kệ trống cho tới khi có người chở hàng mới.</p>
      {!data.here && <p className="error">Bạn không ở {data.province} nên chỉ xem được kệ, chưa mua hay ký gửi được.</p>}
      {data.earned > 0 && <p className="super-earned" role="status">💰 Hàng ký gửi của bạn vừa bán được, bạn nhận {fmtMoney(data.earned)}.</p>}
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'mua'} onClick={() => setTab('mua')}>Mua hàng</button>
        <button type="button" role="tab" aria-selected={tab === 'kygui'} onClick={() => setTab('kygui')}>Ký gửi hàng của bạn</button>
      </div>
      {act.error && <p className="error" role="alert">{act.error}</p>}

      {tab === 'mua' && (
        <>
          {data.shelves.length === 0
            ? <div className="shelf-empty"><span aria-hidden="true">🧺</span><p>Kệ đang trống — chưa thương lái nào chở hàng tới.</p><small>Nếu bạn có hàng trong kho, hãy sang thẻ "Ký gửi hàng của bạn" để là người bày hàng đầu tiên.</small></div>
            : data.shelves.map((s) => <ShelfRow key={s.id} s={s} cash={me.user.cash} here={data.here} busy={act.busy} maxKg={maxBuy} onBuy={(n) => act.run(() => api('POST', '/api/supermarket/buy', { shelfId: s.id, kg: n }))} />)}
          <WhyLimit k="super_buy" />
        </>
      )}

      {tab === 'kygui' && (
        <>
          <h3>1 · Chọn hàng trong kho</h3>
          {data.consignable.length === 0
            ? <p className="hint">Kho của bạn chưa có nông sản nào để ký gửi. Thu hoạch ở vườn hoặc thu mua sỉ bằng xe tải rồi quay lại.</p>
            : (
              <div className="pick-row wrap">
                {data.consignable.map((c) => {
                  const sp = SPECIALTIES[c.specialtyId], id = c.specialtyId + c.quality;
                  return <button type="button" key={id} className="pick" aria-pressed={pick === id} onClick={() => choose(c)}><span className="emoji" aria-hidden="true">{sp ? CROPS[sp.crop].emoji : '📦'}</span><strong>{sp?.name ?? c.specialtyId}</strong><small>{QUALITY_NAMES[c.quality]} · {c.kg} kg</small></button>;
                })}
              </div>
            )}
          {item && (
            <div className="consign">
              <h3>2 · Bày bao nhiêu, giá nào</h3>
              <label className="slide"><span>Số lượng: <b>{kg} kg</b> <small>(kho có {item.kg} kg)</small></span>
                <input type="range" min={1} max={item.kg} step={1} value={kg} onChange={(e) => setKg(Number(e.target.value))} /></label>
              <label className="slide"><span>Giá bán: <b>{fmtMoney(price)}/kg</b> <small>(tham chiếu {fmtMoney(item.refPrice)})</small></span>
                <input type="range" min={item.minPrice} max={item.maxPrice} step={100} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                <span className="slide-ends"><small>{fmtMoney(item.minPrice)}</small><small>{fmtMoney(item.maxPrice)}</small></span></label>
              <dl className="consign-sum">
                <div><dt>Bán hết thu về</dt><dd>{fmtMoney(gross)}</dd></div>
                <div><dt>Phí sàn {Math.round(fee * 100)}%</dt><dd>−{fmtMoney(Math.round(gross * fee))}</dd></div>
                <div className="net"><dt>Bạn thực nhận</dt><dd>{fmtMoney(gross - Math.round(gross * fee))}</dd></div>
              </dl>
              <button type="button" className="go wide" disabled={act.busy || !data.here || kg < 1}
                onClick={() => act.run(async () => { await api('POST', '/api/supermarket/consign', { specialtyId: item.specialtyId, grade: item.quality, kg, price }); setPick(null); })}>
                Bày {kg} kg lên kệ<small>tiền về khi có người mua</small>
              </button>
            </div>
          )}
          <WhyLimit k="super_consign" />
          <WhyLimit k="super_price" />
          <h3>Lô đang bày của bạn</h3>
          {data.mine.length === 0 ? <p className="hint">Bạn chưa bày lô nào ở đây.</p> : data.mine.map((s) => {
            const sp = SPECIALTIES[s.specialtyId];
            return (
              <div className="deal" key={s.id}>
                <span className="emoji" aria-hidden="true">{sp ? CROPS[sp.crop].emoji : '📦'}</span>
                <div className="grow"><strong>{sp?.name ?? s.specialtyId}</strong><small>{QUALITY_NAMES[s.quality]} · còn {s.kg} kg · {fmtMoney(s.price)}/kg</small></div>
                <button type="button" disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/supermarket/withdraw', { shelfId: s.id }))}>Rút về kho</button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
