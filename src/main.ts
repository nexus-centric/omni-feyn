import './style.css';
import { h, toast, fmtTime, fmtDate, trendChart } from './ui';
import { db, uid, exportBackup, importBackup } from './db';
import { TOPIC_BANK, randomPrompt } from './topic-bank';
import { Recorder, decodeTo16k } from './audio';
import { transcribeWhisper, WHISPER_MODELS, LiveSpeech, webSpeechSupported, type WhisperModel } from './asr';
import { computeMetrics, detectPauses, pausesFromChunks, PACE_RANGE, type Metrics, type Scaffold } from './core/metrics';
import { reviewBundle } from './core/bundle';
import { isDue, recordReview, startReview, toDay, REVIEW_STEPS } from './core/review';
import { DEPTH_HINT, DEPTH_LABEL, DEPTH_TARGET_SEC, STAGES, STAGE_HINT, STAGE_LABEL, type Attempt, type Depth, type Topic } from './core/types';

const app = document.getElementById('app')!;
const today = () => toDay(new Date());

interface Settings { engine: 'whisper' | 'webspeech'; model: WhisperModel; device: 'auto' | 'webgpu' | 'wasm'; }
let settings: Settings = { engine: 'whisper', model: 'onnx-community/whisper-base', device: 'auto' };

// ---------- routing ----------

const NAV: [string, string][] = [['#/', 'Hôm nay'], ['#/reflex', 'Phản xạ'], ['#/topics', 'Chủ đề'], ['#/settings', 'Cài đặt']];
let cleanup: (() => void) | null = null;

async function route() {
  cleanup?.(); cleanup = null;
  const hash = location.hash || '#/';
  const [, view, id] = hash.split('?')[0].split('/');
  const main = h('main', { class: 'view' });
  let content: HTMLElement;
  try {
    if (view === 'reflex') content = await reflexView();
    else if (view === 'topics') content = await topicsView();
    else if (view === 'topic' && id) content = await topicView(id);
    else if (view === 'practice' && id) content = await practiceView(id);
    else if (view === 'settings') content = await settingsView();
    else content = await homeView();
  } catch (e) {
    content = h('section', { class: 'card' }, h('h2', null, 'Có lỗi'), h('p', null, String(e)));
  }
  main.append(content);
  const active = '#/' + (view === 'topic' || view === 'practice' ? 'topics' : view || '');
  const header = h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), 'Omni Feyn'),
    h('nav', null, NAV.map(([href, label]) => h('a', { href, class: href === active || (href === '#/' && active === '#/') ? 'on' : '' }, label))));
  app.replaceChildren(header, main);
  window.scrollTo(0, 0);
}

function go(hash: string) { if (location.hash === hash) route(); else location.hash = hash; }

// ---------- topic helpers ----------

function newTopic(title: string, depth: Depth, category?: string): Topic {
  const now = new Date().toISOString();
  return { id: uid(), title, depth, category, coreQuestion: '', sources: [], keyPoints: [], openQuestions: [], stage: 'explore', readingLog: [], milestones: [], review: null, createdAt: now, updatedAt: now };
}

function depthChip(d: Depth) { return h('span', { class: `chip depth-${d}` }, DEPTH_LABEL[d]); }

function stageBar(t: Topic, onPick?: (s: Topic['stage']) => void) {
  const idx = STAGES.indexOf(t.stage);
  return h('ol', { class: 'stages' }, STAGES.map((s, i) => h('li', { class: i < idx ? 'done' : i === idx ? 'now' : '' },
    onPick ? h('button', { type: 'button', onclick: () => onPick(s), title: STAGE_HINT[s] }, STAGE_LABEL[s]) : h('span', null, STAGE_LABEL[s]))));
}

// ---------- home ----------

async function homeView() {
  const topics = await db.topics();
  const attempts = await db.attempts();
  const due = topics.filter((t) => isDue(t.review, today()));
  const minutes = Math.round(attempts.reduce((s, a) => s + a.durationSec, 0) / 60);
  const readMin = topics.reduce((s, t) => s + t.readingLog.reduce((x, l) => x + l.minutes, 0), 0);
  const active = topics.filter((t) => t.depth !== 'minute').slice(0, 6);

  return h('div', { class: 'stack' },
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'Học sâu, nói rõ'),
      h('h1', null, 'Hiểu thật sự một chủ đề, rồi giảng lại nó bằng lời của bạn.'),
      h('p', { class: 'lead' }, 'Chọn độ sâu, ghi chép nguồn, luyện nói có hẹn giờ, đo chỉ số và ôn lại theo lịch giãn cách. Mọi thứ nằm trên máy của bạn.'),
      h('div', { class: 'stats' },
        stat(String(topics.length), 'chủ đề'), stat(String(attempts.length), 'lượt nói'), stat(`${minutes}`, 'phút đã nói'), stat(`${readMin}`, 'phút đọc'))),
    h('section', { class: 'card' },
      h('div', { class: 'row-between' }, h('h2', null, 'Cần ôn hôm nay'), h('span', { class: 'muted' }, `${due.length} chủ đề`)),
      due.length ? h('ul', { class: 'list' }, due.map((t) => h('li', null,
        h('a', { href: `#/topic/${t.id}` }, t.title), depthChip(t.depth),
        h('button', { class: 'btn small', onclick: () => go(`#/practice/${t.id}`) }, 'Giảng lại')))) :
        h('p', { class: 'muted' }, 'Không có gì đến hạn. Bật "lịch ôn" trong một chủ đề để được nhắc giảng lại sau 1, 3, 7, 21 ngày.')),
    h('section', null, h('h2', { class: 'section-title' }, 'Bắt đầu theo độ sâu'),
      h('div', { class: 'depth-grid' }, (Object.keys(DEPTH_LABEL) as Depth[]).map((d) => h('button', {
        class: `depth-card depth-${d}`, onclick: () => d === 'minute' ? go('#/reflex') : go(`#/topics?new=${d}`),
      }, h('strong', null, DEPTH_LABEL[d]), h('span', null, DEPTH_HINT[d]))))),
    h('section', { class: 'card' }, h('h2', null, 'Đang học'),
      active.length ? h('ul', { class: 'list' }, active.map((t) => h('li', null,
        h('a', { href: `#/topic/${t.id}` }, t.title), depthChip(t.depth), h('span', { class: 'muted small' }, STAGE_LABEL[t.stage])))) :
        h('p', { class: 'muted' }, 'Chưa có chủ đề dài hạn. Thử tạo một chủ đề "Đào sâu" cho thứ bạn muốn hiểu tận gốc.')),
  );
}

