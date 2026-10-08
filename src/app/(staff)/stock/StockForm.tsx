'use client';
import { useActionState, useRef, useState } from 'react';

import { addStockMove } from './actions';

const BOX = 1200;

type Opt = { id: string; name: string };
const OPS = [
  ['receive', 'Receive into warehouse'],
  ['issue', 'Issue to walker'],
  ['return', 'Return from walker'],
  ['adjust', 'Adjust (± correction)'],
] as const;

export default function StockForm({ companies, walkers }: { companies: Opt[]; walkers: Opt[] }) {
  const [state, action, pending] = useActionState(addStockMove, {});
  const [type, setType] = useState<string>('receive');
  const needsWalker = type === 'issue' || type === 'return';
  const qtyRef = useRef<HTMLInputElement>(null);
  const addBox = () => { if (qtyRef.current) qtyRef.current.value = String((Number(qtyRef.current.value) || 0) + BOX); };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-3">
      <div className="label sm:col-span-3">New stock movement</div>
      <select name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
        {OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select name="company" required className="input" defaultValue="">
        <option value="" disabled>Company…</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {needsWalker ? (
        <select name="walker" required className="input" defaultValue="">
          <option value="" disabled>Walker…</option>
          {walkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      ) : <span className="hidden sm:block" />}
      <div className="flex gap-1">
        <input ref={qtyRef} name="qty" type="number" required step={1} min={type === 'adjust' ? undefined : 1}
          placeholder={type === 'adjust' ? 'Qty (e.g. -100)' : 'Qty'} className="input" />
        {type !== 'adjust' && (
          <button type="button" onClick={addBox} className="btn-ghost whitespace-nowrap" title="Add one box (1200 flyers)">+1 box</button>
        )}
      </div>
      <input name="date" type="date" defaultValue={today} className="input" />
      <input name="note" placeholder="Note (optional)" className="input" />
      <button className="btn sm:col-span-3" disabled={pending}>Save</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 sm:col-span-3">{state.ok}</p>}
    </form>
  );
}
