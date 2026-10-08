import { requireUser, supabaseServer } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import WalkerScreen from './WalkerScreen';
import Brand from '@/components/Brand';
import LangSwitch from '@/components/LangSwitch';
import { getI18n } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/core';

export default async function Me() {
  const me = await requireUser();
  const { lang, t } = await getI18n();
  const sb = await supabaseServer();
  const [{ data: tasks }, { data: stats }, { data: drops }] = await Promise.all([
    sb.from('assignments').select('id, status, planned_start, suburb_id, suburb:suburbs(name), company:companies(name)')
      .eq('walker_id', me.id).in('status', ['planned', 'in_progress']).order('created_at'),
    sb.from('walker_stats').select('flyers_on_hand, flyers_total, hours_total').eq('walker_id', me.id).maybeSingle(),
    sb.from('drops').select('id, walked_on, flyers, hours, suburb:suburbs(name)').eq('walker_id', me.id)
      .order('walked_on', { ascending: false }).limit(20),
  ]);
  return (
    <div className="min-h-dvh">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 py-2.5">
          <Brand />
          <div className="flex items-center gap-2"><LangSwitch /><form action={signOut}><button className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">{t('common.signOut')}</button></form></div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 p-3">
      <div className="pt-1"><h1 className="page-title">{t('me.hi', { name: me.full_name.split(' ')[0] })}</h1><p className="page-sub">{t('help.me.page')}</p></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat k={t('me.onHand')} v={stats?.flyers_on_hand} loc={locale(lang)} />
        <Stat k={t('me.delivered')} v={stats?.flyers_total} loc={locale(lang)} />
        <Stat k={t('me.hours')} v={stats?.hours_total} loc={locale(lang)} />
      </div>
      <WalkerScreen tasks={(tasks ?? []).map((t) => ({
        id: t.id, status: t.status, suburb_id: t.suburb_id,
        suburb: (t.suburb as unknown as { name: string }).name,
        company: (t.company as unknown as { name: string }).name,
      }))} />
      <section className="card">
        <div className="label mb-2">{t('me.recent')}</div>
        {(drops ?? []).length === 0 ? <p className="text-sm text-slate-500">{t('me.noWalks')}</p> : (
          <ul className="divide-y text-sm">
            {drops!.map((d) => (
              <li key={d.id} className="flex justify-between py-1.5">
                <span>{d.walked_on} · {(d.suburb as unknown as { name: string }).name}</span>
                <span>{t('me.walkLine', { n: d.flyers, h: d.hours ?? '–' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

function Stat({ k, v, loc }: { k: string; v: number | string | null | undefined; loc: string }) {
  return <div className="card !p-2"><div className="text-xl font-bold">{v != null ? Number(v).toLocaleString(loc) : '—'}</div><div className="label">{k}</div></div>;
}
