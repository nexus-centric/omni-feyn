import './style.css';
import { h, toast, fmtTime, fmtDate, trendChart } from './ui';
import { db, uid, exportBackup, importBackup } from './db';
import { BANK, CATEGORY, Drawer, categoriesFor, type BankItem } from './core/bank';
import { SOURCES_CHECKED_ON } from './core/bank-meta';
import { estimate, suggestedHours, windowLabel, fmtHours, type PlanSettings } from './core/estimate';
import { newTopic as coreNewTopic, topicFromBank as coreTopicFromBank, adoptPlan, englishTitle, renameTopic } from './core/topic';
import { icon } from './icons';
import { EXERCISES, ZONE_LABEL, DEFAULT_WEEK, DAY_KIND_LABEL, WEEKDAY_LABEL, LEVEL_PARAMS, CARDIO_MIN, MOBILITY, checkWeek, plannedCardioMinutes, sessionMoves, swapOptions, isStrength, weekdayIndex, type BodySession, type DayKind, type Exercise } from './core/body';
import { Recorder, decodeTo16k } from './audio';
import { transcribeWhisper, WHISPER_MODELS, AUTO_MODEL, detectWebGPU, LiveSpeech, webSpeechSupported, type WhisperModel } from './asr';
import { computeMetrics, detectPauses, pausesFromChunks, PACE_RANGE, type Metrics, type Scaffold } from './core/metrics';
import { reviewBundle } from './core/bundle';
import { isDue, recordReview, startReview, toDay, REVIEW_STEPS } from './core/review';
import { DEPTH_HINT, DEPTH_LABEL, DEPTH_TARGET_SEC, STAGES, STAGE_HINT, STAGE_LABEL, type Attempt, type Depth, type Topic } from './core/types';
import { blip, chime, reducedMotion } from './fx';

const app = document.getElementById('app')!;
const today = () => toDay(new Date());

interface Settings { engine: 'whisper' | 'webspeech'; model: WhisperModel; device: 'auto' | 'webgpu' | 'wasm'; language: 'vietnamese' | 'english'; sound: boolean; }
let settings: Settings = { engine: 'whisper', model: 'auto', device: 'auto', language: 'vietnamese', sound: true };
const drawer = new Drawer();
const DEPTHS: Depth[] = ['minute', 'day', 'week', 'deep'];
const DEPTH_ICON: Record<Depth, string> = { minute: 'zap', day: 'sun', week: 'calendar', deep: 'waves' };
const DEPTH_SPIN_HINT: Record<Depth, string> = {
  minute: 'Một câu hỏi ngắn để nói ngay trong 60 giây',
  day: 'Chủ đề gọn, thường vừa cho một ngày tìm hiểu',
  week: 'Chủ đề rộng hơn, thường vài buổi trong tuần',
  deep: 'Chủ đề lớn để tìm hiểu dần theo nhịp của bạn',
};

// ---------- routing ----------

const NAV: [string, string, string][] = [['#/', 'home', 'Hôm nay'], ['#/spin', 'compass', 'Khám phá'], ['#/topics', 'book', 'Chủ đề'], ['#/body', 'activity', 'Luyện Thân'], ['#/settings', 'settings', 'Cài đặt']];
let cleanup: (() => void) | null = null;

async function route() {
  cleanup?.(); cleanup = null;
  const hash = location.hash || '#/';
  const [, view, id] = hash.split('?')[0].split('/');
  const main = h('main', { class: 'view' });
  let content: HTMLElement;
  try {
    if (view === 'spin' || view === 'reflex') content = await spinView();
    else if (view === 'topics') content = await topicsView();
    else if (view === 'topic' && id) content = await topicView(id);
    else if (view === 'practice' && id) content = await practiceView(id);
    else if (view === 'body') content = await bodyView();
    else if (view === 'settings') content = await settingsView();
    else content = await homeView();
  } catch (e) {
    content = h('section', { class: 'card' }, h('h2', null, 'Có lỗi'), h('p', null, String(e)));
  }
  main.append(content);
  const v = view === 'reflex' ? 'spin' : view === 'topic' || view === 'practice' ? 'topics' : view || '';
  const active = '#/' + v;
  const header = h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#/' }, h('img', { class: 'mark', src: 'icon.svg', alt: '', width: 28, height: 28 }), h('span', null, 'Omni Feyn')),
    h('nav', { 'aria-label': 'Điều hướng chính' }, NAV.map(([href, ic, label]) => h('a', { href, class: href === active ? 'on' : '', 'aria-current': href === active ? 'page' : undefined }, h('span', { class: 'emo' }, icon(ic)), h('span', null, label)))));
  app.replaceChildren(header, main);
  window.scrollTo(0, 0);
}

function go(hash: string) { if (location.hash === hash) route(); else location.hash = hash; }

// ---------- topic helpers ----------

function newTopic(title: string, depth: Depth, category?: string): Topic { return coreNewTopic(uid(), title, depth, category); }

function disputedChip() {
  return h('span', { class: 'chip disputed', title: 'Bằng chứng hoặc cách hiểu về ý tưởng này còn được tranh luận; nên đọc cả các nghiên cứu lặp lại và phản biện.' }, 'Còn tranh luận');
}
function bookNote() {
  return h('p', { class: 'muted small' }, 'Ước lượng này là thời gian tìm hiểu chủ đề quanh cuốn sách, chưa gồm thời gian đọc trọn cuốn. Sách có thể cần mua hoặc mượn.');
}

const KIND_ICON: Record<DayKind, string> = { strengthA: 'dumbbell', strengthB: 'dumbbell', cardio: 'heart', mobility: 'stretch', rest: 'moon' };

/** Vietnamese title with its English title underneath when one exists. */
function titleLink(t: Topic) {
  const en = englishTitle(t);
  return h('a', { class: 'title-pair', href: `#/topic/${t.id}` }, h('span', null, t.title), en ? h('span', { class: 'title-en', lang: 'en' }, en) : null);
}

function depthChip(d: Depth) { return h('span', { class: `chip depth-${d}` }, DEPTH_LABEL[d]); }

function stageBar(t: Topic, onPick?: (s: Topic['stage']) => void) {
  const idx = STAGES.indexOf(t.stage);
  return h('ol', { class: 'stages' }, STAGES.map((s, i) => h('li', { class: i < idx ? 'done' : i === idx ? 'now' : '' },
    onPick ? h('button', { type: 'button', onclick: () => onPick(s), title: STAGE_HINT[s] }, STAGE_LABEL[s]) : h('span', null, STAGE_LABEL[s]))));
}

const searchUrl = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
function keywordChips(kws: string[]) {
  return h('div', { class: 'kw-row' }, kws.map((k) => h('a', { class: 'kw', href: searchUrl(k), target: '_blank', rel: 'noopener noreferrer', title: `Mở trang tìm kiếm Google cho "${k}" (đây là tìm kiếm, không phải nguồn)` }, icon('search'), k)));
}

