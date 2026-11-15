import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BACKUP_VERSION, audioBytes, countBackup, makeBackup, parseBackup, planMerge } from '../src/core/backup.js';
import { normalizeTopic } from '../src/core/topic.js';
import type { Attempt } from '../src/core/types.js';

const topic = (id: string, title = 'Chủ đề ' + id) => normalizeTopic({ id, title });
const attempt = (id: string, topicId: string, audioId: string | null = null): Attempt => ({
  id, topicId, createdAt: '2026-11-10T10:00:00.000Z', durationSec: 62, targetSec: 60, scaffold: 'prep',
  transcript: 'xin chào', transcriptSource: 'manual', metrics: null, audioId, isReview: false,
});
const AUDIO = 'data:audio/webm;codecs=opus;base64,' + Buffer.from('fake-audio-bytes').toString('base64');

function sample() {
  return makeBackup({
    topics: [topic('t1'), topic('t2')],
    attempts: [attempt('a1', 't1', 'au1'), attempt('a2', 't2')],
    audio: { au1: AUDIO },
    settings: {
      settings: { engine: 'whisper', model: 'auto', device: 'auto', language: 'vietnamese', sound: false },
      spinDepth: 'week', 'spinCat-week': 'kinh-te',
      bodySessions: [{ id: 's1', date: '2026-11-09', rounds: 2, minutes: 20, moves: [], level: 1 }],
      bodyWeek: ['strengthA', 'cardio', 'strengthB', 'mobility', 'strengthA', 'cardio', 'rest'],
      bodyLevel: 2,
    },
  }, new Date('2026-11-15T07:00:00Z'));
}

test('round trip keeps every kind of user data', () => {
  const b = sample();
  assert.equal(b.version, BACKUP_VERSION);
  const { data, dropped } = parseBackup(JSON.stringify(b));
  assert.equal(dropped, 0);
  assert.deepEqual(countBackup(data), { topics: 2, attempts: 2, audio: 1, bodySessions: 1, settings: 5 });
  assert.equal((data.settings.settings as { sound: boolean }).sound, false);
  assert.equal(data.settings.spinDepth, 'week');
  assert.equal(data.audio.au1, AUDIO);
  assert.equal(data.attempts[0].transcript, 'xin chào');
});

test('rejects foreign files, bad JSON and newer versions', () => {
  assert.throws(() => parseBackup('{'), /JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'nhip', topics: [] })), /không phải bản sao lưu/);
  assert.throws(() => parseBackup(JSON.stringify({ ...sample(), version: BACKUP_VERSION + 1 })), /phiên bản mới hơn/);
  assert.throws(() => parseBackup(JSON.stringify({ ...sample(), version: 1.5 })), /phiên bản/);
});

test('reads version 1 files with top-level body data', () => {
  const v1 = {
    app: 'omni-feyn', version: 1, exportedAt: '2026-11-01T00:00:00Z',
    topics: [topic('t1')], attempts: [attempt('a1', 't1')], audio: {},
    bodySessions: [{ id: 's1', date: '2026-10-30' }], bodyWeek: null, bodyLevel: 3,
  };
  const { data } = parseBackup(JSON.stringify(v1));
  assert.equal(data.version, 1);
  assert.equal(data.settings.bodyLevel, 3);
  assert.equal((data.settings.bodySessions as unknown[]).length, 1);
  assert.equal(data.settings.bodyWeek, undefined);
});

test('drops invalid, orphaned and unsafe records and counts them', () => {
  const b = sample() as unknown as Record<string, unknown>;
  b.topics = [...(b.topics as unknown[]), { id: 'x' }, topic('t1')]; // no title, duplicate id
  b.attempts = [...(b.attempts as unknown[]), attempt('a9', 'missing-topic'), { id: 'bad' }];
  b.audio = { au1: AUDIO, orphan: AUDIO, au2: 'javascript:alert(1)' };
  (b.settings as Record<string, unknown>).bodyWeek = ['rest'];
  (b.settings as Record<string, unknown>).bodyLevel = 9;
  const { data, dropped } = parseBackup(JSON.stringify(b));
  assert.equal(data.topics.length, 2);
  assert.equal(data.attempts.length, 2);
  assert.deepEqual(Object.keys(data.audio), ['au1']);
  assert.equal(data.settings.bodyWeek, undefined);
  assert.equal(data.settings.bodyLevel, undefined);
  assert.equal(dropped, 2 + 2 + 2 + 2);
});

test('merge adds only new records, unions body sessions and keeps current preferences', () => {
  const { data } = parseBackup(JSON.stringify(sample()));
  const plan = planMerge({
    topicIds: ['t1'], attemptIds: ['a1'],
    settings: { spinDepth: 'minute', bodySessions: [{ id: 's0', date: '2026-11-01' }] },
  }, data);
  assert.deepEqual(plan.topics.map((t) => t.id), ['t2']);
  assert.deepEqual(plan.attempts.map((a) => a.id), ['a2']);
  assert.deepEqual(plan.audio, {}, 'audio follows only the attempts that are added');
  assert.equal(plan.settings.spinDepth, undefined, 'existing preference wins');
  assert.equal(plan.settings.bodyLevel, 2, 'missing preference is filled');
  assert.deepEqual((plan.settings.bodySessions as { id: string }[]).map((s) => s.id), ['s0', 's1']);
  assert.equal(plan.added.bodySessions, 1);
});

test('merging the same backup twice adds nothing', () => {
  const { data } = parseBackup(JSON.stringify(sample()));
  const plan = planMerge({ topicIds: ['t1', 't2'], attemptIds: ['a1', 'a2'], settings: data.settings }, data);
  assert.deepEqual(plan.added, { topics: 0, attempts: 0, audio: 0, bodySessions: 0, settings: 0 });
});

test('audio size estimate matches the decoded length', () => {
  assert.equal(audioBytes({ a: AUDIO }), Buffer.from('fake-audio-bytes').length);
  assert.equal(audioBytes({ a: 'data:audio/wav;base64,' + Buffer.from('abcd').toString('base64') }), 4);
});
