import type { DetectedSubscription } from '../detect';
import { todayISO } from '../dates';
import { buildDemoSubscriptions } from '../demo';
import { buildBackup } from '../exporters';
import { newId } from '../logger';
import {
  backupSchema,
  cancellationInputSchema,
  fieldErrors,
  settingsSchema,
  subscriptionInputSchema,
  type Backup,
  type CancellationInput,
  type SubscriptionInput,
} from '../schema';
import {
  DEFAULT_SETTINGS,
  type Decision,
  type ImportRecord,
  type Settings,
  type Subscription,
} from '../types';
import { db as defaultDb, type KeepcutDatabase } from './database';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Subscription ${id} was not found. It may have been deleted.`);
    this.name = 'NotFoundError';
  }
}

export interface RepositoryOptions {
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

export function createRepository(database: KeepcutDatabase, options: RepositoryOptions = {}) {
  const now = options.now ?? (() => new Date());
  const today = () => todayISO(now());

  async function getSettings(): Promise<Settings> {
    const row = await database.settings.get('app');
    if (!row) return { ...DEFAULT_SETTINGS };
    const { key: _key, ...settings } = row;
    const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...settings });
    return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
  }

  async function updateSettings(patch: Partial<Settings>): Promise<Result<Settings>> {
    const current = await getSettings();
    const parsed = settingsSchema.safeParse({ ...current, ...patch });
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    await database.settings.put({ key: 'app', ...parsed.data });
    return { ok: true, value: parsed.data };
  }

  async function listSubscriptions(): Promise<Subscription[]> {
    return database.subscriptions.toArray();
  }

  async function getSubscription(id: string): Promise<Subscription | undefined> {
    return database.subscriptions.get(id);
  }

  async function createSubscription(
    input: SubscriptionInput,
    extra: {
      source?: Subscription['source'];
      merchantKey?: string;
      priceHistory?: Subscription['priceHistory'];
    } = {},
  ): Promise<Result<Subscription>> {
    const parsed = subscriptionInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const v = parsed.data;
    const stamp = now().toISOString();
    const sub = stripUndefined({
      id: newId(),
      ...v,
      customDays: v.cycle === 'custom' ? v.customDays : undefined,
      trialEndsOn: v.status === 'trial' ? v.trialEndsOn : undefined,
      merchantKey:
        extra.merchantKey ??
        v.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim(),
      priceHistory: extra.priceHistory ?? [{ date: today(), amountMinor: v.amountMinor }],
      source: extra.source ?? 'manual',
      createdAt: stamp,
      updatedAt: stamp,
    }) as Subscription;
    await database.subscriptions.add(sub);
    return { ok: true, value: sub };
  }

  async function updateSubscription(
    id: string,
    input: SubscriptionInput,
  ): Promise<Result<Subscription>> {
    const parsed = subscriptionInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const result = await database.transaction('rw', database.subscriptions, async () => {
      const existing = await database.subscriptions.get(id);
      if (!existing) return null;
      const v = parsed.data;
      const priceHistory =
        v.amountMinor !== existing.amountMinor
          ? [...existing.priceHistory, { date: today(), amountMinor: v.amountMinor }].slice(-500)
          : existing.priceHistory;
      const next: Subscription = stripUndefined({
        id: existing.id,
        merchantKey: existing.merchantKey,
        source: existing.source,
        createdAt: existing.createdAt,
        cancellation: v.status === 'canceled' ? existing.cancellation : undefined,
        ...v,
        customDays: v.cycle === 'custom' ? v.customDays : undefined,
        trialEndsOn: v.status === 'trial' ? v.trialEndsOn : undefined,
        priceHistory,
        updatedAt: now().toISOString(),
      }) as Subscription;
      await database.subscriptions.put(next);
      return next;
    });
    if (!result) throw new NotFoundError(id);
    return { ok: true, value: result };
  }

  async function patch(id: string, changes: Partial<Subscription>): Promise<Subscription> {
    // Dexie wraps errors thrown inside transactions, so signal "missing" with null instead.
    const result = await database.transaction('rw', database.subscriptions, async () => {
      const existing = await database.subscriptions.get(id);
      if (!existing) return null;
      const next = stripUndefined({
        ...existing,
        ...changes,
        updatedAt: now().toISOString(),
      }) as Subscription;
      await database.subscriptions.put(next);
      return next;
    });
    if (!result) throw new NotFoundError(id);
    return result;
  }

  async function setDecision(id: string, decision: Decision | undefined): Promise<Subscription> {
    return patch(id, { decision });
  }

  /** Applies the same keep/cut/review decision to many subscriptions in one transaction. */
  async function setDecisions(ids: string[], decision: Decision | undefined): Promise<number> {
    const unique = [...new Set(ids)];
    return database.transaction('rw', database.subscriptions, async () => {
      let count = 0;
      const stamp = now().toISOString();
      for (const id of unique) {
        const existing = await database.subscriptions.get(id);
        if (!existing) continue;
        const next = stripUndefined({
          ...existing,
          decision,
          updatedAt: stamp,
        }) as Subscription;
        await database.subscriptions.put(next);
        count += 1;
      }
      return count;
    });
  }

  async function markBackupTaken(): Promise<void> {
    await updateSettings({ lastBackupAt: now().toISOString() });
  }

  async function setUsage(id: string, usage: number | undefined): Promise<Subscription> {
    if (usage !== undefined && (!Number.isInteger(usage) || usage < 1 || usage > 5)) {
      throw new RangeError('Usage must be between 1 and 5');
    }
    return patch(id, { usage });
  }

  async function markCanceled(id: string, input: CancellationInput): Promise<Result<Subscription>> {
    const parsed = cancellationInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
    const value = await patch(id, {
      status: 'canceled',
      cancellation: stripUndefined(parsed.data),
      trialEndsOn: undefined,
    });
    return { ok: true, value };
  }

  async function reactivate(id: string): Promise<Subscription> {
    return patch(id, { status: 'active', cancellation: undefined });
  }

  async function deleteSubscription(id: string): Promise<void> {
    await database.subscriptions.delete(id);
  }

  /** Adds accepted detections, skipping merchants already tracked (unless cancelled). */
  async function addDetected(
    detections: DetectedSubscription[],
    meta: { fileName: string; rowCount: number; detectedCount: number },
  ): Promise<{ added: Subscription[]; skipped: DetectedSubscription[] }> {
    return database.transaction('rw', database.subscriptions, database.imports, async () => {
      const existing = await database.subscriptions.toArray();
      const tracked = new Set(
        existing.filter((s) => s.status !== 'canceled').map((s) => s.merchantKey),
      );
      const stamp = now().toISOString();
      const added: Subscription[] = [];
      const skipped: DetectedSubscription[] = [];
      for (const d of detections) {
        if (tracked.has(d.merchantKey)) {
          skipped.push(d);
          continue;
        }
        tracked.add(d.merchantKey);
        added.push(
          stripUndefined({
            id: newId(),
            name: d.name.slice(0, 80),
            merchantKey: d.merchantKey,
            amountMinor: d.amountMinor,
            cycle: d.cycle,
            customDays: d.cycle === 'custom' ? d.customDays : undefined,
            nextRenewal: d.nextRenewal,
            category: d.category,
            status: 'active',
            priceHistory: dedupePriceHistory(d.charges),
            source: 'import',
            createdAt: stamp,
            updatedAt: stamp,
          }) as Subscription,
        );
      }
      await database.subscriptions.bulkAdd(added);
      const record: ImportRecord = {
        id: newId(),
        fileName: meta.fileName.slice(0, 120),
        importedAt: stamp,
        rowCount: meta.rowCount,
        detectedCount: meta.detectedCount,
        addedCount: added.length,
      };
      await database.imports.add(record);
      return { added, skipped };
    });
  }

  async function listImports(): Promise<ImportRecord[]> {
    return database.imports.orderBy('importedAt').reverse().toArray();
  }

  async function loadDemoData(): Promise<number> {
    const stamp = now().toISOString();
    const demo = buildDemoSubscriptions(today(), newId, stamp);
    await database.transaction('rw', database.subscriptions, async () => {
      await database.subscriptions
        .where('id')
        .anyOf(
          (await database.subscriptions.toArray())
            .filter((s) => s.source === 'demo')
            .map((s) => s.id),
        )
        .delete();
      await database.subscriptions.bulkAdd(demo.map((s) => stripUndefined(s) as Subscription));
    });
    return demo.length;
  }

  async function clearDemoData(): Promise<number> {
    const demoIds = (await database.subscriptions.toArray())
      .filter((s) => s.source === 'demo')
      .map((s) => s.id);
    await database.subscriptions.bulkDelete(demoIds);
    return demoIds.length;
  }

  async function exportBackup(): Promise<Backup> {
    return buildBackup(await getSettings(), await listSubscriptions(), now());
  }

  /** Validates an untrusted backup file and replaces all current data with it. */
  async function restoreBackup(raw: unknown): Promise<Result<{ count: number }>> {
    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, errors: { _form: 'This file is not a valid Keepcut backup.' } };
    }
    const ids = new Set<string>();
    for (const s of parsed.data.subscriptions) {
      if (ids.has(s.id))
        return { ok: false, errors: { _form: 'The backup contains duplicate records.' } };
      ids.add(s.id);
    }
    await database.transaction('rw', database.subscriptions, database.settings, async () => {
      await database.subscriptions.clear();
      await database.subscriptions.bulkAdd(
        parsed.data.subscriptions.map((s) => stripUndefined(s) as Subscription),
      );
      await database.settings.put({ key: 'app', ...parsed.data.settings, onboarded: true });
    });
    return { ok: true, value: { count: parsed.data.subscriptions.length } };
  }

  async function clearAllData(): Promise<void> {
    await database.transaction(
      'rw',
      database.subscriptions,
      database.settings,
      database.imports,
      async () => {
        await database.subscriptions.clear();
        await database.imports.clear();
        await database.settings.clear();
      },
    );
  }

  return {
    getSettings,
    updateSettings,
    listSubscriptions,
    getSubscription,
    createSubscription,
    updateSubscription,
    setDecision,
    setDecisions,
    markBackupTaken,
    setUsage,
    markCanceled,
    reactivate,
    deleteSubscription,
    addDetected,
    listImports,
    loadDemoData,
    clearDemoData,
    exportBackup,
    restoreBackup,
    clearAllData,
  };
}

export type Repository = ReturnType<typeof createRepository>;

function dedupePriceHistory(points: Subscription['priceHistory']): Subscription['priceHistory'] {
  const out: Subscription['priceHistory'] = [];
  for (const p of points) {
    if (out.length === 0 || out[out.length - 1]!.amountMinor !== p.amountMinor) out.push(p);
  }
  return out.slice(-500);
}

/** IndexedDB stores `undefined` keys verbatim; strip them so records stay clean and schema-valid. */
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export const repository = createRepository(defaultDb);
