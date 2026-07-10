"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { approveAction, type ApprovalCardData } from "../api/client";

type ApprovalState = "idle" | "approving" | "approved" | "blocked" | "error";

export function ApprovalCard({ approval }: { approval: ApprovalCardData }) {
  const [state, setState] = useState<ApprovalState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  async function approve() {
    setState("approving");
    setMessage(null);
    const result = await approveAction(approval.action_id, approval.content_hash || undefined);
    if (result.ok) {
      setState("approved");
      return;
    }
    if (result.status === 409) {
      setState("blocked");
      setMessage(result.reason ?? "This approval needs web or fresh-auth confirmation.");
      return;
    }
    setState("error");
    setMessage("Approval could not be recorded. Please retry.");
  }

  return (
    <article className="approval-card" data-risk={approval.risk_tier}>
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
        <Fact label="Account" value={approval.sending_account || "None"} />
        <Fact label="Recipients" value={approval.recipient_refs.join(", ") || "None"} />
        <Fact label="Source" value={approval.source_ref || "None"} />
        <Fact label="Changed" value={approval.changed_fields.join(", ") || "None"} />
        <Fact label="Sensitive" value={approval.sensitive_flags.join(", ") || "None"} />
        <Fact label="Reversible" value={approval.reversible ? "Yes" : "No"} />
      </div>
      <div className="approval-actions">
        {state === "approved" ? (
          <span className="telegram-result" role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            Approved
          </span>
        ) : (
          <div className="button-row">
            <button
              className="text-button"
              data-variant="primary"
              type="button"
              onClick={approve}
              disabled={state === "approving"}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              {state === "approving" ? "Approving…" : "Approve"}
            </button>
            <button
              className="text-button"
              data-variant="quiet"
              type="button"
              onClick={() => setDismissed(true)}
              disabled={state === "approving"}
            >
              Later
            </button>
          </div>
        )}
      </div>
      {message ? (
        <div className="provider-message" role="status">
          {message}
        </div>
      ) : null}
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
