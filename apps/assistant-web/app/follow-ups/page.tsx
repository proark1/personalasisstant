import { getToday, getWorkdayFollowUps } from "../../src/api/client";
import { FollowUpsShell } from "../../src/components/workday-detail-shell";

export default async function FollowUpsPage() {
  const [today, followUps] = await Promise.all([getToday(), getWorkdayFollowUps()]);
  return <FollowUpsShell today={today} followUps={followUps} />;
}
