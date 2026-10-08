import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import Brand from '@/components/Brand';
import LangSwitch from '@/components/LangSwitch';
import { getI18n } from '@/lib/i18n/server';

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
  const { t } = await getI18n();
  const err = e === 'noprofile' ? t('login.err.noprofile') : e === 'inactive' ? t('login.err.inactive') : t('login.err.wrong');
  return (
    <main className="grid min-h-dvh bg-ink px-4 md:grid-cols-[1fr_minmax(420px,40%)] md:px-0">
      <section className="hidden flex-col justify-between p-12 text-white md:flex">
        <div className="flex items-center justify-between"><Brand /><LangSwitch /></div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{t('login.headline')}</h1>
          <p className="mt-4 text-white/65">{t('login.sub')}</p>
        </div>
        <p className="text-xs text-white/40">{t('login.storage')}</p>
      </section>

      <section className="grid place-items-center md:bg-paper">
        <form action={signIn} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-xl md:shadow-none md:bg-transparent">
          <div className="flex items-center justify-between md:hidden"><Brand dark={false} /><LangSwitch dark={false} /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('login.title')}</h2>
            <p className="mt-1 text-sm text-muted">{t('login.hint')}</p>
          </div>
          {e && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <label className="block space-y-1.5 text-sm font-medium">{t('login.email')}
            <input name="email" type="email" required className="input" autoComplete="email" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">{t('login.password')}
            <input name="password" type="password" required className="input" autoComplete="current-password" />
          </label>
          <button className="btn w-full py-2.5">{t('login.submit')}</button>
        </form>
      </section>
    </main>
  );
}
