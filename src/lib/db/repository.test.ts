import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DetectedSubscription } from '../detect';
import type { SubscriptionInput } from '../schema';
import { KeepcutDatabase } from './database';
import { NotFoundError, createRepository, type Repository } from './repository';

let database: KeepcutDatabase;
let repo: Repository;
let clock = new Date('2026-06-15T10:00:00Z');

const input: SubscriptionInput = {
  name: 'Netflix',
  amountMinor: 1799,
  cycle: 'monthly',
  nextRenewal: '2026-07-01',
  category: 'Streaming',
  status: 'active',
};

function detection(overrides: Partial<DetectedSubscription> = {}): DetectedSubscription {
  return {
    merchantKey: 'known:spotify',
    name: 'Spotify',
    category: 'Music & audio',
    known: true,
    amountMinor: 1199,
    cycle: 'monthly',
    lastChargedOn: '2026-06-09',
    nextRenewal: '2026-07-09',
    charges: [
      { date: '2026-04-09', amountMinor: 1099 },
      { date: '2026-05-09', amountMinor: 1199 },
      { date: '2026-06-09', amountMinor: 1199 },
    ],
    confidence: 0.95,
    confidenceLabel: 'high',
    likelyInactive: false,
    reasons: [],
    ...overrides,
  };
}

beforeEach(() => {
  clock = new Date('2026-06-15T10:00:00Z');
  database = new KeepcutDatabase(`test-${Math.random()}`);
  repo = createRepository(database, { now: () => clock });
});

afterEach(async () => {
  await database.delete();
});

describe('settings', () => {
  it('returns defaults, then persists validated updates', async () => {
    expect(await repo.getSettings()).toMatchObject({
      currency: 'USD',
      reminderLeadDays: 3,
      onboarded: false,
    });
    const result = await repo.updateSettings({ currency: 'EUR', onboarded: true });
    expect(result.ok).toBe(true);
    expect(await repo.getSettings()).toMatchObject({ currency: 'EUR', onboarded: true });
  });

  it('rejects invalid settings', async () => {
    const result = await repo.updateSettings({ reminderLeadDays: 99 });
    expect(result.ok).toBe(false);
    expect((await repo.getSettings()).reminderLeadDays).toBe(3);
  });
});

