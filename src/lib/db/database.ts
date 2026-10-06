import Dexie, { type EntityTable } from 'dexie';
import type { ImportRecord, Settings, Subscription } from '../types';

export interface SettingsRow extends Settings {
  key: 'app';
}

export class KeepcutDatabase extends Dexie {
  subscriptions!: EntityTable<Subscription, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;
  imports!: EntityTable<ImportRecord, 'id'>;

  constructor(name = 'keepcut') {
    super(name);
    this.version(1).stores({
      subscriptions: 'id, status, category, nextRenewal, merchantKey',
      settings: 'key',
      imports: 'id, importedAt',
    });
  }
}

export const db = new KeepcutDatabase();
