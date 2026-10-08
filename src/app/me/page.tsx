import { requireUser, supabaseServer } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import WalkerScreen from './WalkerScreen';
import Brand from '@/components/Brand';

export default async function Me() {
  const me = await requireUser();
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
          <form action={signOut}><button className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">Sign out</button></form>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 p-3">
      <h1 className="page-title pt-1">Hi, {me.full_name.split(' ')[0]}</h1>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat k="Flyers on hand" v={stats?.flyers_on_hand} />
        <Stat k="Delivered" v={stats?.flyers_total} />
        <Stat k="Hours" v={stats?.hours_total} />
      </div>
      <WalkerScreen tasks={(tasks ?? []).map((t) => ({
        id: t.id, status: t.status, suburb_id: t.suburb_id,
        suburb: (t.suburb as unknown as { name: string }).name,
        company: (t.company as unknown as { name: string }).name,
      }))} />
      <section className="card">
        <div className="label mb-2">My recent walks</div>
        {(drops ?? []).length === 0 ? <p className="text-sm text-slate-500">No walks yet.</p> : (
          <ul className="divide-y text-sm">
            {drops!.map((d) => (
              <li key={d.id} className="flex justify-between py-1.5">
                <span>{d.walked_on} · {(d.suburb as unknown as { name: string }).name}</span>
                <span>{d.flyers} flyers · {d.hours ?? '–'} h</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number | string | null | undefined }) {
  return <div className="card !p-2"><div className="text-xl font-bold">{v != null ? Number(v).toLocaleString() : '—'}</div><div className="label">{k}</div></div>;
}
