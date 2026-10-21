import { BACKUP_STALE_DAYS } from './types';

/** True when there is no recorded backup, or the last one is older than BACKUP_STALE_DAYS. */
export function isBackupStale(lastBackupAt: string | undefined, now = new Date()): boolean {
  if (!lastBackupAt) return true;
  const then = Date.parse(lastBackupAt);
  if (Number.isNaN(then)) return true;
  return now.getTime() - then > BACKUP_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function daysSinceBackup(lastBackupAt: string | undefined, now = new Date()): number | null {
  if (!lastBackupAt) return null;
  const then = Date.parse(lastBackupAt);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000));
}
