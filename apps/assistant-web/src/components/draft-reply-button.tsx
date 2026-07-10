"use client";

import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import { proposeDraft } from "../api/client";

type State = "idle" | "working" | "done" | "error";

export function DraftReplyButton({
  sourceRef,
  recipientRef,
  subject
}: {
  sourceRef: string;
  recipientRef: string;
  subject: string;
}) {
  const [state, setState] = useState<State>("idle");

  async function propose() {
    setState("working");
    const ok = await proposeDraft(sourceRef, recipientRef, subject);
    setState(ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <span className="draft-done" role="status">
        <CheckCircle2 size={14} aria-hidden="true" />
        Draft queued for approval on Today
      </span>
    );
  }

  return (
    <button
      className="text-button"
      data-variant="quiet"
      type="button"
      onClick={propose}
      disabled={state === "working"}
    >
      {state === "working" ? (
        <Loader2 className="spin" size={14} aria-hidden="true" />
      ) : (
        <FileText size={14} aria-hidden="true" />
      )}
      {state === "error" ? "Retry draft" : "Draft reply"}
    </button>
  );
}
