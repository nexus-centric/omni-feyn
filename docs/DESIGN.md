# Design rationale

Omni Feyn is a personal tool for picking a topic, learning it to a chosen depth, explaining it out
loud, and measuring the explanation, with a small daily body-workout companion. This document
records the design decisions and the sources behind them. Research was done on 2026-11-05; the
overhaul (random topics for every depth, Luyen Than, model upgrade, visual refresh) was researched
and built on 2026-11-05.

## 1. Starting point: chongnaotan.com (Luyen Tri and Luyen Than)

chongnaotan.com (fetched 2026-11-05) is a hub with two cards, "Luyen Tri" (mind) and "Luyen Than"
(body). Each opens a self-contained page that is embedded in the hub as a base64 string and shown
in an iframe. Both pages were decoded and studied:

- Luyen Tri: dark warm theme (near-black background, cream text, tangerine accent, radial glow),
  emoji throughout the UI, and a large spin button. Spinning flips a card through about ten
  random topics with decelerating ticks and square-wave beeps, then lands with a two-note chime.
  A second mode spins an SVG wheel with an ease-out curve. Picks never repeat inside a pool until
  the pool is exhausted. Space spins, Enter starts, Escape closes. Modes cover quick reflex speech,
  thinking deep with a research timer, and spinning a book chapter.
- Luyen Than: 20 minutes a day at home; the user picks one move for each of four zones (arms and
  chest, legs, core, back), repeats the circuit as many times as possible with 10 to 45 seconds of
  rest, and records rounds. It also has a BMR/TDEE calculator and nutrition tips.

What we took (as ideas, no code or text copied): the playful, personal tone; one big tactile spin
button; a short, decelerating randomisation animation with optional sound and a landing moment;
no-repeat draws per pool; keyboard shortcuts; a four-zone 20-minute home circuit.

What we added: random picks for every depth, not only reflex speaking; each picked subject comes
with optional suggestions (a possible question, angles, search terms) and can be started as a
tracked topic with sources, notes, optional milestones and spaced review; speech metrics and
transcripts.

What we later dropped (owner feedback, 2026-11-06): the game-show vocabulary and visuals. The
owner found "Quay đề", the "QUAY" button, the dice and the slogan unnatural. See section 11.

## 2. Random topics for every depth

The purpose of the app is to always have something to research and then speak about, so every
depth level has its own spin and its own bank (`src/core/bank-*.ts`, written for this app, in
Vietnamese):

| Depth | Bank size | What a draw contains |
| --- | --- | --- |
| 1 minute | 258 prompts, 15 categories | A reflex prompt (an opinion or a quick "why"); accept starts a 60 s P.R.E.P recording |
| 1 day | 152 subjects | One mechanism or idea; optional suggestions: a possible question, 2 to 3 search keywords |
| 1 week | 91 subjects | Comparisons and connected ideas; optional suggestions: a question, 4 or more angles, keywords |
| Deep dive | 64 subjects | Broad fields and big books; optional suggestions: 5 to 6 possible steps, keywords, sometimes a question |

All three long depths also carry an English name, English search terms, a complexity rating and,
for some subjects, link-checked starting sources (section 4). Deep subjects added on 2026-11-06 have
no suggested question on purpose: the subject is broad and the user chooses the angle.

### Content expansion and balance (2026-11-06)

The owner asked for many more topics in technology, economics and finance, psychology, phenomena,
books and interesting facts, with other areas still spread evenly. The bank went from 300 to 565
items. Counts per category (minute / day / week / deep):

