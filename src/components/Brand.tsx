/** FlyerOps mark: a folded flyer over a letterbox slot. */
export default function Brand({ dark = true }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#2f7d6d" />
        <path d="M8 9.5h9.5l2.5 2.5v6.5H8z" fill="#fff" />
        <path d="M17.5 9.5V12H20" fill="none" stroke="#2f7d6d" strokeWidth="1.2" />
        <rect x="6" y="19.5" width="16" height="2" rx="1" fill="#14213d" opacity=".55" />
      </svg>
      <span className={`text-[15px] font-bold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>FlyerOps</span>
    </span>
  );
}
