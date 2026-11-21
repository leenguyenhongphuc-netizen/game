import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES, ZONE_NAMES, processOf, specialtiesOfRegion } from '../../shared/catalog.ts';
import type { Zone } from '../../shared/catalog.ts';
import {
  LAND_PRICE, PLOT_COLS, PLOT_ROWS, QUALITY_NAMES, TILE_M2, fmtMoney, npcPrice, seedCost, stepWaitMs,
} from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Listing, Me, PlotView, Prices } from './api.ts';
import { Scene3D } from './Scene3D.tsx';
import type { FarmScene, SceneState } from './scene/FarmScene.ts';

const ZONES = Object.keys(ZONE_NAMES) as Zone[];
/** Vườn mẫu làm nền cho màn đăng nhập. */
const SHOWCASE: SceneState = {
  regionId: 'dt_caibe', selected: null, clockOffset: 0, stall: [
    { id: 1, specialtyId: 'xoai_hoa_loc', quality: 'A', kg: 1, price: 1 }, { id: 2, specialtyId: 'thanh_long_cho_gao', quality: 'A', kg: 1, price: 1 },
    { id: 3, specialtyId: 'khom_tan_phuoc', quality: 'A', kg: 1, price: 1 },
  ],
  plantings: ([
    ['xoai_hoa_loc', 7], ['xoai_hoa_loc', 7], ['xoai_hoa_loc', 5], ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 4],
    ['sau_rieng_ngu_hiep', 7], ['sau_rieng_ngu_hiep', 5], null, ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 2], null,
    ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 3], ['vu_sua_lo_ren', 7], ['vu_sua_lo_ren', 4], ['vu_sua_lo_ren', 2],
    ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 1], null, ['xoai_hoa_loc', 3], null, ['vu_sua_lo_ren', 7],
  ] as ([string, number] | null)[]).flatMap((p, tile) => p ? [{ id: tile + 1, tile, specialtyId: p[0], stepIndex: p[1], stepReadyAt: Number.MAX_SAFE_INTEGER, lateCount: 0 }] : []),
};
const regionLabel = (id: string) => {
  const r = REGIONS[id];
  return `${r.name}, ${r.province}`;
};
function fmtDuration(ms: number): string {
  if (ms <= 0) return 'ngay bây giờ';
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút`;
  return `${s} giây`;
}

function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); onDone?.(); } catch (e) { setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); } finally { setBusy(false); }
  }, [onDone]);
  return { busy, error, run, setError };
}

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    try { setMe(await api<Me>('GET', '/api/me')); } catch { setMe(null); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (me === undefined) return <div className="center">Đang tải…</div>;
  if (me && me.user.homeRegionId) return <Game me={me} refresh={refresh} />;
  return (
    <div className="game">
      <Scene3D state={SHOWCASE} autoRotate />
      <div className="veil" />
      {me === null ? <Auth onDone={refresh} /> : <Onboard me={me} onDone={refresh} />}
    </div>
  );
}

// ------------------------------------------------------------------ đăng nhập
function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const act = useAction(onDone);
  return (
    <main className="auth">
      <div className="brand">
        <span className="brand-mark">🌱</span>
        <h1>Vườn Việt</h1>
        <p>Nhận một mảnh vườn ngay nơi bạn sống. Trồng đặc sản của vùng theo đúng quy trình, rồi giao thương với cả nước.</p>
      </div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); void act.run(() => api('POST', `/api/auth/${mode}`, { username, password, displayName })); }}>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>Tạo tài khoản</button>
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>Đăng nhập</button>
        </div>
        <label>Tên tài khoản
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" autoCapitalize="none" maxLength={20} required />
          {mode === 'register' && <small>3–20 ký tự: chữ thường, số, dấu _</small>}
        </label>
        {mode === 'register' && (
          <label>Tên hiển thị
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} placeholder="Ví dụ: Vườn chú Tư" />
          </label>
        )}
        <label>Mật khẩu
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 1} maxLength={72} required />
          {mode === 'register' && <small>Tối thiểu 8 ký tự. Chưa có chức năng lấy lại mật khẩu, hãy ghi nhớ.</small>}
        </label>
        {act.error && <p className="error" role="alert">{act.error}</p>}
        <button className="primary" disabled={act.busy}>{mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
      </form>
    </main>
  );
}

// ------------------------------------------------------------------ nhận đất
function Onboard({ me, onDone }: { me: Me; onDone: () => void }) {
  const [found, setFound] = useState<{ lat: number; lng: number; regionId: string; km: number } | null>(null);
  const [manual, setManual] = useState('');
  const act = useAction();
  const claim = useAction(onDone);

  const locate = () => act.run(() => new Promise<void>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Trình duyệt không hỗ trợ định vị. Hãy tự chọn vùng trồng bên dưới.'));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        const r = await api('GET', `/api/geo/nearest?lat=${lat}&lng=${lng}`);
        setFound({ lat, lng, regionId: r.regionId, km: r.km });
        resolve();
      } catch (e) { reject(e); }
    }, () => reject(new Error('Không lấy được vị trí. Hãy cho phép định vị hoặc tự chọn vùng trồng bên dưới.')), { timeout: 15000, maximumAge: 600000 });
  }));

  const chosen = found?.regionId ?? (manual || null);
  return (
    <main className="auth">
      <div className="brand">
        <span className="brand-mark">📍</span>
        <h1>Chào {me.user.displayName}</h1>
        <p>Mảnh vườn đầu tiên rộng {PLOT_COLS * PLOT_ROWS * TILE_M2} m², nằm ở vùng trồng gần nơi bạn sống. Vùng nào thì trồng đặc sản của vùng đó.</p>
      </div>
      <div className="card">
        <button className="primary" onClick={locate} disabled={act.busy}>{act.busy ? 'Đang định vị…' : 'Dùng vị trí của tôi'}</button>
        <small>Vị trí được làm tròn về ô lưới khoảng 2 km trước khi lưu. Người chơi khác chỉ thấy tên vùng trồng.</small>
        {act.error && <p className="error" role="alert">{act.error}</p>}
        <label>Hoặc tự chọn vùng trồng
          <select value={manual} onChange={(e) => { setManual(e.target.value); setFound(null); }}>
            <option value="">— Chọn vùng —</option>
            {ZONES.map((z) => (
              <optgroup key={z} label={ZONE_NAMES[z]}>
                {Object.values(REGIONS).filter((r) => r.zone === z).map((r) => <option key={r.id} value={r.id}>{regionLabel(r.id)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {chosen && (
          <div className="notice">
            <strong>{regionLabel(chosen)}</strong>
            {found && <span> · cách bạn khoảng {found.km} km</span>}
            <p>Đặc sản trồng được: {specialtiesOfRegion(chosen).map((s) => s.name).join(', ')}.</p>
            <button className="primary" disabled={claim.busy}
              onClick={() => claim.run(() => api('POST', '/api/onboard', found ? { lat: found.lat, lng: found.lng } : { regionId: chosen }))}>
              Nhận vườn ở đây
            </button>
            {claim.error && <p className="error" role="alert">{claim.error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ khung chính
type Tab = 'vuon' | 'kho' | 'cho' | 'gia' | 'bando';
const TABS: [Tab, string, string][] = [['vuon', '🌱', 'Vườn'], ['kho', '🧺', 'Kho & Sạp'], ['cho', '🛒', 'Chợ'], ['gia', '📈', 'Bảng giá'], ['bando', '🗺️', 'Bản đồ']];
const TAB_TITLES: Record<Tab, string> = { vuon: 'Vườn', kho: 'Kho & Sạp', cho: 'Chợ đặc sản', gia: 'Bảng giá tham chiếu', bando: 'Bản đồ vùng trồng' };

function burstKind(stepName: string): 'water' | 'soil' | 'leaf' | 'harvest' {
  const n = stepName.toLowerCase();
  if (/thu hoạch|thu hái|nhổ|gặt|sơ chế/.test(n)) return 'harvest';
  if (/tưới|nước/.test(n)) return 'water';
  if (/tỉa|cắt|bao|thụ phấn|che|chong|khoanh|phòng|chăm/.test(n)) return 'leaf';
  return 'soil';
}

function Game({ me, refresh }: { me: Me; refresh: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('vuon');
  const [plotId, setPlotId] = useState(me.plots[0].id);
  const [view, setView] = useState<PlotView | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, tick] = useState(0);
  const sceneRef = useRef<FarmScene | null>(null);
  const [prices, setPrices] = useState<Prices>({});

  const loadPrices = useCallback(async () => { setPrices((await api('GET', '/api/prices')).prices); }, []);
  useEffect(() => { void loadPrices(); const t = setInterval(loadPrices, 60000); return () => clearInterval(t); }, [loadPrices]);
  const priceOf = useCallback((id: string) => prices[id]?.price ?? SPECIALTIES[id].refPrice, [prices]);

  const load = useCallback(async () => {
    const v = await api<PlotView>('GET', `/api/plots/${plotId}`);
    setView(v); setOffset(v.now - Date.now());
  }, [plotId]);
  useEffect(() => { setSelected(null); void load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  const reload = useCallback(() => { void load(); void refresh(); }, [load, refresh]);
  const act = useAction(reload);

  const visit = (id: number) => { setPlotId(id); setTab('vuon'); };
  const now = Date.now() + offset;
  const mine = view?.plot.mine ?? true;
  const planting = view?.plantings.find((p) => p.tile === selected);
  const readyCount = view && mine ? view.plantings.filter((p) => now >= p.stepReadyAt).length : 0;
  const sceneState = useMemo(() => ({
    regionId: view?.plot.regionId ?? me.plots[0].regionId, plantings: view?.plantings ?? [], stall: view?.stall ?? [], selected, clockOffset: offset,
  }), [view, selected, offset, me.plots]);

  return (
    <div className="game">
      <Scene3D state={sceneState} interactive onSelect={(t) => { if (tab === 'vuon') { setSelected(t); act.setError(null); } }} sceneRef={sceneRef} />

      <header className="hud-top">
        <div className="chip">
          <span className="chip-avatar" aria-hidden="true">🧑‍🌾</span>
          <div className="chip-text">
            <strong>{mine ? me.user.displayName : `Thăm vườn ${view?.plot.ownerName ?? ''}`}</strong>
            <small>{view ? regionLabel(view.plot.regionId) : 'Đang mở vườn…'}</small>
          </div>
        </div>
        <div className="coin" title="Tiền mặt"><span aria-hidden="true">🪙</span>{fmtMoney(me.user.cash)}</div>
        <button className="round" aria-label="Đăng xuất" title="Đăng xuất"
          onClick={async () => { if (confirm('Đăng xuất khỏi Vườn Việt?')) { await api('POST', '/api/auth/logout', {}); await refresh(); } }}>⏻</button>
      </header>

      {(me.plots.length > 1 || !mine) && tab === 'vuon' && (
        <div className="plot-switch">
          {me.plots.map((p) => (
            <button key={p.id} aria-pressed={p.id === plotId} onClick={() => setPlotId(p.id)}>{p.isHome ? '🏠 ' : '🌾 '}{REGIONS[p.regionId].name}</button>
          ))}
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      {tab === 'vuon' && view && (
        <div className="sheet">
          {act.error && <p className="error" role="alert">{act.error}</p>}
          {selected === null && (
            <p className="sheet-hint">
              {!mine ? 'Bạn đang ghé thăm. Chạm vào ô đất để xem cây.' : readyCount > 0 ? `Có ${readyCount} ô đang chờ bạn chăm sóc (dấu vàng).` : 'Chạm vào một ô đất để trồng hoặc chăm sóc. Kéo để xoay, chụm để phóng to.'}
            </p>
          )}
          {selected !== null && !planting && mine && (
            <>
              <div className="sheet-head"><h3>Ô {selected + 1} · đất trống</h3><button className="round" aria-label="Đóng" onClick={() => setSelected(null)}>✕</button></div>
              <div className="choices">
                {specialtiesOfRegion(view.plot.regionId).map((sp) => {
                  const crop = CROPS[sp.crop];
                  const cost = seedCost(sp);
                  const steps = processOf(crop).length;
                  return (
                    <button key={sp.id} className="choice" disabled={act.busy || me.user.cash < cost}
                      onClick={() => act.run(async () => { await api('POST', `/api/plots/${plotId}/plant`, { tile: selected, specialtyId: sp.id }); sceneRef.current?.burst(selected, 'soil'); })}>
                      <span className="emoji">{crop.emoji}</span>
                      <span className="grow"><strong>{sp.name}</strong>
                        <small>{crop.yieldKg} kg/vụ · {steps} bước · {fmtDuration(stepWaitMs(sp, me.config.timeScale) * (steps - 1))}</small></span>
                      <span className="price">{fmtMoney(cost)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {selected !== null && !planting && !mine && <p className="sheet-hint">Ô này đang để trống.</p>}
          {planting && (() => {
            const sp = SPECIALTIES[planting.specialtyId];
            const steps = processOf(CROPS[sp.crop]);
            const step = steps[planting.stepIndex];
            const wait = planting.stepReadyAt - now;
            const isLast = planting.stepIndex === steps.length - 1;
            return (
              <>
                <div className="sheet-head">
                  <h3>{CROPS[sp.crop].emoji} {sp.name}</h3>
                  <span className="tag">Bước {planting.stepIndex + 1}/{steps.length}</span>
                  <button className="round" aria-label="Đóng" onClick={() => setSelected(null)}>✕</button>
                </div>
                <div className="progress" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i < planting.stepIndex ? 'done' : i === planting.stepIndex ? 'now' : ''} />)}</div>
                <p className="step-name">{step.name}</p>
                <p className="step-desc">{step.desc}</p>
                {planting.lateCount > 0 && <p className="muted">Đã chăm sóc trễ {planting.lateCount} lần, chất lượng sẽ giảm.</p>}
                {mine && (
                  <button className="primary" disabled={act.busy || wait > 0}
                    onClick={() => act.run(async () => {
                      const r = await api('POST', `/api/plantings/${planting.id}/step`, {});
                      sceneRef.current?.burst(planting.tile, burstKind(step.name));
                      if (r.harvested) { setToast(`Thu hoạch ${r.harvested.kg} kg ${sp.name} (${QUALITY_NAMES[r.harvested.quality as 'A']}). Hàng đã vào kho.`); setSelected(null); }
                    })}>
                    {wait > 0 ? `Chờ ${fmtDuration(wait)}` : isLast ? 'Thu hoạch' : step.name}
                  </button>
                )}
              </>
            );
          })()}
          {!mine && view.stall.length > 0 && selected === null && (
            <><h3>Sạp trước nhà</h3><StallList listings={view.stall} canBuy onChanged={reload} /></>
          )}
        </div>
      )}

      {tab !== 'vuon' && (
        <div className="modal" role="dialog" aria-label={TAB_TITLES[tab]}>
          <div className="modal-head"><h2>{TAB_TITLES[tab]}</h2><button className="round" aria-label="Đóng" onClick={() => setTab('vuon')}>✕</button></div>
          <div className="modal-body">
            {tab === 'kho' && <Stock me={me} priceOf={priceOf} refresh={reload} />}
            {tab === 'cho' && <Market priceOf={priceOf} refresh={reload} />}
            {tab === 'gia' && <PriceBoard prices={prices} />}
            {tab === 'bando' && <RegionMap me={me} refresh={refresh} visit={visit} />}
          </div>
        </div>
      )}

      <nav className="dock">
        {TABS.map(([id, icon, label]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <span>{icon}</span>{label}
            {id === 'vuon' && readyCount > 0 && <b className="badge">{readyCount}</b>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ------------------------------------------------------------------ kho và sạp
function Stock({ me, priceOf, refresh }: { me: Me; priceOf: (id: string) => number; refresh: () => void }) {
  const [mine, setMine] = useState<Listing[]>([]);
  const load = useCallback(async () => {
    setMine((await api('GET', '/api/market?mine=1')).listings);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const done = useCallback(() => { void load(); void refresh(); }, [load, refresh]);
  return (
    <div>
      <h3>Kho nông sản</h3>
      {me.inventory.length === 0 && <p className="hint">Kho đang trống. Thu hoạch xong, nông sản sẽ nằm ở đây.</p>}
      {me.inventory.map((item) => <StockRow key={item.specialtyId + item.quality} item={item} me={me} refPrice={priceOf(item.specialtyId)} onDone={done} />)}
      <h3>Sạp trước nhà</h3>
      {mine.length === 0 ? <p className="hint">Bạn chưa bày món nào. Bày hàng lên sạp để người chơi khác mua.</p> : <StallList listings={mine} canCancel onChanged={done} />}
    </div>
  );
}

function StockRow({ item, me, refPrice, onDone }: { item: Me['inventory'][number]; me: Me; refPrice: number; onDone: () => void }) {
  const sp = SPECIALTIES[item.specialtyId];
  const [kg, setKg] = useState(item.kg);
  const [price, setPrice] = useState(refPrice);
  useEffect(() => { setKg(item.kg); }, [item.kg]);
  const act = useAction(onDone);
  const npc = npcPrice(refPrice, item.quality, sp.regionId, me.user.homeRegionId!);
  const local = sp.regionId === me.user.homeRegionId;
  const amount = Math.min(Math.max(1, Math.floor(kg) || 1), item.kg);
  return (
    <div className="row">
      <div className="row-head">
        <span className="emoji">{CROPS[sp.crop].emoji}</span>
        <div><strong>{sp.name}</strong> <span className="tag">{QUALITY_NAMES[item.quality]}</span><br /><small>Còn {item.kg} kg · giá tham chiếu {fmtMoney(refPrice)}/kg</small></div>
      </div>
      <div className="row-actions">
        <label>Số kg<input type="number" min={1} max={item.kg} value={kg} onChange={(e) => setKg(Number(e.target.value))} /></label>
        <button disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/sell/npc', { specialtyId: sp.id, quality: item.quality, kg: amount }))}>
          Bán thương lái {fmtMoney(npc)}/kg
        </button>
        <label>Giá rao (đ/kg)<input type="number" min={1} step={500} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
        <button disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/market/listings', { specialtyId: sp.id, quality: item.quality, kg: amount, price: Math.round(price) }))}>
          Bày lên sạp
        </button>
      </div>
      <small className="muted">{local ? 'Thương lái mua tại vườn thấp hơn giá tham chiếu.' : 'Hàng phương xa: thương lái vùng bạn trả cao hơn giá tham chiếu.'}</small>
      {act.error && <p className="error" role="alert">{act.error}</p>}
    </div>
  );
}

function StallList({ listings, canBuy, canCancel, onChanged }: { listings: Listing[]; canBuy?: boolean; canCancel?: boolean; onChanged: () => void }) {
  const act = useAction(onChanged);
  return (
    <div>
      {listings.map((l) => {
        const sp = SPECIALTIES[l.specialtyId];
        return (
          <div className="row row-line" key={l.id}>
            <span className="emoji">{CROPS[sp.crop].emoji}</span>
            <div className="grow"><strong>{sp.name}</strong> <span className="tag">{QUALITY_NAMES[l.quality]}</span><br />
              <small>{l.kg} kg · {fmtMoney(l.price)}/kg{l.sellerName ? ` · ${l.sellerName}` : ''}{l.sellerRegionId ? ` (${REGIONS[l.sellerRegionId].name})` : ''}</small></div>
            {canBuy && <button disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/market/listings/${l.id}/buy`, { kg: l.kg }))}>Mua hết {fmtMoney(l.price * l.kg)}</button>}
            {canCancel && <button disabled={act.busy} onClick={() => act.run(() => api('DELETE', `/api/market/listings/${l.id}`))}>Gỡ xuống</button>}
          </div>
        );
      })}
      {act.error && <p className="error" role="alert">{act.error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ chợ
function Market({ priceOf, refresh }: { priceOf: (id: string) => number; refresh: () => void }) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const load = useCallback(async () => { setListings((await api('GET', '/api/market')).listings); }, []);
  useEffect(() => { void load(); }, [load]);
  const others = listings ?? [];
  return (
    <div>
      <p className="muted">Hàng người chơi cả nước đang bày bán. Mua đặc sản vùng khác về, thương lái vùng bạn sẽ trả giá hàng phương xa.</p>
      {listings === null ? <p className="hint">Đang tải…</p> : others.length === 0 ? <p className="hint">Chợ chưa có ai bày hàng. Hãy là người mở sạp đầu tiên ở mục Kho & Sạp.</p> : (
        <>
          <StallList listings={others} canBuy onChanged={() => { void load(); void refresh(); }} />
          <small className="muted">Giá tham chiếu hiện tại xem ở mục Bảng giá. Ví dụ {SPECIALTIES[others[0].specialtyId].name}: {fmtMoney(priceOf(others[0].specialtyId))}/kg.</small>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ bảng giá
function PriceBoard({ prices }: { prices: Prices }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => Object.values(SPECIALTIES)
    .filter((sp) => (sp.name + ' ' + regionLabel(sp.regionId)).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi')), [query]);
  const hasSample = Object.values(prices).some((p) => p.source === 'gia_mau');
  return (
    <div>
      {hasSample && <p className="notice">Các dòng ghi “giá mẫu” là số khởi tạo để chơi thử, chưa phải giá thị trường.</p>}
      <input className="search" placeholder="Tìm đặc sản hoặc vùng trồng" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm đặc sản" />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Đặc sản</th><th>Vùng trồng</th><th className="num">Giá (đ/kg)</th><th className="num">Thay đổi</th><th>Nguồn</th></tr></thead>
          <tbody>
            {rows.map((sp) => {
              const p = prices[sp.id];
              const price = p?.price ?? sp.refPrice;
              const change = p?.prev ? ((price - p.prev) / p.prev) * 100 : 0;
              return (
                <tr key={sp.id}>
                  <td>{CROPS[sp.crop].emoji} {sp.name}</td>
                  <td>{regionLabel(sp.regionId)}</td>
                  <td className="num">{price.toLocaleString('vi-VN')}</td>
                  <td className={`num ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>{change === 0 ? '—' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`}</td>
                  <td><small>{!p || p.source === 'gia_mau' ? 'giá mẫu' : p.source}</small></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ bản đồ vùng trồng
function RegionMap({ me, refresh, visit }: { me: Me; refresh: () => Promise<void>; visit: (plotId: number) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [farms, setFarms] = useState<{ total: number; farms: { plotId: number; ownerName: string; isHome: boolean; growing: number }[] } | null>(null);
  const act = useAction(() => { void refresh(); });
  useEffect(() => {
    setFarms(null);
    if (open) void api('GET', `/api/regions/${open}/farms`).then(setFarms).catch(() => setFarms({ total: 0, farms: [] }));
  }, [open, me.plots.length]);
  const owned = new Set(me.plots.map((p) => p.regionId));
  return (
    <div>
      <p className="muted">{Object.keys(REGIONS).length} vùng trồng trên 34 tỉnh thành và các đảo. Mua thêm đất ở vùng khác giá {fmtMoney(LAND_PRICE)} mỗi lô.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {ZONES.map((z) => (
        <div key={z}>
          <h3>{ZONE_NAMES[z]}</h3>
          {Object.values(REGIONS).filter((r) => r.zone === z).map((r) => (
            <div className="row" key={r.id}>
              <button className="row-toggle" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span><strong>{r.name}</strong>, {r.province}{r.formerProvince ? ` (${r.formerProvince} cũ)` : ''} {owned.has(r.id) && <span className="tag">Có đất</span>}<br />
                  <small>{specialtiesOfRegion(r.id).map((s) => s.name).join(' · ')}</small></span>
              </button>
              {open === r.id && (
                <div className="region-body">
                  {!owned.has(r.id) && (
                    <button disabled={act.busy || me.user.cash < LAND_PRICE} onClick={() => act.run(() => api('POST', '/api/plots/buy', { regionId: r.id }))}>
                      {me.user.cash < LAND_PRICE ? `Cần ${fmtMoney(LAND_PRICE)} để mua đất` : `Mua đất ở đây ${fmtMoney(LAND_PRICE)}`}
                    </button>
                  )}
                  {farms === null ? <p className="hint">Đang tải…</p> : farms.farms.length === 0 ? <p className="hint">Chưa có ai lập vườn ở đây.</p> : (
                    <>
                      <small className="muted">{farms.total} mảnh vườn</small>
                      {farms.farms.map((f) => (
                        <div className="row-line" key={f.plotId}>
                          <div className="grow">{f.ownerName} <small className="muted">· đang trồng {f.growing} ô</small></div>
                          <button onClick={() => visit(f.plotId)}>Ghé thăm</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
