import Link from 'next/link';
import { supabaseServer, requireUser } from '@/lib/supabase/server';
import { STATUS_COLORS } from '@/lib/status';
import { getI18n } from '@/lib/i18n/server';
import { locale, type T } from '@/lib/i18n/core';
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

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string; w?: string }> }) {
  await requireUser(true);
  const { lang, t } = await getI18n();
  const loc = locale(lang);
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString(loc);
  const money = (v: number) => v.toLocaleString(loc, { style: 'currency', currency: 'AUD' });
  const { days: daysParam, w: walkerParam } = await searchParams;
  const days = PERIODS.find((p) => String(p) === daysParam) ?? 30;
  const sb = await supabaseServer();
  const [{ data, error }, { data: settings }, { data: walkers }, { data: recs }] = await Promise.all([
    sb.rpc('dashboard_summary', { p_days: days }),
    sb.from('app_settings').select('rate_per_1000').single(),
    sb.from('profiles').select('id, full_name, home:suburbs(name)').eq('role', 'walker').eq('status', 'active').order('full_name'),
    sb.rpc('recommend_suburbs', { p_walker: walkerParam || null, p_limit: 10 }),
  ]);
  if (error || !data) return <div className="p-4 text-red-600">{t('dash.error', { msg: error?.message ?? '' })}</div>;
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
        <h1 className="page-title">{t('dash.title')}</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link key={p} href={`/dashboard?days=${p}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${p === days ? 'bg-ink text-white' : 'border border-line bg-white hover:bg-paper'}`}>
              {t('common.days', { n: p })}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t('dash.flyers')} value={n(k.flyers)}
          sub={delta == null ? t('dash.prev', { d: days, n: n(k.flyers_prev) }) : t('dash.vsPrev', { arrow: delta >= 0 ? '▲' : '▼', pct: Math.abs(delta), d: days })} />
        <Tile label={t('dash.avgWeek')} value={n(Math.round(k.flyers / weeks))} sub={t('dash.perMonth', { n: n(Math.round(k.flyers / months)) })} />
        <Tile label={t('dash.avgHours')} value={n(Math.round((Number(k.hours) / weeks) * 10) / 10)}
          sub={t('dash.perMonthWalks', { n: n(Math.round(Number(k.hours) / months)), w: n(k.walks) })} />
        <Tile label={t('dash.perHour')} value={perHour == null ? '—' : n(perHour)} sub={t('dash.teamAvg', { n: n(k.active_walkers) })} />
        <Tile label={t('dash.pay')} value={money(Math.round(k.flyers * rate) / 1000)} sub={t('dash.atRate', { rate })} />
        <Tile label={t('dash.suburbsWalked')} value={n(k.suburbs_walked)} sub={t('dash.completedOpen', { c: n(k.completed), o: n(k.open) })} />
        <Tile label={t('dash.stock')} value={n(k.stock_total)} sub={t('dash.onHand', { n: n(k.on_hand_total) })} />
        <Tile label={t('dash.checks')} value={n(k.checks)}
          sub={k.checks_failed ? t('dash.failed', { n: n(k.checks_failed) }) : t('dash.noFailures')} warn={k.checks_failed > 0} />
      </div>

      <DailyChart days={s.daily} />

      <div className="card">
        <div className="label mb-2">{t('dash.byStatus')}</div>
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded">
          {Object.keys(STATUS_COLORS).filter((st) => s.map[st]?.suburbs).map((st) => (
            <div key={st} title={`${st_(t, st)}: ${s.map[st].suburbs}`}
              style={{ flexGrow: s.map[st].suburbs, background: STATUS_COLORS[st] }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {Object.keys(STATUS_COLORS).map((st) => (
            <span key={st} className="flex items-center gap-1">
              <i className="inline-block h-3 w-3 rounded-sm" style={{ background: STATUS_COLORS[st] }} />
              {st_(t, st)}: <b className="text-slate-900">{n(s.map[st]?.suburbs)}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Table title={t('dash.byCompany')} head={[t('common.company'), t('dash.delivered'), t('dash.perWeekCol'), t('dash.perMonthCol'), t('common.suburbs'), t('dash.inStock')]}
          empty={t('dash.noCompanies')}
          rows={s.companies.map((c) => [
            <span key="n" className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.name}</span>,
            n(c.flyers), n(Math.round(c.flyers / weeks)), n(Math.round(c.flyers / months)), n(c.suburbs), n(c.stock),
          ])} />
        <Table title={t('dash.byWalker')} head={[t('common.walker'), t('dash.delivered'), t('common.hours'), t('common.perHour'), t('dash.lastWalk')]}
          empty={t('dash.noWalks')}
          rows={s.walkers.map((w) => [w.name, n(w.flyers), n(Number(w.hours)), w.per_hour == null ? '—' : n(w.per_hour), w.last_walk])} />
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
          <div className="label">{t('dash.next')}</div>
          <form action="/dashboard" className="flex items-center gap-2 text-sm">
            <input type="hidden" name="days" value={days} />
            <select name="w" defaultValue={walkerParam ?? ''} className="input !w-auto !py-1">
              <option value="">{t('dash.anyWalker')}</option>
              {(walkers ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {t('dash.near', { name: w.full_name })}{(w.home as unknown as { name: string } | null)?.name ? ` (${(w.home as unknown as { name: string }).name})` : ''}
                </option>
              ))}
            </select>
            <button className="btn-ghost">{t('common.show')}</button>
          </form>
        </div>
        {recWalker && !(recWalker.home as unknown as { name: string } | null) && (
          <p className="px-3 pt-2 text-xs text-amber-700">{t('dash.noHome', { name: recWalker.full_name })}</p>
        )}
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>{[t('common.suburb'), t('dash.dwellings'), t('dash.lastDrop'), ...(walkerParam ? [t('dash.distance')] : []), ''].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {((recs ?? []) as Rec[]).length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-slate-400">{t('dash.noAvailable')}</td></tr>}
            {((recs ?? []) as Rec[]).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.dwellings == null ? '—' : n(r.dwellings)}</td>
                <td className="px-3 py-2">{r.last_drop ?? t('common.never')}</td>
                {walkerParam && <td className="px-3 py-2">{r.distance_km == null ? '—' : `${r.distance_km} ${lang === 'ru' ? 'км' : 'km'}`}</td>}
                <td className="px-3 py-2 text-right"><Link href={`/map?s=${r.id}`} className="font-semibold text-euc hover:underline">{t('dash.openOnMap')}</Link></td>
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

const st_ = (t: T, st: string) => t(`status.${st}` as Parameters<T>[0]);
