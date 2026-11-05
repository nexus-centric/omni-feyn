// Text helpers shared by metrics. Pure functions, no DOM.

/** Lowercase, strip Vietnamese diacritics (including d-stroke), collapse spaces. */
export function normalizeVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercase NFC tokens that keep diacritics (needed to tell "à" from "a"). */
export function tokenizeKeepTones(input: string): string[] {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function tokenizeNormalized(input: string): string[] {
  const n = normalizeVi(input);
  return n ? n.split(' ') : [];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Common Vietnamese and English function words ignored by coverage matching (normalized form). */
export const STOPWORDS = new Set(
  (
    'la va cua co cac nhung mot cho voi trong khi thi ma nay do de duoc bi ra vao len xuong tu den ' +
    'nhu theo ve rat cung da dang se van con hay hoac neu vi nen thuc su chi moi nhieu it khong ' +
    'toi ban ho chung minh no ai gi nao the nhe a o u ah oi day kia ' +
    'the a an and or of to in on for is are was be it this that with as by at from'
  ).split(' '),
);

export function contentTokens(input: string): string[] {
  return tokenizeNormalized(input).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function countSyllables(input: string): number {
  return tokenizeKeepTones(input).length;
}
