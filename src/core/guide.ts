// Optional "Analyze" and "Present" guidance for a topic. Nothing here is required: the topic stays a
// random subject and the user may ignore every suggestion.
import type { Depth } from './types.js';

export type LensId = 'swot' | 'cause-effect' | 'claim-evidence' | 'book' | 'mechanism-tradeoffs' | 'context-timeline' | 'stakeholders' | 'perspectives';
export type PresentId = 'prep' | 'prep-branches' | 'branches';

export interface GuideStep { name: string; en: string; tip: string; }
export interface Lens { id: LensId; name: string; en: string; why: string; steps: GuideStep[]; }
export interface PresentMode { id: PresentId; name: string; en: string; why: string; steps: GuideStep[]; }

/** What lens selection needs to know about a topic (bank item or saved topic). */
export interface GuideInput {
  depth: Depth;
  /** Bank category id, when known. */
  cat?: string;
  title: string;
  en?: string;
  disputed?: boolean;
  book?: boolean;
}

export const MECE: GuideStep[] = [
  { name: 'Câu hỏi gốc', en: 'Key question', tip: 'Viết ra một câu bạn muốn trả lời về chủ đề này.' },
  { name: 'Tách nhánh', en: 'Issue tree', tip: 'Chia thành 3-5 nhánh lớn. Mỗi nhánh có thể chia tiếp nếu cần.' },
  { name: 'Không trùng lặp', en: 'Mutually exclusive', tip: 'Hai nhánh không nói cùng một chuyện.' },
  { name: 'Không bỏ sót', en: 'Collectively exhaustive', tip: 'Gộp các nhánh lại thì phủ hết câu hỏi gốc.' },
];

