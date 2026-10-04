// All formatting goes through Intl so locale, plurals and time zones come out right.
const LOCALE = undefined; // the viewer's own locale

const number = new Intl.NumberFormat(LOCALE);
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const plurals = new Intl.PluralRules(LOCALE);

export const formatNumber = (n) => number.format(n);
export const formatCompact = (n) => compact.format(n);

/** "1 commit", "0 commits", "1,284 commits" */
export const plural = (n, one, many = `${one}s`) => `${number.format(n)} ${plurals.select(n) === 'one' ? one : many}`;

/** Lead times: 25m, 7.5h, 3.2d. null => an em dash so empty values never read as zero. */
export function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '-';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)}h`;
  const days = hours / 24;
  return `${days < 10 ? Math.round(days * 10) / 10 : Math.round(days)}d`;
}

// Day keys are "YYYY-MM-DD" already in the viewer's time zone, so format them as UTC to avoid a second shift.
const shortDay = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const formatDay = (key) => shortDay.format(new Date(`${key}T00:00:00Z`));
export const formatDayLong = (key) => longDay.format(new Date(`${key}T00:00:00Z`));

const absolute = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' });
const absoluteYear = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });

/** "just now", "5 minutes ago", "yesterday", then an absolute date once it is more than a week old. */
export function timeAgo(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '-';
  const diff = (then - now) / 1000; // negative = past
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  const d = new Date(then);
  return (d.getFullYear() === new Date(now).getFullYear() ? absolute : absoluteYear).format(d);
}

const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(LOCALE, { granularity: 'grapheme' }) : null;
const splitGraphemes = (s) => (graphemes ? [...graphemes.segment(s)].map((x) => x.segment) : Array.from(s));
const EMOJI = /\p{Extended_Pictographic}/u;

/** Avatar initials that survive one-letter names, CJK, emoji, particles and stray whitespace. */
export function initials(name) {
  const words = String(name ?? '')
    .split(/[\s._-]+/)
    .map((w) => splitGraphemes(w).filter((g) => !EMOJI.test(g) && g !== '‍').join(''))
    .filter(Boolean);
  if (!words.length) return '?';
  const first = splitGraphemes(words[0]);
  if (words.length === 1) return first.slice(0, 2).join('').toUpperCase();
  return (first[0] + splitGraphemes(words.at(-1))[0]).toUpperCase();
}

/** Stable hue per person so the same avatar fallback is the same colour everywhere. */
export function hueFor(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

/**
 * Change versus the previous period.
 * kind: 'none' (no comparison), 'new' (previous was zero), 'flat', 'up', 'down'
 */
export function compare(current, previous) {
  if (previous === null || previous === undefined || current === null || current === undefined) return { kind: 'none', pct: null };
  if (previous === 0) return current === 0 ? { kind: 'flat', pct: 0 } : { kind: 'new', pct: null };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { kind: 'flat', pct: 0 };
  return { kind: pct > 0 ? 'up' : 'down', pct };
}

export const formatPercent = (n) => `${percent.format(Math.abs(n))}%`;
