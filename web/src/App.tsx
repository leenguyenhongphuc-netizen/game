import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES, ZONE_NAMES, processOf, specialtiesOfRegion } from '../../shared/catalog.ts';
import type { Zone } from '../../shared/catalog.ts';
import {
  HELP_REWARD, LAND_PRICE, MAX_FRIENDS, PLOT_COLS, PLOT_ROWS, QUALITY_NAMES, TILE_M2, fmtMoney, npcPrice, seedCost, stepWaitMs,
} from '../../shared/rules.ts';
import { api } from './api.ts';
import type { Friends, Listing, Me, Planting, Prices, Village } from './api.ts';
import { WorldView } from './WorldView.tsx';
import { SLOT_COUNT } from './scene/World.ts';
import type { Context, World, WorldState } from './scene/World.ts';

const ZONES = Object.keys(ZONE_NAMES) as Zone[];
/** Xóm mẫu làm nền cho màn đăng nhập. */
const sample = (rows: ([string, number] | null)[], base: number): Planting[] =>
  rows.flatMap((p, tile) => (p ? [{ id: base + tile, tile, specialtyId: p[0], stepIndex: p[1], stepReadyAt: Number.MAX_SAFE_INTEGER, lateCount: 0 }] : []));
const stallOf = (...ids: string[]): Listing[] => ids.map((specialtyId, i) => ({ id: i + 1, specialtyId, quality: 'A' as const, kg: 1, price: 1 }));
const SHOWCASE: WorldState = {
  regionId: 'dt_caibe', clockOffset: 0,
  lots: [
    { plotId: 1, ownerName: 'Bạn', mine: true, friend: false, stall: stallOf('xoai_hoa_loc', 'thanh_long_cho_gao', 'khom_tan_phuoc'), plantings: sample([
      ['xoai_hoa_loc', 7], ['xoai_hoa_loc', 7], ['xoai_hoa_loc', 5], ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 4],
      ['sau_rieng_ngu_hiep', 7], ['sau_rieng_ngu_hiep', 5], null, ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 2], null,
      ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 3], ['vu_sua_lo_ren', 7], ['vu_sua_lo_ren', 4], ['vu_sua_lo_ren', 2],
      ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 1], null, ['xoai_hoa_loc', 3], null, ['vu_sua_lo_ren', 7]], 1) },
    { plotId: 2, ownerName: 'cô Ba', mine: false, friend: true, stall: stallOf('vu_sua_lo_ren'), plantings: sample([['vu_sua_lo_ren', 7], ['vu_sua_lo_ren', 7], ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 6], null, null, ['xoai_hoa_loc', 5], ['xoai_hoa_loc', 7]], 100) },
    { plotId: 3, ownerName: 'anh Sáu', mine: false, friend: true, stall: stallOf('sau_rieng_ngu_hiep'), plantings: sample([['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 7], ['thanh_long_cho_gao', 7], null, ['sau_rieng_ngu_hiep', 7], ['sau_rieng_ngu_hiep', 7]], 200) },
    { plotId: 4, ownerName: 'chị Út', mine: false, friend: true, stall: [], plantings: sample([['khom_tan_phuoc', 6], ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 6], ['khom_tan_phuoc', 3], null, ['xoai_hoa_loc', 7]], 300) },
    null, null, null, null, null, null,
  ],
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
      <WorldView state={SHOWCASE} demo />
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
type Tab = 'vuon' | 'kho' | 'cho' | 'ban' | 'bando' | 'sap';
const TABS: [Tab, string, string][] = [['kho', '🧺', 'Kho & Sạp'], ['cho', '🛒', 'Chợ'], ['ban', '🧑‍🤝‍🧑', 'Bạn bè'], ['bando', '🗺️', 'Bản đồ']];
const TAB_TITLES: Record<Tab, string> = { vuon: '', kho: 'Kho & Sạp', cho: 'Chợ đặc sản', ban: 'Bạn bè trong xóm', bando: 'Bản đồ vùng trồng', sap: 'Sạp hàng xóm' };

function burstKind(stepName: string): 'water' | 'soil' | 'leaf' | 'harvest' {
  const n = stepName.toLowerCase();
  if (/thu hoạch|thu hái|nhổ|gặt|sơ chế/.test(n)) return 'harvest';
  if (/tưới|nước/.test(n)) return 'water';
  if (/tỉa|cắt|bao|thụ phấn|che|chong|khoanh|phòng|chăm/.test(n)) return 'leaf';
  return 'soil';
}
const STEP_ICON = { water: '💧', soil: '⛏️', leaf: '✂️', harvest: '🧺' };

function Game({ me, refresh }: { me: Me; refresh: () => Promise<void> }) {
  const homePlotId = me.plots.find((p) => p.isHome)!.id;
  const [tab, setTab] = useState<Tab>('vuon');
  const [plotId, setPlotId] = useState(homePlotId);
  const [village, setVillage] = useState<Village | null>(null);
  const [offset, setOffset] = useState(0);
  const [ctx, setCtx] = useState<Context>({ kind: 'none' });
  const [toast, setToast] = useState<string | null>(null);
  const [marketTab, setMarketTab] = useState<'cho' | 'gia'>('cho');
  const [, tick] = useState(0);
  const worldRef = useRef<World | null>(null);
  const busy = useRef(new Set<number>());
  const blocked = useRef(new Map<number, number>());
  const [prices, setPrices] = useState<Prices>({});

  const loadPrices = useCallback(async () => { setPrices((await api('GET', '/api/prices')).prices); }, []);
  useEffect(() => { void loadPrices(); const t = setInterval(loadPrices, 60000); return () => clearInterval(t); }, [loadPrices]);
  const priceOf = useCallback((id: string) => prices[id]?.price ?? SPECIALTIES[id].refPrice, [prices]);

  const load = useCallback(async () => {
    const v = await api<Village>('GET', `/api/village?plotId=${plotId}`);
    setVillage(v); setOffset(v.now - Date.now());
  }, [plotId]);
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const reload = useCallback(() => { void load(); void refresh(); }, [load, refresh]);
  const act = useAction(reload);

  const lots = useMemo(() => (village ? [village.center, ...village.neighbors] : []), [village]);
  const worldState = useMemo(() => ({
    regionId: village?.center.plot.regionId ?? me.user.homeRegionId!, clockOffset: offset,
    lots: Array.from({ length: SLOT_COUNT }, (_, i) => {
      const l = lots[i];
      return l ? { plotId: l.plot.id, ownerName: l.plot.ownerName, mine: l.plot.mine, friend: l.plot.friend, plantings: l.plantings, stall: l.stall } : null;
    }),
  }), [village, lots, offset, me.user.homeRegionId]);

  const now = Date.now() + offset;
  const center = village?.center;
  const atHome = plotId === homePlotId;
  const goHome = () => { setPlotId(homePlotId); setTab('vuon'); worldRef.current?.goHome(); };
  const visit = (id: number) => { setPlotId(id); setTab('vuon'); worldRef.current?.goHome(); };

  // Nhân vật đứng lên ô có cây đã đến giờ: tự làm bước đó (vườn mình), hoặc chăm giúp (vườn bạn).
  const onReady = useCallback(async (lotIndex: number, planting: Planting) => {
    const lot = lots[lotIndex];
    if (!lot || busy.current.has(planting.id) || (blocked.current.get(planting.id) ?? 0) > Date.now()) return;
    const sp = SPECIALTIES[planting.specialtyId];
    const steps = processOf(CROPS[sp.crop]);
    const step = steps[planting.stepIndex];
    const isLast = planting.stepIndex === steps.length - 1;
    if (!lot.plot.mine && (!lot.plot.friend || isLast)) return;
    busy.current.add(planting.id);
    try {
      const kind = burstKind(step.name);
      if (lot.plot.mine) {
        const r = await api('POST', `/api/plantings/${planting.id}/step`, {});
        worldRef.current?.burst(lotIndex, planting.tile, kind);
        if (r.harvested) { worldRef.current?.floatText(lotIndex, planting.tile, `+${r.harvested.kg} kg ${CROPS[sp.crop].emoji}`); setToast(`Thu hoạch ${r.harvested.kg} kg ${sp.name} (${QUALITY_NAMES[r.harvested.quality as 'A']})`); }
        else worldRef.current?.floatText(lotIndex, planting.tile, `${STEP_ICON[kind]} ${step.name}`, '#fff6dc');
      } else {
        const r = await api('POST', `/api/plantings/${planting.id}/help`, {});
        worldRef.current?.burst(lotIndex, planting.tile, kind);
        worldRef.current?.floatText(lotIndex, planting.tile, `+${fmtMoney(r.reward)} · chăm giúp`);
      }
      reload();
    } catch (e) {
      blocked.current.set(planting.id, Date.now() + 15000);
      setToast(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally { busy.current.delete(planting.id); }
  }, [lots, reload]);

  // Bảng nhiệm vụ ở trên cùng
  const mine = center?.plot.mine ?? true;
  const ready = center && mine ? center.plantings.filter((p) => now >= p.stepReadyAt) : [];
  const nextAt = center && mine && center.plantings.length ? Math.min(...center.plantings.map((p) => p.stepReadyAt)) : null;
  const quest: [string, string] = !center ? ['⏳', 'Đang mở xóm…']
    : !mine ? ['👋', `Đang thăm vườn ${center.plot.ownerName}`]
    : center.plantings.length === 0 ? ['🌱', 'Chạy vào vườn, đứng lên một ô đất và chọn giống để trồng']
    : ready.length > 0 ? ['⭐', `Chạy tới ${ready.length} ô có dấu vàng để chăm cây`]
    : ['⏰', `Bước kế tiếp sau ${fmtDuration((nextAt ?? now) - now)}`];

  const ctxLot = ctx.kind === 'none' ? null : lots[ctx.lot] ?? null;
  const ctxPlanting = ctx.kind === 'tile' && ctxLot ? ctxLot.plantings.find((p) => p.tile === ctx.tile) : undefined;

  return (
    <div className="game">
      <WorldView state={worldState} worldRef={worldRef} paused={tab !== 'vuon'} onContext={setCtx} onReady={onReady} />

      <header className="hud-top">
        <div className="chip">
          <span className="chip-avatar" aria-hidden="true">🧑‍🌾</span>
          <div className="chip-text"><strong>{me.user.displayName}</strong><small>{center ? regionLabel(center.plot.regionId) : ''}</small></div>
        </div>
        <div className="coin" title="Tiền mặt"><span aria-hidden="true">🪙</span>{fmtMoney(me.user.cash)}</div>
        <button className="round" aria-label="Đăng xuất" title="Đăng xuất"
          onClick={async () => { if (confirm('Đăng xuất khỏi Vườn Việt?')) { await api('POST', '/api/auth/logout', {}); await refresh(); } }}>⏻</button>
      </header>
      <div className="quest"><span aria-hidden="true">{quest[0]}</span><p>{quest[1]}</p>{!atHome && <button onClick={goHome}>🏠 Về nhà</button>}</div>
      {me.plots.length > 1 && tab === 'vuon' && (
        <div className="plot-switch">
          {me.plots.map((p) => <button key={p.id} aria-pressed={p.id === plotId} onClick={() => visit(p.id)}>{p.isHome ? '🏠 ' : '🌾 '}{REGIONS[p.regionId].name}</button>)}
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}

      {tab === 'vuon' && ctx.kind !== 'none' && (
        <div className="context">
          {act.error && <p className="error" role="alert">{act.error}</p>}
          {ctx.kind === 'tile' && ctxLot && !ctxPlanting && ctxLot.plot.mine && (
            <>
              <p className="context-title">Chọn giống để trồng</p>
              <div className="seeds">
                {specialtiesOfRegion(ctxLot.plot.regionId).map((sp) => {
                  const crop = CROPS[sp.crop], cost = seedCost(sp), steps = processOf(crop).length;
                  return (
                    <button key={sp.id} className="seed" disabled={act.busy || me.user.cash < cost}
                      onClick={() => act.run(async () => { await api('POST', `/api/plots/${ctxLot.plot.id}/plant`, { tile: ctx.tile, specialtyId: sp.id }); worldRef.current?.burst(ctx.lot, ctx.tile, 'soil'); worldRef.current?.floatText(ctx.lot, ctx.tile, `${crop.emoji} ${processOf(crop)[0].name}`, '#fff6dc'); })}>
                      <span className="emoji">{crop.emoji}</span>
                      <strong>{sp.name}</strong>
                      <small>{crop.yieldKg} kg · {fmtDuration(stepWaitMs(sp, me.config.timeScale) * (steps - 1))}</small>
                      <span className="price">{fmtMoney(cost)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {ctx.kind === 'tile' && ctxLot && !ctxPlanting && !ctxLot.plot.mine && <p className="context-title">Ô này của {ctxLot.plot.ownerName} đang để trống</p>}
          {ctx.kind === 'tile' && ctxLot && ctxPlanting && (() => {
            const sp = SPECIALTIES[ctxPlanting.specialtyId];
            const steps = processOf(CROPS[sp.crop]);
            const step = steps[ctxPlanting.stepIndex];
            const wait = ctxPlanting.stepReadyAt - now;
            const isLast = ctxPlanting.stepIndex === steps.length - 1;
            return (
              <div className="plant-card">
                <span className="emoji big">{CROPS[sp.crop].emoji}</span>
                <div className="grow">
                  <p className="context-title">{sp.name} <span className="tag">Bước {ctxPlanting.stepIndex + 1}/{steps.length}</span></p>
                  <div className="progress" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i < ctxPlanting.stepIndex ? 'done' : i === ctxPlanting.stepIndex ? 'now' : ''} />)}</div>
                  <p className="step-name">{step.name}{wait > 0 ? ` · sau ${fmtDuration(wait)}` : !ctxLot.plot.mine && isLast ? ' · chờ chủ vườn' : ''}</p>
                  <p className="step-desc">{step.desc}</p>
                </div>
              </div>
            );
          })()}
          {ctx.kind === 'stall' && ctxLot && (
            <button className="primary" onClick={() => setTab(ctxLot.plot.mine ? 'kho' : 'sap')}>{ctxLot.plot.mine ? '🧺 Mở kho & sạp của mình' : `🛒 Xem sạp của ${ctxLot.plot.ownerName}`}</button>
          )}
          {ctx.kind === 'empty-lot' && <button className="primary" onClick={() => setTab('ban')}>🧑‍🤝‍🧑 Mời bạn về làm hàng xóm</button>}
        </div>
      )}

      {tab !== 'vuon' && (
        <div className="modal" role="dialog" aria-label={TAB_TITLES[tab]}>
          <div className="modal-head"><h2>{TAB_TITLES[tab]}</h2><button className="round" aria-label="Đóng" onClick={() => setTab('vuon')}>✕</button></div>
          <div className="modal-body">
            {tab === 'kho' && <Stock me={me} priceOf={priceOf} refresh={reload} />}
            {tab === 'cho' && (
              <>
                <div className="tabs"><button aria-selected={marketTab === 'cho'} onClick={() => setMarketTab('cho')}>Hàng đang bán</button><button aria-selected={marketTab === 'gia'} onClick={() => setMarketTab('gia')}>Bảng giá</button></div>
                {marketTab === 'cho' ? <Market priceOf={priceOf} refresh={reload} /> : <PriceBoard prices={prices} />}
              </>
            )}
            {tab === 'ban' && <FriendsPanel onChanged={reload} visit={visit} />}
            {tab === 'bando' && <RegionMap me={me} refresh={refresh} visit={visit} />}
            {tab === 'sap' && ctxLot && (ctxLot.stall.length ? <StallList listings={ctxLot.stall} canBuy onChanged={reload} /> : <p className="hint">{ctxLot.plot.ownerName} chưa bày món nào.</p>)}
          </div>
        </div>
      )}

      <nav className="dock">
        {TABS.map(([id, icon, label]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(tab === id ? 'vuon' : id)}><span>{icon}</span>{label}</button>
        ))}
      </nav>
    </div>
  );
}

// ------------------------------------------------------------------ bạn bè
function FriendsPanel({ onChanged, visit }: { onChanged: () => void; visit: (plotId: number) => void }) {
  const [data, setData] = useState<Friends | null>(null);
  const [username, setUsername] = useState('');
  const load = useCallback(async () => { setData(await api<Friends>('GET', '/api/friends')); }, []);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); onChanged(); });
  return (
    <div>
      <p className="muted">Bạn bè sẽ có vườn nằm ngay cạnh vườn bạn trong xóm. Chạy sang chăm giúp cây đã đến giờ để nhận {fmtMoney(HELP_REWARD)} tiền công mỗi lần. Tối đa {MAX_FRIENDS} người bạn.</p>
      <form className="row-line" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { const r = await api('POST', '/api/friends', { username: username.trim().toLowerCase() }); setUsername(''); alert(r.status === 'accepted' ? 'Hai bạn đã là hàng xóm!' : 'Đã gửi lời mời kết bạn.'); }); }}>
        <input className="grow" placeholder="Tên tài khoản của bạn bè" value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Tên tài khoản của bạn bè" maxLength={20} required />
        <button disabled={act.busy}>Mời</button>
      </form>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {data === null ? <p className="hint">Đang tải…</p> : (
        <>
          {data.incoming.length > 0 && <h3>Lời mời gửi tới bạn</h3>}
          {data.incoming.map((p) => (
            <div className="row row-line" key={p.userId}><div className="grow"><strong>{p.displayName}</strong><br /><small>@{p.username}</small></div>
              <button disabled={act.busy} onClick={() => act.run(() => api('POST', `/api/friends/${p.userId}/accept`, {}))}>Đồng ý</button>
              <button disabled={act.busy} onClick={() => act.run(() => api('DELETE', `/api/friends/${p.userId}`))}>Từ chối</button></div>
          ))}
          <h3>Hàng xóm ({data.friends.length}/{MAX_FRIENDS})</h3>
          {data.friends.length === 0 && <p className="hint">Chưa có ai. Nhập tên tài khoản của bạn bè ở trên để mời.</p>}
          {data.friends.map((p) => (
            <div className="row row-line" key={p.userId}><div className="grow"><strong>{p.displayName}</strong><br /><small>@{p.username}{p.homeRegionId ? ` · ${regionLabel(p.homeRegionId)}` : ' · chưa nhận đất'}</small></div>
              {p.plotId && <button onClick={() => visit(p.plotId!)}>Thăm vườn</button>}
              <button disabled={act.busy} onClick={() => { if (confirm(`Thôi làm hàng xóm với ${p.displayName}?`)) void act.run(() => api('DELETE', `/api/friends/${p.userId}`)); }}>Xoá</button></div>
          ))}
          {data.outgoing.length > 0 && <h3>Đang chờ đồng ý</h3>}
          {data.outgoing.map((p) => (
            <div className="row row-line" key={p.userId}><div className="grow"><strong>{p.displayName}</strong><br /><small>@{p.username}</small></div>
              <button disabled={act.busy} onClick={() => act.run(() => api('DELETE', `/api/friends/${p.userId}`))}>Rút lại</button></div>
          ))}
        </>
      )}
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