function stat(v: string, l: string) { return h('div', { class: 'stat' }, h('b', null, v), h('span', null, l)); }

// ---------- reflex (1 minute) ----------

async function reflexView() {
  let cat = await db.getSetting<string>('reflexCat', 'all');
  let current = randomPrompt(cat);
  const promptEl = h('p', { class: 'prompt' }, current.prompt);
  const catEl = h('span', { class: 'chip' }, current.category.name);
  const spin = () => {
    promptEl.classList.remove('pop'); void promptEl.offsetWidth;
    current = randomPrompt(cat, current.prompt);
    promptEl.textContent = current.prompt; catEl.textContent = current.category.name;
    promptEl.classList.add('pop');
  };
  const start = async () => {
    const topics = await db.topics();
    let t = topics.find((x) => x.title === current.prompt && x.depth === 'minute');
    if (!t) { t = newTopic(current.prompt, 'minute', current.category.name); t.coreQuestion = current.prompt; t.stage = 'explain'; await db.saveTopic(t); }
    go(`#/practice/${t.id}?scaffold=prep`);
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); spin(); } else if (e.key === 'Enter') { e.preventDefault(); start(); }
  };
  window.addEventListener('keydown', onKey);
  cleanup = () => window.removeEventListener('keydown', onKey);

  return h('div', { class: 'stack narrow' },
    h('section', { class: 'card reflex' },
      h('p', { class: 'eyebrow' }, 'Phản xạ 1 phút - khung P.R.E.P'),
      h('label', { class: 'field inline' }, 'Nhóm chủ đề',
        h('select', { onchange: (e: Event) => { cat = (e.target as HTMLSelectElement).value; db.setSetting('reflexCat', cat); spin(); } },
          h('option', { value: 'all', selected: cat === 'all' }, 'Tất cả'),
          TOPIC_BANK.map((c) => h('option', { value: c.id, selected: cat === c.id }, `${c.name} (${c.prompts.length})`)))),
      catEl, promptEl,
      h('div', { class: 'actions center' },
        h('button', { class: 'btn ghost', onclick: spin }, 'Đổi chủ đề'),
        h('button', { class: 'btn primary big', onclick: start }, 'Nói ngay 60 giây')),
      h('p', { class: 'muted small center' }, 'Phím tắt: Space để đổi, Enter để bắt đầu')),
    h('section', { class: 'card' }, h('h2', null, 'Khung P.R.E.P'),
      h('ol', { class: 'prep-guide' },
        h('li', null, h('b', null, 'Point'), ' - nêu quan điểm ngay câu đầu ("Theo tôi...").'),
        h('li', null, h('b', null, 'Reason'), ' - một hoặc hai lý do chính ("Vì...").'),
        h('li', null, h('b', null, 'Example'), ' - ví dụ cụ thể, số liệu, câu chuyện ("Ví dụ...").'),
        h('li', null, h('b', null, 'Point'), ' - chốt lại quan điểm ("Tóm lại...").'))),
  );
}

// ---------- topics list ----------

async function topicsView() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const topics = await db.topics();
  const attempts = await db.attempts();
  let filter: Depth | 'all' = 'all';
  const listEl = h('div', { class: 'topic-grid' });
  const render = () => {
    const shown = topics.filter((t) => filter === 'all' || t.depth === filter);
    listEl.replaceChildren(...(shown.length ? shown.map((t) => {
      const n = attempts.filter((a) => a.topicId === t.id);
      const last = n[n.length - 1]?.metrics?.score;
      return h('a', { class: 'topic-card', href: `#/topic/${t.id}` },
        h('div', { class: 'row-between' }, depthChip(t.depth), isDue(t.review, today()) ? h('span', { class: 'chip due' }, 'Đến hạn ôn') : null),
        h('h3', null, t.title),
        t.coreQuestion && t.coreQuestion !== t.title ? h('p', { class: 'muted small clamp' }, t.coreQuestion) : null,
        stageBar(t),
        h('p', { class: 'muted small' }, `${t.keyPoints.length} ý chính · ${t.sources.length} nguồn · ${n.length} lượt nói${last !== undefined ? ` · điểm gần nhất ${last}` : ''}`));
    }) : [h('p', { class: 'muted' }, 'Chưa có chủ đề nào ở mức này.')]));
  };
  render();

  const depthSel = h('select', { name: 'depth' }, (Object.keys(DEPTH_LABEL) as Depth[]).map((d) => h('option', { value: d, selected: (params.get('new') || 'day') === d }, `${DEPTH_LABEL[d]} - ${DEPTH_HINT[d]}`)));
  const titleIn = h('input', { name: 'title', required: true, placeholder: 'Ví dụ: Khủng hoảng năng lượng châu Âu 2022', autocomplete: 'off' });
  const qIn = h('input', { name: 'q', placeholder: 'Câu hỏi cốt lõi: Vì sao...? Cái gì thực sự gây ra...?', autocomplete: 'off' });
  const form = h('form', { class: 'card new-topic', onsubmit: async (e: Event) => {
    e.preventDefault();
    const t = newTopic(titleIn.value.trim(), depthSel.value as Depth);
    t.coreQuestion = qIn.value.trim();
    if (t.depth === 'deep') t.milestones = [
      { id: uid(), text: 'Đọc tổng quan, ghi 5 câu hỏi', done: false },
      { id: uid(), text: 'Đọc nguồn sơ cấp / số liệu gốc', done: false },
      { id: uid(), text: 'Viết dàn ý giải thích một trang', done: false },
      { id: uid(), text: 'Giảng lại 10 phút không nhìn ghi chú', done: false },
    ];
    await db.saveTopic(t); go(`#/topic/${t.id}`);
  } },
    h('h2', null, 'Chủ đề mới'),
    h('label', { class: 'field' }, 'Tên chủ đề', titleIn),
    h('label', { class: 'field' }, 'Câu hỏi cốt lõi', qIn),
    h('label', { class: 'field' }, 'Độ sâu', depthSel),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary' }, 'Tạo chủ đề')));
  if (params.get('new')) setTimeout(() => titleIn.focus(), 50);

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, (['all', 'minute', 'day', 'week', 'deep'] as const).map((d) =>
    h('button', { role: 'tab', class: d === filter ? 'on' : '', onclick: (e: Event) => {
      filter = d; tabs.querySelectorAll('button').forEach((b) => b.classList.remove('on')); (e.target as HTMLElement).classList.add('on'); render();
    } }, d === 'all' ? 'Tất cả' : DEPTH_LABEL[d])));

  return h('div', { class: 'stack' }, h('div', { class: 'two-col' },
    h('div', { class: 'stack' }, h('div', { class: 'row-between wrap' }, h('h1', null, 'Chủ đề'), tabs), listEl), form));
}

