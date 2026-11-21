import { useCallback, useState } from 'react';
import { REGIONS } from '../../shared/catalog.ts';

export const regionLabel = (id: string) => {
  const r = REGIONS[id];
  return `${r.name}, ${r.province}`;
};
export function fmtDuration(ms: number): string {
  if (ms <= 0) return 'ngay bây giờ';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút`;
  return `${s} giây`;
}
export function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); onDone?.(); } catch (e) { setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); } finally { setBusy(false); }
  }, [onDone]);
  return { busy, error, run, setError };
}
