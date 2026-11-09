import type { Metrics } from './metrics.js';
import { englishTitle } from './topic.js';
import type { Attempt, Topic } from './types.js';
import { DEPTH_LABEL, STAGE_LABEL } from './types.js';

function localStamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function metricsMarkdown(m: Metrics): string {
  const lines = [
    `- Delivery score (automatic proxy, not a measure of understanding or accuracy): ${m.score}/100`,
    `- Duration: ${fmtSec(m.durationSec)} (target ${fmtSec(m.targetSec)})`,
    `- Words (syllables): ${m.words}, pace ${m.wpm} per minute`,
    `- Filler words: ${m.fillers.total} (${(m.fillers.ratio * 100).toFixed(1)}%)` +
      (m.fillers.total ? ' - ' + Object.entries(m.fillers.byWord).map(([w, n]) => `${w} x${n}`).join(', ') : ''),
    `- Long pauses (>= 1.5 s): ${m.pauses.length}, longest ${m.longestPause.toFixed(1)} s`,
  ];
  if (m.coverage.items.length) {
    lines.push(`- Key point word overlap (heuristic keyword match, not correctness): ${Math.round(m.coverage.ratio * 100)}%`);
    for (const i of m.coverage.items) lines.push(`  - [${i.state}] ${i.point}`);
  }
  lines.push(`- Structure markers (${m.structure.kind}, phrase detection only): ` + m.structure.hints.map((h) => `${h.label}: ${h.found ? 'yes' : 'no'}`).join('; '));
  return lines.join('\n');
}

/** Markdown bundle meant to be pasted into an assistant for a deep review of reasoning and gaps. */
export function reviewBundle(topic: Topic, attempt: Attempt | null): string {
  const out: string[] = [];
  out.push(`# Review request: ${topic.title}`, '');
  const en = englishTitle(topic);
  if (en) out.push(`- English title: ${en}`);
  if (topic.suggestions?.disputed) out.push('- Note: the evidence or interpretation behind this idea is debated; please consider replications and critiques.');
  out.push(`- Depth: ${DEPTH_LABEL[topic.depth]}`, `- Stage: ${STAGE_LABEL[topic.stage]}`);
  if (attempt) out.push(`- Attempt: ${localStamp(attempt.createdAt)} (${attempt.scaffold} scaffold)`);
  out.push('', '## Core question', '', topic.coreQuestion || '(not set; I am exploring the subject broadly)', '');
  if (topic.direction) out.push('## My own direction', '', topic.direction, '');
  out.push('## My key points', '');
  out.push(...(topic.keyPoints.length ? topic.keyPoints.map((k) => `- ${k.text}`) : ['(none yet)']), '');
  if (topic.understanding) out.push('## My current understanding (before or outside this attempt)', '', topic.understanding, '');
  if (topic.facts) out.push('## Notes I believe are backed by sources', '', topic.facts, '');
  if (topic.interpretation) out.push('## My interpretation, assumptions and uncertainties', '', topic.interpretation, '');
  if (topic.openQuestions.length) {
    out.push('## My open questions', '', ...topic.openQuestions.map((q) => `- [${q.done ? 'x' : ' '}] ${q.text}`), '');
  }
  if (topic.sources.length) {
    out.push('## Sources', '');
    for (const s of topic.sources) {
      out.push(`- ${s.title || s.url}${s.url ? ` <${s.url}>` : ''} (${s.status})`);
      if (s.note) out.push(...s.note.split('\n').map((l) => `  > ${l}`));
    }
    out.push('');
  }
  if (attempt) {
    out.push('## Transcript', '', attempt.transcript ? attempt.transcript : '(empty)', '');
    if (attempt.metrics) out.push('## Delivery metrics (automatic, no AI)', '',
      'These measure how I spoke (pace, fillers, pauses, length) plus simple keyword and phrase matching. They do not judge whether the content is correct or how well I understand it.', '',
      metricsMarkdown(attempt.metrics), '');
  }
  out.push('## What I want from you', '',
    '1. Is my explanation correct? Point out factual errors or oversimplifications, and check my claims against the sources listed.',
    '2. Where is the reasoning weak, circular, or missing a step?',
    '3. Which key ideas of this topic did I miss entirely?',
    '4. Ask me 3 hard follow-up questions a curious beginner would ask.',
    '5. Suggest one better example or analogy.',
    '6. Which of my stated assumptions or uncertainties matter most, and how could I check them?', '');
  return out.join('\n');
}
