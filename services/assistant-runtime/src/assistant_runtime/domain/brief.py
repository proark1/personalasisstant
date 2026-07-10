from __future__ import annotations

from assistant_runtime.schemas import WorkdaySnapshot

_MAX_PRIORITIES = 3


def compose_brief_message(snapshot: WorkdaySnapshot) -> str:
    """A concise, safe morning-brief message for Telegram delivery.

    Uses only the normalized/deterministic snapshot fields (titles, counts, the
    proactive suggestion) — never raw inbox content — so nothing untrusted or
    sensitive is pushed to a chat.
    """
    lines: list[str] = [f"Morning brief — {snapshot.local_date}"]
    if snapshot.proactive_suggestion:
        lines.append("")
        lines.append(snapshot.proactive_suggestion)

    if snapshot.priorities:
        lines.append("")
        lines.append("Top priorities:")
        for index, priority in enumerate(snapshot.priorities[:_MAX_PRIORITIES], start=1):
            lines.append(f"{index}. {priority.title}")

    lines.append("")
    lines.append(
        f"Waiting on you: {len(snapshot.follow_ups)}"
        f" · Inbox to triage: {len(snapshot.inbox)}"
        f" · Approvals: {len(snapshot.approvals)}"
    )

    if snapshot.partial_state.degraded:
        lines.append("")
        lines.append("Some sources are degraded — open the app for the full picture.")

    return "\n".join(lines)


def compose_followups_message(snapshot: WorkdaySnapshot) -> str:
    """A concise 'what's waiting on you' reply for a Telegram /followups command."""
    if not snapshot.follow_ups:
        return f"Follow-ups — {snapshot.local_date}\n\nNothing is waiting on you right now."
    lines = [
        f"Follow-ups — {snapshot.local_date}",
        "",
        f"Waiting on you: {len(snapshot.follow_ups)}",
    ]
    for risk in snapshot.follow_ups[:5]:
        lines.append(f"- {risk.title} ({risk.status})")
    return "\n".join(lines)


def compose_help_message() -> str:
    """Safe canned pointer to available commands — never triggers an action."""
    return (
        "I can help with your workday:\n"
        "/brief — your morning brief\n"
        "/today — today's priorities\n"
        "/followups — what's waiting on you\n"
        "/status — connection status\n"
        "/pause and /resume — notifications"
    )
