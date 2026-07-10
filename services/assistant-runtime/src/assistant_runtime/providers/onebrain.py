from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx

from assistant_runtime.config import Settings
from assistant_runtime.contracts import (
    ASSISTANT_APP_ID,
    ASSISTANT_CONTRACT_VERSION,
    ASSISTANT_PURPOSES,
    ASSISTANT_RECORD_TYPES,
    contains_secret_reference,
    copy_metadata,
    default_assistant_intent,
    validate_assistant_contract_names,
)
from assistant_runtime.interfaces import BrainClient
from assistant_runtime.schemas import ActionRecord, JsonObject, PolicyDecision


@dataclass
class OneBrainClientError(RuntimeError):
    status_code: int
    detail: str

    def __str__(self) -> str:
        return f"OneBrain request failed ({self.status_code}): {self.detail}"


class DisabledBrainClient:
    async def check_available(self) -> bool:
        return False

    async def capabilities(self) -> JsonObject:
        return {}

    async def create_assistant_record(self, **_: Any) -> JsonObject:
        raise OneBrainClientError(503, "OneBrain client is disabled.")

    async def get_assistant_record(
        self,
        record_id: str,
        *,
        account_id: str = "",
        space_id: str = "",
        purpose: str = "",
    ) -> JsonObject:
        raise OneBrainClientError(503, "OneBrain client is disabled.")

    async def list_assistant_records(self, **_: Any) -> list[JsonObject]:
        raise OneBrainClientError(503, "OneBrain client is disabled.")

    async def record_audit_event(self, **_: Any) -> JsonObject:
        raise OneBrainClientError(503, "OneBrain client is disabled.")

    async def record_action_audit(self, action: ActionRecord, decision: PolicyDecision) -> None:
        raise OneBrainClientError(503, "OneBrain client is disabled.")


class InMemoryBrainClient:
    def __init__(self) -> None:
        self.records: dict[str, JsonObject] = {}
        self.audit_events: list[JsonObject] = []

    async def check_available(self) -> bool:
        return True

    async def capabilities(self) -> JsonObject:
        return {
            "app_id": ASSISTANT_APP_ID,
            "contract_version": ASSISTANT_CONTRACT_VERSION,
            "purposes": sorted(ASSISTANT_PURPOSES),
            "record_types": sorted(ASSISTANT_RECORD_TYPES),
        }

    async def create_assistant_record(
        self,
        *,
        content: str,
        record_type: str,
        purpose: str,
        account_id: str,
        space_id: str,
        title: str = "",
        intent: str = "",
        source: str = "assistant",
        source_ref: str = "",
        metadata: JsonObject | None = None,
        provenance: JsonObject | None = None,
        retention: JsonObject | None = None,
    ) -> JsonObject:
        intent = intent or default_assistant_intent(record_type)
        metadata = _validated_metadata(
            record_type=record_type,
            purpose=purpose,
            intent=intent,
            metadata=metadata,
            provenance=provenance,
            retention=retention,
        )
        record_id = f"asst_{uuid4().hex}"
        record = {
            "id": record_id,
            "tenant_id": account_id,
            "account_id": account_id,
            "space_id": space_id,
            "app_id": ASSISTANT_APP_ID,
            "purpose": purpose,
            "source": source,
            "source_ref": source_ref,
            "record_type": record_type,
            "intent": intent,
            "classification": "public",
            "confidence": 1.0,
            "status": "approved",
            "title": title,
            "content": content,
            "summary": content[:200],
            "extracted_facts": {},
            "metadata": metadata,
            "created_at": _now_iso(),
        }
        self.records[record_id] = record
        return record

    async def get_assistant_record(
        self,
        record_id: str,
        *,
        account_id: str = "",
        space_id: str = "",
        purpose: str = "",
    ) -> JsonObject:
        try:
            return self.records[record_id]
        except KeyError as exc:
            raise OneBrainClientError(404, "Assistant record not found.") from exc

    async def list_assistant_records(
        self,
        *,
        account_id: str = "",
        space_id: str = "",
        purpose: str = "",
        record_type: str = "",
        intent: str = "",
        status: str = "",
        limit: int = 50,
    ) -> list[JsonObject]:
        matches: list[JsonObject] = []
        for record in self.records.values():
            if account_id and record["account_id"] != account_id:
                continue
            if space_id and record["space_id"] != space_id:
                continue
            if record_type and record["record_type"] != record_type:
                continue
            if intent and record["intent"] != intent:
                continue
            if purpose and record["purpose"] != purpose:
                continue
            if status and record["status"] != status:
                continue
            matches.append(record)
            if len(matches) >= limit:
                break
        return matches

    async def record_audit_event(
        self,
        *,
        action: str,
        target_type: str,
        target_id: str,
        account_id: str,
        space_id: str,
        purpose: str = "assistant_action",
        decision: str = "recorded",
        metadata: JsonObject | None = None,
    ) -> JsonObject:
        metadata = _validated_audit_metadata(metadata)
        event = {
            "id": f"aud_asst_{uuid4().hex}",
            "account_id": account_id,
            "actor_id": "assistant-runtime",
            "actor_type": "service",
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "space_id": space_id,
            "app_id": ASSISTANT_APP_ID,
            "purpose": purpose,
            "decision": decision,
            "meta": metadata,
            "created_at": _now_iso(),
        }
        self.audit_events.append(event)
        return event

    async def record_action_audit(self, action: ActionRecord, decision: PolicyDecision) -> None:
        await self.record_audit_event(
            action=f"assistant.action.{action.state}",
            target_type="action",
            target_id=str(action.action_id),
            account_id=action.scope.account_id,
            space_id=action.scope.space_id,
            purpose="assistant_action",
            decision="allowed" if decision.allowed else "blocked",
            metadata=action_audit_metadata(action, decision),
        )


