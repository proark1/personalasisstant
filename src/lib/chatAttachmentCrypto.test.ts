import { describe, expect, it } from "vitest";
import { decryptAttachmentBlob, encryptAttachmentBlob } from "./chatAttachmentCrypto";

describe("chat attachment encryption", () => {
  it("round-trips a blob without exposing plaintext in the encrypted blob", async () => {
    const plaintext = "private attachment body";
    const source = new Blob([plaintext], { type: "text/plain" });

    const { encryptedBlob, encryption } = await encryptAttachmentBlob(source);
    const encryptedText = await encryptedBlob.text();
    expect(encryptedText).not.toContain(plaintext);

    const decrypted = await decryptAttachmentBlob(encryptedBlob, encryption);
    expect(decrypted.type).toBe("text/plain");
    expect(await decrypted.text()).toBe(plaintext);
  });
});
