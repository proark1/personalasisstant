from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelRoute:
    provider: str
    model: str
    cost_class: str
    reason: str


class ModelRouter:
    def choose(
        self, task: str, sensitivity: str = "standard", latency: str = "normal"
    ) -> ModelRoute:
        if sensitivity in {"confidential", "regulated"}:
            return ModelRoute(
                provider="configured-eu-or-self-hosted",
                model="policy-selected-private-model",
                cost_class="strong",
                reason="Sensitive content requires the configured privacy-preserving route.",
            )
        if task in {"triage", "classification", "dedupe"}:
            return ModelRoute(
                provider="configured-llm",
                model="cheap-classifier",
                cost_class="cheap",
                reason="Routine triage uses cheap model tiering.",
            )
        if latency == "voice":
            return ModelRoute(
                provider="gemini",
                model="speed-optimized-voice",
                cost_class="medium",
                reason="MVP voice optimizes for speed behind provider interfaces.",
            )
        return ModelRoute(
            provider="configured-llm",
            model="strong-planner",
            cost_class="strong",
            reason="Drafting and planning use the stronger route.",
        )
