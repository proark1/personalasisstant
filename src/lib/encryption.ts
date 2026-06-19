// End-to-end encryption utilities using Web Crypto API

const ALGORITHM = "RSA-OAEP";
const SYMMETRIC_ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const DB_NAME = "flux-encryption";
const STORE_NAME = "keys";

// Generate RSA key pair for asymmetric encryption
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

// Generate AES key for symmetric encryption (group messages)
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: SYMMETRIC_ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

// Export public key to base64 string for storage
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(exported);
}

// Export private key to base64 string for backup
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return arrayBufferToBase64(exported);
}

// Export symmetric key to base64 string
export async function exportSymmetricKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

// Import public key from base64 string
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(publicKeyBase64);
  return await crypto.subtle.importKey(
    "spki",
    keyData,
    {
      name: ALGORITHM,
      hash: "SHA-256",
    },
    true,
    ["encrypt"],
  );
}

// Import private key from base64 string
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(privateKeyBase64);
  return await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: ALGORITHM,
      hash: "SHA-256",
    },
    true,
    ["decrypt"],
  );
}

// Import symmetric key from base64 string
export async function importSymmetricKey(keyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyBase64);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: SYMMETRIC_ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

// Encrypt message with recipient's public key (for direct messages)
export async function encryptWithPublicKey(
  message: string,
  publicKey: CryptoKey,
): Promise<{ encryptedContent: string; encryptedKey: string }> {
  // Generate a random AES key for this message
  const messageKey = await generateSymmetricKey();

  // Encrypt the message with the AES key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: SYMMETRIC_ALGORITHM,
      iv,
    },
    messageKey,
    encodedMessage,
  );

  // Encrypt the AES key with the recipient's public key
  const exportedKey = await crypto.subtle.exportKey("raw", messageKey);
  const encryptedKey = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
    },
    publicKey,
    exportedKey,
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return {
    encryptedContent: arrayBufferToBase64(combined.buffer),
    encryptedKey: arrayBufferToBase64(encryptedKey),
  };
}

// Decrypt message with private key (for direct messages)
export async function decryptWithPrivateKey(
  encryptedContent: string,
  encryptedKey: string,
  privateKey: CryptoKey,
): Promise<string> {
  try {
    // Decrypt the AES key with private key
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKey);
    const decryptedKeyBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
      },
      privateKey,
      encryptedKeyBuffer,
    );

    // Import the AES key
    const messageKey = await crypto.subtle.importKey(
      "raw",
      decryptedKeyBuffer,
      {
        name: SYMMETRIC_ALGORITHM,
        length: KEY_LENGTH,
      },
      false,
      ["decrypt"],
    );

    // Decrypt the message
    const combined = base64ToArrayBuffer(encryptedContent);
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: SYMMETRIC_ALGORITHM,
        iv: new Uint8Array(iv),
      },
      messageKey,
      encryptedData,
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt message");
  }
}

// Encrypt with symmetric key (for group messages)
export async function encryptWithSymmetricKey(
  message: string,
  symmetricKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: SYMMETRIC_ALGORITHM,
      iv,
    },
    symmetricKey,
    encodedMessage,
  );

  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

// Decrypt with symmetric key (for group messages)
export async function decryptWithSymmetricKey(
  encryptedContent: string,
  symmetricKey: CryptoKey,
): Promise<string> {
  try {
    const combined = base64ToArrayBuffer(encryptedContent);
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: SYMMETRIC_ALGORITHM,
        iv: new Uint8Array(iv),
      },
      symmetricKey,
      encryptedData,
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt message");
  }
}

// Encrypt symmetric key with public key (for sharing group keys)
export async function encryptKeyForUser(
  symmetricKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<string> {
  const exportedKey = await crypto.subtle.exportKey("raw", symmetricKey);
  const encryptedKey = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
    },
    publicKey,
    exportedKey,
  );
  return arrayBufferToBase64(encryptedKey);
}

// Decrypt symmetric key with private key
export async function decryptKeyWithPrivateKey(
  encryptedKey: string,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKey);
  const decryptedKeyBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
    },
    privateKey,
    encryptedKeyBuffer,
  );

  return await crypto.subtle.importKey(
    "raw",
    decryptedKeyBuffer,
    {
      name: SYMMETRIC_ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

// IndexedDB helpers for local key storage
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function storePrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
  const db = await openDB();
  // Store the CryptoKey object directly via structured clone instead of
  // exporting to base64, so the raw key material is never exposed in IndexedDB
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: `private-key-${userId}`, key: privateKey, version: 2 });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(`private-key-${userId}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      if (request.result?.key) {
        try {
          // Version 2: CryptoKey stored directly via structured clone
          if (request.result.key instanceof CryptoKey) {
            resolve(request.result.key);
          } else {
            // Legacy: base64-encoded key string, re-import it
            const privateKey = await importPrivateKey(request.result.key);
            resolve(privateKey);
          }
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
  });
}

export async function storeGroupKey(groupId: string, symmetricKey: CryptoKey): Promise<void> {
  const db = await openDB();
  const exported = await exportSymmetricKey(symmetricKey);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: `group-key-${groupId}`, key: exported });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getGroupKey(groupId: string): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(`group-key-${groupId}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      if (request.result?.key) {
        try {
          const key = await importSymmetricKey(request.result.key);
          resolve(key);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
  });
}

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
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
