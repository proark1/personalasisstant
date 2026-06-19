import { Contact } from "@/hooks/useContacts";

// Keywords that trigger contact suggestions
const SUGGESTION_KEYWORDS: Record<string, string[]> = {
  investor: [
    "investor",
    "investment",
    "funding",
    "raise",
    "capital",
    "vc",
    "angel",
    "seed",
    "series",
  ],
  developer: [
    "developer",
    "engineer",
    "coding",
    "programming",
    "software",
    "tech",
    "frontend",
    "backend",
  ],
  designer: ["designer", "design", "ui", "ux", "figma", "creative"],
  sales: ["sales", "selling", "revenue", "deals", "pipeline", "leads"],
  marketing: ["marketing", "growth", "advertising", "brand", "social media", "content"],
  legal: ["lawyer", "legal", "attorney", "contract", "compliance"],
  hr: ["hiring", "recruit", "talent", "hr", "human resources"],
  finance: ["accountant", "finance", "cfo", "bookkeeping", "tax"],
  advisor: ["advisor", "mentor", "guidance", "advice", "consultant"],
  partner: ["partner", "partnership", "collaboration", "joint venture"],
};

export interface ContactSuggestion {
  contact: Contact;
  reason: string;
  matchedKeywords: string[];
}

export function findRelevantContacts(message: string, contacts: Contact[]): ContactSuggestion[] {
  const lowerMessage = message.toLowerCase();
  const suggestions: ContactSuggestion[] = [];
  const addedContactIds = new Set<string>();

  // Check each keyword category
  for (const [category, keywords] of Object.entries(SUGGESTION_KEYWORDS)) {
    const matchedKeywords = keywords.filter((kw) => lowerMessage.includes(kw));

    if (matchedKeywords.length > 0) {
      // Find contacts that match this category
      for (const contact of contacts) {
        if (addedContactIds.has(contact.id)) continue;

        const contactText = [contact.role, contact.company, contact.notes, ...contact.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        // Check if contact matches the category
        const contactMatches =
          keywords.some((kw) => contactText.includes(kw)) ||
          contact.tags.some((tag) => keywords.some((kw) => tag.toLowerCase().includes(kw)));

        if (contactMatches) {
          addedContactIds.add(contact.id);
          suggestions.push({
            contact,
            reason: `${contact.name} might help with ${category}`,
            matchedKeywords,
          });
        }
      }
    }
  }

  // Also do direct text matching on contact notes/tags
  for (const contact of contacts) {
    if (addedContactIds.has(contact.id)) continue;

    const words = lowerMessage.split(/\s+/).filter((w) => w.length > 3);
    const matchedWords: string[] = [];

    for (const word of words) {
      if (
        contact.notes?.toLowerCase().includes(word) ||
        contact.tags.some((tag) => tag.toLowerCase().includes(word)) ||
        contact.role?.toLowerCase().includes(word) ||
        contact.company?.toLowerCase().includes(word)
      ) {
        matchedWords.push(word);
      }
    }

    if (matchedWords.length > 0) {
      addedContactIds.add(contact.id);
      suggestions.push({
        contact,
        reason: `${contact.name} is related to: ${matchedWords.join(", ")}`,
        matchedKeywords: matchedWords,
      });
    }
  }

  // Limit to top 3 suggestions
  return suggestions.slice(0, 3);
}
