// Symmetric encryption helper for sensitive at-rest tokens.
//
// AES-GCM-256 with a single key sourced from BANK_TOKEN_SECRET (Deno
// secret, 64 hex chars = 32 bytes). Output format is
// base64(iv (12B) || ciphertext || tag (16B)) — self-contained, so a
// caller doesn't have to track the IV separately.
//
// Why hand-rolled rather than a library?
//   - Web Crypto is built into Deno; no third-party install.
//   - The format is intentionally simple so re-implementing the
//     decrypt path in another language stays straightforward.

const SECRET_NAME = "BANK_TOKEN_SECRET";

let _keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise;
  _keyPromise = (async () => {
    const hex = Deno.env.get(SECRET_NAME) || "";
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        `${SECRET_NAME} must be a 64-character hex string (32 bytes). ` +
          `Generate one with: openssl rand -hex 32`,
      );
    }
    const raw = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  })();
  return _keyPromise;
}

export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error("encryptToken: empty input");
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc));
  // Concat iv || ct(+tag) and base64-encode.
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptToken(b64: string): Promise<string> {
  if (!b64) throw new Error("decryptToken: empty input");
  const key = await getKey();
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (buf.length < 28) {
    throw new Error("decryptToken: ciphertext too short");
  }
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Is a valid encryption key configured? Used by the opportunistic helpers below
// so callers don't have to crash when BANK_TOKEN_SECRET is unset.
export function tokenEncryptionAvailable(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(Deno.env.get(SECRET_NAME) || "");
}

// Encrypt at-rest if a key is configured; otherwise return the value unchanged.
// This lets us roll encryption out without breaking deploys that haven't set
// BANK_TOKEN_SECRET yet (the value is simply stored as-is, exactly as before).
export async function encryptTokenIfConfigured(
  plaintext: string | null | undefined,
): Promise<string | null | undefined> {
  if (!plaintext) return plaintext;
  if (!tokenEncryptionAvailable()) return plaintext;
  return await encryptToken(plaintext);
}

// Decrypt a value that may be either ciphertext (written by
// encryptTokenIfConfigured) or legacy plaintext (rows written before encryption
// shipped, or while no key was set). On any decrypt failure we assume the value
// is plaintext and return it unchanged, so reads never break.
export async function decryptTokenIfNeeded(
  value: string | null | undefined,
): Promise<string | null | undefined> {
  if (!value) return value;
  if (!tokenEncryptionAvailable()) return value;
  try {
    return await decryptToken(value);
  } catch {
    return value; // legacy plaintext
  }
}
