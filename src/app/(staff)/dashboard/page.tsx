import Link from 'next/link';
import { supabaseServer, requireUser } from '@/lib/supabase/server';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/status';
import DailyChart from './DailyChart';

type Summary = {
  from: string; to: string; days: number;
  kpi: Record<'flyers' | 'flyers_prev' | 'hours' | 'walks' | 'active_walkers' | 'suburbs_walked' | 'completed' | 'open'
    | 'stock_total' | 'on_hand_total' | 'checks' | 'checks_failed', number>;
  map: Record<string, { suburbs: number; dwellings: number }>;
  daily: { day: string; flyers: number }[];
  companies: { name: string; color: string; flyers: number; suburbs: number; stock: number }[];
  walkers: { name: string; flyers: number; hours: number; per_hour: number | null; walks: number; last_walk: string }[];
};

const PERIODS = [7, 30, 90] as const;
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString();

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireUser(true);
  const { days: daysParam } = await searchParams;
  const days = PERIODS.find((p) => String(p) === daysParam) ?? 30;
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('dashboard_summary', { p_days: days });
  if (error || !data) return <div className="p-4 text-red-600">Dashboard error: {error?.message}</div>;
  const s = data as Summary;
  const k = s.kpi;
  const perHour = k.hours > 0 ? Math.round(k.flyers / k.hours) : null;
  const delta = k.flyers_prev > 0 ? Math.round(((k.flyers - k.flyers_prev) / k.flyers_prev) * 100) : null;
  const totalSuburbs = Object.values(s.map).reduce((a, m) => a + m.suburbs, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={`/dashboard?days=${p}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${p === days ? 'bg-slate-900 text-white' : 'border border-slate-300 hover:bg-slate-100'}`}>
              {p} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Flyers delivered" value={n(k.flyers)}
          sub={delta == null ? `previous ${days} days: ${n(k.flyers_prev)}` : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous ${days} days`} />
        <Tile label="Hours walked" value={n(Number(k.hours))} sub={`${n(k.walks)} walks · ${n(k.active_walkers)} walkers`} />
        <Tile label="Flyers per hour" value={perHour == null ? '—' : n(perHour)} sub="team average" />
        <Tile label="Suburbs walked" value={n(k.suburbs_walked)} sub={`${n(k.completed)} completed · ${n(k.open)} open`} />
        <Tile label="In warehouse" value={n(k.stock_total)} sub="all companies" />
        <Tile label="On hand with walkers" value={n(k.on_hand_total)} sub="issued, not yet delivered" />
        <Tile label="Checks" value={n(k.checks)}
          sub={k.checks_failed ? `${n(k.checks_failed)} failed` : 'no failures'} warn={k.checks_failed > 0} />
        <Tile label="Suburbs available now"
          value={n(s.map.available?.suburbs)} sub={`of ${n(totalSuburbs)} · ${n(s.map.available?.dwellings)} dwellings`} />
      </div>

      <DailyChart days={s.daily} />

      <div className="card">
        <div className="label mb-2">Suburbs by status (now)</div>
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded">
          {Object.keys(STATUS_COLORS).filter((st) => s.map[st]?.suburbs).map((st) => (
            <div key={st} title={`${STATUS_LABELS[st]}: ${s.map[st].suburbs}`}
              style={{ flexGrow: s.map[st].suburbs, background: STATUS_COLORS[st] }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {Object.keys(STATUS_COLORS).map((st) => (
            <span key={st} className="flex items-center gap-1">
              <i className="inline-block h-3 w-3 rounded-sm" style={{ background: STATUS_COLORS[st] }} />
              {STATUS_LABELS[st]}: <b className="text-slate-900">{n(s.map[st]?.suburbs)}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Table title="By company" head={['Company', 'Delivered', 'Suburbs', 'In stock']}
          empty="No companies."
          rows={s.companies.map((c) => [
            <span key="n" className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.name}</span>,
            n(c.flyers), n(c.suburbs), n(c.stock),
          ])} />
        <Table title="By walker" head={['Walker', 'Delivered', 'Hours', 'Per hour', 'Last walk']}
          empty="No walks in this period."
          rows={s.walkers.map((w) => [w.name, n(w.flyers), n(Number(w.hours)), w.per_hour == null ? '—' : n(w.per_hour), w.last_walk])} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className={`text-xs ${warn ? 'font-medium text-red-600' : 'text-slate-500'}`}>{sub}</div>}
    </div>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="card overflow-x-auto p-0">
      <div className="label px-3 pt-3">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-3 py-3 text-slate-400">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
