import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { AppDataProvider } from '@/components/AppDataProvider';
import { Logo } from './Logo';
import { Spinner } from './ui';

const NAV: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/subscriptions', label: 'Subscriptions', icon: ListChecks },
  { to: '/app/import', label: 'Import', icon: Upload },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
    isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400'
  }`;

export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the main region on route change so screen-reader users hear the new page.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-brand-800 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="rounded-lg" aria-label="Keepcut home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={desktopLink}>
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-6 outline-none sm:py-8"
      >
        <AppDataProvider fallback={<Spinner label="Opening your data" />}>
          <Suspense fallback={<Spinner label="Loading page" />}>
            <Outlet />
          </Suspense>
        </AppDataProvider>
      </main>

      <nav
        aria-label="Main mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95"
      >
        <ul className="flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex flex-1">
              <NavLink to={to} end={end} className={mobileLink}>
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
