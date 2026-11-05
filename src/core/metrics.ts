import { contentTokens, levenshtein, normalizeVi, tokenizeKeepTones, tokenizeNormalized } from './text.js';

// ---------- filler words ----------

/** Filler phrases, longest first so "kiểu như" is counted once, not also as "kiểu". */
export const FILLERS_VI = [
  'nói chung là', 'kiểu như là', 'đại loại là', 'thì kiểu', 'kiểu như', 'thì là', 'nói chung',
  'đúng không', 'phải không', 'các thứ', 'đại loại', 'thật ra là', 'ý là', 'kiểu', 'ừm', 'ừ', 'ờ', 'à', 'ơ', 'ầy', 'hmm', 'ừa',
];
export const FILLERS_EN = ['you know', 'i mean', 'kind of', 'sort of', 'um', 'uh', 'erm', 'like', 'basically', 'actually'];

export interface FillerResult {
  total: number;
  ratio: number; // fillers per token
  byWord: Record<string, number>;
}

export function countFillers(text: string, fillers: string[] = [...FILLERS_VI, ...FILLERS_EN]): FillerResult {
  const tokens = tokenizeKeepTones(text);
  const phrases = fillers
    .map((f) => tokenizeKeepTones(f))
    .filter((p) => p.length)
    .sort((a, b) => b.length - a.length);
  const byWord: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < tokens.length; ) {
    let matched = 0;
    for (const p of phrases) {
      if (p.every((w, k) => tokens[i + k] === w)) {
        const key = p.join(' ');
        byWord[key] = (byWord[key] || 0) + 1;
        total++;
        matched = p.length;
        break;
      }
    }
    i += matched || 1;
  }
  return { total, ratio: tokens.length ? total / tokens.length : 0, byWord };
}

// ---------- pace ----------

/** Words (Vietnamese syllables) per minute. */
export function wordsPerMinute(text: string, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.round((tokenizeKeepTones(text).length / durationSec) * 60);
}

// ---------- pauses ----------

export interface Pause { start: number; end: number; }

/**
 * Find silent gaps from mono samples using frame RMS energy.
 * Threshold adapts to the recording: a fraction of the 90th percentile frame energy.
 * Leading and trailing silence is ignored.
 */
export function detectPauses(samples: Float32Array, sampleRate: number, minPauseSec = 1.5, frameSec = 0.03): Pause[] {
  const frame = Math.max(1, Math.round(sampleRate * frameSec));
  const rms: number[] = [];
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += samples[j] * samples[j];
    rms.push(Math.sqrt(s / frame));
  }
  if (!rms.length) return [];
  const sorted = [...rms].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const thr = Math.max(0.005, p90 * 0.12);
  const voiced = rms.map((v) => v > thr);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  if (first < 0) return [];
  const out: Pause[] = [];
  let runStart = -1;
  for (let i = first; i <= last; i++) {
    if (!voiced[i]) { if (runStart < 0) runStart = i; }
    else if (runStart >= 0) {
      const len = (i - runStart) * frameSec;
      if (len >= minPauseSec) out.push({ start: runStart * frameSec, end: i * frameSec });
      runStart = -1;
    }
  }
  return out;
}

/** Pauses from Whisper chunk timestamps (gap between consecutive chunks). */
export function pausesFromChunks(chunks: { timestamp: [number, number | null] }[], minPauseSec = 1.5): Pause[] {
  const out: Pause[] = [];
  for (let i = 1; i < chunks.length; i++) {
    const prevEnd = chunks[i - 1].timestamp[1] ?? chunks[i - 1].timestamp[0];
    const start = chunks[i].timestamp[0];
    if (start - prevEnd >= minPauseSec) out.push({ start: prevEnd, end: start });
  }
  return out;
}

// ---------- coverage ----------

export type CoverageState = 'covered' | 'partial' | 'missing';
export interface CoverageItem { point: string; state: CoverageState; matched: number; total: number; }

function tokenMatch(a: string, set: Set<string>, list: string[]): boolean {
  if (set.has(a)) return true;
  // Vietnamese syllables are short and differ by one letter (cong/con), so only fuzzy-match long tokens.
  if (a.length < 6) return false;
  const tol = a.length >= 9 ? 2 : 1;
  return list.some((b) => Math.abs(b.length - a.length) <= tol && levenshtein(a, b) <= tol);
}

