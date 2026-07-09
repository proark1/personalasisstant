import { getToday, getWorkdayFollowUps } from "../../src/api/client";
import { getServerSessionToken } from "../../src/api/session";
import { FollowUpsShell } from "../../src/components/workday-detail-shell";

export default async function FollowUpsPage() {
  const token = await getServerSessionToken();
  const [today, followUps] = await Promise.all([getToday(token), getWorkdayFollowUps(token)]);
  return <FollowUpsShell today={today} followUps={followUps} />;
}
