// Bảng tham quan (bản đồ tỉnh + bắt taxi tới địa danh) và siêu thị đặc sản (mua hàng, ký gửi hàng).
import { useCallback, useEffect, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES } from '../../shared/catalog.ts';
import { QUALITY_NAMES, fmtMoney } from '../../shared/rules.ts';
import type { Quality, SightLeg } from '../../shared/rules.ts';
import type { Sight } from '../../shared/sights.ts';
import { api } from './api.ts';
import { ProvinceShops } from './properties.tsx';
import type { Me } from './api.ts';
import { ProvinceMap, hasProvinceMap } from './map/ProvinceMap.tsx';
import { WhyLimit } from './trade.tsx';
import { useAction } from './ui.ts';

/** `taxiFare` là tổng tiền đi lại (taxi + tàu nếu ra đảo); `route.legs` là từng chặng. */
export type SightRow = Sight & { km: number; taxiFare: number; route?: { legs: SightLeg[]; total: number; km?: number }; visits: number; done: boolean; stopsSeen: string[] };
export interface SightsData { province: string; regionId: string | null; here?: boolean; sights: SightRow[]; others: { province: string; count: number }[] }
export interface SightTrip { sight: SightRow; km: number; seconds: number; taxiFare: number; entryFee: number; /** Các chặng phải đi lần lượt: taxi, hoặc taxi ra cảng rồi tàu ra đảo. */ legs: SightLeg[] }

/** Một dòng tả một chặng: "🚕 Taxi ra cảng Sa Kỳ · 42 km · 120.000đ". */
export function legLabel(l: SightLeg): string {
  return l.mode === 'tau_thuy' ? `⛴️ ${l.boat ?? 'Tàu'} từ ${l.from} tới ${l.to}` : `🚕 Taxi tới ${l.to}`;
}

const ALL_REGIONS = Object.values(REGIONS);
/** Lọc danh sách địa danh khi một tỉnh có nhiều điểm. */
const SIGHT_FILTERS: { id: string; label: string; kinds?: Sight['kind'][] }[] = [
  { id: 'tat_ca', label: 'Tất cả' }, { id: 'chua_xem', label: 'Chưa xem hết' },
  { id: 'pho', label: '🏮 Phố, làng nghề', kinds: ['pho_co', 'lang_nghe'] }, { id: 'nui', label: '⛰️ Núi, đèo', kinds: ['nui', 'deo'] },
  { id: 'bien', label: '🏖️ Biển, đảo', kinds: ['bien', 'dao'] }, { id: 'di_tich', label: '🛕 Đền, chùa, cầu', kinds: ['den_thap', 'chua', 'cau'] },
];

