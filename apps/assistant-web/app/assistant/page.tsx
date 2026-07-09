import { getToday } from "../../src/api/client";
import { getServerSessionToken } from "../../src/api/session";
import { AssistantShell } from "../../src/components/assistant-shell";

export default async function AssistantPage() {
  const token = await getServerSessionToken();
  const today = await getToday(token);
  return <AssistantShell today={today} />;
}
