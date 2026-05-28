import { useMemo } from 'react';
import { Contact } from '@/hooks/useContacts';

// Keywords for detecting intent and filtering relevant data
const INTENT_KEYWORDS = {
  location: ['going to', 'trip to', 'travel to', 'meeting in', 'visit', 'visiting', 'flying to'],
  investor: ['investor', 'investment', 'funding', 'raise', 'capital', 'vc', 'angel', 'seed', 'series'],
  developer: ['developer', 'engineer', 'coding', 'programming', 'software', 'tech', 'frontend', 'backend'],
  designer: ['designer', 'design', 'ui', 'ux', 'figma', 'creative'],
  sales: ['sales', 'selling', 'revenue', 'deals', 'pipeline', 'leads'],
  marketing: ['marketing', 'growth', 'advertising', 'brand', 'social media'],
  legal: ['lawyer', 'legal', 'attorney', 'contract', 'compliance'],
  finance: ['accountant', 'finance', 'cfo', 'bookkeeping', 'tax'],
  advisor: ['advisor', 'mentor', 'guidance', 'advice', 'consultant'],
  brainstorm: ['brainstorm', 'ideas', 'ideate', 'creative', 'think about'],
  cost: ['cost', 'expense', 'subscription', 'spending', 'budget', 'money'],
  renewal: ['renewal', 'renewing', 'expires', 'cancellation', 'cancel'],
};

// Common city/country names for location detection
const LOCATIONS = [
  'dubai', 'uae', 'london', 'uk', 'new york', 'nyc', 'usa', 'berlin', 'germany',
  'paris', 'france', 'singapore', 'hong kong', 'tokyo', 'japan', 'san francisco',
  'los angeles', 'chicago', 'miami', 'boston', 'seattle', 'austin', 'denver',
  'toronto', 'vancouver', 'sydney', 'melbourne', 'amsterdam', 'zurich', 'switzerland',
  'portugal', 'lisbon', 'spain', 'madrid', 'barcelona', 'italy', 'rome', 'milan',
  'austria', 'vienna', 'poland', 'warsaw', 'czech', 'prague', 'hungary', 'budapest',
];

export interface Contract {
  id: string;
  name: string;
  provider?: string;
  category: string;
  costAmount?: number;
  costFrequency?: string;
  renewalDate?: string;
  endDate?: string;
  autoRenews?: boolean;
  isActive?: boolean;
}

export interface UserProfile {
  id?: string;
  displayName?: string;
  email?: string;
  bio?: string;
  birthDate?: string;
  businesses?: string[];
  role?: string;
  interests?: string[];
  skills?: string[];
  goals?: string;
  locationCity?: string;
  locationCountry?: string;
  preferredWorkHours?: string;
  timezone?: string;
  locale?: string;
}

export interface SmartContext {
  userProfile: UserProfile | null;
  relevantContacts: Contact[];
  relevantContracts: Contract[];
  detectedIntent: {
    locations: string[];
    categories: string[];
    isBrainstorming: boolean;
    isAboutCosts: boolean;
    isAboutRenewals: boolean;
  };
}

