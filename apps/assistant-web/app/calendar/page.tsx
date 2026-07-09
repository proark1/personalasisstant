import { getToday, getWorkdayCalendar } from "../../src/api/client";
import { CalendarPlanShell } from "../../src/components/workday-detail-shell";

export default async function CalendarPage() {
  const [today, calendar] = await Promise.all([getToday(), getWorkdayCalendar()]);
  return <CalendarPlanShell today={today} calendar={calendar} />;
}
