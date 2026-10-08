import { supabaseServer, requireUser } from '@/lib/supabase/server';
import StockForm from './StockForm';
import { getI18n } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/core';


export default async function Stock() {
  await requireUser(true);
  const { lang, t } = await getI18n();
  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString(locale(lang));
  const TYPE_LABEL: Record<string, string> = { receive: t('stock.t.receive'), issue: t('stock.t.issue'), return: t('stock.t.return'), adjust: t('stock.t.adjust') };
  const sb = await supabaseServer();
  const [{ data: wh }, { data: hand }, { data: moves }, { data: companies }, { data: walkers }] = await Promise.all([
    sb.from('stock_warehouse').select('*').order('company_name'),
    sb.from('stock_on_hand').select('*').neq('on_hand', 0).order('walker_name'),
    sb.from('stock_moves').select('id, type, qty, moved_on, note, company:companies(name), walker:profiles!stock_moves_walker_id_fkey(full_name)')
      .order('moved_on', { ascending: false }).order('created_at', { ascending: false }).limit(50),
    sb.from('companies').select('id, name').order('name'),
    sb.from('profiles').select('id, full_name').eq('role', 'walker').eq('status', 'active').order('full_name'),
  ]);
  const totalHand = (hand ?? []).reduce((s, h) => s + (h.on_hand ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="page-title">{t('stock.title')}</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        {(wh ?? []).map((w) => (
          <div key={w.company_id} className="card">
            <div className="flex items-center gap-2 text-sm font-medium">
              <i className="inline-block h-3 w-3 rounded-sm" style={{ background: w.company_color }} />{w.company_name}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{n(w.balance)}</div>
            <div className="text-xs text-slate-500">{t('stock.inWarehouse', { r: n(w.received), i: n(w.issued) })}</div>
          </div>
        ))}
      </div>

      <StockForm companies={companies ?? []}
        walkers={(walkers ?? []).map((w) => ({ id: w.id, name: w.full_name }))} />

      <div className="card overflow-x-auto p-0">
        <div className="flex items-baseline justify-between px-3 pt-3">
          <div className="label">{t('stock.onHand')}</div>
          <div className="text-xs text-slate-500">{t('stock.totalN', { n: n(totalHand) })}</div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>{[t('common.walker'), t('common.company'), t('stock.issuedNet'), t('stock.delivered'), t('stock.onHandCol')].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(hand ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-slate-400">{t('stock.nobody')}</td></tr>}
            {(hand ?? []).map((h) => (
              <tr key={`${h.walker_id}-${h.company_id}`} className="border-t">
                <td className="px-3 py-2">{h.walker_name}</td>
                <td className="px-3 py-2">{h.company_name}</td>
                <td className="px-3 py-2">{n(h.issued_net)}</td>
                <td className="px-3 py-2">{n(h.dropped)}</td>
                <td className={`px-3 py-2 font-medium ${h.on_hand < 0 ? 'text-red-600' : ''}`}>{n(h.on_hand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="label px-3 pt-3">{t('stock.recent')}</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>{[t('common.date'), t('stock.operation'), t('common.company'), t('common.walker'), t('stock.qtyCol'), t('common.notes')].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(moves ?? []).length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-slate-400">{t('stock.noMoves')}</td></tr>}
            {(moves ?? []).map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{m.moved_on}</td>
                <td className="px-3 py-2">{TYPE_LABEL[m.type]}</td>
                <td className="px-3 py-2">{(m.company as unknown as { name: string } | null)?.name}</td>
                <td className="px-3 py-2">{(m.walker as unknown as { full_name: string } | null)?.full_name ?? '—'}</td>
                <td className="px-3 py-2">{m.type === 'issue' ? '−' : m.type === 'adjust' && m.qty < 0 ? '' : '+'}{n(m.qty)}</td>
                <td className="px-3 py-2 text-slate-500">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