export const LENSES: Record<LensId, Lens> = {
  swot: {
    id: 'swot', name: 'Điểm mạnh, điểm yếu, cơ hội, rủi ro', en: 'SWOT', why: 'Hợp với chủ đề về chiến lược, kinh doanh hay một quyết định.',
    steps: [
      { name: 'Điểm mạnh', en: 'Strengths', tip: 'Lợi thế bên trong của lựa chọn này.' },
      { name: 'Điểm yếu', en: 'Weaknesses', tip: 'Hạn chế bên trong, cái giá phải trả.' },
      { name: 'Cơ hội', en: 'Opportunities', tip: 'Điều kiện bên ngoài có thể tận dụng.' },
      { name: 'Rủi ro', en: 'Threats', tip: 'Điều bên ngoài có thể làm hỏng kế hoạch.' },
    ],
  },
  'cause-effect': {
    id: 'cause-effect', name: 'Chuỗi nguyên nhân và kết quả', en: 'Cause and effect chain', why: 'Hợp với hiện tượng, cơ chế khoa học hay kinh tế.',
    steps: [
      { name: 'Điều kiện ban đầu', en: 'Conditions', tip: 'Cần có gì thì hiện tượng mới xảy ra?' },
      { name: 'Cơ chế', en: 'Mechanism', tip: 'Từng bước, cái gì dẫn tới cái gì.' },
      { name: 'Kết quả', en: 'Effects', tip: 'Ta thấy hoặc đo được gì.' },
      { name: 'Ngoại lệ', en: 'Limits', tip: 'Khi nào chuỗi này không còn đúng?' },
    ],
  },
  'claim-evidence': {
    id: 'claim-evidence', name: 'Luận điểm, bằng chứng, phản biện', en: 'Claim, evidence, counterargument', why: 'Chủ đề này còn tranh luận, nên tách rõ điều được nói và điều được chứng minh.',
    steps: [
      { name: 'Luận điểm', en: 'Claim', tip: 'Ý tưởng gốc nói chính xác điều gì?' },
      { name: 'Bằng chứng', en: 'Evidence', tip: 'Nghiên cứu nào ủng hộ, cỡ mẫu và cách làm ra sao.' },
      { name: 'Phản biện', en: 'Counterargument', tip: 'Nghiên cứu lặp lại hoặc lời phê bình nói gì.' },
      { name: 'Kết luận tạm', en: 'Current verdict', tip: 'Điều gì còn đứng vững, điều gì nên bỏ.' },
    ],
  },
  book: {
    id: 'book', name: 'Ý chính và cách áp dụng', en: 'Key ideas and application', why: 'Với sách, nên nắm vài ý lớn rồi thử đem vào đời thật.',
    steps: [
      { name: 'Tác giả muốn trả lời gì', en: 'Central question', tip: 'Một câu cho cả cuốn sách.' },
      { name: 'Ba đến năm ý chính', en: 'Key ideas', tip: 'Mỗi ý kèm lập luận hoặc bằng chứng tác giả dùng.' },
      { name: 'Áp dụng', en: 'Application', tip: 'Một việc cụ thể bạn có thể thử.' },
      { name: 'Giới hạn', en: 'Critique', tip: 'Chỗ nào bạn không đồng ý hoặc sách đã cũ.' },
    ],
  },
  'mechanism-tradeoffs': {
    id: 'mechanism-tradeoffs', name: 'Cách hoạt động và đánh đổi', en: 'How it works and trade-offs', why: 'Hợp với công nghệ và hạ tầng: hiểu cơ chế rồi xem được gì, mất gì.',
    steps: [
      { name: 'Giải quyết vấn đề gì', en: 'Problem', tip: 'Trước khi có nó, người ta gặp khó gì?' },
      { name: 'Cách hoạt động', en: 'How it works', tip: 'Các thành phần chính và luồng chạy.' },
      { name: 'Đánh đổi', en: 'Trade-offs', tip: 'Được gì, mất gì, so với cách khác.' },
      { name: 'Khi nào dùng', en: 'When to use', tip: 'Tình huống hợp và không hợp.' },
    ],
  },
  'context-timeline': {
    id: 'context-timeline', name: 'Bối cảnh, diễn biến, hệ quả', en: 'Context, events, consequences', why: 'Hợp với chủ đề lịch sử.',
    steps: [
      { name: 'Bối cảnh', en: 'Context', tip: 'Thời điểm, nơi chốn, ai liên quan.' },
      { name: 'Diễn biến', en: 'Timeline', tip: 'Các mốc chính theo thứ tự.' },
      { name: 'Nguyên nhân', en: 'Causes', tip: 'Vì sao sự việc diễn ra như vậy.' },
      { name: 'Hệ quả', en: 'Consequences', tip: 'Điều gì còn ảnh hưởng tới hôm nay.' },
    ],
  },
  stakeholders: {
    id: 'stakeholders', name: 'Các bên liên quan', en: 'Stakeholder map', why: 'Hợp với chủ đề xã hội và thế giới, nơi mỗi bên có lợi ích riêng.',
    steps: [
      { name: 'Những ai liên quan', en: 'Stakeholders', tip: 'Người dân, doanh nghiệp, nhà nước, quốc gia khác...' },
      { name: 'Mỗi bên muốn gì', en: 'Interests', tip: 'Lợi ích và nỗi lo của từng bên.' },
      { name: 'Xung đột và đồng thuận', en: 'Tensions', tip: 'Chỗ các bên va nhau và chỗ có thể gặp nhau.' },
      { name: 'Hướng giải quyết', en: 'Options', tip: 'Các lựa chọn và ai được, ai mất.' },
    ],
  },
  perspectives: {
    id: 'perspectives', name: 'Nhiều góc nhìn', en: 'Multiple perspectives', why: 'Hợp với chủ đề văn hoá, học tập, công việc và bản thân, nơi thường không có một câu trả lời duy nhất.',
    steps: [
      { name: 'Hiểu cho đúng', en: 'Definition', tip: 'Chủ đề này thật ra nói về điều gì.' },
      { name: 'Các góc nhìn', en: 'Perspectives', tip: 'Hai đến ba cách nhìn khác nhau và lý do của mỗi bên.' },
      { name: 'Trải nghiệm của bạn', en: 'Personal view', tip: 'Ví dụ từ chính bạn hoặc người quen.' },
      { name: 'Quan điểm của bạn', en: 'Your position', tip: 'Bạn nghiêng về đâu, với điều kiện gì.' },
    ],
  },
};

