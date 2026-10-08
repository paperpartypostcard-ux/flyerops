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
const money = (v: number) => v.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string; w?: string }> }) {
  await requireUser(true);
  const { days: daysParam, w: walkerParam } = await searchParams;
  const days = PERIODS.find((p) => String(p) === daysParam) ?? 30;
  const sb = await supabaseServer();
  const [{ data, error }, { data: settings }, { data: walkers }, { data: recs }] = await Promise.all([
    sb.rpc('dashboard_summary', { p_days: days }),
    sb.from('app_settings').select('rate_per_1000').single(),
    sb.from('profiles').select('id, full_name, home:suburbs(name)').eq('role', 'walker').eq('status', 'active').order('full_name'),
    sb.rpc('recommend_suburbs', { p_walker: walkerParam || null, p_limit: 10 }),
  ]);
  if (error || !data) return <div className="p-4 text-red-600">Dashboard error: {error?.message}</div>;
  const rate = Number(settings?.rate_per_1000 ?? 125);
  const weeks = days / 7, months = days / 30.44;
  const recWalker = (walkers ?? []).find((w) => w.id === walkerParam);
  type Rec = { id: number; name: string; dwellings: number | null; last_drop: string | null; distance_km: number | null };
  const s = data as Summary;
  const k = s.kpi;
  const perHour = k.hours > 0 ? Math.round(k.flyers / k.hours) : null;
  const delta = k.flyers_prev > 0 ? Math.round(((k.flyers - k.flyers_prev) / k.flyers_prev) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Dashboard</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={`/dashboard?days=${p}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${p === days ? 'bg-ink text-white' : 'border border-line bg-white hover:bg-paper'}`}>
              {p} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Flyers delivered" value={n(k.flyers)}
          sub={delta == null ? `previous ${days} days: ${n(k.flyers_prev)}` : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous ${days} days`} />
        <Tile label="Avg flyers / week" value={n(Math.round(k.flyers / weeks))} sub={`≈ ${n(Math.round(k.flyers / months))} / month`} />
        <Tile label="Avg hours / week" value={n(Math.round((Number(k.hours) / weeks) * 10) / 10)}
          sub={`≈ ${n(Math.round(Number(k.hours) / months))} / month · ${n(k.walks)} walks`} />
        <Tile label="Flyers per hour" value={perHour == null ? '—' : n(perHour)} sub={`team average · ${n(k.active_walkers)} walkers`} />
        <Tile label="Walker pay (period)" value={money(Math.round(k.flyers * rate) / 1000)} sub={`at $${rate} per 1000`} />
        <Tile label="Suburbs walked" value={n(k.suburbs_walked)} sub={`${n(k.completed)} completed · ${n(k.open)} open`} />
        <Tile label="Flyers in stock" value={n(k.stock_total)} sub={`+ ${n(k.on_hand_total)} on hand with walkers`} />
        <Tile label="Checks" value={n(k.checks)}
          sub={k.checks_failed ? `${n(k.checks_failed)} failed` : 'no failures'} warn={k.checks_failed > 0} />
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
        <Table title="By company" head={['Company', 'Delivered', 'Per week', 'Per month', 'Suburbs', 'In stock']}
          empty="No companies."
          rows={s.companies.map((c) => [
            <span key="n" className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.name}</span>,
            n(c.flyers), n(Math.round(c.flyers / weeks)), n(Math.round(c.flyers / months)), n(c.suburbs), n(c.stock),
          ])} />
        <Table title="By walker" head={['Walker', 'Delivered', 'Hours', 'Per hour', 'Last walk']}
          empty="No walks in this period."
          rows={s.walkers.map((w) => [w.name, n(w.flyers), n(Number(w.hours)), w.per_hour == null ? '—' : n(w.per_hour), w.last_walk])} />
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
          <div className="label">Next suburbs to plan · available now, never walked or longest ago, more dwellings first</div>
          <form action="/dashboard" className="flex items-center gap-2 text-sm">
            <input type="hidden" name="days" value={days} />
            <select name="w" defaultValue={walkerParam ?? ''} className="input !w-auto !py-1">
              <option value="">Any walker</option>
              {(walkers ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  Near {w.full_name}{(w.home as unknown as { name: string } | null)?.name ? ` (${(w.home as unknown as { name: string }).name})` : ''}
                </option>
              ))}
            </select>
            <button className="btn-ghost">Show</button>
          </form>
        </div>
        {recWalker && !(recWalker.home as unknown as { name: string } | null) && (
          <p className="px-3 pt-2 text-xs text-amber-700">{recWalker.full_name} has no home suburb set — showing the default order.</p>
        )}
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>{['Suburb', 'Dwellings', 'Last drop', ...(walkerParam ? ['Distance'] : []), ''].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {((recs ?? []) as Rec[]).length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-slate-400">No available suburbs.</td></tr>}
            {((recs ?? []) as Rec[]).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.dwellings == null ? '—' : n(r.dwellings)}</td>
                <td className="px-3 py-2">{r.last_drop ?? 'never'}</td>
                {walkerParam && <td className="px-3 py-2">{r.distance_km == null ? '—' : `${r.distance_km} km`}</td>}
                <td className="px-3 py-2 text-right"><Link href={`/map?s=${r.id}`} className="text-blue-600 hover:underline">Open on map →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
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
