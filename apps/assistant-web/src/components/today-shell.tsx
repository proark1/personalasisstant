import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  Lightbulb,
  ListChecks,
  RadioTower,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Target
} from "lucide-react";
import type { ProviderStatusResponse, TodayResponse } from "../api/client";
import { ApprovalCard } from "./approval-card";
import { ProviderAccountsPanel } from "./provider-accounts-panel";
import { TelegramSetupPanel } from "./telegram-setup-panel";

const iconMap = {
  today: Sparkles,
  inbox: Inbox,
  followups: ListChecks,
  calendar: CalendarDays,
  assistant: Bot,
  settings: Settings
} as const;

export function TodayShell({
  today,
  providerStatus
}: {
  today: TodayResponse;
  providerStatus: ProviderStatusResponse;
}) {
  const activeKey = "today";
  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Primary">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <span>OneBrain Assistant</span>
        </div>
        <nav className="nav-list">
          {today.navigation.map((item) => {
            const Icon = iconMap[item.key as keyof typeof iconMap] ?? ChevronRight;
            return (
              <a key={item.key} className="nav-item" href={item.href} data-active={item.key === activeKey}>
                <span className="nav-label">
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </span>
                {typeof item.count === "number" ? <span className="nav-count">{item.count}</span> : null}
              </a>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">{today.local_date}</div>
            <h1 className="page-title">Today</h1>
          </div>
          <span className="status-pill" data-degraded={today.degraded_mode.active}>
            <span className="status-dot" aria-hidden="true" />
            {today.degraded_mode.active ? "Degraded" : "Ready"}
          </span>
        </header>

        <div className="work-grid">
          <div className="stack">
            {today.degraded_mode.active ? <DegradedBand today={today} /> : null}
            <PrioritySection today={today} />
            {today.proactive_suggestion ? <SuggestionSection today={today} /> : null}
            <BriefSection today={today} />
            <HealthSection today={today} />
          </div>

          <div className="stack">
            <ProviderAccountsPanel status={providerStatus} />
            <TelegramSetupPanel />
            <ApprovalSection today={today} />
          </div>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Primary mobile">
        {today.navigation.map((item) => {
          const Icon = iconMap[item.key as keyof typeof iconMap] ?? ChevronRight;
          return (
            <a key={item.key} href={item.href} data-active={item.key === activeKey} aria-label={item.label}>
              <Icon size={20} aria-hidden="true" />
            </a>
          );
        })}
      </nav>
    </div>
  );
}

function PrioritySection({ today }: { today: TodayResponse }) {
  const priorities = today.priorities ?? [];
  return (
    <section aria-labelledby="priority-heading">
      <div className="section-header">
        <h2 id="priority-heading" className="section-title">
          Now
        </h2>
        <span className="section-meta">{priorities.length}</span>
      </div>
      <div className="priority-list">
        {priorities.length > 0 ? (
          priorities.map((priority) => (
            <article className="priority-row" key={priority.priority_id}>
              <div className="score-ring" aria-label={`Priority score ${priority.score}`}>
                {priority.score}
              </div>
              <div>
                <strong>{priority.title}</strong>
                <p>{priority.detail}</p>
                <span>{priority.reason}</span>
              </div>
            </article>
          ))
        ) : (
          <article className="brief-row">
            <div className="row-icon" aria-hidden="true">
              <Target size={17} />
            </div>
            <div>
              <strong>No priority stack</strong>
              <p>Regenerate the workday brief when provider data is ready.</p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function SuggestionSection({ today }: { today: TodayResponse }) {
  return (
    <section className="suggestion-band" aria-labelledby="suggestion-heading">
      <div className="row-icon" aria-hidden="true">
        <Lightbulb size={17} />
      </div>
      <div>
        <strong id="suggestion-heading">Next move</strong>
        <p>{today.proactive_suggestion}</p>
      </div>
    </section>
  );
}

function BriefSection({ today }: { today: TodayResponse }) {
  return (
    <section aria-labelledby="brief-heading">
      <div className="section-header">
        <h2 id="brief-heading" className="section-title">
          Workday
        </h2>
        <span className="section-meta">{today.space_id}</span>
      </div>
      <div className="brief-list">
        {today.brief.map((item) => (
          <article className="brief-row" key={`${item.source_ref}-${item.title}`}>
            <div className="row-icon" aria-hidden="true">
              {item.status === "watch" ? <Clock3 size={17} /> : <CheckCircle2 size={17} />}
            </div>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ApprovalSection({ today }: { today: TodayResponse }) {
  return (
    <section aria-labelledby="approval-heading">
      <div className="section-header">
        <h2 id="approval-heading" className="section-title">
          Waiting
        </h2>
        <span className="section-meta">{today.approvals.length}</span>
      </div>
      <div className="brief-list">
        {today.approvals.length > 0 ? (
          today.approvals.map((approval) => (
            <ApprovalCard approval={approval} key={approval.action_id} />
          ))
        ) : (
          <article className="brief-row">
            <div className="row-icon" aria-hidden="true">
              <CheckCircle2 size={17} />
            </div>
            <div>
              <strong>No approvals</strong>
              <p>Review queue is clear.</p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function HealthSection({ today }: { today: TodayResponse }) {
  return (
    <section aria-labelledby="health-heading">
      <div className="section-header">
        <h2 id="health-heading" className="section-title">
          Providers
        </h2>
        <span className="section-meta">live</span>
      </div>
      <div className="health-list">
        {today.provider_health.map((provider) => (
          <article className="health-row" key={provider.provider}>
            <div className="row-icon" aria-hidden="true">
              <RadioTower size={17} />
            </div>
            <div>
              <strong>{provider.provider}</strong>
              <p>
                {provider.status} - {provider.detail}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DegradedBand({ today }: { today: TodayResponse }) {
  return (
    <section className="degraded-band" aria-labelledby="degraded-heading">
      <strong id="degraded-heading">
        <ShieldAlert size={16} aria-hidden="true" /> {today.degraded_mode.reason}
      </strong>
      <span>Blocked: {(today.degraded_mode.blocked_actions ?? []).join(", ")}</span>
      <span>Allowed: {(today.degraded_mode.allowed_actions ?? []).join(", ")}</span>
    </section>
  );
}
