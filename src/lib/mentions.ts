import type { Contact } from '@/hooks/useContacts';

export interface ParsedMention {
  email: string;
  displayName?: string;
  start: number;
  end: number;
}

/**
 * Parse @mentions from text
 * Supports formats: @email@domain.com or @"Display Name"
 */
export function parseMentions(text: string, contacts: Contact[]): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  
  // Match @email format
  const emailRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;
  
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[1];
    const contact = contacts.find(c => c.email?.toLowerCase() === email.toLowerCase());
    mentions.push({
      email,
      displayName: contact?.name,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  
  return mentions;
}

/**
 * Replace @mentions with styled spans (for rendering)
 */
export function renderMentions(text: string, contacts: Contact[]): string {
  const mentions = parseMentions(text, contacts);
  
  if (mentions.length === 0) return text;
  
  let result = text;
  // Process in reverse order to maintain correct indices
  [...mentions].reverse().forEach(mention => {
    const displayText = mention.displayName || mention.email;
    const replacement = `<span class="mention" data-email="${mention.email}">@${displayText}</span>`;
    result = result.slice(0, mention.start) + replacement + result.slice(mention.end);
  });
  
  return result;
}

/**
 * Extract mentioned user IDs from text
 */
export function extractMentionedUsers(text: string, contacts: Contact[]): string[] {
  const mentions = parseMentions(text, contacts);
  const mentionedIds: string[] = [];
  
  mentions.forEach(mention => {
    const contact = contacts.find(c => c.email?.toLowerCase() === mention.email.toLowerCase());
    if (contact) {
      mentionedIds.push(contact.userId);
    }
  });
  
  return [...new Set(mentionedIds)];
}

/**
 * Auto-complete suggestion for mentions
 */
export function getMentionSuggestions(
  text: string, 
  cursorPosition: number, 
  contacts: Contact[]
): { suggestions: Contact[]; searchTerm: string; startIndex: number } | null {
  // Find the @ symbol before cursor
  const textBeforeCursor = text.slice(0, cursorPosition);
  const atIndex = textBeforeCursor.lastIndexOf('@');
  
  if (atIndex === -1) return null;
  
  // Check if there's a space between @ and cursor (means mention is complete)
  const textAfterAt = textBeforeCursor.slice(atIndex + 1);
  if (textAfterAt.includes(' ')) return null;
  
  const searchTerm = textAfterAt.toLowerCase();
  
  const suggestions = contacts.filter(contact => {
    const email = (contact.email || '').toLowerCase();
    const name = contact.name.toLowerCase();
    return email.includes(searchTerm) || name.includes(searchTerm);
  }).slice(0, 5);
  
  return {
    suggestions,
    searchTerm,
    startIndex: atIndex,
  };
}
