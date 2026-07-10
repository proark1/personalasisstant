from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from assistant_runtime.domain.brief import compose_brief_message, compose_followups_message
from assistant_runtime.schemas import WorkdaySnapshot

_MAX_ITEMS = 3


@dataclass
class AssistantAnswer:
    intent: str
    answer: str
    sources: list[str] = field(default_factory=list)


def answer_question(question: str, snapshot: WorkdaySnapshot) -> AssistantAnswer:
    """Deterministically answer a workday question from the snapshot.

    Intent is matched by keyword — no LLM — so answers are predictable and never
    fabricate. Everything comes from the already-normalized snapshot fields.
    """
    q = question.lower().strip()

    if _matches(q, ("waiting on", "waiting for", "follow up", "follow-up", "followup", "waiting")):
        return AssistantAnswer(
            "follow_up",
            compose_followups_message(snapshot),
            _collect_sources(risk.source_refs for risk in snapshot.follow_ups),
        )

    if _matches(
        q,
        (
            "time for",
            "have time",
            "free time",
            "availability",
            "available",
            "focus time",
            "focus window",
        ),
    ):
        return AssistantAnswer(
            "calendar_focus", _compose_availability(snapshot), _calendar_sources(snapshot)
        )

    if _matches(
        q, ("priorit", "what should i", "focus on", "most important", "top task", "next task")
    ):
        return AssistantAnswer(
            "priority",
            _compose_priorities(snapshot),
            [
                p.source_ref
                for p in snapshot.priorities[:_MAX_ITEMS]
                if getattr(p, "source_ref", "")
            ],
        )

    if _matches(
        q,
        ("my day", "day look", "overview", "brief", "summary", "what's on", "whats on", "schedule"),
    ):
        return AssistantAnswer("workday", compose_brief_message(snapshot), [])

    # Fallback: a day overview plus a nudge about what can be asked.
    overview = compose_brief_message(snapshot)
    return AssistantAnswer(
        "workday",
        overview + "\n\nYou can ask: what am I waiting on, or do I have time for a task.",
        [],
    )


def _matches(question: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in question for keyword in keywords)


def _compose_availability(snapshot: WorkdaySnapshot) -> str:
    windows = [window for insight in snapshot.calendar for window in insight.focus_windows]
    if not windows:
        return "I don't see a protected focus window today. Open the calendar plan for options."
    lines = ["Here's where you have focus time today:"]
    for window in windows[:_MAX_ITEMS]:
        lines.append(
            f"- {_fmt_time(window.start_at)}–{_fmt_time(window.end_at)} ({window.quality})"
        )
    return "\n".join(lines)


def _compose_priorities(snapshot: WorkdaySnapshot) -> str:
    if not snapshot.priorities:
        return "No priorities are stacked yet — regenerate the workday when provider data is ready."
    lines = ["Your top priorities:"]
    for index, priority in enumerate(snapshot.priorities[:_MAX_ITEMS], start=1):
        lines.append(f"{index}. {priority.title}")
    return "\n".join(lines)


def _calendar_sources(snapshot: WorkdaySnapshot) -> list[str]:
    return _collect_sources(insight.source_refs for insight in snapshot.calendar)


def _collect_sources(source_ref_lists) -> list[str]:
    seen: list[str] = []
    for refs in source_ref_lists:
        for ref in refs:
            if ref and ref not in seen:
                seen.append(ref)
    return seen[:_MAX_ITEMS]


def _fmt_time(value: datetime) -> str:
    return value.strftime("%H:%M")