// ---------- topic detail ----------

function editableList(title: string, items: Topic['keyPoints'], placeholder: string, save: () => void, opts: { check?: boolean; hint?: string } = {}) {
  const ul = h('ul', { class: 'items' });
  const render = () => ul.replaceChildren(...items.map((it, i) => h('li', { class: it.done ? 'done' : '' },
    opts.check ? h('input', { type: 'checkbox', checked: it.done, 'aria-label': 'Đã giải quyết', onchange: (e: Event) => { it.done = (e.target as HTMLInputElement).checked; save(); render(); } }) : h('span', { class: 'bullet' }),
    h('span', { class: 'txt', contenteditable: 'true', onblur: (e: Event) => { const v = (e.target as HTMLElement).textContent!.trim(); if (v) { it.text = v; save(); } } }, it.text),
    h('button', { class: 'icon-btn', title: 'Xoá', 'aria-label': 'Xoá', onclick: () => { items.splice(i, 1); save(); render(); } }, '×'))));
  render();
  const input = h('input', { placeholder, autocomplete: 'off' });
  return h('section', { class: 'card' }, h('h2', null, title), opts.hint ? h('p', { class: 'muted small' }, opts.hint) : null, ul,
    h('form', { class: 'add-row', onsubmit: (e: Event) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; items.push({ id: uid(), text: v, done: false }); input.value = ''; save(); render(); } },
      input, h('button', { class: 'btn small' }, 'Thêm')));
}

