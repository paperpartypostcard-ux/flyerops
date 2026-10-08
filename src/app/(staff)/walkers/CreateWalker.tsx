'use client';
import { useActionState } from 'react';
import { createWalker } from './actions';

export default function CreateWalker({ suburbs, canCreateStaff }: { suburbs: { id: number; name: string }[]; canCreateStaff: boolean }) {
  const [state, action, pending] = useActionState(createWalker, {});
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-3">
      <div className="label sm:col-span-3">Add person</div>
      <input name="full_name" required placeholder="Full name" className="input" />
      <input name="email" type="email" required placeholder="Email" className="input" />
      <input name="phone" placeholder="Phone" className="input" />
      <select name="home" className="input" defaultValue="">
        <option value="">Home suburb…</option>
        {suburbs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input name="password" type="text" required minLength={10} placeholder="Initial password (10+ chars)" className="input" />
      {canCreateStaff ? (
        <select name="role" className="input" defaultValue="walker">
          <option value="walker">Walker</option><option value="manager">Manager</option><option value="owner">Owner</option>
        </select>
      ) : <span />}
      <button className="btn sm:col-span-3" disabled={pending}>Create</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 sm:col-span-3">{state.ok}</p>}
    </form>
  );
}
