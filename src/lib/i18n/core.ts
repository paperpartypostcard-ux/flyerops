import { en, ru, type Key } from './dict';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];
export const LANG_COOKIE = 'lang';
export type T = (key: Key, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  const d = lang === 'ru' ? ru : en;
  return (key, vars) => {
    let s: string = d[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export const locale = (lang: Lang) => (lang === 'ru' ? 'ru-RU' : 'en-AU');

/** Translate known database error messages; unknown ones pass through. */
export function trError(msg: string | undefined | null, t: T): string {
  if (!msg) return '';
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/Not enough flyers in stock: (-?\d+)/))) return t('err.notEnough', { n: m[1] });
  if ((m = msg.match(/Walker holds only (-?\d+)/))) return t('err.walkerHolds', { n: m[1] });
  if ((m = msg.match(/Suburb received flyers on (\S+), next allowed after (\S+)/))) return t('err.received', { last: m[1], next: m[2] });
  if (/excluded from distribution/i.test(msg)) return t('err.excluded');
  if (/assignments_one_open_per_suburb/.test(msg)) return t('err.oneOpen');
  if (/assignment is closed/.test(msg)) return t('err.closed');
  if (/walker account is inactive/.test(msg)) return t('err.inactive');
  if (/only owner can manage staff/.test(msg)) return t('err.ownerOnly');
  if (/not allowed|row-level security/i.test(msg)) return t('err.notAllowed');
  return msg;
}
