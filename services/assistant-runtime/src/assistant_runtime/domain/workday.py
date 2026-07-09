from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from hashlib import sha256

from assistant_runtime.domain.providers import InMemoryProviderStore
from assistant_runtime.interfaces import BrainClient
from assistant_runtime.providers.onebrain_events import (
    record_calendar_insight,
    record_follow_up_risk,
    record_inbox_triage_item,
    record_priority_item,
    record_workday_brief,
)
from assistant_runtime.schemas import (
    ApprovalCard,
    CalendarFocusWindow,
    CalendarInsight,
    DegradedModeState,
    FollowUpRisk,
    InboxTriageItem,
    NavigationItem,
    PriorityItem,
    ProviderAccountStatus,
    ProviderHealth,
    ScopedIdentity,
    TodayBriefItem,
    TodayResponse,
    WorkdayBrief,
    WorkdayPartialState,
    WorkdaySnapshot,
    utc_now,
)


@dataclass(frozen=True)
class WorkdaySourceItem:
    source_ref: str
    kind: str
    title: str
    detail: str
    sender: str = ""
    account_ref: str = ""
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    flags: tuple[str, ...] = ()


class WorkdaySourceCollector:
    def __init__(self, providers: InMemoryProviderStore | None = None) -> None:
        self.providers = providers

    def collect(
        self,
        scope: ScopedIdentity,
        local_date: str,
    ) -> tuple[list[WorkdaySourceItem], WorkdayPartialState]:
        accounts = self.providers.list_accounts() if self.providers is not None else []
        active_accounts = [
            account
            for account in accounts
            if ProviderAccountStatus(account.status) != ProviderAccountStatus.disconnected
        ]
        partial = WorkdayPartialState(
            durable=False,
            degraded=False,
            reasons=[],
            missing_sources=[],
            stale_sources=[],
            generated_from="rules",
            onebrain_available=True,
            provider_accounts_seen=len(active_accounts),
        )
        if not active_accounts:
            partial.missing_sources.append("live_email_calendar")
            partial.reasons.append(
                "Using deterministic local workday source items until provider sync has "
                "live records."
            )
        for account in active_accounts:
            if account.last_sync_error:
                partial.stale_sources.append(account.provider_account_ref)

        account_ref = (
            active_accounts[0].provider_account_ref
            if active_accounts
            else "onebrain://provider-account/local-fallback"
        )
        day = _local_day(local_date)
        return [
            WorkdaySourceItem(
                source_ref=f"onebrain://workday-source/{scope.account_id}/{local_date}/client-reply",
                kind="mail",
                title="Client proposal reply",
                detail=(
                    "Client response is waiting. The thread needs a short direct reply "
                    "before the afternoon review window."
                ),
                sender="client@example.com",
                account_ref=account_ref,
                flags=("needs_reply", "client", "priority"),
            ),
            WorkdaySourceItem(
                source_ref=f"onebrain://workday-source/{scope.account_id}/{local_date}/partner-followup",
                kind="mail",
                title="Partner follow-up",
                detail="Partner asked for confirmation yesterday and is waiting on your answer.",
                sender="partner@example.com",
                account_ref=account_ref,
                flags=("waiting_on_you", "follow_up"),
            ),
            WorkdaySourceItem(
                source_ref=f"onebrain://workday-source/{scope.account_id}/{local_date}/newsletter",
                kind="mail",
                title="Industry newsletter",
                detail="Weekly newsletter can be batched or skipped today.",
                sender="newsletter@example.com",
                account_ref=account_ref,
                flags=("newsletter", "low_priority"),
            ),
            WorkdaySourceItem(
                source_ref=f"onebrain://workday-source/{scope.account_id}/{local_date}/board-sync",
                kind="calendar",
                title="Board sync",
                detail="High-context meeting needs a preparation buffer.",
                starts_at=datetime.combine(day, time(14, 0), tzinfo=UTC),
                ends_at=datetime.combine(day, time(15, 0), tzinfo=UTC),
                flags=("meeting", "prep_needed"),
            ),
            WorkdaySourceItem(
                source_ref=f"onebrain://workday-source/{scope.account_id}/{local_date}/admin-block",
                kind="calendar",
                title="Admin block",
                detail="Low-priority admin work can move if focus time is tight.",
                starts_at=datetime.combine(day, time(16, 0), tzinfo=UTC),
                ends_at=datetime.combine(day, time(16, 45), tzinfo=UTC),
                flags=("move_candidate", "low_priority"),
            ),
        ], partial


