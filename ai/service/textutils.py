"""Small text helpers shared by the generator.

Step 3 of the narrative workflow (pre-processing / cleaning): strip the markdown
artefacts out of the reviewed summaries and split them into the pieces the
extractive generator reassembles.
"""

import re
from typing import List, Tuple

_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
_ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
_CODE_RE = re.compile(r"`([^`]+)`")
_ANGLE_URL_RE = re.compile(r"<https?://[^>]+>")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'(])")


def clean(text):
    # type: (str) -> str
    """Remove markdown syntax and normalise whitespace."""
    text = _ANGLE_URL_RE.sub("", text)
    text = _LINK_RE.sub(r"\1", text)
    text = _BOLD_RE.sub(r"\1", text)
    text = _ITALIC_RE.sub(r"\1", text)
    text = _CODE_RE.sub(r"\1", text)
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def split_sentences(text):
    # type: (str) -> List[str]
    """Split cleaned prose into sentences."""
    flat = re.sub(r"\s*\n\s*", " ", clean(text)).strip()
    if not flat:
        return []
    return [part.strip() for part in _SENTENCE_SPLIT_RE.split(flat) if part.strip()]


def bullet_items(section):
    # type: (str) -> List[str]
    """Top-level bullet lines of a section, cleaned and de-bulleted.

    Continuation lines (indented, or wrapped) are folded into the bullet above.
    """
    items = []  # type: List[str]
    for raw_line in section.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        if re.match(r"^[-*]\s+", line):
            items.append(clean(re.sub(r"^[-*]\s+", "", line)))
        elif items and line.startswith(" "):
            items[-1] = (items[-1] + " " + clean(line)).strip()
    return [item for item in items if item]


def table_rows(section):
    # type: (str) -> List[Tuple[str, str]]
    """Two-column markdown table rows, skipping the header and separator."""
    rows = []  # type: List[Tuple[str, str]]
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [clean(cell) for cell in stripped.strip("|").split("|")]
        if len(cells) < 2:
            continue
        if set(cells[0].replace(" ", "")) <= set("-:") and cells[0]:
            continue  # separator row
        if cells[0].lower() in ("period", "category", "reference", "asset", "asset / link"):
            continue  # header row
        rows.append((cells[0], cells[1]))
    return rows


def statements(text):
    # type: (str) -> List[str]
    """Break mixed markdown into self-contained statements.

    Table rows become "period: event", bullets become one statement each, and
    flowing prose is split into sentences. Used by the Heritage Guide so it
    retrieves readable claims instead of raw table syntax.
    """
    out = []  # type: List[str]
    prose_buffer = []  # type: List[str]

    def flush_prose():
        if prose_buffer:
            out.extend(split_sentences(" ".join(prose_buffer)))
            del prose_buffer[:]

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("###") or line.startswith("##"):
            flush_prose()
            continue
        if line.startswith("|"):
            flush_prose()
            cells = [clean(cell) for cell in line.strip("|").split("|")]
            if len(cells) < 2:
                continue
            if cells[0] and set(cells[0].replace(" ", "")) <= set("-:"):
                continue
            if cells[0].lower() in ("period", "category", "reference", "asset"):
                continue
            out.append(ensure_sentence("%s: %s" % (cells[0], cells[1])))
            continue
        if re.match(r"^[-*]\s+", line):
            flush_prose()
            out.append(ensure_sentence(clean(re.sub(r"^[-*]\s+", "", line))))
            continue
        if out and raw_line.startswith(" ") and not prose_buffer:
            # Wrapped continuation of the previous bullet.
            out[-1] = out[-1].rstrip(".") + " " + clean(line)
            continue
        prose_buffer.append(line)

    flush_prose()
    return [item for item in out if len(item) > 15]


def word_count(text):
    # type: (str) -> int
    return len([token for token in re.split(r"\s+", text.strip()) if token])


def trim_to_words(paragraphs, max_words):
    # type: (List[str], int) -> List[str]
    """Drop trailing units until the text fits the word ceiling.

    A paragraph that already has line breaks (a timeline block or a bullet list)
    is trimmed line by line and keeps its line breaks; flowing prose is trimmed
    sentence by sentence. Either way whole units are removed, so the narrative
    never ends mid-thought, and the first unit is always kept.
    """
    kept = []  # type: List[str]
    used = 0
    for paragraph in paragraphs:
        is_list = "\n" in paragraph.strip()
        if is_list:
            units = [line for line in paragraph.splitlines() if line.strip()]
            separator = "\n"
        else:
            units = split_sentences(paragraph) or [paragraph]
            separator = " "

        taken = []  # type: List[str]
        for unit in units:
            length = word_count(unit)
            if used + length > max_words and (kept or taken):
                break
            taken.append(unit)
            used += length

        # A list whose header survived but whose items did not is just noise.
        if is_list and len(taken) == 1 and taken[0].rstrip().endswith(":"):
            taken = []

        if taken:
            kept.append(separator.join(taken))
        if used >= max_words:
            break
    return kept


def ensure_sentence(text):
    # type: (str) -> str
    """Make a fragment read as a sentence."""
    text = text.strip()
    if not text:
        return ""
    if text[-1] not in ".!?":
        text += "."
    return text[0].upper() + text[1:]
