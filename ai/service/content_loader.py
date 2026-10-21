"""Loads the reviewed, AI-ready content summaries from ``content/ai-ready/``.

This is the only door through which facts enter the AI module. If a location has
no reviewed summary, generation fails with ``unknown_location`` rather than
falling back to whatever the model happens to know.

The summaries follow the fixed layout documented in ``content/README.md``:
YAML-ish frontmatter, ten numbered ``## n. Title`` sections, and optional
reviewed Arabic retrieval sections. The parser is deliberately small and
dependency-free (no PyYAML) so the core module runs on a plain Python install.
"""

import os
import re
from typing import Dict, List, Optional

# Repository root, resolved from this file: ai/service/content_loader.py
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONTENT_DIR = os.path.join(_REPO_ROOT, "content", "ai-ready")

# Maps the numbered section headings in the summary files to stable keys.
_SECTION_KEYS = {
    "short overview": "overview",
    "key historical timeline": "timeline",
    "cultural and religious importance": "importance",
    "main landmarks": "landmarks",
    "important facts": "facts",
    "religious traditions": "traditions",
    "oral heritage and popular stories": "oral_heritage",
    "source notes": "source_notes",
    "visitor walkthrough": "walkthrough",
    "reviewed references": "references",
    "arabic guide text": "arabic_guide",
    "arabic overview": "arabic_overview",
    "arabic history": "arabic_history",
    "arabic historical context": "arabic_history",
    "arabic importance": "arabic_importance",
    "arabic landmarks": "arabic_landmarks",
    "arabic religious traditions": "arabic_traditions",
}

_HEADING_RE = re.compile(r"^##\s+(?:\d+\.\s*)?(.+?)\s*$")
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


class ReviewedContent(object):
    """One parsed AI-ready summary file."""

    def __init__(self, meta, sections, raw, path):
        # type: (Dict[str, str], Dict[str, str], str, str) -> None
        self.meta = meta
        self.sections = sections
        self.raw = raw
        self.path = path

    # -- metadata helpers ---------------------------------------------------

    @property
    def location_id(self):
        # type: () -> str
        return self.meta.get("location_id", "")

    @property
    def name(self):
        # type: () -> str
        return self.meta.get("name", self.location_id)

    @property
    def arabic_name(self):
        # type: () -> str
        return self.meta.get("arabic_name", "")

    @property
    def source_file(self):
        # type: () -> str
        return self.meta.get("source_file", "")

    @property
    def is_reviewed(self):
        # type: () -> bool
        return str(self.meta.get("reviewed", "false")).strip().lower() == "true"

    @property
    def repo_path(self):
        # type: () -> str
        """Path relative to the repository root, for reporting back to the backend."""
        return os.path.relpath(self.path, _REPO_ROOT).replace(os.sep, "/")

    @property
    def governorate_id(self):
        return self.meta.get('governorate_id', 'jerusalem')

    # -- section helpers ----------------------------------------------------

    def section(self, key, default=""):
        # type: (str, str) -> str
        return self.sections.get(key, default)

    def factual_text(self):
        # type: () -> str
        """The sections the AI may state as fact.

        Religious traditions and oral heritage are deliberately excluded: they
        are available through :meth:`tradition_text` and must always be
        attributed rather than asserted.
        """
        keys = ("overview", "timeline", "importance", "landmarks", "facts", "walkthrough")
        return "\n\n".join(self.sections.get(k, "") for k in keys if self.sections.get(k))

    def tradition_text(self):
        # type: () -> str
        keys = ("traditions", "oral_heritage")
        return "\n\n".join(self.sections.get(k, "") for k in keys if self.sections.get(k))

    def prompt_text(self):
        # type: () -> str
        """Everything the model is allowed to see, with the labels intact."""
        parts = []
        for key, label in (
            ("overview", "OVERVIEW"),
            ("timeline", "HISTORICAL TIMELINE (facts)"),
            ("importance", "CULTURAL AND RELIGIOUS IMPORTANCE (facts)"),
            ("landmarks", "MAIN LANDMARKS (facts)"),
            ("facts", "IMPORTANT FACTS (facts)"),
            ("traditions", "RELIGIOUS TRADITIONS (attribute, never assert as fact)"),
            ("oral_heritage", "ORAL HERITAGE (attribute, never assert as fact)"),
            ("walkthrough", "VISITOR WALKTHROUGH (reviewed spatial and sensory guidance)"),
            ("source_notes", "SOURCE NOTES (includes gaps you must not fill)"),
            ("references", "REVIEWED BIBLIOGRAPHY (provenance only, not new facts)"),
        ):
            body = self.sections.get(key)
            if body:
                parts.append("### %s\n%s" % (label, body))
        return "\n\n".join(parts)

    def known_gaps(self):
        # type: () -> List[str]
        """The 'Gaps the AI must not fill' bullet from the source notes.

        Bullets wrap across several lines in the summary files, so the whole
        bullet is folded back together before it is returned.
        """
        from . import textutils

        return [
            item
            for item in textutils.bullet_items(self.sections.get("source_notes", ""))
            if "must not fill" in item.lower()
        ]


