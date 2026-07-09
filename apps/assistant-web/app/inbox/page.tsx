import { getToday, getWorkdayInbox } from "../../src/api/client";
import { InboxReviewShell } from "../../src/components/workday-detail-shell";

export default async function InboxPage() {
  const [today, inbox] = await Promise.all([getToday(), getWorkdayInbox()]);
  return <InboxReviewShell today={today} inbox={inbox} />;
}
