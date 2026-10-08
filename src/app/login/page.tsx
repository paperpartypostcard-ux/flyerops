import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import Brand from '@/components/Brand';

async function signIn(form: FormData) {
  'use server';
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: String(form.get('email')), password: String(form.get('password')),
  });
  redirect(error ? '/login?e=1' : '/');
}

const ERRORS: Record<string, string> = {
  noprofile: 'This account is not set up yet. Ask your manager to finish it.',
  inactive: 'Your account is deactivated. Contact your manager.',
};

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="grid min-h-dvh bg-ink px-4 md:grid-cols-[1fr_minmax(420px,40%)] md:px-0">
      <section className="hidden flex-col justify-between p-12 text-white md:flex">
        <Brand />
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Every suburb covered once a cycle — never twice.</h1>
          <p className="mt-4 text-white/65">Plan suburbs, hand out stock, track walks and pay walkers across Melbourne.</p>
        </div>
        <p className="text-xs text-white/40">Data stored in Australia</p>
      </section>

      <section className="grid place-items-center md:bg-paper">
        <form action={signIn} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-xl md:shadow-none md:bg-transparent">
          <div className="md:hidden"><Brand dark={false} /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Use the email and password from your manager.</p>
          </div>
          {e && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ERRORS[e] ?? 'Wrong email or password.'}</p>}
          <label className="block space-y-1.5 text-sm font-medium">Email
            <input name="email" type="email" required className="input" autoComplete="email" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">Password
            <input name="password" type="password" required className="input" autoComplete="current-password" />
          </label>
          <button className="btn w-full py-2.5">Sign in</button>
        </form>
      </section>
    </main>
  );
}
