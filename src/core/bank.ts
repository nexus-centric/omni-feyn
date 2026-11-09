// Topic bank for all depth levels and a no-repeat random drawer.
import type { Depth } from './types.js';
import { MINUTE_RAW } from './bank-minute.js';
import { DAY_RAW } from './bank-day.js';
import { WEEK_RAW } from './bank-week.js';
import { DEEP_RAW } from './bank-deep.js';
import { EN_TITLE } from './bank-en.js';
import { META, START_SOURCES, type Complexity, type StartSource } from './bank-meta.js';
import { MORE_MINUTE, type BankFlag } from './bank-more-minute.js';
import { MORE_DAY } from './bank-more-day.js';
import { MORE_WEEK, MORE_DEEP } from './bank-more-long.js';

export interface BankCategory { id: string; name: string; emoji: string; priority?: boolean; }
/** Categories. Priority areas (owner request 2026-11-06): technology, economics and finance, psychology,
 * phenomena and curiosities, books. `emoji` is kept for data compatibility; the UI no longer shows it. */
export const CATEGORIES: BankCategory[] = [
  { id: 'cong-nghe', name: 'Công nghệ & máy tính', emoji: '', priority: true },
  { id: 'devops', name: 'DevOps & hạ tầng', emoji: '', priority: true },
  { id: 'kinh-te', name: 'Kinh tế & tài chính', emoji: '', priority: true },
  { id: 'tam-ly', name: 'Tâm lý', emoji: '', priority: true },
  { id: 'hien-tuong', name: 'Hiện tượng & điều thú vị', emoji: '', priority: true },
  { id: 'sach', name: 'Sách', emoji: '', priority: true },
  { id: 'khoa-hoc', name: 'Khoa học', emoji: '' },
  { id: 'lich-su', name: 'Lịch sử', emoji: '' },
  { id: 'the-gioi', name: 'Thế giới & địa chính trị', emoji: '' },
  { id: 'xa-hoi', name: 'Xã hội', emoji: '' },
  { id: 'van-hoa', name: 'Văn hoá & nghệ thuật', emoji: '' },
  { id: 'giao-duc', name: 'Giáo dục & học tập', emoji: '' },
  { id: 'ban-than', name: 'Bản thân & phát triển', emoji: '' },
  { id: 'cong-viec', name: 'Công việc & sự nghiệp', emoji: '' },
  { id: 'moi-truong', name: 'Môi trường & sức khoẻ', emoji: '' },
];
/**
 * Draw weights used only when the filter is "all": a category is chosen first (weighted), then a
 * topic inside it without repeats. Priority areas weigh 3, other areas 1. DevOps weighs 1.5 because
 * technology already has its own priority category, so tech as a whole gets 4.5 rather than 6.
 */
export const CATEGORY_WEIGHT: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id === 'devops' ? 1.5 : c.priority ? 3 : 1]));
export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, BankCategory>;

export interface BankItem {
  id: string;
  depth: Depth;
  cat: string;
  title: string;
  core: string;
  plan: string[];
  keywords: string[];
  /** English display title (every depth). */
  en: string;
  /** English search terms, including the plain search subject when it differs from the title. */
  enTerms: string[];
  complexity: Complexity;
  /** Optional link-checked starting sources. */
  sources: StartSource[];
  /** 'disputed' when the idea's evidence or interpretation is debated (shown as a label). */
  flag?: BankFlag;
}

function withMeta(depth: Depth, cat: string, title: string, core: string, plan: string[], keywords: string[]): BankItem {
  const m = META[title];
  const en = EN_TITLE[title] || m?.[0] || '';
  const terms = [...(m?.[0] && m[0] !== en ? [m[0]] : []), ...(m?.[2] || [])];
  return { id: `${depth}:${slug(title)}`, depth, cat, title, core, plan, keywords, en, enTerms: terms.length ? terms : en ? [en] : [], complexity: m?.[1] || 2, sources: START_SOURCES[title] || [] };
}

export const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const minuteItem = (cat: string, p: string, en = EN_TITLE[p] || '', flag?: BankFlag): BankItem =>
  ({ id: `minute:${slug(p)}`, depth: 'minute', cat, title: p, core: p, plan: [], keywords: [], en, enTerms: [], complexity: 1, sources: [], ...(flag ? { flag } : {}) });

