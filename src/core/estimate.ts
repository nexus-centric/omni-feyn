// Adjustable planning estimates. These are editorial starting points, not validated completion times.
import type { Depth } from './types.js';
import type { Complexity } from './bank-meta.js';

/** Active study hours (reading, notes, speaking), low and high, by depth and complexity. */
const EFFORT: Record<Exclude<Depth, 'minute'>, Record<Complexity, [number, number]>> = {
  day: { 1: [1.5, 3], 2: [2.5, 5], 3: [4, 8] },
  week: { 1: [4, 8], 2: [7, 14], 3: [12, 22] },
  deep: { 1: [12, 25], 2: [25, 50], 3: [45, 90] },
};
/** Default session assumptions per depth; the user can change both. */
export const DEFAULT_PACE: Record<Exclude<Depth, 'minute'>, { sessionMin: number; sessionsPerWeek: number }> = {
  day: { sessionMin: 90, sessionsPerWeek: 7 },
  week: { sessionMin: 60, sessionsPerWeek: 5 },
  deep: { sessionMin: 45, sessionsPerWeek: 4 },
};

export interface PlanSettings { hours?: [number, number]; sessionMin?: number; sessionsPerWeek?: number; }
export interface Estimate {
  hours: [number, number];
  sessionMin: number;
  sessionsPerWeek: number;
  sessions: [number, number];
  /** Calendar days at the given pace, low and high. */
  days: [number, number];
  custom: boolean;
}

export function suggestedHours(depth: Depth, complexity: Complexity = 2): [number, number] | null {
  return depth === 'minute' ? null : EFFORT[depth][complexity];
}

export function estimate(depth: Depth, complexity: Complexity = 2, plan: PlanSettings = {}): Estimate | null {
  const base = suggestedHours(depth, complexity);
  if (!base) return null;
  const d = DEFAULT_PACE[depth as Exclude<Depth, 'minute'>];
  const hours = plan.hours && plan.hours[0] > 0 && plan.hours[1] >= plan.hours[0] ? plan.hours : base;
  const sessionMin = Math.max(10, plan.sessionMin || d.sessionMin);
  const sessionsPerWeek = Math.min(14, Math.max(1, plan.sessionsPerWeek || d.sessionsPerWeek));
  const sessions: [number, number] = [Math.ceil((hours[0] * 60) / sessionMin), Math.ceil((hours[1] * 60) / sessionMin)];
  const toDays = (n: number) => Math.max(1, Math.ceil((n / sessionsPerWeek) * 7));
  return { hours, sessionMin, sessionsPerWeek, sessions, days: [toDays(sessions[0]), toDays(sessions[1])], custom: !!(plan.hours || plan.sessionMin || plan.sessionsPerWeek) };
}

/** Human-readable calendar window in Vietnamese, e.g. "khoảng 2-4 tuần". */
export function windowLabel(days: [number, number]): string {
  const [a, b] = days;
  if (b <= 10) return a === b ? `khoảng ${a} ngày` : `khoảng ${a}-${b} ngày`;
  const w = (n: number) => Math.round(n / 7);
  if (b <= 70) return `khoảng ${Math.max(1, w(a))}-${Math.max(1, w(b))} tuần`;
  const m = (n: number) => Math.max(1, Math.round(n / 30));
  return `khoảng ${m(a)}-${m(b)} tháng`;
}

export function fmtHours(h: [number, number]): string {
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  return `${f(h[0])}-${f(h[1])} giờ`;
}
