import { describe, expect, it } from "vitest";
import {
  decryptKeyWithPrivateKey,
  decryptWithPrivateKey,
  decryptWithSymmetricKey,
  encryptForPublicKeys,
  encryptKeyForUser,
  encryptWithPublicKey,
  encryptWithSymmetricKey,
  exportPrivateKey,
  exportPublicKey,
  exportSymmetricKey,
  generateKeyPair,
  generateSymmetricKey,
  importPrivateKey,
  importPublicKey,
  importSymmetricKey,
} from "./encryption";

// These tests run against the jsdom Web Crypto polyfill. They prove
// (a) encrypt/decrypt round-trips work, (b) tampered ciphertext is
// rejected, and (c) keys survive export/import. If any of these break
// the messaging E2E story silently regresses.

describe("encryption — symmetric (group messages)", () => {
  it("round-trips a message", async () => {
    const key = await generateSymmetricKey();
    const ciphertext = await encryptWithSymmetricKey("hello world", key);
    expect(ciphertext).not.toBe("hello world");
    const plain = await decryptWithSymmetricKey(ciphertext, key);
    expect(plain).toBe("hello world");
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const key = await generateSymmetricKey();
    const a = await encryptWithSymmetricKey("same", key);
    const b = await encryptWithSymmetricKey("same", key);
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", async () => {
    const key = await generateSymmetricKey();
    const ct = await encryptWithSymmetricKey("secret", key);
    // Flip the second-to-last base64 char to a different valid one.
    const penultimate = ct.charAt(ct.length - 2);
    const tampered = ct.slice(0, -2) + (penultimate === "A" ? "B" : "A") + ct.slice(-1);
    await expect(decryptWithSymmetricKey(tampered, key)).rejects.toThrow();
  });

  it("rejects a wrong key", async () => {
    const k1 = await generateSymmetricKey();
    const k2 = await generateSymmetricKey();
    const ct = await encryptWithSymmetricKey("secret", k1);
    await expect(decryptWithSymmetricKey(ct, k2)).rejects.toThrow();
  });

  it("survives export/import", async () => {
    const k = await generateSymmetricKey();
    const ct = await encryptWithSymmetricKey("payload", k);
    const re = await importSymmetricKey(await exportSymmetricKey(k));
    expect(await decryptWithSymmetricKey(ct, re)).toBe("payload");
  });
});

describe("encryption — asymmetric (direct messages)", () => {
  it("round-trips a message via the recipient's keypair", async () => {
    const recipient = await generateKeyPair({ modulusLength: 1024 });
    expect(recipient.privateKey.extractable).toBe(false);
    const { encryptedContent, encryptedKey } = await encryptWithPublicKey(
      "hi alice",
      recipient.publicKey,
    );
    const plain = await decryptWithPrivateKey(encryptedContent, encryptedKey, recipient.privateKey);
    expect(plain).toBe("hi alice");
  }, 15_000);

  it("cannot be decrypted by a third party's key", async () => {
    const alice = await generateKeyPair({ modulusLength: 1024 });
    const eve = await generateKeyPair({ modulusLength: 1024 });
    const { encryptedContent, encryptedKey } = await encryptWithPublicKey(
      "for alice",
      alice.publicKey,
    );
    await expect(
      decryptWithPrivateKey(encryptedContent, encryptedKey, eve.privateKey),
    ).rejects.toThrow();
  }, 15_000);

  it("survives public/private key export and import", async () => {
    const original = await generateKeyPair({ extractable: true, modulusLength: 1024 });
    const pubB64 = await exportPublicKey(original.publicKey);
    const privB64 = await exportPrivateKey(original.privateKey);

    const pub = await importPublicKey(pubB64);
    const priv = await importPrivateKey(privB64);

    const { encryptedContent, encryptedKey } = await encryptWithPublicKey("ping", pub);
    expect(await decryptWithPrivateKey(encryptedContent, encryptedKey, priv)).toBe("ping");
  }, 15_000);

  it("wraps one message key for sender and recipient", async () => {
    const sender = await generateKeyPair({ modulusLength: 1024 });
    const recipient = await generateKeyPair({ modulusLength: 1024 });
    const { encryptedContent, encryptedKeys } = await encryptForPublicKeys("shared direct body", {
      sender: sender.publicKey,
      recipient: recipient.publicKey,
    });

    expect(Object.keys(encryptedKeys).sort()).toEqual(["recipient", "sender"]);
    await expect(
      decryptWithPrivateKey(encryptedContent, encryptedKeys.sender, sender.privateKey),
    ).resolves.toBe("shared direct body");
    await expect(
      decryptWithPrivateKey(encryptedContent, encryptedKeys.recipient, recipient.privateKey),
    ).resolves.toBe("shared direct body");
  }, 15_000);
});

describe("encryption — group key sharing", () => {
  it("shares a group key wrapped to each member", async () => {
    const alice = await generateKeyPair({ modulusLength: 1024 });
    const groupKey = await generateSymmetricKey();
    const wrapped = await encryptKeyForUser(groupKey, alice.publicKey);
    const unwrapped = await decryptKeyWithPrivateKey(wrapped, alice.privateKey);
    // Use the unwrapped key to decrypt a real group ciphertext.
    const groupCipher = await encryptWithSymmetricKey("group message", groupKey);
    expect(await decryptWithSymmetricKey(groupCipher, unwrapped)).toBe("group message");
  });
});
