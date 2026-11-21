import type { Quality } from '../../shared/rules.ts';

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
  user: { id: number; username: string; displayName: string; cash: number; homeRegionId: string | null };
  plots: { id: number; regionId: string; isHome: boolean }[];
  inventory: { specialtyId: string; quality: Quality; kg: number }[];
  config: { timeScale: number; now: number };
}
export interface Planting { id: number; tile: number; specialtyId: string; stepIndex: number; stepReadyAt: number; lateCount: number }
export interface Listing { id: number; specialtyId: string; quality: Quality; kg: number; price: number; sellerId?: number; sellerName?: string; sellerRegionId?: string }
export interface PlotView {
  plot: { id: number; regionId: string; isHome: boolean; ownerName: string; mine: boolean };
  plantings: Planting[]; stall: Listing[]; now: number;
}
export type Prices = Record<string, { price: number; prev: number | null; source: string; observedAt: number }>;

export interface LotView {
  plot: { id: number; regionId: string; isHome: boolean; ownerId: number; ownerName: string; mine: boolean; friend: boolean };
  plantings: Planting[]; stall: Listing[];
}
export interface Village { center: LotView; neighbors: LotView[]; now: number }
export interface Person { userId: number; username: string; displayName: string; homeRegionId?: string | null; plotId?: number | null }
export interface Friends { friends: Person[]; incoming: Person[]; outgoing: Person[] }
