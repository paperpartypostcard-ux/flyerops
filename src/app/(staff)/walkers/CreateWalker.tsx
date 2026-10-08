'use client';
import { useActionState } from 'react';
import { createWalker } from './actions';
import { useI18n } from '@/lib/i18n/client';

export default function CreateWalker({ suburbs, companies, canCreateStaff }: {
  suburbs: { id: number; name: string }[]; companies: { id: string; name: string }[]; canCreateStaff: boolean;
}) {
  const [state, action, pending] = useActionState(createWalker, {});
  const { t } = useI18n();
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-3">
      <div className="label sm:col-span-3">{t('walkers.add')}</div>
      <input name="full_name" required placeholder={t('walkers.fullName')} className="input" />
      <input name="email" type="email" required placeholder={t('walkers.email')} className="input" />
      <input name="phone" placeholder={t('walkers.phone')} className="input" />
      <select name="home" className="input" defaultValue="">
        <option value="">{t('walkers.home')}</option>
        {suburbs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select name="company" className="input" defaultValue="">
        <option value="">{t('walkers.companyPh')}</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input name="password" type="text" required minLength={10} placeholder={t('walkers.password')} className="input" />
      {canCreateStaff ? (
        <select name="role" className="input" defaultValue="walker">
          <option value="walker">{t('role.walker')}</option><option value="manager">{t('role.manager')}</option><option value="owner">{t('role.owner')}</option>
        </select>
      ) : <span />}
      <button className="btn sm:col-span-3" disabled={pending}>{t('walkers.create')}</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 sm:col-span-3">{state.ok}</p>}
    </form>
  );
}
