import { describe, expect, it } from 'vitest';
import {
  CsvImportError,
  detectChargeSign,
  guessMapping,
  isMappingComplete,
  normalizeTransactions,
  parseCsvText,
  MAX_FILE_BYTES,
} from './csv';

const SIGNED = `Account summary for ****1234
Generated 2026-03-01

Date,Description,Amount,Balance
03/01/2026,NETFLIX.COM,-17.99,1000.00
02/28/2026,ACME PAYROLL,2450.00,1017.99
02/27/2026,"COFFEE, INC",-4.50,-1432.01
not-a-date,BROKEN ROW,-1.00,0
02/26/2026,,-3.00,0
02/25/2026,MISSING AMOUNT,,0`;

describe('parseCsvText', () => {
  it('skips bank preamble and finds the header row', () => {
    const table = parseCsvText(SIGNED);
    expect(table.headers).toEqual(['Date', 'Description', 'Amount', 'Balance']);
    expect(table.skippedLines).toBe(2);
    expect(table.rows).toHaveLength(6);
    expect(table.rows[2]![1]).toBe('COFFEE, INC');
  });

  it('handles semicolon-delimited European exports and a BOM', () => {
    const table = parseCsvText(
      '\uFEFFBuchungsdatum;Verwendungszweck;Betrag\n31.01.2026;SPOTIFY;-9,99\n',
    );
    expect(table.headers).toHaveLength(3);
    expect(table.rows[0]).toEqual(['31.01.2026', 'SPOTIFY', '-9,99']);
  });

  it('rejects empty, header-only and oversized input', () => {
    expect(() => parseCsvText('')).toThrow(CsvImportError);
    expect(() => parseCsvText('Date,Description,Amount\n')).toThrow(/No transaction rows/);
    expect(() => parseCsvText('x'.repeat(MAX_FILE_BYTES + 1))).toThrow(/5 MB/);
  });
});

describe('guessMapping', () => {
  it('maps a signed amount column', () => {
    const mapping = guessMapping(parseCsvText(SIGNED));
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2, debit: null, credit: null });
    expect(isMappingComplete(mapping)).toBe(true);
  });

  it('maps separate debit and credit columns', () => {
    const table = parseCsvText(
      'Posted Date,Payee,Debit,Credit\n2026-01-05,SPOTIFY,11.99,\n2026-01-06,REFUND,,5.00',
    );
    expect(guessMapping(table)).toEqual({
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
    });
  });

  it('falls back to content-based detection when headers are unhelpful', () => {
    const table = parseCsvText(
      'a,b,c\n2026-01-05,SPOTIFY USA PREMIUM,-11.99\n2026-02-05,SPOTIFY USA PREMIUM,-11.99',
    );
    const mapping = guessMapping(table);
    expect(mapping.date).toBe(0);
    expect(mapping.amount).toBe(2);
    expect(mapping.description).toBe(1);
  });
});

describe('detectChargeSign', () => {
  it('detects negative and positive conventions', () => {
    expect(detectChargeSign(parseCsvText(SIGNED), 2)).toBe('negative');
    const card = parseCsvText(
      'Date,Description,Amount\n2026-01-01,NETFLIX,17.99\n2026-01-02,SPOTIFY,11.99\n2026-01-03,PAYMENT THANK YOU,-200',
    );
    expect(detectChargeSign(card, 2)).toBe('positive');
  });
});

describe('normalizeTransactions', () => {
  it('keeps charges, skips credits and reports bad rows with line numbers', () => {
    const table = parseCsvText(SIGNED);
    const result = normalizeTransactions(table, {
      mapping: guessMapping(table),
      dateFormat: 'mdy',
      chargeSign: 'negative',
      currency: 'USD',
    });
    expect(result.transactions).toEqual([
      { date: '2026-03-01', description: 'NETFLIX.COM', amountMinor: 1799 },
      { date: '2026-02-27', description: 'COFFEE, INC', amountMinor: 450 },
    ]);
    expect(result.skippedCredits).toBe(1);
    expect(result.errors.map((e) => e.row)).toEqual([7, 8, 9]);
    expect(result.errors[0]!.message).toMatch(/Unrecognised date/);
  });

  it('supports debit/credit columns', () => {
    const table = parseCsvText(
      'Date,Payee,Debit,Credit\n2026-01-05,SPOTIFY,11.99,\n2026-01-06,REFUND,,5.00',
    );
    const result = normalizeTransactions(table, {
      mapping: guessMapping(table),
      dateFormat: 'ymd',
      chargeSign: 'negative',
      currency: 'USD',
    });
    expect(result.transactions).toEqual([
      { date: '2026-01-05', description: 'SPOTIFY', amountMinor: 1199 },
    ]);
    expect(result.skippedCredits).toBe(1);
  });

  it('refuses an incomplete mapping', () => {
    const table = parseCsvText(SIGNED);
    expect(() =>
      normalizeTransactions(table, {
        mapping: { date: 0, description: 1, amount: null, debit: null, credit: null },
        dateFormat: 'mdy',
        chargeSign: 'negative',
        currency: 'USD',
      }),
    ).toThrow(CsvImportError);
  });
});
