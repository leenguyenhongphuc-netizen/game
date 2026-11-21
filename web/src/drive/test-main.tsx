// Trang thử riêng cho màn lái: /drive-test.html?from=dt_caibe&to=qng_lyson&seconds=30&boat=1
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DriveGame } from './DriveGame.tsx';

declare global { interface Window { __finishCount?: number } }

function Test() {
  const q = new URLSearchParams(location.search);
  const [state, setState] = useState<'run' | 'done' | 'cancel'>('run');
  if (state !== 'run') return <h1 id="result" style={{ fontFamily: 'sans-serif', padding: 24 }}>{state === 'done' ? 'XONG' : 'ĐÃ HUỶ'}</h1>;
  return (
    <DriveGame
      fromRegionId={q.get('from') ?? 'dt_caibe'} toRegionId={q.get('to') ?? 'qng_lyson'}
      km={Number(q.get('km') ?? 640)} seconds={Number(q.get('seconds') ?? 30)} needsBoat={q.get('boat') === '1'} truckColor={q.get('color') ?? '#f08a6c'}
      onFinish={() => { window.__finishCount = (window.__finishCount ?? 0) + 1; document.title = 'XONG'; setState('done'); }}
      onCancel={() => { document.title = 'ĐÃ HUỶ'; setState('cancel'); }}
    />
  );
}
createRoot(document.getElementById('root')!).render(<Test />);
