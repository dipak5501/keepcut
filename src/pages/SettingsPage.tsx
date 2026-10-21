import { Download, FileUp, HardDrive, KeyRound, Lock, Trash2 } from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { useToast } from '@/hooks/useToast';
import { Field, PageHeader } from '@/components/ui';
import { useAppData } from '@/hooks/useAppData';
import { DecryptionError, decryptJson, encryptJson, isEncryptedEnvelope } from '@/lib/crypto';
import { formatDisplayDate, todayISO } from '@/lib/dates';
import { repository } from '@/lib/db/repository';
import { downloadFile, subscriptionsToCsv } from '@/lib/exporters';
import { logger } from '@/lib/logger';
import { CURRENCIES, type Currency, type Theme } from '@/lib/types';

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function SettingsPage() {
  const { subscriptions, settings } = useAppData();
  const toast = useToast();
  const navigate = useNavigate();
  const restoreInputId = useId();
  const imports = useLiveQuery(() => repository.listImports(), []) ?? [];
  const hasDemo = subscriptions.some((s) => s.source === 'demo');

  const [encryptOpen, setEncryptOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<unknown>(null);
  const [encryptedRestore, setEncryptedRestore] = useState<unknown>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const save = async (
    patch: Parameters<typeof repository.updateSettings>[0],
    message = 'Settings saved.',
  ) => {
    const result = await repository.updateSettings(patch);
    toast.show(
      result.ok ? message : 'Could not save that setting.',
      result.ok ? 'success' : 'error',
    );
  };

  const stamp = todayISO();

  const downloadBackup = async () => {
    const backup = await repository.exportBackup();
    downloadFile(
      `keepcut-backup-${stamp}.json`,
      JSON.stringify(backup, null, 2),
      'application/json',
    );
    await repository.markBackupTaken();
    toast.show('Backup downloaded. Keep it somewhere safe — it isn’t encrypted.');
  };

  const downloadCsv = () => {
    downloadFile(
      `keepcut-subscriptions-${stamp}.csv`,
      subscriptionsToCsv(subscriptions, settings.currency),
      'text/csv;charset=utf-8',
    );
    toast.show('CSV exported.');
  };

  const onRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      toast.show('That file is too large to be a Keepcut backup.', 'error');
      return;
    }
    try {
      const json: unknown = JSON.parse(await file.text());
      if (isEncryptedEnvelope(json)) setEncryptedRestore(json);
      else setPendingRestore(json);
    } catch {
      toast.show('That file isn’t valid JSON. Choose a Keepcut backup file.', 'error');
    }
  };

  const confirmRestore = async () => {
    const data = pendingRestore;
    setPendingRestore(null);
    const result = await repository.restoreBackup(data);
    if (result.ok) toast.show(`Restored ${result.value.count} subscriptions.`);
    else toast.show(result.errors._form ?? 'Restore failed.', 'error');
  };

  const requestPersist = async () => {
    try {
      const granted = (await navigator.storage?.persist?.()) ?? false;
      setPersisted(granted);
      toast.show(
        granted
          ? 'Your browser will keep Keepcut data unless you clear it yourself.'
          : 'Your browser declined. Keep regular backups.',
        granted ? 'success' : 'info',
      );
    } catch {
      toast.show('This browser doesn’t support persistent storage.', 'info');
    }
  };

  const wipe = async () => {
    setWipeOpen(false);
    await repository.clearAllData();
    toast.show('All Keepcut data was deleted from this browser.');
    navigate('/');
  };

  return (
    <>
      <PageHeader title="Settings" description="Everything here stays on this device." />

      <div className="grid max-w-3xl gap-6">
        <section aria-labelledby="prefs-heading" className="card p-5">
          <h2 id="prefs-heading" className="text-lg font-semibold">
            Preferences
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Currency"
              hint="Used for all amounts. Keepcut doesn’t convert between currencies."
            >
              <select
                className="input"
                value={settings.currency}
                onChange={(e) =>
                  void save({ currency: e.target.value as Currency }, 'Currency updated.')
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Theme">
              <select
                className="input"
                value={settings.theme}
                onChange={(e) => void save({ theme: e.target.value as Theme }, 'Theme updated.')}
              >
                <option value="system">Match my device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
            <Field label="Calendar reminder lead time">
              <select
                className="input"
                value={settings.reminderLeadDays}
                onChange={(e) =>
                  void save(
                    { reminderLeadDays: Number(e.target.value) },
                    'Reminder lead time updated.',
                  )
                }
              >
                {[0, 1, 2, 3, 5, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'} before`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section aria-labelledby="backup-heading" className="card p-5">
          <h2 id="backup-heading" className="text-lg font-semibold">
            Backup &amp; export
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your data lives only in this browser. Clearing site data or switching devices removes it
            — download a backup first.
            {settings.lastBackupAt
              ? ` Last backup: ${formatDisplayDate(settings.lastBackupAt.slice(0, 10))}.`
              : ' No backup downloaded yet.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setEncryptOpen(true)}>
              <Lock aria-hidden="true" className="size-4" /> Encrypted backup
            </button>
            <button type="button" className="btn-secondary" onClick={downloadBackup}>
              <Download aria-hidden="true" className="size-4" /> Plain backup (.json)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={downloadCsv}
              disabled={subscriptions.length === 0}
            >
              <Download aria-hidden="true" className="size-4" /> Export spreadsheet (.csv)
            </button>
            <label htmlFor={restoreInputId} className="btn-secondary cursor-pointer">
              <FileUp aria-hidden="true" className="size-4" /> Restore from backup
              <input
                id={restoreInputId}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={onRestoreFile}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
            <HardDrive aria-hidden="true" className="size-4 text-slate-500" />
            {persisted ? (
              <span>
                Persistent storage is on — the browser won’t clear Keepcut data on its own.
              </span>
            ) : (
              <>
                <span>Browsers may clear site data when storage runs low.</span>
                <button type="button" className="link" onClick={requestPersist}>
                  Ask to keep my data
                </button>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="demo-heading" className="card p-5">
          <h2 id="demo-heading" className="text-lg font-semibold">
            Demo data
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {hasDemo
              ? 'Demo subscriptions are loaded alongside your own.'
              : 'Load sample subscriptions to explore every feature.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {hasDemo ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () =>
                  toast.show(`Removed ${await repository.clearDemoData()} demo subscriptions.`)
                }
              >
                Remove demo data
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () =>
                  toast.show(`Loaded ${await repository.loadDemoData()} demo subscriptions.`)
                }
              >
                Load demo data
              </button>
            )}
          </div>
        </section>

        {imports.length > 0 && (
          <section aria-labelledby="imports-heading" className="card p-5">
            <h2 id="imports-heading" className="text-lg font-semibold">
              Import history
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Only these summaries are kept — never the statement itself.
            </p>
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {imports.slice(0, 10).map((imp) => (
                <li key={imp.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">{imp.fileName}</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatDisplayDate(imp.importedAt.slice(0, 10))} · {imp.rowCount} rows ·{' '}
                    {imp.addedCount} added
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          aria-labelledby="danger-zone"
          className="card border-rose-200 p-5 dark:border-rose-900"
        >
          <h2 id="danger-zone" className="text-lg font-semibold text-rose-800 dark:text-rose-300">
            Delete everything
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Permanently removes all subscriptions, settings and import history from this browser.
          </p>
          <button type="button" className="btn-danger mt-4" onClick={() => setWipeOpen(true)}>
            <Trash2 aria-hidden="true" className="size-4" /> Delete all data
          </button>
        </section>
      </div>

      {encryptOpen && <EncryptBackupDialog onClose={() => setEncryptOpen(false)} />}
      {encryptedRestore !== null && (
        <DecryptDialog
          envelope={encryptedRestore}
          onClose={() => setEncryptedRestore(null)}
          onDecrypted={(data) => {
            setEncryptedRestore(null);
            setPendingRestore(data);
          }}
        />
      )}
      <ConfirmDialog
        open={pendingRestore !== null}
        title="Replace current data?"
        message="Restoring replaces every subscription and setting in Keepcut with the backup’s contents. Download a backup of the current data first if you might need it."
        confirmLabel="Replace and restore"
        onConfirm={confirmRestore}
        onCancel={() => setPendingRestore(null)}
      />
      <ConfirmDialog
        open={wipeOpen}
        title="Delete all Keepcut data?"
        message="This cannot be undone. Your subscriptions are not cancelled with the providers — they are only removed from this tracker."
        confirmLabel="Delete everything"
        onConfirm={wipe}
        onCancel={() => setWipeOpen(false)}
      />
    </>
  );
}

function EncryptBackupDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (passphrase.length < 8)
      next.passphrase = 'Use at least 8 characters — a few random words works well.';
    if (confirm !== passphrase) next.confirm = 'Passphrases don’t match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const envelope = await encryptJson(await repository.exportBackup(), passphrase);
      downloadFile(
        `keepcut-backup-${todayISO()}.encrypted.json`,
        JSON.stringify(envelope),
        'application/json',
      );
      await repository.markBackupTaken();
      toast.show('Encrypted backup downloaded. You’ll need the passphrase to restore it.');
      onClose();
    } catch (error) {
      logger.error('Encryption failed', error);
      toast.show('Encryption failed in this browser.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Encrypted backup"
      description="Protected with AES-256-GCM. There is no way to recover a forgotten passphrase."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="encrypt-form" className="btn-primary" disabled={busy}>
            <KeyRound aria-hidden="true" className="size-4" />{' '}
            {busy ? 'Encrypting…' : 'Encrypt & download'}
          </button>
        </>
      }
    >
      <form id="encrypt-form" noValidate onSubmit={onSubmit} className="grid gap-4">
        <Field label="Passphrase" error={errors.passphrase}>
          <input
            type="password"
            className="input"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm passphrase" error={errors.confirm}>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </form>
    </Modal>
  );
}

function DecryptDialog({
  envelope,
  onClose,
  onDecrypted,
}: {
  envelope: unknown;
  onClose: () => void;
  onDecrypted: (data: unknown) => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEncryptedEnvelope(envelope)) return;
    setBusy(true);
    try {
      onDecrypted(await decryptJson(envelope, passphrase));
    } catch (err) {
      setError(err instanceof DecryptionError ? err.message : 'Could not read this backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Unlock backup"
      description="Enter the passphrase you used when creating this backup."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="decrypt-form"
            className="btn-primary"
            disabled={busy || !passphrase}
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </>
      }
    >
      <form id="decrypt-form" noValidate onSubmit={onSubmit}>
        <Field label="Passphrase" error={error}>
          <input
            type="password"
            className="input"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
      </form>
    </Modal>
  );
}
