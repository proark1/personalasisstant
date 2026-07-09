from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "assistant-runtime" / "src"))

from assistant_runtime.config import Settings
from assistant_runtime.providers.onebrain import HttpOneBrainClient, build_brain_client


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


async def main() -> None:
    load_dotenv()
    settings = Settings()
    client = build_brain_client(settings)
    if not isinstance(client, HttpOneBrainClient):
        raise SystemExit(
            "OneBrain smoke requires ONEBRAIN_CLIENT_MODE=http and a scoped service key."
        )
    if not settings.onebrain_service_key:
        raise SystemExit("OneBrain smoke requires ONEBRAIN_SERVICE_KEY.")

    available = await client.check_available()
    if not available:
        raise SystemExit("OneBrain capabilities check failed.")

    source_ref = f"assistant:smoke:{uuid4().hex}"
    record = await client.create_assistant_record(
        content="Synthetic assistant OneBrain smoke record. Safe to delete after verification.",
        record_type="brief",
        purpose="assistant_briefing",
        account_id=settings.onebrain_account_id,
        space_id=settings.onebrain_space_id,
        title="Assistant smoke check",
        source="assistant",
        source_ref=source_ref,
        metadata={"smoke": True, "generated_by": "personalassistant"},
        provenance={"source_ref": source_ref},
        retention={"policy": "smoke_ephemeral"},
    )
    record_id = str(record.get("id") or "")
    if not record_id:
        raise SystemExit("OneBrain smoke did not return a record id.")

    listed = await client.list_assistant_records(
        account_id=settings.onebrain_account_id,
        space_id=settings.onebrain_space_id,
        purpose="assistant_briefing",
        record_type="brief",
        limit=10,
    )
    if not any(item.get("id") == record_id for item in listed):
        raise SystemExit("OneBrain smoke record was not visible in list results.")

    fetched = await client.get_assistant_record(
        record_id,
        account_id=settings.onebrain_account_id,
        space_id=settings.onebrain_space_id,
        purpose="assistant_briefing",
    )
    if fetched.get("id") != record_id:
        raise SystemExit("OneBrain smoke fetched the wrong record.")

    audit = await client.record_audit_event(
        action="assistant.action.proposed",
        target_type="smoke_record",
        target_id=record_id,
        account_id=settings.onebrain_account_id,
        space_id=settings.onebrain_space_id,
        purpose="assistant_action",
        decision="recorded",
        metadata={"smoke": True, "record_id": record_id},
    )
    if not audit.get("id"):
        raise SystemExit("OneBrain smoke audit write did not return an id.")

    print("OneBrain assistant smoke check passed")
    print(f"Account: {settings.onebrain_account_id}")
    print(f"Space: {settings.onebrain_space_id}")
    print(f"Record: {record_id}")
    print(f"Audit: {audit['id']}")


if __name__ == "__main__":
    asyncio.run(main())
