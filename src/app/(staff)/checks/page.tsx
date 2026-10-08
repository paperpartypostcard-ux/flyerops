import { supabaseServer, requireUser } from '@/lib/supabase/server';
import CheckForm from './CheckForm';

export default async function Checks() {
  await requireUser(true);
  const sb = await supabaseServer();
  const [{ data: stats }, { data: log }, { data: walkers }, { data: suburbs }] = await Promise.all([
    sb.from('walker_check_stats').select('*').order('full_name'),
    sb.from('verification_checks')
      .select('id, checked_on, method, result, notes, walker:profiles!verification_checks_walker_id_fkey(full_name), suburb:suburbs(name)')
      .order('checked_on', { ascending: false }).order('created_at', { ascending: false }).limit(100),
    sb.from('profiles').select('id, full_name').eq('role', 'walker').eq('status', 'active').order('full_name'),
    sb.from('suburbs').select('id, name').order('name'),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Verification checks</h1>

      <CheckForm walkers={(walkers ?? []).map((w) => ({ id: w.id, name: w.full_name }))} suburbs={suburbs ?? []} />

      <div className="card overflow-x-auto p-0">
        <div className="label px-3 pt-3">By walker</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>{['Walker', 'Checks', 'Pass', 'Fail', 'Pass rate', 'Last check'].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(stats ?? []).length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-slate-400">No walkers yet.</td></tr>}
            {(stats ?? []).map((s) => {
              const rate = s.checks ? Math.round((s.passed / s.checks) * 100) : null;
              return (
                <tr key={s.walker_id} className="border-t">
                  <td className="px-3 py-2">{s.full_name}</td>
                  <td className="px-3 py-2">{s.checks}</td>
                  <td className="px-3 py-2 text-green-700">{s.passed}</td>
                  <td className="px-3 py-2 text-red-600">{s.failed}</td>
                  <td className={`px-3 py-2 ${rate != null && rate < 80 ? 'font-medium text-red-600' : ''}`}>{rate == null ? '—' : `${rate}%`}</td>
                  <td className="px-3 py-2">{s.last_checked ?? 'never'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="label px-3 pt-3">Journal</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>{['Date', 'Walker', 'Suburb', 'Method', 'Result', 'Notes'].map((h) =>
              <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(log ?? []).length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-slate-400">No checks logged yet.</td></tr>}
            {(log ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{c.checked_on}</td>
                <td className="px-3 py-2">{(c.walker as unknown as { full_name: string } | null)?.full_name}</td>
                <td className="px-3 py-2">{(c.suburb as unknown as { name: string } | null)?.name ?? '—'}</td>
                <td className="px-3 py-2">{c.method === 'video' ? 'Video' : 'In person'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${c.result === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {c.result}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{c.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
