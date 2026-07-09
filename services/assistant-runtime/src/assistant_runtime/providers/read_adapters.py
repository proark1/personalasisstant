from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from assistant_runtime.schemas import ProviderAccountRecord, ProviderKind, utc_now

GOOGLE_GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
GOOGLE_GMAIL_HISTORY_URL = "https://gmail.googleapis.com/gmail/v1/users/me/history"
GOOGLE_CALENDAR_EVENTS_URL = (
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
)
MICROSOFT_MESSAGES_URL = "https://graph.microsoft.com/v1.0/me/messages"
MICROSOFT_MESSAGES_DELTA_URL = (
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta"
)
MICROSOFT_CALENDAR_VIEW_URL = "https://graph.microsoft.com/v1.0/me/calendarView"
MICROSOFT_CALENDAR_VIEW_DELTA_URL = (
    "https://graph.microsoft.com/v1.0/me/calendarView/delta"
)


class ProviderReadError(RuntimeError):
    def __init__(self, detail: str, *, status_code: int | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass(frozen=True)
class FetchedProviderMessage:
    local_date: str
    source_ref: str
    subject: str
    snippet: str
    sender: str = ""
    recipients: list[str] = field(default_factory=list)
    received_at: datetime | None = None
    flags: list[str] = field(default_factory=list)
    unread: bool = False
    importance: str = "normal"
    attachment_count: int = 0
    category_hints: list[str] = field(default_factory=list)

    def to_record_kwargs(self) -> dict[str, Any]:
        return {
            "local_date": self.local_date,
            "source_ref": self.source_ref,
            "subject": self.subject,
            "snippet": self.snippet,
            "sender": self.sender,
            "recipients": list(self.recipients),
            "received_at": self.received_at,
            "flags": list(self.flags),
            "unread": self.unread,
            "importance": self.importance,
            "attachment_count": self.attachment_count,
            "category_hints": list(self.category_hints),
        }


@dataclass(frozen=True)
class FetchedProviderCalendarEvent:
    local_date: str
    source_ref: str
    title: str
    detail: str
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    organizer: str = ""
    attendee_count: int = 0
    has_location: bool = False
    has_meeting_link: bool = False
    busy_status: str = "busy"
    flags: list[str] = field(default_factory=list)

    def to_record_kwargs(self) -> dict[str, Any]:
        return {
            "local_date": self.local_date,
            "source_ref": self.source_ref,
            "title": self.title,
            "detail": self.detail,
            "starts_at": self.starts_at,
            "ends_at": self.ends_at,
            "organizer": self.organizer,
            "attendee_count": self.attendee_count,
            "has_location": self.has_location,
            "has_meeting_link": self.has_meeting_link,
            "busy_status": self.busy_status,
            "flags": list(self.flags),
        }


@dataclass(frozen=True)
class ProviderCursorContext:
    cursor_values: dict[str, str] = field(default_factory=dict)

    def get(self, cursor_kind: str) -> str | None:
        value = self.cursor_values.get(cursor_kind)
        return value if value else None


@dataclass(frozen=True)
class ProviderFetchResult:
    messages: list[FetchedProviderMessage] = field(default_factory=list)
    calendar_events: list[FetchedProviderCalendarEvent] = field(default_factory=list)
    live: bool = True
    fallback_reason: str | None = None
    cursor_updates: dict[str, str] = field(default_factory=dict)
    used_incremental: bool = False


class ProviderReadClient:
    def __init__(
        self,
        *,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    async def fetch_sources(
        self,
        account: ProviderAccountRecord,
        token_payload: dict[str, Any],
        *,
        local_date: str,
        cursors: ProviderCursorContext | dict[str, str] | None = None,
    ) -> ProviderFetchResult:
        access_token = str(token_payload.get("access_token") or "")
        if not access_token:
            raise ProviderReadError("Provider access token is missing.")
        if _is_local_token_payload(token_payload):
            return local_provider_fetch_result(
                account,
                local_date,
                reason="local_test_token",
            )
        provider = ProviderKind(account.provider)
        cursor_context = _normalize_cursor_context(cursors)
        if provider == ProviderKind.google:
            return await self._fetch_google(
                account,
                access_token,
                local_date,
                cursor_context=cursor_context,
            )
        return await self._fetch_microsoft(
            account,
            access_token,
            local_date,
            cursor_context=cursor_context,
            use_delta=cursors is not None,
        )

    async def _fetch_google(
        self,
        account: ProviderAccountRecord,
        access_token: str,
        local_date: str,
        *,
        cursor_context: ProviderCursorContext,
    ) -> ProviderFetchResult:
        headers = _auth_headers(access_token)
        cursor_updates: dict[str, str] = {}
        fallback_reason: str | None = None
        used_incremental = False
        async with httpx.AsyncClient(
            timeout=self.timeout_seconds,
            transport=self.transport,
        ) as client:
            messages: list[FetchedProviderMessage] = []
            if account.mail_enabled:
                gmail_cursor = cursor_context.get("gmail_history")
                if gmail_cursor:
                    try:
                        messages, next_cursor = await _fetch_google_history_messages(
                            client,
                            account,
                            local_date,
                            headers,
                            gmail_cursor,
                        )
                        used_incremental = True
                    except ProviderReadError as exc:
                        if exc.status_code != 404:
                            raise
                        messages, next_cursor = await _fetch_google_messages(
                            client,
                            account,
                            local_date,
                            headers,
                        )
                        fallback_reason = "Gmail history cursor expired; full read fallback used."
                else:
                    messages, next_cursor = await _fetch_google_messages(
                        client,
                        account,
                        local_date,
                        headers,
                    )
                if next_cursor:
                    cursor_updates["gmail_history"] = next_cursor
            events: list[FetchedProviderCalendarEvent] = []
            if account.calendar_enabled:
                events = await _fetch_google_calendar_events(
                    client,
                    account,
                    local_date,
                    headers,
                )
                cursor_updates["google_calendar_sync_token"] = _window_cursor(
                    "google_calendar",
                    local_date,
                )
        return ProviderFetchResult(
            messages=messages,
            calendar_events=events,
            fallback_reason=fallback_reason,
            cursor_updates=cursor_updates,
            used_incremental=used_incremental,
        )

    async def _fetch_microsoft(
        self,
        account: ProviderAccountRecord,
        access_token: str,
        local_date: str,
        *,
        cursor_context: ProviderCursorContext,
        use_delta: bool,
    ) -> ProviderFetchResult:
        headers = {
            **_auth_headers(access_token),
            "Prefer": 'outlook.body-content-type="text"',
        }
        cursor_updates: dict[str, str] = {}
        fallback_reasons: list[str] = []
        used_incremental = False
        async with httpx.AsyncClient(
            timeout=self.timeout_seconds,
            transport=self.transport,
        ) as client:
            messages: list[FetchedProviderMessage] = []
            if account.mail_enabled:
                if use_delta:
                    try:
                        messages, next_cursor = await _fetch_microsoft_messages_delta(
                            client,
                            account,
                            local_date,
                            headers,
                            cursor_context.get("microsoft_mail_delta_link"),
                        )
                        used_incremental = True
                        if next_cursor:
                            cursor_updates["microsoft_mail_delta_link"] = next_cursor
                    except ProviderReadError:
                        fallback_reasons.append(
                            "Microsoft mail delta failed; full read fallback used."
                        )
                        messages = await _fetch_microsoft_messages(
                            client,
                            account,
                            local_date,
                            headers,
                        )
                else:
                    messages = await _fetch_microsoft_messages(
                        client,
                        account,
                        local_date,
                        headers,
                    )
            events: list[FetchedProviderCalendarEvent] = []
            if account.calendar_enabled:
                if use_delta:
                    try:
                        events, next_cursor = await _fetch_microsoft_calendar_events_delta(
                            client,
                            account,
                            local_date,
                            headers,
                            cursor_context.get("microsoft_calendar_delta_link"),
                        )
                        used_incremental = True
                        if next_cursor:
                            cursor_updates["microsoft_calendar_delta_link"] = next_cursor
                    except ProviderReadError:
                        fallback_reasons.append(
                            "Microsoft calendar delta failed; full read fallback used."
                        )
                        events = await _fetch_microsoft_calendar_events(
                            client,
                            account,
                            local_date,
                            headers,
                        )
                else:
                    events = await _fetch_microsoft_calendar_events(
                        client,
                        account,
                        local_date,
                        headers,
                    )
        return ProviderFetchResult(
            messages=messages,
            calendar_events=events,
            fallback_reason=" ".join(fallback_reasons) or None,
            cursor_updates=cursor_updates,
            used_incremental=used_incremental,
        )


async def _fetch_google_messages(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
) -> tuple[list[FetchedProviderMessage], str | None]:
    try:
        list_response = await client.get(
            GOOGLE_GMAIL_MESSAGES_URL,
            headers=headers,
            params={
                "maxResults": "10",
                "q": "newer_than:7d -in:spam -in:trash",
                "includeSpamTrash": "false",
            },
        )
        list_response.raise_for_status()
        message_refs = list_response.json().get("messages") or []
        payloads: list[dict[str, Any]] = []
        for message_ref in message_refs[:10]:
            message_id = str(message_ref.get("id") or "")
            if not message_id:
                continue
            payloads.append(await _fetch_google_message_metadata(client, message_id, headers))
        return (
            [_google_message_to_source(account, local_date, payload) for payload in payloads],
            _latest_google_history_id(payloads),
        )
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Google Gmail read failed with HTTP {exc.response.status_code}.",
            status_code=exc.response.status_code,
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(f"Google Gmail read failed: {exc.__class__.__name__}.") from exc


async def _fetch_google_history_messages(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
    start_history_id: str,
) -> tuple[list[FetchedProviderMessage], str | None]:
    try:
        response = await client.get(
            GOOGLE_GMAIL_HISTORY_URL,
            headers=headers,
            params={
                "startHistoryId": start_history_id,
                "historyTypes": "messageAdded",
                "maxResults": "10",
            },
        )
        response.raise_for_status()
        payload = response.json()
        message_ids = _google_history_message_ids(payload)
        message_payloads = [
            await _fetch_google_message_metadata(client, message_id, headers)
            for message_id in message_ids[:10]
        ]
        return (
            [
                _google_message_to_source(account, local_date, message_payload)
                for message_payload in message_payloads
            ],
            str(payload.get("historyId") or "") or _latest_google_history_id(message_payloads),
        )
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Google Gmail history read failed with HTTP {exc.response.status_code}.",
            status_code=exc.response.status_code,
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(
            f"Google Gmail history read failed: {exc.__class__.__name__}."
        ) from exc


async def _fetch_google_message_metadata(
    client: httpx.AsyncClient,
    message_id: str,
    headers: dict[str, str],
) -> dict[str, Any]:
    metadata_response = await client.get(
        f"{GOOGLE_GMAIL_MESSAGES_URL}/{message_id}",
        headers=headers,
        params=[
            ("format", "metadata"),
            ("metadataHeaders", "Subject"),
            ("metadataHeaders", "From"),
            ("metadataHeaders", "To"),
            ("metadataHeaders", "Date"),
            ("metadataHeaders", "Message-ID"),
            ("metadataHeaders", "List-Unsubscribe"),
        ],
    )
    metadata_response.raise_for_status()
    payload = metadata_response.json()
    return payload if isinstance(payload, dict) else {}


async def _fetch_google_calendar_events(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
) -> list[FetchedProviderCalendarEvent]:
    start, end = _day_window(local_date)
    try:
        response = await client.get(
            GOOGLE_CALENDAR_EVENTS_URL,
            headers=headers,
            params={
                "timeMin": _rfc3339(start),
                "timeMax": _rfc3339(end),
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": "10",
            },
        )
        response.raise_for_status()
        return [
            _google_event_to_source(account, local_date, event)
            for event in response.json().get("items") or []
            if str(event.get("status") or "") != "cancelled"
        ]
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Google Calendar read failed with HTTP {exc.response.status_code}."
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(
            f"Google Calendar read failed: {exc.__class__.__name__}."
        ) from exc


async def _fetch_microsoft_messages(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
) -> list[FetchedProviderMessage]:
    try:
        response = await client.get(
            MICROSOFT_MESSAGES_URL,
            headers=headers,
            params={
                "$top": "10",
                "$select": (
                    "id,subject,from,toRecipients,receivedDateTime,isRead,importance,"
                    "bodyPreview,hasAttachments,categories"
                ),
                "$orderby": "receivedDateTime desc",
            },
        )
        response.raise_for_status()
        return [
            _microsoft_message_to_source(account, local_date, message)
            for message in response.json().get("value") or []
        ]
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Microsoft mail read failed with HTTP {exc.response.status_code}."
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(f"Microsoft mail read failed: {exc.__class__.__name__}.") from exc


async def _fetch_microsoft_messages_delta(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
    delta_link: str | None,
) -> tuple[list[FetchedProviderMessage], str | None]:
    try:
        if delta_link:
            response = await client.get(delta_link, headers=headers)
        else:
            response = await client.get(
                MICROSOFT_MESSAGES_DELTA_URL,
                headers=headers,
                params={
                    "$top": "10",
                    "$select": (
                        "id,subject,from,toRecipients,receivedDateTime,isRead,importance,"
                        "bodyPreview,hasAttachments,categories"
                    ),
                },
            )
        response.raise_for_status()
        payload = response.json()
        return (
            [
                _microsoft_message_to_source(account, local_date, message)
                for message in payload.get("value") or []
                if not _is_graph_removed_item(message)
            ],
            _graph_delta_cursor(payload),
        )
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Microsoft mail delta failed with HTTP {exc.response.status_code}.",
            status_code=exc.response.status_code,
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(
            f"Microsoft mail delta failed: {exc.__class__.__name__}."
        ) from exc


async def _fetch_microsoft_calendar_events(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
) -> list[FetchedProviderCalendarEvent]:
    start, end = _day_window(local_date)
    try:
        response = await client.get(
            MICROSOFT_CALENDAR_VIEW_URL,
            headers=headers,
            params={
                "startDateTime": start.isoformat(),
                "endDateTime": end.isoformat(),
                "$top": "10",
            },
        )
        response.raise_for_status()
        return [
            _microsoft_event_to_source(account, local_date, event)
            for event in response.json().get("value") or []
            if not bool(event.get("isCancelled"))
        ]
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Microsoft calendar read failed with HTTP {exc.response.status_code}."
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(
            f"Microsoft calendar read failed: {exc.__class__.__name__}."
        ) from exc


async def _fetch_microsoft_calendar_events_delta(
    client: httpx.AsyncClient,
    account: ProviderAccountRecord,
    local_date: str,
    headers: dict[str, str],
    delta_link: str | None,
) -> tuple[list[FetchedProviderCalendarEvent], str | None]:
    start, end = _day_window(local_date)
    try:
        if delta_link:
            response = await client.get(delta_link, headers=headers)
        else:
            response = await client.get(
                MICROSOFT_CALENDAR_VIEW_DELTA_URL,
                headers=headers,
                params={
                    "startDateTime": start.isoformat(),
                    "endDateTime": end.isoformat(),
                    "$top": "10",
                },
            )
        response.raise_for_status()
        payload = response.json()
        return (
            [
                _microsoft_event_to_source(account, local_date, event)
                for event in payload.get("value") or []
                if not _is_graph_removed_item(event) and not bool(event.get("isCancelled"))
            ],
            _graph_delta_cursor(payload),
        )
    except httpx.HTTPStatusError as exc:
        raise ProviderReadError(
            f"Microsoft calendar delta failed with HTTP {exc.response.status_code}.",
            status_code=exc.response.status_code,
        ) from exc
    except httpx.HTTPError as exc:
        raise ProviderReadError(
            f"Microsoft calendar delta failed: {exc.__class__.__name__}."
        ) from exc


def local_provider_fetch_result(
    account: ProviderAccountRecord,
    local_date: str,
    *,
    reason: str | None = None,
) -> ProviderFetchResult:
    day = _local_day(local_date)
    return ProviderFetchResult(
        messages=[
            FetchedProviderMessage(
                local_date=local_date,
                source_ref=_source_ref(account, local_date, "message", "client-reply"),
                subject="Client proposal reply",
                snippet=(
                    "Client response is waiting. The thread needs a short direct reply "
                    "before the afternoon review window."
                ),
                sender="client@example.com",
                recipients=[account.email],
                received_at=datetime.combine(day, time(8, 35), tzinfo=UTC),
                flags=["needs_reply", "client", "priority"],
                unread=True,
                importance="high",
                category_hints=["client", "priority"],
            ),
            FetchedProviderMessage(
                local_date=local_date,
                source_ref=_source_ref(account, local_date, "message", "partner-followup"),
                subject="Partner follow-up",
                snippet="Partner asked for confirmation yesterday and is waiting on your answer.",
                sender="partner@example.com",
                recipients=[account.email],
                received_at=datetime.combine(day, time(10, 5), tzinfo=UTC),
                flags=["waiting_on_you", "follow_up"],
                unread=True,
                category_hints=["follow_up"],
            ),
            FetchedProviderMessage(
                local_date=local_date,
                source_ref=_source_ref(account, local_date, "message", "newsletter"),
                subject="Industry newsletter",
                snippet="Weekly newsletter can be batched or skipped today.",
                sender="newsletter@example.com",
                recipients=[account.email],
                received_at=datetime.combine(day, time(11, 25), tzinfo=UTC),
                flags=["newsletter", "low_priority"],
                importance="low",
                category_hints=["newsletter"],
            ),
        ]
        if account.mail_enabled
        else [],
        calendar_events=[
            FetchedProviderCalendarEvent(
                local_date=local_date,
                source_ref=_source_ref(account, local_date, "calendar", "board-sync"),
                title="Board sync",
                detail="High-context meeting needs a preparation buffer.",
                starts_at=datetime.combine(day, time(14, 0), tzinfo=UTC),
                ends_at=datetime.combine(day, time(15, 0), tzinfo=UTC),
                organizer=account.email,
                attendee_count=5,
                has_meeting_link=True,
                flags=["meeting", "prep_needed"],
            ),
            FetchedProviderCalendarEvent(
                local_date=local_date,
                source_ref=_source_ref(account, local_date, "calendar", "admin-block"),
                title="Admin block",
                detail="Low-priority admin work can move if focus time is tight.",
                starts_at=datetime.combine(day, time(16, 0), tzinfo=UTC),
                ends_at=datetime.combine(day, time(16, 45), tzinfo=UTC),
                organizer=account.email,
                attendee_count=1,
                flags=["move_candidate", "low_priority"],
            ),
        ]
        if account.calendar_enabled
        else [],
        live=False,
        fallback_reason=reason,
    )


def _google_message_to_source(
    account: ProviderAccountRecord,
    local_date: str,
    payload: dict[str, Any],
) -> FetchedProviderMessage:
    headers = _google_headers(payload)
    label_ids = {str(label) for label in payload.get("labelIds") or []}
    subject = headers.get("subject") or "(no subject)"
    sender = headers.get("from", "")
    has_list_unsubscribe = bool(headers.get("list-unsubscribe"))
    unread = "UNREAD" in label_ids
    importance = "high" if "IMPORTANT" in label_ids else "normal"
    flags = _message_flags(
        subject=subject,
        sender=sender,
        unread=unread,
        importance=importance,
        has_list_unsubscribe=has_list_unsubscribe,
    )
    message_id = str(payload.get("id") or _safe_slug(subject))
    return FetchedProviderMessage(
        local_date=local_date,
        source_ref=_source_ref(account, local_date, "message", message_id),
        subject=subject,
        snippet=str(payload.get("snippet") or subject),
        sender=sender,
        recipients=_split_recipients(headers.get("to", "")),
        received_at=_parse_google_message_datetime(payload, headers.get("date")),
        flags=flags,
        unread=unread,
        importance=importance,
        category_hints=_category_hints(flags),
    )


def _google_event_to_source(
    account: ProviderAccountRecord,
    local_date: str,
    payload: dict[str, Any],
) -> FetchedProviderCalendarEvent:
    event_id = str(payload.get("id") or _safe_slug(str(payload.get("summary") or "event")))
    starts_at = _parse_google_event_datetime(payload.get("start"))
    ends_at = _parse_google_event_datetime(payload.get("end"))
    attendees = payload.get("attendees") if isinstance(payload.get("attendees"), list) else []
    organizer = payload.get("organizer") if isinstance(payload.get("organizer"), dict) else {}
    attendee_count = len(attendees)
    title = str(payload.get("summary") or "Calendar event")
    detail = str(payload.get("description") or payload.get("location") or title)
    has_meeting_link = bool(payload.get("hangoutLink") or payload.get("conferenceData"))
    flags = _calendar_flags(title, attendee_count, payload.get("transparency"))
    return FetchedProviderCalendarEvent(
        local_date=local_date,
        source_ref=_source_ref(account, local_date, "calendar", event_id),
        title=title,
        detail=detail,
        starts_at=starts_at,
        ends_at=ends_at,
        organizer=str(organizer.get("email") or organizer.get("displayName") or ""),
        attendee_count=attendee_count,
        has_location=bool(payload.get("location")),
        has_meeting_link=has_meeting_link,
        busy_status="free" if payload.get("transparency") == "transparent" else "busy",
        flags=flags,
    )


def _microsoft_message_to_source(
    account: ProviderAccountRecord,
    local_date: str,
    payload: dict[str, Any],
) -> FetchedProviderMessage:
    message_id = str(payload.get("id") or _safe_slug(str(payload.get("subject") or "message")))
    subject = str(payload.get("subject") or "(no subject)")
    sender = _graph_email(payload.get("from"))
    recipients = [_graph_email(recipient) for recipient in payload.get("toRecipients") or []]
    unread = not bool(payload.get("isRead"))
    importance = str(payload.get("importance") or "normal")
    categories = [str(category) for category in payload.get("categories") or []]
    flags = _message_flags(
        subject=subject,
        sender=sender,
        unread=unread,
        importance=importance,
        has_list_unsubscribe=any("newsletter" in item.lower() for item in categories),
    )
    return FetchedProviderMessage(
        local_date=local_date,
        source_ref=_source_ref(account, local_date, "message", message_id),
        subject=subject,
        snippet=str(payload.get("bodyPreview") or subject),
        sender=sender,
        recipients=[recipient for recipient in recipients if recipient],
        received_at=_parse_datetime(payload.get("receivedDateTime")),
        flags=flags,
        unread=unread,
        importance=importance,
        attachment_count=1 if bool(payload.get("hasAttachments")) else 0,
        category_hints=_category_hints(flags),
    )


def _microsoft_event_to_source(
    account: ProviderAccountRecord,
    local_date: str,
    payload: dict[str, Any],
) -> FetchedProviderCalendarEvent:
    event_id = str(payload.get("id") or _safe_slug(str(payload.get("subject") or "event")))
    title = str(payload.get("subject") or "Calendar event")
    attendees = payload.get("attendees") if isinstance(payload.get("attendees"), list) else []
    location = payload.get("location") if isinstance(payload.get("location"), dict) else {}
    show_as = str(payload.get("showAs") or "busy")
    detail = str(payload.get("bodyPreview") or title)
    flags = _calendar_flags(title, len(attendees), show_as)
    return FetchedProviderCalendarEvent(
        local_date=local_date,
        source_ref=_source_ref(account, local_date, "calendar", event_id),
        title=title,
        detail=detail,
        starts_at=_parse_graph_date_time(payload.get("start")),
        ends_at=_parse_graph_date_time(payload.get("end")),
        organizer=_graph_email(payload.get("organizer")),
        attendee_count=len(attendees),
        has_location=bool(location.get("displayName")),
        has_meeting_link=bool(payload.get("isOnlineMeeting") or payload.get("onlineMeeting")),
        busy_status="free" if show_as in {"free", "workingElsewhere"} else "busy",
        flags=flags,
    )


def _message_flags(
    *,
    subject: str,
    sender: str,
    unread: bool,
    importance: str,
    has_list_unsubscribe: bool,
) -> list[str]:
    haystack = f"{subject} {sender}".lower()
    flags: list[str] = []
    if unread:
        flags.append("needs_reply")
    if importance.lower() == "high" or "client" in haystack:
        flags.extend(["client", "priority"])
    if "follow" in haystack or "waiting" in haystack:
        flags.append("follow_up")
    if has_list_unsubscribe or "newsletter" in haystack:
        flags.extend(["newsletter", "low_priority"])
    return _dedupe(flags)


def _calendar_flags(title: str, attendee_count: int, busy_hint: object) -> list[str]:
    haystack = title.lower()
    flags: list[str] = []
    if attendee_count > 1:
        flags.append("meeting")
    if attendee_count >= 4 or "board" in haystack:
        flags.append("prep_needed")
    if "admin" in haystack or str(busy_hint).lower() in {"transparent", "free"}:
        flags.extend(["move_candidate", "low_priority"])
    return _dedupe(flags)


def _category_hints(flags: list[str]) -> list[str]:
    return [flag for flag in flags if flag in {"client", "priority", "follow_up", "newsletter"}]


def _google_headers(payload: dict[str, Any]) -> dict[str, str]:
    body = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
    headers = body.get("headers") if isinstance(body.get("headers"), list) else []
    result: dict[str, str] = {}
    for header in headers:
        if not isinstance(header, dict):
            continue
        name = str(header.get("name") or "").strip().lower()
        value = str(header.get("value") or "").strip()
        if name:
            result[name] = value
    return result


def _normalize_cursor_context(
    cursors: ProviderCursorContext | dict[str, str] | None,
) -> ProviderCursorContext:
    if isinstance(cursors, ProviderCursorContext):
        return cursors
    if isinstance(cursors, dict):
        return ProviderCursorContext(
            {
                str(cursor_kind): str(cursor_value)
                for cursor_kind, cursor_value in cursors.items()
                if cursor_value
            }
        )
    return ProviderCursorContext()


def _google_history_message_ids(payload: dict[str, Any]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for history_item in payload.get("history") or []:
        if not isinstance(history_item, dict):
            continue
        for message_id in _history_item_message_ids(history_item):
            if message_id in seen:
                continue
            seen.add(message_id)
            result.append(message_id)
    return result


def _history_item_message_ids(history_item: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for collection_name in ("messagesAdded", "messages"):
        for item in history_item.get(collection_name) or []:
            message = item.get("message") if isinstance(item, dict) else None
            if message is None and isinstance(item, dict):
                message = item
            if not isinstance(message, dict):
                continue
            message_id = str(message.get("id") or "")
            if message_id:
                ids.append(message_id)
    return ids


def _latest_google_history_id(payloads: list[dict[str, Any]]) -> str | None:
    history_ids: list[int] = []
    for payload in payloads:
        raw = payload.get("historyId")
        if raw is None:
            continue
        try:
            history_ids.append(int(str(raw)))
        except ValueError:
            continue
    if not history_ids:
        return None
    return str(max(history_ids))


def _graph_delta_cursor(payload: dict[str, Any]) -> str | None:
    for key in ("@odata.deltaLink", "@odata.nextLink"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _is_graph_removed_item(payload: object) -> bool:
    return isinstance(payload, dict) and isinstance(payload.get("@removed"), dict)


def _window_cursor(prefix: str, local_date: str) -> str:
    now_value = utc_now().replace(microsecond=0).isoformat()
    return f"{prefix}:{local_date}:{now_value}"


def _split_recipients(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def _graph_email(value: object) -> str:
    if not isinstance(value, dict):
        return ""
    email = value.get("emailAddress")
    if not isinstance(email, dict):
        return ""
    return str(email.get("address") or email.get("name") or "")


def _parse_google_message_datetime(
    payload: dict[str, Any],
    fallback_header: str | None,
) -> datetime | None:
    internal_date = payload.get("internalDate")
    if internal_date is not None:
        try:
            return datetime.fromtimestamp(int(str(internal_date)) / 1000, tz=UTC)
        except ValueError:
            pass
    if fallback_header:
        try:
            parsed = parsedate_to_datetime(fallback_header)
            return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
        except (TypeError, ValueError):
            return None
    return None


def _parse_google_event_datetime(value: object) -> datetime | None:
    if not isinstance(value, dict):
        return None
    return _parse_datetime(value.get("dateTime") or value.get("date"))


def _parse_graph_date_time(value: object) -> datetime | None:
    if not isinstance(value, dict):
        return None
    return _parse_datetime(value.get("dateTime"))


def _parse_datetime(value: object) -> datetime | None:
    if not value:
        return None
    raw = str(value)
    if len(raw) == 10:
        raw = f"{raw}T00:00:00+00:00"
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _day_window(local_date: str) -> tuple[datetime, datetime]:
    day = _local_day(local_date)
    start = datetime.combine(day, time.min, tzinfo=UTC)
    return start, start + timedelta(days=1)


def _local_day(local_date: str) -> date:
    try:
        return date.fromisoformat(local_date)
    except ValueError:
        return utc_now().date()


def _rfc3339(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _auth_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }


def _is_local_token_payload(token_payload: dict[str, Any]) -> bool:
    token_values = [
        str(token_payload.get("access_token") or ""),
        str(token_payload.get("refresh_token") or ""),
    ]
    return any(value.startswith("local-") for value in token_values)


def _source_ref(
    account: ProviderAccountRecord,
    local_date: str,
    source_kind: str,
    slug: str,
) -> str:
    return (
        f"onebrain://provider-source/{account.provider}/"
        f"{account.provider_account_id}/{local_date}/{source_kind}/{_safe_slug(slug)}"
    )


def _safe_slug(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in value)[:120]


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