export function useSmartContext({
  message,
  contacts,
  contracts,
  userProfile,
}: {
  message: string;
  contacts: Contact[];
  contracts: Contract[];
  userProfile: UserProfile | null;
}): SmartContext {
  return useMemo(() => {
    const lowerMessage = message.toLowerCase();
    
    // Detect intent
    const detectedLocations: string[] = [];
    const detectedCategories: string[] = [];
    
    // Check for location mentions
    for (const location of LOCATIONS) {
      if (lowerMessage.includes(location)) {
        detectedLocations.push(location);
      }
    }
    
    // Check for category keywords
    for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (category === 'location') continue; // Already handled
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        detectedCategories.push(category);
      }
    }
    
    const isBrainstorming = detectedCategories.includes('brainstorm');
    const isAboutCosts = detectedCategories.includes('cost');
    const isAboutRenewals = detectedCategories.includes('renewal');
    
    // Filter relevant contacts
    const relevantContacts = contacts.filter(contact => {
      // Match by location
      if (detectedLocations.length > 0) {
        const contactLocation = [contact.city, contact.country]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (detectedLocations.some(loc => contactLocation.includes(loc))) {
          return true;
        }
      }
      
      // Match by category/role keywords
      if (detectedCategories.length > 0) {
        const contactText = [
          contact.role,
          contact.company,
          contact.notes,
          ...contact.tags,
        ].filter(Boolean).join(' ').toLowerCase();
        
        for (const category of detectedCategories) {
          const keywords = INTENT_KEYWORDS[category as keyof typeof INTENT_KEYWORDS] || [];
          if (keywords.some(kw => contactText.includes(kw))) {
            return true;
          }
        }
      }
      
      // Match by direct mention of name or company
      if (contact.name && lowerMessage.includes(contact.name.toLowerCase())) {
        return true;
      }
      if (contact.company && lowerMessage.includes(contact.company.toLowerCase())) {
        return true;
      }
      
      return false;
    }).slice(0, 10); // Limit to 10 most relevant
    
    // Filter relevant contracts
    const relevantContracts = contracts.filter(contract => {
      // Always include if asking about costs/renewals
      if (isAboutCosts || isAboutRenewals) {
        return true;
      }
      
      // Match by name mention
      if (contract.name && lowerMessage.includes(contract.name.toLowerCase())) {
        return true;
      }
      
      // Match by provider mention
      if (contract.provider && lowerMessage.includes(contract.provider.toLowerCase())) {
        return true;
      }
      
      // Match by category mention
      if (contract.category && lowerMessage.includes(contract.category.toLowerCase())) {
        return true;
      }
      
      return false;
    }).slice(0, 10); // Limit to 10 most relevant
    
    return {
      userProfile,
      relevantContacts,
      relevantContracts,
      detectedIntent: {
        locations: detectedLocations,
        categories: detectedCategories,
        isBrainstorming,
        isAboutCosts,
        isAboutRenewals,
      },
    };
  }, [message, contacts, contracts, userProfile]);
}

// Helper to build a compact context summary for the AI
export function buildContextSummary(context: SmartContext, stats: {
  totalContacts: number;
  totalContracts: number;
  pendingTasks: number;
  upcomingEvents: number;
}): string {
  const lines: string[] = [];
  
  // User profile summary
  if (context.userProfile) {
    const { displayName, role, businesses, interests, locationCity, locationCountry, goals } = context.userProfile;
    lines.push('## USER PROFILE');
    if (displayName) lines.push(`Name: ${displayName}`);
    if (role) lines.push(`Role: ${role}`);
    if (businesses?.length) lines.push(`Businesses: ${businesses.join(', ')}`);
    if (interests?.length) lines.push(`Interests: ${interests.join(', ')}`);
    if (locationCity || locationCountry) lines.push(`Location: ${[locationCity, locationCountry].filter(Boolean).join(', ')}`);
    if (goals) lines.push(`Current Goals: ${goals}`);
    lines.push('');
  }
  
  // Stats summary
  lines.push('## USER STATS');
  lines.push(`- ${stats.totalContacts} contacts in network`);
  lines.push(`- ${stats.totalContracts} active contracts/subscriptions`);
  lines.push(`- ${stats.pendingTasks} pending tasks`);
  lines.push(`- ${stats.upcomingEvents} upcoming events`);
  lines.push('');
  
  // Relevant contacts
  if (context.relevantContacts.length > 0) {
    lines.push('## RELEVANT CONTACTS (matching your query)');
    for (const contact of context.relevantContacts) {
      const location = [contact.city, contact.country].filter(Boolean).join(', ');
      const details = [contact.role, contact.company, location].filter(Boolean).join(' | ');
      lines.push(`- ${contact.name}${details ? `: ${details}` : ''}`);
      if (contact.tags.length > 0) lines.push(`  Tags: ${contact.tags.join(', ')}`);
    }
    lines.push('');
  }
  
  // Relevant contracts
  if (context.relevantContracts.length > 0) {
    lines.push('## RELEVANT CONTRACTS');
    for (const contract of context.relevantContracts) {
      const cost = contract.costAmount 
        ? `€${contract.costAmount}/${contract.costFrequency || 'month'}` 
        : '';
      const renewal = contract.renewalDate 
        ? `renews ${contract.renewalDate}` 
        : '';
      lines.push(`- ${contract.name}${contract.provider ? ` (${contract.provider})` : ''}: ${[cost, renewal].filter(Boolean).join(', ')}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
