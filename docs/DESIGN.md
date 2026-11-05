# Design rationale

Omni Feyn is a personal tool for learning a topic to a chosen depth, explaining it out loud,
and measuring the explanation. This document records the design decisions and the sources
behind them. Research was done on 2026-11-05.

## 1. Starting point: Luyen Tri on chongnaotan.com

The "Luyen Tri" module of chongnaotan.com (fetched 2026-11-05) is a single-page drill:
pick a random Vietnamese topic from a categorised bank, start a timer (1 minute for reflex, up to
60 minutes for "thinking deep"), speak immediately following P.R.E.P, see keyword hints and a
sample answer, and keep the last recording. It also groups prompts by "L.I.F.E" storytelling
pillars and knowledge categories and lets the user save favourites.

What we keep: zero-friction random prompt, keyboard shortcuts (Space to shuffle, Enter to start),
visible timer, P.R.E.P scaffold, local-only storage.

What we add: depth beyond reflex speaking (one day, one week, weeks to months), a place to
collect sources and notes, a measurable score per attempt, and a review schedule. The goal is the
workflow of a creator who reads for months before explaining a topic on video, not only a
one-minute reflex.

## 2. Learning model: Feynman technique as the backbone

University study guides describe the technique in four steps: choose a concept, explain it simply
as if teaching a beginner, identify the gaps where you get stuck, return to the sources and
simplify, then repeat.

- University of York, "The Feynman Technique": https://subjectguides.york.ac.uk/study-revision/feynman-technique
- Kansas State University, "Feynman Technique": https://www.k-state.edu/aac/success-tools/collection/feynman_technique.html
- Purdue Global, "Success with the Feynman Technique" (2024-11-08): https://purdueglobalwriting.center/2024/11/08/success-with-the-feynman-technique/

Decisions:

- Each topic moves through four stages: Explore (collect sources, set the core question),
  Understand (read, extract key points, note open questions), Explain (speak it simply, find gaps),
  Review (spaced re-explanation). The stage bar is clickable, not enforced.
- A topic always has one core question. A single question keeps long research focused.
- "Open questions" is the explicit gap list from step 3 of the technique; they can be ticked off.
- The speaking scaffold has a "Feynman" mode: simple explanation, why, analogy, own gaps.
  The metrics look for markers of each (for example "nói đơn giản là", "giống như", "vì sao")
  and flag very long sentences as a sign of jargon-heavy explanation.

## 3. Depth levels

| Depth | Default target | Typical use |
| --- | --- | --- |
| 1 minute | 60 s | Random prompt from the bank, P.R.E.P, reflex |
| 1 day | 3 min | A few sources, key points, one explanation |
| 1 week | 5 min | Structured reading with a log |
| Deep dive | 10 min | Weeks to months: reading log, milestones, repeated explanations |

Deep-dive topics are created with four default milestones (overview and questions, primary
sources, one-page outline, 10-minute explanation without notes). The reading log records date,
minutes, optional source and a one-line note, and shows total minutes and distinct days, which is
the honest measure of "how much did I actually read".

Sources follow research-note practice: every source has a status (to read, reading, done) and its
own note field for the user's own words. This borrows the core idea of the Zettelkasten and
"progressive summarisation" families of tools (write notes in your own words, attached to where
they came from) without their graph complexity, which is overkill for a single-topic workspace.

## 4. Speaking structure: P.R.E.P

P.R.E.P (Point, Reason, Example, Point) is the default for 1-minute prompts, matching the
inspiration site. During recording the scaffold highlights the current part on a time budget of
15 / 30 / 35 / 20 percent of the target, so the speaker knows when to move on. After recording,
a marker search checks that each part appears and that the closing point is in the second half.

## 5. Speech metrics (no LLM)

Commercial coaches (Yoodli, Orai) report pace, filler words, pauses and duration. Their published
guidance is used as defaults:

- Pace: conversational range 115 to 180 words per minute; 120 to 160 when presenting; above 170
  starts to feel rushed. Yoodli, "Manage your speaking pace": https://yoodli.ai/blog/yoodli-weekly-tip-slow-down ;
  Orai, "Speech Timer": https://orai.com/tools/speech-timer/
- Fillers: under 3 percent of words is normal. Yoodli, "Reduce um filler words":
  https://yoodli.ai/blog/yoodli-skill-reduce-um-filler-words

Vietnamese is counted in syllables (each written token is one syllable), so the target band is set
to 120 to 190 syllables per minute. This is a heuristic, not a validated norm; it is a constant
(`PACE_RANGE`) and easy to tune.

Metrics and their weights in the 0 to 100 score:

