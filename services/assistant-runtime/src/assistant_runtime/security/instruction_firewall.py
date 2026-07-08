from __future__ import annotations

import re

from assistant_runtime.schemas import FirewallDecision, SanitizedContent

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
INJECTION_PATTERNS = {
    "ignore_previous_instructions": re.compile(
        r"ignore (all )?(previous|prior) instructions", re.I
    ),
    "tool_payload": re.compile(r"\b(tool|function|arguments|json_schema)\b\s*[:=]", re.I),
    "external_forward": re.compile(r"\b(forward|send|export|bcc|cc)\b.*@", re.I),
    "calendar_attendee_injection": re.compile(r"\b(invite|add attendee|attendee)\b.*@", re.I),
    "reply_to_spoof": re.compile(r"\breply-to\b|\bfrom:\s*.*@", re.I),
}


class BasicInstructionFirewall:
    def inspect(self, content: SanitizedContent, source_ref: str) -> FirewallDecision:
        text = content.safe_text
        risk_flags = set(content.risk_flags)
        blocked_reasons: list[str] = []

        for flag, pattern in INJECTION_PATTERNS.items():
            if pattern.search(text):
                risk_flags.add(flag)
                blocked_reasons.append(f"Untrusted content matched {flag}.")

        if EMAIL_RE.search(text):
            risk_flags.add("untrusted_recipient_candidate")
            blocked_reasons.append("Recipient-like text came from untrusted content.")

        safe_for_model = not {"ignore_previous_instructions", "tool_payload"} & risk_flags

        return FirewallDecision(
            safe_for_model_context=safe_for_model,
            can_create_action_from_raw_content=False,
            extracted_intent=None,
            proposed_recipient_refs=[],
            risk_flags=sorted(risk_flags),
            blocked_reasons=blocked_reasons,
        )
