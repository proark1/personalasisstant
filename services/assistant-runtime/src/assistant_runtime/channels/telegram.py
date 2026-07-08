from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TelegramBinding:
    telegram_chat_ref: str
    onebrain_user_ref: str
    account_ref: str
    space_ref: str
    verified: bool


class TelegramChannel:
    """Telegram notification skeleton behind the NotificationChannel boundary."""

    async def send(self, user_ref: str, message_ref: str, correlation_id: str) -> str:
        return f"telegram://delivery/{user_ref}/{correlation_id}"

    async def receive(self, payload: dict[str, object]) -> str:
        update_id = payload.get("update_id", "unknown")
        return f"telegram://inbound/{update_id}"

    def can_callback_approve(self, action_id: str | None, binding: TelegramBinding) -> bool:
        return bool(action_id and binding.verified)
