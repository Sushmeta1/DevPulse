// Deterministic sample data for the live chart previews on the landing page. Clearly labelled as samples in the UI.
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86400000;

function buildDaily(days = 91) {
  const r = rng(7);
  const today = Math.floor(Date.now() / DAY);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date((today - (days - 1) + i) * DAY);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const base = weekend ? 0.5 : 4.2;
    const commits = Math.max(0, Math.round(base * (0.1 + r() * 1.7) - (weekend ? 0.45 : 0.6) + (i / days) * 1.8));
    return { date: date.toISOString().slice(0, 10), commits };
  });
}

function buildPunchcard() {
  const r = rng(21);
  return Array.from({ length: 7 }, (_, wd) => Array.from({ length: 24 }, (_, h) => {
    const work = wd !== 0 && wd !== 6;
    const peak = Math.exp(-((h - 14) ** 2) / 22) + 0.55 * Math.exp(-((h - 10) ** 2) / 8);
    const base = work ? 11 * peak : 1.6 * peak;
    return Math.max(0, Math.round(base * (0.5 + r()) - (h < 7 || h > 20 ? 1 : 0)));
  }));
}

export const SAMPLE_DAILY = buildDaily();
export const SAMPLE_VALUES = SAMPLE_DAILY.map((d) => d.commits);
export const SAMPLE_PUNCHCARD = buildPunchcard();
export const SAMPLE_SPARK = [4, 6, 5, 9, 7, 12, 10, 14, 11, 16, 13, 19, 15, 21, 18, 24];

export const SAMPLE_SUMMARY = {
  range: { days: 30 },
  totals: {
    commits: 412, contributors: 6, medianMergeHours: 11, p90MergeHours: 31,
    stalePullRequests: 2, openPullRequests: 5, oldestOpenDays: 19,
  },
  previous: { commits: 348 },
  topContributors: [{ login: 'maya-chen', commits: 118 }],
  punchcard: SAMPLE_PUNCHCARD,
};

export const AI_SAMPLE = {
  summary: 'acme/web had a strong sprint: 412 commits and 38 pull requests from 6 contributors, with 34 merged. Review turnaround improved noticeably, and activity stayed steady through the second half.',
  insights: [
    'Median time to merge fell to 11h, down 34% from the previous period.',
    'Work is evenly shared: the top author wrote 29% of commits across 6 people.',
    'Activity peaks on Tuesday afternoons; only 14% of commits happen outside working hours.',
  ],
  suggestions: [
    'Two pull requests have been open for more than two weeks. Close or unblock them.',
    'Keep pull requests small: the slowest 10% still took over a day to land.',
  ],
};

export const shot = (name, theme) => `/landing/${name}-${theme}.webp`;
