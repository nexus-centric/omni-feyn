# Omni Feyn

Learn any topic at the depth you choose, explain it out loud, and measure the explanation.
Runs entirely in the browser: no server, no account, speech-to-text on your own device.
The interface is in Vietnamese.

Inspired by the "Luyen Tri" and "Luyen Than" pages of chongnaotan.com: pick a random topic (or write
your own), then go as deep as you want, from a one-minute reflex answer to a months-long deep dive
using the Feynman technique.

## Features

- Explore ("Khám phá"): pick a random subject at every depth with "Chọn ngẫu nhiên": 1 minute
  (258 prompts), 1 day (152 subjects), 1 week (91 subjects) and Deep dive (64 big subjects), 565 in
  total across 15 categories. Most of it covers technology, DevOps, economics and finance,
  psychology, phenomena and curiosities, and books (real titles and authors). Other areas
  (science, history, world, society, culture and arts, education, work, environment) are still
  covered at every depth. "Tất cả" draws favour the main areas (about 65% of draws). Debated research
  findings are labelled "Còn tranh luận". Category filter, no repeats until a pool is used up, "Chọn chủ đề
  khác" to pick again, and "Bắt đầu tìm hiểu" (or "Bắt đầu luyện nói" for 1-minute prompts) turns
  the pick into a tracked topic. A short, quiet shuffle animation with optional sound. Manual topic
  creation is still available.
- Every built-in subject, including all 258 one-minute prompts, has a Vietnamese and an English
  title, shown on the result, the shuffle card, topic lists, the topic page and in Copy for review.
  Custom topics can have an optional English title written by the user; nothing is machine
  translated.
- The subject is the assignment; everything else is optional. A drawn subject comes with a
  collapsed "optional suggestions" panel: a possible starting question, a few possible angles,
  English and Vietnamese search terms (labelled as searches, not sources), and for some subjects a
  small number of link-checked starting sources. Accepting a subject does not set a question or
  create milestones; the user can copy a suggestion in, add a suggested source, or hide the panel.
- Every day/week/deep subject has an English name and English search terms, including the
  Vietnamese history subjects, so the user can research in English.
- Planning estimate per subject: active effort hours (by depth and a per-subject complexity
  rating) kept separate from a calendar window derived from an explicit, editable pace (minutes per
  session, sessions per week). Shown on the explore result and the topic page, editable, and labelled
  as an editorial estimate, not a validated norm or a deadline.
- Topic workspace: optional core question and personal direction, current understanding, notes
  split into "backed by sources" and "my interpretation, assumptions, uncertainties", sources with
  status and notes, my own questions, optional key points, a stage the user sets freely, reading
  log and optional milestones.
- Optional two-step guidance per topic, collapsed by default: Phân tích (Analyze), an issue tree
  (MECE) plus one lens that fits the topic (SWOT for decisions, cause and effect for phenomena,
  claim, evidence and counterargument for debated findings, key ideas and application for books),
  then Trình bày (Present): PREP for 1 minute, main point plus branches for 1 day, branch by branch
  for 1 week and Deep dive.
- Speaking practice: target timer with progress ring, optional P.R.E.P, branch-by-branch or Feynman
  scaffold that highlights the current part, in-browser recording (MediaRecorder), playback, history per topic.
- Transcript: Whisper through transformers.js in a Web Worker. Auto model choice:
  whisper-large-v3-turbo (q4, about 760 MB) on WebGPU, PhoWhisper-small (Vietnamese fine-tune, q8,
  about 249 MB) on CPU/WASM, with automatic fallback. Whisper small and base selectable. Language
  forced to Vietnamese unless changed. Download progress, browser cache, clear-cache button.
  Optional Web Speech API live transcript (sends audio to the browser vendor). Transcript is editable.
- Delivery metrics without any AI model: pace, filler words, long pauses, duration versus target,
  plus two clearly labelled heuristics (structure phrase detection and key point keyword overlap).
  The aggregate is called a delivery score and is not presented as a measure of understanding.
- Copy for review: a Markdown bundle with the subject, direction, current understanding, sourced
  notes versus interpretation and assumptions, open questions, sources, transcript and delivery
  metrics with an explanation of what they do and do not measure.
- Optional spaced review on 1, 3, 7, 21, 60 days with a "due today" list.
- Luyen Than: a default weekly schedule for a beginner (three non-consecutive strength days, two
  moderate cardio days, one mobility day, one rest day), editable per weekday with warnings, a
  today panel, a same-zone same-level swap for each move, interval timer, 14-day history kept
  separate from research progress. Not medical advice; no calorie estimates.
