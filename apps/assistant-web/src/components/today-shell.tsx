import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  ListChecks,
  MessageSquareText,
  RadioTower,
  Search,
  Settings,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import type { TodayResponse } from "../api/client";

const iconMap = {
  today: Sparkles,
  inbox: Inbox,
  followups: ListChecks,
  calendar: CalendarDays,
  assistant: Bot,
  settings: Settings
} as const;

export function TodayShell({ today }: { today: TodayResponse }) {
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
            <BriefSection today={today} />
            <HealthSection today={today} />
          </div>

          <div className="stack">
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
            <article className="approval-card" data-risk={approval.risk_tier} key={approval.action_id}>
              <div className="approval-topline">
                <span className="risk-badge" data-risk={approval.risk_tier}>
                  {approval.risk_tier}
                </span>
                <Bell size={17} aria-hidden="true" />
              </div>
              <div>
                <h2 className="approval-title">{approval.summary}</h2>
                <p className="approval-detail">{approval.approval_reason}</p>
              </div>
              <div className="approval-facts">
                <Fact label="Account" value={approval.sending_account} />
                <Fact label="Recipients" value={approval.recipient_refs.join(", ") || "None"} />
                <Fact label="Source" value={approval.source_ref} />
                <Fact label="Changed" value={approval.changed_fields.join(", ") || "None"} />
                <Fact label="Sensitive" value={approval.sensitive_flags.join(", ") || "None"} />
                <Fact label="Reversible" value={approval.reversible ? "Yes" : "No"} />
              </div>
              <div className="approval-actions">
                <div className="button-row">
                  <button className="text-button" data-variant="primary" type="button">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    Approve
                  </button>
                  <button className="text-button" type="button">
                    <MessageSquareText size={16} aria-hidden="true" />
                    Edit on web
                  </button>
                  <button className="text-button" data-variant="quiet" type="button">
                    Later
                  </button>
                </div>
              </div>
            </article>
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
                {provider.status} · {provider.detail}
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
