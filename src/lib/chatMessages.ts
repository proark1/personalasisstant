import type {
  ChatAttachmentEncryption,
  ChatAttachmentEncryptionMetadata,
} from "@/lib/chatAttachmentCrypto";

export interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  duration?: number;
  encrypted?: boolean;
  encryption?: ChatAttachmentEncryptionMetadata;
}

interface EncryptedMessageEnvelope {
  version: 2;
  text: string;
  attachments: ChatAttachment[];
}

export function createEncryptedMessageEnvelope(
  text: string,
  attachments: ChatAttachment[],
): string {
  return JSON.stringify({
    version: 2,
    text,
    attachments,
  } satisfies EncryptedMessageEnvelope);
}

export function unpackEncryptedMessageEnvelope(decryptedContent: string): {
  text: string;
  attachments?: ChatAttachment[];
} {
  try {
    const parsed = JSON.parse(decryptedContent) as Partial<EncryptedMessageEnvelope>;
    if (parsed?.version === 2 && typeof parsed.text === "string") {
      return {
        text: parsed.text,
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      };
    }
  } catch {
    // Legacy encrypted messages stored only the text body.
  }
  return { text: decryptedContent };
}

export function stripAttachmentSecrets(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map((attachment) => {
    if (!attachment.encrypted || !attachment.encryption) return attachment;
    const { key: _key, ...publicEncryption } = attachment.encryption;
    return {
      ...attachment,
      encryption: publicEncryption,
    };
  });
}

export function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (Array.isArray(value)) return value as ChatAttachment[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as ChatAttachment[];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeEncryptedKeys(value: unknown): Record<string, string> | null {
  const source = typeof value === "string" ? safeParseJson(value) : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  const entries = Object.entries(source).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function getAttachmentEncryptionKey(
  attachment: ChatAttachment,
): ChatAttachmentEncryption | null {
  const encryption = attachment.encryption;
  if (
    attachment.encrypted &&
    encryption?.version === 1 &&
    encryption.algorithm === "AES-GCM" &&
    encryption.key
  ) {
    return encryption as ChatAttachmentEncryption;
  }
  return null;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function messagePreviewText(text: string, attachments: ChatAttachment[]): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  if (attachments.length === 1) return `Attachment: ${attachments[0].name}`;
  if (attachments.length > 1) return `${attachments.length} attachments`;
  return "";
}
