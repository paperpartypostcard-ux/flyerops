'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/lib/i18n/server';

export async function setRate(_: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const me = await requireUser(true);
  const { t } = await getI18n();
  if (me.role !== 'owner') return { error: t('pay.err.owner') };
  const rate = Number(form.get('rate'));
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) return { error: t('pay.err.rate') };
  const sb = await supabaseServer();
  const { error } = await sb.from('app_settings').update({ rate_per_1000: rate, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) return { error: error.message };
  revalidatePath('/payroll');
  revalidatePath('/dashboard');
  return { ok: t('pay.ok') };
}
