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
  day: 'Đọc vài nguồn, hiểu ý chính trong một ngày',
  week: 'Tìm hiểu có hệ thống trong một tuần',
  deep: 'Hàng tuần đến hàng tháng: nhật ký đọc, cột mốc',
};
export const DEPTH_TARGET_SEC: Record<Depth, number> = { minute: 60, day: 180, week: 300, deep: 600 };
export const STAGES: Stage[] = ['explore', 'understand', 'explain', 'review'];
export const STAGE_LABEL: Record<Stage, string> = {
  explore: 'Khám phá', understand: 'Hiểu', explain: 'Giải thích', review: 'Ôn lại',
};
export const STAGE_HINT: Record<Stage, string> = {
  explore: 'Gom nguồn, ghi câu hỏi cốt lõi',
  understand: 'Đọc, rút ý chính, ghi câu hỏi mở',
  explain: 'Giảng lại bằng lời đơn giản, tìm lỗ hổng',
  review: 'Ôn theo lịch giãn cách',
};
