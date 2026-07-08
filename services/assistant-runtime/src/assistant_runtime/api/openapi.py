from __future__ import annotations

import json
from pathlib import Path

from assistant_runtime.api.app import create_app


def write_openapi(path: str | Path) -> None:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(create_app().openapi(), indent=2, sort_keys=True), encoding="utf-8"
    )


def main() -> None:
    write_openapi("packages/assistant-api-contract/openapi.json")


if __name__ == "__main__":
    main()
