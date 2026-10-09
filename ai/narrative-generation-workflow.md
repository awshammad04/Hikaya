# Hikaya — AI Narrative Generation Workflow

**Project:** Hikaya — Q GUIDE 2026
**Owners:** Software development team
**Sprint:** Sprint 1 — Technical Implementation & Task Assignment
**Folder:** `ai/`

---

## 1. Purpose

This document defines the algorithmic workflow used by the Hikaya AI module to convert
reviewed historical/cultural content into a simplified, engaging narrative, and (per the
updated AI direction) to power the **AI Heritage Guide** question-answering feature.

The AI module has two related capabilities in the MVP:

1. **Story Generation** — turn raw reviewed historical text into a short, engaging narrative.
2. **Heritage Guide Q&A** — answer simple user questions about a location using only the
   same reviewed content (no external knowledge, no invention).

Both share the same core rule below.

---

## 2. Golden Rule — No Hallucination

> **The AI must never invent, assume, or add historical facts that are not present in the
> reviewed source content provided by the Content Team.**

The AI's only allowed operations on historical facts are:
- Simplify
- Rewrite / rephrase
- Reorganize
- Summarize
- Select relevant excerpts to answer a question

If information needed to answer a question or complete a narrative is **not present** in
the provided content, the AI must say so explicitly rather than fill the gap — see
Section 5 (Fallback Behavior).

---

## 3. High-Level Workflow (Story Generation)

```
[1] INPUT RECEIVED
     |  Historical text + location metadata + target audience + language + tone
     v
[2] CONTENT VALIDATION
     |  Check the text is non-empty, tagged as "reviewed", and within length limits
     v
[3] PRE-PROCESSING / CLEANING
     |  Strip formatting artifacts, normalize whitespace, split into logical
     |  sections (e.g., origin, key events, cultural significance)
     v
[4] SIMPLIFICATION
     |  Reduce complexity of language based on target_audience
     |  (e.g., "children" -> short sentences, simple vocabulary)
     v
[5] NARRATIVE GENERATION (PROMPT TO LLM)
     |  Structured prompt (see Section 4) instructs the model to write a
     |  story using ONLY the supplied facts, in the requested tone/language
     v
[6] POST-PROCESSING / FACT-GUARD CHECK
     |  Lightweight check: does the generated text introduce named entities,
     |  dates, or claims not present in the source content?
     |  -> If yes: regenerate with stricter prompt, or flag "uncertain"
     v
[7] OUTPUT ASSEMBLY
     |  Package narrative + short summary + suggested title + any
     |  content warnings / uncertainty notes into the API Contract format
     v
[8] RETURN TO BACKEND
     |  Backend stores/serves the response to the Frontend
```

### Step-by-step detail

**Step 1 — Input Received**
The backend sends a JSON payload (defined in the API Contract document) containing the
reviewed historical text and generation parameters.

**Step 2 — Content Validation**
- Reject requests with empty or missing `historical_text`.
- Reject/flag content that isn't marked as reviewed (`is_reviewed: true` from backend).
- Enforce a maximum input length to avoid truncation issues.

**Step 3 — Pre-processing / Cleaning**
- Remove leftover markdown syntax, HTML tags, or stray whitespace from the source `.md`
  content files.
- Optionally segment the text into thematic chunks (history, culture, landmarks, oral
  stories) so the model can reference structure explicitly.

**Step 4 — Simplification**
- Adjust vocabulary and sentence length based on `target_audience`
  (e.g., `student`, `tourist`, `child`, `general`).
- This step can be merged into the prompt itself (see Section 4) rather than being a
  separate processing pass, depending on implementation.

**Step 5 — Narrative Generation**
- A structured prompt is sent to the language model. The prompt explicitly instructs the
  model to draw **only** from the supplied text.

**Step 6 — Post-processing / Fact-Guard Check**
- Basic heuristic check comparing named entities/numbers in the output against the input
  (can be manual/human review in MVP, automated later).
- If a discrepancy is detected, either regenerate the narrative with a stricter prompt or
  attach an `uncertainty_note` in the output.

**Step 7 — Output Assembly**
- Combine the final narrative with a short summary, a suggested title, and any warnings
  into the response JSON.

**Step 8 — Return to Backend**
- The backend receives the structured response and forwards relevant parts to the
  frontend for display (text, audio narration trigger, etc.).

---

## 4. Prompt Engineering Draft

### 4.1 System-level instruction (fixed, not user-editable)

```
You are the Hikaya AI Storyteller. Your task is to turn verified historical and
cultural content about Palestinian locations into a short, engaging narrative.

STRICT RULES:
1. Use ONLY the facts given in the "Source Content" section below.
2. Do NOT add names, dates, numbers, or events that are not explicitly stated
   in the Source Content.
3. If the Source Content does not contain enough information to answer a
   request, say so clearly instead of guessing.
4. Adjust tone and vocabulary to match the requested audience and tone.
5. Write in the requested language.
6. Keep the narrative respectful, culturally sensitive, and factually grounded.
```

### 4.2 User-level prompt template (populated per request)

```
Location: {location_name}
Target Audience: {target_audience}
Language: {language}
Tone: {story_tone}

Source Content (reviewed, use only this):
"""
{historical_text}
"""

Task: Write a short narrative (150–300 words) that brings this location's
history to life for the target audience, in the requested tone and language.
Then provide:
- A one-sentence summary
- A suggested title
- Any uncertainty notes if the source content leaves gaps
```

### 4.3 Heritage Guide Q&A prompt template

```
You are the Hikaya AI Heritage Guide for {location_name}.
Answer the user's question using ONLY the Source Content below.
If the answer is not contained in the Source Content, respond that this
information is not available yet, rather than guessing.

Source Content:
"""
{historical_text}
"""

User Question: {user_question}
```

---

## 5. Fallback / Uncertainty Behavior

| Situation | AI Behavior |
|---|---|
| Source content is missing or empty | Return an error response (see API Contract) — do not generate a narrative |
| Source content doesn't answer the user's question | Return a polite "not available in current records" message |
| Model output seems to introduce unsupported facts | Flag with `uncertainty_note`, or regenerate with a stricter prompt |
| Requested language not supported yet | Return error code `unsupported_language` and fall back to Arabic/English default |

---

## 6. Content Simplification Levels (for Story Personalization)

| Audience | Style Guidance |
|---|---|
| `child` | Very short sentences, simple vocabulary, gentle tone, no complex political/historical context |
| `student` | Clear educational tone, some context and explanation, moderate length |
| `tourist` | Engaging, descriptive, practical (what to notice/see), moderate length |
| `general` | Balanced, accessible tone suitable for all readers |

---

## 7. Relation to Other Planned AI Features (Future Work, not MVP)

- **Contribution Analysis**: summarizing user-submitted stories and suggesting categories
  before human review — will reuse the same "simplify, don't invent" pipeline.
- **Story Personalization**: extending Section 6 into fully dynamic tone/audience presets.

These are noted for context but are **out of scope** for Sprint 1 deliverables.

---

## 8. Deliverable Format

This document is submitted as Markdown documentation (per Sprint 1 requirements) and
should be pushed to the `ai/` folder on the branch `ai-workflow`, with a descriptive
commit such as:

```
Add AI narrative workflow
```
