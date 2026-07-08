from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from typing import Any

SECRET_KEY_RE = re.compile(
    r"(authorization|cookie|token|secret|api[_-]?key|refresh[_-]?token)",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


def redact(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        redacted = EMAIL_RE.sub("[redacted-email]", value)
        if len(redacted) > 12 and SECRET_KEY_RE.search(redacted):
            return "[redacted]"
        return redacted
    if isinstance(value, Mapping):
        return {
            str(key): "[redacted]" if SECRET_KEY_RE.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list | tuple | set):
        return [redact(item) for item in value]
    return value


class RedactingJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
        }
        if hasattr(record, "extra"):
            payload["extra"] = redact(record.extra)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(redact(payload), separators=(",", ":"), sort_keys=True)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(RedactingJsonFormatter())
    root.addHandler(handler)
    root.setLevel(level.upper())
