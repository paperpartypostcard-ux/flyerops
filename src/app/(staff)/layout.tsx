import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { signOut } from '@/app/actions';

const NAV = [['/map', 'Map'], ['/walkers', 'Walkers'], ['/stock', 'Stock'], ['/checks', 'Checks']];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser(true);
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-4 border-b bg-white px-4 py-2">
        <b className="mr-2">Flyers</b>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="text-sm text-slate-600 hover:text-slate-900">{label}</Link>
        ))}
        <span className="ml-auto text-xs text-slate-500 hidden sm:inline">{me.full_name} · {me.role}</span>
        <form action={signOut}><button className="btn-ghost">Sign out</button></form>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
