'use client';
import { useActionState } from 'react';
import { addCheck } from './actions';

type Opt = { id: string | number; name: string };

export default function CheckForm({ walkers, suburbs }: { walkers: Opt[]; suburbs: Opt[] }) {
  const [state, action, pending] = useActionState(addCheck, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-3">
      <div className="label sm:col-span-3">Log a verification check</div>
      <select name="walker" required className="input" defaultValue="">
        <option value="" disabled>Walker…</option>
        {walkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select name="suburb" className="input" defaultValue="">
        <option value="">Suburb (optional)</option>
        {suburbs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input name="date" type="date" defaultValue={today} className="input" />
      <select name="method" className="input" defaultValue="video">
        <option value="video">Video call</option>
        <option value="in_person">In person</option>
      </select>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="radio" name="result" value="pass" required /> Pass</label>
        <label className="flex items-center gap-1"><input type="radio" name="result" value="fail" /> Fail</label>
      </div>
      <input name="notes" placeholder="Notes (what was checked, issues)" className="input" />
      <button className="btn sm:col-span-3" disabled={pending}>Save check</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 sm:col-span-3">{state.ok}</p>}
    </form>
  );
}
