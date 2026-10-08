import { createServerClient } from '@supabase/ssr';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* server component */ }
      },
    },
  });
}

/** Service-role client — server only, bypasses RLS. Use only after checking permissions. */
export function supabaseAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export type Me = { id: string; full_name: string; role: 'owner' | 'manager' | 'walker' };

export async function requireUser(staffOnly = false): Promise<Me> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await sb.from('profiles').select('id, full_name, role, status').eq('id', user.id).single();
  if (!me) redirect('/login?e=noprofile');
  if (me.status === 'inactive') redirect('/login?e=inactive');
  if (staffOnly && me.role === 'walker') redirect('/me');
  return me as Me;
}
