import { describe, expect, it } from 'vitest';
import { DecryptionError, decryptJson, encryptJson, isEncryptedEnvelope } from './crypto';

const FAST = 20_000;

describe('encrypted backups', () => {
  it('round-trips data with the right passphrase', async () => {
    const data = { hello: 'world', list: [1, 2, 3], unicode: 'café €' };
    const envelope = await encryptJson(data, 'correct horse battery', FAST);
    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(JSON.stringify(envelope)).not.toContain('world');
    await expect(decryptJson(envelope, 'correct horse battery')).resolves.toEqual(data);
  });

  it('fails cleanly with the wrong passphrase', async () => {
    const envelope = await encryptJson({ a: 1 }, 'correct horse battery', FAST);
    await expect(decryptJson(envelope, 'wrong passphrase')).rejects.toBeInstanceOf(DecryptionError);
  });

  it('detects tampering', async () => {
    const envelope = await encryptJson({ a: 1 }, 'correct horse battery', FAST);
    const bytes = atob(envelope.data);
    const tampered = {
      ...envelope,
      data: btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1)),
    };
    await expect(decryptJson(tampered, 'correct horse battery')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('uses a fresh salt and IV each time', async () => {
    const a = await encryptJson({ a: 1 }, 'correct horse battery', FAST);
    const b = await encryptJson({ a: 1 }, 'correct horse battery', FAST);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
  });

  it('rejects short passphrases and malformed envelopes', async () => {
    await expect(encryptJson({}, 'short')).rejects.toThrow(/at least 8/);
    expect(isEncryptedEnvelope({ format: 'other' })).toBe(false);
  });

  it('defaults to 600k PBKDF2 iterations', async () => {
    const envelope = await encryptJson({ a: 1 }, 'correct horse battery');
    expect(envelope.kdf.iterations).toBe(600_000);
  });
});
