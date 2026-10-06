/**
 * Development-only logger. Never pass transaction descriptions, amounts or other user data:
 * Keepcut has no telemetry and production builds stay silent except for real errors.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (isDev) console.warn(`[keepcut] ${message}`, meta ?? '');
  },
  error(message: string, error?: unknown) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : undefined;
    console.error(`[keepcut] ${message}`, detail ?? '');
  },
};

export function newId(): string {
  return crypto.randomUUID();
}
