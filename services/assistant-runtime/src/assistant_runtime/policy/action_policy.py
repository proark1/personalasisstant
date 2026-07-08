from __future__ import annotations

from assistant_runtime.schemas import (
    ActionRecord,
    ActionState,
    ApprovalChannel,
    PolicyDecision,
    RiskTier,
)

HIGH_RISK_ACTION_TYPES = {
    "send_email",
    "forward_email",
    "add_bcc",
    "delete_email",
    "invite_external_attendee",
    "change_external_meeting",
    "cancel_external_meeting",
    "export_sensitive_content",
}

DEGRADED_BLOCKED_ACTIONS = {
    "send_email",
    "forward_email",
    "delete_email",
    "invite_external_attendee",
    "change_external_meeting",
    "cancel_external_meeting",
    "export_sensitive_content",
}


class AssistantActionPolicyEngine:
    def evaluate(
        self,
        action: ActionRecord,
        channel: ApprovalChannel,
        fresh_auth: bool = False,
        onebrain_available: bool = True,
        introduced_by_untrusted_content: bool = False,
    ) -> PolicyDecision:
        risk_tier = self._risk_tier(action, introduced_by_untrusted_content)
        blocked: list[str] = []

        if ApprovalChannel(channel) == ApprovalChannel.worker:
            if ActionState(action.state) != ActionState.approved:
                blocked.append("Worker can only execute approved actions.")
            if not onebrain_available and (
                risk_tier == RiskTier.high or action.action_type in DEGRADED_BLOCKED_ACTIONS
            ):
                blocked.append("OneBrain audit/provenance is unavailable.")
            return PolicyDecision(
                allowed=not blocked,
                risk_tier=risk_tier,
                requires_approval=False,
                allowed_channels=[ApprovalChannel.worker],
                reason=(
                    "Approved action may be relayed by the idempotent worker."
                    if not blocked
                    else "Worker execution blocked by policy."
                ),
                blocked_reasons=blocked,
            )

        if not onebrain_available and (
            risk_tier == RiskTier.high or action.action_type in DEGRADED_BLOCKED_ACTIONS
        ):
            blocked.append("OneBrain audit/provenance is unavailable.")

        allowed_channels = self.allowed_channels_for(risk_tier)
        if channel not in allowed_channels:
            blocked.append(f"{channel} approval is not allowed for {risk_tier} risk.")

        if risk_tier == RiskTier.high and channel == ApprovalChannel.web and not fresh_auth:
            blocked.append("High-risk actions require fresh-auth confirmation.")

        allowed = not blocked
        return PolicyDecision(
            allowed=allowed,
            risk_tier=risk_tier,
            requires_approval=action.external_side_effect or risk_tier != RiskTier.low,
            allowed_channels=allowed_channels,
            reason=(
                "Action is allowed by current risk tier and channel policy."
                if allowed
                else "Action blocked by policy."
            ),
            blocked_reasons=blocked,
        )

    def allowed_channels_for(self, risk_tier: RiskTier) -> list[ApprovalChannel]:
        if risk_tier == RiskTier.low:
            return [ApprovalChannel.web, ApprovalChannel.telegram, ApprovalChannel.voice]
        if risk_tier == RiskTier.medium:
            return [ApprovalChannel.web, ApprovalChannel.telegram]
        return [ApprovalChannel.web, ApprovalChannel.fresh_auth]

    def _risk_tier(
        self, action: ActionRecord, introduced_by_untrusted_content: bool = False
    ) -> RiskTier:
        if (
            action.risk_tier == RiskTier.high
            or action.action_type in HIGH_RISK_ACTION_TYPES
            or introduced_by_untrusted_content
        ):
            return RiskTier.high
        return RiskTier(action.risk_tier)