class InboxTriageEngine:
    def classify(self, items: list[WorkdaySourceItem]) -> list[InboxTriageItem]:
        triage: list[InboxTriageItem] = []
        for item in items:
            if item.kind != "mail":
                continue
            flags = list(item.flags)
            category = "review"
            score = 55
            reason = "Message is relevant to today's work."
            if "priority" in flags or "client" in flags:
                category = "priority"
                score = 92
                reason = "Client-related thread with same-day attention value."
            elif "waiting_on_you" in flags:
                category = "needs_reply"
                score = 82
                reason = "Thread is waiting on your response."
            elif "newsletter" in flags:
                category = "noise"
                score = 18
                reason = "Newsletter can be batched outside focus time."
            triage.append(
                InboxTriageItem(
                    item_id=_stable_id("inbox", item.source_ref),
                    subject=item.title,
                    sender=item.sender,
                    category=category,
                    reason=reason,
                    source_ref=item.source_ref,
                    account_ref=item.account_ref,
                    priority_score=score,
                    confidence=0.82 if category != "noise" else 0.74,
                    flags=flags,
                )
            )
        return triage


class FollowUpExtractor:
    def extract(self, items: list[WorkdaySourceItem]) -> list[FollowUpRisk]:
        risks: list[FollowUpRisk] = []
        for item in items:
            if "follow_up" not in item.flags and "waiting_on_you" not in item.flags:
                continue
            risks.append(
                FollowUpRisk(
                    risk_id=_stable_id("followup", item.source_ref),
                    title=item.title,
                    detail=item.detail,
                    owner=item.sender or "You",
                    status="due",
                    reason="The source indicates someone is waiting on a response.",
                    source_refs=[item.source_ref],
                    due_at=utc_now() + timedelta(hours=4),
                    confidence=0.78,
                )
            )
        return risks


class CalendarInsightPlanner:
    def plan(self, items: list[WorkdaySourceItem], local_date: str) -> list[CalendarInsight]:
        calendar_items = [item for item in items if item.kind == "calendar"]
        day = _local_day(local_date)
        focus_window = CalendarFocusWindow(
            window_id=_stable_id("focus", f"{local_date}:09"),
            start_at=datetime.combine(day, time(9, 0), tzinfo=UTC),
            end_at=datetime.combine(day, time(10, 30), tzinfo=UTC),
            quality="high",
            reason="Protected morning block before meeting pressure rises.",
        )
        move_candidates = [
            item.title for item in calendar_items if "move_candidate" in item.flags
        ]
        source_refs = [item.source_ref for item in calendar_items]
        return [
            CalendarInsight(
                insight_id=_stable_id("calendar", f"{local_date}:pressure"),
                title="Calendar pressure",
                detail=(
                    "The afternoon carries meeting pressure. Keep the morning focus block "
                    "and move low-priority admin work if needed."
                ),
                severity="watch",
                source_refs=source_refs,
                confidence=0.8,
                focus_windows=[focus_window],
                move_candidates=move_candidates,
            )
        ]


