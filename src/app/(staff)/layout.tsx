import { requireUser } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';
import Brand from '@/components/Brand';
import NavLinks from '@/components/NavLinks';

const NAV: [string, string][] = [
  ['/dashboard', 'Dashboard'], ['/map', 'Map'], ['/walkers', 'Walkers'],
  ['/stock', 'Stock'], ['/checks', 'Checks'], ['/payroll', 'Payroll'],
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser(true);
  const initials = me.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex h-dvh flex-col">
      <header className="bg-ink">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <Brand />
          <span className="hidden h-5 w-px bg-white/15 sm:block" />
          <NavLinks items={NAV} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold text-white">{me.full_name}</div>
              <div className="text-xs capitalize text-white/55">{me.role}</div>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-euc text-xs font-bold text-white">{initials}</span>
            <form action={signOut}>
              <button className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
