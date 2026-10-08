'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ items }: { items: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      {items.map(([href, label]) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? 'bg-white text-ink shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
