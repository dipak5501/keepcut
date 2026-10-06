import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '@/components/Toast';
import { AppRoutes } from '@/routes';

export function renderApp(path = '/') {
  const user = userEvent.setup();
  const utils = render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ToastProvider>,
  );
  return { user, ...utils };
}
