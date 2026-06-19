// Pure helpers extracted from useOpenAIRealtime.ts.
//
// These are stateless lookups used by the voice tool dispatcher to
// resolve a spoken query ("my wife", "the dentist appointment") to a
// concrete record. Kept free of React so they can be unit-tested in
// isolation (see realtimeToolHelpers.test.ts) and so the hook file
// stays focused on connection + dispatch wiring.

import { parseNaturalDate } from "@/utils/RealtimeAudio";

// Fuzzy match helper for any items with a name field.
export function fuzzyMatchByName<T extends { name: string; id: string }>(
  query: string,
  items: T[],
): T[] {
  const q = query.toLowerCase().trim();
  return items
    .filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        q.split(" ").every((word) => item.name.toLowerCase().includes(word)),
    )
    .slice(0, 5);
}

// Fuzzy match for contacts (checks multiple fields).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fuzzyMatchContact(query: string, contacts: any[]): any[] {
  const q = query.toLowerCase().trim();
  return contacts
    .filter((c) => {
      const searchable = [c.name, c.company, c.role, c.city, c.country, c.notes, ...(c.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(q) || q.split(" ").every((word) => searchable.includes(word));
    })
    .slice(0, 5);
}

// Family relationship mapping for voice commands like "my wife", "my mom".
export const FAMILY_RELATIONSHIP_MAP: Record<string, string[]> = {
  wife: ["spouse", "wife", "partner"],
  husband: ["spouse", "husband", "partner"],
  spouse: ["spouse", "wife", "husband", "partner"],
  partner: ["partner", "spouse", "girlfriend", "boyfriend"],
  mom: ["mother", "mom", "parent"],
  mother: ["mother", "mom", "parent"],
  dad: ["father", "dad", "parent"],
  father: ["father", "dad", "parent"],
  sister: ["sister", "sibling"],
  brother: ["brother", "sibling"],
  son: ["son", "child"],
  daughter: ["daughter", "child"],
  child: ["child", "son", "daughter"],
  grandma: ["grandmother", "grandma", "grandparent"],
  grandmother: ["grandmother", "grandma", "grandparent"],
  grandpa: ["grandfather", "grandpa", "grandparent"],
  grandfather: ["grandfather", "grandpa", "grandparent"],
};

// Resolve contact by name OR family relationship (e.g., "my wife").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveContactByQuery(query: string, contacts: any[]): any[] {
  const q = query.toLowerCase().trim();

  // Check if it's a family relationship query (e.g., "my wife", "wife", "mom").
  const withoutMy = q.replace(/^my\s+/, "").trim();
  const relationshipVariants = FAMILY_RELATIONSHIP_MAP[withoutMy];

  if (relationshipVariants) {
    const matches = contacts.filter((c) => {
      if (!c.familyRelationship) return false;
      const rel = c.familyRelationship.toLowerCase();
      return relationshipVariants.some((variant) => rel.includes(variant));
    });
    if (matches.length > 0) return matches;
  }

  // Fall back to fuzzy name matching.
  return fuzzyMatchContact(query, contacts);
}

// Parse natural language date/time for events.
export function parseEventDateTime(input: string): Date | null {
  const date = parseNaturalDate(input);
  if (date) return new Date(date);

  // Try parsing as ISO.
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try common patterns.
  const now = new Date();
  const lowerInput = input.toLowerCase();

  // "3pm", "3:30pm", "15:00"
  const timeMatch = lowerInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || "0");
    const ampm = timeMatch[3]?.toLowerCase();

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);

    // If time is in the past today, assume tomorrow.
    if (result < now) result.setDate(result.getDate() + 1);

    return result;
  }

  return null;
}