export const PRESENT: Record<PresentId, PresentMode> = {
  prep: {
    id: 'prep', name: 'Quan điểm, lý do, ví dụ, chốt lại', en: 'PREP', why: 'Gọn cho câu trả lời ngắn khoảng một phút.',
    steps: [
      { name: 'Quan điểm', en: 'Point', tip: 'Nói ngay ý chính ở câu đầu ("Theo tôi...").' },
      { name: 'Lý do', en: 'Reason', tip: 'Một hoặc hai lý do ("Vì...").' },
      { name: 'Ví dụ', en: 'Example', tip: 'Một ví dụ, số liệu hay câu chuyện cụ thể.' },
      { name: 'Chốt lại', en: 'Point', tip: 'Nhắc lại ý chính ("Tóm lại...").' },
    ],
  },
  'prep-branches': {
    id: 'prep-branches', name: 'Ý chính trước, rồi hai ba nhánh', en: 'PREP with branches', why: 'Bài nói vài phút: vẫn mở bằng ý chính, phần lý do đi theo các nhánh đã phân tích.',
    steps: [
      { name: 'Ý chính', en: 'Point', tip: 'Câu trả lời ngắn cho câu hỏi gốc.' },
      { name: 'Hai ba nhánh', en: 'Branches as reasons', tip: 'Mỗi nhánh một lý do, kèm một ví dụ.' },
      { name: 'Chốt lại', en: 'Point', tip: 'Gom các nhánh về lại ý chính.' },
    ],
  },
  branches: {
    id: 'branches', name: 'Đi lần lượt theo các nhánh', en: 'Branch by branch (pyramid)', why: 'Bài dài: người nghe cần thấy toàn cảnh trước, rồi mới vào từng nhánh.',
    steps: [
      { name: 'Toàn cảnh', en: 'Overview', tip: 'Câu hỏi gốc, kết luận chung và danh sách các nhánh.' },
      { name: 'Từng nhánh', en: 'Branch by branch', tip: 'Mỗi nhánh: kết luận trước, chi tiết và ví dụ sau.' },
      { name: 'Nối các nhánh', en: 'Connections', tip: 'Các nhánh ảnh hưởng nhau thế nào.' },
      { name: 'Tổng kết', en: 'Synthesis', tip: 'Điều rút ra và câu hỏi còn mở.' },
    ],
  },
};

const CATEGORY_LENS: Record<string, LensId> = {
  'cong-nghe': 'mechanism-tradeoffs', devops: 'mechanism-tradeoffs', 'cong-viec': 'perspectives',
  'kinh-te': 'cause-effect', 'hien-tuong': 'cause-effect', 'khoa-hoc': 'cause-effect', 'moi-truong': 'cause-effect', 'tam-ly': 'cause-effect',
  'lich-su': 'context-timeline', 'xa-hoi': 'stakeholders', 'the-gioi': 'stakeholders',
  'van-hoa': 'perspectives', 'giao-duc': 'perspectives', 'ban-than': 'perspectives', sach: 'book',
};
/** Categories where a decision-style topic gets SWOT. Phenomena, science and history never do. */
const SWOT_CATS = new Set(['kinh-te', 'cong-viec', 'cong-nghe', 'devops', 'ban-than', 'giao-duc']);
/** A choice made by a person or an organisation (SWOT fits). */
const DECISION_VI = /(có nên mua|nên hay không|khởi nghiệp|chọn việc|du học|nhảy việc|làm việc cho|tự vận hành|lập kế hoạch|một quyết định|chi phí cơ hội|viết hộ|chiến lược|mô hình kinh doanh)/i;
const DECISION_EN = /\b(should you (?!worry)|yourself or|worth it|start a business|startups?\b|decisions?\b|strategy|strategies|when choosing)/i;
/** A public policy question ("should X be banned", "who should set Y"): several parties are affected. */
const POLICY_EN = /^(should (?!you\b)|who should)/i;

export function isDecisionTopic(i: Pick<GuideInput, 'title' | 'en'>): boolean {
  return DECISION_VI.test(i.title) || DECISION_EN.test(i.en || '');
}
export function isPolicyQuestion(i: Pick<GuideInput, 'en'>): boolean {
  return POLICY_EN.test((i.en || '').trim());
}

/**
 * One secondary lens next to the issue tree, chosen from the kind of topic:
 * debated findings get claim-evidence-counterargument, books get key ideas and application,
 * personal or business decisions get SWOT, public policy questions get a stakeholder map,
 * everything else follows its category (phenomena and science: cause and effect).
 */
export function chooseLens(i: GuideInput): LensId {
  if (i.disputed) return 'claim-evidence';
  if (i.book || i.cat === 'sach') return 'book';
  if ((!i.cat || SWOT_CATS.has(i.cat)) && isDecisionTopic(i)) return 'swot';
  if (isPolicyQuestion(i)) return 'stakeholders';
  return (i.cat && CATEGORY_LENS[i.cat]) || 'perspectives';
}

/** PREP for short answers, branch by branch for long talks; one day depends on the topic. */
export function choosePresent(i: GuideInput): PresentId {
  if (i.depth === 'minute') return 'prep';
  if (i.depth === 'day') return 'prep-branches';
  return 'branches';
}

export function guideFor(i: GuideInput): { mece: GuideStep[]; lens: Lens; present: PresentMode } {
  return { mece: MECE, lens: LENSES[chooseLens(i)], present: PRESENT[choosePresent(i)] };
}
