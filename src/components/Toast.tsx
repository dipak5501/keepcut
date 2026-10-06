import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { ToastContext, type ToastTone as Tone } from '@/hooks/useToast';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const TONE_STYLES: Record<Tone, string> = {
  success:
    'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100',
  error:
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
  info: 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
};

const TONE_ICONS: Record<Tone, typeof Info> = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end"
      >
        {toasts.map((t) => {
          const Icon = TONE_ICONS[t.tone];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_STYLES[t.tone]}`}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
