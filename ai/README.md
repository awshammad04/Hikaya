# AI Module

Turns reviewed Palestinian heritage content into simplified, engaging narratives,
and answers visitor questions from the same material.

Governorate scopes now cover all seven governorates: Jerusalem, Ramallah, Nablus,
Jericho, Bethlehem, Hebron and Gaza. Story requests accept `governorate_id`;
guide requests accept `governorate_ids` and `location_ids`.
`POST /generate-journey` returns one narrative plus the scoped stories and source
references. The original Jerusalem calls and factual safeguards remain available.
See [Palestine expansion](../docs/palestine-expansion.md) for the added content,
review boundaries and integration tests.

## The One Rule

**The AI module never invents historical facts.** It simplifies, rewrites,
reorganises and summarises reviewed content, and nothing else. If the material
needed to answer a request is not present, it says so instead of filling the gap.

Everything in this folder is built around enforcing that:

- content can only enter through `content/ai-ready/` (`content_loader.py`);
- unreviewed content is refused outright (`models.py`);
- religious traditions and oral heritage are kept separate from facts and must be
  attributed (`prompts.py`, and the content structure itself);
- output is checked for numbers and proper nouns that are absent from the source
  (`fact_guard.py`);
- gaps are reported as `uncertainty_notes` rather than filled.

## Quick Start

No installation, no API key, no network:

```bash
cd ai
python3 -m service.cli story muslim-quarter --audience student
python3 -m service.cli ask bab-al-amud "Which period built the present gate?"
python3 -m service.cli locations
```

Run the tests:

```bash
cd ai
python3 -m unittest discover -s tests -v
```

Run the HTTP service the backend talks to:

```bash
cd ai
python3 -m service.server --port 8001          # no dependencies
# or, with dependencies installed:
pip install -r requirements.txt
uvicorn service.app:app --port 8001
```

Then point the backend at it with `AI_SERVICE_URL=http://localhost:8001`.

## Two Generation Backends

| | Offline extractive (default) | Model backend |
|---|---|---|
| Enabled when | always | `ANTHROPIC_API_KEY` is set and `anthropic` is installed |
| How it writes | reassembles sentences taken from the reviewed summary | prompts a language model under the strict system prompt |
| Can it invent a fact? | No, by construction | No, by instruction — and the fact guard checks |
| Deterministic | Yes | No |
| Used for `ai/examples/` | Yes | — |

The model backend falls back to the extractive one on any failure — missing key,
network error, rate limit, empty reply. `model.provider` in the response always
says which one actually ran, so nobody has to guess.

This is why the feature works today with nothing installed, and gets better prose
the moment a key is available.

## Audience Modes

| Mode | Who it is for | Length |
|---|---|---|
| `student` | school or university, educational tone | 180–320 words |
| `tourist` | a visitor standing at the site | 160–300 words |
| `child` | roughly ages 8–11, simple sentences | 90–170 words |
| `short` | a summary of at most five sentences | 45–110 words |
| `historian` | a reader who knows the period; full chronology, no simplifying | 220–400 words |
| `general` | default balanced register | 150–280 words |

`child` mode additionally drops any material mentioning sieges, destruction, war
or killing, and records that it did so in the uncertainty notes — the history is
not hidden, it is just not in the child-facing text.

## Layout

```
ai/
├── README.md
├── narrative-generation-workflow.md   # the designed workflow (Sprint 1)
├── api-contract.md                    # JSON exchanged with the backend
├── requirements.txt                   # optional: FastAPI + anthropic
├── service/
│   ├── __init__.py                    # public surface: generate_story, answer_question
│   ├── models.py                      # request/response shapes, validation, error codes
│   ├── content_loader.py              # parses content/ai-ready/*.md
│   ├── audiences.py                   # the six modes + child-unsafe vocabulary
│   ├── prompts.py                     # system + per-request prompts
│   ├── generator.py                   # the story generation function
│   ├── fact_guard.py                  # post-generation check
│   ├── textutils.py                   # markdown cleaning and splitting
│   ├── retrieval.py                   # Arabic-aware tokenization and BM25 guide search
│   ├── llm.py                         # optional model backend
│   ├── app.py                         # FastAPI service
│   ├── server.py                      # dependency-free HTTP service
│   └── cli.py                         # command line
├── scripts/
│   ├── generate_examples.py           # regenerates ai/examples/
│   └── export_seed_data.py            # generates + validates the database, backend
│                                      # and frontend seeds from content/
├── examples/                          # sample stories, one per MVP location
├── tests/test_generator.py            # story and core guide tests
└── tests/test_guide_retrieval.py      # Arabic/English regression and 40-question eval
```

## Using It From Python

```python
from service import generate_story, StoryRequest

response = generate_story(StoryRequest(
    location_id="muslim-quarter",
    target_audience="tourist",
))

print(response.title)
print(response.narrative)
print(response.uncertainty_notes)   # what the source could not support
print(response.warnings)            # what the fact guard flagged, if anything
```

## Samples

`examples/` holds one generated sample per MVP location, plus short-mode and
historian-mode samples and a set of Heritage Guide questions. Each sample records the input location,
target audience, the generated story, and the notes about limitations and missing
information. They are regenerated, never hand-edited:

```bash
cd ai && python3 scripts/generate_examples.py
```

## Remaining Generation Features

- Full Arabic story generation. Guide retrieval supports reviewed Arabic
  excerpts where available, but not every location record has full Arabic source
  sections yet; story-generation output is still primarily English.
- Contribution analysis — summarising user submissions and suggesting a category
  before human review.

## The Heritage Guide's Offline Limits

Without a model configured, `ask-guide` uses Arabic-aware tokenization and
section-level BM25 search. It returns reviewed source sentences with section and
bibliography citations; normalization handles common alef/yaa/taa-marbuta
variants and diacritics. Unscoped questions route across reviewed locations,
while explicit geographic scopes remain isolated.

Questions that only partially match or ask about documented gaps such as current
opening conditions still receive a refusal. The regression evaluation includes
20 supported English/Arabic questions and 20 unsupported questions. Embeddings
are not required for the current corpus: BM25 avoids a large model download and
works offline. Full Arabic source sections and multilingual embeddings remain
future improvements for a reviewed-content pass.

A follow-up question is understood by folding the previous question into it. Earlier
turns are context for reading the question and never a source of facts - there is a
test asserting a fabricated previous answer cannot leak into a new one.