- IndexedDB storage, JSON backup export and import (audio optional, workout sessions, weekly
  schedule and level included), installable web app manifest. Older saved topics load unchanged.

See [docs/DESIGN.md](docs/DESIGN.md) for the design rationale and sources.

## Quick start

```bash
nvm use        # Node 24
npm ci
npm run dev    # http://localhost:5173
```

Other scripts:

| Script | Purpose |
| --- | --- |
| `npm test` | Unit tests for metrics, normalisation, review schedule, bundle, topic bank integrity, bilingual duplicates, category balance, weighted no-repeat draws, guidance lens selection and workout draws |
| `npm run build` | Type check and production build into `dist/` |
| `npm run preview` | Serve the production build |
| `node scripts/asr-bench.mjs [model ...]` | Transcribe the fixture with several Whisper models in headless Chromium (WASM) and report WER |
| `npm run screenshots` | End-to-end run in headless Chromium (fake microphone, real Whisper on WASM) and screenshots into `screenshots/`; run `npm run build` and `npx playwright install chromium` first |

## Deploy to GitHub Pages

1. Push to a GitHub repository, branch `main`.
2. Settings, Pages, Source: GitHub Actions.
3. The workflow `.github/workflows/pages.yml` tests, builds with `VITE_BASE=/<repo-name>/` and deploys.

Actions are pinned by commit SHA; Dependabot updates npm packages and actions weekly.

## Privacy

Everything is stored in your browser (IndexedDB). Whisper runs locally; the only network requests
are the one-time model download from the Hugging Face Hub (and web searches you open from keyword chips). If you choose the Web Speech API engine,
your browser sends audio to its vendor for recognition. Export a JSON backup regularly; clearing
site data deletes your topics and recordings.

## Project layout

```
index.html
public/                 manifest and icon
src/
  main.ts               views and routing (hash based)
  ui.ts                 DOM helpers, trend chart
  db.ts                 IndexedDB and JSON backup
  audio.ts              MediaRecorder wrapper, decode to 16 kHz mono
  asr.ts                Whisper worker client, Web Speech wrapper
  whisper.worker.ts     transformers.js pipeline in a Web Worker
  fx.ts                 sound blips, reduced-motion check
  icons.ts              small inline SVG line icons
  style.css
  core/                 pure logic, unit tested
    text.ts             Vietnamese normalisation, tokenising, edit distance
    metrics.ts          fillers, pace, pauses, coverage, structure, score
    review.ts           spaced review schedule
    bundle.ts           Markdown review bundle
    bank.ts             topic bank categories, no-repeat Drawer
    bank-*.ts           Vietnamese topic banks per depth
    body.ts             Luyen Than exercises, weekly schedule, swaps, checks
    bank-en.ts          English display titles for every bank subject
    bank-meta.ts        English search terms, complexity, link-checked sources
    bank-more-*.ts      2026-11-06 expansion (minute, day, week and deep), with English titles and terms
    estimate.ts         effort and calendar estimates
    topic.ts            topic creation from the bank, optional plan adoption, normalisation
    guide.ts            optional analyze/present guidance and lens selection
    types.ts
tests/                  unit tests and audio fixture
scripts/screenshots.mjs end-to-end test and screenshots
scripts/asr-bench.mjs   Whisper model comparison on the fixture
docs/DESIGN.md
```

## Known limitations

- Speech recognition still makes errors with fast speech and names; edit the transcript before
  scoring. PhoWhisper-small outputs no punctuation and can drop a leading word.
- large-v3-turbo on WebGPU (the default when WebGPU is available) was not tested in headless
  Chromium, which has no GPU adapter; it was tested on WASM only.
- The topic bank is a fixed list written for the app; it does not update itself. Book and research
  provenance is in `docs/content-sources.md`; it covers the named books and a sample of factual
  subjects, not every sentence in the bank.
- WASM transcription is slow on low-end phones (several times real time for long recordings).
- The pace band for Vietnamese and the marker lists are heuristics.
- Metrics measure delivery, not whether the content is correct; use Copy for review for that.
- Planning estimates are editorial ranges set by depth and a hand-assigned complexity rating per
  subject. They are not measured from real study data and will be wrong for many people; edit them.
- Starting sources were link-checked (HTTP 200 and matching page title) on 2026-11-06 only. Their
  content was not reviewed for accuracy, and links can break later. Most subjects have none.
- Speech recognition was not retested after the 2026-11-06 changes because the ASR code did not
  change; the end-to-end script types the transcript by hand.
- No service worker: the app needs the network to load the page, but the model is cached.

## License

MIT