| Category | Before | After |
| --- | --- | --- |
| Công nghệ & máy tính (technology and computing) | 15 / 7 / 5 / 4 | 30 / 21 / 12 / 9 |
| DevOps & hạ tầng (DevOps and infrastructure) | 15 / 9 / 6 / 4 | 15 / 15 / 10 / 6 |
| Kinh tế & tài chính (economics and finance) | 15 / 8 / 5 / 5 | 30 / 23 / 14 / 11 |
| Tâm lý (psychology) | 12 / 6 / 3 / 2 | 27 / 19 / 10 / 7 |
| Hiện tượng & điều thú vị (phenomena and curiosities, new) | 0 / 0 / 0 / 0 | 20 / 15 / 6 / 3 |
| Sách (books, new) | 0 / 0 / 0 / 0 | 16 / 10 / 8 / 5 |
| Khoa học (science) | 12 / 7 / 5 / 5 | 12 / 10 / 5 / 5 |
| Lịch sử (history) | 0 / 7 / 5 / 2 | 8 / 11 / 6 / 2 |
| Thế giới & địa chính trị (world) | 15 / 5 / 3 / 4 | unchanged |
| Xã hội (society) | 15 / 5 / 3 / 3 | unchanged |
| Văn hoá & nghệ thuật (culture and arts, new) | 0 / 0 / 0 / 0 | 10 / 5 / 3 / 2 |
| Giáo dục & học tập (education) | 15 / 3 / 1 / 1 | unchanged |
| Bản thân & phát triển (personal growth) | 15 / 4 / 3 / 2 | unchanged |
| Công việc & sự nghiệp (work) | 15 / 3 / 1 / 0 | 15 / 3 / 3 / 2 |
| Môi trường & sức khoẻ (environment and health) | 15 / 3 / 2 / 0 | 15 / 3 / 4 / 2 |
| Total | 159 / 67 / 42 / 32 | 258 / 152 / 91 / 64 |

The six priority categories (technology, DevOps, economics and finance, psychology, phenomena,
books) went from 40% to 61% of the bank: 53% of minute prompts (the older minute bank is spread
evenly) and 64 to 68% of day, week and deep subjects. Every category has items at every depth.

Content rules for the new items: psychology topics present the evidence, including replication
problems, and never offer diagnosis; findings with weak or contested evidence carry the flag
`disputed`, shown as a "Còn tranh luận" chip and noted in Copy for review. Phenomena are phrased as
questions to research, not as claims. Economics topics explain mechanisms and history and never
name an investment or a current price. Book topics name real books by their original English (or
original-language) title and author; no Vietnamese edition is claimed. Book topics show a note that
the time estimate covers researching the ideas, not reading the whole book. Provenance for the named
books and the research behind the factual subjects is in `docs/content-sources.md`.

### Draw balance

With the filter on "Tất cả", `Drawer` first picks a category among those that still have unused
items, weighted by `CATEGORY_WEIGHT` (priority areas 3, DevOps 1.5, everything else 1), then picks an
item inside it uniformly. Expected share of a first draw: each priority area 11.8%, DevOps 5.9%,
every other area 3.9%; priority areas together 64.7%. DevOps weighs less because technology already
has its own priority category (tech as a whole gets 17.6%). Categories with few items are used up
sooner and then drop out, so over a full cycle every item is still shown exactly once before any
repeat, and a new cycle never starts with the item just shown. A specific category filter is a plain
uniform no-repeat draw. `tests/content.test.ts` checks these properties with seeded random numbers.

Rules, enforced by `tests/bank.test.ts`: minimum sizes per depth, unique ids and titles, known
categories, every day and week item has a suggested question (deep items may leave it empty) and at least two keywords, week and deep
items have at least four plan steps, and the bank text contains no URLs. Keywords render as chips
that open a web search. The only stored links are the link-checked starting sources in
`bank-meta.ts` (see section 4); `tests/plan.test.ts` checks that every metadata key matches a bank
subject and every source is https and attributed.

Draws use `Drawer` (`src/core/bank.ts`, weighting described above): per depth and category pool, an item is not drawn again in
the session until the whole pool has been drawn; when a new cycle starts the item just shown is
excluded. A category filter narrows the pool; a counter shows how many are left. Accepting an item creates a topic
with the subject only (no question, milestones or open questions are filled in); accepting the same
bank item twice opens the existing topic instead of duplicating it. Manual topic creation is unchanged.

## 3. Learning model: Feynman technique as the backbone

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

## 4. Depth levels, optional suggestions and estimates

| Depth | Default target | Typical use |
| --- | --- | --- |
| 1 minute | 60 s | Random prompt from the bank, P.R.E.P, reflex |
| 1 day | 3 min | A compact subject, a few sources, one explanation |
| 1 week | 5 min | A broader subject over several sessions |
| Deep dive | 10 min | A large subject at the user's own pace |

Depth is a starting preference for scope, not a deadline; it can be changed on the topic page.

### The subject is random, the questions are suggestions (revised 2026-11-06)