async function topicView(id: string) {
  const t = await db.topic(id);
  if (!t) return h('section', { class: 'card' }, h('p', null, 'Không tìm thấy chủ đề.'));
  const attempts = await db.attempts(id);
  const save = () => db.saveTopic(t);
  const refresh = () => route();

  const head = h('section', { class: 'card topic-head' },
    h('div', { class: 'row-between wrap' }, h('div', { class: 'row' }, depthChip(t.depth), t.category ? h('span', { class: 'chip' }, t.category) : null),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost small', onclick: async () => { await navigator.clipboard.writeText(reviewBundle(t, attempts[attempts.length - 1] || null)); toast('Đã sao chép gói Markdown'); } }, 'Sao chép để review'),
        h('button', { class: 'btn primary', onclick: () => go(`#/practice/${t.id}`) }, 'Luyện nói'))),
    h('h1', { contenteditable: 'true', class: 'editable', onblur: (e: Event) => { t.title = (e.target as HTMLElement).textContent!.trim() || t.title; save(); } }, t.title),
    h('label', { class: 'field' }, 'Câu hỏi cốt lõi',
      h('textarea', { rows: 2, placeholder: 'Nếu chỉ được trả lời một câu hỏi về chủ đề này, đó là câu gì?', onchange: (e: Event) => { t.coreQuestion = (e.target as HTMLTextAreaElement).value; save(); } }, t.coreQuestion)),
    h('div', { class: 'field' }, h('span', null, 'Tiến độ'), stageBar(t, (s) => { t.stage = s; save().then(refresh); }), h('p', { class: 'muted small' }, STAGE_HINT[t.stage])),
    h('div', { class: 'row wrap' }, h('label', { class: 'field inline' }, 'Độ sâu',
      h('select', { onchange: (e: Event) => { t.depth = (e.target as HTMLSelectElement).value as Depth; save().then(refresh); } },
        (Object.keys(DEPTH_LABEL) as Depth[]).map((d) => h('option', { value: d, selected: d === t.depth }, DEPTH_LABEL[d])))),
      h('button', { class: 'btn ghost small danger', onclick: async () => { if (confirm('Xoá chủ đề này và mọi bản ghi âm?')) { await db.deleteTopic(t.id); go('#/topics'); } } }, 'Xoá chủ đề')));

  // sources
  const srcList = h('ul', { class: 'sources' });
  const renderSrc = () => srcList.replaceChildren(...t.sources.map((s, i) => h('li', { class: `src ${s.status}` },
    h('div', { class: 'row-between' },
      s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title || s.url) : h('b', null, s.title),
      h('div', { class: 'row' },
        h('select', { class: 'mini', 'aria-label': 'Trạng thái', onchange: (e: Event) => { s.status = (e.target as HTMLSelectElement).value as any; save(); renderSrc(); } },
          [['todo', 'Chưa đọc'], ['reading', 'Đang đọc'], ['done', 'Đã đọc']].map(([v, l]) => h('option', { value: v, selected: s.status === v }, l))),
        h('button', { class: 'icon-btn', 'aria-label': 'Xoá nguồn', onclick: () => { t.sources.splice(i, 1); save(); renderSrc(); } }, '×'))),
    h('textarea', { rows: 2, class: 'note', placeholder: 'Ghi chú, trích dẫn, ý rút ra từ nguồn này...', onchange: (e: Event) => { s.note = (e.target as HTMLTextAreaElement).value; save(); } }, s.note))));
  renderSrc();
  const sTitle = h('input', { placeholder: 'Tên nguồn (sách, bài báo, video)', autocomplete: 'off' });
  const sUrl = h('input', { placeholder: 'https://...', type: 'url', autocomplete: 'off' });
  const sources = h('section', { class: 'card' }, h('h2', null, 'Nguồn & ghi chú'),
    h('p', { class: 'muted small' }, 'Ưu tiên nguồn gốc (báo cáo, số liệu, sách) hơn tóm tắt lại. Ghi ý bằng lời của bạn.'), srcList,
    h('form', { class: 'add-row', onsubmit: (e: Event) => { e.preventDefault(); if (!sTitle.value.trim() && !sUrl.value.trim()) return;
      t.sources.push({ id: uid(), title: sTitle.value.trim(), url: sUrl.value.trim(), note: '', status: 'todo' }); sTitle.value = sUrl.value = ''; save(); renderSrc(); } },
      sTitle, sUrl, h('button', { class: 'btn small' }, 'Thêm')));

  // reading log + milestones
  const longForm = t.depth === 'week' || t.depth === 'deep';
  const logList = h('ul', { class: 'log' });
  const renderLog = () => {
    const total = t.readingLog.reduce((s, l) => s + l.minutes, 0);
    logList.replaceChildren(h('li', { class: 'muted small' }, `Tổng: ${total} phút trong ${new Set(t.readingLog.map((l) => l.date)).size} ngày`),
      ...[...t.readingLog].reverse().map((l) => h('li', null, h('span', { class: 'date' }, l.date), h('span', { class: 'mins' }, `${l.minutes} ph`),
        h('span', null, (l.sourceId ? (t.sources.find((s) => s.id === l.sourceId)?.title || '') + ': ' : '') + l.note))));
  };
  renderLog();
  const lMin = h('input', { type: 'number', min: 1, value: 30, 'aria-label': 'Số phút', class: 'num' });
  const lSrc = h('select', { 'aria-label': 'Nguồn' }, h('option', { value: '' }, '(không gắn nguồn)'), t.sources.map((s) => h('option', { value: s.id }, s.title || s.url)));
  const lNote = h('input', { placeholder: 'Hôm nay đọc gì, hiểu thêm gì?', autocomplete: 'off' });
  const ms = h('ul', { class: 'items' });
  const renderMs = () => ms.replaceChildren(...t.milestones.map((m, i) => h('li', { class: m.done ? 'done' : '' },
    h('input', { type: 'checkbox', checked: m.done, 'aria-label': 'Hoàn thành', onchange: (e: Event) => { m.done = (e.target as HTMLInputElement).checked; save(); renderMs(); } }),
    h('span', { class: 'txt' }, m.text), m.due ? h('span', { class: 'chip small' }, m.due) : null,
    h('button', { class: 'icon-btn', 'aria-label': 'Xoá', onclick: () => { t.milestones.splice(i, 1); save(); renderMs(); } }, '×'))));
  renderMs();
  const mText = h('input', { placeholder: 'Cột mốc mới', autocomplete: 'off' });
  const mDue = h('input', { type: 'date', 'aria-label': 'Hạn' });
  const journal = h('section', { class: 'card' + (longForm ? '' : ' subtle') }, h('h2', null, 'Nhật ký đọc & cột mốc'),
    !longForm ? h('p', { class: 'muted small' }, 'Dành cho chủ đề 1 tuần hoặc Đào sâu, nhưng bạn vẫn có thể dùng.') : null,
    h('h3', null, 'Cột mốc'), ms,
    h('form', { class: 'add-row', onsubmit: (e: Event) => { e.preventDefault(); if (!mText.value.trim()) return; t.milestones.push({ id: uid(), text: mText.value.trim(), due: mDue.value || undefined, done: false }); mText.value = ''; mDue.value = ''; save(); renderMs(); } },
      mText, mDue, h('button', { class: 'btn small' }, 'Thêm')),
    h('h3', null, 'Nhật ký đọc'),
    h('form', { class: 'add-row', onsubmit: (e: Event) => { e.preventDefault(); t.readingLog.push({ id: uid(), date: today(), minutes: Number(lMin.value) || 0, sourceId: lSrc.value || undefined, note: lNote.value.trim() }); lNote.value = ''; save(); renderLog(); } },
      lMin, lSrc, lNote, h('button', { class: 'btn small' }, 'Ghi')), logList);

  // review
  const rv = t.review;
  const review = h('section', { class: 'card' }, h('h2', null, 'Lịch ôn giãn cách'),
    h('p', { class: 'muted small' }, `Giảng lại sau ${REVIEW_STEPS.join(', ')} ngày. Điểm từ 70 lên bậc, dưới 50 quay lại từ đầu.`),
    rv ? h('div', null, h('p', null, 'Hạn ôn tiếp theo: ', h('b', null, rv.due || '-'), isDue(rv, today()) ? h('span', { class: 'chip due' }, 'Đến hạn') : null, ` (bậc ${rv.step + 1}/${REVIEW_STEPS.length})`),
      rv.history.length ? h('p', { class: 'muted small' }, 'Đã ôn: ' + rv.history.map((x) => `${x.date} (${x.score})`).join(', ')) : null,
      h('button', { class: 'btn ghost small', onclick: () => { t.review = null; save().then(refresh); } }, 'Tắt lịch ôn')) :
      h('button', { class: 'btn', onclick: () => { t.review = startReview(today()); if (t.stage !== 'review') t.stage = 'review'; save().then(refresh); } }, 'Bật lịch ôn'));

  // attempts
  const scores = attempts.filter((a) => a.metrics).map((a) => a.metrics!.score);
  const history = h('section', { class: 'card' }, h('div', { class: 'row-between' }, h('h2', null, 'Lịch sử luyện nói'), h('span', { class: 'muted small' }, `${attempts.length} lượt`)),
    trendChart(scores),
    attempts.length ? h('ul', { class: 'attempts' }, [...attempts].reverse().map((a) => attemptRow(t, a, refresh))) : h('p', { class: 'muted' }, 'Chưa có lượt nói nào.'));

  return h('div', { class: 'stack' }, head, h('div', { class: 'two-col even' },
    h('div', { class: 'stack' },
      editableList('Ý chính', t.keyPoints, 'Một ý chính, viết ngắn bằng lời của bạn', save, { hint: 'Dùng để đo mức độ bao phủ khi bạn nói. Viết theo từ khoá quan trọng.' }),
      editableList('Câu hỏi mở', t.openQuestions, 'Điều bạn chưa hiểu hoặc muốn kiểm chứng', save, { check: true, hint: 'Lỗ hổng phát hiện khi giảng lại (bước 3 của Feynman).' }),
      sources),
    h('div', { class: 'stack' }, history, review, journal)));
}

