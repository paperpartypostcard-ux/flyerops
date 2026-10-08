'use client';
import { createContext, useContext, useMemo } from 'react';
import { makeT, type Lang } from './core';

const Ctx = createContext<Lang>('en');

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const lang = useContext(Ctx);
  const t = useMemo(() => makeT(lang), [lang]);
  return { lang, t };
}
