// Luyen Than: a daily ~20-minute home circuit. One exercise per body zone, drawn at random.
export type Zone = 'upper' | 'legs' | 'core' | 'back';
export interface Exercise { id: string; zone: Zone; name: string; level: 1 | 2 | 3; reps: string; cue: string; }

export const ZONE_LABEL: Record<Zone, string> = { upper: 'Tay & ngực', legs: 'Chân', core: 'Bụng', back: 'Lưng' };
export const ZONE_EMOJI: Record<Zone, string> = { upper: '💪', legs: '🦵', core: '🔥', back: '🧘' };
export const ZONES: Zone[] = ['upper', 'legs', 'core', 'back'];

const E = (zone: Zone, level: 1 | 2 | 3, name: string, reps: string, cue: string): Exercise =>
  ({ id: `${zone}-${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-')}`, zone, level, name, reps, cue });

export const EXERCISES: Exercise[] = [
  E('upper', 1, 'Chống đẩy vào tường', '15 lần', 'Thân thẳng như tấm ván, hạ ngực chạm gần tường'),
  E('upper', 1, 'Chống đẩy gối', '10-12 lần', 'Gối chạm sàn, hông không võng'),
  E('upper', 2, 'Chống đẩy tiêu chuẩn', '8-12 lần', 'Khuỷu tay khép khoảng 45 độ so với thân'),
  E('upper', 2, 'Chống đẩy tay hẹp', '6-10 lần', 'Hai tay gần nhau, khuỷu ép sát sườn'),
  E('upper', 2, 'Dip trên ghế', '10-12 lần', 'Lưng sát mép ghế, hạ tới khi khuỷu vuông góc'),
  E('upper', 3, 'Chống đẩy chân cao', '6-10 lần', 'Đặt chân lên ghế, siết bụng'),
  E('upper', 3, 'Pike push-up', '6-8 lần', 'Hông cao hình chữ V, hạ đầu về phía sàn'),
  E('legs', 1, 'Squat cơ bản', '15 lần', 'Đẩy hông ra sau, gối cùng hướng mũi chân'),
  E('legs', 1, 'Nâng hông (glute bridge)', '15 lần', 'Siết mông ở đỉnh, giữ 1 giây'),
  E('legs', 2, 'Lunge lùi', '10 lần mỗi chân', 'Thân thẳng, gối sau gần chạm sàn'),
  E('legs', 2, 'Squat giữ 2 giây', '12 lần', 'Dừng ở điểm thấp nhất 2 giây'),
  E('legs', 2, 'Bước lên ghế', '10 lần mỗi chân', 'Đẩy bằng gót chân trên ghế'),
  E('legs', 3, 'Squat nhảy', '10 lần', 'Tiếp đất nhẹ, gối mềm'),
  E('legs', 3, 'Bulgarian split squat', '8 lần mỗi chân', 'Chân sau gác lên ghế, hạ thẳng xuống'),
  E('core', 1, 'Plank cẳng tay', '30 giây', 'Đầu, hông, gót một đường thẳng'),
  E('core', 1, 'Dead bug', '10 lần mỗi bên', 'Lưng dưới ép sát sàn'),
  E('core', 2, 'Plank nghiêng', '20-30 giây mỗi bên', 'Hông nhấc cao, không đổ người'),
  E('core', 2, 'Gập bụng đạp xe', '20 lần', 'Chậm, xoay vai chứ không kéo cổ'),
  E('core', 2, 'Leo núi (mountain climber)', '30 giây', 'Vai trên cổ tay, hông thấp'),
  E('core', 3, 'Hollow hold', '20-30 giây', 'Lưng dưới chạm sàn, tay chân duỗi xa'),
  E('core', 3, 'Plank chạm vai', '20 lần', 'Hông không lắc khi nhấc tay'),
  E('back', 1, 'Superman', '12 lần', 'Nâng tay chân nhẹ, giữ 1 giây, nhìn xuống sàn'),
  E('back', 1, 'Bird dog', '10 lần mỗi bên', 'Duỗi tay và chân đối diện, hông vuông'),
  E('back', 2, 'Y-T-W nằm sấp', '8 vòng', 'Siết bả vai, ngón cái hướng lên'),
  E('back', 2, 'Kéo khăn trên sàn', '12 lần', 'Nằm sấp, kéo hai đầu khăn về ngực, ép bả vai'),
  E('back', 2, 'Gập hông chào (good morning)', '15 lần', 'Lưng thẳng, gập ở hông, gối hơi chùng'),
  E('back', 3, 'Superman giữ lâu', '30 giây', 'Giữ nâng ở đỉnh, thở đều'),
  E('back', 3, 'Kéo xà ngược dưới bàn', '6-10 lần', 'Chỉ dùng bàn chắc chắn, thân thẳng'),
];

export interface Round { level: 1 | 2 | 3; moves: Exercise[]; workSec: number; restSec: number; totalMin: number; }

/** Draw one exercise per zone, at or below the chosen level, avoiding the previous round's picks when possible. */
export function drawRound(level: 1 | 2 | 3, rng: () => number = Math.random, avoid: string[] = []): Round {
  const moves = ZONES.map((z) => {
    const pool = EXERCISES.filter((e) => e.zone === z && e.level <= level);
    const fresh = pool.filter((e) => !avoid.includes(e.id));
    const p = fresh.length ? fresh : pool;
    const top = p.filter((e) => e.level === level);
    const src = top.length && rng() < 0.7 ? top : p;
    return src[Math.floor(rng() * src.length) % src.length];
  });
  return { level, moves, workSec: 40, restSec: 20, totalMin: 20 };
}

