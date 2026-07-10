import { Bot, ListChecks, Mic, MessageSquare } from "lucide-react";

import type { TodayResponse } from "../api/client";
import { VoiceConsole } from "./voice-console";
import { WorkdayFrame } from "./workday-detail-shell";

const UPCOMING = [
  {
    icon: MessageSquare,
    title: "Draft replies in your voice",
    detail: "Proposed email replies you approve against an exact snapshot."
  },
  {
    icon: ListChecks,
    title: "Follow-up tracker",
    detail: "Waiting on me, waiting on them, delegated, overdue."
  },
  {
    icon: Mic,
    title: "Meeting prep & notes",
    detail: "Briefed before calls; action items captured after."
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

        <VoiceConsole />

        <article className="insight-card">
          <h2 className="approval-title">More conversation coming</h2>
          <p className="approval-detail">
            Voice and text answer from your real workday today. These deeper capabilities are
            next:
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
