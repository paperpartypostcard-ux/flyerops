'use client';
import { useEffect, useId, useRef, useState } from 'react';

const W = 256; // bubble width, px

/** Small "?" next to a label. Opens on hover/focus (desktop) and on tap (phone).
 *  The bubble is position:fixed so scrolling tables and cards never clip it. */
export default function Hint({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const want = align === 'right' ? r.right - W : r.left;
    const left = Math.max(8, Math.min(want, window.innerWidth - W - 8));
    setPos({ top: r.bottom + 6, left });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: Event) => { if (!btn.current?.contains(e.target as Node)) hide(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [pos]);

  return (
    <span className="inline-flex align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button ref={btn} type="button" aria-describedby={pos ? id : undefined} aria-label="Help"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (pos) hide(); else show(); }}
        onFocus={show} onBlur={hide}
        className="ml-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold leading-none text-muted/70 transition-colors hover:text-euc focus-visible:text-euc">
        ?
      </button>
      {pos && (
        <span role="tooltip" id={id} style={{ top: pos.top, left: pos.left, width: W }}
          className="pointer-events-none fixed z-[1000] rounded-xl bg-ink px-3 py-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}
