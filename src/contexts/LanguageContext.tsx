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
    'nav.assistant': 'Assistant',
    'nav.chat': 'Chat',
    'nav.calls': 'Calls',
    'nav.projects': 'Projects',
    'nav.activity': 'Activity',
    'nav.admin': 'Admin',
    'nav.search': 'Search',
    'nav.todayFocus': "Today's Focus",
    'nav.focusMode': 'Focus Mode',
    'nav.weeklyReview': 'Weekly Review',
    'nav.voiceMode': 'Voice Mode',
    'nav.signOut': 'Sign Out',
    'nav.main': 'Main',
    'nav.productivity': 'Productivity',
    
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
    'meals.dropHere': 'Drop here',
    
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
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.today': 'Today',
    'common.tomorrow': 'Tomorrow',
    'common.yesterday': 'Yesterday',
    'common.thisWeek': 'This Week',
    'common.completed': 'Completed',
    'common.pending': 'Pending',
    'common.overdue': 'Overdue',
    'common.priority': 'Priority',
    'common.dueDate': 'Due Date',
    'common.category': 'Category',
    'common.description': 'Description',
    'common.title': 'Title',
    'common.name': 'Name',
    'common.email': 'Email',
    'common.phone': 'Phone',
    'common.address': 'Address',
    'common.notes': 'Notes',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.view': 'View',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.new': 'New',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.remove': 'Remove',
    
    // Recipe Dialog
    'recipe.name': 'Recipe Name',
    'recipe.description': 'Description',
    'recipe.category': 'Category',
    'recipe.servings': 'Servings',
    'recipe.prepTime': 'Prep Time (minutes)',
    'recipe.cookTime': 'Cook Time (minutes)',
    'recipe.instructions': 'Instructions',
    'recipe.ingredients': 'Ingredients',
    'recipe.addRecipe': 'Add Recipe',
    'recipe.editRecipe': 'Edit Recipe',
    'recipe.noDetails': 'No recipe details available.',
    'recipe.notFound': 'Recipe not found.',
    'recipe.other': 'Other',
    
    // Add Meal Dialog
    'addMeal.title': 'Add Meal',
    'addMeal.date': 'Date',
    'addMeal.mealType': 'Meal Type',
    'addMeal.selectRecipe': 'Select a recipe',
    'addMeal.orCustomMeal': 'Or enter custom meal name',
    'addMeal.customMealName': 'Custom Meal Name',
    'addMeal.servings': 'Servings',
    'addMeal.notes': 'Notes (optional)',
    
    // Dashboard
    'dashboard.welcome': 'Welcome',
    'dashboard.overview': 'Overview',
    'dashboard.tasksToday': 'Tasks Today',
    'dashboard.upcomingEvents': 'Upcoming Events',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.statistics': 'Statistics',
    'dashboard.progress': 'Progress',
    
    // Tasks
    'tasks.title': 'Tasks',
    'tasks.addTask': 'Add Task',
    'tasks.newTask': 'New Task',
    'tasks.editTask': 'Edit Task',
    'tasks.deleteTask': 'Delete Task',
    'tasks.markComplete': 'Mark Complete',
    'tasks.markIncomplete': 'Mark Incomplete',
    'tasks.noTasks': 'No tasks',
    'tasks.allCompleted': 'All tasks completed!',
    'tasks.dueToday': 'Due Today',
    'tasks.overdue': 'Overdue',
    'tasks.upcoming': 'Upcoming',
    'tasks.completed': 'Completed',
    'tasks.highPriority': 'High Priority',
    'tasks.mediumPriority': 'Medium Priority',
    'tasks.lowPriority': 'Low Priority',
    
    // Calendar
    'calendar.title': 'Calendar',
    'calendar.today': 'Today',
    'calendar.month': 'Month',
    'calendar.week': 'Week',
    'calendar.day': 'Day',
    'calendar.addEvent': 'Add Event',
    'calendar.editEvent': 'Edit Event',
    'calendar.deleteEvent': 'Delete Event',
    'calendar.noEvents': 'No events',
    'calendar.allDay': 'All Day',
    
    // Settings
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.account': 'Account',
    'settings.preferences': 'Preferences',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.darkMode': 'Dark Mode',
    'settings.lightMode': 'Light Mode',
    'settings.systemMode': 'System',
    'settings.save': 'Save Settings',
    'settings.saved': 'Settings saved',
    
    // Contacts
    'contacts.title': 'Contacts',
    'contacts.addContact': 'Add Contact',
    'contacts.editContact': 'Edit Contact',
    'contacts.deleteContact': 'Delete Contact',
    'contacts.noContacts': 'No contacts',
    'contacts.searchContacts': 'Search contacts...',
    
    // Habits
    'habits.title': 'Habits',
    'habits.addHabit': 'Add Habit',
    'habits.editHabit': 'Edit Habit',
    'habits.deleteHabit': 'Delete Habit',
    'habits.streak': 'Streak',
    'habits.completed': 'Completed',
    'habits.noHabits': 'No habits',
    'habits.daily': 'Daily',
    'habits.weekly': 'Weekly',
    
    // Projects
    'projects.title': 'Projects',
    'projects.addProject': 'Add Project',
    'projects.editProject': 'Edit Project',
    'projects.deleteProject': 'Delete Project',
    'projects.noProjects': 'No projects',
    'projects.archived': 'Archived',
    'projects.active': 'Active',
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
    'nav.assistant': 'Assistent',
    'nav.chat': 'Chat',
    'nav.calls': 'Anrufe',
    'nav.projects': 'Projekte',
    'nav.activity': 'Aktivität',
    'nav.admin': 'Admin',
    'nav.search': 'Suche',
    'nav.todayFocus': 'Heute im Fokus',
    'nav.focusMode': 'Fokus-Modus',
    'nav.weeklyReview': 'Wochenrückblick',
    'nav.voiceMode': 'Sprachmodus',
    'nav.signOut': 'Abmelden',
    'nav.main': 'Hauptmenü',
    'nav.productivity': 'Produktivität',
    
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
    'meals.dropHere': 'Hier ablegen',
    
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
    'common.search': 'Suchen',
    'common.filter': 'Filtern',
    'common.all': 'Alle',
    'common.today': 'Heute',
    'common.tomorrow': 'Morgen',
    'common.yesterday': 'Gestern',
    'common.thisWeek': 'Diese Woche',
    'common.completed': 'Abgeschlossen',
    'common.pending': 'Ausstehend',
    'common.overdue': 'Überfällig',
    'common.priority': 'Priorität',
    'common.dueDate': 'Fälligkeitsdatum',
    'common.category': 'Kategorie',
    'common.description': 'Beschreibung',
    'common.title': 'Titel',
    'common.name': 'Name',
    'common.email': 'E-Mail',
    'common.phone': 'Telefon',
    'common.address': 'Adresse',
    'common.notes': 'Notizen',
    'common.status': 'Status',
    'common.actions': 'Aktionen',
    'common.view': 'Ansehen',
    'common.close': 'Schließen',
    'common.confirm': 'Bestätigen',
    'common.back': 'Zurück',
    'common.next': 'Weiter',
    'common.previous': 'Vorherige',
    'common.new': 'Neu',
    'common.create': 'Erstellen',
    'common.update': 'Aktualisieren',
    'common.remove': 'Entfernen',
    
    // Recipe Dialog
    'recipe.name': 'Rezeptname',
    'recipe.description': 'Beschreibung',
    'recipe.category': 'Kategorie',
    'recipe.servings': 'Portionen',
    'recipe.prepTime': 'Vorbereitungszeit (Minuten)',
    'recipe.cookTime': 'Kochzeit (Minuten)',
    'recipe.instructions': 'Zubereitung',
    'recipe.ingredients': 'Zutaten',
    'recipe.addRecipe': 'Rezept hinzufügen',
    'recipe.editRecipe': 'Rezept bearbeiten',
    'recipe.noDetails': 'Keine Rezeptdetails verfügbar.',
    'recipe.notFound': 'Rezept nicht gefunden.',
    'recipe.other': 'Sonstiges',
    
    // Add Meal Dialog
    'addMeal.title': 'Mahlzeit hinzufügen',
    'addMeal.date': 'Datum',
    'addMeal.mealType': 'Mahlzeit',
    'addMeal.selectRecipe': 'Rezept auswählen',
    'addMeal.orCustomMeal': 'Oder eigene Mahlzeit eingeben',
    'addMeal.customMealName': 'Name der Mahlzeit',
    'addMeal.servings': 'Portionen',
    'addMeal.notes': 'Notizen (optional)',
    
    // Dashboard
    'dashboard.welcome': 'Willkommen',
    'dashboard.overview': 'Übersicht',
    'dashboard.tasksToday': 'Aufgaben heute',
    'dashboard.upcomingEvents': 'Anstehende Termine',
    'dashboard.recentActivity': 'Letzte Aktivität',
    'dashboard.quickActions': 'Schnellaktionen',
    'dashboard.statistics': 'Statistiken',
    'dashboard.progress': 'Fortschritt',
    
    // Tasks
    'tasks.title': 'Aufgaben',
    'tasks.addTask': 'Aufgabe hinzufügen',
    'tasks.newTask': 'Neue Aufgabe',
    'tasks.editTask': 'Aufgabe bearbeiten',
    'tasks.deleteTask': 'Aufgabe löschen',
    'tasks.markComplete': 'Als erledigt markieren',
    'tasks.markIncomplete': 'Als unerledigt markieren',
    'tasks.noTasks': 'Keine Aufgaben',
    'tasks.allCompleted': 'Alle Aufgaben erledigt!',
    'tasks.dueToday': 'Heute fällig',
    'tasks.overdue': 'Überfällig',
    'tasks.upcoming': 'Anstehend',
    'tasks.completed': 'Erledigt',
    'tasks.highPriority': 'Hohe Priorität',
    'tasks.mediumPriority': 'Mittlere Priorität',
    'tasks.lowPriority': 'Niedrige Priorität',
    
    // Calendar
    'calendar.title': 'Kalender',
    'calendar.today': 'Heute',
    'calendar.month': 'Monat',
    'calendar.week': 'Woche',
    'calendar.day': 'Tag',
    'calendar.addEvent': 'Termin hinzufügen',
    'calendar.editEvent': 'Termin bearbeiten',
    'calendar.deleteEvent': 'Termin löschen',
    'calendar.noEvents': 'Keine Termine',
    'calendar.allDay': 'Ganztägig',
    
    // Settings
    'settings.title': 'Einstellungen',
    'settings.profile': 'Profil',
    'settings.account': 'Konto',
    'settings.preferences': 'Voreinstellungen',
    'settings.notifications': 'Benachrichtigungen',
    'settings.appearance': 'Erscheinungsbild',
    'settings.language': 'Sprache',
    'settings.theme': 'Design',
    'settings.darkMode': 'Dunkelmodus',
    'settings.lightMode': 'Hellmodus',
    'settings.systemMode': 'System',
    'settings.save': 'Einstellungen speichern',
    'settings.saved': 'Einstellungen gespeichert',
    
    // Contacts
    'contacts.title': 'Kontakte',
    'contacts.addContact': 'Kontakt hinzufügen',
    'contacts.editContact': 'Kontakt bearbeiten',
    'contacts.deleteContact': 'Kontakt löschen',
    'contacts.noContacts': 'Keine Kontakte',
    'contacts.searchContacts': 'Kontakte suchen...',
    
    // Habits
    'habits.title': 'Gewohnheiten',
    'habits.addHabit': 'Gewohnheit hinzufügen',
    'habits.editHabit': 'Gewohnheit bearbeiten',
    'habits.deleteHabit': 'Gewohnheit löschen',
    'habits.streak': 'Serie',
    'habits.completed': 'Abgeschlossen',
    'habits.noHabits': 'Keine Gewohnheiten',
    'habits.daily': 'Täglich',
    'habits.weekly': 'Wöchentlich',
    
    // Projects
    'projects.title': 'Projekte',
    'projects.addProject': 'Projekt hinzufügen',
    'projects.editProject': 'Projekt bearbeiten',
    'projects.deleteProject': 'Projekt löschen',
    'projects.noProjects': 'Keine Projekte',
    'projects.archived': 'Archiviert',
    'projects.active': 'Aktiv',
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
