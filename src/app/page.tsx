import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';

export default async function Home() {
  const me = await requireUser();
  redirect(me.role === 'walker' ? '/me' : '/dashboard');
}