def _parse_frontmatter(text):
    # type: (str) -> Dict[str, str]
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}
    meta = {}
    for line in match.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta


def _strip_frontmatter(text):
    # type: (str) -> str
    match = _FRONTMATTER_RE.match(text)
    return text[match.end():] if match else text


def _parse_sections(body):
    # type: (str) -> Dict[str, str]
    sections = {}  # type: Dict[str, List[str]]
    current = None  # type: Optional[str]
    for line in body.splitlines():
        heading = _HEADING_RE.match(line)
        if heading:
            title = heading.group(1).strip().lower()
            # Drop any trailing parenthetical, e.g. "(NOT historical fact)".
            title = re.sub(r"\s*\(.*\)\s*$", "", title)
            current = _SECTION_KEYS.get(title)
            if current:
                sections[current] = []
            continue
        if current and current in sections:
            sections[current].append(line)
    return dict(
        (key, "\n".join(lines).strip()) for key, lines in sections.items()
    )


def parse_summary(text, path=""):
    # type: (str, str) -> ReviewedContent
    meta = _parse_frontmatter(text)
    sections = _parse_sections(_strip_frontmatter(text))
    return ReviewedContent(meta=meta, sections=sections, raw=text, path=path)


def summary_path(location_id, content_dir=None):
    # type: (str, Optional[str]) -> Optional[str]
    """Find the summary file whose frontmatter declares this ``location_id``."""
    directory = content_dir or CONTENT_DIR
    if not os.path.isdir(directory):
        return None
    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".md") or filename.lower() == "readme.md":
            continue
        path = os.path.join(directory, filename)
        with open(path, "r", encoding="utf8") as handle:
            head = handle.read(2048)
        meta = _parse_frontmatter(head)
        if meta.get("location_id") == location_id:
            return path
    return None


def load(location_id, content_dir=None):
    # type: (str, Optional[str]) -> Optional[ReviewedContent]
    """Load the reviewed summary for a location, or ``None`` if there is none."""
    path = summary_path(location_id, content_dir)
    if not path:
        return None
    with open(path, "r", encoding="utf8") as handle:
        text = handle.read()
    return parse_summary(text, path=path)


def available_locations(content_dir=None):
    # type: (Optional[str]) -> List[Dict[str, str]]
    """List every location that has a reviewed summary on disk."""
    directory = content_dir or CONTENT_DIR
    found = []
    if not os.path.isdir(directory):
        return found
    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".md") or filename.lower() == "readme.md":
            continue
        with open(os.path.join(directory, filename), "r", encoding="utf8") as handle:
            meta = _parse_frontmatter(handle.read(2048))
        if meta.get("location_id"):
            found.append(
                {
                    "location_id": meta["location_id"],
                    "governorate_id": meta.get("governorate_id", "jerusalem"),
                    "name": meta.get("name", ""),
                    "file": filename,
                    "reviewed": meta.get("reviewed", "false"),
                }
            )
    return found
