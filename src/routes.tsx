import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';

const SubscriptionsPage = lazy(() =>
  import('./pages/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage })),
);
const SubscriptionFormPage = lazy(() =>
  import('./pages/SubscriptionFormPage').then((m) => ({ default: m.SubscriptionFormPage })),
);
const SubscriptionDetailPage = lazy(() =>
  import('./pages/SubscriptionDetailPage').then((m) => ({ default: m.SubscriptionDetailPage })),
);
const ImportPage = lazy(() =>
  import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })),
);
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/new" element={<SubscriptionFormPage />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="subscriptions/:id/edit" element={<SubscriptionFormPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage standalone />} />
    </Routes>
  );
}
