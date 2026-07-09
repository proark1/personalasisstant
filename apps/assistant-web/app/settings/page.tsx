import { getProviderStatus, getToday } from "../../src/api/client";
import { getServerSessionToken } from "../../src/api/session";
import { SettingsShell } from "../../src/components/settings-shell";

export default async function SettingsPage() {
  const token = await getServerSessionToken();
  const [today, providerStatus] = await Promise.all([getToday(token), getProviderStatus(token)]);
  return <SettingsShell today={today} providerStatus={providerStatus} />;
}
