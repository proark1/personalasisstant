from __future__ import annotations

import argparse
import json
from pathlib import Path

from assistant_runtime.api.app import create_app


def export_openapi(output: Path) -> None:
    app = create_app()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the assistant FastAPI OpenAPI schema.")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    export_openapi(args.output)


if __name__ == "__main__":
    main()