class PriorityEngine:
    def prioritize(
        self,
        inbox: list[InboxTriageItem],
        follow_ups: list[FollowUpRisk],
        calendar: list[CalendarInsight],
    ) -> list[PriorityItem]:
        priorities: list[PriorityItem] = []
        priority_message = next((item for item in inbox if item.category == "priority"), None)
        if priority_message is not None:
            priorities.append(
                PriorityItem(
                    priority_id=_stable_id("priority", priority_message.source_ref),
                    title=priority_message.subject,
                    detail="Reply while the context is fresh.",
                    score=94,
                    reason=priority_message.reason,
                    source_refs=[priority_message.source_ref],
                    confidence=priority_message.confidence,
                )
            )
        if follow_ups:
            risk = follow_ups[0]
            priorities.append(
                PriorityItem(
                    priority_id=_stable_id("priority", risk.source_refs[0]),
                    title=risk.title,
                    detail="Close the loop before it becomes stale.",
                    score=86,
                    reason=risk.reason,
                    status=risk.status,
                    source_refs=risk.source_refs,
                    confidence=risk.confidence,
                )
            )
        if calendar:
            insight = calendar[0]
            priorities.append(
                PriorityItem(
                    priority_id=_stable_id("priority", insight.insight_id),
                    title=insight.title,
                    detail="Protect focus time and prep before the high-context meeting.",
                    score=78,
                    reason=insight.detail,
                    status=insight.severity,
                    source_refs=insight.source_refs,
                    confidence=insight.confidence,
                )
            )
        return priorities[:3]


class WorkdayLoopProcessor:
    def __init__(
        self,
        *,
        brain: BrainClient | None,
        providers: InMemoryProviderStore | None = None,
    ) -> None:
        self.brain = brain
        self.collector = WorkdaySourceCollector(providers)
        self.inbox = InboxTriageEngine()
        self.followups = FollowUpExtractor()
        self.calendar = CalendarInsightPlanner()
        self.priorities = PriorityEngine()

    async def generate_snapshot(
        self,
        *,
        scope: ScopedIdentity,
        local_date: str | None = None,
        provider_health: list[ProviderHealth] | None = None,
        approvals: list[ApprovalCard] | None = None,
        require_durable: bool = False,
    ) -> WorkdaySnapshot:
        local_date = local_date or utc_now().date().isoformat()
        source_items, partial = self.collector.collect(scope, local_date)
        partial.onebrain_available = await self._onebrain_available()
        if not partial.onebrain_available:
            partial.degraded = True
            partial.reasons.insert(0, "OneBrain unavailable; workday output is ephemeral.")

        inbox = self.inbox.classify(source_items)
        follow_ups = self.followups.extract(source_items)
        calendar = self.calendar.plan(source_items, local_date)
        priorities = self.priorities.prioritize(inbox, follow_ups, calendar)
        brief = _build_brief(scope, local_date, priorities, follow_ups, calendar, partial)
        snapshot = WorkdaySnapshot(
            account_id=scope.account_id,
            user_id=scope.user_id,
            space_id=scope.space_id,
            local_date=local_date,
            brief=brief,
            priorities=priorities,
            inbox=inbox,
            follow_ups=follow_ups,
            calendar=calendar,
            provider_health=provider_health or [],
            approvals=approvals or [],
            navigation=_navigation(inbox, follow_ups),
            partial_state=partial,
            proactive_suggestion=_proactive_suggestion(priorities, calendar),
        )
        if partial.onebrain_available and self.brain is not None:
            try:
                await self._record_snapshot(scope, snapshot)
                snapshot.partial_state.durable = True
                snapshot.brief.partial_state.durable = True
            except Exception as exc:
                if require_durable:
                    raise RuntimeError("OneBrainWorkdayWriteFailed") from exc
                snapshot.partial_state.degraded = True
                snapshot.partial_state.reasons.insert(
                    0,
                    "OneBrain write failed; workday output is ephemeral.",
                )
        elif require_durable:
            raise RuntimeError("OneBrainUnavailable")
        return snapshot

    async def _record_snapshot(self, scope: ScopedIdentity, snapshot: WorkdaySnapshot) -> None:
        if self.brain is None:
            raise RuntimeError("OneBrainUnavailable")
        await record_workday_brief(self.brain, scope, snapshot.brief)
        for priority in snapshot.priorities:
            await record_priority_item(self.brain, scope, snapshot.local_date, priority)
        for item in snapshot.inbox:
            await record_inbox_triage_item(self.brain, scope, snapshot.local_date, item)
        for risk in snapshot.follow_ups:
            await record_follow_up_risk(self.brain, scope, snapshot.local_date, risk)
        for insight in snapshot.calendar:
            await record_calendar_insight(self.brain, scope, snapshot.local_date, insight)

    async def _onebrain_available(self) -> bool:
        if self.brain is None:
            return False
        try:
            return await self.brain.check_available()
        except Exception:
            return False