function attemptRow(t: Topic, a: Attempt, refresh: () => void) {
  const audioBox = h('div', { class: 'audio-slot' });
  return h('li', null,
    h('div', { class: 'row-between' },
      h('div', null, h('b', null, fmtDate(a.createdAt)), h('span', { class: 'muted small' }, ` · ${fmtTime(a.durationSec)} · ${a.scaffold.toUpperCase()}${a.isReview ? ' · ôn tập' : ''}`)),
      a.metrics ? h('span', { class: `score-pill ${scoreClass(a.metrics.score)}` }, String(a.metrics.score)) : h('span', { class: 'muted small' }, 'chưa chấm')),
    a.transcript ? h('p', { class: 'small clamp' }, a.transcript) : null,
    h('div', { class: 'row wrap' },
      a.audioId ? h('button', { class: 'btn ghost small', onclick: async () => { const b = await db.audio(a.audioId!); if (b) audioBox.replaceChildren(h('audio', { controls: true, src: URL.createObjectURL(b), autoplay: true })); } }, 'Nghe lại') : null,
      h('button', { class: 'btn ghost small', onclick: () => go(`#/practice/${t.id}?attempt=${a.id}`) }, 'Mở'),
      h('button', { class: 'btn ghost small', onclick: async () => { await navigator.clipboard.writeText(reviewBundle(t, a)); toast('Đã sao chép gói Markdown'); } }, 'Sao chép để review'),
      h('button', { class: 'btn ghost small danger', onclick: async () => { if (confirm('Xoá lượt nói này?')) { await db.deleteAttempt(a); refresh(); } } }, 'Xoá')),
    audioBox);
}

function scoreClass(s: number) { return s >= 75 ? 'good' : s >= 50 ? 'ok' : 'low'; }

// ---------- practice ----------

const PREP_STEPS = [
  { k: 'P', name: 'Point', vi: 'Nêu quan điểm', share: 0.15, cue: 'Theo tôi...' },
  { k: 'R', name: 'Reason', vi: 'Lý do', share: 0.3, cue: 'Vì...' },
  { k: 'E', name: 'Example', vi: 'Ví dụ', share: 0.35, cue: 'Ví dụ như...' },
  { k: 'P', name: 'Point', vi: 'Chốt lại', share: 0.2, cue: 'Tóm lại...' },
];
const FEYNMAN_STEPS = [
  { k: '1', name: 'Simple', vi: 'Giảng như cho người mới', share: 0.3, cue: 'Nói đơn giản là...' },
  { k: '2', name: 'Why', vi: 'Vì sao lại như vậy', share: 0.3, cue: 'Vì sao? Bởi vì...' },
  { k: '3', name: 'Analogy', vi: 'Ví dụ, so sánh', share: 0.25, cue: 'Giống như...' },
  { k: '4', name: 'Gaps', vi: 'Chỗ mình chưa chắc', share: 0.15, cue: 'Điều mình chưa rõ là...' },
];

