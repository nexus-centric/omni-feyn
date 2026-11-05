// Spaced review scheduling. Expanding intervals in days.
export const REVIEW_STEPS = [1, 3, 7, 21, 60];

export interface ReviewState { step: number; due: string | null; history: { date: string; score: number }[]; }

export function toDay(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return toDay(new Date(y, m - 1, d + n));
}

/** Start the schedule (first review tomorrow). */
export function startReview(today: string): ReviewState {
  return { step: 0, due: addDays(today, REVIEW_STEPS[0]), history: [] };
}

/**
 * Record a review attempt. Good score (>=70) moves one step up, weak score (<50) drops back
 * to the first interval, anything between repeats the same interval.
 */
export function recordReview(state: ReviewState, today: string, score: number): ReviewState {
  let step = state.step;
  if (score >= 70) step = Math.min(step + 1, REVIEW_STEPS.length - 1);
  else if (score < 50) step = 0;
  return { step, due: addDays(today, REVIEW_STEPS[step]), history: [...state.history, { date: today, score }] };
}

export function isDue(state: ReviewState | null | undefined, today: string): boolean {
  return !!state?.due && state.due <= today;
}
