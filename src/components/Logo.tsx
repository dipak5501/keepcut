export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" className="fill-brand-700 dark:fill-brand-500" />
      <path
        d="M18 44 L46 20"
        className="stroke-brand-50 dark:stroke-slate-950"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle
        cx="20"
        cy="22"
        r="7"
        fill="none"
        className="stroke-brand-50 dark:stroke-slate-950"
        strokeWidth="5"
      />
      <circle
        cx="44"
        cy="42"
        r="7"
        fill="none"
        className="stroke-brand-200 dark:stroke-brand-900"
        strokeWidth="5"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
      <LogoMark />
      Keepcut
    </span>
  );
}
