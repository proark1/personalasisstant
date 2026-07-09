import { getProviderStatus, getToday } from "../src/api/client";
import { TodayShell } from "../src/components/today-shell";

export default async function Home() {
  const [today, providerStatus] = await Promise.all([getToday(), getProviderStatus()]);
  return <TodayShell today={today} providerStatus={providerStatus} />;
}
