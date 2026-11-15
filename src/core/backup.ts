// Versioned JSON backup of all user data: topics, attempts, settings and (optionally) audio.
// Pure functions so validation and merge rules are unit tested; IndexedDB access lives in src/db.ts.
import { normalizeTopic } from './topic.js';
import type { Attempt, Topic } from './types.js';

export const BACKUP_APP = 'omni-feyn';
/** v1: settings were top-level body* fields only. v2: a `settings` map with every user preference. */
export const BACKUP_VERSION = 2;
/** Above this many bytes of audio the UI warns that the file may be slow to save or open. */
export const AUDIO_WARN_BYTES = 50 * 1024 * 1024;

/** Settings keys that hold user data or preferences. `bodyToday` is a same-day override and is not backed up. */
export const SETTING_KEYS = ['settings', 'spinDepth', 'spinCat-minute', 'spinCat-day', 'spinCat-week', 'spinCat-deep', 'bodySessions', 'bodyWeek', 'bodyLevel'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export interface BackupData {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  topics: Topic[];
  attempts: Attempt[];
  /** audioId -> data URL. Empty when exported without audio. */
  audio: Record<string, string>;
  settings: Partial<Record<SettingKey, unknown>>;
}

export interface ParsedBackup { data: BackupData; dropped: number }
export interface Counts { topics: number; attempts: number; audio: number; bodySessions: number; settings: number }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const DAY_KINDS = ['strengthA', 'strengthB', 'cardio', 'mobility', 'rest'];
const DEPTHS = ['minute', 'day', 'week', 'deep'];

export function makeBackup(input: { topics: Topic[]; attempts: Attempt[]; audio: Record<string, string>; settings: Partial<Record<SettingKey, unknown>> }, now = new Date()): BackupData {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...input };
}

function validSetting(key: SettingKey, v: unknown): boolean {
  switch (key) {
    case 'settings': return isObj(v);
    case 'spinDepth': return str(v) && DEPTHS.includes(v);
    case 'bodySessions': return Array.isArray(v);
    case 'bodyWeek': return Array.isArray(v) && v.length === 7 && v.every((d) => str(d) && DAY_KINDS.includes(d));
    case 'bodyLevel': return v === 1 || v === 2 || v === 3;
    default: return str(v); // spinCat-*
  }
}

function cleanSessions(v: unknown[]): { kept: unknown[]; dropped: number } {
  const kept = v.filter((s) => isObj(s) && str(s.id) && str(s.date) && /^\d{4}-\d{2}-\d{2}$/.test(s.date));
  return { kept, dropped: v.length - kept.length };
}

function cleanAttempt(a: unknown, topicIds: Set<string>): Attempt | null {
  if (!isObj(a) || !str(a.id) || !str(a.topicId) || !topicIds.has(a.topicId) || !str(a.createdAt) || Number.isNaN(Date.parse(a.createdAt))) return null;
  return {
    id: a.id, topicId: a.topicId, createdAt: a.createdAt,
    durationSec: Number.isFinite(a.durationSec) ? Number(a.durationSec) : 0,
    targetSec: Number.isFinite(a.targetSec) ? Number(a.targetSec) : 60,
    scaffold: (['none', 'prep', 'branches', 'feynman'].includes(a.scaffold as string) ? a.scaffold : 'none') as Attempt['scaffold'],
    transcript: str(a.transcript) ? a.transcript : '',
    transcriptSource: (['whisper', 'webspeech', 'manual', ''].includes(a.transcriptSource as string) ? a.transcriptSource : '') as Attempt['transcriptSource'],
    metrics: isObj(a.metrics) ? (a.metrics as unknown as Attempt['metrics']) : null,
    audioId: str(a.audioId) ? a.audioId : null,
    isReview: a.isReview === true,
  };
}

