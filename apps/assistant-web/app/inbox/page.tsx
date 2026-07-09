import { getToday, getWorkdayInbox } from "../../src/api/client";
import { getServerSessionToken } from "../../src/api/session";
import { InboxReviewShell } from "../../src/components/workday-detail-shell";

export default async function InboxPage() {
  const token = await getServerSessionToken();
  const [today, inbox] = await Promise.all([getToday(token), getWorkdayInbox(token)]);
  return <InboxReviewShell today={today} inbox={inbox} />;
}
