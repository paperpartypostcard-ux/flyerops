'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export async function setRate(_: { error?: string; ok?: string }, form: FormData): Promise<{ error?: string; ok?: string }> {
  const me = await requireUser(true);
  if (me.role !== 'owner') return { error: 'Only the owner can change the rate.' };
  const rate = Number(form.get('rate'));
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) return { error: 'Enter a valid rate.' };
  const sb = await supabaseServer();
  const { error } = await sb.from('app_settings').update({ rate_per_1000: rate, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) return { error: error.message };
  revalidatePath('/payroll');
  revalidatePath('/dashboard');
  return { ok: 'Rate saved.' };
}