/** Fuzzy, diacritic-insensitive check of how many key points the transcript touches. */
export function coverage(transcript: string, keyPoints: string[]): { items: CoverageItem[]; ratio: number } {
  const tList = tokenizeNormalized(transcript);
  const tSet = new Set(tList);
  const norm = ' ' + normalizeVi(transcript) + ' ';
  const items = keyPoints.filter((p) => p.trim()).map((point): CoverageItem => {
    const toks = [...new Set(contentTokens(point))];
    if (!toks.length) return { point, state: 'missing', matched: 0, total: 0 };
    // Whole phrase present counts as full coverage.
    if (norm.includes(' ' + normalizeVi(point) + ' ')) return { point, state: 'covered', matched: toks.length, total: toks.length };
    const matched = toks.filter((t) => tokenMatch(t, tSet, tList)).length;
    const r = matched / toks.length;
    return { point, state: r >= 0.6 ? 'covered' : r >= 0.3 ? 'partial' : 'missing', matched, total: toks.length };
  });
  const score = items.reduce((s, i) => s + (i.state === 'covered' ? 1 : i.state === 'partial' ? 0.5 : 0), 0);
  return { items, ratio: items.length ? score / items.length : 0 };
}

// ---------- structure hints ----------

export const PREP_MARKERS = {
  point: ['theo tôi', 'theo mình', 'mình nghĩ', 'mình cho rằng', 'tôi nghĩ', 'tôi cho rằng', 'quan điểm', 'tôi tin', 'ý kiến của tôi', 'câu trả lời là', 'in my opinion', 'i think'],
  reason: ['vì', 'bởi vì', 'lý do', 'do là', 'nguyên nhân', 'because', 'the reason'],
  example: ['ví dụ', 'chẳng hạn', 'trường hợp', 'như là', 'lấy ví dụ', 'thực tế', 'for example', 'for instance'],
  close: ['tóm lại', 'vì vậy', 'vì thế', 'cho nên', 'kết luận', 'nói tóm lại', 'do đó', 'quay lại', 'in summary', 'so'],
};

export const FEYNMAN_MARKERS = {
  simple: ['đơn giản là', 'nói đơn giản', 'hiểu nôm na', 'tức là', 'nghĩa là', 'hiểu đơn giản'],
  analogy: ['giống như', 'tương tự', 'hình dung', 'như kiểu', 'ví như', 'cũng như'],
  why: ['tại sao', 'vì sao', 'bởi vì', 'lý do'],
  gap: ['chưa rõ', 'không chắc', 'mình chưa hiểu', 'cần tìm hiểu', 'chưa biết'],
};

export interface StructureHint { key: string; label: string; found: boolean; where: number | null; }

function findPhrase(normText: string, phrase: string): number {
  const p = ' ' + normalizeVi(phrase) + ' ';
  const idx = (' ' + normText + ' ').indexOf(p);
  return idx < 0 ? -1 : idx / Math.max(1, normText.length);
}

/** Relative position (0..1) of the first marker of each PREP part, plus whether the order makes sense. */
export function prepStructure(text: string): { hints: StructureHint[]; ordered: boolean; score: number } {
  const n = normalizeVi(text);
  const labels: Record<string, string> = { point: 'Point (quan điểm)', reason: 'Reason (lý do)', example: 'Example (ví dụ)', close: 'Point (chốt lại)' };
  const hints = (Object.keys(PREP_MARKERS) as (keyof typeof PREP_MARKERS)[]).map((k) => {
    let best = -1;
    for (const m of PREP_MARKERS[k]) {
      const pos = findPhrase(n, m);
      if (pos >= 0 && (best < 0 || (k === 'close' ? pos > best : pos < best))) best = pos;
    }
    return { key: k, label: labels[k], found: best >= 0, where: best >= 0 ? best : null };
  });
  const pos = hints.map((h) => h.where);
  const ordered = pos.every((p) => p !== null) && (pos[0] as number) <= (pos[2] as number) && (pos[3] as number) >= 0.5;
  const found = hints.filter((h) => h.found).length;
  return { hints, ordered, score: (found / 4) * 0.8 + (ordered ? 0.2 : 0) };
}

