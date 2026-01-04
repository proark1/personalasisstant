import { useMemo } from 'react';
import { FamilyMember, Activity } from './useFamilyMembers';
import { FamilyEvent } from './useFamilyEvents';
import { MealPlan } from './useMealPlanning';
import { ShoppingList } from './useShoppingLists';

export interface FamilyMemberContext {
  id: string;
  name: string;
  relationship: string;
  age: number | null;
  school: string | null;
  grade: string | null;
  teacherName: string | null;
  teacherContact: string | null;
  kindergarten: string | null;
  kindergartenTeacher: string | null;
  activities: Activity[];
  allergies: string[];
  medicalNotes: string | null;
  upcomingBirthday: { date: Date; age: number } | null;
  livesWithUser: boolean;
}

export interface FamilyScheduleContext {
  todayEvents: FamilyEvent[];
  tomorrowEvents: FamilyEvent[];
  thisWeekEvents: FamilyEvent[];
  upcomingBirthdays: { member: string; date: Date; age: number }[];
}

export interface FamilyMealsContext {
  todayMeals: MealPlan[];
  weekMeals: MealPlan[];
}

export interface FamilyShoppingContext {
  activeLists: ShoppingList[];
  pendingItems: number;
}

export interface FamilyContext {
  members: FamilyMemberContext[];
  children: FamilyMemberContext[];
  spouse: FamilyMemberContext | null;
  schedule: FamilyScheduleContext;
  meals: FamilyMealsContext;
  shopping: FamilyShoppingContext;
  summary: string;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getUpcomingBirthday(birthDate: string | null): { date: Date; age: number } | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  const thisYearBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  
  if (thisYearBirthday < today) {
    thisYearBirthday.setFullYear(today.getFullYear() + 1);
  }
  
  const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil > 60) return null; // Only show birthdays within 60 days
  
  const age = thisYearBirthday.getFullYear() - birth.getFullYear();
  return { date: thisYearBirthday, age };
}

