import { HashRouter } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeSync } from './components/ThemeSync';
import { ToastProvider } from './components/Toast';
import { AppRoutes } from './routes';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeSync />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
