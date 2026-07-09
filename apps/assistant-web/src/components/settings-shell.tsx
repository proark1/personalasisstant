import { UserCircle } from "lucide-react";

import type { ProviderStatusResponse, TodayResponse } from "../api/client";
import { ProviderAccountsPanel } from "./provider-accounts-panel";
import { TelegramSetupPanel } from "./telegram-setup-panel";
import { WorkdayFrame } from "./workday-detail-shell";

export function SettingsShell({
  today,
  providerStatus
}: {
  today: TodayResponse;
  providerStatus: ProviderStatusResponse;
}) {
  return (
    <WorkdayFrame
      today={today}
      activeKey="settings"
      title="Settings"
      meta="Connections & channels"
    >
      <section className="stack">
        <article className="brief-row">
          <div className="row-icon" aria-hidden="true">
            <UserCircle size={17} />
          </div>
          <div>
            <strong>Signed in</strong>
            <p>
              {today.user_id} · account {today.account_id} · space {today.space_id}
            </p>
          </div>
        </article>

        <ProviderAccountsPanel status={providerStatus} />

        <section aria-labelledby="channels-heading" className="telegram-panel">
          <div className="section-header">
            <h2 id="channels-heading" className="section-title">
              Telegram
            </h2>
            <span className="section-meta">notifications &amp; approvals</span>
          </div>
          <TelegramSetupPanel />
        </section>
      </section>
    </WorkdayFrame>
  );
}
