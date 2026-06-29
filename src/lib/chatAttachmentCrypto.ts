const ATTACHMENT_ALGORITHM = "AES-GCM";
const ATTACHMENT_KEY_LENGTH = 256;
const ATTACHMENT_IV_BYTES = 12;

export interface ChatAttachmentEncryptionMetadata {
  version: 1;
  algorithm: typeof ATTACHMENT_ALGORITHM;
  key?: string;
  iv: string;
  originalType: string;
}

export interface ChatAttachmentEncryption extends ChatAttachmentEncryptionMetadata {
  key: string;
}

export async function encryptAttachmentBlob(blob: Blob): Promise<{
  encryptedBlob: Blob;
  encryption: ChatAttachmentEncryption;
}> {
  const key = await crypto.subtle.generateKey(
    {
      name: ATTACHMENT_ALGORITHM,
      length: ATTACHMENT_KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(ATTACHMENT_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ATTACHMENT_ALGORITHM,
      iv,
    },
    key,
    await blob.arrayBuffer(),
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return {
    encryptedBlob: new Blob([encrypted], { type: "application/octet-stream" }),
    encryption: {
      version: 1,
      algorithm: ATTACHMENT_ALGORITHM,
      key: arrayBufferToBase64(rawKey),
      iv: arrayBufferToBase64(iv.buffer),
      originalType: blob.type || "application/octet-stream",
    },
  };
}

export async function decryptAttachmentBlob(
  encryptedBlob: Blob,
  encryption: ChatAttachmentEncryption,
): Promise<Blob> {
  if (encryption.version !== 1 || encryption.algorithm !== ATTACHMENT_ALGORITHM) {
    throw new Error("Unsupported attachment encryption metadata");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(encryption.key),
    {
      name: ATTACHMENT_ALGORITHM,
      length: ATTACHMENT_KEY_LENGTH,
    },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ATTACHMENT_ALGORITHM,
      iv: new Uint8Array(base64ToArrayBuffer(encryption.iv)),
    },
    key,
    await encryptedBlob.arrayBuffer(),
  );

  return new Blob([decrypted], { type: encryption.originalType || "application/octet-stream" });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