/** Adjustable estimate: active study hours vs calendar window, with stated assumptions. */
function estimateBox(depth: Depth, complexity: 1 | 2 | 3 | undefined, plan: PlanSettings, onChange?: (p: PlanSettings) => void): HTMLElement | null {
  const e = estimate(depth, complexity || 2, plan);
  if (!e) return null;
  const body = h('div', { class: 'estimate' });
  const render = () => {
    const x = estimate(depth, complexity || 2, plan)!;
    const sug = suggestedHours(depth, complexity || 2)!;
    body.replaceChildren(...([
      h('div', { class: 'est-grid' },
        h('div', null, h('span', { class: 'muted small' }, 'Thời gian học thật sự'), h('b', null, fmtHours(x.hours)), h('span', { class: 'muted small' }, x.custom && plan.hours ? 'ước lượng của bạn' : `gợi ý cho chủ đề ${['', 'gọn', 'vừa', 'rộng'][complexity || 2]}`)),
        h('div', null, h('span', { class: 'muted small' }, 'Khung lịch nếu giữ nhịp này'), h('b', null, windowLabel(x.days)), h('span', { class: 'muted small' }, `${x.sessionsPerWeek} buổi/tuần × ${x.sessionMin} phút, ${x.sessions[0]}-${x.sessions[1]} buổi`))),
      h('p', { class: 'muted small' }, 'Chỉ là ước lượng tham khảo để lên kế hoạch, không phải thời gian chuẩn hay hạn chót. Độ sâu là điểm xuất phát, bạn có thể đổi phạm vi và đi theo nhịp riêng.'),
      onChange ? h('details', { class: 'est-edit' }, h('summary', null, icon('pen'), ' Chỉnh ước lượng'),
        h('div', { class: 'row wrap' },
          numField('Giờ, thấp', x.hours[0], (v) => { plan.hours = [v, Math.max(v, (plan.hours || x.hours)[1])]; }),
          numField('Giờ, cao', x.hours[1], (v) => { plan.hours = [Math.min(v, (plan.hours || x.hours)[0]), v]; }),
          numField('Phút mỗi buổi', x.sessionMin, (v) => { plan.sessionMin = v; }),
          numField('Buổi mỗi tuần', x.sessionsPerWeek, (v) => { plan.sessionsPerWeek = v; })),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { delete plan.hours; delete plan.sessionMin; delete plan.sessionsPerWeek; onChange(plan); render(); } }, `Về gợi ý (${fmtHours(sug)})`)) : null].filter(Boolean) as Node[]));
  };
  const numField = (label: string, value: number, set: (v: number) => void) => h('label', { class: 'field inline mini-field' }, label,
    h('input', { type: 'number', min: 0.5, step: 0.5, value, class: 'num', onchange: (ev: Event) => { const v = Number((ev.target as HTMLInputElement).value); if (v > 0) { set(v); onChange?.(plan); render(); } } }));
  render();
  return body;
}

type Suggestions = NonNullable<Topic['suggestions']>;
/** Optional suggestions: collapsible, clearly labelled, every item usable or ignorable. */
function suggestionsPanel(s: Suggestions, depth: Depth, opts: { open?: boolean; onUseCore?: () => void; onUsePlan?: () => void; onAddSource?: (src: Suggestions['sources'][number]) => void; onHide?: () => void } = {}) {
  return h('details', { class: 'suggest', open: !!opts.open },
    h('summary', null, icon('bulb'), ' Gợi ý tham khảo ', h('span', { class: 'muted small' }, '(không bắt buộc, dùng hay bỏ qua tuỳ bạn)')),
    s.core ? h('div', { class: 'sg-block' }, h('h4', null, 'Một câu hỏi có thể bắt đầu'), h('p', null, s.core),
      opts.onUseCore ? h('button', { class: 'btn ghost small', type: 'button', onclick: opts.onUseCore }, 'Dùng làm câu hỏi của tôi') : null) : null,
    s.plan.length ? h('div', { class: 'sg-block' }, h('h4', null, depth === 'deep' ? 'Một vài hướng có thể đào' : 'Một vài khía cạnh có thể xem'), h('ul', { class: 'plan' }, s.plan.map((p) => h('li', null, p))),
      opts.onUsePlan ? h('button', { class: 'btn ghost small', type: 'button', onclick: opts.onUsePlan }, 'Chép thành cột mốc (tuỳ chọn)') : null) : null,
    s.en || s.keywords.length ? h('div', { class: 'sg-block' }, h('h4', null, 'Tìm kiếm bằng tiếng Anh và tiếng Việt'),
      h('p', { class: 'muted small' }, 'Các nút dưới đây mở trang tìm kiếm Google, không phải nguồn đã chọn lọc.'),
      keywordChips([...(s.en ? [s.en] : []), ...s.enTerms, ...s.keywords])) : null,
    s.sources.length ? h('div', { class: 'sg-block' }, h('h4', null, 'Điểm xuất phát có thể đọc'),
      h('p', { class: 'muted small' }, `Liên kết đã được kiểm tra còn hoạt động ngày ${SOURCES_CHECKED_ON}; nội dung chưa được thẩm định thay bạn.`),
      h('ul', { class: 'start-src' }, s.sources.map((src) => h('li', null, h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, src.title), h('span', { class: 'muted small' }, ` · ${src.org}`),
        opts.onAddSource ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => opts.onAddSource!(src) }, '+ Thêm vào nguồn') : null)))) : null,
    opts.onHide ? h('button', { class: 'btn ghost small', type: 'button', onclick: opts.onHide }, 'Ẩn gợi ý cho chủ đề này') : null);
}

const bankSuggestions = (it: BankItem): Suggestions => ({ core: it.core, plan: it.plan, keywords: it.keywords, en: it.en, enTerms: it.enTerms, sources: it.sources });

// ---------- home ----------

