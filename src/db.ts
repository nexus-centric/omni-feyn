// IndexedDB storage: topics, attempts, audio blobs, settings. No dependencies.
import type { Attempt, Topic } from './core/types';

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
    const all = (await p((await store('topics')).getAll())) as Topic[];
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async topic(id: string): Promise<Topic | undefined> { return p((await store('topics')).get(id)) as Promise<Topic | undefined>; },
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

function blobToB64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}

export async function exportBackup(includeAudio: boolean): Promise<Blob> {
  const topics = await db.topics();
  const attempts = await db.attempts();
  const audio: Record<string, string> = {};
  if (includeAudio) for (const a of attempts) if (a.audioId) { const b = await db.audio(a.audioId); if (b) audio[a.audioId] = await blobToB64(b); }
  const data = { app: 'omni-feyn', version: 1, exportedAt: new Date().toISOString(), topics, attempts, audio };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<{ topics: number; attempts: number }> {
  const data = JSON.parse(await file.text());
  if (data.app !== 'omni-feyn' || !Array.isArray(data.topics)) throw new Error('Tệp sao lưu không hợp lệ');
  for (const t of data.topics as Topic[]) await p((await store('topics', 'readwrite')).put(t));
  for (const a of (data.attempts || []) as Attempt[]) await db.saveAttempt(a);
  for (const [id, url] of Object.entries((data.audio || {}) as Record<string, string>)) {
    await db.saveAudio(id, await (await fetch(url)).blob());
  }
  return { topics: data.topics.length, attempts: (data.attempts || []).length };
}

export function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
