import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  generateKeyPair,
  exportPublicKey,
  storePrivateKey,
  getPrivateKey,
  importPublicKey,
  encryptForPublicKeys,
  decryptWithPrivateKey,
  generateSymmetricKey,
  storeGroupKey,
  getGroupKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
  encryptKeyForUser,
  decryptKeyWithPrivateKey,
} from "@/lib/encryption";

export function useEncryption() {
  const { user } = useAuth();
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const initializingUserRef = useRef<string | null>(null);

  // Initialize encryption keys on user login
  useEffect(() => {
    if (!user?.id) {
      initializingUserRef.current = null;
      setPrivateKey(null);
      setIsReady(false);
      return;
    }

    if (initializingUserRef.current === user.id) return;
    initializingUserRef.current = user.id;
    let cancelled = false;

    const initializeKeys = async () => {
      try {
        // Try to get existing private key from IndexedDB
        const existingPrivateKey = await getPrivateKey(user.id);

        if (existingPrivateKey) {
          if (!cancelled) {
            setPrivateKey(existingPrivateKey);
            setIsReady(true);
          }
        } else {
          // Check if user has a public key in profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("public_key")
            .eq("user_id", user.id)
            .single();

          if (!profile?.public_key) {
            // Generate new key pair
            const keyPair = await generateKeyPair();
            const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

            // Store private key locally
            await storePrivateKey(user.id, keyPair.privateKey);

            // Store public key in profile
            await supabase
              .from("profiles")
              .update({ public_key: publicKeyBase64 })
              .eq("user_id", user.id);

            if (!cancelled) {
              setPrivateKey(keyPair.privateKey);
              setIsReady(true);
            }
          } else {
            // User has public key but no private key (device change)
            // User needs to restore from backup
            console.warn("Private key not found. User needs to restore from backup.");
            if (!cancelled) {
              setPrivateKey(null);
              setIsReady(false);
            }
          }
        }
      } catch (error) {
        console.error("Failed to initialize encryption:", error);
        initializingUserRef.current = null;
      }
    };

    initializeKeys();
    return () => {
      cancelled = true;
      if (initializingUserRef.current === user.id) {
        initializingUserRef.current = null;
      }
    };
  }, [user?.id]);

  // Get recipient's public key
  const getRecipientPublicKey = useCallback(
    async (recipientId: string): Promise<CryptoKey | null> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("public_key")
        .eq("user_id", recipientId)
        .single();

      if (profile?.public_key) {
        return await importPublicKey(profile.public_key);
      }
      return null;
    },
    [],
  );

  // Encrypt a direct message
  const encryptDirectMessage = useCallback(
    async (
      message: string,
      recipientId: string,
    ): Promise<{
      encryptedContent: string;
      encryptedKey: string;
      encryptedKeys: Record<string, string>;
    } | null> => {
      const participantIds = Array.from(new Set([recipientId, user?.id].filter(Boolean)));
      const publicKeys: Record<string, CryptoKey> = {};
      for (const participantId of participantIds) {
        const publicKey = await getRecipientPublicKey(participantId);
        if (publicKey) publicKeys[participantId] = publicKey;
      }
      const recipientPublicKey = publicKeys[recipientId];
      if (!recipientPublicKey) {
        console.warn("Recipient does not have encryption keys");
        return null;
      }
      if (user?.id && !publicKeys[user.id]) {
        console.warn("Sender encryption key is not available");
        return null;
      }

      const encrypted = await encryptForPublicKeys(message, publicKeys);
      const encryptedKey = encrypted.encryptedKeys[recipientId];
      if (!encryptedKey) return null;
      return {
        encryptedContent: encrypted.encryptedContent,
        encryptedKey,
        encryptedKeys: encrypted.encryptedKeys,
      };
    },
    [getRecipientPublicKey, user?.id],
  );

  // Decrypt a direct message
  const decryptDirectMessage = useCallback(
    async (encryptedContent: string, encryptedKey: string): Promise<string | null> => {
      if (!privateKey) {
        console.warn("Private key not available");
        return null;
      }
      try {
        return await decryptWithPrivateKey(encryptedContent, encryptedKey, privateKey);
      } catch (error) {
        console.error("Failed to decrypt message:", error);
        return null;
      }
    },
    [privateKey],
  );

  // Initialize or get group encryption key
  const initializeGroupKey = useCallback(
    async (groupId: string, memberIds: string[]): Promise<void> => {
      // Check if we already have the group key locally
      const existingKey = await getGroupKey(groupId);
      if (existingKey) return;

      // Check if there's an encrypted key for us in the database
      if (user?.id) {
        const { data: encryptedKeyData } = await supabase
          .from("group_encryption_keys")
          .select("encrypted_group_key")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .single();

        if (encryptedKeyData?.encrypted_group_key && privateKey) {
          // Decrypt and store the group key
          const groupKey = await decryptKeyWithPrivateKey(
            encryptedKeyData.encrypted_group_key,
            privateKey,
          );
          await storeGroupKey(groupId, groupKey);
          return;
        }
      }

      // Generate new group key and share with all members
      const groupKey = await generateSymmetricKey();
      await storeGroupKey(groupId, groupKey);

      // Encrypt and share the key with all members
      for (const memberId of memberIds) {
        const memberPublicKey = await getRecipientPublicKey(memberId);
        if (memberPublicKey) {
          const encryptedKey = await encryptKeyForUser(groupKey, memberPublicKey);
          await supabase.from("group_encryption_keys").upsert(
            {
              group_id: groupId,
              user_id: memberId,
              encrypted_group_key: encryptedKey,
            },
            { onConflict: "group_id,user_id" },
          );
        }
      }
    },
    [user?.id, privateKey, getRecipientPublicKey],
  );

  // Encrypt a group message
  const encryptGroupMessage = useCallback(
    async (message: string, groupId: string): Promise<string | null> => {
      const groupKey = await getGroupKey(groupId);
      if (!groupKey) {
        console.warn("Group key not available");
        return null;
      }
      return await encryptWithSymmetricKey(message, groupKey);
    },
    [],
  );

  // Decrypt a group message
  const decryptGroupMessage = useCallback(
    async (encryptedContent: string, groupId: string): Promise<string | null> => {
      const groupKey = await getGroupKey(groupId);
      if (!groupKey) {
        console.warn("Group key not available");
        return null;
      }
      try {
        return await decryptWithSymmetricKey(encryptedContent, groupKey);
      } catch (error) {
        console.error("Failed to decrypt group message:", error);
        return null;
      }
    },
    [],
  );

  // Add a new member to a group (share the key)
  const addMemberToGroupEncryption = useCallback(
    async (groupId: string, memberId: string): Promise<void> => {
      const groupKey = await getGroupKey(groupId);
      if (!groupKey) {
        console.warn("Group key not available");
        return;
      }

      const memberPublicKey = await getRecipientPublicKey(memberId);
      if (memberPublicKey) {
        const encryptedKey = await encryptKeyForUser(groupKey, memberPublicKey);
        await supabase.from("group_encryption_keys").upsert(
          {
            group_id: groupId,
            user_id: memberId,
            encrypted_group_key: encryptedKey,
          },
          { onConflict: "group_id,user_id" },
        );
      }
    },
    [getRecipientPublicKey],
  );

  return {
    isReady,
    privateKey,
    encryptDirectMessage,
    decryptDirectMessage,
    initializeGroupKey,
    encryptGroupMessage,
    decryptGroupMessage,
    addMemberToGroupEncryption,
    getRecipientPublicKey,
  };
}
