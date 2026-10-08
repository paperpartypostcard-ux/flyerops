'use client';
import { useState } from 'react';

type Day = { day: string; flyers: number };
const fmtDay = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

/** Single-series daily bars: one hue, rounded data-ends, 2px gaps, hover tooltip. */
export default function DailyChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...days.map((d) => d.flyers));
  const top = niceCeil(max);
  const h = hover != null ? days[hover] : null;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <div className="label">Flyers delivered per day</div>
        <div className="h-5 text-xs text-slate-600">
          {h ? <><b className="text-slate-900">{h.flyers.toLocaleString()}</b> on {fmtDay(h.day)}</> : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex h-40 flex-col justify-between text-right text-[10px] text-slate-400">
          <span>{top.toLocaleString()}</span><span>{(top / 2).toLocaleString()}</span><span>0</span>
        </div>
        <div className="relative h-40 flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-slate-100" />
          <div className="absolute inset-x-0 top-1/2 border-t border-slate-100" />
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-slate-300" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}
                title={`${fmtDay(d.day)}: ${d.flyers.toLocaleString()} flyers`}>
                <div className="w-full rounded-t-[4px]"
                  style={{
                    height: d.flyers ? `${Math.max(2, (d.flyers / top) * 100)}%` : 0,
                    background: hover === i ? '#1d4ed8' : '#3b82f6',
                  }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-8 mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{days[0] && fmtDay(days[0].day)}</span>
        <span>{days.at(-1) && fmtDay(days.at(-1)!.day)}</span>
      </div>
    </div>
  );
}

function niceCeil(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
