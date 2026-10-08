'use client';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Legend, STATUS_COLORS, STATUS_LABELS } from '@/components/SuburbMap';
import { useI18n } from '@/lib/i18n/client';
import { trError } from '@/lib/i18n/core';
import { assignSuburb, reassign, setAssignmentStatus, updateSuburb } from './actions';

const SuburbMap = dynamic(() => import('@/components/SuburbMap'), { ssr: false });

type Company = { id: string; name: string; color: string };
type Walker = { id: string; full_name: string; home_suburb_id: number | null; company_id: string | null };
type Props = {
  id: number; name: string; status: string; dwellings: number | null; cycle_months: number; excluded: boolean;
  last_drop: string | null; next_allowed: string | null; assignment_id: string | null; assignment_status: string | null;
  walker_id: string | null; walker_name: string | null; company_id: string | null; company_name: string | null;
};
type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Props>;

export default function MapScreen({ companies, walkers }: { companies: Company[]; walkers: Walker[] }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { t } = useI18n();
  const st = (k: string) => t(`status.${k}` as 'status.available');
  const [all, setAll] = useState<FC | null>(null);
  const params = useSearchParams();
  const [sel, setSel] = useState<number | null>(() => Number(params.get('s')) || null);
  const [focusOnSel, setFocusOnSel] = useState(() => !!params.get('s'));
  const [coverage, setCoverage] = useState<GeoJSON.FeatureCollection | null>(null);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('suburbs_geojson');
    if (error) setMsg(trError(error.message, t)); else setAll(data as FC);
  }, [sb, t]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setCoverage(null);
    if (sel == null) return;
    sb.rpc('suburb_coverage', { p_suburb: sel }).then(({ data }) => setCoverage(data as GeoJSON.FeatureCollection));
  }, [sb, sel]);

  const shown = useMemo<FC>(() => {
    if (!all) return { type: 'FeatureCollection', features: [] };
    const s = q.trim().toLowerCase();
    return { ...all, features: all.features.filter((f) =>
      (!statusF || f.properties.status === statusF) && (!s || f.properties.name.toLowerCase().includes(s))) };
  }, [all, q, statusF]);

  // Zoom to search results (up to 25 matches) or to a suburb opened by link (/map?s=ID)
  const focus = useMemo<FC | null>(() => {
    if (!all) return null;
    if (focusOnSel && sel != null) return { ...all, features: all.features.filter((f) => f.properties.id === sel) };
    if (q.trim() && shown.features.length > 0 && shown.features.length <= 25) return shown;
    return null;
  }, [all, focusOnSel, sel, q, shown]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    all?.features.forEach((f) => (c[f.properties.status] = (c[f.properties.status] ?? 0) + 1));
    return c;
  }, [all]);

  const p = all?.features.find((f) => f.properties.id === sel)?.properties;
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => {
    const r = await fn(); setMsg(r.error ? trError(r.error, t) : null); if (!r.error) await load();
  });

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="relative min-h-[50dvh] flex-1">
        <SuburbMap suburbs={shown} coverage={coverage} selectedId={sel} focus={focus}
          onSelect={(id) => { setFocusOnSel(false); setSel(id); }} />
        <div className="absolute left-2 top-2 flex flex-col gap-2 rounded-lg bg-white/95 p-2 shadow max-w-[calc(100%-4rem)]">
          <div className="flex gap-2">
            <input className="input !py-1" placeholder={t('map.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input !py-1 !w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">{t('map.all')}</option>
              {Object.keys(STATUS_LABELS).map((k) => <option key={k} value={k}>{st(k)} ({counts[k] ?? 0})</option>)}
            </select>
          </div>
          <Legend />
        </div>
      </div>

      <aside className="w-full overflow-y-auto border-l bg-white p-4 md:w-96">
        {msg && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{msg}</p>}
        {!p ? (
          <div className="text-sm text-slate-500">
            {all ? t('map.count', { n: all.features.length }) : t('common.loading')}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <span className="inline-block rounded px-2 py-0.5 text-xs text-white" style={{ background: STATUS_COLORS[p.status] }}>
                {st(p.status)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Item k={t('map.dwellings')} v={p.dwellings?.toLocaleString() ?? '—'} />
              <Item k={t('map.cycle')} v={t('common.months', { n: p.cycle_months })} />
              <Item k={t('map.lastDrop')} v={p.last_drop ?? t('common.never')} />
              <Item k={t('map.nextAllowed')} v={p.next_allowed ?? t('common.now')} />
              <Item k={t('common.walker')} v={p.walker_name ?? '—'} />
              <Item k={t('common.company')} v={p.company_name ?? '—'} />
            </dl>

            {p.assignment_id ? (
              <div className="card space-y-2">
                <div className="label">{t('map.current', { status: st(p.assignment_status ?? '') })}</div>
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault(); const w = String(new FormData(e.currentTarget).get('w'));
                  run(() => reassign(p.assignment_id!, w));
                }}>
                  <WalkerSelect walkers={walkers} suburbId={p.id} defaultValue={p.walker_id ?? ''} />
                  <button className="btn-ghost" disabled={pending}>{t('map.handOver')}</button>
                </form>
                <div className="flex gap-2">
                  <button className="btn" disabled={pending}
                    onClick={() => confirm(t('map.confirmComplete')) && run(() => setAssignmentStatus(p.assignment_id!, 'completed'))}>
                    {t('map.complete')}
                  </button>
                  <button className="btn-ghost" disabled={pending}
                    onClick={() => confirm(t('map.confirmCancel')) && run(() => setAssignmentStatus(p.assignment_id!, 'cancelled'))}>
                    {t('map.cancel')}
                  </button>
                </div>
              </div>
            ) : p.status === 'available' ? (
              <form className="card space-y-2" onSubmit={(e) => {
                e.preventDefault(); const f = new FormData(e.currentTarget);
                run(() => assignSuburb(p.id, String(f.get('w')), String(f.get('c')), String(f.get('d') || '')));
              }}>
                <div className="label">{t('map.assign')}</div>
                <WalkerSelect walkers={walkers} suburbId={p.id} onPick={(w, form) => {
                  const c = form?.elements.namedItem('c') as HTMLSelectElement | null;
                  if (c && w?.company_id) c.value = w.company_id;
                }} />
                <select name="c" required className="input">
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input name="d" type="date" className="input" />
                <button className="btn w-full" disabled={pending}>{t('map.assign')}</button>
              </form>
            ) : null}

            <form key={p.id} className="card space-y-2" onSubmit={(e) => {
              e.preventDefault(); const f = new FormData(e.currentTarget);
              const ov = String(f.get('ov') || '');
              run(() => updateSuburb(p.id, {
                cycle_months: Number(f.get('cycle')), excluded: f.get('ex') === 'on',
                dwellings_override: ov ? Number(ov) : null,
              }));
            }}>
              <div className="label">{t('map.settings')}</div>
              <label className="flex items-center justify-between text-sm">{t('map.cycle')}
                <select name="cycle" defaultValue={p.cycle_months} className="input !w-32">
                  {[3, 4].map((m) => <option key={m} value={m}>{t('common.months', { n: m })}</option>)}
                </select>
              </label>
              <label className="flex items-center justify-between text-sm">{t('map.override')}
                <input name="ov" type="number" min={0} className="input !w-32" placeholder="ABS" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="ex" type="checkbox" defaultChecked={p.excluded} /> {t('map.exclude')}
              </label>
              <button className="btn-ghost" disabled={pending}>{t('common.save')}</button>
            </form>
            <p className="text-xs text-slate-500">
              {t('map.tracks', { n: coverage?.features.length ?? 0 })}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div><dt className="label">{k}</dt><dd>{v}</dd></div>;
}

function WalkerSelect({ walkers, suburbId, defaultValue, onPick }: {
  walkers: Walker[]; suburbId: number; defaultValue?: string;
  onPick?: (w: Walker | undefined, form: HTMLFormElement | null) => void;
}) {
  const { t } = useI18n();
  const sorted = [...walkers].sort((a, b) => Number(b.home_suburb_id === suburbId) - Number(a.home_suburb_id === suburbId));
  return (
    <select name="w" required className="input" defaultValue={defaultValue}
      onChange={(e) => onPick?.(walkers.find((w) => w.id === e.target.value), e.target.form)}>
      <option value="">{t('map.selectWalker')}</option>
      {sorted.map((w) => (
        <option key={w.id} value={w.id}>{w.full_name}{w.home_suburb_id === suburbId ? t('map.livesHere') : ''}</option>
      ))}
    </select>
  );
}
