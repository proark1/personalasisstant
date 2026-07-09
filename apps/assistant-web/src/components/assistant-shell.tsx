import { Bot, ListChecks, Mic, MessageSquare } from "lucide-react";

import type { TodayResponse } from "../api/client";
import { WorkdayFrame } from "./workday-detail-shell";

const UPCOMING = [
  {
    icon: MessageSquare,
    title: "Ask about your day",
    detail: '"What am I waiting on?", "Do I have time for X?" — answered from your real workday.'
  },
  {
    icon: Mic,
    title: "Voice push-to-talk",
    detail: "Hands-free briefings and questions while you drive."
  },
  {
    icon: ListChecks,
    title: "Follow-up tracker",
    detail: "Waiting on me, waiting on them, delegated, overdue."
  }
];

export function AssistantShell({ today }: { today: TodayResponse }) {
  return (
    <WorkdayFrame today={today} activeKey="assistant" title="Assistant" meta="Preview">
      <section className="stack">
        {today.proactive_suggestion ? (
          <article className="suggestion-band">
            <div className="row-icon" aria-hidden="true">
              <Bot size={18} />
            </div>
            <div>
              <strong>Today&rsquo;s nudge</strong>
              <p>{today.proactive_suggestion}</p>
            </div>
          </article>
        ) : null}

        <article className="insight-card">
          <h2 className="approval-title">Conversational assistant — being wired up</h2>
          <p className="approval-detail">
            Chat and voice aren&rsquo;t connected yet. This screen is intentionally honest: no
            fake conversation until it works against your real inbox and calendar.
          </p>
          <div className="detail-list">
            {UPCOMING.map((item) => {
              const Icon = item.icon;
              return (
                <div className="brief-row" key={item.title}>
                  <div className="row-icon" aria-hidden="true">
                    <Icon size={17} />
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </WorkdayFrame>
  );
}