export function feynmanStructure(text: string): { hints: StructureHint[]; score: number; longSentences: number } {
  const n = normalizeVi(text);
  const labels: Record<string, string> = { simple: 'Diễn giải đơn giản', analogy: 'Có phép so sánh', why: 'Giải thích "vì sao"', gap: 'Tự nhận ra lỗ hổng' };
  const hints = (Object.keys(FEYNMAN_MARKERS) as (keyof typeof FEYNMAN_MARKERS)[]).map((k) => {
    const hit = FEYNMAN_MARKERS[k].map((m) => findPhrase(n, m)).filter((p) => p >= 0);
    return { key: k, label: labels[k], found: hit.length > 0, where: hit.length ? Math.min(...hit) : null };
  });
  const sentences = text.split(/[.!?…\n]+/).map((s) => tokenizeKeepTones(s).length).filter((l) => l > 0);
  const longSentences = sentences.filter((l) => l > 40).length;
  const found = hints.filter((h) => h.found && h.key !== 'gap').length;
  return { hints, longSentences, score: Math.min(1, found / 3) * (longSentences > 2 ? 0.8 : 1) };
}

// ---------- score card ----------

export type Scaffold = 'none' | 'prep' | 'feynman';

export interface MetricsInput {
  transcript: string;
  durationSec: number;
  targetSec: number;
  keyPoints: string[];
  pauses: Pause[];
  scaffold: Scaffold;
}

export interface Metrics {
  words: number;
  wpm: number;
  fillers: FillerResult;
  pauses: Pause[];
  longestPause: number;
  coverage: { items: CoverageItem[]; ratio: number };
  structure: { kind: Scaffold; hints: StructureHint[]; score: number; ordered?: boolean; longSentences?: number };
  durationSec: number;
  targetSec: number;
  parts: Record<string, number>; // 0..1 sub-scores
  score: number; // 0..100
}

/** Comfortable Vietnamese conversational pace, syllables per minute (heuristic). */
export const PACE_RANGE: [number, number] = [120, 190];

export function paceScore(wpm: number, [lo, hi] = PACE_RANGE): number {
  if (wpm <= 0) return 0;
  if (wpm >= lo && wpm <= hi) return 1;
  const d = wpm < lo ? (lo - wpm) / lo : (wpm - hi) / hi;
  return Math.max(0, 1 - d * 2);
}

export function fillerScore(ratio: number): number {
  // <=3% is normal (Yoodli guideline); 15% or more scores 0.
  if (ratio <= 0.03) return 1;
  return Math.max(0, 1 - (ratio - 0.03) / 0.12);
}

export function pauseScore(pauses: Pause[], durationSec: number): number {
  if (durationSec <= 0) return 0;
  const perMin = pauses.length / (durationSec / 60);
  const longest = pauses.reduce((m, p) => Math.max(m, p.end - p.start), 0);
  let s = 1 - Math.max(0, perMin - 2) * 0.15;
  if (longest > 4) s -= Math.min(0.4, (longest - 4) * 0.1);
  return Math.max(0, Math.min(1, s));
}

export function durationScore(durationSec: number, targetSec: number): number {
  if (targetSec <= 0) return 1;
  const r = durationSec / targetSec;
  if (r >= 0.85 && r <= 1.1) return 1;
  if (r < 0.85) return Math.max(0, r / 0.85);
  return Math.max(0, 1 - (r - 1.1) * 1.5);
}

export function computeMetrics(input: MetricsInput): Metrics {
  const words = tokenizeKeepTones(input.transcript).length;
  const wpm = wordsPerMinute(input.transcript, input.durationSec);
  const fillers = countFillers(input.transcript);
  const cov = coverage(input.transcript, input.keyPoints);
  const structure = input.scaffold === 'feynman'
    ? { kind: input.scaffold, ...feynmanStructure(input.transcript) }
    : { kind: input.scaffold, ...prepStructure(input.transcript) };
  const parts: Record<string, number> = {
    pace: paceScore(wpm),
    fillers: fillerScore(fillers.ratio),
    pauses: pauseScore(input.pauses, input.durationSec),
    duration: durationScore(input.durationSec, input.targetSec),
    structure: structure.score,
  };
  const weights: Record<string, number> = { pace: 20, fillers: 20, pauses: 15, duration: 10, structure: 10 };
  if (cov.items.length) { parts.coverage = cov.ratio; weights.coverage = 25; }
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0);
  const score = words === 0 ? 0 : Math.round(Object.keys(weights).reduce((s, k) => s + parts[k] * weights[k], 0) / wsum * 100);
  return {
    words, wpm, fillers, pauses: input.pauses,
    longestPause: input.pauses.reduce((m, p) => Math.max(m, p.end - p.start), 0),
    coverage: cov, structure, durationSec: input.durationSec, targetSec: input.targetSec, parts, score,
  };
}
