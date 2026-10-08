'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

type S = { error?: string; ok?: string };

export async function addCheck(_: S, form: FormData): Promise<S> {
  await requireUser(true);
  const walker = String(form.get('walker') || '');
  const result = String(form.get('result') || '');
  const method = String(form.get('method') || 'video');
  if (!walker) return { error: 'Choose a walker.' };
  if (result !== 'pass' && result !== 'fail') return { error: 'Choose pass or fail.' };
  if (method !== 'video' && method !== 'in_person') return { error: 'Unknown method.' };

  const sb = await supabaseServer();
  const { error } = await sb.from('verification_checks').insert({
    walker_id: walker,
    suburb_id: Number(form.get('suburb')) || null,
    checked_on: String(form.get('date') || '') || undefined,
    method, result,
    notes: String(form.get('notes') || '') || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/checks');
  return { ok: 'Check saved.' };
}
