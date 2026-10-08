import { supabaseServer, requireUser } from '@/lib/supabase/server';
import { setWalkerCompany, setWalkerStatus } from './actions';
import CreateWalker from './CreateWalker';
import { getI18n } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/core';

export default async function Walkers() {
  const me = await requireUser(true);
  const { lang, t } = await getI18n();
  const loc = locale(lang);
  const sb = await supabaseServer();
  const [{ data: people }, { data: stats }, { data: suburbs }, { data: companies }] = await Promise.all([
    sb.from('profiles').select('id, full_name, email, phone, role, status, company_id, home:suburbs(name)').order('status').order('full_name'),
    sb.from('walker_stats').select('*'),
    sb.from('suburbs').select('id, name').order('name'),
    sb.from('companies').select('id, name').order('name'),
  ]);
  const byId = new Map((stats ?? []).map((s) => [s.walker_id, s]));
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="page-title">{t('walkers.title')}</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>{[t('walkers.name'), t('walkers.contact'), t('walkers.livesIn'), t('common.company'), t('common.flyers'), t('common.hours'), t('common.perHour'), t('walkers.onHand'), t('common.status'), ''].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => {
              const s = byId.get(p.id);
              const home = (p.home as unknown as { name: string } | null)?.name;
              return (
                <tr key={p.id} className={`border-t ${p.status === 'inactive' ? 'text-slate-400' : ''}`}>
                  <td className="px-3 py-2 font-medium">{p.full_name}{p.role !== 'walker' && <span className="ml-1 text-xs font-semibold text-euc">{t(`role.${p.role as 'owner'}`)}</span>}</td>
                  <td className="px-3 py-2">{p.email}<br /><span className="text-xs">{p.phone}</span></td>
                  <td className="px-3 py-2">{home ?? '—'}</td>
                  <td className="px-3 py-2">
                    {p.role === 'walker' ? (
                      <form action={setWalkerCompany.bind(null, p.id)} className="flex gap-1">
                        <select name="company" defaultValue={p.company_id ?? ''} className="input !w-auto !py-1 !text-xs">
                          <option value="">—</option>
                          {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button className="btn-ghost !px-2 !py-1 text-xs">{t('walkers.set')}</button>
                      </form>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">{s?.flyers_total?.toLocaleString(loc) ?? '—'}</td>
                  <td className="px-3 py-2">{s?.hours_total ?? '—'}</td>
                  <td className="px-3 py-2">{s?.flyers_per_hour ?? '—'}</td>
                  <td className="px-3 py-2">{s?.flyers_on_hand?.toLocaleString(loc) ?? '—'}</td>
                  <td className="px-3 py-2">{p.status === 'active' ? t('common.active') : t('common.inactive')}</td>
                  <td className="px-3 py-2">
                    {p.role === 'walker' && (
                      <form action={setWalkerStatus.bind(null, p.id, p.status === 'active' ? 'inactive' : 'active')}>
                        <button className="btn-ghost text-xs">{p.status === 'active' ? t('walkers.deactivate') : t('walkers.activate')}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CreateWalker suburbs={suburbs ?? []} companies={companies ?? []} canCreateStaff={me.role === 'owner'} />
    </div>
  );
}