function greeting() {
  const hr = new Date().getHours();
  return hr < 11 ? 'Chào buổi sáng' : hr < 14 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

async function homeView() {
  const topics = await db.topics();
  const attempts = await db.attempts();
  const body = await db.getSetting<BodySession[]>('bodySessions', []);
  const week = await db.getSetting<DayKind[]>('bodyWeek', DEFAULT_WEEK);
  const due = topics.filter((t) => isDue(t.review, today()));
  const minutes = Math.round(attempts.reduce((s, a) => s + a.durationSec, 0) / 60);
  const readMin = topics.reduce((s, t) => s + t.readingLog.reduce((x, l) => x + l.minutes, 0), 0);
  const active = topics.filter((t) => t.depth !== 'minute').slice(0, 5);
  const bodyToday = body.some((s) => s.date === today());
  const todayKind = week[weekdayIndex(new Date())];

  return h('div', { class: 'stack' },
    h('section', { class: 'hero' },
      h('div', { class: 'hero-text' },
        h('p', { class: 'eyebrow' }, greeting()),
        h('h1', null, 'Hôm nay bạn muốn tìm hiểu gì?'),
        h('p', { class: 'lead' }, 'Chọn ngẫu nhiên một chủ đề hoặc tự đặt chủ đề, tìm hiểu theo cách của bạn rồi thử giảng lại bằng lời. Dữ liệu chỉ lưu trên máy này.'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn primary big spin-cta', href: '#/spin?go=1' }, icon('shuffle'), 'Chọn ngẫu nhiên'),
          h('a', { class: 'btn ghost', href: '#/topics?new=day' }, icon('pen'), 'Tự đặt chủ đề'))),
      h('div', { class: 'stats' },
        stat(String(topics.length), 'chủ đề', 'book'), stat(String(attempts.length), 'lượt nói', 'mic'), stat(`${minutes}`, 'phút đã nói', 'clock'), stat(`${readMin}`, 'phút đọc', 'note'))),
    h('div', { class: 'two-col even' },
      h('section', { class: 'card' }, h('h2', null, icon('leaf'), 'Đang tìm hiểu'),
        active.length ? h('ul', { class: 'list' }, active.map((t) => h('li', null,
          titleLink(t), depthChip(t.depth), h('span', { class: 'muted small' }, STAGE_LABEL[t.stage])))) :
          h('p', { class: 'muted' }, 'Bạn chưa có chủ đề nào. Chọn ngẫu nhiên hoặc tự đặt một chủ đề để bắt đầu.')),
      h('section', { class: 'card' },
        h('div', { class: 'row-between' }, h('h2', null, icon('repeat'), 'Ôn hôm nay'), h('span', { class: 'muted' }, `${due.length} chủ đề`)),
        due.length ? h('ul', { class: 'list' }, due.map((t) => h('li', null,
          titleLink(t), depthChip(t.depth),
          h('button', { class: 'btn small', onclick: () => go(`#/practice/${t.id}`) }, 'Giảng lại')))) :
          h('p', { class: 'muted' }, 'Hôm nay không có chủ đề nào cần ôn. Lịch ôn là tuỳ chọn, bạn bật trong từng chủ đề.'))),
    h('section', null, h('h2', { class: 'section-title' }, 'Chọn theo độ sâu'),
      h('div', { class: 'depth-grid' }, DEPTHS.map((d) => h('a', { class: `depth-card depth-${d}`, href: `#/spin?d=${d}&go=1` },
        h('span', { class: 'depth-emo' }, icon(DEPTH_ICON[d])),
        h('strong', null, DEPTH_LABEL[d]), h('span', null, DEPTH_SPIN_HINT[d]),
        h('span', { class: 'depth-count' }, `${BANK[d].length} chủ đề`))))),
    h('section', { class: `card body-mini ${bodyToday ? 'done' : ''}` },
      h('div', { class: 'row-between wrap' }, h('h2', null, icon('activity'), 'Luyện Thân'), h('span', { class: 'chip' }, `Hôm nay: ${DAY_KIND_LABEL[todayKind]}`)),
      h('p', { class: 'muted' }, bodyToday ? 'Hôm nay đã ghi một buổi tập.' : todayKind === 'rest' ? 'Theo lịch hôm nay là ngày nghỉ. Nghỉ cũng là một phần của tập luyện.' : 'Lịch tuần có ngày tập và ngày nghỉ xen kẽ, bạn có thể đổi.'),
      h('a', { class: 'btn', href: '#/body' }, 'Mở Luyện Thân')),
  );
}

function stat(v: string, l: string, ic: string) { return h('div', { class: 'stat' }, h('span', { class: 'stat-emo' }, icon(ic)), h('b', null, v), h('span', null, l)); }

// ---------- spin (all depths) ----------

async function spinView() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const legacy = location.hash.startsWith('#/reflex');
  let depth: Depth = (DEPTHS.includes(params.get('d') as Depth) ? params.get('d') : legacy ? 'minute' : await db.getSetting<Depth>('spinDepth', 'minute')) as Depth;
  const catKey = (d: Depth) => `spinCat-${d}`;
  let cat = await db.getSetting<string>(catKey(depth), 'all');
  let current: BankItem | null = null;
  let spinning = false;

  const reel = h('div', { class: 'reel', 'aria-hidden': 'true' });
  const window_ = h('div', { class: 'reel-window' }, reel);
  const placeholder = h('p', { class: 'reel-placeholder' }, 'Chủ đề sẽ hiện ở đây');
  const stage = h('div', { class: `slot depth-${depth}` }, window_, placeholder);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const result = h('div', { class: 'spin-result' });
  const counter = h('span', { class: 'muted small' });
  const spinBtn = h('button', { class: 'btn primary big pick-btn', type: 'button', onclick: () => spin() }, icon('shuffle'), 'Chọn ngẫu nhiên');

  const catSel = h('select', { 'aria-label': 'Nhóm chủ đề', onchange: (e: Event) => { cat = (e.target as HTMLSelectElement).value; db.setSetting(catKey(depth), cat); updateCounter(); } });
  const fillCats = () => {
    catSel.replaceChildren(h('option', { value: 'all', selected: cat === 'all' }, `Tất cả (${BANK[depth].length})`),
      ...categoriesFor(depth).map((c) => h('option', { value: c.id, selected: cat === c.id }, `${c.name} (${c.count})`)));
    if (cat !== 'all' && !categoriesFor(depth).some((c) => c.id === cat)) cat = 'all';
  };
  const updateCounter = () => { counter.textContent = `${drawer.remaining(depth, cat)}/${drawer.pool(depth, cat).length} chủ đề chưa xuất hiện lần này`; };

  const tabs = h('div', { class: 'depth-tabs', role: 'tablist' }, DEPTHS.map((d) => h('button', {
    role: 'tab', type: 'button', class: `depth-tab depth-${d} ${d === depth ? 'on' : ''}`, 'aria-selected': String(d === depth),
    onclick: async () => {
      if (spinning) return;
      depth = d; db.setSetting('spinDepth', d); cat = await db.getSetting<string>(catKey(d), 'all');
      tabs.querySelectorAll('button').forEach((b) => { const on = b.classList.contains(`depth-${d}`); b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
      stage.className = `slot depth-${d}`; reel.replaceChildren(); placeholder.hidden = false; result.replaceChildren(); current = null;
      fillCats(); updateCounter(); hint.textContent = DEPTH_SPIN_HINT[d];
    } }, icon(DEPTH_ICON[d]), DEPTH_LABEL[d])));
  const hint = h('p', { class: 'muted center' }, DEPTH_SPIN_HINT[depth]);

  function renderResult(it: BankItem) {
    const c = CATEGORY[it.cat];
    const accept = async () => {
      if (it.depth === 'minute') {
        const topics = await db.topics();
        let t = topics.find((x) => x.title === it.title && x.depth === 'minute');
        if (!t) { t = coreTopicFromBank(it, uid()); await db.saveTopic(t); }
        go(`#/practice/${t.id}?scaffold=prep`); return;
      }
      const topics = await db.topics();
      const existing = topics.find((x) => x.bankId === it.id);
      if (existing) { toast('Bạn đã có chủ đề này, mở lại nhé'); go(`#/topic/${existing.id}`); return; }
      const t = coreTopicFromBank(it, uid()); await db.saveTopic(t); toast('Đã thêm vào Chủ đề của bạn'); go(`#/topic/${t.id}`);
    };
    const est = it.depth === 'minute' ? null : estimateBox(it.depth, it.complexity, {});
    result.replaceChildren(h('section', { class: `card result-card depth-${it.depth}` },
      h('div', { class: 'row wrap' }, h('span', { class: `chip depth-${it.depth}` }, DEPTH_LABEL[it.depth]), h('span', { class: 'chip' }, c.name), it.flag === 'disputed' ? disputedChip() : null),
      h('h2', { class: 'result-title' }, it.title),
      it.en ? h('p', { class: 'title-en', lang: 'en' }, it.en) : null,
      it.depth === 'minute' ? h('p', { class: 'muted' }, 'Nói 60 giây. Khung P.R.E.P (quan điểm, lý do, ví dụ, chốt lại) có sẵn nếu bạn muốn dùng.') :
        h('p', { class: 'muted' }, 'Chủ đề là của bạn: tự chọn góc nhìn và cách tìm hiểu. Gợi ý bên dưới chỉ để tham khảo.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary big', onclick: accept }, ...(it.depth === 'minute' ? [icon('mic'), 'Bắt đầu luyện nói'] : [icon('arrow'), 'Bắt đầu tìm hiểu'])),
        h('button', { class: 'btn big', onclick: () => spin() }, icon('refresh'), 'Chọn chủ đề khác')),
      est ? h('div', { class: 'est-wrap' }, h('h3', null, icon('hourglass'), 'Ước lượng thời gian (chỉnh được sau)'), est, it.cat === 'sach' ? bookNote() : null) : null,
      it.depth !== 'minute' ? suggestionsPanel(bankSuggestions(it), it.depth) : null));
  }

  async function spin() {
    if (spinning) return;
    spinning = true; spinBtn.disabled = true; stage.classList.remove('landed'); stage.classList.add('spinning'); placeholder.hidden = true;
    result.replaceChildren();
    const pick = drawer.draw(depth, cat);
    const n = reducedMotion() ? 0 : 14;
    const items = [...drawer.teasers(depth, cat, n).filter((x) => x.id !== pick.id), pick];
    reel.replaceChildren(...items.map((it) => h('div', { class: 'reel-item' }, h('span', { class: 'reel-cat' }, CATEGORY[it.cat].name), h('span', { class: 'reel-title' }, it.title), it.en ? h('span', { class: 'reel-en', lang: 'en' }, it.en) : null)));
    reel.style.transition = 'none'; reel.style.transform = 'translateY(0)'; void reel.offsetHeight;
    const dur = reducedMotion() ? 0 : 1900;
    if (dur) {
      reel.style.transition = `transform ${dur}ms cubic-bezier(.12,.8,.18,1)`;
      reel.style.transform = `translateY(calc(-${items.length - 1} * var(--reel-h)))`;
      if (settings.sound) { let k = 0; const tick = () => { if (k >= items.length - 1) return; blip(300 + k * 18); k++; setTimeout(tick, 40 + k * k * 4.5); }; tick(); }
      await new Promise((r) => setTimeout(r, dur + 40));
    } else reel.style.transform = `translateY(calc(-${items.length - 1} * var(--reel-h)))`;
    stage.classList.remove('spinning'); stage.classList.add('landed');
    if (settings.sound) chime();
    current = pick; live.textContent = `Chủ đề: ${pick.title}`;
    renderResult(pick); updateCounter();
    spinning = false; spinBtn.disabled = false;
  }

  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); spin(); }
    else if (e.key === 'Enter' && current && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); (result.querySelector('.btn.primary') as HTMLElement | null)?.click(); }
  };
  window.addEventListener('keydown', onKey);
  cleanup = () => window.removeEventListener('keydown', onKey);
  fillCats(); updateCounter();
  if (params.get('go')) setTimeout(() => spin(), 250);

  return h('div', { class: 'stack narrow' },
    h('section', { class: 'card spin-card' },
      h('div', { class: 'center' }, h('h1', null, 'Khám phá chủ đề')),
      tabs, hint,
      h('div', { class: 'row wrap center' }, h('label', { class: 'field inline' }, 'Nhóm', catSel), counter),
      stage, live,
      h('div', { class: 'center' }, spinBtn),
      h('p', { class: 'muted small center' }, 'Phím tắt: Space để chọn ngẫu nhiên, Enter để bắt đầu')),
    result,
    depth === 'minute' || legacy ? h('section', { class: 'card' }, h('h2', null, 'Khung P.R.E.P cho câu hỏi 1 phút'),
      h('ol', { class: 'prep-guide' },
        h('li', null, h('b', null, 'Point'), ' - nêu quan điểm ngay câu đầu ("Theo tôi...").'),
        h('li', null, h('b', null, 'Reason'), ' - một hoặc hai lý do chính ("Vì...").'),
        h('li', null, h('b', null, 'Example'), ' - ví dụ cụ thể, số liệu, câu chuyện ("Ví dụ...").'),
        h('li', null, h('b', null, 'Point'), ' - chốt lại quan điểm ("Tóm lại...").'))) : null,
  );
}

