'use client';
import { useActionState } from 'react';
import { addCheck } from './actions';
import { useI18n } from '@/lib/i18n/client';

type Opt = { id: string | number; name: string };

export default function CheckForm({ walkers, suburbs }: { walkers: Opt[]; suburbs: Opt[] }) {
  const [state, action, pending] = useActionState(addCheck, {});
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-3">
      <div className="label sm:col-span-3">{t('checks.log')}</div>
      <select name="walker" required className="input" defaultValue="">
        <option value="" disabled>{t('checks.walkerPh')}</option>
        {walkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select name="suburb" className="input" defaultValue="">
        <option value="">{t('checks.suburbPh')}</option>
        {suburbs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input name="date" type="date" defaultValue={today} className="input" />
      <select name="method" className="input" defaultValue="video">
        <option value="video">{t('checks.video')}</option>
        <option value="in_person">{t('checks.inPerson')}</option>
      </select>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="radio" name="result" value="pass" required /> {t('checks.pass')}</label>
        <label className="flex items-center gap-1"><input type="radio" name="result" value="fail" /> {t('checks.fail')}</label>
      </div>
      <input name="notes" placeholder={t('checks.notesPh')} className="input" />
      <button className="btn sm:col-span-3" disabled={pending}>{t('checks.save')}</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 sm:col-span-3">{state.ok}</p>}
    </form>
  );
}
