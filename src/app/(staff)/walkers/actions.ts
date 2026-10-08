'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export async function createWalker(_: unknown, form: FormData): Promise<{ error?: string; ok?: string }> {
  const me = await requireUser(true);
  const role = me.role === 'owner' ? String(form.get('role') || 'walker') : 'walker';
  const email = String(form.get('email')).trim().toLowerCase();
  const password = String(form.get('password'));
  if (password.length < 10) return { error: 'Password must be at least 10 characters.' };

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return { error: error.message };
  const { error: e2 } = await admin.from('profiles').insert({
    id: data.user.id, email, role,
    full_name: String(form.get('full_name')).trim(),
    phone: String(form.get('phone') || '') || null,
    home_suburb_id: Number(form.get('home')) || null,
  });
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); return { error: e2.message }; }
  revalidatePath('/walkers');
  return { ok: `Created ${email}. Send them the password securely.` };
}

export async function setWalkerStatus(id: string, status: 'active' | 'inactive') {
  const sb = await supabaseServer();   // RLS + role guard apply
  await sb.from('profiles').update({ status }).eq('id', id);
  revalidatePath('/walkers');
}