// ---------- Luyen Than (body) ----------

async function bodyView() {
  let sessions = await db.getSetting<BodySession[]>('bodySessions', []);
  let level = await db.getSetting<1 | 2 | 3>('bodyLevel', 1);
  const week = [...(await db.getSetting<DayKind[]>('bodyWeek', DEFAULT_WEEK))];
  const todayIdx = weekdayIndex(new Date());
  const override = await db.getSetting<{ date: string; kind?: DayKind; moves?: string[] } | null>('bodyToday', null);
  const todayState = override && override.date === today() ? override : { date: today() } as { date: string; kind?: DayKind; moves?: string[] };
  let kind: DayKind = todayState.kind || week[todayIdx];
  const saveToday = () => db.setSetting('bodyToday', todayState);

  const panel = h('div', { class: 'stack' });
  const timerBox = h('div', { class: 'stack' });
  const warnEl = h('div', { class: 'week-warn' });

  const movesFor = (k: DayKind): Exercise[] => {
    if (!isStrength(k)) return [];
    const base = sessionMoves(k, level, today());
    if (todayState.moves && todayState.moves.length === base.length && todayState.kind === k) {
      return todayState.moves.map((id, i) => EXERCISES.find((e) => e.id === id) || base[i]);
    }
    return base;
  };

  const levelSel = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Mức độ' }, ([[1, 'Mới bắt đầu'], [2, 'Vừa'], [3, 'Nâng cao']] as [1 | 2 | 3, string][]).map(([v, l]) =>
    h('button', { type: 'button', role: 'radio', class: v === level ? 'on' : '', 'aria-checked': String(v === level), onclick: () => {
      level = v; db.setSetting('bodyLevel', v); todayState.moves = undefined; saveToday();
      levelSel.querySelectorAll('button').forEach((b, i) => { b.classList.toggle('on', i + 1 === v); b.setAttribute('aria-checked', String(i + 1 === v)); });
      renderPanel(); renderWeek();
    } }, l)));

  // week strip with optional editing
  const strip = h('div', { class: 'week-strip' });
  const renderWeek = () => {
    strip.replaceChildren(...week.map((k, i) => h('div', { class: `wk-day kind-${k} ${i === todayIdx ? 'today' : ''}` },
      h('span', { class: 'wk-name' }, WEEKDAY_LABEL[i]), h('span', { class: 'wk-emo' }, icon(KIND_ICON[k])), h('span', { class: 'wk-kind' }, DAY_KIND_LABEL[k].split(' (')[0]))));
    const w = checkWeek(week);
    const cardio = plannedCardioMinutes(week, level);
    warnEl.replaceChildren(
      h('p', { class: 'muted small' }, `Lịch này có ${week.filter(isStrength).length} buổi sức mạnh và khoảng ${cardio} phút cardio vừa sức mỗi tuần. WHO khuyến nghị người lớn ít nhất 150 phút vận động vừa sức mỗi tuần; đi bộ thêm trong ngày cũng được tính.`),
      ...w.map((x) => h('p', { class: 'warn small' }, icon('alert'), x)));
  };
  const editWeek = h('details', { class: 'est-edit' }, h('summary', null, icon('pen'), ' Chỉnh lịch tuần'),
    h('div', { class: 'week-edit' }, week.map((k, i) => h('label', { class: 'field' }, WEEKDAY_LABEL[i],
      h('select', { 'aria-label': `Lịch ${WEEKDAY_LABEL[i]}`, onchange: (e: Event) => { week[i] = (e.target as HTMLSelectElement).value as DayKind; db.setSetting('bodyWeek', week); renderWeek(); if (i === todayIdx && !todayState.kind) { kind = week[i]; renderPanel(); } } },
        (Object.keys(DAY_KIND_LABEL) as DayKind[]).map((d) => h('option', { value: d, selected: d === k }, DAY_KIND_LABEL[d].split(' (')[0])))))),
    h('button', { class: 'btn ghost small', type: 'button', onclick: async () => { DEFAULT_WEEK.forEach((d, i) => { week[i] = d; }); await db.setSetting('bodyWeek', week); route(); } }, 'Về lịch mặc định'));

  function moveCard(m: Exercise, i: number, moves: Exercise[]) {
    const opts = swapOptions(m, level, moves.map((x) => x.id));
    return h('div', { class: 'move-card flip', style: { animationDelay: `${i * 90}ms` } },
      h('span', { class: 'move-zone' }, ZONE_LABEL[m.zone]), h('b', null, m.name), h('span', { class: 'move-reps' }, m.reps), h('span', { class: 'muted small' }, m.cue),
      opts.length ? h('button', { class: 'btn ghost small swap', type: 'button', title: 'Đổi sang bài khác cùng nhóm cơ, cùng mức', onclick: () => {
        const next = opts[Math.floor(Math.random() * opts.length)];
        const ids = moves.map((x) => x.id); ids[i] = next.id;
        todayState.kind = kind; todayState.moves = ids; saveToday(); if (settings.sound) blip(520); renderPanel();
      } }, icon('refresh'), 'Đổi bài') : null);
  }

  function renderPanel() {
    const isPlanned = kind === week[todayIdx];
    const pick = h('select', { 'aria-label': 'Buổi hôm nay', onchange: (e: Event) => { kind = (e.target as HTMLSelectElement).value as DayKind; todayState.kind = kind; todayState.moves = undefined; saveToday(); renderPanel(); } },
      (Object.keys(DAY_KIND_LABEL) as DayKind[]).map((d) => h('option', { value: d, selected: d === kind }, DAY_KIND_LABEL[d])));
    const head = h('div', { class: 'row-between wrap' }, h('h2', null, icon(KIND_ICON[kind]), `Hôm nay: ${DAY_KIND_LABEL[kind]}`),
      h('label', { class: 'field inline' }, isPlanned ? 'Đổi buổi' : 'Đã đổi so với lịch', pick));
    let content: Node[] = [];
    if (isStrength(kind)) {
      const moves = movesFor(kind); const p = LEVEL_PARAMS[level];
      content = [
        h('p', { class: 'muted' }, `${p.minutes} phút: tập ${p.workSec} giây, nghỉ ${p.restSec} giây, xoay vòng 4 động tác. Nút "Đổi bài" chỉ đổi sang bài cùng nhóm cơ và cùng mức.`),
        h('div', { class: 'move-grid' }, moves.map((m, i) => moveCard(m, i, moves))),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: () => runTimer(moves) }, icon('play'), `Bắt đầu ${p.minutes} phút`))];
    } else if (kind === 'cardio') {
      content = [h('p', null, `Khoảng ${CARDIO_MIN[level]} phút đi bộ nhanh, đạp xe hoặc bơi ở mức vừa sức: thở nhanh hơn nhưng vẫn nói được thành câu.`),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => logSession('cardio', CARDIO_MIN[level], []) }, icon('check'), `Ghi đã tập ${CARDIO_MIN[level]} phút`))];
    } else if (kind === 'mobility') {
      content = [h('ul', { class: 'plan' }, MOBILITY.map((x) => h('li', null, x))),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => logSession('mobility', 10, []) }, icon('check'), 'Ghi đã giãn cơ 10 phút'))];
    } else {
      content = [h('p', null, 'Ngày nghỉ để cơ thể hồi phục. Nếu muốn, đi bộ nhẹ hoặc chọn "Giãn cơ" ở trên.')];
    }
    panel.replaceChildren(h('section', { class: 'card body-today' }, head, ...content));
  }

  async function logSession(k: DayKind, minutes: number, moves: string[], rounds = 0) {
    const s: BodySession = { id: uid(), date: today(), rounds, minutes, moves, level, kind: k };
    sessions = [...sessions, s]; await db.setSetting('bodySessions', sessions);
    toast('Đã ghi buổi tập'); if (settings.sound) chime(); route();
  }

  function runTimer(moves: Exercise[]) {
    const p = LEVEL_PARAMS[level];
    const total = p.minutes * 60, cycle = p.workSec + p.restSec;
    let elapsed = 0, paused = false, last = performance.now(), raf = 0, lastPhase = '';
    const big = h('div', { class: 'time' }, fmtTime(total));
    const phaseEl = h('div', { class: 'phase' });
    const moveEl = h('div', { class: 'now-move' });
    const nextEl = h('p', { class: 'muted small' });
    const roundsEl = h('span', { class: 'chip' });
    const ring = h('div', { class: 'ring body-ring' }, h('div', { class: 'ring-inner' }, phaseEl, big));
    const pauseBtn = h('button', { class: 'btn', onclick: () => { paused = !paused; pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause'), paused ? 'Tiếp tục' : 'Tạm dừng'); } }, icon('pause'), 'Tạm dừng');
    const finish = async (early: boolean) => {
      cancelAnimationFrame(raf);
      const rounds = Math.floor(elapsed / (cycle * moves.length));
      timerBox.replaceChildren(h('section', { class: 'card center done-card' }, h('p', { class: 'big-emoji' }, icon(early ? 'heart' : 'check')),
        h('h2', null, early ? 'Dừng sớm cũng được, nghe theo cơ thể.' : `Xong ${p.minutes} phút!`),
        h('p', null, `${rounds} vòng hoàn chỉnh · ${Math.round(elapsed / 60)} phút`),
        elapsed >= 60 ? h('button', { class: 'btn primary', onclick: () => logSession(kind, Math.round(elapsed / 60), moves.map((m) => m.id), rounds) }, icon('check'), 'Ghi vào lịch sử') : h('p', { class: 'muted small' }, 'Dưới 1 phút nên không ghi.'),
        h('button', { class: 'btn ghost', onclick: () => route() }, 'Bỏ qua')));
      if (settings.sound) chime();
    };
    const tick = () => {
      const now = performance.now(); if (!paused) elapsed += (now - last) / 1000; last = now;
      if (elapsed >= total) { finish(false); return; }
      const inCycle = elapsed % cycle, idx = Math.floor(elapsed / cycle) % moves.length;
      const work = inCycle < p.workSec, m = moves[idx], nx = moves[(idx + 1) % moves.length];
      const phase = `${work ? 'work' : 'rest'}${idx}`;
      if (phase !== lastPhase) { lastPhase = phase; if (settings.sound) blip(work ? 880 : 440); }
      big.textContent = fmtTime(total - elapsed);
      phaseEl.textContent = work ? `TẬP · còn ${Math.ceil(p.workSec - inCycle)}s` : `NGHỈ · còn ${Math.ceil(cycle - inCycle)}s`;
      ring.classList.toggle('rest', !work);
      ring.style.setProperty('--p', String(work ? inCycle / p.workSec : (inCycle - p.workSec) / p.restSec));
      moveEl.replaceChildren(h('span', { class: 'move-zone' }, ZONE_LABEL[m.zone]), h('b', null, work ? m.name : `Tiếp theo: ${nx.name}`), h('span', null, work ? `${m.reps} · ${m.cue}` : 'Hít thở sâu, uống ngụm nước'));
      nextEl.textContent = work ? `Sau đó: ${nx.name}` : '';
      roundsEl.textContent = `Vòng ${Math.floor(elapsed / (cycle * moves.length)) + 1}`;
      raf = requestAnimationFrame(tick);
    };
    timerBox.replaceChildren(h('section', { class: 'card center-col workout' }, roundsEl, ring, moveEl, nextEl,
      h('div', { class: 'row wrap center' }, pauseBtn,
        h('button', { class: 'btn ghost', onclick: () => { elapsed = Math.min(total - 0.01, (Math.floor(elapsed / cycle) + 1) * cycle); } }, icon('skip'), 'Bỏ qua'),
        h('button', { class: 'btn ghost danger', onclick: () => finish(true) }, icon('stop'), 'Kết thúc'))));
    tick();
    cleanup = () => cancelAnimationFrame(raf);
    timerBox.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  renderWeek(); renderPanel();
  // last 14 days and this week
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return toDay(d); });
  const byDay = new Map<string, number>(); sessions.forEach((s) => byDay.set(s.date, (byDay.get(s.date) || 0) + s.minutes));
  const monday = new Date(); monday.setDate(monday.getDate() - todayIdx);
  const weekDays = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return toDay(d); }));
  const doneThisWeek = new Set(sessions.filter((s) => weekDays.has(s.date)).map((s) => s.date)).size;
  const plannedActive = week.filter((k) => k !== 'rest').length;

  return h('div', { class: 'stack narrow' },
    h('section', { class: 'card spin-card' },
      h('div', { class: 'center' }, h('p', { class: 'eyebrow' }, 'Luyện Thân'), h('h1', null, 'Lịch tập trong tuần'),
        h('p', { class: 'muted' }, 'Mặc định cho người mới: 3 buổi sức mạnh không liền nhau, 2 buổi cardio vừa sức, 1 ngày giãn cơ, 1 ngày nghỉ. Mọi thứ đều đổi được.')),
      h('div', { class: 'row wrap center' }, h('span', { class: 'muted small' }, 'Mức độ'), levelSel),
      strip, warnEl, editWeek),
    panel, timerBox,
    h('section', { class: 'card' },
      h('div', { class: 'row-between wrap' }, h('h2', null, icon('chart'), '14 ngày qua'), h('div', { class: 'row wrap' }, h('span', { class: 'chip' }, `Tuần này: ${doneThisWeek}/${plannedActive} ngày có vận động`), h('span', { class: 'chip' }, `${sessions.length} buổi đã ghi`))),
      h('div', { class: 'day-dots' }, days.map((d) => h('div', { class: `dot-day ${byDay.has(d) ? 'on' : ''} ${d === today() ? 'today' : ''}`, title: `${d}: ${byDay.get(d) || 0} phút` }, h('span', null, d.slice(8))))),
      h('p', { class: 'muted small' }, 'Lịch sử tập tách riêng với tiến độ học. Đây là gợi ý vận động chung, không phải lời khuyên y tế: khởi động trước khi tập, dừng lại nếu đau, hỏi bác sĩ nếu bạn có bệnh nền, chấn thương hoặc đang mang thai.')),
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
        englishTitle(t) ? h('p', { class: 'title-en small', lang: 'en' }, englishTitle(t)) : null,
        t.coreQuestion && t.coreQuestion !== t.title ? h('p', { class: 'muted small clamp' }, t.coreQuestion) : null,
        stageBar(t),
        h('p', { class: 'muted small' }, `${t.keyPoints.length} ý chính · ${t.sources.length} nguồn · ${n.length} lượt nói${last !== undefined ? ` · điểm gần nhất ${last}` : ''}`));
    }) : [h('div', { class: 'card empty-state' }, h('p', null, 'Chưa có chủ đề nào ở mức này.'), h('a', { class: 'btn primary', href: `#/spin?d=${filter === 'all' ? 'day' : filter}&go=1` }, icon('shuffle'), 'Chọn ngẫu nhiên'))]));
  };
  render();

  const depthSel = h('select', { name: 'depth' }, (Object.keys(DEPTH_LABEL) as Depth[]).map((d) => h('option', { value: d, selected: (params.get('new') || 'day') === d }, `${DEPTH_LABEL[d]} - ${DEPTH_HINT[d]}`)));
  const titleIn = h('input', { name: 'title', required: true, placeholder: 'Ví dụ: Khủng hoảng năng lượng châu Âu 2022', autocomplete: 'off' });
  const enIn = h('input', { name: 'en', lang: 'en', placeholder: 'Ví dụ: The 2022 European energy crisis', autocomplete: 'off' });
  const qIn = h('input', { name: 'q', placeholder: 'Có thể để trống và khám phá rộng trước', autocomplete: 'off' });
  const form = h('form', { class: 'card new-topic', onsubmit: async (e: Event) => {
    e.preventDefault();
    const t = newTopic(titleIn.value.trim(), depthSel.value as Depth);
    t.coreQuestion = qIn.value.trim();
    if (enIn.value.trim()) t.titleEn = enIn.value.trim();
    await db.saveTopic(t); go(`#/topic/${t.id}`);
  } },
    h('h2', null, 'Chủ đề mới'),
    h('a', { class: 'btn ghost spin-inline', href: `#/spin?d=${params.get('new') || 'day'}&go=1` }, icon('shuffle'), 'Chưa nghĩ ra? Chọn ngẫu nhiên'),
    h('p', { class: 'muted small' }, 'Hoặc tự đặt chủ đề của riêng bạn:'),
    h('label', { class: 'field' }, 'Tên chủ đề', titleIn),
    h('label', { class: 'field' }, 'Tên tiếng Anh (không bắt buộc)', enIn),
    h('label', { class: 'field' }, 'Câu hỏi cốt lõi (tuỳ chọn)', qIn),
    h('label', { class: 'field' }, 'Độ sâu', depthSel),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary' }, 'Tạo chủ đề')));
  if (params.get('new')) setTimeout(() => titleIn.focus(), 50);

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, (['all', 'minute', 'day', 'week', 'deep'] as const).map((d) =>
    h('button', { role: 'tab', class: d === filter ? 'on' : '', onclick: (e: Event) => {
      filter = d; tabs.querySelectorAll('button').forEach((b) => b.classList.remove('on')); (e.target as HTMLElement).classList.add('on'); render();
    } }, d === 'all' ? 'Tất cả' : DEPTH_LABEL[d])));

  return h('div', { class: 'stack' }, h('div', { class: 'two-col' },
    h('div', { class: 'stack' }, h('div', { class: 'row-between wrap' }, h('h1', null, 'Chủ đề của bạn'), tabs), listEl), form));
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
    h('div', { class: 'row-between wrap' }, h('div', { class: 'row wrap' }, depthChip(t.depth), t.category ? h('span', { class: 'chip' }, t.category) : null, t.suggestions?.disputed ? disputedChip() : null),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost small', onclick: async () => { await navigator.clipboard.writeText(reviewBundle(t, attempts[attempts.length - 1] || null)); toast('Đã sao chép gói Markdown'); } }, 'Sao chép để review'),
        h('button', { class: 'btn primary', onclick: () => go(`#/practice/${t.id}`) }, 'Luyện nói'))),
    h('h1', { contenteditable: 'true', class: 'editable', onblur: (e: Event) => { const v = (e.target as HTMLElement).textContent!.trim(); if (v && v !== t.title) { renameTopic(t, v); save().then(refresh); } } }, t.title),
    h('div', { class: 'en-edit' },
      h('input', { lang: 'en', 'aria-label': 'Tên tiếng Anh (không bắt buộc)', placeholder: 'Tên tiếng Anh (không bắt buộc)', value: englishTitle(t), onchange: (e: Event) => { t.titleEn = (e.target as HTMLInputElement).value.trim(); save().then(refresh); } }),
      englishTitle(t) ? h('a', { class: 'small', href: searchUrl(englishTitle(t)), target: '_blank', rel: 'noopener noreferrer' }, icon('search'), ' Tìm bằng tiếng Anh') : null),
    h('label', { class: 'field' }, 'Câu hỏi cốt lõi (tuỳ chọn)',
      h('textarea', { rows: 2, placeholder: 'Để trống nếu bạn muốn khám phá rộng. Có thể đặt sau.', onchange: (e: Event) => { t.coreQuestion = (e.target as HTMLTextAreaElement).value; save(); } }, t.coreQuestion)),
    t.keywords?.length ? h('div', { class: 'field' }, h('span', null, 'Tìm kiếm gợi ý (mở Google)'), keywordChips(t.keywords)) : null,
    h('div', { class: 'field' }, h('span', null, 'Bạn đang ở đâu (tự chọn, không bắt buộc theo thứ tự)'), stageBar(t, (s) => { t.stage = s; save().then(refresh); }), h('p', { class: 'muted small' }, STAGE_HINT[t.stage])),
    h('div', { class: 'row wrap' }, h('label', { class: 'field inline' }, 'Độ sâu mong muốn',
      h('select', { onchange: (e: Event) => { t.depth = (e.target as HTMLSelectElement).value as Depth; save().then(refresh); } },
        (Object.keys(DEPTH_LABEL) as Depth[]).map((d) => h('option', { value: d, selected: d === t.depth }, DEPTH_LABEL[d])))),
      h('button', { class: 'btn ghost small danger', onclick: async () => { if (confirm('Xoá chủ đề này và mọi bản ghi âm?')) { await db.deleteTopic(t.id); go('#/topics'); } } }, 'Xoá chủ đề')));

  // optional planning estimate and personal direction
  t.plan ??= {};
  const est = estimateBox(t.depth, t.complexity, t.plan, () => save());
  const planning = h('section', { class: 'card' }, h('h2', null, icon('hourglass'), 'Kế hoạch của bạn'),
    est || h('p', { class: 'muted small' }, 'Câu hỏi 1 phút không cần kế hoạch, bạn cứ nói.'),
    t.suggestions?.book ? bookNote() : null,
    h('label', { class: 'field' }, 'Hướng đi riêng (tuỳ chọn)',
      h('textarea', { rows: 2, placeholder: 'Bạn muốn tìm hiểu chủ đề này theo hướng nào, vì sao?', onchange: (e: Event) => { t.direction = (e.target as HTMLTextAreaElement).value; save(); } }, t.direction || '')));

  const sugg = t.suggestions && !t.hideSuggestions ? h('section', { class: 'card subtle-card' }, suggestionsPanel(t.suggestions, t.depth, {
    onUseCore: () => { t.coreQuestion = t.suggestions!.core; save().then(refresh); toast('Đã đặt câu hỏi, bạn vẫn sửa được'); },
    onUsePlan: () => { const n = adoptPlan(t, uid).length; save().then(refresh); toast(n ? `Đã chép ${n} cột mốc, xoá thoải mái` : 'Các cột mốc này đã có'); },
    onAddSource: (src) => { if (t.sources.some((x) => x.url === src.url)) { toast('Nguồn này đã có'); return; } t.sources.push({ id: uid(), title: `${src.title} (${src.org})`, url: src.url, note: '', status: 'todo' }); save().then(refresh); },
    onHide: () => { t.hideSuggestions = true; save().then(refresh); },
  })) : t.suggestions ? h('button', { class: 'btn ghost small', onclick: () => { t.hideSuggestions = false; save().then(refresh); } }, icon('bulb'), 'Hiện lại gợi ý') : null;

  const noteArea = (label: string, hint: string, key: 'understanding' | 'facts' | 'interpretation') => h('label', { class: 'field' }, label,
    h('textarea', { rows: 3, placeholder: hint, 'data-note': key, onchange: (e: Event) => { t[key] = (e.target as HTMLTextAreaElement).value; save(); } }, t[key] || ''));
  const notes = h('section', { class: 'card' }, h('h2', null, icon('note'), 'Ghi chú của tôi'),
    h('p', { class: 'muted small' }, 'Tất cả đều tuỳ chọn. Tách điều có nguồn với điều bạn tự suy ra giúp lúc giảng lại và lúc nhờ người khác review.'),
    noteArea('Hiểu biết hiện tại', 'Bạn đang hiểu chủ đề này thế nào, bằng lời của mình?', 'understanding'),
    h('details', { open: !!(t.facts || t.interpretation) }, h('summary', null, 'Tách "có nguồn" và "suy nghĩ của tôi"'),
      noteArea('Điều có nguồn', 'Sự kiện, số liệu, trích dẫn, kèm nguồn nào', 'facts'),
      noteArea('Diễn giải, giả định, chỗ chưa chắc', 'Suy luận của bạn, điều đang giả định, điều chưa kiểm chứng', 'interpretation')));

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
    h('p', { class: 'muted small' }, longForm ? 'Tuỳ chọn: ghi lại đã đọc gì, đặt cột mốc riêng nếu thấy có ích.' : 'Tuỳ chọn, hay dùng cho chủ đề dài hơn.'),
    h('h3', null, 'Cột mốc'), ms,
    h('form', { class: 'add-row', onsubmit: (e: Event) => { e.preventDefault(); if (!mText.value.trim()) return; t.milestones.push({ id: uid(), text: mText.value.trim(), due: mDue.value || undefined, done: false }); mText.value = ''; mDue.value = ''; save(); renderMs(); } },
      mText, mDue, h('button', { class: 'btn small' }, 'Thêm')),
    h('h3', null, 'Nhật ký đọc'),
    h('form', { class: 'add-row', onsubmit: (e: Event) => { e.preventDefault(); t.readingLog.push({ id: uid(), date: today(), minutes: Number(lMin.value) || 0, sourceId: lSrc.value || undefined, note: lNote.value.trim() }); lNote.value = ''; save(); renderLog(); } },
      lMin, lSrc, lNote, h('button', { class: 'btn small' }, 'Ghi')), logList);

  // review
  const rv = t.review;
  const review = h('section', { class: 'card' }, h('h2', null, 'Lịch ôn giãn cách'),
    h('p', { class: 'muted small' }, `Tuỳ chọn. Nhắc giảng lại sau ${REVIEW_STEPS.join(', ')} ngày. Bậc ôn dựa trên điểm trình bày tự động (từ 70 lên bậc, dưới 50 về đầu), không phải điểm hiểu bài; bạn có thể tắt bất cứ lúc nào.`),
    rv ? h('div', null, h('p', null, 'Hạn ôn tiếp theo: ', h('b', null, rv.due || '-'), isDue(rv, today()) ? h('span', { class: 'chip due' }, 'Đến hạn') : null, ` (bậc ${rv.step + 1}/${REVIEW_STEPS.length})`),
      rv.history.length ? h('p', { class: 'muted small' }, 'Đã ôn: ' + rv.history.map((x) => `${x.date} (${x.score})`).join(', ')) : null,
      h('button', { class: 'btn ghost small', onclick: () => { t.review = null; save().then(refresh); } }, 'Tắt lịch ôn')) :
      h('button', { class: 'btn', onclick: () => { t.review = startReview(today()); if (t.stage !== 'review') t.stage = 'review'; save().then(refresh); } }, 'Bật lịch ôn'));

  // attempts
  const scores = attempts.filter((a) => a.metrics).map((a) => a.metrics!.score);
  const history = h('section', { class: 'card' }, h('div', { class: 'row-between' }, h('h2', null, 'Lịch sử luyện nói'), h('span', { class: 'muted small' }, `${attempts.length} lượt`)),
    trendChart(scores),
    attempts.length ? h('ul', { class: 'attempts' }, [...attempts].reverse().map((a) => attemptRow(t, a, refresh))) : h('p', { class: 'muted' }, 'Chưa có lượt nói nào.'));

  return h('div', { class: 'stack' }, head, sugg, h('div', { class: 'two-col even' },
    h('div', { class: 'stack' },
      notes,
      sources,
      editableList('Câu hỏi của tôi', t.openQuestions, 'Điều bạn tò mò, chưa hiểu hoặc muốn kiểm chứng', save, { check: true, hint: 'Câu hỏi của riêng bạn. Đánh dấu khi đã tự trả lời được.' }),
      editableList('Ý chính (tuỳ chọn)', t.keyPoints, 'Một ý bạn muốn nhắc khi nói', save, { hint: 'Nếu có, app đếm xem lúc nói bạn có nhắc tới các từ khoá này không. Đây chỉ là so khớp từ, không chấm đúng sai.' })),
    h('div', { class: 'stack' }, planning, history, review, journal)));
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
          if (p.kind === 'download' && p.total) setProg(p.loaded! / p.total, `Đang tải mô hình: ${(p.loaded! / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} MB (chỉ lần đầu, sau đó dùng cache)`);
          else if (p.text) setProg(null, p.text);
        }, settings.device, settings.language);
        ta.value = res.text; chunks = res.chunks; a.transcript = res.text; a.transcriptSource = 'whisper';
        setProg(1, `Xong (${res.model.split('/')[1]}, ${res.device === 'webgpu' ? 'WebGPU' : 'WASM'}). Hãy đọc lại và sửa lỗi nhận dạng trước khi chấm.`);
        await db.saveAttempt(a);
      } catch (e) { setProg(0, 'Lỗi: ' + (e instanceof Error ? e.message : String(e))); }
      whisperBtn.disabled = false;
    } }, icon('note'), 'Chuyển giọng nói thành chữ (Whisper)');

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
        h('span', { class: 'muted small' }, settings.engine === 'webspeech' ? 'Đang dùng Web Speech (âm thanh gửi tới máy chủ của trình duyệt). Whisper chạy hoàn toàn trên máy.' : `Mô hình: ${settings.model === 'auto' ? 'tự động' : settings.model.split('/')[1]} · chạy trên máy, không gửi âm thanh đi đâu`)),
      prog, ta,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: analyse }, 'Tính chỉ số'),
        h('button', { class: 'btn ghost', onclick: async () => { a.transcript = ta.value.trim(); await db.saveAttempt(a); await navigator.clipboard.writeText(reviewBundle(t!, a)); toast('Đã sao chép gói Markdown'); } }, 'Sao chép để review'))),
      card);
    if (a.metrics) { const prev = (await db.attempts(t!.id)).filter((x) => x.metrics).map((x) => x.metrics!.score); card.replaceChildren(scoreCard(a.metrics, prev, t!)); }
  }

  if (attempt) showAfter(attempt.audioId ? await db.audio(attempt.audioId) : undefined);
  cleanup = () => { cancelAnimationFrame(timer); if (recording) recorder.stop(); live?.stop(); };

  return h('div', { class: 'stack' },
    h('section', { class: 'card practice-head' },
      h('a', { class: 'back small', href: `#/topic/${t.id}` }, '← ', t.title, englishTitle(t) ? h('span', { class: 'muted', lang: 'en' }, ` · ${englishTitle(t)}`) : null),
      h('h1', null, t.coreQuestion || t.title),
      !t.coreQuestion && englishTitle(t) ? h('p', { class: 'title-en', lang: 'en' }, englishTitle(t)) : null,
      t.keyPoints.length ? h('details', null, h('summary', null, `Ý chính bạn muốn nhắc (${t.keyPoints.length}, tuỳ chọn)`), h('ul', null, t.keyPoints.map((k) => h('li', null, k.text)))) : null),
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
    h('div', { class: 'row-between wrap' }, h('h2', null, icon('chart'), 'Chỉ số trình bày'), h('div', { class: `big-score ${scoreClass(m.score)}` }, String(m.score), h('small', null, '/100'))),
    h('p', { class: 'muted small' }, 'Điểm tổng hợp này đo cách nói và vài dấu hiệu bề mặt. Nó không đo bạn hiểu sâu tới đâu hay nói đúng sự thật không. Muốn kiểm tra nội dung, dùng "Sao chép để review" kèm nguồn của bạn.'),
    h('h3', null, 'Cách nói'),
    h('div', { class: 'metrics' },
      part('Tốc độ', 'pace', `${m.wpm} âm tiết/phút`, `Khoảng thoải mái ${PACE_RANGE[0]}-${PACE_RANGE[1]} (ngưỡng tự đặt, không phải chuẩn). ${m.words} âm tiết.`),
      part('Từ đệm', 'fillers', `${m.fillers.total} (${(m.fillers.ratio * 100).toFixed(1)}%)`, fillerList || 'Không phát hiện từ đệm. Dưới 3% là bình thường.'),
      part('Ngắt quãng dài', 'pauses', `${m.pauses.length}`, m.pauses.length ? `Dài nhất ${m.longestPause.toFixed(1)} giây (ngưỡng 1,5 giây)` : 'Không có khoảng lặng dài.'),
      part('Thời lượng', 'duration', `${fmtTime(m.durationSec)} / ${fmtTime(m.targetSec)}`, 'Gần mục tiêu (85%-110%) thì đủ điểm.')),
    h('h3', null, 'Dấu hiệu bề mặt (heuristic)'),
    h('div', { class: 'metrics' },
      part(m.structure.kind === 'feynman' ? 'Cụm từ khung Feynman' : 'Cụm từ khung P.R.E.P', 'structure', `${Math.round(m.structure.score * 100)}%`,
        'Chỉ dò các cụm như "theo tôi", "ví dụ", "tóm lại". ' + m.structure.hints.map((x) => `${x.found ? '✓' : '·'} ${x.label}`).join('   ')),
      m.coverage.items.length ? part('Trùng từ khoá với ý chính', 'coverage', `${Math.round(m.coverage.ratio * 100)}%`, `${m.coverage.items.filter((i) => i.state === 'covered').length}/${m.coverage.items.length} ý có từ khoá xuất hiện. So khớp từ, không chấm đúng sai.`) : null),
    m.coverage.items.length ? h('ul', { class: 'coverage' }, m.coverage.items.map((i) => h('li', { class: i.state }, h('span', { class: 'dot' }), i.point,
      h('span', { class: 'muted small' }, i.state === 'covered' ? ' có từ khoá' : i.state === 'partial' ? ' một phần từ khoá' : ' không thấy từ khoá')))) :
      h('p', { class: 'muted small' }, 'Thêm "Ý chính" (tuỳ chọn) nếu muốn app đếm từ khoá khi bạn nói.'),
    h('h3', null, 'Xu hướng điểm trình bày'), trendChart(scores),
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
  const gpu = await detectWebGPU();
  const autoInfo = WHISPER_MODELS.find((m) => m.id === AUTO_MODEL[gpu ? 'webgpu' : 'wasm'])!;
  const dev: 'webgpu' | 'wasm' = settings.device === 'wasm' || !gpu ? 'wasm' : 'webgpu';
  const sizeOf = (m: typeof WHISPER_MODELS[number]) => `~${m.sizeMB[dev]} MB`;
  const modelNote = h('p', { class: 'muted small' });
  const setNote = () => {
    const m = settings.model === 'auto' ? autoInfo : WHISPER_MODELS.find((x) => x.id === settings.model)!;
    modelNote.textContent = `${m.note} Tải ${sizeOf(m)} một lần rồi lưu cache trình duyệt.` + (dev === 'wasm' && !m.wasmOk ? ' Cảnh báo: mô hình này rất chậm khi không có WebGPU.' : '');
  };
  setNote();
  return h('div', { class: 'stack narrow' }, h('h1', null, 'Cài đặt'),
    h('section', { class: 'card' }, h('h2', null, icon('mic'), 'Nhận dạng giọng nói'),
      h('p', { class: 'small' }, gpu ? 'Trình duyệt này có WebGPU: dùng được mô hình lớn, chính xác nhất.' : 'Không thấy WebGPU: sẽ chạy bằng CPU (WASM) với mô hình gọn hơn.'),
      h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'eng', checked: settings.engine === 'whisper', onchange: () => { settings.engine = 'whisper'; save(); } }),
        h('span', null, h('b', null, 'Whisper trên máy (khuyên dùng)'), h('br'), h('span', { class: 'muted small' }, 'Mã nguồn mở, chạy trong trình duyệt bằng transformers.js. Không gửi âm thanh đi đâu.'))),
      h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'eng', disabled: !webSpeechSupported(), checked: settings.engine === 'webspeech', onchange: () => { settings.engine = 'webspeech'; save(); } }),
        h('span', null, h('b', null, 'Web Speech API (nhanh, chữ hiện trực tiếp)'), h('br'), h('span', { class: 'muted small' }, webSpeechSupported() ? 'Lưu ý: âm thanh được gửi tới máy chủ của hãng trình duyệt (ví dụ Google) để nhận dạng. Vẫn có thể chạy Whisper sau đó.' : 'Trình duyệt này không hỗ trợ.'))),
      h('label', { class: 'field' }, 'Mô hình Whisper', h('select', { 'aria-label': 'Mô hình Whisper', onchange: (e: Event) => { settings.model = (e.target as HTMLSelectElement).value as WhisperModel; save(); setNote(); } },
        h('option', { value: 'auto', selected: settings.model === 'auto' }, `Tự động: ${autoInfo.label} (${sizeOf(autoInfo)})`),
        WHISPER_MODELS.map((m) => h('option', { value: m.id, selected: m.id === settings.model }, `${m.label} (${sizeOf(m)})`)))),
      modelNote,
      h('label', { class: 'field' }, 'Thiết bị tính toán', h('select', { 'aria-label': 'Thiết bị tính toán', onchange: (e: Event) => { settings.device = (e.target as HTMLSelectElement).value as Settings['device']; save(); route(); } },
        [['auto', 'Tự động (WebGPU nếu có, không thì WASM)'], ['webgpu', 'WebGPU'], ['wasm', 'WASM (CPU)']].map(([v, l]) => h('option', { value: v, selected: v === settings.device }, l)))),
      h('label', { class: 'field' }, 'Ngôn ngữ khi nói', h('select', { 'aria-label': 'Ngôn ngữ', onchange: (e: Event) => { settings.language = (e.target as HTMLSelectElement).value as Settings['language']; save(); } },
        [['vietnamese', 'Tiếng Việt (mặc định)'], ['english', 'Tiếng Anh']].map(([v, l]) => h('option', { value: v, selected: v === settings.language }, l)))),
      h('div', { class: 'actions' }, h('button', { class: 'btn ghost small', onclick: async () => {
        const keys = 'caches' in window ? await caches.keys() : [];
        let n = 0; for (const k of keys) if (/transformers/i.test(k)) { await caches.delete(k); n++; }
        toast(n ? 'Đã xoá cache mô hình' : 'Không có cache mô hình');
      } }, icon('trash'), 'Xoá cache mô hình'))),
    h('section', { class: 'card' }, h('h2', null, icon('sparkle'), 'Hiệu ứng'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: settings.sound, onchange: (e: Event) => { settings.sound = (e.target as HTMLInputElement).checked; save(); } }), ' Âm thanh nhẹ khi chọn chủ đề và khi hẹn giờ'),
      h('p', { class: 'muted small' }, 'Hoạt ảnh tự tắt nếu hệ điều hành bật "giảm chuyển động".')),
    h('section', { class: 'card' }, h('h2', null, icon('save'), 'Sao lưu dữ liệu'),
      h('p', { class: 'muted small' }, 'Dữ liệu nằm trong IndexedDB của trình duyệt này. Hãy xuất tệp JSON định kỳ.'),
      h('label', { class: 'check' }, withAudio, ' Kèm bản ghi âm (tệp lớn hơn)'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => {
          const b = await exportBackup(withAudio.checked); const a = h('a', { href: URL.createObjectURL(b), download: `omni-feyn-${today()}.json` }); a.click();
        } }, 'Xuất JSON'),
        h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, 'Nhập JSON'), fileIn)));
}

// ---------- boot ----------

(async () => {
  settings = { ...settings, ...(await db.getSetting<Partial<Settings>>('settings', {})) };
  if (!['auto', ...WHISPER_MODELS.map((m) => m.id)].includes(settings.model)) settings.model = 'auto';
  window.addEventListener('hashchange', route);
  route();
})();
