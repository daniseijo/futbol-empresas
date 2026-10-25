// The two secrets of the Slack subscriptions: the webhook URLs, encrypted at
// rest, and the OAuth `state`, signed so the callback knows which team the
// visitor picked and that the flow started on this site.

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * NOTIFY_ENCRYPTION_KEY: 32 random bytes in base64 (`openssl rand -base64 32`),
 * the same on Vercel (which encrypts) and in GitHub Actions (which decrypts).
 */
export function encryptionKey(value = process.env.NOTIFY_ENCRYPTION_KEY): Buffer {
  const key = Buffer.from(value ?? "", "base64");
  if (key.length !== 32) throw new Error("NOTIFY_ENCRYPTION_KEY must be 32 bytes in base64 (openssl rand -base64 32)");
  return key;
}

/** AES-256-GCM: "v1.<iv>.<auth tag>.<ciphertext>", each part in base64url. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** Throws if the value was not encrypted with this key or was tampered with. */
export function decrypt(value: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || ciphertext === undefined) throw new Error("Not an encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/** How long the visitor has to get through Slack's consent screen. */
export const STATE_TTL_SECONDS = 10 * 60;

export interface OAuthState {
  /** The team to subscribe to. */
  slug: string;
  /** Also kept in a cookie: the callback must come from the browser that started the flow. */
  nonce: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
}

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

export function newNonce(): string {
  return randomBytes(16).toString("base64url");
}

/** "<payload>.<signature>", both base64url, for Slack's `state` parameter. */
export function signState(state: OAuthState, key: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/** The state if it is signed with this key, has not expired and matches the browser's nonce; null otherwise. */
export function verifyState(value: string, key: string, nonce: string | undefined, now = Date.now()): OAuthState | null {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof state.slug !== "string" || typeof state.nonce !== "string" || typeof state.expiresAt !== "number") return null;
  if (state.expiresAt < now || !nonce || state.nonce !== nonce) return null;
  return state;
}