def workday_snapshot_to_today_response(snapshot: WorkdaySnapshot) -> TodayResponse:
    degraded = snapshot.partial_state.degraded
    return TodayResponse(
        account_id=snapshot.account_id,
        user_id=snapshot.user_id,
        space_id=snapshot.space_id,
        local_date=snapshot.local_date,
        navigation=snapshot.navigation,
        brief=snapshot.brief.items,
        approvals=snapshot.approvals,
        provider_health=snapshot.provider_health,
        degraded_mode=DegradedModeState(
            active=degraded,
            reason="; ".join(snapshot.partial_state.reasons) if degraded else None,
            blocked_actions=[
                "external sends",
                "email forwards",
                "deletes",
                "external calendar writes",
                "sensitive exports",
            ]
            if degraded
            else [],
            allowed_actions=[
                "cached read-only UI",
                "safe reconciliation jobs",
                "operational retries",
                "provider health checks",
            ],
        ),
        priorities=snapshot.priorities,
        follow_ups=snapshot.follow_ups,
        calendar=snapshot.calendar,
        inbox_count=len(snapshot.inbox),
        proactive_suggestion=snapshot.proactive_suggestion,
        partial_state=snapshot.partial_state,
    )


def _build_brief(
    scope: ScopedIdentity,
    local_date: str,
    priorities: list[PriorityItem],
    follow_ups: list[FollowUpRisk],
    calendar: list[CalendarInsight],
    partial: WorkdayPartialState,
) -> WorkdayBrief:
    items = [
        TodayBriefItem(
            title="Morning brief",
            detail=(
                f"{len(priorities)} priorities, {len(follow_ups)} follow-up risk, "
                f"{len(calendar)} calendar insight."
            ),
            source_ref=f"onebrain://workday/{scope.account_id}/{local_date}/brief",
        )
    ]
    items.extend(
        TodayBriefItem(
            title=priority.title,
            detail=priority.reason,
            source_ref=priority.source_refs[0] if priority.source_refs else priority.priority_id,
            status=priority.status,
        )
        for priority in priorities[:2]
    )
    if calendar:
        insight = calendar[0]
        items.append(
            TodayBriefItem(
                title=insight.title,
                detail=insight.detail,
                source_ref=insight.insight_id,
                status=insight.severity,
            )
        )
    return WorkdayBrief(
        brief_id=_stable_id("brief", f"{scope.account_id}:{scope.space_id}:{local_date}"),
        title="Morning brief",
        summary="; ".join(item.detail for item in items[:3]),
        items=items,
        local_date=local_date,
        source_refs=[source for priority in priorities for source in priority.source_refs],
        confidence=0.78 if not partial.missing_sources else 0.64,
        partial_state=partial,
    )


def _navigation(
    inbox: list[InboxTriageItem],
    follow_ups: list[FollowUpRisk],
) -> list[NavigationItem]:
    return [
        NavigationItem(key="today", label="Today", href="/"),
        NavigationItem(key="inbox", label="Inbox Review", href="/inbox", count=len(inbox)),
        NavigationItem(
            key="followups",
            label="Follow-Ups",
            href="/follow-ups",
            count=len(follow_ups),
        ),
        NavigationItem(key="calendar", label="Calendar Plan", href="/calendar"),
        NavigationItem(key="assistant", label="Assistant", href="/assistant"),
        NavigationItem(key="settings", label="Settings", href="/settings"),
    ]


def _proactive_suggestion(
    priorities: list[PriorityItem],
    calendar: list[CalendarInsight],
) -> str:
    if priorities:
        return f"Start with {priorities[0].title}; it has the clearest same-day leverage."
    if calendar:
        return "Protect the best focus window before taking lower-priority meetings."
    return "Review the inbox triage and mark anything that should be ignored tomorrow."


def _stable_id(prefix: str, value: str) -> str:
    digest = sha256(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def _local_day(local_date: str) -> date:
    try:
        return date.fromisoformat(local_date)
    except ValueError:
        return utc_now().date()
