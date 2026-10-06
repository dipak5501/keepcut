import { z } from 'zod';

/** OWASP 2023+ recommendation for PBKDF2-HMAC-SHA256. */
export const DEFAULT_ITERATIONS = 600_000;

export const encryptedEnvelopeSchema = z.object({
  format: z.literal('keepcut-encrypted'),
  version: z.literal(1),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int().min(10_000).max(10_000_000),
    salt: z.string().min(16).max(128),
  }),
  cipher: z.object({ name: z.literal('AES-GCM'), iv: z.string().min(12).max(64) }),
  data: z.string().min(1),
});
export type EncryptedEnvelope = z.infer<typeof encryptedEnvelopeSchema>;

export class DecryptionError extends Error {
  constructor() {
    super('Could not decrypt the backup. Check the passphrase and try again.');
    this.name = 'DecryptionError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(
  value: unknown,
  passphrase: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<EncryptedEnvelope> {
  if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  return {
    format: 'keepcut-encrypted',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(ciphertext),
  };
}

export async function decryptJson(
  envelope: EncryptedEnvelope,
  passphrase: string,
): Promise<unknown> {
  const parsed = encryptedEnvelopeSchema.parse(envelope);
  try {
    const key = await deriveKey(passphrase, fromBase64(parsed.kdf.salt), parsed.kdf.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(parsed.cipher.iv) },
      key,
      fromBase64(parsed.data),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new DecryptionError();
  }
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return encryptedEnvelopeSchema.safeParse(value).success;
}
