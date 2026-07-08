from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import Any

ASSISTANT_APP_ID = "assistant"
ASSISTANT_CONTRACT_VERSION = "assistant.v1"

ASSISTANT_PURPOSES = frozenset(
    {
        "assistant_action",
        "assistant_briefing",
        "assistant_calendar_planning",
        "assistant_connected_account",
        "assistant_context",
        "assistant_feedback",
        "assistant_followup",
        "assistant_model_usage",
        "assistant_notification",
        "assistant_provider_health",
        "assistant_security",
        "assistant_settings",
        "assistant_sync",
        "assistant_voice",
    }
)

ASSISTANT_RECORD_TYPES = frozenset(
    {
        "action",
        "action_audit",
        "assistant_setting",
        "brief",
        "calendar_event",
        "calendar_focus_plan",
        "feedback",
        "follow_up",
        "message",
        "model_usage",
        "notification_event",
        "notification_preference",
        "policy_decision",
        "provider_account",
        "provider_health",
        "scope_grant",
        "secret_reference",
        "security_decision",
        "sync_cursor",
        "sync_subscription",
        "task",
        "telegram_binding",
        "transcript",
        "voice_transcript",
    }
)

ASSISTANT_INTENTS = frozenset(
    {
        "action_proposal",
        "approval",
        "briefing",
        "calendar_focus",
        "connected_account",
        "execution",
        "feedback",
        "follow_up",
        "model_usage",
        "notification",
        "provider_health",
        "security_decision",
        "settings_update",
        "sync_state",
        "telegram_binding",
        "voice_turn",
    }
)

DEFAULT_INTENTS = {
    "action": "action_proposal",
    "action_audit": "execution",
    "assistant_setting": "settings_update",
    "brief": "briefing",
    "calendar_event": "calendar_focus",
    "calendar_focus_plan": "calendar_focus",
    "feedback": "feedback",
    "follow_up": "follow_up",
    "message": "notification",
    "model_usage": "model_usage",
    "notification_event": "notification",
    "notification_preference": "notification",
    "policy_decision": "security_decision",
    "provider_account": "connected_account",
    "provider_health": "provider_health",
    "scope_grant": "connected_account",
    "secret_reference": "connected_account",
    "security_decision": "security_decision",
    "sync_cursor": "sync_state",
    "sync_subscription": "sync_state",
    "task": "follow_up",
    "telegram_binding": "telegram_binding",
    "transcript": "voice_turn",
    "voice_transcript": "voice_turn",
}

PURPOSE_BY_RECORD_TYPE = {
    "action": "assistant_action",
    "action_audit": "assistant_action",
    "assistant_setting": "assistant_settings",
    "brief": "assistant_briefing",
    "calendar_event": "assistant_calendar_planning",
    "calendar_focus_plan": "assistant_calendar_planning",
    "feedback": "assistant_feedback",
    "follow_up": "assistant_followup",
    "message": "assistant_notification",
    "model_usage": "assistant_model_usage",
    "notification_event": "assistant_notification",
    "notification_preference": "assistant_notification",
    "policy_decision": "assistant_action",
    "provider_account": "assistant_connected_account",
    "provider_health": "assistant_provider_health",
    "scope_grant": "assistant_connected_account",
    "secret_reference": "assistant_connected_account",
    "security_decision": "assistant_security",
    "sync_cursor": "assistant_sync",
    "sync_subscription": "assistant_sync",
    "task": "assistant_followup",
    "telegram_binding": "assistant_notification",
    "transcript": "assistant_voice",
    "voice_transcript": "assistant_voice",
}

RAW_SECRET_KEYS = frozenset(
    {
        "access_token",
        "api_key",
        "authorization",
        "bot_token",
        "client_secret",
        "cookie",
        "oauth_token",
        "password",
        "refresh_token",
        "secret",
        "secret_value",
        "token",
        "webhook_secret",
    }
)

SECRET_REFERENCE_KEYS = frozenset(
    {
        "secret_ref",
        "secret_ref_id",
        "secret_reference",
        "secret_reference_id",
        "secret_provider",
        "secret_version",
    }
)


def default_assistant_intent(record_type: str) -> str:
    return DEFAULT_INTENTS.get((record_type or "").strip(), "")


def purpose_for_record_type(record_type: str) -> str:
    return PURPOSE_BY_RECORD_TYPE.get((record_type or "").strip(), "assistant_context")


def validate_assistant_contract_names(
    *, record_type: str, purpose: str, intent: str = ""
) -> None:
    if record_type not in ASSISTANT_RECORD_TYPES:
        raise ValueError(f"Unknown assistant record_type: {record_type}")
    if purpose not in ASSISTANT_PURPOSES:
        raise ValueError(f"Unknown assistant purpose: {purpose}")
    if intent and intent not in ASSISTANT_INTENTS:
        raise ValueError(f"Unknown assistant intent: {intent}")


def validate_no_raw_secret_values(value: Any, path: str) -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if _looks_like_raw_secret_key(str(key)):
                raise ValueError(
                    "Raw secret values are not allowed in OneBrain assistant records: "
                    f"{child_path}"
                )
            validate_no_raw_secret_values(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_no_raw_secret_values(child, f"{path}[{index}]")


def contains_secret_reference(value: Any) -> bool:
    if isinstance(value, Mapping):
        for key, child in value.items():
            normalized = _normalize_key(str(key))
            if normalized in SECRET_REFERENCE_KEYS or normalized.endswith("_secret_ref"):
                return True
            if contains_secret_reference(child):
                return True
    elif isinstance(value, list):
        return any(contains_secret_reference(child) for child in value)
    return False


def copy_metadata(value: Mapping[str, Any] | None, label: str) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise ValueError(f"Assistant {label} must be an object.")
    copied = deepcopy(dict(value))
    validate_no_raw_secret_values(copied, label)
    return copied


def record_type_for_telegram_event(event_type: str) -> str:
    if event_type == "telegram.binding.verified":
        return "telegram_binding"
    if event_type == "telegram.inbound.text":
        return "message"
    if event_type in {"telegram.command.pause", "telegram.command.resume"}:
        return "notification_preference"
    return "notification_event"


def _looks_like_raw_secret_key(key: str) -> bool:
    normalized = _normalize_key(key)
    if normalized in SECRET_REFERENCE_KEYS or normalized.endswith("_secret_ref"):
        return False
    if normalized in RAW_SECRET_KEYS:
        return True
    return (
        normalized.endswith("_access_token")
        or normalized.endswith("_api_key")
        or normalized.endswith("_bot_token")
        or normalized.endswith("_client_secret")
        or normalized.endswith("_password")
        or normalized.endswith("_refresh_token")
        or normalized.endswith("_secret")
        or normalized.endswith("_token")
    )


def _normalize_key(key: str) -> str:
    return key.strip().lower().replace("-", "_")