class HttpOneBrainClient:
    def __init__(
        self,
        *,
        base_url: str,
        service_key: str,
        account_id: str = "acct_demo",
        space_id: str = "space_demo",
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self.service_key = service_key
        self.account_id = account_id.strip()
        self.space_id = space_id.strip()
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    async def capabilities(self) -> JsonObject:
        if not self.service_key:
            return {}
        try:
            query = urlencode(
                self._service_scope(
                    account_id=self.account_id,
                    space_id=self.space_id,
                    purpose="assistant_provider_health",
                )
            )
            return await self._request("GET", f"api/service/capabilities?{query}")
        except OneBrainClientError:
            return {}

    async def check_available(self) -> bool:
        capabilities = await self.capabilities()
        if not capabilities:
            return False
        if capabilities.get("app_id") and capabilities.get("app_id") != ASSISTANT_APP_ID:
            return False
        if capabilities.get("account_id") and capabilities.get("account_id") != self.account_id:
            return False
        space_ids = capabilities.get("space_ids") or []
        if isinstance(space_ids, list) and space_ids and self.space_id not in space_ids:
            return False
        return True

    async def create_assistant_record(
        self,
        *,
        content: str,
        record_type: str,
        purpose: str,
        account_id: str,
        space_id: str,
        title: str = "",
        intent: str = "",
        source: str = "assistant",
        source_ref: str = "",
        metadata: JsonObject | None = None,
        provenance: JsonObject | None = None,
        retention: JsonObject | None = None,
    ) -> JsonObject:
        payload: JsonObject = {
            "content": content,
            "record_type": record_type,
            "intent": intent,
            "source": source,
            "source_ref": source_ref,
            **self._service_scope(account_id=account_id, space_id=space_id, purpose=purpose),
            "metadata": dict(metadata or {}),
            "provenance": dict(provenance or {}),
            "retention": dict(retention or {}),
        }
        if title:
            payload["title"] = title
        response = await self._request("POST", "api/service/assistant/records", payload)
        return dict(response.get("record") or {})

    async def get_assistant_record(
        self,
        record_id: str,
        *,
        account_id: str = "",
        space_id: str = "",
        purpose: str = "",
    ) -> JsonObject:
        query = urlencode(
            self._service_scope(account_id=account_id, space_id=space_id, purpose=purpose)
        )
        response = await self._request("GET", f"api/service/assistant/records/{record_id}?{query}")
        return dict(response.get("record") or {})

    async def list_assistant_records(
        self,
        *,
        account_id: str = "",
        space_id: str = "",
        purpose: str = "",
        record_type: str = "",
        intent: str = "",
        status: str = "",
        limit: int = 50,
    ) -> list[JsonObject]:
        params = {
            **self._service_scope(account_id=account_id, space_id=space_id, purpose=purpose),
            "record_type": record_type,
            "intent": intent,
            "status": status,
            "limit": str(limit),
        }
        query = urlencode({key: value for key, value in params.items() if value})
        path = "api/service/assistant/records"
        if query:
            path = f"{path}?{query}"
        response = await self._request("GET", path)
        return list(response.get("records") or [])

    async def record_audit_event(
        self,
        *,
        action: str,
        target_type: str,
        target_id: str,
        account_id: str,
        space_id: str,
        purpose: str = "assistant_action",
        decision: str = "recorded",
        metadata: JsonObject | None = None,
    ) -> JsonObject:
        payload: JsonObject = {
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            **self._service_scope(account_id=account_id, space_id=space_id, purpose=purpose),
            "decision": decision,
            "metadata": dict(metadata or {}),
        }
        return await self._request("POST", "api/service/assistant/audit", payload)

    async def record_action_audit(self, action: ActionRecord, decision: PolicyDecision) -> None:
        await self.record_audit_event(
            action=f"assistant.action.{action.state}",
            target_type="action",
            target_id=str(action.action_id),
            account_id=action.scope.account_id,
            space_id=action.scope.space_id,
            purpose="assistant_action",
            decision="allowed" if decision.allowed else "blocked",
            metadata=action_audit_metadata(action, decision),
        )

    async def _request(
        self,
        method: str,
        path: str,
        payload: JsonObject | None = None,
    ) -> JsonObject:
        url = self.base_url + path.lstrip("/")
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
        }
        if payload is not None:
            headers["Content-Type"] = "application/json"
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                transport=self.transport,
            ) as client:
                response = await client.request(method, url, headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise OneBrainClientError(
                exc.response.status_code,
                _safe_error_detail(exc.response),
            ) from exc
        except httpx.HTTPError as exc:
            raise OneBrainClientError(0, exc.__class__.__name__) from exc
        return dict(response.json()) if response.content else {}

    def _service_scope(self, *, account_id: str, space_id: str, purpose: str) -> JsonObject:
        scope: JsonObject = {
            "account_id": account_id.strip() or self.account_id,
            "space_id": space_id.strip() or self.space_id,
            "app_id": ASSISTANT_APP_ID,
            "purpose": purpose.strip(),
        }
        missing = [key for key, value in scope.items() if not value]
        if missing:
            raise OneBrainClientError(
                400,
                f"OneBrain service scope is missing required fields: {', '.join(missing)}",
            )
        return scope


def build_brain_client(settings: Settings) -> BrainClient:
    mode = settings.onebrain_client_mode.lower().strip()
    if not settings.onebrain_available or mode == "disabled":
        return DisabledBrainClient()
    if mode == "memory":
        return InMemoryBrainClient()
    if mode == "http":
        return HttpOneBrainClient(
            base_url=settings.onebrain_api_base_url,
            service_key=settings.onebrain_service_key,
            account_id=settings.onebrain_account_id,
            space_id=settings.onebrain_space_id,
            timeout_seconds=settings.onebrain_timeout_seconds,
        )
    if settings.onebrain_service_key:
        return HttpOneBrainClient(
            base_url=settings.onebrain_api_base_url,
            service_key=settings.onebrain_service_key,
            account_id=settings.onebrain_account_id,
            space_id=settings.onebrain_space_id,
            timeout_seconds=settings.onebrain_timeout_seconds,
        )
    if settings.environment.lower() == "local":
        return InMemoryBrainClient()
    return DisabledBrainClient()


def action_audit_metadata(action: ActionRecord, decision: PolicyDecision) -> JsonObject:
    return {
        "action_type": action.action_type,
        "risk_tier": str(action.risk_tier),
        "state": str(action.state),
        "idempotency_key": action.idempotency_key,
        "correlation_id": action.correlation_id,
        "audit_correlation_id": action.audit_correlation_id,
        "source_refs": list(action.source_refs),
        "sending_account_ref": action.sending_account_ref,
        "recipient_refs": list(action.recipient_refs),
        "policy": {
            "allowed": decision.allowed,
            "requires_approval": decision.requires_approval,
            "reason": decision.reason,
            "blocked_reasons": list(decision.blocked_reasons),
            "allowed_channels": [str(channel) for channel in decision.allowed_channels],
        },
    }


def _validated_metadata(
    *,
    record_type: str,
    purpose: str,
    intent: str,
    metadata: JsonObject | None,
    provenance: JsonObject | None,
    retention: JsonObject | None,
) -> JsonObject:
    validate_assistant_contract_names(
        record_type=record_type,
        purpose=purpose,
        intent=intent,
    )
    clean_metadata = copy_metadata(metadata, "metadata")
    clean_provenance = copy_metadata(provenance, "provenance")
    clean_retention = copy_metadata(retention, "retention")
    if record_type == "secret_reference" and not contains_secret_reference(clean_metadata):
        raise ValueError("secret_reference records must identify a secret_ref.")
    clean_metadata["assistant_contract"] = {
        "version": ASSISTANT_CONTRACT_VERSION,
        "app_id": ASSISTANT_APP_ID,
        "record_type": record_type,
        "purpose": purpose,
        "intent": intent,
        "provenance": clean_provenance,
        "retention": clean_retention,
    }
    return clean_metadata


def _validated_audit_metadata(metadata: JsonObject | None) -> JsonObject:
    clean_metadata = copy_metadata(metadata, "metadata")
    clean_metadata["assistant_contract"] = {
        "version": ASSISTANT_CONTRACT_VERSION,
        "app_id": ASSISTANT_APP_ID,
        "record_type": "action_audit",
    }
    return clean_metadata


def write_contract_status(capabilities: JsonObject) -> str:
    """Compare the assistant's write vocabulary against OneBrain capabilities.

    Returns a readiness check value: ``ok`` when every purpose the service key may
    use and every record type the deployment accepts covers the assistant contract;
    ``error:...`` (which degrades readiness) when drift would reject writes; and
    ``unknown`` when OneBrain predates contract advertisement, so drift can only be
    discovered at write time.
    """
    if not capabilities:
        return "error:capabilities_unavailable"
    advertised_record_types = capabilities.get("record_types")
    advertised_purposes = capabilities.get("purposes")
    if not isinstance(advertised_record_types, list) or not advertised_record_types:
        return "unknown"
    problems: list[str] = []
    missing_types = sorted(ASSISTANT_RECORD_TYPES - set(advertised_record_types))
    if missing_types:
        problems.append("record_types=" + ",".join(missing_types))
    if isinstance(advertised_purposes, list) and advertised_purposes:
        missing_purposes = sorted(ASSISTANT_PURPOSES - set(advertised_purposes))
        if missing_purposes:
            problems.append("purposes=" + ",".join(missing_purposes))
    if problems:
        return "error:contract_drift:" + ";".join(problems)
    return "ok"


def _safe_error_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.reason_phrase
    detail = body.get("detail", response.reason_phrase)
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        # FastAPI validation errors: summarize field paths without echoing values.
        locations = []
        for error in detail[:5]:
            if isinstance(error, dict):
                loc = ".".join(str(part) for part in error.get("loc", []))
                message = str(error.get("msg", "invalid"))
                locations.append(f"{loc}: {message}" if loc else message)
        if locations:
            return "validation failed: " + "; ".join(locations)
    return response.reason_phrase


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
