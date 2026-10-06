import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { AppDataContext, useSettingsQuery, useToday } from '@/hooks/useAppData';
import { db } from '@/lib/db/database';

export function AppDataProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray(), []);
  const settings = useSettingsQuery();
  const today = useToday();

  if (!subscriptions || !settings) return <>{fallback}</>;
  return (
    <AppDataContext.Provider value={{ subscriptions, settings, today }}>
      {children}
    </AppDataContext.Provider>
  );
}