async function practiceView(id: string) {
  const t = await db.topic(id);
  if (!t) return h('section', { class: 'card' }, h('p', null, 'Không tìm thấy chủ đề.'));
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let scaffold: Scaffold = (params.get('scaffold') as Scaffold) || (t.depth === 'minute' ? 'prep' : 'feynman');
  let target = DEPTH_TARGET_SEC[t.depth];
  let attempt: Attempt | null = null;
  if (params.get('attempt')) attempt = (await db.attempts(id)).find((a) => a.id === params.get('attempt')) || null;
  if (attempt) { scaffold = attempt.scaffold; target = attempt.targetSec; }

  const recorder = new Recorder();
  let live: LiveSpeech | null = null;
  let timer = 0, startAt = 0, recording = false;
  let samples: Float32Array | null = null;

  const timeEl = h('div', { class: 'time' }, fmtTime(target));
  const subEl = h('div', { class: 'muted small' }, `mục tiêu ${fmtTime(target)}`);
  const ring = h('div', { class: 'ring' }, h('div', { class: 'ring-inner' }, timeEl, subEl));
  const meter = h('div', { class: 'meter' }, h('span'));
  const stepsEl = h('ol', { class: 'scaffold' });
  const liveEl = h('p', { class: 'live muted small' });
  const recBtn = h('button', { class: 'btn record big', onclick: () => (recording ? stop() : start()) }, 'Bắt đầu ghi âm');
  const after = h('div', { class: 'stack' });

  const renderSteps = (elapsed = -1) => {
    const steps = scaffold === 'prep' ? PREP_STEPS : scaffold === 'feynman' ? FEYNMAN_STEPS : [];
    let acc = 0;
    stepsEl.replaceChildren(...steps.map((s) => {
      const from = acc * target; acc += s.share; const to = acc * target;
      const cls = elapsed < 0 ? '' : elapsed >= to ? 'past' : elapsed >= from ? 'now' : '';
      return h('li', { class: cls }, h('span', { class: 'k' }, s.k), h('div', null, h('b', null, `${s.name} - ${s.vi}`), h('span', { class: 'muted small' }, `${fmtTime(from)}-${fmtTime(to)} · "${s.cue}"`)));
    }));
    stepsEl.hidden = !steps.length;
  };
  renderSteps();

  const scaffoldSel = h('div', { class: 'seg', role: 'radiogroup' }, ([['none', 'Tự do'], ['prep', 'P.R.E.P'], ['feynman', 'Feynman']] as [Scaffold, string][]).map(([v, l]) =>
    h('button', { type: 'button', class: v === scaffold ? 'on' : '', role: 'radio', 'aria-checked': String(v === scaffold), onclick: (e: Event) => {
      if (recording) return; scaffold = v; scaffoldSel.querySelectorAll('button').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
      (e.target as HTMLElement).classList.add('on'); (e.target as HTMLElement).setAttribute('aria-checked', 'true'); renderSteps();
    } }, l)));
  const targetSel = h('select', { 'aria-label': 'Thời lượng mục tiêu', onchange: (e: Event) => { target = Number((e.target as HTMLSelectElement).value); timeEl.textContent = fmtTime(target); subEl.textContent = `mục tiêu ${fmtTime(target)}`; renderSteps(); } },
    [30, 60, 90, 120, 180, 300, 600, 900, 1200].map((s) => h('option', { value: s, selected: s === target }, fmtTime(s))));

  async function start() {
    if (!Recorder.supported()) { toast('Trình duyệt không hỗ trợ ghi âm'); return; }
    try { await recorder.start(); } catch { toast('Không truy cập được micro'); return; }
    if (settings.engine === 'webspeech' && webSpeechSupported()) {
      live = new LiveSpeech('vi-VN'); live.onUpdate = (txt) => { liveEl.textContent = txt; }; try { live.start(); } catch { live = null; }
    }
    recording = true; startAt = performance.now(); after.replaceChildren(); samples = null; attempt = null;
    recBtn.textContent = 'Dừng'; recBtn.classList.add('on'); ring.classList.add('live');
    const tick = () => {
      const el = (performance.now() - startAt) / 1000;
      const left = target - el;
      timeEl.textContent = left >= 0 ? fmtTime(left) : '+' + fmtTime(-left);
      subEl.textContent = `đã nói ${fmtTime(el)}`;
      ring.style.setProperty('--p', String(Math.min(1, el / target)));
      ring.classList.toggle('over', left < 0);
      (meter.firstChild as HTMLElement).style.width = `${Math.round(recorder.level() * 100)}%`;
      renderSteps(el);
      timer = requestAnimationFrame(tick);
    };
    tick();
  }

  async function stop() {
    cancelAnimationFrame(timer); recording = false;
    recBtn.textContent = 'Ghi lại lượt mới'; recBtn.classList.remove('on'); ring.classList.remove('live');
    const rec = await recorder.stop();
    const liveText = live?.stop() || '';
    live = null;
    const audioId = uid();
    await db.saveAudio(audioId, rec.blob);
    attempt = { id: uid(), topicId: t!.id, createdAt: new Date().toISOString(), durationSec: rec.durationSec, targetSec: target, scaffold,
      transcript: liveText, transcriptSource: liveText ? 'webspeech' : '', metrics: null, audioId, isReview: isDue(t!.review, today()) };
    await db.saveAttempt(attempt);
    showAfter(rec.blob);
  }

  async function showAfter(blob: Blob | undefined) {
    const a = attempt!;
    const ta = h('textarea', { rows: 8, class: 'transcript', placeholder: 'Bản ghi lời nói sẽ hiện ở đây. Bạn có thể sửa trực tiếp hoặc tự gõ.' }, a.transcript);
    const prog = h('div', { class: 'progress', hidden: true }, h('div', { class: 'bar' }, h('span')), h('span', { class: 'small muted label' }));
    const card = h('div', { class: 'scorecard-slot' });
    const setProg = (frac: number | null, label: string) => {
      prog.hidden = false;
      (prog.querySelector('.bar span') as HTMLElement).style.width = frac === null ? '100%' : `${Math.round(frac * 100)}%`;
      prog.classList.toggle('indeterminate', frac === null);
      (prog.querySelector('.label') as HTMLElement).textContent = label;
    };
    let chunks: { timestamp: [number, number | null] }[] | null = null;
    const getSamples = async () => { if (!samples && blob) samples = await decodeTo16k(blob); return samples; };

    const whisperBtn = h('button', { class: 'btn', onclick: async () => {
      if (!blob) return;
      whisperBtn.disabled = true;
      try {
        setProg(null, 'Đang giải mã âm thanh...');
        const s = await getSamples();
        const res = await transcribeWhisper(s!, settings.model, (p) => {
          if (p.kind === 'download' && p.total) setProg(p.loaded! / p.total, `Tải mô hình lần đầu: ${(p.loaded! / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} MB (lưu cache cho lần sau)`);
          else if (p.text) setProg(null, p.text);
        }, settings.device);
        ta.value = res.text; chunks = res.chunks; a.transcript = res.text; a.transcriptSource = 'whisper';
        setProg(1, `Xong (${res.device === 'webgpu' ? 'WebGPU' : 'WASM'}). Hãy đọc lại và sửa lỗi nhận dạng trước khi chấm.`);
        await db.saveAttempt(a);
      } catch (e) { setProg(0, 'Lỗi: ' + (e instanceof Error ? e.message : String(e))); }
      whisperBtn.disabled = false;
    } }, 'Chuyển giọng nói thành chữ (Whisper)');

    const analyse = async () => {
      a.transcript = ta.value.trim();
      if (!a.transcriptSource) a.transcriptSource = 'manual';
      let pauses = [] as { start: number; end: number }[];
      try { const s = await getSamples(); if (s) pauses = detectPauses(s, 16000); } catch { /* audio not decodable */ }
      if (!pauses.length && chunks) pauses = pausesFromChunks(chunks);
      a.metrics = computeMetrics({ transcript: a.transcript, durationSec: a.durationSec, targetSec: a.targetSec, keyPoints: t!.keyPoints.map((k) => k.text), pauses, scaffold: a.scaffold });
      const first = !a.isReview ? false : !(t!.review?.history || []).some((x) => x.date === today());
      if (a.isReview && first && t!.review) { t!.review = recordReview(t!.review, today(), a.metrics.score); await db.saveTopic(t!); toast(`Đã ghi nhận ôn tập. Hạn tiếp: ${t!.review.due}`); }
      await db.saveAttempt(a);
      const prev = (await db.attempts(t!.id)).filter((x) => x.metrics).map((x) => x.metrics!.score);
      card.replaceChildren(scoreCard(a.metrics, prev, t!));
    };

    after.replaceChildren(h('section', { class: 'card' },
      h('h2', null, 'Nghe lại & bản ghi'),
      blob ? h('audio', { controls: true, src: URL.createObjectURL(blob) }) : h('p', { class: 'muted small' }, 'Không có âm thanh.'),
      h('div', { class: 'row wrap' }, blob ? whisperBtn : null,
        h('span', { class: 'muted small' }, settings.engine === 'webspeech' ? 'Đang dùng Web Speech (âm thanh gửi tới máy chủ của trình duyệt). Whisper chạy hoàn toàn trên máy.' : `Mô hình: ${settings.model.split('/')[1]} · chạy trên máy, không gửi âm thanh đi đâu`)),
      prog, ta,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: analyse }, 'Chấm điểm'),
        h('button', { class: 'btn ghost', onclick: async () => { a.transcript = ta.value.trim(); await db.saveAttempt(a); await navigator.clipboard.writeText(reviewBundle(t!, a)); toast('Đã sao chép gói Markdown'); } }, 'Sao chép để review'))),
      card);
    if (a.metrics) { const prev = (await db.attempts(t!.id)).filter((x) => x.metrics).map((x) => x.metrics!.score); card.replaceChildren(scoreCard(a.metrics, prev, t!)); }
  }

  if (attempt) showAfter(attempt.audioId ? await db.audio(attempt.audioId) : undefined);
  cleanup = () => { cancelAnimationFrame(timer); if (recording) recorder.stop(); live?.stop(); };

  return h('div', { class: 'stack' },
    h('section', { class: 'card practice-head' },
      h('a', { class: 'back small', href: `#/topic/${t.id}` }, '← ', t.title),
      h('h1', null, t.coreQuestion || t.title),
      t.keyPoints.length ? h('details', null, h('summary', null, `Ý chính cần nhắc tới (${t.keyPoints.length})`), h('ul', null, t.keyPoints.map((k) => h('li', null, k.text)))) : null),
    h('div', { class: 'two-col' },
      h('section', { class: 'card center-col' }, ring, meter, recBtn, liveEl,
        h('div', { class: 'row wrap center' }, h('label', { class: 'field inline' }, 'Thời lượng', targetSel))),
      h('section', { class: 'card' }, h('h2', null, 'Khung nói'), scaffoldSel, stepsEl,
        h('p', { class: 'muted small' }, scaffold === 'feynman' ? 'Giảng như cho một người chưa biết gì. Chỗ nào bạn vấp là lỗ hổng cần đọc lại.' : 'Mỗi bước sáng lên theo thời gian để bạn biết nên chuyển ý.'))),
    after);
}

