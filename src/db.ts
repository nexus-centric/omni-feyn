// IndexedDB storage: topics, attempts, audio blobs, settings. No dependencies.
import type { Attempt, Topic } from './core/types';
import { englishTitle, normalizeTopic } from './core/topic';
import { SETTING_KEYS, countBackup, makeBackup, parseBackup, planMerge, type Counts, type MergePlan, type ParsedBackup, type SettingKey } from './core/backup';

const DB_NAME = 'omni-feyn';
const VERSION = 1;
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('topics', { keyPath: 'id' });
      const a = db.createObjectStore('attempts', { keyPath: 'id' });
      a.createIndex('topicId', 'topicId');
      db.createObjectStore('audio');
      db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function p<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

async function store(name: string, mode: IDBTransactionMode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name);
}

export const db = {
  async topics(): Promise<Topic[]> {
    const all = ((await p((await store('topics')).getAll())) as Topic[]).map(normalizeTopic);
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async topic(id: string): Promise<Topic | undefined> { const t = (await p((await store('topics')).get(id))) as Topic | undefined; return t && normalizeTopic(t); },
  async saveTopic(t: Topic): Promise<void> { t.updatedAt = new Date().toISOString(); await p((await store('topics', 'readwrite')).put(t)); },
  async deleteTopic(id: string): Promise<void> {
    for (const a of await db.attempts(id)) await db.deleteAttempt(a);
    await p((await store('topics', 'readwrite')).delete(id));
  },
  async attempts(topicId?: string): Promise<Attempt[]> {
    const s = await store('attempts');
    const all = (await p(topicId ? s.index('topicId').getAll(topicId) : s.getAll())) as Attempt[];
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async saveAttempt(a: Attempt): Promise<void> { await p((await store('attempts', 'readwrite')).put(a)); },
  async deleteAttempt(a: Attempt): Promise<void> {
    if (a.audioId) await p((await store('audio', 'readwrite')).delete(a.audioId));
    await p((await store('attempts', 'readwrite')).delete(a.id));
  },
  async audio(id: string): Promise<Blob | undefined> { return p((await store('audio')).get(id)) as Promise<Blob | undefined>; },
  async saveAudio(id: string, blob: Blob): Promise<void> { await p((await store('audio', 'readwrite')).put(blob, id)); },
  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const v = await p((await store('settings')).get(key));
    return (v === undefined ? fallback : v) as T;
  },
  async setSetting(key: string, value: unknown): Promise<void> { await p((await store('settings', 'readwrite')).put(value, key)); },
};

// ---------- backup ----------
// Format, validation and merge rules: src/core/backup.ts (unit tested).

function blobToB64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}

function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',');
  const mime = url.slice(5, comma).split(';')[0] || 'application/octet-stream';
  const bin = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function currentSettings(): Promise<Partial<Record<SettingKey, unknown>>> {
  const out: Partial<Record<SettingKey, unknown>> = {};
  for (const k of SETTING_KEYS) { const v = await db.getSetting<unknown>(k, undefined); if (v !== undefined && v !== null) out[k] = v; }
  return out;
}

/** Total size of stored recordings in bytes, to show before exporting with audio. */
export async function storedAudioBytes(): Promise<{ count: number; bytes: number }> {
  let count = 0, bytes = 0;
  for (const a of await db.attempts()) if (a.audioId) { const b = await db.audio(a.audioId); if (b) { count++; bytes += b.size; } }
  return { count, bytes };
}

export async function exportBackup(includeAudio: boolean): Promise<{ blob: Blob; counts: Counts }> {
  const topics = (await db.topics()).map((t) => (t.titleEn === undefined && englishTitle(t) ? { ...t, titleEn: englishTitle(t) } : t));
  const attempts = await db.attempts();
  const audio: Record<string, string> = {};
  if (includeAudio) for (const a of attempts) if (a.audioId) { const b = await db.audio(a.audioId); if (b) audio[a.audioId] = await blobToB64(b); }
  const data = makeBackup({ topics, attempts, audio, settings: await currentSettings() });
  return { blob: new Blob([JSON.stringify(data)], { type: 'application/json' }), counts: countBackup(data) };
}

export interface ImportPreview { parsed: ParsedBackup; file: Counts; current: Counts; merge: MergePlan }

export async function previewBackup(text: string): Promise<ImportPreview> {
  const parsed = parseBackup(text);
  const topics = await db.topics();
  const attempts = await db.attempts();
  const settings = await currentSettings();
  let audio = 0; for (const a of attempts) if (a.audioId) audio++;
  const current: Counts = { ...countBackup({ topics, attempts, audio: {}, settings }), audio };
  const merge = planMerge({ topicIds: topics.map((t) => t.id), attemptIds: attempts.map((a) => a.id), settings }, parsed.data);
  return { parsed, file: countBackup(parsed.data), current, merge };
}

/** Writes a previewed backup in one IndexedDB transaction, so a failure leaves the current data untouched. */
export async function applyBackup(pre: ImportPreview, mode: 'merge' | 'replace'): Promise<Counts> {
  const d = pre.parsed.data;
  const src = mode === 'merge' ? pre.merge : { topics: d.topics, attempts: d.attempts, audio: d.audio, settings: d.settings };
  const blobs = Object.entries(src.audio).map(([id, url]) => [id, dataUrlToBlob(url)] as const);
  const conn = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = conn.transaction(['topics', 'attempts', 'audio', 'settings'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Đã huỷ khôi phục'));
    const [ts, as, au, st] = (['topics', 'attempts', 'audio', 'settings'] as const).map((n) => tx.objectStore(n));
    if (mode === 'replace') { ts.clear(); as.clear(); au.clear(); for (const k of SETTING_KEYS) st.delete(k); }
    for (const t of src.topics) ts.put(t);
    for (const a of src.attempts) as.put(a);
    for (const [id, b] of blobs) au.put(b, id);
    for (const [k, v] of Object.entries(src.settings)) st.put(v, k);
  });
  return mode === 'merge' ? pre.merge.added : pre.file;
}

export function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
