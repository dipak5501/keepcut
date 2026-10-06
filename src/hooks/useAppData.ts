import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useState } from 'react';
import { repository } from '@/lib/db/repository';
import { todayISO } from '@/lib/dates';
import type { ISODate, Settings, Subscription } from '@/lib/types';

export interface AppData {
  subscriptions: Subscription[];
  settings: Settings;
  today: ISODate;
}

export const AppDataContext = createContext<AppData | null>(null);

/** Re-computes "today" when the tab regains focus after midnight. */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const update = () => setToday(todayISO());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
}

export function useSettingsQuery(): Settings | undefined {
  return useLiveQuery(() => repository.getSettings(), []);
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