function scoreCard(m: Metrics, scores: number[], t: Topic) {
  const part = (label: string, key: string, value: string, note: string) => h('div', { class: 'metric' },
    h('div', { class: 'row-between' }, h('span', null, label), h('b', null, value)),
    h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round((m.parts[key] ?? 0) * 100)}%` }, class: scoreClass((m.parts[key] ?? 0) * 100) })),
    h('span', { class: 'muted small' }, note));
  const fillerList = Object.entries(m.fillers.byWord).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ×${n}`).join(', ');
  return h('section', { class: 'card scorecard' },
    h('div', { class: 'row-between wrap' }, h('h2', null, 'Bảng điểm'), h('div', { class: `big-score ${scoreClass(m.score)}` }, String(m.score), h('small', null, '/100'))),
    h('p', { class: 'muted small' }, 'Chỉ số tự động, không dùng AI: đo hình thức nói. Muốn được góp ý về lập luận, hãy dùng "Sao chép để review".'),
    h('div', { class: 'metrics' },
      part('Tốc độ', 'pace', `${m.wpm} âm tiết/phút`, `Khoảng thoải mái ${PACE_RANGE[0]}-${PACE_RANGE[1]}. ${m.words} âm tiết.`),
      part('Từ đệm', 'fillers', `${m.fillers.total} (${(m.fillers.ratio * 100).toFixed(1)}%)`, fillerList || 'Không phát hiện từ đệm. Dưới 3% là bình thường.'),
      part('Ngắt quãng dài', 'pauses', `${m.pauses.length}`, m.pauses.length ? `Dài nhất ${m.longestPause.toFixed(1)} giây (ngưỡng 1,5 giây)` : 'Không có khoảng lặng dài.'),
      part('Thời lượng', 'duration', `${fmtTime(m.durationSec)} / ${fmtTime(m.targetSec)}`, 'Tốt nhất trong khoảng 85%-110% mục tiêu.'),
      part(m.structure.kind === 'feynman' ? 'Cấu trúc Feynman' : 'Cấu trúc P.R.E.P', 'structure', `${Math.round(m.structure.score * 100)}%`,
        m.structure.hints.map((x) => `${x.found ? '✓' : '·'} ${x.label}`).join('   ')),
      m.coverage.items.length ? part('Bao phủ ý chính', 'coverage', `${Math.round(m.coverage.ratio * 100)}%`, `${m.coverage.items.filter((i) => i.state === 'covered').length}/${m.coverage.items.length} ý được nhắc rõ`) : null),
    m.coverage.items.length ? h('ul', { class: 'coverage' }, m.coverage.items.map((i) => h('li', { class: i.state }, h('span', { class: 'dot' }), i.point,
      h('span', { class: 'muted small' }, i.state === 'covered' ? ' đã nói' : i.state === 'partial' ? ' nói một phần' : ' chưa nhắc')))) :
      h('p', { class: 'muted small' }, 'Thêm "Ý chính" cho chủ đề để đo độ bao phủ.'),
    h('h3', null, 'Xu hướng qua các lượt'), trendChart(scores),
    h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: `#/topic/${t.id}` }, 'Về chủ đề')));
}

