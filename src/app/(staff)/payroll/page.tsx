import Link from 'next/link';
import { supabaseServer, requireUser } from '@/lib/supabase/server';
import { presets, resolvePeriod } from '@/lib/periods';
import RateForm from './RateForm';
import { getI18n } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/core';


export default async function Payroll({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  const me = await requireUser(true);
  const { lang, t } = await getI18n();
  const loc = locale(lang);
  const money = (v: number) => v.toLocaleString(loc, { style: 'currency', currency: 'AUD' });
  const n = (v: number) => v.toLocaleString(loc);
  const period = resolvePeriod(await searchParams);
  const sb = await supabaseServer();
  const [{ data: rows, error }, { data: settings }] = await Promise.all([
    sb.rpc('payroll', { p_from: period.from, p_to: period.to }),
    sb.from('app_settings').select('rate_per_1000').single(),
  ]);
  const rate = Number(settings?.rate_per_1000 ?? 125);
  type Row = { walker_id: string; full_name: string; email: string; status: string; flyers: number; hours: number; walks: number; suburbs: number; earnings: number };
  const list = (rows ?? []) as Row[];
  const total = list.reduce((a, r) => ({ flyers: a.flyers + r.flyers, hours: a.hours + Number(r.hours), earnings: a.earnings + Number(r.earnings) }),
    { flyers: 0, hours: 0, earnings: 0 });
  const qs = `from=${period.from}&to=${period.to}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{t('pay.title')}</h1>
        {me.role === 'owner'
          ? <RateForm rate={rate} />
          : <span className="text-sm text-slate-600">{t('pay.rateRO', { rate })}</span>}
      </div>

      <div className="card flex flex-wrap items-center gap-2">
        {presets().map((p) => (
          <Link key={p.key} href={`/payroll?p=${p.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${p.key === period.key ? 'bg-ink text-white' : 'border border-line bg-white hover:bg-paper'}`}>
            {t(`pay.p.${p.key}` as 'pay.p.custom')}
          </Link>
        ))}
        <form className="flex flex-wrap items-center gap-2 text-sm" action="/payroll">
          <input type="date" name="from" defaultValue={period.from} className="input !w-auto !py-1" />
          <span>–</span>
          <input type="date" name="to" defaultValue={period.to} className="input !w-auto !py-1" />
          <button className={`rounded-lg px-3 py-1.5 ${period.key === 'custom' ? 'bg-ink text-white' : 'border border-line bg-white hover:bg-paper'}`}>{t('common.apply')}</button>
        </form>
        <a href={`/payroll/csv?${qs}`} className="btn-ghost ml-auto">{t('pay.export')}</a>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card"><div className="label">{t('pay.toPay')}</div><div className="mt-2 text-3xl font-bold tracking-tight">{money(total.earnings)}</div>
          <div className="text-xs text-slate-500">{period.from} – {period.to}</div></div>
        <div className="card"><div className="label">{t('pay.flyers')}</div><div className="mt-2 text-3xl font-bold tracking-tight">{n(total.flyers)}</div></div>
        <div className="card"><div className="label">{t('pay.hours')}</div><div className="mt-2 text-3xl font-bold tracking-tight">{n(Math.round(total.hours * 10) / 10)}</div></div>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>{[t('common.walker'), t('common.walks'), t('common.suburbs'), t('common.flyers'), t('common.hours'), t('common.perHour'), t('pay.earnings')].map((h, i) =>
              <th key={h} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'text-right'}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-slate-400">{t('pay.noWalkers')}</td></tr>}
            {list.map((r) => (
              <tr key={r.walker_id} className={`border-t ${r.status === 'inactive' ? 'text-slate-400' : ''}`}>
                <td className="px-3 py-2">{r.full_name}<br /><span className="text-xs text-slate-500">{r.email}</span></td>
                <td className="px-3 py-2 text-right">{r.walks}</td>
                <td className="px-3 py-2 text-right">{r.suburbs}</td>
                <td className="px-3 py-2 text-right">{n(r.flyers)}</td>
                <td className="px-3 py-2 text-right">{Number(r.hours)}</td>
                <td className="px-3 py-2 text-right">{Number(r.hours) > 0 ? n(Math.round(r.flyers / Number(r.hours))) : '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{money(Number(r.earnings))}</td>
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t bg-slate-50 font-medium">
                <td className="px-3 py-2">{t('common.total')}</td><td /><td />
                <td className="px-3 py-2 text-right">{n(total.flyers)}</td>
                <td className="px-3 py-2 text-right">{n(Math.round(total.hours * 10) / 10)}</td><td />
                <td className="px-3 py-2 text-right">{money(total.earnings)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-slate-500">
        {t('pay.note')}
      </p>
    </div>
  );
}