export interface BodySession { id: string; date: string; rounds: number; minutes: number; moves: string[]; level: number; kind?: DayKind; }

export function streak(sessions: BodySession[], today: string): number {
  const days = new Set(sessions.map((s) => s.date));
  let n = 0;
  const d = new Date(today + 'T00:00:00Z');
  if (!days.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

// ---------- weekly schedule ----------
// Default for a beginner aiming at general fitness: strength on three non-consecutive days,
// moderate cardio on two days, light mobility on one day and one full rest day.
export type DayKind = 'strengthA' | 'strengthB' | 'cardio' | 'mobility' | 'rest';
export const DAY_KIND_LABEL: Record<DayKind, string> = {
  strengthA: 'Sức mạnh A (chân, đẩy, bụng)', strengthB: 'Sức mạnh B (chân, lưng, bụng)', cardio: 'Cardio vừa sức', mobility: 'Giãn cơ, vận động nhẹ', rest: 'Nghỉ',
};
export const DAY_KIND_EMOJI: Record<DayKind, string> = { strengthA: '💪', strengthB: '🏋️', cardio: '🚶', mobility: '🧘', rest: '😴' };
/** Zones trained in each strength session; every zone is covered across A and B. */
export const SESSION_ZONES: Record<'strengthA' | 'strengthB', Zone[]> = { strengthA: ['legs', 'upper', 'core', 'legs'], strengthB: ['legs', 'back', 'core', 'back'] };
/** Index 0 = Monday ... 6 = Sunday. */
export const DEFAULT_WEEK: DayKind[] = ['strengthA', 'cardio', 'strengthB', 'mobility', 'strengthA', 'cardio', 'rest'];
export const WEEKDAY_LABEL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export interface LevelParams { workSec: number; restSec: number; minutes: number; }
export const LEVEL_PARAMS: Record<1 | 2 | 3, LevelParams> = { 1: { workSec: 30, restSec: 30, minutes: 15 }, 2: { workSec: 40, restSec: 20, minutes: 20 }, 3: { workSec: 45, restSec: 15, minutes: 20 } };
export const CARDIO_MIN: Record<1 | 2 | 3, number> = { 1: 30, 2: 40, 3: 45 };

export const isStrength = (k: DayKind): k is 'strengthA' | 'strengthB' => k === 'strengthA' || k === 'strengthB';
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** Gentle checks; returns Vietnamese warnings, an empty list means the week looks balanced. */
export function checkWeek(week: DayKind[]): string[] {
  const w: string[] = [];
  const strength = week.map(isStrength);
  if (strength.filter(Boolean).length < 2) w.push('Ít hơn 2 buổi sức mạnh mỗi tuần (khuyến nghị chung là từ 2 ngày).');
  for (let i = 0; i < 7; i++) if (strength[i] && strength[(i + 1) % 7]) { w.push(`${WEEKDAY_LABEL[i]} và ${WEEKDAY_LABEL[(i + 1) % 7]} đều là buổi sức mạnh liền nhau; nên xen ngày nghỉ hoặc cardio nhẹ.`); break; }
  if (!week.some((k) => k === 'rest' || k === 'mobility')) w.push('Không có ngày nghỉ hay giãn cơ nào trong tuần.');
  return w;
}

/** Aerobic minutes the week plans for (cardio days only). */
export function plannedCardioMinutes(week: DayKind[], level: 1 | 2 | 3): number {
  return week.filter((k) => k === 'cardio').length * CARDIO_MIN[level];
}

function hash(s: string): number { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }

/** Deterministic session for a strength day: the same date gives the same moves until the user swaps one. */
export function sessionMoves(kind: 'strengthA' | 'strengthB', level: 1 | 2 | 3, dateKey: string): Exercise[] {
  const used = new Set<string>();
  return SESSION_ZONES[kind].map((z, i) => {
    const pool = EXERCISES.filter((e) => e.zone === z && e.level <= level && !used.has(e.id));
    const top = pool.filter((e) => e.level === level);
    const src = top.length ? [...top, ...pool.filter((e) => e.level === level - 1)] : pool;
    const pick = src[hash(`${dateKey}|${kind}|${i}`) % src.length];
    used.add(pick.id);
    return pick;
  });
}

/** Swap one move for another of the same zone and the same level (or lower if none). */
export function swapOptions(current: Exercise, level: 1 | 2 | 3, exclude: string[] = []): Exercise[] {
  const same = EXERCISES.filter((e) => e.zone === current.zone && e.level === current.level && e.id !== current.id && !exclude.includes(e.id));
  if (same.length) return same;
  return EXERCISES.filter((e) => e.zone === current.zone && e.level <= level && e.id !== current.id && !exclude.includes(e.id));
}

export const MOBILITY = ['Xoay cổ, vai, hông mỗi chiều 10 lần', 'Gập người chạm mũi chân, giữ 30 giây', 'Tư thế em bé (child pose) 45 giây', 'Mèo - bò (cat-cow) 10 lần', 'Kéo giãn đùi trước mỗi bên 30 giây', 'Hít thở chậm 2 phút'];
