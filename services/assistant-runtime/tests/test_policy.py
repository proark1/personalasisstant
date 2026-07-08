from assistant_runtime.domain.action_store import InMemoryActionStore
from assistant_runtime.policy.action_policy import AssistantActionPolicyEngine
from assistant_runtime.schemas import ActionCreateRequest, ApprovalChannel, RiskTier


def test_medium_risk_can_be_approved_from_telegram() -> None:
    store = InMemoryActionStore()
    action = store.create(ActionCreateRequest(risk_tier=RiskTier.medium, idempotency_key="medium"))
    decision = AssistantActionPolicyEngine().evaluate(action, ApprovalChannel.telegram)

    assert decision.allowed is True


def test_high_risk_requires_web_fresh_auth() -> None:
    store = InMemoryActionStore()
    action = store.create(
        ActionCreateRequest(
            action_type="send_email",
            risk_tier=RiskTier.high,
            idempotency_key="high",
            reversible=False,
        )
    )
    policy = AssistantActionPolicyEngine()

    telegram = policy.evaluate(action, ApprovalChannel.telegram)
    web_without_fresh_auth = policy.evaluate(action, ApprovalChannel.web, fresh_auth=False)
    fresh_auth = policy.evaluate(action, ApprovalChannel.fresh_auth, fresh_auth=True)

    assert telegram.allowed is False
    assert web_without_fresh_auth.allowed is False
    assert fresh_auth.allowed is True


def test_onebrain_outage_blocks_high_risk_execution() -> None:
    store = InMemoryActionStore()
    action = store.create(
        ActionCreateRequest(
            action_type="send_email",
            risk_tier=RiskTier.high,
            idempotency_key="high-outage",
            reversible=False,
        )
    )
    store.approve(action.action_id, "user_demo", ApprovalChannel.fresh_auth, "Fresh auth.")

    decision = AssistantActionPolicyEngine().evaluate(
        action,
        ApprovalChannel.worker,
        onebrain_available=False,
    )

    assert decision.allowed is False
    assert any("OneBrain" in reason for reason in decision.blocked_reasons)
