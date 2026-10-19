# Hikaya — Experience Improvements

What was built in response to the improvement ideas document, what was
deliberately done differently, and what was not built.

Every item below is working against the live API and was driven in a browser,
not just compiled.

---

## 1. Home Page

| Idea | Built | Notes |
|---|---|---|
| Improve the hero section: texture, clear CTA | Yes | Tatreez-inspired dot texture behind the hero, three calls to action: *Explore the map*, **Ask Hikaya**, *Share a memory*. |
| Featured story of the day / "On This Day" | Partly — see below | Built as **Story of the day**, not "On this day". |
| Better location cards | Yes | Each card shows stories, timeline entries, photographs, published memories, an estimated reading time, and its categories. |
| Use real images | Yes | 64 verified photographs of the actual Jerusalem sites replace stock imagery. |

### Why "Story of the day" and not "On this day"

"On this day" promises an anniversary. The reviewed content dates events to a
year at best — `1981`, `638 CE`, `2nd millennium BCE` — and never to a day. To
show "on this day in history" the platform would have to invent a precision the
records do not have, which is the one thing this project does not do.

So the feature keeps the intent — a reason to come back, something new each
visit — and drops the false claim. `GET /api/v1/stories/featured` rotates
through published stories by days-since-epoch, which means everybody sees the
same story on a given day and a different one tomorrow. Deterministic, so it can
be linked to and talked about.

### Real images

`content/media/media.json` holds 64 photographs from Wikimedia Commons, each one
checked visually against a contact sheet before being added, and each carrying
its credit, licence, capture date and source URL. They include Library of
Congress Matson Collection photographs of Jerusalem alongside modern views of the
same gates, quarters, streets and sacred sites.

Credit and licence are displayed with every image in the gallery and are
required by the export script: an entry missing either one fails the build
rather than being shown uncredited.

---

## 2. Map Experience

| Idea | Built | Notes |
|---|---|---|
| Better interactive map (Mapbox / MapLibre) | Partly | Improved the existing keyless map instead — see below. |
| Interactive timeline per location | Yes | Own tab on the location page, generated from the content files. |
| Before / after slider | Yes | Only where the archive holds a genuine pair. |
| Map legend and filters | Yes | Filter by category, colour-coded markers, legend, visited markers. |

### Why not Mapbox or MapLibre

Both need a tile source, and the usable ones need an API key. That would make
the map the only part of Hikaya that stops working without an account — on a
project whose whole setup story is "clone it and it runs". The existing map was
improved instead: markers now come from the API rather than a hard-coded list,
they carry category colours with a legend, filters narrow the set, and visited
sites are ticked. Zoom, pinch, pan, route fitting and inverse-scaled labels keep
dense routes legible without sacrificing offline use.

Swapping in a tile provider later is a change to one component.

### Before / after

Shown only where the archive has a historical photograph **and** a present-day
one **of the same subject**. Bab al-Amud has that pair for the gate façade — a
Matson Collection view against a verified modern photograph. Other pages say
that no pair is available rather than sliding between unrelated scenes.

---

## 3. AI Features

| Idea | Built | Notes |
|---|---|---|
| Interactive story generation (Audience → Style → Generate) | Yes | Three steps; audience gets a screen of its own. |
| Typing animation | Yes | Word-at-a-time reveal, with a "show it all" escape. |
| AI chat assistant | Yes | Per-location, with conversational follow-ups. |
| Story modes: Student, Tourist, Child, Historian | Yes | Plus *In brief* and *Anyone*. |
| Transparency about sources | Yes | A panel on every generated story. |

The transparency panel presents human-readable public bibliography rather than
repository paths, identifies which engine wrote the text, records what the
records do not cover, and whether a copy went to the review queue. Fact-guard
warnings appear separately, in red, marked for review — never mixed into the
story.

Follow-up questions work because the conversation travels with the request: the
AI module folds the previous question into a short follow-up like "and when?"
before searching. Earlier turns are context for understanding the question and
are never treated as a source of facts — there is a test for exactly that.

---

## 4. Immersive Experience

| Idea | Built | Notes |
|---|---|---|
| Natural and offline narration | Yes | Streamed natural voice with caching, plus an explicit device-voice option. |
| Ambient sounds | No | See below. |
| Smooth animations | Yes | Motion throughout, honouring `prefers-reduced-motion`. |
| Skeleton loading | Yes | Skeletons mirror the shape of what replaces them. |

Natural narration streams audio as soon as the first packet arrives and caches
successful results on disk for repeat visits. The device voice remains available
without a network or API key. Word-by-word highlighting was deliberately removed
because natural speech does not expose reliable timestamps; the text remains stable
instead of showing a misleading tracker.

**Ambient sounds were not built.** Bells, birdsong and wind for a specific place
need real recordings, licensed and attributed like the photographs are. Synthetic
noise standing in for a specific Jerusalem street would be exactly the kind of
plausible invention the rest of the platform refuses. It belongs with the media
upload work.

---

## 5. Location Page

