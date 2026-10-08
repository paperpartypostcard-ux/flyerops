'use client';
import { useActionState } from 'react';
import { setRate } from './actions';
import { useI18n } from '@/lib/i18n/client';
import Hint from '@/components/Hint';


export default function RateForm({ rate }: { rate: number }) {
  const [state, action, pending] = useActionState(setRate, {});
  const { t } = useI18n();
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">{t('pay.rate')}</span>
      <span>$</span>
      <input name="rate" type="number" step="0.01" min={0} defaultValue={rate} className="input !w-24 !py-1" />
      <span className="text-slate-600">{t('pay.per1000')}<Hint text={t('help.pay.rate')} align="right" /></span>
      <button className="btn-ghost" disabled={pending}>{t('common.save')}</button>
      {state.error && <span className="text-red-600">{state.error}</span>}
      {state.ok && <span className="text-green-700">{state.ok}</span>}
    </form>
  );
}