// ---------- settings ----------

async function settingsView() {
  const save = () => db.setSetting('settings', settings);
  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async () => {
    const f = fileIn.files?.[0]; if (!f) return;
    try { const r = await importBackup(f); toast(`Đã nhập ${r.topics} chủ đề, ${r.attempts} lượt nói`); } catch (e) { toast(String(e)); }
  } });
  const withAudio = h('input', { type: 'checkbox', checked: true });
  return h('div', { class: 'stack narrow' }, h('h1', null, 'Cài đặt'),
    h('section', { class: 'card' }, h('h2', null, 'Nhận dạng giọng nói'),
      h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'eng', checked: settings.engine === 'whisper', onchange: () => { settings.engine = 'whisper'; save(); } }),
        h('span', null, h('b', null, 'Whisper trên máy (khuyên dùng)'), h('br'), h('span', { class: 'muted small' }, 'Mã nguồn mở, chạy trong trình duyệt bằng transformers.js. Lần đầu tải mô hình rồi lưu cache. Không gửi âm thanh đi đâu.'))),
      h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'eng', disabled: !webSpeechSupported(), checked: settings.engine === 'webspeech', onchange: () => { settings.engine = 'webspeech'; save(); } }),
        h('span', null, h('b', null, 'Web Speech API (nhanh, chữ hiện trực tiếp)'), h('br'), h('span', { class: 'muted small' }, webSpeechSupported() ? 'Lưu ý: âm thanh được gửi tới máy chủ của hãng trình duyệt (ví dụ Google) để nhận dạng. Vẫn có thể chạy Whisper sau đó.' : 'Trình duyệt này không hỗ trợ.'))),
      h('label', { class: 'field' }, 'Mô hình Whisper', h('select', { onchange: (e: Event) => { settings.model = (e.target as HTMLSelectElement).value as WhisperModel; save(); } },
        WHISPER_MODELS.map((m) => h('option', { value: m.id, selected: m.id === settings.model }, m.label)))),
      h('label', { class: 'field' }, 'Thiết bị tính toán', h('select', { onchange: (e: Event) => { settings.device = (e.target as HTMLSelectElement).value as Settings['device']; save(); } },
        [['auto', 'Tự động (WebGPU nếu có, không thì WASM)'], ['webgpu', 'WebGPU'], ['wasm', 'WASM (CPU)']].map(([v, l]) => h('option', { value: v, selected: v === settings.device }, l))))),
    h('section', { class: 'card' }, h('h2', null, 'Sao lưu dữ liệu'),
      h('p', { class: 'muted small' }, 'Dữ liệu nằm trong IndexedDB của trình duyệt này. Hãy xuất tệp JSON định kỳ.'),
      h('label', { class: 'check' }, withAudio, ' Kèm bản ghi âm (tệp lớn hơn)'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => {
          const b = await exportBackup(withAudio.checked); const a = h('a', { href: URL.createObjectURL(b), download: `omni-feyn-${today()}.json` }); a.click();
        } }, 'Xuất JSON'),
        h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, 'Nhập JSON'), fileIn)),
    h('section', { class: 'card' }, h('h2', null, 'Về ứng dụng'),
      h('p', { class: 'small' }, 'Omni Feyn: học một chủ đề tới độ sâu bạn chọn, giảng lại bằng lời đơn giản, đo chỉ số nói và ôn theo lịch giãn cách. Không có máy chủ, không tài khoản. Mã nguồn MIT.')));
}

// ---------- boot ----------

(async () => {
  settings = { ...settings, ...(await db.getSetting<Partial<Settings>>('settings', {})) };
  window.addEventListener('hashchange', route);
  route();
})();