| Idea | Built |
|---|---|
| Tabs: Story, Historical Facts, Timeline, Gallery, Memories | Yes — Story, Ask, Timeline, Gallery, Quiz, Memories |
| Gallery | Yes, with lightbox, keyboard control, and per-image credit |
| Related locations | Yes, by shared category |
| Historical timeline | Yes, visual, with tradition-based entries flagged |

The timeline marks which entries rest on religious or oral tradition rather than
documented history — two of Jerusalem's thirteen — and says so above the list.
They are flagged, not removed: the tradition is part of the record.

---

## 6. Community Features

| Idea | Built | Notes |
|---|---|---|
| Contribution wizard instead of one form | Yes | Place → Memory → Media → You. |
| Support media upload | Partly | Links, not uploads — see below. |
| Review status | Yes | Reference code plus a lookup. |

Every submission returns a code like `HK-7Q4M2X`. Contributions are anonymous by
design, so without it the review queue would be a place memories go and are never
heard from again. `GET /contributions/status/:code` returns the status, a
plain-language explanation, and the reviewer's note once there is a decision.

**Media is a URL, not an upload.** Hikaya has no file storage yet. Accepting
uploads it cannot keep would lose people's photographs, which is worse than
asking for a link to something already online.

---

## 7. Gamification

| Idea | Built | Notes |
|---|---|---|
| Visited locations tracker | Yes | `localStorage`, never sent to the server. |
| Progress percentage | Yes — with different wording | See below. |
| Heritage quiz with badges | Yes | 5 questions per location, each citing its source. |
| Random story button | Yes | "Surprise me" on the home page. |

The tracker counts **locations in the eight-place Jerusalem guide opened**, not a
percentage of the city itself. The souvenir separately records quizzes,
narrations and oral memories actually opened.

Quiz answers show the explanation *and* where in the reviewed content the answer
comes from. A quiz that only says "correct" is asking to be trusted.

---

## 8. Creative Ideas

| Idea | Built | Notes |
|---|---|---|
| Memory constellation | Yes | `/constellation` — locations, shared themes, attached memories. |
| Walking tour | Yes | Offered when you are within 2 km of a documented site. |
| "Hikaya doesn't know" | Yes | Woven into the guide. |
| Family heritage map | No | Needs accounts; see gaps. |

**The constellation** draws real relationships — a shared category, a memory
attached to a place — so the gaps are informative: a site with nothing orbiting
it is one nobody has written about yet.

**The walking tour** reads your position only after an explicit tap, computes the
distance in the browser, and sends nothing anywhere. If you are not near
anything, it says so instead of inventing a reason to send you somewhere.

**"Hikaya doesn't know"** was already the backend's behaviour; this makes it a
visible part of the experience. When the records cannot answer, the guide says
so and invites you to add what you know, with a link straight to the contribution
form for that location. An unanswered question is a gap in the archive, and the
person asking may be the one who can close it.

---

## 9. Three Bugs Found by Actually Using It

Each of these compiled, type-checked and looked correct in review. All three were
found by driving the interface.

**The before/after slider compared 1925 to 1940.** The photograph chosen as
"now" was a 1940 Hans Pinn shot; its date was in the metadata and was not read
carefully enough. Fixed with a 2025 photograph, and the export script now refuses
to build a pair whose declared era contradicts its capture date, or whose halves
show different subjects.

**Both wizards froze.** `AnimatePresence mode="wait"` never finished the exit
animation, so the next step never mounted — while the step indicator advanced,
because that reads state directly. The UI showed step 1 and thought it was on
step 2. Replaced with a keyed entrance animation, which cannot get stuck.

**The guide answered a question it should have refused.** "What is the best
falafel shop here?" returned the list of city gates, because *best* appears in
*best known*. The retriever now requires most of a question's content words to
appear in the records before it answers at all.

---

## 10. What Is Still Missing

- **No editor review interface.** Status columns, filtered queries and the
  contributor-facing lookup all exist; approving something is still an `UPDATE`.
- **No Arabic output.** The source content is Arabic; the summaries and
  generator are English-only. `language: "ar"` returns `unsupported_language`.
- **No accounts**, so no family heritage map and no per-person history beyond
  what `localStorage` holds.
- **No media storage**, so no uploads and no ambient audio.
- **The offline guide is a keyword retriever.** It never invents — it selects
  sentences that exist in the source — but with no model configured it can still
  return a loosely-related passage. It reports when only part of a question
  matched.

---

## 11. Where Things Live

```
content/media/media.json          verified photographs, credits and licences
content/quiz/quiz.json            quiz questions and their sources
ai/scripts/export_seed_data.py    generates the three seeds, and validates them
database/seed-generated.sql       PostgreSQL rows
backend/.../generated-data.ts     in-memory repository seed
frontend/.../generatedMockData.ts frontend offline fallback
```

The timeline, gallery and quiz have to exist in three places for the system to
work offline at every layer. Written by hand they would drift, and the frontend
would eventually show a "sample" timeline that contradicted the real one. So the
content team edits content, and one script regenerates all three — with
validation that catches the class of error described in section 9.
