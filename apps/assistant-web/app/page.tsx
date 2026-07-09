import { getProviderStatus, getToday } from "../src/api/client";
import { getServerSessionToken } from "../src/api/session";
import { TodayShell } from "../src/components/today-shell";

export default async function Home() {
  const token = await getServerSessionToken();
  const [today, providerStatus] = await Promise.all([getToday(token), getProviderStatus(token)]);
  return <TodayShell today={today} providerStatus={providerStatus} />;
}
