import type { MarketDay, Quality, Weather } from '../../shared/rules.ts';

export type PlotKind = 'ground' | 'rooftop';

export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'loi', data?.message ?? 'Không kết nối được máy chủ.');
  return data as T;
}

export interface Me {
  user: { id: number; username: string; displayName: string; cash: number; homeRegionId: string | null; homeKind?: PlotKind; coopId?: number | null };
  plots: { id: number; regionId: string; isHome: boolean; kind?: PlotKind }[];
  inventory: { specialtyId: string; quality: Quality; kg: number }[];
  config: { timeScale: number; now: number };
}
export interface Planting { id: number; tile: number; specialtyId: string; stepIndex: number; stepReadyAt: number; lateCount: number }
export interface Listing { id: number; specialtyId: string; quality: Quality; kg: number; price: number; sellerId?: number; sellerName?: string; sellerRegionId?: string }
export interface PlotView {
  plot: { id: number; regionId: string; isHome: boolean; ownerName: string; mine: boolean };
  plantings: Planting[]; stall: Listing[]; now: number;
}
export type Prices = Record<string, { price: number; prev: number | null; source: string; observedAt: number; glut?: number }>;

export interface LotView {
  plot: { id: number; regionId: string; isHome: boolean; kind?: PlotKind; ownerId: number; ownerName: string; mine: boolean; friend: boolean };
  plantings: Planting[]; stall: Listing[];
}
export interface Village { center: LotView; neighbors: LotView[]; now: number; weather?: Weather; marketDay?: MarketDay }
export interface Person { userId: number; username: string; displayName: string; homeRegionId?: string | null; plotId?: number | null }
export interface Friends { friends: Person[]; incoming: Person[]; outgoing: Person[] }
export interface CoopSummary { id: number; name: string; regionId: string; ownerName: string; members: number }
export interface Coop { id: number; name: string; regionId: string; ownerId: number; kgWeek: number; members: { userId: number; displayName: string; kgWeek: number }[] }
export interface GiftInbox { inbox: { id: number; fromName: string; specialtyId: string; quality: Quality; kg: number; message: string | null; createdAt: number; seen: boolean }[]; unseen: number }
export interface Collection { specialties: string[]; regionsRewarded: string[] }
