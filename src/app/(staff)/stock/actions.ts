'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/lib/i18n/server';
import { trError } from '@/lib/i18n/core';

type S = { error?: string; ok?: string };
const TYPES = ['receive', 'issue', 'return', 'adjust'] as const;

export async function addStockMove(_: S, form: FormData): Promise<S> {
  await requireUser(true);
  const { t } = await getI18n();
  const type = String(form.get('type')) as (typeof TYPES)[number];
  if (!TYPES.includes(type)) return { error: t('stock.err.op') };
  const qty = Math.trunc(Number(form.get('qty')));
  if (!Number.isFinite(qty) || qty === 0) return { error: t('stock.err.qty') };
  if (type !== 'adjust' && qty < 0) return { error: t('stock.err.positive') };
  const walker = String(form.get('walker') || '') || null;
  if ((type === 'issue' || type === 'return') && !walker) return { error: t('stock.err.walker') };

  const sb = await supabaseServer();
  const { error } = await sb.from('stock_moves').insert({
    company_id: String(form.get('company')),
    walker_id: type === 'issue' || type === 'return' ? walker : null,
    type, qty,
    moved_on: String(form.get('date') || '') || undefined,
    note: String(form.get('note') || '') || null,
  });
  if (error) return { error: trError(error.message, t) };
  revalidatePath('/stock');
  revalidatePath('/walkers');
  return { ok: t('common.saved') };
}
