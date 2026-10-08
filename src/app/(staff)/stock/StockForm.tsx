'use client';
import { useActionState, useRef, useState } from 'react';

import { addStockMove } from './actions';
import { useI18n } from '@/lib/i18n/client';

const BOX = 1200;

type Opt = { id: string; name: string };
const OPS = ['receive', 'issue', 'return', 'adjust'] as const;

export default function StockForm({ companies, walkers }: { companies: Opt[]; walkers: Opt[] }) {
  const [state, action, pending] = useActionState(addStockMove, {});
  const { t } = useI18n();
  const [type, setType] = useState<string>('receive');
  const needsWalker = type === 'issue' || type === 'return';
  const qtyRef = useRef<HTMLInputElement>(null);
  const addBox = () => { if (qtyRef.current) qtyRef.current.value = String((Number(qtyRef.current.value) || 0) + BOX); };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="card grid gap-2 sm:grid-cols-3">
      <div className="label sm:col-span-3">{t('stock.new')}</div>
      <select name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
        {OPS.map((v) => <option key={v} value={v}>{t(`stock.op.${v}`)}</option>)}
      </select>
      <select name="company" required className="input" defaultValue="">
        <option value="" disabled>{t('stock.companyPh')}</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {needsWalker ? (
        <select name="walker" required className="input" defaultValue="">
          <option value="" disabled>{t('stock.walkerPh')}</option>
          {walkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      ) : <span className="hidden sm:block" />}
      <div className="flex gap-1">
        <input ref={qtyRef} name="qty" type="number" required step={1} min={type === 'adjust' ? undefined : 1}
          placeholder={type === 'adjust' ? t('stock.qtyAdjust') : t('stock.qty')} className="input" />
        {type !== 'adjust' && (
          <button type="button" onClick={addBox} className="btn-ghost whitespace-nowrap" title={t('stock.boxTip')}>{t('stock.box')}</button>
        )}
      </div>
      <input name="date" type="date" defaultValue={today} className="input" />
      <input name="note" placeholder={t('stock.note')} className="input" />
      <button className="btn sm:col-span-3" disabled={pending}>{t('common.save')}</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 sm:col-span-3">{state.ok}</p>}
    </form>
  );
}
