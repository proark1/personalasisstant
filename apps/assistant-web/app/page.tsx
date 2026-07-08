import { getToday } from "../src/api/client";
import { TodayShell } from "../src/components/today-shell";

export default async function Home() {
  const today = await getToday();
  return <TodayShell today={today} />;
}