An earlier version turned a drawn subject into a fixed core question and, for deep dives, four
default milestones. The owner corrected this: the random draw is about the subject, and questions
are only hints the user may follow or ignore while researching on their own. Decisions:

- Accepting a draw stores the subject, depth, category and complexity. The core question stays
  empty and no milestones are created. Manual topics also get no default milestones.
- Bank material is stored separately as `suggestions` (possible question, possible angles,
  keywords, English name and terms, starting sources) and shown in a collapsed panel labelled
  optional. "Use this question" and "Copy angles as milestones" are explicit buttons; copying the
  plan twice does not duplicate milestones. The panel can be hidden and shown again.
- Labels changed from instructions to options: "Core question (optional)", "My questions",
  "Key points (optional)", and a stage bar that the user sets in any order.
- Topic notes are all optional: personal direction, current understanding, and a split between
  "backed by sources" and "my interpretation, assumptions, uncertainties". The split follows
  ordinary research-note practice of keeping evidence and inference apart; it is a prompt, not a
  check.

Sources follow research-note practice: every source has a status (to read, reading, done) and its
own note field for the user's own words.

### English search terms and starting sources

Every day, week and deep subject has an English name, a complexity rating (1 to 3) and, where the
Vietnamese title does not translate cleanly, extra English search terms (for example the
Vietnamese history subjects carry terms such as "Tran dynasty Mongol invasions" and "Nam tien
southward expansion"). These are shown as Google search links and labelled as searches, not
sources. The topic bank itself contains no URLs; a test enforces this.

A small set of starting sources (about 25 subjects) lives in `src/core/bank-meta.ts`. Each URL was
fetched on 2026-11-06 and kept only if it returned HTTP 200 and the page title matched the expected
document (for example Federal Reserve History, kubernetes.io, Our World in Data, WHO fact sheets,
NIST, the Stanford Encyclopedia of Philosophy, arXiv). URLs that returned 403, 404 or a soft 404
were dropped (some IPCC, IMF, ACSM, CDC, BIS and World Bank pages). The content was not reviewed for
accuracy; the UI says "link checked on date, content not vetted". No factual claims about subjects
were added to the app.

### Planning estimates

`src/core/estimate.ts` separates active effort from calendar time:

| Depth | Complexity 1 | Complexity 2 | Complexity 3 |
| --- | --- | --- | --- |
| 1 day | 1.5-3 h | 2.5-5 h | 4-8 h |
| 1 week | 4-8 h | 7-14 h | 12-22 h |
| Deep dive | 12-25 h | 25-50 h | 45-90 h |

The calendar window is derived from an explicit pace (defaults: day 90 min x 7, week 60 min x 5,
deep 45 min x 4 sessions per week) and shown as "about x-y days/weeks/months if you keep this
pace". Both the hours and the pace are editable per topic and stored in `topic.plan`; changing the
pace never changes the effort estimate. Limitations: the ranges and the complexity ratings are
editorial judgement, not derived from study data, and individual variation is large. The UI says
so next to every estimate.

## 5. Speaking structure: P.R.E.P

P.R.E.P (Point, Reason, Example, Point) is the default for 1-minute prompts, matching the
inspiration site. During recording the scaffold highlights the current part on a time budget of
15 / 30 / 35 / 20 percent of the target, so the speaker knows when to move on. After recording,
a marker search checks that each part appears and that the closing point is in the second half.

## 6. Speech metrics (no LLM)

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

The aggregate is labelled "delivery score" everywhere, never understanding or accuracy. The card is
split into "how you spoke" (pace, fillers, pauses, duration) and "surface heuristics" (structure
phrase detection and key point keyword overlap), and each heuristic says what it actually does,
for example "word match, not a correctness check". Key point coverage only appears when the user
chose to write key points. Reasoning quality is handled by the "Copy for review" bundle (below).

## 7. Transcription: Whisper in the browser

- transformers.js runs ONNX Whisper in the browser; WebGPU via `device: "webgpu"`, WASM otherwise.
  Hugging Face, "Running models on WebGPU": https://huggingface.co/docs/transformers.js/guides/webgpu
- `navigator.gpu` existing is not enough; pick WebGPU only if `requestAdapter()` returns an adapter,
  run in a Web Worker, and pass `chunk_length_s: 30` or only the first 30 seconds are transcribed.
  OpenReplay blog, "Adding captions to a video with AI in the browser": https://blog.openreplay.com/add-video-captions-ai-browser/
- A WASM retry if the WebGPU model fails to initialise follows "Building Browser-Based
  Transcription: Workers, Cancellation, and Honest Progress" (DEV Community):
  https://dev.to/flowpick/building-browser-based-transcription-workers-cancellation-and-honest-progress-4b3o

### Model choice (researched 2026-11-05)

File sizes are from the Hugging Face file listings (API `tree/main/onnx`) on 2026-11-05.

| Model | Notes | Download used |
| --- | --- | --- |
| `onnx-community/whisper-large-v3-turbo` | large-v3 pruned from 32 to 4 decoder layers, "way faster, at the expense of a minor quality degradation" (model card https://huggingface.co/openai/whisper-large-v3-turbo). ONNX export: https://huggingface.co/onnx-community/whisper-large-v3-turbo | WebGPU q4 encoder 425 MB + q4 decoder 334 MB, about 760 MB. WASM q8 about 1085 MB |
| `huuquyet/PhoWhisper-small` | ONNX (transformers.js) export of VinAI PhoWhisper-small, Whisper fine-tuned on 844 hours of Vietnamese. Reported WER: CMV-Vi 11.08, VIVOS 6.33, VLSP 2020 T1 15.93 (https://github.com/VinAIResearch/PhoWhisper, ICLR 2024 Tiny Papers). Export: https://huggingface.co/huuquyet/PhoWhisper-small | q8 encoder 92 MB + decoder 157 MB, about 249 MB |
| `onnx-community/whisper-small` | Multilingual OpenAI small: https://huggingface.co/onnx-community/whisper-small | WASM q8 about 249 MB; WebGPU fp32 encoder + q4 decoder about 586 MB |
| `onnx-community/whisper-base` | Previous default | WASM q8 about 77 MB |

PhoWhisper medium and large have no transformers.js ONNX export from VinAI; community exports of
medium/large exist only as CTranslate2 or unverified ONNX, so they are not offered.

Decision: the model setting defaults to "Auto". With a WebGPU adapter it uses large-v3-turbo
(q4, about 760 MB, best general accuracy that fits a browser GPU). Without WebGPU it uses
PhoWhisper-small on WASM (q8, about 249 MB), which was the most accurate in our test below and is
far faster on CPU than turbo. If the WebGPU load fails, the worker retries on WASM with
PhoWhisper-small. The user can pick any model explicitly; the settings page shows the size for the
current device and warns when turbo would run on CPU. Language is forced to Vietnamese unless the
user picks English. Download progress (MB loaded of total) is shown; files are cached by the
browser Cache API, and the settings page can clear that cache.

### End-to-end test on the fixture (headless Chromium, WASM, 2026-11-05)

`node scripts/asr-bench.mjs` transcribes `tests/fixtures/prep-vi.wav` (synthetic gTTS speech,
17 s) in the real worker. WER is word (syllable) error rate after lowercasing and removing
punctuation, with "hóa"/"hoá" spellings treated as equal. One synthetic clip is a smoke test, not a
benchmark.

| Model | Device | Download (MB) | Time (s) | WER on fixture | Transcript |
| --- | --- | --- | --- | --- | --- |
| onnx-community/whisper-base | wasm | 80 | 17 | 8.7% | Theo tôi, lạm phát là khi giá cả tăng đều theo thời gian, vì tiền in ra nhiều hơn lượng hàng hóa, ví dụ, giá săng và giá thịt đều tăng, tóm lại, ngân hàng trung ương phải tăng lại xuất để kiểm xuất lạm phát. |
| onnx-community/whisper-small | wasm | 252 | 37 | 4.3% | Theo tôi, lạm phát là khi giá cả tăng đều theo thời gian vì tiền in ra nhiều hơn lượng hàng hóa, ví dụ giá sang và giá thịt đều tăng. Tóm lại, ngân hàng Trung ương phải tăng lãi xuất để kiểm soát lạm phát. |
| huuquyet/PhoWhisper-small | wasm | 252 | 38 | 2.2% | tôi lạm phát là khi giá cả tăng đều theo thời gian vì tiền in ra nhiều hơn lượng hàng hoá ví dụ giá xăng và giá thịt đều tăng tóm lại ngân hàng trung ương phải tăng lãi suất để kiểm soát lạm phát. |
| onnx-community/whisper-large-v3-turbo | wasm | 1088 | 116 | 4.3% | Theo tôi, lãm phát là khi giá cả tăng đều theo thời gian, vì tiền in ra nhiều hơn lượng hàng hóa. Ví dụ, giá xăng và giá thịt đều tăng. Tóm lại, ngân hàng trung ương phải tăng lãi suất để kiểm soát lãm phát. |

Observations: base mishears "lãi suất" and "kiểm soát"; small and turbo are close; PhoWhisper-small
gets every content word right but drops the leading "Theo" and outputs no punctuation or capitals,
which slightly lowers the P.R.E.P marker score for "Theo tôi". Turbo on CPU is about three times
slower than small; on WebGPU it is the default.

## 8. Spaced review

Spaced retrieval beats massed practice strongly (meta-analysis of 29 studies, g = 0.74). Expanding
versus uniform intervals shows no overall difference, but expanding helps when there are more
retrieval sessions and gives better average recall during the training period.

- Latimier, Peyre, Ramus, "A Meta-Analytic Review of the Benefit of Spacing out Retrieval Practice
  Episodes on Retention", Educational Psychology Review (2021): http://www.lscp.net/persons/ramus/docs/EPR20.pdf
- Kang, Lindsey, Mozer, Pashler, "Effectiveness of expanding vs equal-interval retrieval practice"
  (2011): https://tdlc.ucsd.edu/SV2012/Pubs/KangLindseyMozerPashler2011.pdf

Decision: an optional expanding schedule of 1, 3, 7, 21, 60 days. Steps are driven by the delivery
score, which is a proxy; the UI says so. A review attempt scoring 70 or more moves
up one step, below 50 resets to 1 day, otherwise the interval repeats. "Due today" is the first
block on the home screen. Only the first scored attempt on a due day counts.

## 9. Copy for review

The deep check of reasoning needs a capable reviewer, which this app deliberately does not embed.
"Copy for review" builds a Markdown bundle: subject, depth, stage, core question (or "not set; I am
exploring the subject broadly"), personal direction, current understanding, notes backed by
sources, interpretation and assumptions, my open questions, key points, sources with notes,
transcript, delivery metrics with a paragraph explaining what they do not measure, and six review
requests (errors checked against the listed sources, weak reasoning, missing ideas, three hard
follow-up questions, one better analogy, which assumptions matter most and how to check them). It
uses the clipboard and a toast; there are no modal dialogs.

## 10. Luyen Than (body), revised 2026-11-06

The earlier version drew a random four-move round every day, which meant a hard full-body session
could land on consecutive days. It is replaced by a weekly schedule:

- Default week for a beginner aiming at general fitness: Mon strength A, Tue cardio, Wed strength B,
  Thu mobility, Fri strength A, Sat cardio, Sun rest. Strength A trains legs, upper push and core;
  strength B legs, back and core.
- Rationale: WHO recommends at least 150 minutes of moderate-intensity aerobic activity per week
  for adults and muscle-strengthening activity on two or more days
  (https://www.who.int/news-room/fact-sheets/detail/physical-activity, fetched 2026-11-05); the US
  Physical Activity Guidelines say the same about two days of muscle strengthening
  (https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines,
  fetched 2026-11-06). The ACSM position stand could not be fetched (HTTP 403) and is not cited.
  The page states how many cardio minutes the schedule plans and that daily walking also counts.
- The week is editable per weekday. `checkWeek` warns on fewer than two strength days, strength on
  consecutive days, and no rest or mobility day. Warnings advise; they do not block.
- Strength sessions are deterministic per date and level (the same day shows the same moves). Each
  move has a swap button that only offers moves from the same zone at the same level (falling back
  to easier levels if none), never harder ones. Today's session type can also be changed.
- Levels set work, rest and duration (beginner 30/30 s for 15 min, medium 40/20 for 20, hard
  45/15 for 20). Rest and mobility days show options (walk, stretching list) rather than nothing.
- Body tracking (sessions, 14-day strip, "x of y days active this week") is kept separate from
  research progress. There are no calorie estimates. The page says it is general activity guidance,
  not medical advice, and to see a doctor with health conditions, injuries or pregnancy.

## 11. Interface

The previous look was calm but read as corporate. The refresh aims for playful and warm while
staying readable.

References (fetched 2026-11-05):

- Duolingo, "Shape language: Duolingo's art style": https://blog.duolingo.com/shape-language-duolingos-art-style/
  (move from flat, pointy shapes and muted colours to vibrant colours and rounded buttons).
- Nielsen Norman Group, "Microinteractions in User Experience": https://www.nngroup.com/articles/microinteractions/
  (small feedback moments for a single task, such as confirming an action).
- Material Design 3, "Motion overview": https://m3.material.io/styles/motion/overview
  (expressive easing, short durations).
- MDN, "prefers-reduced-motion": https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- chongnaotan.com (section 1) for the warm, personal tone and the idea of a random pick.

Decisions (revised 2026-11-06 after owner feedback that the spin wording, dice and slogan felt
unnatural):

- Plain, everyday Vietnamese instead of game-show terms. The tab is "Khám phá" and the page title
  is the functional "Khám phá chủ đề"; the primary action is "Chọn ngẫu nhiên", the alternative is
  "Chọn chủ đề khác", accepting is "Bắt đầu tìm hiểu" (1-minute prompts: "Bắt đầu luyện nói"), and
  a workout swap is "Đổi bài". The words "quay", "bốc" and "đề" (in the sense of a drawn ticket)
  were removed from the interface. There is no slogan or tagline anywhere, including the document
  title, which is just "Omni Feyn". No new coined wording was introduced.
- No dice. The brand mark is the existing two-circle icon (also the favicon and manifest icon);
  the round dice button became a normal primary button with a shuffle icon.
- Emoji were replaced by one small set of inline SVG line icons (`src/icons.ts`, 24 px grid,
  1.8 px stroke, `currentColor`) for navigation, headings, depth cards and buttons. Category chips
  and selects are text only. Docs never use emoji.
- Warm cream background, white cards with 22 px radius, tangerine primary and one tint per depth
  (coral, amber, mint, violet) are kept. Buttons and depth tabs were made lighter: 1 px borders, a
  soft shadow instead of a thick bottom ledge, and a tinted (not gradient) selected tab.
- The random pick keeps a short shuffle: about 14 titles scroll and decelerate (1.9 s) onto the
  pick inside a softly tinted frame, then settle with a fade. Optional quiet blips and a two-note
  chime remain; the bounce and the emoji confetti burst were removed. Keyboard: Space picks, Enter
  starts.
- Bilingual titles: the Vietnamese title stays primary and the English title sits under it in a
  quieter italic style (`lang="en"`) on the shuffle card, result card, topic list, home list, topic
  page and practice page. English titles live in `src/core/bank-en.ts`, written by hand as natural
  titles rather than word-for-word translations, and audited against the earlier search-oriented
  names (which are kept as search terms). Technical names such as "Terraform state" stay as they
  are.
- Stored data: new topics from the bank save `titleEn`. Older topics are not rewritten; when the
  Vietnamese title exactly matches a built-in subject the English title is looked up from the bank
  at display and export time. Custom titles are never translated automatically; the user may type
  an English title, or clear it to hide it. Renaming a topic drops an English title that only came
  from the bank, so it cannot describe a different subject.
- With `prefers-reduced-motion: reduce` all animation and transitions are disabled and the pick
  lands immediately; sound can be switched off in settings.
- System font stack, good Vietnamese glyph coverage, no web font download.
- Mobile first: under 600 px the navigation becomes an icon-over-label bar that fits 390 px without
  horizontal scroll; one column under 860 px.
- The slogan and the "About" card were removed and not replaced.

## 12. Architecture

Vite and TypeScript, no UI framework. Pure logic (metrics, review schedule, Markdown bundle, text
normalisation, topic bank and drawer, workout schedule, swaps and checks, estimates, topic creation and normalisation) lives in `src/core` and is unit tested with the Node test runner. Data is stored in
IndexedDB (topics, attempts, audio blobs, settings) with JSON export and import (audio optional,
as data URLs). No backend, no accounts, no analytics.
