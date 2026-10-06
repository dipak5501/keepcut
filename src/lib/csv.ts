import Papa from 'papaparse';
import { detectDateFormat, parseDate, type DateFormatId } from './dates';
import { parseAmount, toMinor } from './money';
import type { Currency, ISODate } from './types';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20_000;

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  /** Number of preamble lines skipped before the header row. */
  skippedLines: number;
}

export interface ColumnMapping {
  date: number;
  description: number;
  /** Single signed amount column. Mutually exclusive with debit/credit. */
  amount: number | null;
  debit: number | null;
  credit: number | null;
}

/** How charges (money out) appear in a single signed amount column. */
export type ChargeSign = 'negative' | 'positive';

export interface ImportOptions {
  mapping: ColumnMapping;
  dateFormat: DateFormatId;
  chargeSign: ChargeSign;
  currency: Currency;
}

export interface Transaction {
  date: ISODate;
  description: string;
  /** Positive amount of money leaving the account, in minor units. */
  amountMinor: number;
}

export interface RowError {
  row: number;
  message: string;
}

export interface NormalizeResult {
  transactions: Transaction[];
  errors: RowError[];
  /** Rows that were valid but represented money coming in (refunds, salary). */
  skippedCredits: number;
}

export class CsvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvImportError';
  }
}

const HEADER_HINTS = {
  date: /\b(date|posted|posting|booking|value date|transaction date|trans date)\b/i,
  description:
    /\b(description|merchant|payee|name|details|memo|narrative|transaction|reference|particulars)\b/i,
  amount: /\b(amount|value|sum|total)\b/i,
  debit: /\b(debit|withdrawal|withdrawals|charge|charges|outflow|paid out|money out|spent)\b/i,
  credit: /\b(credit|deposit|deposits|inflow|paid in|money in|received)\b/i,
};

function looksLikeHeaderRow(row: string[]): boolean {
  const cells = row.map((c) => c.trim()).filter(Boolean);
  if (cells.length < 2) return false;
  const hasDate = cells.some((c) => HEADER_HINTS.date.test(c));
  const hasOther = cells.some(
    (c) =>
      HEADER_HINTS.description.test(c) || HEADER_HINTS.amount.test(c) || HEADER_HINTS.debit.test(c),
  );
  const mostlyText = cells.filter((c) => parseAmount(c) === null).length >= cells.length - 1;
  return hasDate && hasOther && mostlyText;
}

/** Parses raw CSV text, skipping bank preamble lines above the header row. */
export function parseCsvText(text: string): ParsedTable {
  if (text.length > MAX_FILE_BYTES) {
    throw new CsvImportError(
      'This file is larger than 5 MB. Export a shorter date range and try again.',
    );
  }
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
    delimiter: '',
  });
  const all = result.data.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''));
  if (all.length === 0) throw new CsvImportError('The file is empty or is not a CSV file.');

  let headerIndex = all.slice(0, 20).findIndex(looksLikeHeaderRow);
  if (headerIndex === -1) headerIndex = 0;

  const headers = (all[headerIndex] ?? []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
  const rows = all
    .slice(headerIndex + 1)
    .map((r) => headers.map((_, i) => String(r[i] ?? '').trim()));

  if (rows.length === 0)
    throw new CsvImportError('No transaction rows were found below the header row.');
  if (rows.length > MAX_ROWS) {
    throw new CsvImportError(
      `This file has more than ${MAX_ROWS.toLocaleString()} rows. Export a shorter date range.`,
    );
  }
  return { headers, rows, skippedLines: headerIndex };
}

function columnScore(rows: string[][], index: number, test: (v: string) => boolean): number {
  const sample = rows
    .slice(0, 100)
    .map((r) => r[index] ?? '')
    .filter(Boolean);
  if (sample.length === 0) return 0;
  return sample.filter(test).length / sample.length;
}

function findHeader(headers: string[], re: RegExp, exclude: Set<number>): number {
  return headers.findIndex((h, i) => !exclude.has(i) && re.test(h));
}

