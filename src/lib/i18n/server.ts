import { cookies } from 'next/headers';
import { LANG_COOKIE, makeT, type Lang } from './core';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === 'ru' ? 'ru' : 'en';
}

export async function getI18n() {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
