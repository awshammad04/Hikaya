# Heritage Guide Arabic Retrieval — Work Summary

## What was wrong

The Arabic question **"أين تقع حارة المسلمين؟"** ("Where is the Muslim Quarter?")
could be refused even though the reviewed content contained an answer. Arabic
tokenization and relevance matching were too weak, and the offline frontend answer
path did not reliably recognize Arabic location questions.

## What changed

### AI retrieval and answer behavior

- Added Arabic-aware normalization and token matching for alef, yaa and taa
  marbuta variants, diacritics, tatweel and common word forms.
- Replaced the previous keyword scoring with a dependency-free BM25 ranker, plus
  curated aliases and synonyms.
- Split reviewed content into section-level retrieval chunks with section,
  language and content-type metadata.
- Added global and cross-location routing for questions that name another reviewed
  place or do not specify a location.
- Added citations to guide responses with source location, section, content type,
  language, excerpt and references.
- Kept unsupported questions grounded: weak matches are refused rather than
  guessed. Arabic unsupported terms are also checked by the fact guard.
- Added Arabic-aware sentence splitting and question matching.
- Preserved legacy `Arabic Guide Text` sections and added support for named Arabic
  sections. Arabic location questions prefer the overview section.
- Kept religious tradition and oral-heritage content distinct from facts; religious
  traditions are explicitly attributed.

### Reviewed Arabic content

- Added Arabic retrieval passages based on reviewed location records and existing
  Arabic location copy for the Muslim, Christian, Armenian and Maghariba Quarters,
  Sheikh Jarrah, Silwan, At-Tur and Bab al-Amud.
- Organized passages under named sections, including `Arabic Overview`,
  `Arabic History`, `Arabic Importance`, `Arabic Landmarks` and, where applicable,
  `Arabic Religious Traditions`.
- Updated the Muslim Quarter Arabic overview with its reviewed route from Bab
  al-Amud toward Al-Aqsa.
- Updated content documentation to describe the optional Arabic section headings.

### Frontend and backend

- Updated the frontend offline Arabic guide fallback to recognize Arabic location
  questions and answer from reviewed Arabic summaries.
- Added citation presentation in the Heritage Guide UI.
- Passed citation information through the backend AI response mapping.
- Allowed guide requests without a preselected location for global routing.

## Files changed

### AI service and tests

- `ai/service/retrieval.py` — Arabic normalization, aliases, stemming and BM25.
- `ai/service/generator.py` — retrieval chunks, routing, ranking and citations.
- `ai/service/content_loader.py` — Arabic section heading mappings.
- `ai/service/fact_guard.py` — normalized Arabic fact checks.
- `ai/service/textutils.py` — Arabic sentence punctuation handling.
- `ai/service/models.py` — optional guide location and citation response fields.
- `ai/tests/test_guide_retrieval.py` — Arabic retrieval and grounding evaluation.
- `ai/api-contract.md` and `ai/README.md` — API and retrieval documentation.

### Content

- `content/ai-ready/muslim-quarter-summary.md`
- `content/ai-ready/christian-quarter-summary.md`
- `content/ai-ready/armenian-quarter-summary.md`
- `content/ai-ready/maghariba-quarter-summary.md`
- `content/ai-ready/sheikh-jarrah-summary.md`
- `content/ai-ready/silwan-summary.md`
- `content/ai-ready/at-tur-summary.md`
- `content/ai-ready/bab-al-amud-summary.md`
- `content/README.md`

### Frontend and backend

- `frontend/src/locationsData.ts`
- `frontend/src/services/api.ts`
- `frontend/src/components/HeritageChat.tsx`
- `frontend/src/types.ts`
- `backend/src/ai/ai.service.ts`
- `backend/src/ai/interfaces/generated-story.interface.ts`

## Verification

- AI test suite: **52 tests passed**, covering Arabic retrieval, unsupported
  question refusal, routing, citations and religious-tradition attribution.
- Earlier frontend lint and backend build validation passed after their contract
  changes.
- The Muslim Quarter example was checked in the browser in offline mode and
  returned the reviewed Arabic answer instead of the previous refusal.

Run the AI tests from the repository root on Windows:

```powershell
& 'C:\Users\User\AppData\Local\Programs\Python\Python311\python.exe' -m unittest discover -s ai/tests -p 'test_*.py'
```

## Remaining work and limitations

- No embedding model or vector database was added; retrieval remains a small,
  offline BM25 implementation.
- Arabic passages are partial reviewed guide text, not full Arabic translations
  of every section or every location record.
- The Arabic fact guard is a lexical heuristic, not a semantic correctness proof.
- The evaluation set is a regression suite, not a comprehensive human-reviewed
  quality benchmark.
