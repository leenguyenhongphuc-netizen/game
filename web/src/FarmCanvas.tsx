import { useEffect, useRef } from 'react';
import { CROPS, SPECIALTIES, processOf } from '../../shared/catalog.ts';
import type { Kind } from '../../shared/catalog.ts';
import { PLOT_COLS, PLOT_ROWS } from '../../shared/rules.ts';
import type { Listing, Planting } from './api.ts';

const W = 720, H = 470, TW = 92, TH = 46, OX = 372, OY = 150;

function center(tile: number) {
  const c = tile % PLOT_COLS, r = Math.floor(tile / PLOT_COLS);
  return { x: OX + ((c - r) * TW) / 2, y: OY + ((c + r) * TH) / 2 };
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - w / 2, y);
  ctx.closePath();
}
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Kind, progress: number, emoji: string, ripe: boolean) {
  // Luống đất
  ctx.fillStyle = '#7a4f33'; diamond(ctx, x, y, TW * 0.72, TH * 0.72); ctx.fill();
  ctx.fillStyle = '#8f5f3f'; diamond(ctx, x, y - 2, TW * 0.6, TH * 0.58); ctx.fill();
  const g1 = '#3f8f4a', g2 = '#2f6b3a', g3 = '#63b06a';
  if (progress < 0.3) {
    for (const dx of [-12, 0, 12]) { blob(ctx, x + dx - 2, y - 5, 3.2, g3); blob(ctx, x + dx + 2, y - 6, 3.2, g1); }
    return;
  }
  const size = 0.55 + progress * 0.45;
  if (kind === 'trai' || kind === 'cn') {
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 3, y - 26 * size, 6, 26 * size);
    blob(ctx, x - 10 * size, y - 30 * size, 13 * size, g2);
    blob(ctx, x + 10 * size, y - 31 * size, 13 * size, g1);
    blob(ctx, x, y - 41 * size, 15 * size, g3);
  } else if (kind === 'leo') {
    ctx.fillStyle = '#b9b3a6'; ctx.fillRect(x - 3, y - 38 * size, 6, 38 * size);
    ctx.strokeStyle = g1; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const a of [-1, -0.4, 0.4, 1]) {
      ctx.beginPath(); ctx.moveTo(x, y - 38 * size);
      ctx.quadraticCurveTo(x + a * 20 * size, y - 46 * size, x + a * 24 * size, y - 20 * size); ctx.stroke();
    }
  } else {
    for (const [dx, dy] of [[-16, 0], [0, -6], [16, 0], [-8, 6], [8, 6]]) {
      blob(ctx, x + dx, y + dy - 7 * size, 7 * size, g1); blob(ctx, x + dx + 3, y + dy - 11 * size, 5 * size, g3);
    }
  }
  if (ripe) {
    ctx.font = '22px serif'; ctx.textAlign = 'center';
    ctx.fillText(emoji, x, y - (kind === 'trai' || kind === 'cn' || kind === 'leo' ? 30 * size : 12));
  }
}

function drawHouse(ctx: CanvasRenderingContext2D) {
  const x = 150, y = 96;
  ctx.fillStyle = '#e9d9b8'; ctx.fillRect(x - 46, y - 34, 92, 50);
  ctx.fillStyle = '#b5523b'; ctx.beginPath(); ctx.moveTo(x - 58, y - 32); ctx.lineTo(x, y - 70); ctx.lineTo(x + 58, y - 32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 10, y - 14, 20, 30);
  ctx.fillStyle = '#9ad0e6'; ctx.fillRect(x - 36, y - 20, 16, 14); ctx.fillRect(x + 20, y - 20, 16, 14);
}
function drawStall(ctx: CanvasRenderingContext2D, stall: Listing[]) {
  const x = 590, y = 108;
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(x - 54, y - 6, 108, 26);
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 54, y - 50, 5, 46); ctx.fillRect(x + 49, y - 50, 5, 46);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f6f1e3' : '#d9622b'; ctx.fillRect(x - 60 + i * 20, y - 62, 20, 16); }
  ctx.font = '20px serif'; ctx.textAlign = 'center';
  const shown = [...new Set(stall.map((l) => CROPS[SPECIALTIES[l.specialtyId].crop].emoji))].slice(0, 4);
  shown.forEach((e, i) => ctx.fillText(e, x - 36 + i * 24, y - 10));
  ctx.font = '600 12px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = '#f6f1e3';
  ctx.fillText(stall.length ? `Sạp: ${stall.length} món` : 'Sạp trống', x, y + 12);
}

export function FarmCanvas(props: {
  plantings: Planting[]; stall: Listing[]; selected: number | null; clockOffset: number; onSelect: (tile: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    const draw = () => {
      const { plantings, stall, selected, clockOffset } = latest.current;
      const now = Date.now() + clockOffset;
      frame++;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#cfe9d2'); sky.addColorStop(1, '#a9d39a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      drawHouse(ctx); drawStall(ctx, stall);
      // Lối đi và nền vườn
      ctx.fillStyle = '#d8c49a'; diamond(ctx, OX + ((PLOT_COLS - PLOT_ROWS) * TW) / 4, OY + ((PLOT_COLS + PLOT_ROWS - 2) * TH) / 4, (PLOT_COLS + PLOT_ROWS) * TW / 2 + 26, (PLOT_COLS + PLOT_ROWS) * TH / 2 + 14); ctx.fill();
      const byTile = new Map(plantings.map((p) => [p.tile, p]));
      for (let t = 0; t < PLOT_COLS * PLOT_ROWS; t++) {
        const { x, y } = center(t);
        ctx.fillStyle = (t + Math.floor(t / PLOT_COLS)) % 2 ? '#7fbf6b' : '#8bc777';
        diamond(ctx, x, y, TW - 4, TH - 2); ctx.fill();
        if (selected === t) { ctx.strokeStyle = '#d9622b'; ctx.lineWidth = 3; diamond(ctx, x, y, TW - 6, TH - 4); ctx.stroke(); }
        const p = byTile.get(t);
        if (!p) continue;
        const sp = SPECIALTIES[p.specialtyId];
        const crop = CROPS[sp.crop];
        const last = processOf(crop).length - 1;
        const ready = now >= p.stepReadyAt;
        drawPlant(ctx, x, y, crop.kind, p.stepIndex / last, crop.emoji, p.stepIndex === last);
        if (ready) {
          const by = y - 44 + (frame % 2 ? 0 : 3);
          ctx.fillStyle = p.stepIndex === last ? '#d9622b' : '#2f6b3a';
          ctx.beginPath(); ctx.arc(x + 22, by, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 14px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('!', x + 22, by + 5);
        }
      }
    };
    draw();
    const timer = setInterval(draw, 500);
    return () => clearInterval(timer);
  }, []);

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) * W) / rect.width - OX;
    const dy = ((e.clientY - rect.top) * H) / rect.height - OY;
    const c = Math.round((dx / (TW / 2) + dy / (TH / 2)) / 2);
    const r = Math.round((dy / (TH / 2) - dx / (TW / 2)) / 2);
    if (c >= 0 && c < PLOT_COLS && r >= 0 && r < PLOT_ROWS) props.onSelect(r * PLOT_COLS + c);
  }

  return <canvas ref={ref} className="farm-canvas" onClick={onClick} role="img" aria-label="Mảnh vườn của bạn, bấm vào ô đất để chọn" />;
}