describe('subscription CRUD', () => {
  it('creates with an initial price point and no undefined fields', async () => {
    const result = await repo.createSubscription({ ...input, trialEndsOn: '2026-06-20' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.priceHistory).toEqual([{ date: '2026-06-15', amountMinor: 1799 }]);
    expect(result.value.trialEndsOn).toBeUndefined();
    const stored = await repo.getSubscription(result.value.id);
    expect(stored).toEqual(result.value);
    expect(Object.values(stored!).includes(undefined)).toBe(false);
  });

  it('returns field errors instead of writing invalid data', async () => {
    const result = await repo.createSubscription({ ...input, name: '' });
    expect(result).toEqual({ ok: false, errors: { name: 'Name is required' } });
    expect(await repo.listSubscriptions()).toHaveLength(0);
  });

  it('records price changes on update', async () => {
    const created = await repo.createSubscription(input);
    if (!created.ok) throw new Error('setup failed');
    clock = new Date('2026-07-02T10:00:00Z');
    const updated = await repo.updateSubscription(created.value.id, {
      ...input,
      amountMinor: 1999,
    });
    expect(updated.ok && updated.value.priceHistory).toEqual([
      { date: '2026-06-15', amountMinor: 1799 },
      { date: '2026-07-02', amountMinor: 1999 },
    ]);
  });

  it('throws NotFoundError for missing records', async () => {
    await expect(repo.updateSubscription('missing', input)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.setDecision('missing', 'cut')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('sets decision and usage, validating range', async () => {
    const created = await repo.createSubscription(input);
    if (!created.ok) throw new Error('setup failed');
    await repo.setDecision(created.value.id, 'cut');
    await repo.setUsage(created.value.id, 2);
    expect(await repo.getSubscription(created.value.id)).toMatchObject({
      decision: 'cut',
      usage: 2,
    });
    await expect(repo.setUsage(created.value.id, 9)).rejects.toThrow(RangeError);
    await repo.setDecision(created.value.id, undefined);
    expect((await repo.getSubscription(created.value.id))?.decision).toBeUndefined();
  });

  it('cancels with proof and can reactivate', async () => {
    const created = await repo.createSubscription(input);
    if (!created.ok) throw new Error('setup failed');
    const canceled = await repo.markCanceled(created.value.id, {
      canceledOn: '2026-06-15',
      confirmation: 'NF-123',
    });
    expect(canceled.ok && canceled.value).toMatchObject({
      status: 'canceled',
      cancellation: { canceledOn: '2026-06-15', confirmation: 'NF-123' },
    });
    const invalid = await repo.markCanceled(created.value.id, { canceledOn: 'yesterday' });
    expect(invalid.ok).toBe(false);
    const active = await repo.reactivate(created.value.id);
    expect(active.status).toBe('active');
    expect(active.cancellation).toBeUndefined();
  });

  it('deletes', async () => {
    const created = await repo.createSubscription(input);
    if (!created.ok) throw new Error('setup failed');
    await repo.deleteSubscription(created.value.id);
    expect(await repo.listSubscriptions()).toEqual([]);
  });
});

describe('imports', () => {
  it('adds detections, skips already-tracked merchants and logs the import', async () => {
    await repo.createSubscription(input, { merchantKey: 'known:netflix' });
    const { added, skipped } = await repo.addDetected(
      [detection(), detection({ merchantKey: 'known:netflix', name: 'Netflix' })],
      { fileName: 'statement.csv', rowCount: 120, detectedCount: 2 },
    );
    expect(added.map((s) => s.name)).toEqual(['Spotify']);
    expect(skipped.map((s) => s.name)).toEqual(['Netflix']);
    expect(added[0]!.priceHistory).toEqual([
      { date: '2026-04-09', amountMinor: 1099 },
      { date: '2026-05-09', amountMinor: 1199 },
    ]);
    const imports = await repo.listImports();
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      fileName: 'statement.csv',
      rowCount: 120,
      detectedCount: 2,
      addedCount: 1,
    });
  });
});

describe('demo data', () => {
  it('loads idempotently and clears only demo records', async () => {
    await repo.createSubscription(input);
    const count = await repo.loadDemoData();
    expect(count).toBeGreaterThan(10);
    await repo.loadDemoData();
    expect(await repo.listSubscriptions()).toHaveLength(count + 1);
    await repo.clearDemoData();
    const remaining = await repo.listSubscriptions();
    expect(remaining.map((s) => s.name)).toEqual(['Netflix']);
  });
});

describe('backup and restore', () => {
  it('round-trips through exportBackup / restoreBackup', async () => {
    await repo.updateSettings({ currency: 'GBP' });
    await repo.loadDemoData();
    const backup = JSON.parse(JSON.stringify(await repo.exportBackup()));
    await repo.clearAllData();
    expect(await repo.listSubscriptions()).toEqual([]);

    const result = await repo.restoreBackup(backup);
    expect(result).toEqual({ ok: true, value: { count: backup.subscriptions.length } });
    expect(await repo.listSubscriptions()).toHaveLength(backup.subscriptions.length);
    expect(await repo.getSettings()).toMatchObject({ currency: 'GBP', onboarded: true });
  });

  it('rejects malformed or malicious backups without touching data', async () => {
    await repo.createSubscription(input);
    for (const bad of [
      null,
      {},
      { format: 'keepcut-backup', version: 2 },
      {
        format: 'keepcut-backup',
        version: 1,
        exportedAt: 'x',
        settings: {},
        subscriptions: [{ id: 1 }],
      },
    ]) {
      const result = await repo.restoreBackup(bad);
      expect(result.ok).toBe(false);
    }
    expect(await repo.listSubscriptions()).toHaveLength(1);
  });

  it('rejects duplicate ids', async () => {
    await repo.loadDemoData();
    const backup = JSON.parse(JSON.stringify(await repo.exportBackup()));
    backup.subscriptions.push(backup.subscriptions[0]);
    const result = await repo.restoreBackup(backup);
    expect(result.ok).toBe(false);
  });
});
