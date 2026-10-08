// Pay periods in Melbourne local dates (weeks start on Monday).
const TZ = 'Australia/Melbourne';

export function todayMelb(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + 'T00:00:00Z');
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export type Period = { key: string; label: string; from: string; to: string };

export function presets(): Period[] {
  const t = todayMelb();
  const dow = (parse(t).getUTCDay() + 6) % 7; // 0 = Monday
  const weekStart = addDays(t, -dow);
  const d = parse(t);
  const monthStart = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const prevMonthStart = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  return [
    { key: 'this-week', label: 'This week', from: weekStart, to: t },
    { key: 'last-week', label: 'Last week', from: addDays(weekStart, -7), to: addDays(weekStart, -1) },
    { key: 'this-month', label: 'This month', from: monthStart, to: t },
    { key: 'last-month', label: 'Last month', from: prevMonthStart, to: addDays(monthStart, -1) },
  ];
}

export function resolvePeriod(sp: { p?: string; from?: string; to?: string }): Period {
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (ok(sp.from) && ok(sp.to) && sp.from! <= sp.to!) return { key: 'custom', label: 'Custom', from: sp.from!, to: sp.to! };
  const all = presets();
  return all.find((x) => x.key === sp.p) ?? all[1]; // default: last week
}
