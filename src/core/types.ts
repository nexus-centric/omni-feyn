import type { Metrics, Scaffold } from './metrics.js';
import type { ReviewState } from './review.js';

export type Depth = 'minute' | 'day' | 'week' | 'deep';
export type Stage = 'explore' | 'understand' | 'explain' | 'review';

export interface Source { id: string; title: string; url: string; note: string; status: 'todo' | 'reading' | 'done'; }
export interface Item { id: string; text: string; done?: boolean; }
export interface LogEntry { id: string; date: string; minutes: number; sourceId?: string; note: string; }
export interface Milestone { id: string; text: string; due?: string; done: boolean; }

export interface Topic {
  id: string;
  title: string;
  depth: Depth;
  category?: string;
  coreQuestion: string;
  sources: Source[];
  keyPoints: Item[];
  openQuestions: Item[];
  stage: Stage;
  readingLog: LogEntry[];
  milestones: Milestone[];
  review: ReviewState | null;
  /** Starter search keywords (from the topic bank). */
  keywords?: string[];
  /** Id of the bank item this topic was drawn from. */
  bankId?: string;
  /** Editorial complexity of a bank subject (1 light, 2 medium, 3 heavy); scales the estimate only. */
  complexity?: 1 | 2 | 3;
  /** Optional suggestions from the bank. Shown as hideable hints, never required. */
  /** Optional English title; built-in subjects get it from the bank, custom topics only if the user writes one. */
  titleEn?: string;
  suggestions?: { disputed?: boolean; book?: boolean; core: string; plan: string[]; keywords: string[]; en: string; enTerms: string[]; sources: { title: string; url: string; org: string }[] };
  hideSuggestions?: boolean;
  /** User-adjustable plan: own hour range and session assumptions. */
  plan?: { hours?: [number, number]; sessionMin?: number; sessionsPerWeek?: number };
  /** Optional free-form notes. */
  direction?: string;
  understanding?: string;
  facts?: string;
  interpretation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  topicId: string;
  createdAt: string;
  durationSec: number;
  targetSec: number;
  scaffold: Scaffold;
  transcript: string;
  transcriptSource: 'whisper' | 'webspeech' | 'manual' | '';
  metrics: Metrics | null;
  audioId: string | null;
  isReview: boolean;
}

export const DEPTH_LABEL: Record<Depth, string> = {
  minute: '1 phút', day: '1 ngày', week: '1 tuần', deep: 'Đào sâu',
};
export const DEPTH_HINT: Record<Depth, string> = {
  minute: 'Bốc chủ đề, nói ngay theo phản xạ',
  day: 'Phạm vi gọn, thường đủ cho một ngày',
  week: 'Phạm vi rộng hơn, thường vài buổi trong tuần',
  deep: 'Chủ đề lớn, đi chậm theo nhịp của bạn',
};
export const DEPTH_TARGET_SEC: Record<Depth, number> = { minute: 60, day: 180, week: 300, deep: 600 };
export const STAGES: Stage[] = ['explore', 'understand', 'explain', 'review'];
export const STAGE_LABEL: Record<Stage, string> = {
  explore: 'Khám phá', understand: 'Hiểu', explain: 'Giải thích', review: 'Ôn lại',
};
export const STAGE_HINT: Record<Stage, string> = {
  explore: 'Đang dạo quanh chủ đề, gom nguồn',
  understand: 'Đang đọc và tự ghi lại ý của mình',
  explain: 'Thử giảng lại bằng lời đơn giản',
  review: 'Thỉnh thoảng giảng lại để nhớ lâu',
};
