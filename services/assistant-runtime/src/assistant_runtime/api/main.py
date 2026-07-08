from __future__ import annotations

import os

import uvicorn

from assistant_runtime.api.app import create_app
from assistant_runtime.config import get_settings

app = create_app()


def run() -> None:
    settings = get_settings()
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "assistant_runtime.api.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.environment == "local",
        log_config=None,
    )


if __name__ == "__main__":
    run()
