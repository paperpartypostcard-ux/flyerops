'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fileToTrack } from '@/lib/gpx';
import { useI18n } from '@/lib/i18n/client';
import Hint from '@/components/Hint';

import { trError } from '@/lib/i18n/core';

const SuburbMap = dynamic(() => import('@/components/SuburbMap'), { ssr: false });
type Task = { id: string; status: string; suburb_id: number; suburb: string; company: string };

export default function WalkerScreen({ tasks }: { tasks: Task[] }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const { t } = useI18n();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '');
  const task = tasks.find((t) => t.id === taskId);
  const [suburbs, setSuburbs] = useState<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const [coverage, setCoverage] = useState<GeoJSON.FeatureCollection | null>(null);
  const [preview, setPreview] = useState<GeoJSON.MultiLineString | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { sb.rpc('suburbs_geojson').then(({ data }) => data && setSuburbs(data)); }, [sb]);
  useEffect(() => {
    if (!task) return;
    sb.rpc('suburb_coverage', { p_suburb: task.suburb_id }).then(({ data }) => setCoverage(data));
  }, [sb, task]);

  const one = useMemo(() => ({ ...suburbs, features: suburbs.features.filter((f) => f.id === task?.suburb_id) }), [suburbs, task]);
  const cov = useMemo(() => preview && coverage
    ? { ...coverage, features: [...coverage.features, { type: 'Feature' as const, geometry: preview, properties: {} }] }
    : coverage, [coverage, preview]);

  if (!tasks.length) return <div className="card text-sm text-slate-500">{t('me.none')}</div>;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg({});
    const f = new FormData(e.currentTarget);
    try {
      const { error } = await sb.rpc('submit_drop', {
        p_assignment: taskId, p_walked_on: String(f.get('date')), p_flyers: Number(f.get('flyers')),
        p_hours: Number(f.get('hours')) || null, p_track: preview, p_notes: String(f.get('notes') || '') || null,
      });
      if (error) throw error;
      setMsg({ ok: t('me.saved') }); setPreview(null); (e.target as HTMLFormElement).reset();
      router.refresh();
      sb.rpc('suburb_coverage', { p_suburb: task!.suburb_id }).then(({ data }) => setCoverage(data));
    } catch (err) { setMsg({ error: trError((err as Error).message, t) }); }
    setBusy(false);
  }

  return (
    <section className="space-y-3">
      <select className="input" value={taskId} onChange={(e) => { setTaskId(e.target.value); setPreview(null); }}>
        {tasks.map((t) => <option key={t.id} value={t.id}>{t.suburb} — {t.company}</option>)}
      </select>
      <div className="h-[55dvh] overflow-hidden rounded-xl border">
        <SuburbMap suburbs={one} coverage={cov} fit />
      </div>
      <p className="text-xs text-slate-500">{t('me.legend')}</p>

      <form onSubmit={submit} className="card grid grid-cols-2 gap-2">
        <div className="label col-span-2">{t('me.report')}</div>
        <label className="text-sm">{t('common.date')}<input name="date" type="date" required className="input"
          defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label className="text-sm">{t('me.flyers')}<Hint text={t('help.me.flyers')} align="right" /><input name="flyers" type="number" min={0} required className="input" /></label>
        <label className="text-sm">{t('me.hoursMMW')}<Hint text={t('help.me.hours')} /><input name="hours" type="number" min={0} step="0.05" className="input" /></label>
        <label className="text-sm">{t('me.gpx')}<Hint text={t('help.me.gpx')} align="right" />
          <input type="file" accept=".gpx,.kml" className="input !p-1.5" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return setPreview(null);
            try { setPreview(await fileToTrack(file)); setMsg({}); } catch (err) { setMsg({ error: (err as Error).message }); }
          }} />
        </label>
        <textarea name="notes" placeholder={t('me.notesPh')} className="input col-span-2" rows={2} />
        <button className="btn col-span-2" disabled={busy}>{busy ? t('me.saving') : t('me.submit')}</button>
        {msg.error && <p className="col-span-2 text-sm text-red-600">{msg.error}</p>}
        {msg.ok && <p className="col-span-2 text-sm text-green-700">{msg.ok}</p>}
      </form>
    </section>
  );
}
