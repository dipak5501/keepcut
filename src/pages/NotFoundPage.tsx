import { Link } from 'react-router';

export function NotFoundPage({ standalone = false }: { standalone?: boolean }) {
  const content = (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        That page doesn’t exist. Your data is safe.
      </p>
      <Link to="/app" className="btn-primary mt-6">
        Go to dashboard
      </Link>
    </div>
  );
  return standalone ? <main className="px-4">{content}</main> : content;
}