/** Guesses which columns hold the date, description and amount(s). */
export function guessMapping(table: ParsedTable): ColumnMapping {
  const { headers, rows } = table;
  const used = new Set<number>();
  const take = (i: number) => {
    if (i >= 0) used.add(i);
    return i;
  };

  let date = findHeader(headers, /transaction date|trans\.? date/i, used);
  if (date === -1) date = findHeader(headers, HEADER_HINTS.date, used);
  if (date === -1) {
    const fmtScores = headers.map((_, i) => {
      const values = rows.slice(0, 50).map((r) => r[i] ?? '');
      return detectDateFormat(values) ? 1 : 0;
    });
    date = fmtScores.indexOf(1);
  }
  take(date);

  let debit = findHeader(headers, HEADER_HINTS.debit, used);
  let credit = findHeader(headers, HEADER_HINTS.credit, used);
  let amount = -1;
  if (debit !== -1 && credit !== -1) {
    take(debit);
    take(credit);
  } else {
    debit = -1;
    credit = -1;
    amount = findHeader(headers, HEADER_HINTS.amount, used);
    if (amount === -1) {
      let best = -1;
      let bestScore = 0.6;
      headers.forEach((_, i) => {
        if (used.has(i)) return;
        const score = columnScore(
          rows,
          i,
          (v) => parseAmount(v) !== null && /\d/.test(v) && !/[a-z]{3,}/i.test(v),
        );
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      });
      amount = best;
    }
    take(amount);
  }

  let description = findHeader(headers, HEADER_HINTS.description, used);
  if (description === -1) {
    let longest = -1;
    let longestLen = 0;
    headers.forEach((_, i) => {
      if (used.has(i)) return;
      const avg =
        rows.slice(0, 50).reduce((sum, r) => sum + (r[i]?.length ?? 0), 0) /
        Math.max(1, Math.min(rows.length, 50));
      if (avg > longestLen) {
        longest = i;
        longestLen = avg;
      }
    });
    description = longest;
  }

  return {
    date,
    description,
    amount: amount === -1 ? null : amount,
    debit: debit === -1 ? null : debit,
    credit: credit === -1 ? null : credit,
  };
}

export function isMappingComplete(m: ColumnMapping): boolean {
  return m.date >= 0 && m.description >= 0 && (m.amount !== null || m.debit !== null);
}

/** Banks differ: most export charges as negatives, some (card statements) as positives. */
export function detectChargeSign(table: ParsedTable, amountColumn: number): ChargeSign {
  let negatives = 0;
  let positives = 0;
  for (const row of table.rows) {
    const v = parseAmount(row[amountColumn]);
    if (v === null || v === 0) continue;
    if (v < 0) negatives++;
    else positives++;
  }
  return negatives >= positives ? 'negative' : 'positive';
}

/** Converts mapped rows into outgoing-charge transactions, collecting per-row errors. */
export function normalizeTransactions(table: ParsedTable, options: ImportOptions): NormalizeResult {
  const { mapping, dateFormat, chargeSign, currency } = options;
  if (!isMappingComplete(mapping)) {
    throw new CsvImportError('Choose the date, description and amount columns first.');
  }

  const transactions: Transaction[] = [];
  const errors: RowError[] = [];
  let skippedCredits = 0;

  table.rows.forEach((row, i) => {
    const rowNumber = i + table.skippedLines + 2; // 1-based, after the header line
    const rawDate = row[mapping.date] ?? '';
    const description = (row[mapping.description] ?? '').replace(/\s+/g, ' ').trim();
    const date = parseDate(rawDate, dateFormat);
    if (!date) {
      errors.push({ row: rowNumber, message: `Unrecognised date "${rawDate.slice(0, 30)}"` });
      return;
    }
    if (!description) {
      errors.push({ row: rowNumber, message: 'Missing description' });
      return;
    }

    let charge: number | null = null;
    if (mapping.debit !== null) {
      const debit = parseAmount(row[mapping.debit]);
      const credit = mapping.credit !== null ? parseAmount(row[mapping.credit]) : null;
      if (debit !== null && debit !== 0) charge = Math.abs(debit);
      else if (credit !== null && credit !== 0) {
        skippedCredits++;
        return;
      }
    } else if (mapping.amount !== null) {
      const value = parseAmount(row[mapping.amount]);
      if (value !== null && value !== 0) {
        const isCharge = chargeSign === 'negative' ? value < 0 : value > 0;
        if (!isCharge) {
          skippedCredits++;
          return;
        }
        charge = Math.abs(value);
      }
    }

    if (charge === null) {
      errors.push({ row: rowNumber, message: 'Missing or invalid amount' });
      return;
    }
    transactions.push({
      date,
      description: description.slice(0, 200),
      amountMinor: toMinor(charge, currency),
    });
  });

  return { transactions, errors, skippedCredits };
}
