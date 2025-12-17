import { Project } from '@/types/flux';

// Keyword mappings for common project types
const PROJECT_KEYWORDS: Record<string, string[]> = {
  // Shopping/groceries
  shopping: ['buy', 'shop', 'grocery', 'groceries', 'store', 'market', 'purchase', 'get', 'pick up', 'milk', 'bread', 'eggs'],
  
  // Family
  family: ['family', 'kids', 'children', 'wife', 'husband', 'spouse', 'mom', 'dad', 'parent', 'school', 'doctor', 'appointment'],
  
  // Work/business
  work: ['meeting', 'call', 'email', 'client', 'project', 'deadline', 'report', 'presentation', 'invoice', 'contract', 'proposal'],
  
  // Health/fitness
  health: ['gym', 'workout', 'exercise', 'run', 'yoga', 'doctor', 'medicine', 'prescription', 'health', 'fitness'],
  
  // Home
  home: ['clean', 'fix', 'repair', 'garden', 'lawn', 'laundry', 'dishes', 'cook', 'organize', 'maintenance'],
  
  // Finance
  finance: ['pay', 'bill', 'bank', 'transfer', 'budget', 'tax', 'expense', 'invoice', 'payment'],
};

export interface ProjectSuggestion {
  project: Project;
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Detect which project a task might belong to based on keywords
 */
export function detectProjectFromText(
  text: string,
  projects: Project[]
): ProjectSuggestion | null {
  if (!text || projects.length === 0) return null;

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  let bestMatch: ProjectSuggestion | null = null;

  for (const project of projects) {
    if (project.isArchived) continue;

    const projectNameLower = project.name.toLowerCase();
    const projectWords = projectNameLower.split(/\s+/);
    const matchedKeywords: string[] = [];
    let confidence = 0;

    // Direct project name match (highest confidence)
    if (lowerText.includes(projectNameLower)) {
      confidence += 0.8;
      matchedKeywords.push(project.name);
    }

    // Check if any word in task matches project name words
    for (const word of words) {
      if (projectWords.some(pw => pw.includes(word) || word.includes(pw))) {
        confidence += 0.3;
        matchedKeywords.push(word);
      }
    }

    // Check keyword categories
    for (const [category, keywords] of Object.entries(PROJECT_KEYWORDS)) {
      // If project name contains category keyword
      if (projectNameLower.includes(category)) {
        for (const keyword of keywords) {
          if (lowerText.includes(keyword)) {
            confidence += 0.2;
            matchedKeywords.push(keyword);
          }
        }
      }
    }

    // Also check if task text contains any keywords that match project description
    if (project.description) {
      const descWords = project.description.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (descWords.includes(word) && word.length > 3) {
          confidence += 0.1;
          matchedKeywords.push(word);
        }
      }
    }

    // Normalize confidence (cap at 1.0)
    confidence = Math.min(confidence, 1.0);

    // Only suggest if confidence is above threshold
    if (confidence >= 0.3 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        project,
        confidence,
        matchedKeywords: [...new Set(matchedKeywords)],
      };
    }
  }

  return bestMatch;
}

/**
 * Get multiple project suggestions sorted by confidence
 */
export function getProjectSuggestions(
  text: string,
  projects: Project[],
  limit: number = 3
): ProjectSuggestion[] {
  if (!text || projects.length === 0) return [];

  const suggestions: ProjectSuggestion[] = [];
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  for (const project of projects) {
    if (project.isArchived) continue;

    const projectNameLower = project.name.toLowerCase();
    const projectWords = projectNameLower.split(/\s+/);
    const matchedKeywords: string[] = [];
    let confidence = 0;

    // Direct name match
    if (lowerText.includes(projectNameLower)) {
      confidence += 0.8;
      matchedKeywords.push(project.name);
    }

    // Partial word matches
    for (const word of words) {
      if (word.length < 3) continue;
      if (projectWords.some(pw => pw.includes(word) || word.includes(pw))) {
        confidence += 0.25;
        matchedKeywords.push(word);
      }
    }

    // Keyword category matches
    for (const [category, keywords] of Object.entries(PROJECT_KEYWORDS)) {
      if (projectNameLower.includes(category)) {
        for (const keyword of keywords) {
          if (lowerText.includes(keyword)) {
            confidence += 0.15;
            matchedKeywords.push(keyword);
          }
        }
      }
    }

    confidence = Math.min(confidence, 1.0);

    if (confidence >= 0.2) {
      suggestions.push({
        project,
        confidence,
        matchedKeywords: [...new Set(matchedKeywords)],
      });
    }
  }

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}