/** Items from the expansion files carry their own English title, complexity and search terms. */
function moreItem(depth: Depth, [cat, title, en, complexity, core, plan, keywords, enTerms, flag]: [string, string, string, Complexity, string, string[], string[], string[], BankFlag?]): BankItem {
  return { id: `${depth}:${slug(title)}`, depth, cat, title, core, plan, keywords, en, enTerms, complexity, sources: START_SOURCES[title] || [], ...(flag ? { flag } : {}) };
}

export const BANK: Record<Depth, BankItem[]> = {
  minute: [
    ...MINUTE_RAW.flatMap((c) => c.prompts.map((p) => minuteItem(c.cat, p))),
    ...MORE_MINUTE.map(([cat, p, en, flag]) => minuteItem(cat, p, en, flag)),
  ],
  day: [
    ...DAY_RAW.map(([cat, title, core, keywords]) => withMeta('day', cat, title, core, [], keywords)),
    ...MORE_DAY.map(([cat, title, en, cx, core, keywords, enTerms, flag]) => moreItem('day', [cat, title, en, cx, core, [], keywords, enTerms, flag])),
  ],
  week: [
    ...WEEK_RAW.map(([cat, title, core, plan, keywords]) => withMeta('week', cat, title, core, plan, keywords)),
    ...MORE_WEEK.map((r) => moreItem('week', [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]])),
  ],
  deep: [
    ...DEEP_RAW.map(([cat, title, core, plan, keywords]) => withMeta('deep', cat, title, core, plan, keywords)),
    ...MORE_DEEP.map((r) => moreItem('deep', [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]])),
  ],
};

export function categoriesFor(depth: Depth): (BankCategory & { count: number })[] {
  return CATEGORIES.map((c) => ({ ...c, count: BANK[depth].filter((i) => i.cat === c.id).length })).filter((c) => c.count > 0);
}

/** Random drawer that never repeats an item within a session until the pool (per depth + category) is exhausted. */
export class Drawer {
  private used = new Map<string, Set<string>>();
  private last = new Map<Depth, string>();
  constructor(private rng: () => number = Math.random, private bank: Record<Depth, BankItem[]> = BANK, private weights: Record<string, number> = CATEGORY_WEIGHT) {}

  pool(depth: Depth, cat = 'all'): BankItem[] {
    return this.bank[depth].filter((i) => cat === 'all' || i.cat === cat);
  }

  draw(depth: Depth, cat = 'all'): BankItem {
    const pool = this.pool(depth, cat);
    if (!pool.length) throw new Error('Empty pool');
    const key = `${depth}|${cat}`;
    let used = this.used.get(key);
    if (!used) { used = new Set(); this.used.set(key, used); }
    let avail = pool.filter((i) => !used!.has(i.id));
    if (!avail.length) {
      used.clear();
      avail = pool.length > 1 ? pool.filter((i) => i.id !== this.last.get(depth)) : pool;
    }
    let candidates = avail;
    if (cat === 'all') {
      // Balanced draw: pick a category among those with unused topics (weighted), then a topic in it.
      const cats = [...new Set(avail.map((i) => i.cat))];
      const total = cats.reduce((s, c) => s + (this.weights[c] ?? 1), 0);
      let r = this.rng() * total;
      let chosen = cats[cats.length - 1];
      for (const c of cats) { r -= this.weights[c] ?? 1; if (r < 0) { chosen = c; break; } }
      candidates = avail.filter((i) => i.cat === chosen);
    }
    const pick = candidates[Math.floor(this.rng() * candidates.length) % candidates.length];
    used.add(pick.id);
    this.last.set(depth, pick.id);
    return pick;
  }

  /** Random items for the shuffle animation (may repeat; display only). */
  teasers(depth: Depth, cat: string, n: number): BankItem[] {
    const pool = this.pool(depth, cat);
    return Array.from({ length: n }, () => pool[Math.floor(this.rng() * pool.length) % pool.length]);
  }

  remaining(depth: Depth, cat = 'all'): number {
    const used = this.used.get(`${depth}|${cat}`);
    return this.pool(depth, cat).filter((i) => !used?.has(i.id)).length;
  }
}
