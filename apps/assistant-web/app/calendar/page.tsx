import { getToday, getWorkdayCalendar } from "../../src/api/client";
import { getServerSessionToken } from "../../src/api/session";
import { CalendarPlanShell } from "../../src/components/workday-detail-shell";

export default async function CalendarPage() {
  const token = await getServerSessionToken();
  const [today, calendar] = await Promise.all([getToday(token), getWorkdayCalendar(token)]);
  return <CalendarPlanShell today={today} calendar={calendar} />;
}
