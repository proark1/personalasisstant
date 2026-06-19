import { startOfDay, subDays } from "date-fns";

interface StreakTask {
  completed: boolean;
  dueDate?: Date | null;
}

// Count consecutive days (ending today) where at least one task with a
// dueDate was completed. Caps at 30 days to bound the scan.
export function calculateProductivityStreak(tasks: StreakTask[]): number {
  const completedDays = new Set(
    tasks.filter((t) => t.completed && t.dueDate).map((t) => startOfDay(t.dueDate!).getTime()),
  );
  if (completedDays.size === 0) return 0;

  let streak = 0;
  for (let i = 0; i <= 30; i++) {
    const day = startOfDay(subDays(new Date(), i)).getTime();
    if (completedDays.has(day)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
