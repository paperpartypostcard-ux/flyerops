import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

async function signIn(form: FormData) {
  'use server';
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: String(form.get('email')), password: String(form.get('password')),
  });
  redirect(error ? '/login?e=1' : '/');
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center bg-slate-50 px-4">
      <form action={signIn} className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">Flyer Distribution</h1>
        {e && <p className="text-sm text-red-600">{e === 'noprofile' ? 'Account is not set up yet.' : 'Wrong email or password.'}</p>}
        <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" />
        <input name="password" type="password" required placeholder="Password" className="input" autoComplete="current-password" />
        <button className="btn w-full">Sign in</button>
      </form>
    </main>
  );
}