| Metric | Weight | How |
| --- | --- | --- |
| Pace | 20 | syllables / minute, full marks inside the band |
| Fillers | 20 | Vietnamese and English filler list, longest phrase first so "kiểu như" is not also counted as "kiểu"; tones are kept so "à" is a filler but "a" and "ạ" are not |
| Long pauses | 15 | silent runs of 1.5 s or more inside the speech, from frame RMS energy with an adaptive threshold; Whisper timestamps as fallback |
| Duration | 10 | 85 to 110 percent of target is full marks |
| Structure | 10 | P.R.E.P or Feynman markers |
| Key point coverage | 25 | only when the topic has key points; content words after stopword removal, diacritic-insensitive, exact match for short syllables, edit-distance tolerance only for long tokens (Vietnamese syllables like "cong" and "con" differ by one letter) |

The score card states clearly that it measures delivery, not correctness. Reasoning quality is
handled by the "Copy for review" bundle (below).

## 6. Transcription: Whisper in the browser

- transformers.js runs ONNX Whisper in the browser; WebGPU via `device: "webgpu"`, WASM otherwise.
  Hugging Face, "Running models on WebGPU": https://huggingface.co/docs/transformers.js/guides/webgpu
- `navigator.gpu` existing is not enough; pick WebGPU only if `requestAdapter()` returns an adapter,
  run in a Web Worker, and pass `chunk_length_s: 30` or only the first 30 seconds are transcribed.
  OpenReplay blog, "Adding captions to a video with AI in the browser": https://blog.openreplay.com/add-video-captions-ai-browser/
- Mixed precision on WebGPU (fp32 encoder, q4 decoder) and q8 on WASM, plus a WASM retry if the
  WebGPU model fails to initialise, follow the pattern described in "Building Browser-Based
  Transcription: Workers, Cancellation, and Honest Progress" (DEV Community):
  https://dev.to/flowpick/building-browser-based-transcription-workers-cancellation-and-honest-progress-4b3o

Default model is `onnx-community/whisper-base` (multilingual), with tiny and small selectable.
Download progress is shown and files are cached by the browser Cache API, so later runs are offline.
Web Speech API is offered as an optional live engine and labelled as sending audio to the browser
vendor. The transcript is always editable before scoring, because ASR errors would otherwise
distort filler and coverage counts.

## 7. Spaced review

Spaced retrieval beats massed practice strongly (meta-analysis of 29 studies, g = 0.74). Expanding
versus uniform intervals shows no overall difference, but expanding helps when there are more
retrieval sessions and gives better average recall during the training period.

- Latimier, Peyre, Ramus, "A Meta-Analytic Review of the Benefit of Spacing out Retrieval Practice
  Episodes on Retention", Educational Psychology Review (2021): http://www.lscp.net/persons/ramus/docs/EPR20.pdf
- Kang, Lindsey, Mozer, Pashler, "Effectiveness of expanding vs equal-interval retrieval practice"
  (2011): https://tdlc.ucsd.edu/SV2012/Pubs/KangLindseyMozerPashler2011.pdf

Decision: an expanding schedule of 1, 3, 7, 21, 60 days. A review attempt scoring 70 or more moves
up one step, below 50 resets to 1 day, otherwise the interval repeats. "Due today" is the first
block on the home screen. Only the first scored attempt on a due day counts.

## 8. Copy for review

The deep check of reasoning needs a capable reviewer, which this app deliberately does not embed.
"Copy for review" builds a Markdown bundle: topic, depth, stage, core question, key points, open
questions, sources with notes, transcript, metrics, and five explicit review requests (errors,
weak reasoning, missing ideas, three hard follow-up questions, one better analogy). It is
designed to paste directly into an assistant chat.

## 9. Interface

- Light and airy: warm off-white background, white cards with soft shadow and 18 px radius,
  one solid accent (deep sage), terracotta only for recording, a muted colour per depth level.
- System font stack (no web font download, good Vietnamese glyph coverage on all platforms).
- Mobile first: one column under 860 px, sticky compact header with scrollable nav, large record
  button and timer ring.
- Recording view shows a progress ring, a live level meter and the current scaffold step, so the
  speaker can look away from the text.
- Respects `prefers-reduced-motion`.

## 10. Architecture

Vite and TypeScript, no UI framework. Pure logic (metrics, review schedule, Markdown bundle, text
normalisation) lives in `src/core` and is unit tested with the Node test runner. Data is stored in
IndexedDB (topics, attempts, audio blobs, settings) with JSON export and import (audio optional,
as data URLs). No backend, no accounts, no analytics.
