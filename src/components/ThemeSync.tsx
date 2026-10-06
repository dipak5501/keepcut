import { useEffect } from 'react';
import { useSettingsQuery } from '@/hooks/useAppData';

/** Applies the saved theme (or the OS preference) to <html class="dark">. */
export function ThemeSync() {
  const theme = useSettingsQuery()?.theme ?? 'system';

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#020617' : '#047857');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}