export function useFamilyContext({
  members,
  events,
  mealPlans,
  shoppingLists,
}: {
  members: FamilyMember[];
  events: FamilyEvent[];
  mealPlans: MealPlan[];
  shoppingLists: ShoppingList[];
}): FamilyContext {
  return useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // Transform family members into context format
    const membersContext: FamilyMemberContext[] = members.map(m => ({
      id: m.id,
      name: m.name,
      relationship: m.relationship,
      age: calculateAge(m.birth_date),
      school: m.attends_school ? m.school_name : null,
      grade: m.school_grade,
      teacherName: m.teacher_name,
      teacherContact: m.teacher_contact,
      kindergarten: m.attends_kindergarten ? m.kindergarten_name : null,
      kindergartenTeacher: m.kindergarten_teacher_name,
      activities: m.activities || [],
      allergies: m.allergies || [],
      medicalNotes: m.medical_notes,
      upcomingBirthday: getUpcomingBirthday(m.birth_date),
      livesWithUser: m.lives_with_user,
    }));

    const children = membersContext.filter(m => m.relationship === 'child');
    const spouse = membersContext.find(m => m.relationship === 'spouse') || null;

    // Schedule context
    const todayEvents = events.filter(e => {
      const eventDate = new Date(e.start_time);
      return eventDate >= today && eventDate < tomorrow;
    });

    const tomorrowEvents = events.filter(e => {
      const eventDate = new Date(e.start_time);
      return eventDate >= tomorrow && eventDate < endOfTomorrow;
    });

    const thisWeekEvents = events.filter(e => {
      const eventDate = new Date(e.start_time);
      return eventDate >= today && eventDate < endOfWeek;
    });

    const upcomingBirthdays = membersContext
      .filter(m => m.upcomingBirthday)
      .map(m => ({
        member: m.name,
        date: m.upcomingBirthday!.date,
        age: m.upcomingBirthday!.age,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const schedule: FamilyScheduleContext = {
      todayEvents,
      tomorrowEvents,
      thisWeekEvents,
      upcomingBirthdays,
    };

    // Meals context
    const todayStr = today.toISOString().split('T')[0];
    const todayMeals = mealPlans.filter(m => m.meal_date === todayStr);
    const weekMeals = mealPlans.filter(m => {
      const mealDate = new Date(m.meal_date);
      return mealDate >= today && mealDate < endOfWeek;
    });

    const meals: FamilyMealsContext = {
      todayMeals,
      weekMeals,
    };

    // Shopping context
    const activeLists = shoppingLists.filter(l => !l.is_template && !l.is_completed);
    const pendingItems = 0; // Would need items loaded to calculate

    const shopping: FamilyShoppingContext = {
      activeLists,
      pendingItems,
    };

    // Build summary string for AI context
    const summaryParts: string[] = [];
    
    if (children.length > 0) {
      summaryParts.push(`Children: ${children.map(c => `${c.name} (${c.age || '?'} years old${c.school ? `, ${c.grade} at ${c.school}` : ''}${c.kindergarten ? `, at ${c.kindergarten}` : ''})`).join(', ')}`);
    }
    
    if (spouse) {
      summaryParts.push(`Spouse: ${spouse.name}`);
    }

    if (todayEvents.length > 0) {
      summaryParts.push(`Today's family schedule: ${todayEvents.map(e => {
        const time = new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${e.title} at ${time}${e.location ? ` (${e.location})` : ''}`;
      }).join(', ')}`);
    }

    if (upcomingBirthdays.length > 0) {
      summaryParts.push(`Upcoming birthdays: ${upcomingBirthdays.map(b => {
        const daysUntil = Math.ceil((b.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return `${b.member} turns ${b.age} in ${daysUntil} days`;
      }).join(', ')}`);
    }

    // Add children's activities
    const allActivities = children.flatMap(c => 
      c.activities.map(a => `${c.name}'s ${a.name} (${a.schedule}${a.location ? ` at ${a.location}` : ''})`)
    );
    if (allActivities.length > 0) {
      summaryParts.push(`Children's activities: ${allActivities.join(', ')}`);
    }

    // Add allergies
    const allergies = children.filter(c => c.allergies.length > 0)
      .map(c => `${c.name}: ${c.allergies.join(', ')}`);
    if (allergies.length > 0) {
      summaryParts.push(`Allergies to be aware of: ${allergies.join('; ')}`);
    }

    if (activeLists.length > 0) {
      summaryParts.push(`Active shopping lists: ${activeLists.map(l => l.name).join(', ')}`);
    }

    return {
      members: membersContext,
      children,
      spouse,
      schedule,
      meals,
      shopping,
      summary: summaryParts.join('\n'),
    };
  }, [members, events, mealPlans, shoppingLists]);
}

// Helper to build family context string for AI
export function buildFamilyContextForAI(context: FamilyContext): string {
  const parts: string[] = [];
  
  parts.push('\n\n## FAMILY INFORMATION');
  
  if (context.children.length > 0) {
    parts.push('\n### Children:');
    for (const child of context.children) {
      let childInfo = `- **${child.name}** (${child.age || 'age unknown'} years old, ${child.relationship})`;
      if (child.school) {
        childInfo += `\n  - School: ${child.school}${child.grade ? `, Grade: ${child.grade}` : ''}`;
        if (child.teacherName) {
          childInfo += `\n  - Teacher: ${child.teacherName}${child.teacherContact ? ` (${child.teacherContact})` : ''}`;
        }
      }
      if (child.kindergarten) {
        childInfo += `\n  - Kindergarten: ${child.kindergarten}`;
        if (child.kindergartenTeacher) {
          childInfo += `\n  - Teacher: ${child.kindergartenTeacher}`;
        }
      }
      if (child.activities.length > 0) {
        childInfo += `\n  - Activities: ${child.activities.map(a => `${a.name} (${a.schedule}${a.location ? ` at ${a.location}` : ''})`).join(', ')}`;
      }
      if (child.allergies.length > 0) {
        childInfo += `\n  - ⚠️ Allergies: ${child.allergies.join(', ')}`;
      }
      if (child.medicalNotes) {
        childInfo += `\n  - Medical notes: ${child.medicalNotes}`;
      }
      parts.push(childInfo);
    }
  }
  
  if (context.spouse) {
    parts.push(`\n### Spouse: ${context.spouse.name}`);
  }
  
  const otherMembers = context.members.filter(m => m.relationship !== 'child' && m.relationship !== 'spouse');
  if (otherMembers.length > 0) {
    parts.push('\n### Other family members:');
    for (const member of otherMembers) {
      parts.push(`- ${member.name} (${member.relationship}${member.age ? `, ${member.age} years old` : ''})`);
    }
  }
  
  if (context.schedule.todayEvents.length > 0) {
    parts.push('\n### Today\'s Family Schedule:');
    for (const event of context.schedule.todayEvents) {
      const time = new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTime = new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      parts.push(`- ${event.title}: ${time} - ${endTime}${event.location ? ` at ${event.location}` : ''}`);
    }
  }
  
  if (context.schedule.tomorrowEvents.length > 0) {
    parts.push('\n### Tomorrow\'s Family Schedule:');
    for (const event of context.schedule.tomorrowEvents) {
      const time = new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      parts.push(`- ${event.title} at ${time}${event.location ? ` (${event.location})` : ''}`);
    }
  }
  
  if (context.schedule.upcomingBirthdays.length > 0) {
    parts.push('\n### Upcoming Birthdays:');
    for (const bday of context.schedule.upcomingBirthdays) {
      const daysUntil = Math.ceil((bday.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      parts.push(`- ${bday.member} turns ${bday.age} in ${daysUntil} days (${bday.date.toLocaleDateString()})`);
    }
  }
  
  if (context.shopping.activeLists.length > 0) {
    parts.push('\n### Active Shopping Lists:');
    parts.push(context.shopping.activeLists.map(l => `- ${l.name}${l.due_date ? ` (due ${l.due_date})` : ''}`).join('\n'));
  }
  
  return parts.join('\n');
}
