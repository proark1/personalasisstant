import {
  AlertCircle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  ListChecks,
  RadioTower,
  Settings,
  Sparkles
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  TodayResponse,
  WorkdayCalendarResponse,
  WorkdayFollowUpsResponse,
  WorkdayInboxResponse
} from "../api/client";

const iconMap = {
  today: Sparkles,
  inbox: Inbox,
  followups: ListChecks,
  calendar: CalendarDays,
  assistant: Bot,
  settings: Settings
} as const;

export function InboxReviewShell({
  today,
  inbox
}: {
  today: TodayResponse;
  inbox: WorkdayInboxResponse;
}) {
  const items = inbox.items ?? [];
  return (
    <WorkdayFrame today={today} activeKey="inbox" title="Inbox Review" meta={`${items.length}`}>
      <PartialBand partial={inbox.partial_state} />
      <section aria-labelledby="inbox-heading">
        <div className="section-header">
          <h2 id="inbox-heading" className="section-title">
            Triage
          </h2>
          <span className="section-meta">{items.length}</span>
        </div>
        <div className="triage-list">
          {items.length > 0 ? (
            items.map((item) => (
              <article className="triage-row" data-category={item.category} key={item.item_id}>
                <div className="score-ring" aria-label={`Priority score ${item.priority_score}`}>
                  {item.priority_score}
                </div>
                <div>
                  <div className="triage-topline">
                    <strong>{item.subject}</strong>
                    <span className="provider-state">{item.category}</span>
                  </div>
                  <p>{item.reason}</p>
                  <div className="source-line">
                    <span>{item.sender}</span>
                    {(item.flags ?? []).map((flag) => (
                      <span key={flag}>{flag.replaceAll("_", " ")}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="No triage items" detail="Provider sync has not produced inbox input yet." />
          )}
        </div>
      </section>
    </WorkdayFrame>
  );
}

export function FollowUpsShell({
  today,
  followUps
}: {
  today: TodayResponse;
  followUps: WorkdayFollowUpsResponse;
}) {
  const risks = followUps.risks ?? [];
  return (
    <WorkdayFrame
      today={today}
      activeKey="followups"
      title="Follow-Ups"
      meta={`${risks.length}`}
    >
      <PartialBand partial={followUps.partial_state} />
      <section aria-labelledby="followups-heading">
        <div className="section-header">
          <h2 id="followups-heading" className="section-title">
            Waiting on you
          </h2>
          <span className="section-meta">{risks.length}</span>
        </div>
        <div className="detail-list">
          {risks.length > 0 ? (
            risks.map((risk) => (
              <article className="insight-card" key={risk.risk_id}>
                <div className="insight-topline">
                  <span className="provider-state" data-state={risk.status}>
                    {risk.status}
                  </span>
                  <Clock3 size={17} aria-hidden="true" />
                </div>
                <h2 className="approval-title">{risk.title}</h2>
                <p className="approval-detail">{risk.detail}</p>
                <div className="approval-facts">
                  <Fact label="Owner" value={risk.owner} />
                  <Fact label="Why" value={risk.reason} />
                  <Fact label="Confidence" value={`${Math.round(risk.confidence * 100)}%`} />
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="No follow-up risks" detail="Nothing is currently waiting on you." />
          )}
        </div>
      </section>
    </WorkdayFrame>
  );
}

export function CalendarPlanShell({
  today,
  calendar
}: {
  today: TodayResponse;
  calendar: WorkdayCalendarResponse;
}) {
  const insights = calendar.insights ?? [];
  return (
    <WorkdayFrame
      today={today}
      activeKey="calendar"
      title="Calendar Plan"
      meta={`${insights.length}`}
    >
      <PartialBand partial={calendar.partial_state} />
      <section aria-labelledby="calendar-heading">
        <div className="section-header">
          <h2 id="calendar-heading" className="section-title">
            Pressure map
          </h2>
          <span className="section-meta">{insights.length}</span>
        </div>
        <div className="detail-list">
          {insights.length > 0 ? (
            insights.map((insight) => (
              <article className="insight-card" key={insight.insight_id}>
                <div className="insight-topline">
                  <span className="provider-state" data-state={insight.severity}>
                    {insight.severity}
                  </span>
                  <RadioTower size={17} aria-hidden="true" />
                </div>
                <h2 className="approval-title">{insight.title}</h2>
                <p className="approval-detail">{insight.detail}</p>
                <div className="focus-window-list">
                  {(insight.focus_windows ?? []).map((window) => (
                    <div className="focus-window" key={window.window_id}>
                      <strong>{window.quality}</strong>
                      <span>
                        {formatTime(window.start_at)} - {formatTime(window.end_at)}
                      </span>
                      <p>{window.reason}</p>
                    </div>
                  ))}
                </div>
                {(insight.move_candidates ?? []).length > 0 ? (
                  <div className="source-line">
                    {(insight.move_candidates ?? []).map((candidate) => (
                      <span key={candidate}>{candidate}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState title="No calendar insights" detail="Calendar sync has not produced planning input yet." />
          )}
        </div>
      </section>
    </WorkdayFrame>
  );
}

function WorkdayFrame({
  today,
  activeKey,
  title,
  meta,
  children
}: {
  today: TodayResponse;
  activeKey: string;
  title: string;
  meta: string;
  children: ReactNode;
}) {
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
            <div className="eyebrow">
              {today.local_date} / {meta}
            </div>
            <h1 className="page-title">{title}</h1>
          </div>
          <span className="status-pill" data-degraded={today.degraded_mode.active}>
            <span className="status-dot" aria-hidden="true" />
            {today.degraded_mode.active ? "Degraded" : "Ready"}
          </span>
        </header>
        <div className="workday-detail-grid">{children}</div>
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

function PartialBand({
  partial
}: {
  partial: {
    degraded?: boolean;
    durable?: boolean;
    reasons?: string[];
    missing_sources?: string[];
  };
}) {
  if (!partial.degraded && (partial.missing_sources ?? []).length === 0) {
    return null;
  }
  return (
    <section className="degraded-band" aria-labelledby="partial-heading">
      <strong id="partial-heading">
        <AlertCircle size={16} aria-hidden="true" /> Partial workday
      </strong>
      {(partial.reasons ?? []).map((reason) => (
        <span key={reason}>{reason}</span>
      ))}
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="brief-row">
      <div className="row-icon" aria-hidden="true">
        <CheckCircle2 size={17} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </article>
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