/** Bản đồ tỉnh và danh sách địa danh; bấm "Bắt taxi" thì trừ tiền rồi báo cho App phát hoạt cảnh. */
export function SightsPanel({ me, refresh, onGo }: { me: Me; refresh: () => void; onGo: (trip: SightTrip) => void }) {
  const [data, setData] = useState<SightsData | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flt, setFlt] = useState('tat_ca');
  const act = useAction(refresh);
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    api<SightsData>('GET', `/api/sights${preview ? `?province=${encodeURIComponent(preview)}` : ''}`)
      .then((d) => { if (alive) { setData(d); setSel(null); setFlt('tat_ca'); } })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'Không tải được danh sách điểm tham quan.'); });
    return () => { alive = false; };
  }, [preview]);
  if (loadError) return <p className="error">{loadError}</p>;
  if (!data) return <p className="hint">Đang mở bản đồ…</p>;

  const here = data.here !== false && !preview;
  const gates = ALL_REGIONS.filter((r) => r.province === data.province).map((r) => r.name);
  const others = data.others.filter((o) => o.province !== data.province);
  const go = (s: SightRow) => act.run(async () => {
    const r = await api<{ ok: boolean; km: number; taxiFare: number; entryFee: number; seconds: number; legs?: SightLeg[] }>('POST', `/api/sights/${s.id}/visit`, {});
    const legs = r.legs?.length ? r.legs : s.route?.legs?.length ? s.route.legs : [{ mode: 'taxi' as const, from: '', to: s.name, km: r.km, fare: r.taxiFare, seconds: r.seconds }];
    onGo({ sight: s, km: r.km, seconds: r.seconds, taxiFare: r.taxiFare, entryFee: r.entryFee, legs });
  });

  return (
    <div className="sights">
      <p className="muted">
        {data.sights.length === 0
          ? `${data.province} chưa dựng điểm tham quan. Đội làm game đang dựng dần từng tỉnh theo địa danh thật.`
          : here
            ? `Bạn đang ở ${data.province}. Chọn một địa danh trên bản đồ, bắt taxi tới nơi (ra đảo thì taxi tới cảng rồi đi tàu) và đi bộ tham quan; lối ra của mỗi nơi dẫn sang siêu thị đặc sản.`
            : `Xem trước ${data.province}. Hãy tới ${gates.length ? gates.join(' hoặc ') : 'một vùng thuộc tỉnh này'} trước (mua vé hoặc lái xe tải ở thẻ Các vùng trồng), rồi mới bắt taxi đi tham quan được.`}
      </p>
      {data.sights.length > 0 && hasProvinceMap(data.province) && (
        <ProvinceMap province={data.province} sights={data.sights} regions={ALL_REGIONS} currentRegionId={here ? data.regionId : null} selectedId={sel}
          onSelect={(id) => { setSel(id); document.getElementById(`sight-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }} />
      )}
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {data.sights.length > 6 && (
        <div className="sight-filter" role="group" aria-label="Lọc địa danh">
          {SIGHT_FILTERS.filter((f) => !f.kinds || data.sights.some((x) => f.kinds!.includes(x.kind))).map((f) => <button type="button" key={f.id} aria-pressed={flt === f.id} onClick={() => setFlt(f.id)}>{f.label}</button>)}
        </div>
      )}
      <ol className="sight-list">
        {data.sights.map((s, i) => {
          const total = s.taxiFare + s.entryFee, f = SIGHT_FILTERS.find((x) => x.id === flt);
          // ghim đang chọn trên bản đồ luôn hiện, dù không khớp bộ lọc
          if (sel !== s.id && (flt === 'chua_xem' ? s.done : f?.kinds ? !f.kinds.includes(s.kind) : false)) return null;
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
              <img className="sight-art" src={`/art/sights/${s.id}-s.jpg`} alt={`Tranh minh hoạ ${s.name}`} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <p className="sight-blurb">{s.blurb}</p>
              {sel === s.id && (
                <ul className="sight-stops">
                  {s.stops.map((st, k) => <li key={st.id} className={s.stopsSeen.includes(st.id) ? 'seen' : ''}><span aria-hidden="true">{s.stopsSeen.includes(st.id) ? '✓' : k + 1}</span>{st.name}</li>)}
                </ul>
              )}
              <div className="sight-foot">
                <span className="sight-facts">
                  {(s.route?.legs?.length ? s.route.legs : [{ mode: 'taxi' as const, from: '', to: s.name, km: s.km, fare: s.taxiFare, seconds: 0 }]).map((l, k) => <span key={k}>{legLabel(l)} · {l.km} km · {fmtMoney(l.fare)}</span>)}
                  <span>🎟️ Vé cổng: {s.entryFee > 0 ? fmtMoney(s.entryFee) : 'vào cửa tự do'}</span>
                  {s.island && s.port?.note && sel === s.id && <small className="muted">{s.port.note}</small>}
                </span>
                {here
                  ? <button type="button" className="go" disabled={act.busy || me.user.cash < total} onClick={() => go(s)}>{s.route?.legs.some((l) => l.mode === 'tau_thuy') ? (s.route.legs.length > 1 ? '🚕⛴️ Đi ra đảo' : '⛴️ Đi tàu tới đây') : '🚕 Bắt taxi tới đây'}<small>{me.user.cash < total ? 'không đủ tiền' : `hết ${fmtMoney(total)}`}</small></button>
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

export interface Shelf { id: number | string; specialtyId: string; quality: Quality; kg: number; price: number; refPrice: number; seller: string; mine: boolean; npc: boolean; processed?: boolean; name?: string }
export interface Consignable { specialtyId: string; quality: Quality; kg: number; refPrice: number; minPrice: number; maxPrice: number; processed?: boolean; name?: string }
export interface SupermarketData { province: string; here: boolean; shelves: Shelf[]; mine: Shelf[]; consignable: Consignable[]; earned: number; feeRatio: number; boughtTodayKg?: number; dailyKg?: number; lots?: number; maxLots?: number; minKg?: number; maxLotKg?: number }

/** Tên hiện trên kệ: hàng chế biến có tên riêng do máy chủ gửi. */
const goodsName = (g: { specialtyId: string; name?: string }) => g.name ?? SPECIALTIES[g.specialtyId]?.name ?? g.specialtyId;
const goodsId = (g: { specialtyId: string; quality: Quality; processed?: boolean }) => (g.processed ? 'cb:' : '') + g.specialtyId + g.quality;
const gradeText = (g: { quality: Quality; processed?: boolean }) => (g.processed ? 'Chế biến' : QUALITY_NAMES[g.quality]);

const roundPrice = (v: number) => Math.round(v / 100) * 100;

function ShelfRow({ s, cash, here, busy, onBuy, maxKg }: { s: Shelf; cash: number; here: boolean; busy: boolean; onBuy: (kg: number) => void; maxKg: number }) {
  const sp = SPECIALTIES[s.specialtyId], out = maxKg < 1, top = Math.max(1, Math.min(s.kg, maxKg));
  const [kg, setKg] = useState(Math.min(top, 5));
  const n = Math.min(kg, top), step = top > 50 ? 10 : top > 10 ? 5 : 1, diff = Math.round((s.price / s.refPrice - 1) * 100);
  return (
    <div className="deal shelf">
      <span className="emoji" aria-hidden="true">{s.processed ? '📦' : sp ? CROPS[sp.crop].emoji : '📦'}</span>
      <div className="grow">
        <strong>{goodsName(s)}{s.processed && <span className="tag processed"> Chế biến</span>}</strong>
        <small>{s.processed ? 'Hàng xưởng' : QUALITY_NAMES[s.quality]} · {s.npc ? 'Hàng của siêu thị' : `${s.seller} ký gửi`}{sp ? ` · từ ${REGIONS[sp.regionId]?.name ?? ''}` : ''}</small>
        <small><b>{fmtMoney(s.price)}/kg</b> · <span className={diff > 0 ? 'up' : 'down'}>{diff === 0 ? 'bằng giá tham chiếu' : `${diff > 0 ? 'cao' : 'thấp'} hơn giá tham chiếu ${Math.abs(diff)}%`}</span> · còn {s.kg} kg</small>
      </div>
      {s.mine ? <small className="muted">Hàng của bạn</small> : (
        <div className="deal-buy">
          <div className="stepper">
            <button type="button" aria-label="Bớt" disabled={n <= 1} onClick={() => setKg(Math.max(1, n - step))}>−</button>
            <b>{n} kg</b>
            <button type="button" aria-label="Thêm" disabled={n >= top} onClick={() => setKg(Math.min(top, n + step))}>+</button>
          </div>
          <button type="button" className="go" disabled={busy || !here || out || cash < n * s.price} onClick={() => onBuy(n)}>{out ? 'Hết lượt hôm nay' : `Mua ${fmtMoney(n * s.price)}`}</button>
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

  const fee = data.feeRatio ?? 0.05, dailyKg = data.dailyKg ?? 30, leftKg = Math.max(0, dailyKg - (data.boughtTodayKg ?? 0));
  const minKg = data.minKg ?? 1, maxLotKg = data.maxLotKg ?? 300, lotsFull = data.maxLots !== undefined && (data.lots ?? data.mine.length) >= data.maxLots;
  const item = data.consignable.find((c) => goodsId(c) === pick) ?? null;
  const choose = (c: Consignable) => { setPick(goodsId(c)); setKg(Math.max(Math.min(c.kg, 50, maxLotKg), Math.min(minKg, c.kg))); setPrice(roundPrice((c.minPrice + c.maxPrice) / 2)); };
  const fresh = data.consignable.filter((c) => !c.processed), made = data.consignable.filter((c) => c.processed);
  const consignPick = (c: Consignable) => { const sp = SPECIALTIES[c.specialtyId], id = goodsId(c); return <button type="button" key={id} className={c.processed ? 'pick processed' : 'pick'} aria-pressed={pick === id} onClick={() => choose(c)}><span className="emoji" aria-hidden="true">{c.processed ? '📦' : sp ? CROPS[sp.crop].emoji : '📦'}</span><strong>{goodsName(c)}</strong><small>{gradeText(c)} · {c.kg} kg</small></button>; };
  const gross = item ? kg * price : 0;
  return (
    <div className="super">
      <p className="muted">Siêu thị đặc sản {data.province} (tỉnh nào cũng có): ngoài kệ của nhà bán, hàng trên kệ là do thương lái, nhà vườn và chủ xưởng chở tới ký gửi, cả nông sản tươi lẫn hàng chế biến. Bán hết thì kệ trống cho tới khi có người chở hàng mới.</p>
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
            : (
              <>
                <p className={leftKg > 0 ? 'super-left' : 'super-left out'} role="status">🛒 Hôm nay còn mua được <b>{leftKg} kg</b> ở siêu thị này (mỗi ngày {dailyKg} kg, lên cấp được mua nhiều hơn).</p>
                {data.shelves.map((s) => <ShelfRow key={`${s.id}-${leftKg}`} s={s} cash={me.user.cash} here={data.here} busy={act.busy} maxKg={leftKg} onBuy={(n) => act.run(() => api('POST', '/api/supermarket/buy', { shelfId: s.id, kg: n, province: data.province }))} />)}
              </>
            )}
          <WhyLimit k="super_buy" />
        </>
      )}

      {tab === 'kygui' && (
        <>
          <h3>1 · Chọn hàng trong kho</h3>
          {data.consignable.length === 0 && <p className="hint">Kho của bạn chưa có gì để ký gửi. Thu hoạch ở vườn, thu mua sỉ bằng xe tải hoặc chế biến ở xưởng rồi quay lại.</p>}
          {lotsFull && <p className="error">Bạn đã bày đủ {data.maxLots} lô ở đây. Rút bớt một lô hoặc chờ bán hết rồi bày tiếp.</p>}
          {fresh.length > 0 && <><h4>Nông sản tươi</h4><div className="pick-row wrap">{fresh.map(consignPick)}</div></>}
          {made.length > 0 && <><h4>Hàng chế biến</h4><div className="pick-row wrap">{made.map(consignPick)}</div></>}
          {item && (
            <div className="consign">
              <h3>2 · Bày bao nhiêu, giá nào</h3>
              <label className="slide"><span>Số lượng: <b>{kg} kg</b> <small>(kho có {item.kg} kg{item.kg < minKg ? `, mỗi lô cần ít nhất ${minKg} kg` : ''})</small></span>
                <input type="range" min={Math.min(minKg, item.kg)} max={Math.min(item.kg, maxLotKg)} step={1} value={kg} onChange={(e) => setKg(Number(e.target.value))} /></label>
              <label className="slide"><span>Giá bán: <b>{fmtMoney(price)}/kg</b> <small>(tham chiếu {fmtMoney(item.refPrice)})</small></span>
                <input type="range" min={item.minPrice} max={item.maxPrice} step={100} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                <span className="slide-ends"><small>{fmtMoney(item.minPrice)}</small><small>{fmtMoney(item.maxPrice)}</small></span></label>
              <dl className="consign-sum">
                <div><dt>Bán hết thu về</dt><dd>{fmtMoney(gross)}</dd></div>
                <div><dt>Phí sàn {Math.round(fee * 100)}%</dt><dd>−{fmtMoney(Math.round(gross * fee))}</dd></div>
                <div className="net"><dt>Bạn thực nhận</dt><dd>{fmtMoney(gross - Math.round(gross * fee))}</dd></div>
              </dl>
              <button type="button" className="go wide" disabled={act.busy || !data.here || kg < minKg || lotsFull}
                onClick={() => act.run(async () => { await api('POST', '/api/supermarket/consign', { specialtyId: item.specialtyId, grade: item.quality, kg, price, province: data.province, ...(item.processed ? { processed: true } : {}) }); setPick(null); })}>
                Bày {kg} kg lên kệ<small>tiền về khi có người mua</small>
              </button>
            </div>
          )}
          <WhyLimit k="super_consign" />
          <WhyLimit k="super_price" />
          <h3>Lô đang bày của bạn{data.maxLots ? ` (${data.mine.length}/${data.maxLots})` : ''}</h3>
          {data.mine.length === 0 ? <p className="hint">Bạn chưa bày lô nào ở đây.</p> : data.mine.map((s) => {
            const sp = SPECIALTIES[s.specialtyId];
            return (
              <div className="deal" key={s.id}>
                <span className="emoji" aria-hidden="true">{s.processed ? '📦' : sp ? CROPS[sp.crop].emoji : '📦'}</span>
                <div className="grow"><strong>{goodsName(s)}</strong><small>{gradeText(s)} · còn {s.kg} kg · {fmtMoney(s.price)}/kg</small></div>
                <button type="button" disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/supermarket/withdraw', { shelfId: s.id }))}>Rút về kho</button>
              </div>
            );
          })}
        </>
      )}
      <ProvinceShops province={data.province} refresh={refresh} />
    </div>
  );
}
