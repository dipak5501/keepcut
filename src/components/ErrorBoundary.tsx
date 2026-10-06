import { Component, type ErrorInfo, type ReactNode } from 'react';
import { repository } from '@/lib/db/repository';
import { downloadFile } from '@/lib/exporters';
import { logger } from '@/lib/logger';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(
      `Unhandled UI error${info.componentStack ? ' (see component stack in dev tools)' : ''}`,
      error,
    );
  }

  private downloadBackup = async () => {
    try {
      const backup = await repository.exportBackup();
      downloadFile(
        'keepcut-backup-recovery.json',
        JSON.stringify(backup, null, 2),
        'application/json',
      );
    } catch (error) {
      logger.error('Recovery backup failed', error);
    }
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-slate-700 dark:text-slate-300">
          Keepcut hit an unexpected error. Your data is still stored in this browser. You can
          download a backup and then reload the page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload Keepcut
          </button>
          <button type="button" className="btn-secondary" onClick={this.downloadBackup}>
            Download backup
          </button>
        </div>
      </main>
    );
  }
}
