import { parseRRuleString } from "./recurrence";
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  startOfDay,
  isBefore,
  isAfter,
  getDay,
} from "date-fns";

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
  originalId: string = "",
  exceptions?: ReadonlySet<string>,
): RecurrenceInstance[] {
  const rule = parseRRuleString(rrule);
  if (!rule) return [];

  const instances: RecurrenceInstance[] = [];
  const effectiveEnd = endDate && isBefore(endDate, rangeEnd) ? endDate : rangeEnd;

  let currentDate = startOfDay(new Date(startDate));
  const maxIterations = 500; // Increased safety limit for longer ranges
  let iterations = 0;

  // Cheap YYYY-MM-DD key for the exception set lookup. Format must match
  // what the manage_exception tool stores (date column → toISOString slice).
  const ymd = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // If the start date is after range end, no instances to return
  if (isAfter(currentDate, effectiveEnd)) {
    return [];
  }

  while (!isAfter(currentDate, effectiveEnd) && iterations < maxIterations) {
    iterations++;

    // Check if this date is within our range (use >= and <= for inclusive)
    const isInRange =
      !isBefore(currentDate, startOfDay(rangeStart)) && !isAfter(currentDate, effectiveEnd);
    const isException = exceptions?.has(ymd(currentDate)) ?? false;

    if (isInRange && !isException) {
      // For weekly recurrence with specific days, check if the day matches
      if (rule.frequency === "weekly" && rule.daysOfWeek?.length) {
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
      case "daily":
        currentDate = addDays(currentDate, rule.interval);
        break;
      case "weekly":
        if (rule.daysOfWeek?.length) {
          // For weekly with specific days, move one day at a time
          currentDate = addDays(currentDate, 1);
        } else {
          currentDate = addWeeks(currentDate, rule.interval);
        }
        break;
      case "monthly":
        currentDate = addMonths(currentDate, rule.interval);
        break;
      case "yearly":
        currentDate = addYears(currentDate, rule.interval);
        break;
    }
  }

  return instances;
}

/**
 * Apply the time-of-day (hours/minutes/seconds/ms) from `timeSource` onto the
 * calendar day in `day`. The recurrence engine iterates on start-of-day dates,
 * so without this every recurring instance would collapse to 00:00 and events
 * would render at midnight.
 */
function withTimeOfDay(day: Date, timeSource: Date): Date {
  const d = new Date(day);
  d.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  );
  return d;
}

/**
 * Expand recurring items (tasks or events) into all instances within a range
 */
export function expandRecurringItems<
  T extends {
    id: string;
    dueDate?: Date;
    startTime?: Date;
    recurrenceRule?: string;
    recurrenceEnd?: Date;
  },
>(
  items: T[],
  rangeStart: Date,
  rangeEnd: Date,
  // Map of parent id → Set of "YYYY-MM-DD" dates that should be skipped
  // (from the recurrence_exceptions table). Optional — when omitted no
  // dates are skipped, preserving the legacy expansion behaviour.
  exceptionsByParentId?: ReadonlyMap<string, ReadonlySet<string>>,
): (T & { instanceDate?: Date; isRecurrenceInstance?: boolean })[] {
  const result: (T & { instanceDate?: Date; isRecurrenceInstance?: boolean })[] = [];

  items.forEach((item) => {
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
        item.id,
        exceptionsByParentId?.get(item.id),
      );

      instances.forEach((instance, index) => {
        const expanded: T & { instanceDate?: Date; isRecurrenceInstance?: boolean } = {
          ...item,
          id: index === 0 ? item.id : `${item.id}-instance-${index}`,
          instanceDate: instance.date,
          isRecurrenceInstance: index > 0,
        };

        // Tasks keep their original time-of-day on the recurring day.
        if (item.dueDate) {
          const due = withTimeOfDay(instance.date, item.dueDate);
          expanded.dueDate = due;
          expanded.instanceDate = due;
        }

        // Events keep their time-of-day and preserve the original duration.
        // endTime is never left undefined — a one-hour default is used when the
        // source event has no (or an invalid) end — so downstream formatters
        // can't hit an "Invalid time value" and crash the calendar.
        if (item.startTime) {
          const start = withTimeOfDay(instance.date, item.startTime);
          const sourceEnd = (item as { endTime?: Date }).endTime;
          const durationMs =
            sourceEnd instanceof Date && !Number.isNaN(sourceEnd.getTime())
              ? Math.max(0, sourceEnd.getTime() - item.startTime.getTime())
              : 60 * 60 * 1000;
          (expanded as { startTime?: Date }).startTime = start;
          (expanded as { endTime?: Date }).endTime = new Date(start.getTime() + durationMs);
          expanded.instanceDate = start;
        }

        result.push(expanded);
      });
    }
  });

  return result;
}
