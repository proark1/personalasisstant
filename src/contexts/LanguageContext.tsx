import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'de';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Tabs
    'nav.weekPlanner': 'Week Planner',
    'nav.recipes': 'Recipes',
    'nav.dashboard': 'Dashboard',
    'nav.tasks': 'Tasks',
    'nav.calendar': 'Calendar',
    'nav.notes': 'Notes',
    'nav.habits': 'Habits',
    'nav.contacts': 'Contacts',
    'nav.contracts': 'Contracts',
    'nav.family': 'Family',
    'nav.settings': 'Settings',
    
    // Meal Planning
    'meals.generateShoppingList': 'Generate Shopping List',
    'meals.addRecipe': 'Add Recipe',
    'meals.addMeal': 'Add',
    'meals.noMeals': 'No meals',
    'meals.servings': 'servings',
    'meals.mealPlanned': 'meal planned',
    'meals.mealsPlanned': 'meals planned',
    'meals.removeMeal': 'Remove meal',
    'meals.dragToMove': 'Drag to move',
    'meals.mealDetails': 'Meal Details',
    'meals.recipe': 'Recipe',
    'meals.notes': 'Notes',
    'meals.noNotes': 'No notes',
    'meals.viewRecipe': 'View Recipe',
    'meals.prepTime': 'Prep time',
    'meals.cookTime': 'Cook time',
    'meals.minutes': 'min',
    
    // Meal Types
    'mealType.breakfast': 'Breakfast',
    'mealType.lunch': 'Lunch',
    'mealType.dinner': 'Dinner',
    'mealType.snack': 'Snack',
    
    // Days
    'day.mon': 'Mon',
    'day.tue': 'Tue',
    'day.wed': 'Wed',
    'day.thu': 'Thu',
    'day.fri': 'Fri',
    'day.sat': 'Sat',
    'day.sun': 'Sun',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.loading': 'Loading...',
    'common.language': 'Language',
    'common.english': 'English',
    'common.german': 'German',
    
    // Recipe Dialog
    'recipe.name': 'Recipe Name',
    'recipe.description': 'Description',
    'recipe.category': 'Category',
    'recipe.servings': 'Servings',
    'recipe.prepTime': 'Prep Time (minutes)',
    'recipe.cookTime': 'Cook Time (minutes)',
    'recipe.instructions': 'Instructions',
    'recipe.addRecipe': 'Add Recipe',
    'recipe.editRecipe': 'Edit Recipe',
    
    // Add Meal Dialog
    'addMeal.title': 'Add Meal',
    'addMeal.date': 'Date',
    'addMeal.mealType': 'Meal Type',
    'addMeal.selectRecipe': 'Select a recipe',
    'addMeal.orCustomMeal': 'Or enter custom meal name',
    'addMeal.customMealName': 'Custom Meal Name',
    'addMeal.servings': 'Servings',
    'addMeal.notes': 'Notes (optional)',
  },
  de: {
    // Navigation & Tabs
    'nav.weekPlanner': 'Wochenplaner',
    'nav.recipes': 'Rezepte',
    'nav.dashboard': 'Dashboard',
    'nav.tasks': 'Aufgaben',
    'nav.calendar': 'Kalender',
    'nav.notes': 'Notizen',
    'nav.habits': 'Gewohnheiten',
    'nav.contacts': 'Kontakte',
    'nav.contracts': 'Verträge',
    'nav.family': 'Familie',
    'nav.settings': 'Einstellungen',
    
    // Meal Planning
    'meals.generateShoppingList': 'Einkaufsliste erstellen',
    'meals.addRecipe': 'Rezept hinzufügen',
    'meals.addMeal': 'Hinzufügen',
    'meals.noMeals': 'Keine Mahlzeiten',
    'meals.servings': 'Portionen',
    'meals.mealPlanned': 'Mahlzeit geplant',
    'meals.mealsPlanned': 'Mahlzeiten geplant',
    'meals.removeMeal': 'Mahlzeit entfernen',
    'meals.dragToMove': 'Ziehen zum Verschieben',
    'meals.mealDetails': 'Mahlzeit Details',
    'meals.recipe': 'Rezept',
    'meals.notes': 'Notizen',
    'meals.noNotes': 'Keine Notizen',
    'meals.viewRecipe': 'Rezept anzeigen',
    'meals.prepTime': 'Vorbereitungszeit',
    'meals.cookTime': 'Kochzeit',
    'meals.minutes': 'Min',
    
    // Meal Types
    'mealType.breakfast': 'Frühstück',
    'mealType.lunch': 'Mittagessen',
    'mealType.dinner': 'Abendessen',
    'mealType.snack': 'Snack',
    
    // Days
    'day.mon': 'Mo',
    'day.tue': 'Di',
    'day.wed': 'Mi',
    'day.thu': 'Do',
    'day.fri': 'Fr',
    'day.sat': 'Sa',
    'day.sun': 'So',
    
    // Common
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.add': 'Hinzufügen',
    'common.loading': 'Laden...',
    'common.language': 'Sprache',
    'common.english': 'Englisch',
    'common.german': 'Deutsch',
    
    // Recipe Dialog
    'recipe.name': 'Rezeptname',
    'recipe.description': 'Beschreibung',
    'recipe.category': 'Kategorie',
    'recipe.servings': 'Portionen',
    'recipe.prepTime': 'Vorbereitungszeit (Minuten)',
    'recipe.cookTime': 'Kochzeit (Minuten)',
    'recipe.instructions': 'Zubereitung',
    'recipe.addRecipe': 'Rezept hinzufügen',
    'recipe.editRecipe': 'Rezept bearbeiten',
    
    // Add Meal Dialog
    'addMeal.title': 'Mahlzeit hinzufügen',
    'addMeal.date': 'Datum',
    'addMeal.mealType': 'Mahlzeit',
    'addMeal.selectRecipe': 'Rezept auswählen',
    'addMeal.orCustomMeal': 'Oder eigene Mahlzeit eingeben',
    'addMeal.customMealName': 'Name der Mahlzeit',
    'addMeal.servings': 'Portionen',
    'addMeal.notes': 'Notizen (optional)',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'de';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
