from __future__ import annotations

import html
import re
from html.parser import HTMLParser

from assistant_runtime.schemas import SanitizedContent

INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]")
WHITESPACE_RE = re.compile(r"\s+")


class _SafeTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.removed_markers: list[str] = []
        self.risk_flags: list[str] = []
        self._hidden_depth = 0
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key.lower(): (value or "") for key, value in attrs}
        if tag in {"script", "style", "head", "meta", "link", "img", "svg"}:
            self._skip_depth += 1
            self.removed_markers.append(f"removed_tag:{tag}")
            return
        if self._is_hidden(attr_map):
            self._hidden_depth += 1
            self.removed_markers.append(f"hidden_element:{tag}")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "head", "meta", "link", "img", "svg"} and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._hidden_depth:
            self._hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth or self._hidden_depth:
            text = data.strip()
            if text:
                self.risk_flags.append("hidden_text_removed")
            return
        self.parts.append(data)

    def _is_hidden(self, attrs: dict[str, str]) -> bool:
        style = attrs.get("style", "").lower().replace(" ", "")
        class_name = attrs.get("class", "").lower()
        hidden_markers = [
            "display:none",
            "visibility:hidden",
            "font-size:0",
            "opacity:0",
            "left:-9999",
            "color:white;background:white",
            "color:#fff;background:#fff",
            "color:#ffffff;background:#ffffff",
        ]
        if "hidden" in attrs or attrs.get("aria-hidden") == "true":
            return True
        if any(marker in style for marker in hidden_markers):
            return True
        return any(name in class_name for name in ("hidden", "visually-hidden", "sr-only"))


class HtmlContentSanitizer:
    def sanitize_html(self, raw_html: str) -> SanitizedContent:
        parser = _SafeTextParser()
        parser.feed(raw_html)
        decoded = html.unescape(" ".join(parser.parts))
        invisible_count = len(INVISIBLE_RE.findall(decoded))
        if invisible_count:
            parser.risk_flags.append("invisible_unicode_removed")
            parser.removed_markers.append("invisible_unicode")
        safe_text = INVISIBLE_RE.sub("", decoded)
        safe_text = WHITESPACE_RE.sub(" ", safe_text).strip()
        return SanitizedContent(
            safe_text=safe_text,
            removed_markers=parser.removed_markers,
            risk_flags=sorted(set(parser.risk_flags)),
        )
