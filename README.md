# Omni Feyn

Learn any topic at the depth you choose, explain it out loud, and measure the explanation.
Runs entirely in the browser: no server, no account, speech-to-text on your own device.
The interface is in Vietnamese.

Inspired by the "Luyen Tri" P.R.E.P drill on chongnaotan.com, extended from one-minute reflex
speaking to weeks-long deep dives using the Feynman technique.

## Features

- Topics with four depth levels: 1 minute (random prompt from a Vietnamese bank of 120 prompts in
  8 categories), 1 day, 1 week, and Deep dive.
- Per topic: core question, sources with status and notes, key points, open questions, stage
  (Explore, Understand, Explain, Review), reading log and milestones.
- Speaking practice: target timer with progress ring, optional P.R.E.P or Feynman scaffold that
  highlights the current part, in-browser recording (MediaRecorder), playback, history per topic.
- Transcript: Whisper (tiny, base or small, multilingual) through transformers.js in a Web Worker,
  WebGPU with WASM fallback, model cached after first download. Optional Web Speech API live
  transcript (sends audio to the browser vendor). Transcript is editable.
- Metrics without any AI model: pace (syllables per minute), filler words (Vietnamese and English),
  long pauses (audio energy), duration versus target, P.R.E.P or Feynman structure markers, and
  key point coverage with diacritic-insensitive fuzzy matching. Score card and trend chart.
- Copy for review: a Markdown bundle with topic, sources, transcript and metrics, ready to paste
  into an assistant for a review of reasoning and gaps.
- Spaced review on 1, 3, 7, 21, 60 days with a "due today" list.
- IndexedDB storage, JSON backup export and import (audio optional), installable web app manifest.

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
| `npm test` | Unit tests for metrics, normalisation, review schedule and bundle |
| `npm run build` | Type check and production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run screenshots` | End-to-end run in headless Chromium (fake microphone, real Whisper on WASM) and screenshots into `screenshots/`; run `npm run build` and `npx playwright install chromium` first |

## Deploy to GitHub Pages

1. Push to a GitHub repository, branch `main`.
2. Settings, Pages, Source: GitHub Actions.
3. The workflow `.github/workflows/pages.yml` tests, builds with `VITE_BASE=/<repo-name>/` and deploys.

Actions are pinned by commit SHA; Dependabot updates npm packages and actions weekly.

## Privacy

Everything is stored in your browser (IndexedDB). Whisper runs locally; the only network requests
are the one-time model download from the Hugging Face Hub. If you choose the Web Speech API engine,
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
  topic-bank.ts         Vietnamese prompt bank
  style.css
  core/                 pure logic, unit tested
    text.ts             Vietnamese normalisation, tokenising, edit distance
    metrics.ts          fillers, pace, pauses, coverage, structure, score
    review.ts           spaced review schedule
    bundle.ts           Markdown review bundle
    types.ts
tests/                  unit tests and audio fixture
scripts/screenshots.mjs end-to-end test and screenshots
docs/DESIGN.md
```

## Known limitations

- Whisper base on Vietnamese makes recognition errors, especially with fast speech and names;
  edit the transcript before scoring. Whisper small is more accurate but a larger download.
- WASM transcription is slow on low-end phones (several times real time for long recordings).
- The pace band for Vietnamese and the marker lists are heuristics.
- Metrics measure delivery, not whether the content is correct; use Copy for review for that.
- No service worker: the app needs the network to load the page, but the model is cached.

## License

MIT
