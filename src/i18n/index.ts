// i18n registry. Add a new locale by creating a sibling `xx.ts` and
// registering it here. Keep the union in sync with the keys of
// `translations`.

import en from "./en";
import de from "./de";

export type Language = "en" | "de";

export const translations: Record<Language, Record<string, string>> = {
  en,
  de,
};

export const SUPPORTED_LANGUAGES: Language[] = ["en", "de"];

// Resolve a translation key. Unknown keys return the key itself, which
// matches the previous behaviour and makes missing-translation bugs
// visible in the UI without crashing.
export function translate(language: Language, key: string): string {
  return translations[language][key] ?? key;
}
