// Pure topic helpers: creation, creation from the bank, optional suggestions, backward compatibility.
import type { BankItem } from './bank.js';
import { BANK, CATEGORY } from './bank.js';
import type { Depth, Milestone, Topic } from './types.js';

export function newTopic(id: string, title: string, depth: Depth, category?: string, now = new Date().toISOString()): Topic {
  return { id, title, depth, category, coreQuestion: '', sources: [], keyPoints: [], openQuestions: [], stage: 'explore', readingLog: [], milestones: [], review: null, createdAt: now, updatedAt: now };
}

/** Accepting a drawn subject keeps it broad: suggestions are stored separately and never become requirements. */
export function topicFromBank(it: BankItem, id: string, now?: string): Topic {
  const t = newTopic(id, it.title, it.depth, CATEGORY[it.cat]?.name, now);
  t.bankId = it.id;
  if (it.en) t.titleEn = it.en;
  t.complexity = it.complexity;
  if (it.depth === 'minute') { t.stage = 'explain'; return t; }
  t.suggestions = { ...(it.flag === 'disputed' ? { disputed: true } : {}), ...(it.cat === 'sach' ? { book: true } : {}), core: it.core, plan: [...it.plan], keywords: [...it.keywords], en: it.en, enTerms: [...it.enTerms], sources: it.sources.map((s) => ({ ...s })) };
  return t;
}

/** Optional action: copy the suggested plan into milestones (only if the user asks). */
export function adoptPlan(t: Topic, makeId: () => string): Milestone[] {
  const existing = new Set(t.milestones.map((m) => m.text));
  const added = (t.suggestions?.plan || []).filter((p) => !existing.has(p)).map((p) => ({ id: makeId(), text: p, done: false }));
  t.milestones.push(...added);
  return added;
}

/** Fill defaults for topics saved by older versions. Never drops data. */
export function normalizeTopic(raw: Partial<Topic> & { id: string; title: string }): Topic {
  const now = new Date().toISOString();
  return {
    depth: 'day', coreQuestion: '', stage: 'explore', review: null, createdAt: now, updatedAt: now,
    ...raw,
    sources: raw.sources || [], keyPoints: raw.keyPoints || [], openQuestions: raw.openQuestions || [],
    readingLog: raw.readingLog || [], milestones: raw.milestones || [],
  } as Topic;
}

const BANK_EN = new Map<string, string>();
for (const items of Object.values(BANK)) for (const i of items) if (i.en) BANK_EN.set(i.title, i.en);

/** English title of a built-in subject with exactly this Vietnamese title, if any. Never guesses for custom text. */
export function bankEnglish(title: string): string { return BANK_EN.get(title.trim()) || ''; }

/** English title to show: the user's own (empty string hides it), else the bank title for an unchanged built-in subject. */
export function englishTitle(t: Pick<Topic, 'title' | 'titleEn'>): string {
  return t.titleEn !== undefined ? t.titleEn.trim() : bankEnglish(t.title);
}

/** Rename a topic; an English title that only came from the bank is dropped so it never describes a different subject. */
export function renameTopic(t: Topic, title: string): void {
  if (t.titleEn !== undefined && t.titleEn === bankEnglish(t.title)) delete t.titleEn;
  t.title = title;
}