/** Parses and validates a backup file. Throws a Vietnamese message for files that cannot be used at all. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Tệp không phải JSON hợp lệ.'); }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !Array.isArray(raw.topics)) throw new Error('Tệp này không phải bản sao lưu của Omni Feyn.');
  const version = raw.version ?? 1;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new Error('Bản sao lưu thiếu số phiên bản hợp lệ.');
  if (version > BACKUP_VERSION) throw new Error(`Bản sao lưu được tạo từ phiên bản mới hơn của ứng dụng (định dạng ${version}). Hãy tải lại trang để cập nhật rồi thử lại.`);
  let dropped = 0;

  const topics: Topic[] = [];
  const seen = new Set<string>();
  for (const t of raw.topics) {
    if (!isObj(t) || !str(t.id) || !str(t.title) || seen.has(t.id)) { dropped++; continue; }
    seen.add(t.id);
    topics.push(normalizeTopic(t as Partial<Topic> & { id: string; title: string }));
  }
  const attempts: Attempt[] = [];
  for (const a of Array.isArray(raw.attempts) ? raw.attempts : []) {
    const c = cleanAttempt(a, seen);
    if (c) attempts.push(c); else dropped++;
  }
  const wanted = new Set(attempts.map((a) => a.audioId).filter(Boolean) as string[]);
  const audio: Record<string, string> = {};
  for (const [id, url] of Object.entries(isObj(raw.audio) ? raw.audio : {})) {
    if (wanted.has(id) && str(url) && /^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,/.test(url)) audio[id] = url; else dropped++;
  }

  // v1 stored body data at the top level; v2 keeps every preference in `settings`.
  const src: Record<string, unknown> = version === 1
    ? { bodySessions: raw.bodySessions, bodyWeek: raw.bodyWeek, bodyLevel: raw.bodyLevel }
    : isObj(raw.settings) ? raw.settings : {};
  const settings: Partial<Record<SettingKey, unknown>> = {};
  for (const key of SETTING_KEYS) {
    const v = src[key];
    if (v === undefined || v === null) continue;
    if (!validSetting(key, v)) { dropped++; continue; }
    if (key === 'bodySessions') { const c = cleanSessions(v as unknown[]); dropped += c.dropped; settings[key] = c.kept; } else settings[key] = v;
  }
  return { data: { app: BACKUP_APP, version, exportedAt: str(raw.exportedAt) ? raw.exportedAt : '', topics, attempts, audio, settings }, dropped };
}

export function countBackup(d: Pick<BackupData, 'topics' | 'attempts' | 'audio' | 'settings'>): Counts {
  const sessions = d.settings.bodySessions;
  return {
    topics: d.topics.length, attempts: d.attempts.length, audio: Object.keys(d.audio).length,
    bodySessions: Array.isArray(sessions) ? sessions.length : 0,
    settings: Object.keys(d.settings).filter((k) => k !== 'bodySessions').length,
  };
}

export interface MergePlan {
  topics: Topic[];
  attempts: Attempt[];
  audio: Record<string, string>;
  /** Settings to write: body sessions are unioned by id; other keys only fill gaps so current preferences win. */
  settings: Partial<Record<SettingKey, unknown>>;
  added: Counts;
}

/** Merge never deletes or overwrites: records whose id already exists are kept as they are. */
export function planMerge(current: { topicIds: Iterable<string>; attemptIds: Iterable<string>; settings: Partial<Record<SettingKey, unknown>> }, incoming: BackupData): MergePlan {
  const tIds = new Set(current.topicIds), aIds = new Set(current.attemptIds);
  const topics = incoming.topics.filter((t) => !tIds.has(t.id));
  const attempts = incoming.attempts.filter((a) => !aIds.has(a.id));
  const audio: Record<string, string> = {};
  for (const a of attempts) if (a.audioId && incoming.audio[a.audioId]) audio[a.audioId] = incoming.audio[a.audioId];
  const settings: Partial<Record<SettingKey, unknown>> = {};
  let newSessions = 0;
  for (const key of SETTING_KEYS) {
    const inc = incoming.settings[key];
    if (inc === undefined) continue;
    const cur = current.settings[key];
    if (key === 'bodySessions') {
      const have = Array.isArray(cur) ? (cur as { id: string }[]) : [];
      const ids = new Set(have.map((s) => s.id));
      const extra = (inc as { id: string }[]).filter((s) => !ids.has(s.id));
      newSessions = extra.length;
      if (extra.length) settings[key] = [...have, ...extra];
    } else if (cur === undefined) settings[key] = inc;
  }
  return {
    topics, attempts, audio, settings,
    added: { topics: topics.length, attempts: attempts.length, audio: Object.keys(audio).length, bodySessions: newSessions, settings: Object.keys(settings).filter((k) => k !== 'bodySessions').length },
  };
}

/** Approximate decoded size of base64 data URLs in bytes. */
export function audioBytes(audio: Record<string, string>): number {
  let n = 0;
  for (const url of Object.values(audio)) { const b64 = url.slice(url.indexOf(',') + 1); const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0; n += Math.floor((b64.length * 3) / 4) - pad; }
  return n;
}
