from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable

DRAFT_ACTION_TYPE = "create_email_draft"


def compute_content_hash(
    *,
    action_type: str,
    subject: str,
    body: str,
    recipient_refs: Iterable[str],
    sending_account_ref: str | None,
    changed_fields: Iterable[str],
) -> str:
    """A stable hash over everything an approval commits to.

    Approving binds to this hash; any later change to subject/body/recipients/
    sending account/changed fields produces a different hash, which resets a prior
    approval to needs_review and rejects a stale approve call.
    """
    canonical = json.dumps(
        {
            "action_type": action_type,
            "subject": subject,
            "body": body,
            "recipients": sorted(recipient_refs),
            "sending_account": sending_account_ref or "",
            "changed_fields": sorted(changed_fields),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def propose_reply_draft(*, source_ref: str, recipient_ref: str, subject: str) -> tuple[str, str]:
    """Deterministically propose a reply subject/body from an inbox item.

    A safe editable template — no LLM, no fabricated content. The user edits it
    before approval; the exact edited content is what gets snapshotted and approved.
    """
    clean_subject = subject.strip()
    if not clean_subject:
        reply_subject = "Re: your message"
    elif clean_subject.lower().startswith("re:"):
        reply_subject = clean_subject
    else:
        reply_subject = f"Re: {clean_subject}"
    body = (
        "Hi,\n\n"
        "Thanks for your message — here's a proposed reply for you to review and edit "
        "before it is sent.\n\n"
        "[Draft body: replace with your reply.]\n\n"
        "Best regards"
    )
    return reply_subject, body
