import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getLang } from '@/lib/i18n/server';
import { LANG_COOKIE, LANGS, type Lang } from '@/lib/i18n/core';

async function setLang(lang: Lang) {
  'use server';
  (await cookies()).set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

/** EN | RU switch; `dark` for use on the ink header. */
export default async function LangSwitch({ dark = true }: { dark?: boolean }) {
  const current = await getLang();
  return (
    <div className={`flex rounded-lg p-0.5 text-xs font-bold ${dark ? 'bg-white/10' : 'bg-paper border border-line'}`}>
      {LANGS.map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button aria-pressed={l === current}
            className={`rounded-md px-2 py-1 uppercase transition-colors ${
              l === current
                ? dark ? 'bg-white text-ink' : 'bg-white text-ink shadow-sm'
                : dark ? 'text-white/60 hover:text-white' : 'text-muted hover:text-ink'
            }`}>
            {l}
          </button>
        </form>
      ))}
    </div>
  );
}
