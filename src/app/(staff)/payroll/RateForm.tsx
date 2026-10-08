'use client';
import { useActionState } from 'react';
import { setRate } from './actions';

export default function RateForm({ rate }: { rate: number }) {
  const [state, action, pending] = useActionState(setRate, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">Rate</span>
      <span>$</span>
      <input name="rate" type="number" step="0.01" min={0} defaultValue={rate} className="input !w-24 !py-1" />
      <span className="text-slate-600">per 1000 flyers</span>
      <button className="btn-ghost" disabled={pending}>Save</button>
      {state.error && <span className="text-red-600">{state.error}</span>}
      {state.ok && <span className="text-green-700">{state.ok}</span>}
    </form>
  );
}
