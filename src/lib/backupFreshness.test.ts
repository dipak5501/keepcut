import { describe, expect, it } from 'vitest';
import { daysSinceBackup, isBackupStale } from './backupFreshness';

const now = new Date('2026-10-21T12:00:00Z');

describe('backupFreshness', () => {
  it('treats missing or invalid timestamps as stale', () => {
    expect(isBackupStale(undefined, now)).toBe(true);
    expect(isBackupStale('not-a-date', now)).toBe(true);
    expect(daysSinceBackup(undefined, now)).toBeNull();
  });

  it('is fresh within 14 days and stale after', () => {
    expect(isBackupStale('2026-10-10T12:00:00Z', now)).toBe(false);
    expect(isBackupStale('2026-10-06T11:00:00Z', now)).toBe(true);
    expect(daysSinceBackup('2026-10-18T12:00:00Z', now)).toBe(3);
  });
});
