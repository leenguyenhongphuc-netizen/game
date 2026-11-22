import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CROPS, REGIONS, SPECIALTIES, ZONE_NAMES, npcOf, processOf, specialtiesOfRegion } from '../../shared/catalog.ts';
import type { Specialty } from '../../shared/catalog.ts';
import type { Zone } from '../../shared/catalog.ts';
import {
  CITY_BONUS, GIFT_MAX_KG, HELP_REWARD, MAX_FRIENDS, PLOT_COLS, PLOT_ROWS, QUALITY_NAMES, ROOFTOP_TILES, TILE_M2, DUMP_RATIO, QUALITY_MULT, ROLE_INFO, TRAVEL_MODES, TRUCK, fmtMoney, inSeason, npcPrice, seedCost, stepWaitMs, weatherAt,
} from '../../shared/rules.ts';
import { api } from './api.ts';
import { AlbumPanel, CoopPanel, GiftsPanel, ShowcasePanel, TravelPanel } from './panels.tsx';
import { fmtDuration, regionLabel, useAction } from './ui.ts';
import { NpcBadge, OrdersPanel, ProfilePanel, WardPicker, WorkshopPanel } from './work.tsx';
import { RoleWheel } from './wheel.tsx';
import { CustomizePanel } from './custom.tsx';
import { DriveGame } from './drive/DriveGame.tsx';
import type { DrivePlan, DriveResult } from './drive/DriveGame.tsx';
import { Icon } from './icons.tsx';
import { ExportPanel, TradePanel } from './trade.tsx';
import { ExportRide } from './drive/ExportRide.tsx';
import { EXPORT_MARKETS } from '../../shared/rules.ts';
import type { ExportSent } from './trade.tsx';
import type { IconName } from './icons.tsx';
import { CropGuide, KIND_VERB, StageArt, stepIcon, stepKind } from './guide.tsx';
import type { Friends, GiftInbox, Listing, LotView, Me, Planting, Prices, Village } from './api.ts';
import { DEFAULT_STYLE } from '../../shared/custom.ts';
import { TravelRide } from './drive/TravelRide.tsx';
import { SightsPanel, SupermarketPanel } from './sights.tsx';
import type { SightTrip } from './sights.tsx';
import { SightWalk } from './sight/SightWalk.tsx';
import type { RideMode } from './drive/TravelRide.tsx';
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
export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    try { setMe(await api<Me>('GET', '/api/me')); } catch { setMe(null); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (me === undefined) return <div className="center">Đang tải…</div>;
  if (me && me.user.homeRegionId && me.user.role) return <Game me={me} refresh={refresh} />;
  if (me && me.user.homeRegionId) return (
    <div className="game">
      <WorldView state={SHOWCASE} demo />
      <div className="veil" />
      <RoleWheel regionName={REGIONS[me.user.homeRegionId].name} onDone={refresh} />
    </div>
  );
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
  const [found, setFound] = useState<{ lat: number; lng: number; regionId: string; km: number; urban: { id: string; name: string } | null } | null>(null);
  const [manual, setManual] = useState('');
  const [pickManual, setPickManual] = useState(false);
  const [ward, setWard] = useState<{ province: string; name: string } | null>(null);
  const act = useAction();
  const claim = useAction(onDone);

  const locate = () => act.run(() => new Promise<void>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Trình duyệt không hỗ trợ định vị. Hãy tự chọn vùng trồng.'));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        const r = await api('GET', `/api/geo/nearest?lat=${lat}&lng=${lng}`);
        setFound({ lat, lng, regionId: r.regionId, km: r.km, urban: r.urban ?? null });
        resolve();
      } catch (e) { reject(e); }
    }, () => reject(new Error('Không lấy được vị trí. Hãy cho phép định vị trong cài đặt trình duyệt, hoặc tự chọn vùng trồng.')), { timeout: 15000, maximumAge: 600000 });
  }));

  const chosen = found?.regionId ?? (manual || null);
  const wardBody = ward?.name ? { wardProvince: ward.province, wardName: ward.name } : {};
  const reset = () => { setFound(null); setManual(''); setWard(null); setPickManual(false); };

  // Bước 1: hỏi vị trí
  if (!chosen) return (
    <main className="auth">
      <div className="brand">
        <span className="brand-mark">📍</span>
        <h1>Chào {me.user.displayName}</h1>
        <p>Bạn đang ở đâu? Vườn của bạn sẽ nằm ở vùng trồng gần nơi bạn sống, và vùng nào thì trồng đặc sản của vùng đó.</p>
      </div>
      <div className="card">
        <p className="step-tag">Bước 1 / 2 · Chia sẻ vị trí</p>
        <button className="primary" onClick={locate} disabled={act.busy}>{act.busy ? 'Đang định vị…' : '📍 Chia sẻ vị trí của tôi'}</button>
        <small>Vị trí chỉ dùng để tìm vùng trồng gần bạn. Toạ độ được làm tròn về ô lưới khoảng 2 km trước khi lưu; người khác chỉ thấy tên xã, phường và vùng trồng.</small>
        {act.error && <p className="error" role="alert">{act.error}</p>}
        {!pickManual ? <button className="link" onClick={() => setPickManual(true)}>Không muốn chia sẻ vị trí? Tự chọn vùng trồng</button> : (
          <label>Chọn vùng trồng
            <select value={manual} onChange={(e) => { setManual(e.target.value); setWard(null); }}>
              <option value="">— Chọn vùng —</option>
              {ZONES.map((z) => (
                <optgroup key={z} label={ZONE_NAMES[z]}>
                  {Object.values(REGIONS).filter((r) => r.zone === z).map((r) => <option key={r.id} value={r.id}>{regionLabel(r.id)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
      </div>
    </main>
  );

  // Bước 2: xác nhận địa điểm
  const region = REGIONS[chosen];
  return (
    <main className="auth">
      <div className="card confirm-place">
        <p className="step-tag">Bước 2 / 2 · Xác nhận địa điểm</p>
        <h2>{region.name}, {region.province}</h2>
        <p className="muted">{found ? `Vùng trồng gần bạn nhất, cách khoảng ${found.km} km.` : 'Vùng trồng bạn đã chọn.'} Đặc sản: {specialtiesOfRegion(chosen).map((s) => s.name).join(', ')}.</p>
        <p><strong>Bạn ở xã, phường nào?</strong></p>
        <WardPicker province={ward?.province ?? region.province} ward={ward?.name ?? ''} onChange={(province, name) => setWard({ province, name })} />
        <small>Tên xã, phường sẽ hiện trên vườn của bạn thay cho vị trí thật.</small>
        {found?.urban && (
          <>
            <p><strong>Bạn đang ở trung tâm {found.urban.name}.</strong> Bạn có thể làm vườn ngay trên sân thượng nhà mình.</p>
            <button className="primary" disabled={claim.busy || !ward?.name} onClick={() => claim.run(() => api('POST', '/api/onboard', { lat: found.lat, lng: found.lng, rooftop: true, ...wardBody }))}>🏙️ Nhận vườn sân thượng</button>
          </>
        )}
        <button className={found?.urban ? '' : 'primary'} disabled={claim.busy || !ward?.name}
          onClick={() => claim.run(() => api('POST', '/api/onboard', found ? { lat: found.lat, lng: found.lng, ...wardBody } : { regionId: chosen, ...wardBody }))}>
          {found?.urban ? `🌾 Nhận vườn ở ${region.name}` : '✅ Xác nhận và nhận vườn'}
        </button>
        {!ward?.name && <small className="error">Hãy chọn xã, phường để tiếp tục.</small>}
        {claim.error && <p className="error" role="alert">{claim.error}</p>}
        <button className="link" onClick={reset}>← Chọn lại địa điểm</button>
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ khung chính
type Tab = 'vuon' | 'kho' | 'cho' | 'ban' | 'bando' | 'so' | 'sap' | 'toi' | 'trangtri' | 'trungbay';
interface Trip { tripId: number; fromRegionId: string; toRegionId: string; plan: DrivePlan; fuelL: number; etc: number; cash: number; truck: { tankL: number; lPer100km: number; fuelPrice: number } }
interface TripDone { regionId: string; fuelUsedL: number; fuelCost: number; rescueL: number; tollCost: number; tollFromEtc: number; fuelL: number; etc: number; cash: number; fineCost?: number; fines?: { overKmh: number; fine: number; points: number; label: string }[] }
const TABS: [Tab, IconName, string][] = [['kho', 'kho', 'Kho'], ['cho', 'cho', 'Chợ'], ['ban', 'xom', 'Xóm'], ['bando', 'dulich', 'Du lịch'], ['trangtri', 'trangtri', 'Trang trí']];
const TAB_TITLES: Record<Tab, string> = { vuon: '', kho: 'Kho, đơn hàng, xưởng', cho: 'Chợ đặc sản', ban: 'Xóm làng', bando: 'Du lịch và sổ tem', so: '', sap: 'Sạp hàng xóm', toi: 'Hồ sơ của tôi', trungbay: 'Quầy trưng bày đặc sản', trangtri: 'Trang trí nhà, sạp, nhân vật' };

/** Vườn mẫu của một vùng: trồng đủ mọi đặc sản của vùng, cây đang ra trái, để khách tham quan. */
function modelLot(regionId: string): LotView {
  const sps = specialtiesOfRegion(regionId), name = REGIONS[regionId].name;
  return {
    plot: { id: -1, regionId, isHome: false, kind: 'ground', wardName: null, wardProvince: null, ownerId: 0, ownerName: `vườn mẫu ${name}`, mine: false, friend: false, ownerRole: 'nong_dan', style: { ...DEFAULT_STYLE, gateName: `Vườn mẫu ${name}`, stallName: 'Quầy trưng bày' }, decor: [], ownerAvatar: null },
    plantings: Array.from({ length: PLOT_COLS * PLOT_ROWS }, (_, tile) => {
      const sp = sps[Math.floor((tile % PLOT_COLS) / PLOT_COLS * sps.length)];
      return { id: -(tile + 1), tile, specialtyId: sp.id, stepIndex: processOf(CROPS[sp.crop]).length - 1, stepReadyAt: Number.MAX_SAFE_INTEGER, lateCount: 0 };
    }),
    stall: sps.map((sp, i) => ({ id: -(i + 1), specialtyId: sp.id, quality: 'A' as const, kg: 1, price: sp.refPrice })),
  };
}

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
  const [driving, setDriving] = useState(false);
  const [respin, setRespin] = useState(false);
  const [tour, setTour] = useState<string | null>(null);
  const tourRestored = useRef(false);
  useEffect(() => { if (me && !tourRestored.current) { tourRestored.current = true; const t = me.user.tourRegionId; if (t && t !== me.user.homeRegionId && REGIONS[t]) setTour(t); } }, [me]);
  const [ride, setRide] = useState<{ mode: RideMode; to: string; km: number } | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [travelTab, setTravelTab] = useState<'di' | 'thamquan' | 'sieuthi' | 'so'>('di');
  const [sightTrip, setSightTrip] = useState<SightTrip | null>(null);
  const [sightWalk, setSightWalk] = useState<SightTrip | null>(null);
  const [marketTab, setMarketTab] = useState<'cho' | 'gia'>('cho');
  const [xomTab, setXomTab] = useState<'ban' | 'htx' | 'qua'>('ban');
  const [khoTab, setKhoTab] = useState<'kho' | 'don' | 'xuong' | 'xuat' | 'mua'>('kho');
  const [unseen, setUnseen] = useState(0);
  const [friendList, setFriendList] = useState<Friends['friends']>([]);
  const [, tick] = useState(0);
  const worldRef = useRef<World | null>(null);
  const busy = useRef(new Set<number>());
  const blocked = useRef(new Map<number, number>());
  const [prices, setPrices] = useState<Prices>({});

  const loadPrices = useCallback(async () => { setPrices((await api('GET', '/api/prices')).prices); }, []);
  useEffect(() => { void loadPrices(); const t = setInterval(loadPrices, 60000); return () => clearInterval(t); }, [loadPrices]);
  const priceOf = useCallback((id: string) => prices[id]?.price ?? SPECIALTIES[id].refPrice, [prices]);
  const loadSocial = useCallback(async () => {
    const [g, f] = await Promise.all([api<GiftInbox>('GET', '/api/gifts'), api<Friends>('GET', '/api/friends')]);
    setUnseen(g.unseen); setFriendList(f.friends);
    if (g.unseen > 0) setToast(`🎁 Bạn có ${g.unseen} món quà mới từ bạn bè`);
  }, []);
  useEffect(() => { void loadSocial(); const t = setInterval(loadSocial, 60000); return () => clearInterval(t); }, [loadSocial]);

  const load = useCallback(async () => {
    const v = await api<Village>('GET', `/api/village?plotId=${plotId}`);
    setVillage(v); setOffset(v.now - Date.now());
  }, [plotId]);
  useEffect(() => { void load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (me.walkin && me.walkin.kg > 0) setToast(`🛍️ Khách vãng lai mua ${me.walkin.kg} kg ở sạp: +${fmtMoney(me.walkin.total)}`); }, [me.walkin]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const reload = useCallback(() => { void load(); void refresh(); }, [load, refresh]);
  const act = useAction(reload);

  const lots = useMemo(() => (tour ? [modelLot(tour)] : village ? [village.center, ...village.neighbors] : []), [village, tour]);
  const worldState = useMemo(() => ({
    regionId: tour ?? village?.center.plot.regionId ?? me.user.homeRegionId!, clockOffset: offset, weather: tour ? weatherAt(tour, Date.now()).kind : village?.weather?.kind,
    lots: Array.from({ length: SLOT_COUNT }, (_, i) => {
      const l = lots[i];
      return l ? { plotId: l.plot.id, ownerName: l.plot.ownerName, mine: l.plot.mine, friend: l.plot.friend, kind: l.plot.kind, ownerRole: l.plot.ownerRole ?? null, style: l.plot.style, decor: l.plot.decor, avatar: l.plot.ownerAvatar, plantings: l.plantings, stall: l.stall } : null;
    }),
  }), [village, lots, offset, me.user.homeRegionId, tour]);

  const now = Date.now() + offset;
  const center = tour ? lots[0] : village?.center;
  const atHome = plotId === homePlotId && !tour;
  const goHome = () => { void api('POST', '/api/travel/home').catch(() => undefined); setTour(null); setPlotId(homePlotId); setTab('vuon'); worldRef.current?.goHome(); };
  const pace = me.config.timeScale * (me.config.pace ?? 1);
  useEffect(() => { setSeedOpen(false); setInfoOpen(false); }, [ctx]);
  const isTrader = me.user.role === 'thuong_lai';
  const fuelL = me.user.fuelL ?? TRUCK.startFuelL;
  // Trang phục của mình và xe tải của thương lái (chỉ hiện ở xóm nhà)
  useEffect(() => { worldRef.current?.setAvatar(me.user.avatar); }, [me.user.avatar, village]);
  useEffect(() => { worldRef.current?.setTruck(isTrader && atHome ? me.user.avatar?.truck ?? '#f08a6c' : null); if (!(isTrader && atHome)) setDriving(false); }, [isTrader, atHome, me.user.avatar?.truck, village]);
  const startTrip = async (toRegionId: string) => { const t = await api<Trip>('POST', '/api/trips/start', { toRegionId }); setTab('vuon'); setTrip(t); await refresh(); };
  const finishTrip = async (res: DriveResult) => {
    if (!trip) return;
    try {
      const d = await api<TripDone>('POST', `/api/trips/${trip.tripId}/finish`, res);
      setToast(`🚚 Đã tới ${REGIONS[trip.toRegionId].name} · xăng ${fmtMoney(d.fuelCost)}${d.rescueL > 0 ? ' (có phí cứu hộ)' : ''} · phí đường ${fmtMoney(d.tollCost)}${d.fineCost ? ` · phạt quá tốc độ ${fmtMoney(d.fineCost)}` : ''}.`); if (trip.toRegionId !== me.user.homeRegionId) { setTour(trip.toRegionId); worldRef.current?.goHome(); setTourTab('buon'); setTab('trungbay'); } else { setTour(null); setKhoTab('kho'); setTab('kho'); }
    } catch (e) { setToast(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); }
    setTrip(null); reload();
  };
  const paid = (me as Me & { exportPaid?: { kg: number; specialtyId: string; payout: number }[] }).exportPaid;
  useEffect(() => { if (paid?.length) setToast(`📦 Lô xuất khẩu đã tới nơi: +${fmtMoney(paid.reduce((a, b) => a + b.payout, 0))}`); }, [paid]);
  const [tourTab, setTourTab] = useState<'buon' | 'qua'>('qua');
  const [exportRide, setExportRide] = useState<ExportSent | null>(null);
  const [acted, setActed] = useState<{ sp: Specialty; stepIndex: number; kg?: number; at: number } | null>(null);
  useEffect(() => { if (!acted) return; const t = setTimeout(() => setActed(null), 3200); return () => clearTimeout(t); }, [acted]);
  const visit = (id: number) => { setTour(null); setPlotId(id); setTab('vuon'); worldRef.current?.goHome(); };
  const startRide = async (mode: RideMode, to: string, km: number) => { await api('POST', '/api/travel', { regionId: to, mode }); setTab('vuon'); setRide({ mode, to, km }); await refresh(); };

  // Nhân vật đứng lên ô có cây đã đến giờ: tự làm bước đó (vườn mình), hoặc chăm giúp (vườn bạn).
  const onReady = useCallback(async (lotIndex: number, planting: Planting) => {
    const lot = lots[lotIndex];
    if (!lot || busy.current.has(planting.id) || (blocked.current.get(planting.id) ?? 0) > Date.now()) return;
    const sp = SPECIALTIES[planting.specialtyId];
    const steps = processOf(CROPS[sp.crop]);
    const step = steps[planting.stepIndex];
    const isLast = planting.stepIndex === steps.length - 1;
    if (!lot.plot.mine && !lot.plot.friend && !isLast) return; // người lạ chỉ phụ thu hoạch
    busy.current.add(planting.id);
    try {
      const kind = burstKind(step.name);
      if (lot.plot.mine) {
        const r = await api('POST', `/api/plantings/${planting.id}/step`, {});
        worldRef.current?.burst(lotIndex, planting.tile, kind);
        if (r.harvested) { worldRef.current?.floatText(lotIndex, planting.tile, `+${r.harvested.kg} kg ${CROPS[sp.crop].emoji}`); setToast(`Thu hoạch ${r.harvested.kg} kg ${sp.name} (${QUALITY_NAMES[r.harvested.quality as 'A']})${r.harvested.inSeason ? ' · chính vụ +15%' : ''}`); }
        else worldRef.current?.floatText(lotIndex, planting.tile, `${STEP_ICON[kind]} ${step.name}`, '#fff6dc');
        setActed({ sp, stepIndex: planting.stepIndex, kg: r.harvested?.kg, at: Date.now() });
      } else {
        const r = await api('POST', `/api/plantings/${planting.id}/help`, {});
        worldRef.current?.burst(lotIndex, planting.tile, kind);
        if (r.harvested) { worldRef.current?.floatText(lotIndex, planting.tile, `+${r.harvested.share} kg quà vườn`); setToast(`Phụ thu hoạch cho ${lot.plot.ownerName}: bạn được ${r.harvested.share} kg ${sp.name}`); }
        else worldRef.current?.floatText(lotIndex, planting.tile, `+${fmtMoney(r.reward)} · chăm giúp`);
      }
      // dữ liệu xóm cần một nhịp để tải lại: tạm chặn để không gửi lặp bước vừa làm (cây vừa thu hoạch thì đã biến mất)
      blocked.current.set(planting.id, Date.now() + 4000);
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
  const quest: [string, string] = tour ? (isTrader && me.user.truckRegionId === tour ? ['🚚', `Đi buôn ở ${REGIONS[tour].name}: ghé quầy trước cổng để thu mua và bán hàng`] : ['🧳', `Tham quan ${REGIONS[tour].name}: dạo vườn mẫu, ghé quầy trước cổng`])
    : !center ? ['⏳', 'Đang mở xóm…']
    : !mine ? ['👋', `Đang thăm vườn ${center.plot.ownerName}`]
    : center.plantings.length === 0 ? ['🌱', 'Chạy vào vườn, đứng lên một ô đất và chọn giống để trồng']
    : ready.length > 0 ? ['⭐', `Chạy tới ${ready.length} ô có dấu vàng để chăm cây`]
    : (() => {
        // nói rõ việc sắp tới là gì, của cây nào — không chỉ đếm giờ
        const nx = center.plantings.reduce((a, b) => (a.stepReadyAt <= b.stepReadyAt ? a : b));
        const nsp = SPECIALTIES[nx.specialtyId], nst = processOf(CROPS[nsp.crop])[nx.stepIndex];
        return [stepIcon(nst.name), `${fmtDuration((nextAt ?? now) - now)} nữa: ${nst.name} cho ${nsp.name}`] as [string, string];
      })();

  const ctxLot = ctx.kind === 'none' || ctx.kind === 'truck' ? null : lots[ctx.lot] ?? null;
  const ctxPlanting = ctx.kind === 'tile' && ctxLot ? ctxLot.plantings.find((p) => p.tile === ctx.tile) : undefined;

  return (
    <div className={tab === 'vuon' ? 'game' : 'game has-modal'}>
      <WorldView state={worldState} worldRef={worldRef} paused={tab !== 'vuon'} onContext={setCtx} onReady={onReady} />

      <div className="hud">
      <header className="hud-top">
        <button className="chip" onClick={() => setTab('toi')} aria-label="Hồ sơ của tôi">
          <span className="chip-avatar" aria-hidden="true">🧑‍🌾</span>
          <div className="chip-text"><strong>{me.user.displayName}</strong><small>{center ? (center.plot.wardName ? `${center.plot.wardName} · ${REGIONS[center.plot.regionId].name}` : regionLabel(center.plot.regionId)) : ''}</small></div>
        </button>
        <div className="coin" title="Tiền mặt"><Icon name="xu" size={26} />{fmtMoney(me.user.cash)}</div>
        <button className="round" aria-label="Đăng xuất" title="Đăng xuất"
          onClick={async () => { if (confirm('Đăng xuất khỏi Vườn Việt?')) { await api('POST', '/api/auth/logout', {}); await refresh(); } }}>⏻</button>
      </header>
      <div className="chips">
        {village?.weather && <span className="wchip" title={village.weather.growth < 1 ? 'Cây lớn nhanh hơn' : village.weather.growth > 1 ? 'Cây lớn chậm hơn' : 'Thời tiết thuận'}>{village.weather.icon} {village.weather.label}{village.weather.growth !== 1 && <b> {village.weather.growth < 1 ? '▲ nhanh' : '▼ chậm'}</b>}</span>}
        {village?.weather?.hazard && <span className="wchip warn" title={village.weather.hazard.note}>{village.weather.hazard.icon} {village.weather.hazard.label}</span>}
        {(village?.events ?? []).map((ev) => <span key={ev.id} className={`wchip ${ev.active ? 'hot' : ''}`}>{ev.icon} {ev.active ? `${ev.name}: +${Math.round(ev.bonus * 100)}%` : `${ev.name} sau ${fmtDuration(ev.startsAt - now)}`}</span>)}
      </div>
      <div className="quest"><span aria-hidden="true">{quest[0]}</span><p>{quest[1]}</p>{!atHome && <button onClick={goHome}><Icon name="nha" size={20} /> Về nhà</button>}</div>
      {me.plots.length > 1 && tab === 'vuon' && !tour && (
        <div className="plot-switch">
          {me.plots.map((p) => <button key={p.id} aria-pressed={p.id === plotId} onClick={() => visit(p.id)}>{p.isHome ? '🏠 ' : '🌾 '}{REGIONS[p.regionId].name}</button>)}
        </div>
      )}
        {acted && tab === 'vuon' && (() => {
          const steps = processOf(CROPS[acted.sp.crop]), st = steps[acted.stepIndex], nxt = steps[acted.stepIndex + 1];
          return (
            <div className="act-card" role="status" key={acted.at}>
              <StageArt t={steps.length > 1 ? acted.stepIndex / (steps.length - 1) : 1} kind={stepKind(st.name)} fruit={CROPS[acted.sp.crop].emoji} />
              <div>
                <small>Vừa làm xong · bước {acted.stepIndex + 1}/{steps.length}</small>
                <strong>{st.name}</strong>
                <p>{KIND_VERB[stepKind(st.name)]}.</p>
                <span className="tag">{nxt ? `Tiếp theo: ${nxt.name} · sau ${fmtDuration(stepWaitMs(acted.sp, pace))}` : `Vào kho ${acted.kg ?? ''} kg · ô đất trống, trồng vụ mới được rồi`}</span>
              </div>
            </div>
          );
        })()}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>

      {tab === 'vuon' && ctx.kind !== 'none' && !driving && (() => {
        const emptyMine = ctx.kind === 'tile' && ctxLot && !ctxPlanting && ctxLot.plot.mine;
        const plantInfo = ctx.kind === 'tile' && ctxLot && ctxPlanting ? (() => {
          const sp = SPECIALTIES[ctxPlanting.specialtyId], steps = processOf(CROPS[sp.crop]), step = steps[ctxPlanting.stepIndex];
          const wait = ctxPlanting.stepReadyAt - now, isLast = ctxPlanting.stepIndex === steps.length - 1;
          return { sp, steps, step, wait, isLast };
        })() : null;
        return (
          <>
            {plantInfo && infoOpen && (
              <CropGuide sp={plantInfo.sp} pace={pace} price={priceOf(plantInfo.sp.id)} current={tour ? undefined : ctxPlanting!.stepIndex} onClose={() => setInfoOpen(false)} />
            )}
            {emptyMine && seedOpen && (
              <div className="ctx-detail" role="dialog" aria-label="Chọn giống để trồng">
                <div className="sheet-head"><h3>Chọn giống để trồng</h3><button className="round" aria-label="Đóng" onClick={() => setSeedOpen(false)}>✕</button></div>
                {act.error && <p className="error" role="alert">{act.error}</p>}
                <div className="seeds">
                  {specialtiesOfRegion(ctxLot.plot.regionId).map((sp) => {
                    const crop = CROPS[sp.crop], cost = seedCost(sp), steps = processOf(crop).length;
                    return (
                      <button key={sp.id} className="seed" disabled={act.busy || me.user.cash < cost}
                        onClick={() => act.run(async () => { await api('POST', `/api/plots/${ctxLot.plot.id}/plant`, { tile: ctx.tile, specialtyId: sp.id }); setSeedOpen(false); worldRef.current?.burst(ctx.lot, ctx.tile, 'soil'); worldRef.current?.floatText(ctx.lot, ctx.tile, `${crop.emoji} ${processOf(crop)[0].name}`, '#fff6dc'); })}>
                        <span className="emoji">{crop.emoji}</span>
                        <strong>{sp.name}</strong>
                        <small>🧺 {crop.yieldKg} kg · ⏱️ {fmtDuration(stepWaitMs(sp, pace) * (steps - 1))}</small>
                        <small>💰 bán ~{fmtMoney(priceOf(sp.id) * crop.yieldKg)}</small>
                        {inSeason(crop.id, now) && <span className="tag">Chính vụ +15%</span>}
                        {(prices[sp.id]?.glut ?? 1) < 1 && <span className="tag warn">Nhiều người trồng −{Math.round((1 - prices[sp.id]!.glut!) * 100)}%</span>}
                        <span className="price">{fmtMoney(cost)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="ctx-bar">
              {emptyMine && !seedOpen && <button className="ctx-btn go" onClick={() => setSeedOpen(true)}>🌱 Trồng ở ô này</button>}
              {ctx.kind === 'tile' && ctxLot && !ctxPlanting && !ctxLot.plot.mine && <span className="ctx-pill">Ô đất trống</span>}
              {plantInfo && !infoOpen && (
                <button className="ctx-btn" onClick={() => setInfoOpen(true)}>
                  {CROPS[plantInfo.sp.crop].emoji} <b>{plantInfo.sp.name}</b>
                  {tour ? ' · xem cách trồng' : ` · ${ctxPlanting!.stepIndex + 1}/${plantInfo.steps.length} ${plantInfo.step.name}${plantInfo.wait > 0 ? ` · ${fmtDuration(plantInfo.wait)}` : !ctxLot!.plot.mine && plantInfo.isLast ? ' · chờ chủ vườn' : ''}`}
                </button>
              )}
              {ctx.kind === 'stall' && ctxLot && (
                <button className="ctx-btn go" onClick={() => setTab(tour ? 'trungbay' : ctxLot.plot.mine ? 'kho' : 'sap')}>{tour ? '🏪 Vào quầy trưng bày' : ctxLot.plot.mine ? '🧺 Mở kho & sạp' : `🛒 Xem sạp của ${ctxLot.plot.ownerName}`}</button>
              )}
              {ctx.kind === 'truck' && <button className="ctx-btn go" onClick={() => { worldRef.current?.enterTruck(); setDriving(true); }}>🚚 Lên xe tải</button>}
              {ctx.kind === 'empty-lot' && <button className="ctx-btn go" onClick={() => setTab('ban')}>🧑‍🤝‍🧑 Mời bạn về làm hàng xóm</button>}
            </div>
          </>
        );
      })()}

      {tab === 'vuon' && driving && (
        <div className="context drive-bar">
          <div className="truck-stats">
            <span className="context-title">🚚 {REGIONS[me.user.truckRegionId ?? me.user.homeRegionId!].name}</span>
            <div className="fuel" title="Xăng trong bình"><span aria-hidden="true">⛽</span><div className="fuel-bar"><i style={{ width: `${Math.min(100, (fuelL / TRUCK.tankL) * 100)}%` }} className={fuelL < TRUCK.tankL * 0.2 ? 'low' : ''} /></div><b>{fuelL.toFixed(0)}/{TRUCK.tankL} lít</b></div>
            <div className="etc" title="Số dư thu phí không dừng"><span aria-hidden="true">🛣️</span><b>ETC {fmtMoney(me.user.etc ?? 0)}</b></div>
          </div>
          {act.error && <p className="error" role="alert">{act.error}</p>}
          <div className="truck-actions">
            <button className="grow" disabled={act.busy || fuelL >= TRUCK.tankL - 0.5} onClick={() => act.run(() => api('POST', '/api/truck/refuel', { liters: TRUCK.tankL }))}>⛽ Đổ đầy · {fmtMoney(Math.round(Math.max(0, TRUCK.tankL - fuelL) * TRUCK.fuelPrice))}</button>
            <button className="grow" disabled={act.busy || me.user.cash < 200_000} onClick={() => act.run(() => api('POST', '/api/truck/etc', { amount: 200_000 }))}>🛣️ Nạp ETC 200k</button>
            <button className="grow" onClick={() => { worldRef.current?.exitTruck(); setDriving(false); }}>Xuống xe</button>
            <button className="primary grow" onClick={() => { setTravelTab('di'); setTab('bando'); }}>Đi vùng khác</button>
          </div>
        </div>
      )}
      {respin && <div className="overlay"><RoleWheel regionName={REGIONS[me.user.homeRegionId!].name} onDone={() => { setRespin(false); reload(); }} /></div>}
      {exportRide && <ExportRide mode={exportRide.mode} fromName={REGIONS[me.user.homeRegionId!].name} marketName={EXPORT_MARKETS[exportRide.market].name} specialtyName={SPECIALTIES[exportRide.specialtyId].name} emoji={CROPS[SPECIALTIES[exportRide.specialtyId].crop].emoji} kg={exportRide.kg} onDone={() => { setExportRide(null); setKhoTab('xuat'); setTab('kho'); }} />}
      {sightTrip && <TravelRide mode="taxi" fromRegionId={tour ?? me.user.homeRegionId!} toRegionId={tour ?? me.user.homeRegionId!} toName={sightTrip.sight.name} fare={sightTrip.taxiFare} km={sightTrip.km} seconds={Math.max(14, sightTrip.seconds)}
        sideHint={sightTrip.sight.kind === 'dao' || sightTrip.sight.kind === 'chua' ? 'bien' : sightTrip.sight.kind === 'cau' ? 'song' : sightTrip.sight.kind === 'pho_co' ? 'pho' : 'nui'}
        onFinish={() => { setSightWalk(sightTrip); setSightTrip(null); }} />}
      {sightWalk && <SightWalk sightId={sightWalk.sight.id} seen={sightWalk.sight.stopsSeen} onExit={(r) => {
        const s = sightWalk; setSightWalk(null);
        void api('POST', `/api/sights/${s.sight.id}/finish`, { stops: r.stops }).then((d) => {
          setToast(d.firstTime ? `🎉 Đã tham quan trọn ${s.sight.name}: thưởng ${fmtMoney(d.reward)} · ${d.sightsDone}/${d.sightsTotal} địa danh của ${s.sight.province}` : `📸 ${s.sight.name}: đã xem ${d.stopsSeen.length}/${s.sight.stops.length} điểm dừng`);
          void refresh();
        }).catch(() => undefined);
        setTravelTab(r.toMarket ? 'sieuthi' : 'thamquan'); setTab('bando');
      }} />}
      {ride && <TravelRide mode={ride.mode} fromRegionId={me.user.homeRegionId!} toRegionId={ride.to} km={ride.km} seconds={TRAVEL_MODES[ride.mode].seconds} onFinish={() => { setTour(ride.to); setRide(null); worldRef.current?.goHome(); }} />}
      {trip && <DriveGame fromRegionId={trip.fromRegionId} toRegionId={trip.toRegionId} plan={trip.plan} fuelL={trip.fuelL} truck={trip.truck} etc={trip.etc} cash={trip.cash} truckColor={me.user.avatar?.truck ?? '#f08a6c'} onFinish={finishTrip} onCancel={() => { setTrip(null); setToast('Đã huỷ chuyến. Xe vẫn đỗ ở chỗ cũ.'); }} />}

      {tab !== 'vuon' && (
        <div className="modal" role="dialog" aria-label={TAB_TITLES[tab]}>
          <div className="modal-head"><h2>{TAB_TITLES[tab]}</h2><button className="round" aria-label="Đóng" onClick={() => setTab('vuon')}>✕</button></div>
          <div className="modal-body">
            {tab === 'kho' && (
              <>
                <div className="tabs">
                  <button aria-selected={khoTab === 'kho'} onClick={() => setKhoTab('kho')}>Kho & Sạp</button>
                  <button aria-selected={khoTab === 'don'} onClick={() => setKhoTab('don')}>Đơn hàng</button>
                  <button aria-selected={khoTab === 'xuong'} onClick={() => setKhoTab('xuong')}>Xưởng</button>
                  <button aria-selected={khoTab === 'xuat'} onClick={() => setKhoTab('xuat')}>Xuất khẩu</button>
                  {isTrader && atHome && <button aria-selected={khoTab === 'mua'} onClick={() => setKhoTab('mua')}>Thu mua</button>}
                </div>
                {khoTab === 'kho' && <Stock me={me} prices={prices} marketDay={!!village?.events?.some((e) => e.id === 'cho_phien' && e.active)} floating={!!village?.events?.some((e) => e.id === 'cho_noi' && e.active) && atHome} friends={friendList} refresh={reload} />}
                {khoTab === 'don' && <OrdersPanel me={me} onChanged={reload} />}
                {khoTab === 'xuat' && <ExportPanel me={me} refresh={reload} onSent={(x) => { setTab('vuon'); setExportRide(x); }} />}
                {khoTab === 'mua' && <TradePanel me={me} regionId={me.user.homeRegionId!} refresh={reload} openStock={() => setKhoTab('kho')} />}
                {khoTab === 'xuong' && (me.user.role === 'xuong' ? <WorkshopPanel me={me} priceOf={priceOf} onChanged={reload} /> : <p className="hint">Chỉ Chủ xưởng mới chế biến được. Bạn là {ROLE_INFO[me.user.role!].name}: hãy bán nông sản tươi cho chủ xưởng qua sạp, hoặc chờ mùa sau quay lại vai trò.</p>)}
              </>
            )}
            {tab === 'toi' && <ProfilePanel onRespin={() => { setTab('vuon'); setRespin(true); }} me={me} homePlotId={homePlotId} wardProvince={(atHome ? center?.plot.wardProvince : null) ?? null} wardName={me.plots.find((p) => p.isHome)?.wardName ?? null} onChanged={reload} />}
            {tab === 'cho' && (
              <>
                <div className="tabs"><button aria-selected={marketTab === 'cho'} onClick={() => setMarketTab('cho')}>Hàng đang bán</button><button aria-selected={marketTab === 'gia'} onClick={() => setMarketTab('gia')}>Bảng giá</button></div>
                {marketTab === 'cho' ? <Market priceOf={priceOf} refresh={reload} /> : <PriceBoard prices={prices} />}
              </>
            )}
            {tab === 'ban' && (
              <>
                <div className="tabs">
                  <button aria-selected={xomTab === 'ban'} onClick={() => setXomTab('ban')}>Bạn bè</button>
                  <button aria-selected={xomTab === 'htx'} onClick={() => setXomTab('htx')}>Hợp tác xã</button>
                  <button aria-selected={xomTab === 'qua'} onClick={() => { setXomTab('qua'); setUnseen(0); }}>Quà tặng{unseen > 0 ? ` (${unseen})` : ''}</button>
                </div>
                {xomTab === 'ban' && <FriendsPanel onChanged={() => { reload(); void loadSocial(); }} visit={visit} />}
                {xomTab === 'htx' && <CoopPanel me={me} onChanged={reload} />}
                {xomTab === 'qua' && <GiftsPanel />}
              </>
            )}
            {tab === 'bando' && (
              <>
                <div className="tabs"><button aria-selected={travelTab === 'di'} onClick={() => setTravelTab('di')}>Bản đồ vùng trồng</button><button aria-selected={travelTab === 'thamquan'} onClick={() => setTravelTab('thamquan')}>Tham quan</button><button aria-selected={travelTab === 'sieuthi'} onClick={() => setTravelTab('sieuthi')}>Siêu thị</button><button aria-selected={travelTab === 'so'} onClick={() => setTravelTab('so')}>Sổ tem</button></div>
                {travelTab === 'di' && <TravelPanel me={me} startRide={startRide} startTrip={isTrader ? startTrip : undefined} touring={tour} />}
                {travelTab === 'thamquan' && <SightsPanel me={me} refresh={reload} onGo={(t) => { setTab('vuon'); setSightTrip(t); }} />}
                {travelTab === 'sieuthi' && <SupermarketPanel me={me} province={REGIONS[tour ?? me.user.homeRegionId!].province} refresh={reload} />}
                {travelTab === 'so' && <AlbumPanel />}
              </>
            )}
            {tab === 'trungbay' && tour && (
              <>
                <div className="tabs"><button aria-selected={tourTab === 'buon'} onClick={() => setTourTab('buon')}>Buôn bán</button><button aria-selected={tourTab === 'qua'} onClick={() => setTourTab('qua')}>Quà, tem, mua đất</button></div>
                {tourTab === 'buon' ? <TradePanel me={me} regionId={tour} refresh={reload} openStock={() => { setKhoTab('kho'); setTab('kho'); }} /> : <ShowcasePanel me={me} regionId={tour} priceOf={priceOf} refresh={reload} visit={visit} />}
              </>
            )}
            {tab === 'trangtri' && <CustomizePanel me={me} home={atHome ? center ?? null : null} worldRef={worldRef} atHome={atHome} onChanged={reload} />}
            {tab === 'sap' && ctxLot && (ctxLot.stall.length ? <StallList listings={ctxLot.stall} canBuy onChanged={reload} /> : <p className="hint">{ctxLot.plot.ownerName} chưa bày món nào.</p>)}
          </div>
        </div>
      )}

      <nav className="dock">
        {TABS.map(([id, icon, label]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(tab === id ? 'vuon' : id)}><Icon name={icon} size={30} />{label}{id === 'ban' && unseen > 0 && <b className="badge">{unseen}</b>}</button>
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
function Stock({ me, prices, marketDay, floating, friends, refresh }: { me: Me; prices: Prices; marketDay: boolean; floating: boolean; friends: Friends['friends']; refresh: () => void }) {
  const [mine, setMine] = useState<Listing[]>([]);
  const load = useCallback(async () => {
    setMine((await api('GET', '/api/market?mine=1')).listings);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const done = useCallback(() => { void load(); refresh(); }, [load, refresh]);
  return (
    <div>
      <h3>Kho nông sản</h3>
      {me.inventory.length === 0 && <p className="hint">Kho đang trống. Thu hoạch xong, nông sản sẽ nằm ở đây.</p>}
      {me.inventory.map((item) => <StockRow key={item.specialtyId + item.quality} item={item} me={me} prices={prices} marketDay={marketDay} floating={floating} friends={friends} onDone={done} />)}
      <h3>Sạp trước nhà</h3>
      {mine.length === 0 ? <p className="hint">Bạn chưa bày món nào. Bày hàng lên sạp để người chơi khác mua.</p> : <StallList listings={mine} canCancel onChanged={done} />}
    </div>
  );
}

function StockRow({ item, me, prices, marketDay, floating, friends, onDone }: { item: Me['inventory'][number]; me: Me; prices: Prices; marketDay: boolean; floating: boolean; friends: Friends['friends']; onDone: () => void }) {
  const sp = SPECIALTIES[item.specialtyId];
  const refPrice = prices[sp.id]?.price ?? sp.refPrice;
  const glut = prices[sp.id]?.glut ?? 1;
  const [kg, setKg] = useState(item.kg);
  const [price, setPrice] = useState(refPrice);
  const [friendId, setFriendId] = useState('');
  useEffect(() => { setKg(item.kg); }, [item.kg]);
  const act = useAction(onDone);
  const local = sp.regionId === ((me.user.role === 'thuong_lai' && me.user.truckRegionId) || me.user.homeRegionId);
  const trader = me.user.role === 'thuong_lai', coop = !!me.user.coopId;
  const marketRegion = (trader && me.user.truckRegionId) || me.user.homeRegionId!;
  const city = trader && me.user.homeKind === 'rooftop' && marketRegion === me.user.homeRegionId;
  const npc = trader ? npcPrice(refPrice, item.quality, sp.regionId, marketRegion, { glut, marketDay, coop, city, floating })
    : Math.round((refPrice * DUMP_RATIO * QUALITY_MULT[item.quality]) / 100) * 100;
  const amount = Math.min(Math.max(1, Math.floor(kg) || 1), item.kg);
  const notes = [local ? 'giá tại vườn' : 'hàng phương xa', glut < 1 ? `được mùa −${Math.round((1 - glut) * 100)}%` : '', marketDay ? 'chợ phiên +10%' : '', floating ? 'chợ nổi +15%' : '', coop ? 'hợp tác xã +5%' : '', city && !local ? 'thương lái phố +10%' : ''].filter(Boolean).join(' · ');
  return (
    <div className="row">
      <div className="row-head">
        <span className="emoji">{CROPS[sp.crop].emoji}</span>
        <div><strong>{sp.name}</strong> <span className="tag">{QUALITY_NAMES[item.quality]}</span><br /><small>Còn {item.kg} kg · giá tham chiếu {fmtMoney(refPrice)}/kg</small></div>
      </div>
      <div className="row-actions">
        <label>Số kg<input type="number" min={1} max={item.kg} value={kg} onChange={(e) => setKg(Number(e.target.value))} /></label>
        <button disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/sell/npc', { specialtyId: sp.id, quality: item.quality, kg: amount }))}>
          {trader ? `Bán ${fmtMoney(npc)}/kg` : `Bán tháo ${fmtMoney(npc)}/kg`}
        </button>
        <label>Giá rao (đ/kg)<input type="number" min={1} step={500} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
        <button disabled={act.busy} onClick={() => act.run(() => api('POST', '/api/market/listings', { specialtyId: sp.id, quality: item.quality, kg: amount, price: Math.round(price) }))}>
          Bày lên sạp
        </button>
        {friends.length > 0 && (
          <>
            <label>Tặng bạn<select value={friendId} onChange={(e) => setFriendId(e.target.value)}><option value="">— Chọn —</option>{friends.map((f) => <option key={f.userId} value={f.userId}>{f.displayName}</option>)}</select></label>
            <button disabled={act.busy || !friendId} onClick={() => act.run(async () => { await api('POST', '/api/gifts', { toUserId: Number(friendId), specialtyId: sp.id, quality: item.quality, kg: Math.min(amount, GIFT_MAX_KG) }); alert('Đã gửi quà!'); })}>
              🎁 Tặng {Math.min(amount, GIFT_MAX_KG)} kg
            </button>
          </>
        )}
      </div>
      {trader ? <small className="muted">Bán tại {REGIONS[marketRegion].name} cho <NpcBadge id={npcOf('thuong_lai').id} /> · {notes}.</small>
        : <small className="muted">Chỉ Thương lái bán được cho doanh nghiệp với giá đầy đủ. Bán tháo chỉ được {Math.round(DUMP_RATIO * 100)}% giá tham chiếu; bày lên sạp cho thương lái và chủ xưởng mua sẽ được giá hơn.</small>}
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
          <thead><tr><th>Đặc sản</th><th>Vùng trồng</th><th className="num">Giá (đ/kg)</th><th className="num">Thay đổi</th><th className="num">Nguồn cung</th><th>Nguồn giá</th></tr></thead>
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
                  <td className={`num ${p?.glut !== undefined && p.glut < 1 ? 'down' : ''}`}>{p?.glut !== undefined && p.glut < 1 ? `Được mùa −${Math.round((1 - p.glut) * 100)}%` : '—'}</td>
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
