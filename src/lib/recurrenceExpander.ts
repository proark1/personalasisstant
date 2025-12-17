import { parseRRuleString } from './recurrence';
import { addDays, addWeeks, addMonths, addYears, startOfDay, isBefore, isAfter, getDay } from 'date-fns';

interface RecurrenceInstance {
  date: Date;
  isInstance: true;
  originalId: string;
}

/**
 * Expands a recurrence rule into individual instances within a date range
 */
export function expandRecurrence(
  startDate: Date,
  rrule: string,
  rangeStart: Date,
  rangeEnd: Date,
  endDate?: Date,
  originalId: string = ''
): RecurrenceInstance[] {
  const rule = parseRRuleString(rrule);
  if (!rule) return [];

  const instances: RecurrenceInstance[] = [];
  const effectiveEnd = endDate && isBefore(endDate, rangeEnd) ? endDate : rangeEnd;
  
  let currentDate = startOfDay(new Date(startDate));
  const maxIterations = 365; // Safety limit
  let iterations = 0;

  while (isBefore(currentDate, effectiveEnd) && iterations < maxIterations) {
    iterations++;

    // Check if this date is within our range
    if (!isBefore(currentDate, rangeStart) && isBefore(currentDate, effectiveEnd)) {
      // For weekly recurrence with specific days, check if the day matches
      if (rule.frequency === 'weekly' && rule.daysOfWeek?.length) {
        const dayOfWeek = getDay(currentDate);
        if (rule.daysOfWeek.includes(dayOfWeek)) {
          instances.push({
            date: new Date(currentDate),
            isInstance: true,
            originalId,
          });
        }
      } else {
        instances.push({
          date: new Date(currentDate),
          isInstance: true,
          originalId,
        });
      }
    }

    // Calculate next date based on frequency
    switch (rule.frequency) {
      case 'daily':
        currentDate = addDays(currentDate, rule.interval);
        break;
      case 'weekly':
        if (rule.daysOfWeek?.length) {
          // For weekly with specific days, move one day at a time
          currentDate = addDays(currentDate, 1);
        } else {
          currentDate = addWeeks(currentDate, rule.interval);
        }
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, rule.interval);
        break;
      case 'yearly':
        currentDate = addYears(currentDate, rule.interval);
        break;
    }
  }

  return instances;
}

/**
 * Expand recurring items (tasks or events) into all instances within a range
 */
export function expandRecurringItems<T extends { 
  id: string; 
  dueDate?: Date; 
  startTime?: Date;
  recurrenceRule?: string; 
  recurrenceEnd?: Date;
}>(
  items: T[],
  rangeStart: Date,
  rangeEnd: Date
): (T & { instanceDate?: Date; isRecurrenceInstance?: boolean })[] {
  const result: (T & { instanceDate?: Date; isRecurrenceInstance?: boolean })[] = [];

  items.forEach(item => {
    const itemDate = item.dueDate || item.startTime;
    
    if (!item.recurrenceRule || !itemDate) {
      // Non-recurring item, include as-is if within range
      result.push(item);
    } else {
      // Recurring item, expand into instances
      const instances = expandRecurrence(
        itemDate,
        item.recurrenceRule,
        rangeStart,
        rangeEnd,
        item.recurrenceEnd,
        item.id
      );

      instances.forEach((instance, index) => {
        result.push({
          ...item,
          id: index === 0 ? item.id : `${item.id}-instance-${index}`,
          instanceDate: instance.date,
          isRecurrenceInstance: index > 0,
          ...(item.dueDate ? { dueDate: instance.date } : {}),
          ...(item.startTime ? { 
            startTime: instance.date,
            endTime: item.startTime && (item as any).endTime 
              ? new Date(instance.date.getTime() + ((item as any).endTime.getTime() - item.startTime.getTime()))
              : undefined
          } : {}),
        });
      });
    }
  });

  return result;
}
