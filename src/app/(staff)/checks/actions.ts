'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/lib/i18n/server';
import { trError } from '@/lib/i18n/core';

type S = { error?: string; ok?: string };

export async function addCheck(_: S, form: FormData): Promise<S> {
  await requireUser(true);
  const { t } = await getI18n();
  const walker = String(form.get('walker') || '');
  const result = String(form.get('result') || '');
  const method = String(form.get('method') || 'video');
  if (!walker) return { error: t('checks.err.walker') };
  if (result !== 'pass' && result !== 'fail') return { error: t('checks.err.result') };
  if (method !== 'video' && method !== 'in_person') return { error: t('checks.err.method') };

  const sb = await supabaseServer();
  const { error } = await sb.from('verification_checks').insert({
    walker_id: walker,
    suburb_id: Number(form.get('suburb')) || null,
    checked_on: String(form.get('date') || '') || undefined,
    method, result,
    notes: String(form.get('notes') || '') || null,
  });
  if (error) return { error: trError(error.message, t) };
  revalidatePath('/checks');
  return { ok: t('checks.saved') };
}
