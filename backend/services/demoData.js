const { HttpError } = require('../utils/httpError');

/**
 * Deterministic, realistic GitHub activity for the public demo. It implements the same interface as
 * githubService, so the demo exercises the real sync -> PostgreSQL -> analytics path. Dates are always
 * relative to "now", so the demo never looks stale; each calendar day's data is stable between calls.
 */
const DAY = 86400000;
const COMMIT_CAP = 1000; // mirrors githubService (10 pages x 100)

const PEOPLE = [
  { login: 'maya-chen', name: 'Maya Chen', weight: 5, lead: 0.8 },
  { login: 'tomas-ruiz', name: 'Tomás Ruiz', weight: 4, lead: 1 },
  { login: 'awisniewska-kowalczyk', name: 'Aleksandra Wiśniewska-Kowalczyk', weight: 3, lead: 1.2 },
  { login: 'jo', name: 'Jo', weight: 2, lead: 0.9 },
  { login: 'priya-raman', name: 'Priya Raman', weight: 3, lead: 1.4, nightOwl: true },
  { login: 'kenji-w', name: 'Kenji 🦊 Watanabe', weight: 2, lead: 1.1 },
  { login: null, name: 'Sam Okafor', weight: 1, lead: 1 }, // commits whose e-mail isn't linked to a GitHub account
];

const REPOS = [
  { name: 'web', description: 'Customer-facing Next.js application', language: 'TypeScript', stars: 1284, forks: 143, issues: 37, people: [0, 1, 2, 3, 4, 5], perDay: 4.2, trend: 0.5, prRate: 0.9, leadHours: 14 },
  { name: 'api', description: 'GraphQL gateway and billing services', language: 'Go', stars: 412, forks: 38, issues: 12, people: [1, 4, 6, 0], perDay: 2.6, trend: -0.2, prRate: 0.6, leadHours: 30 },
  { name: 'mobile', description: 'iOS and Android apps (React Native)', language: 'TypeScript', stars: 96, forks: 9, issues: 21, people: [3, 5, 2], perDay: 1.3, trend: 0.1, prRate: 0.4, leadHours: 52 },
  { name: 'design-system', description: 'Tokens, primitives and docs', language: 'CSS', stars: 2210, forks: 301, issues: 4, people: [2], perDay: 0.35, trend: 0, prRate: 0.2, leadHours: 5 },
  { name: 'platform-infrastructure-consolidation-initiative-2025-q3', description: 'Terraform modules for the multi-region migration — spans every team and every environment we operate', language: 'HCL', stars: 3, forks: 0, issues: 148, people: [4, 6], perDay: 0.7, trend: 0.3, prRate: 0.5, leadHours: 140 },
  { name: 'monorepo', description: 'Everything else. Very busy; GitHub pagination caps apply.', language: 'TypeScript', stars: 58, forks: 4, issues: 260, people: [0, 1, 2, 3, 4, 5, 6], perDay: 11, trend: 0.2, prRate: 2.2, leadHours: 20 },
  { name: 'legacy-monolith', description: 'Maintenance mode', language: 'Ruby', stars: 12, forks: 2, issues: 9, people: [6, 4], perDay: 0.12, trend: -0.9, prRate: 0.05, leadHours: 200, quietAfterDays: 40 },
  { name: 'hello-world', description: null, language: null, stars: 0, forks: 0, issues: 0, people: [3], perDay: 0, trend: 0, prRate: 0, leadHours: 1, single: true },
  { name: 'empty', description: 'Brand new repository', language: null, stars: 0, forks: 0, issues: 0, people: [], perDay: 0, trend: 0, prRate: 0, leadHours: 1, empty: true },
];
const OWNER = 'acme';

// --- deterministic randomness ---------------------------------------------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function weighted(r, items) {
  const total = items.reduce((n, i) => n + i.weight, 0);
  let x = r() * total;
  for (const i of items) { x -= i.weight; if (x <= 0) return i; }
  return items.at(-1);
}
const poisson = (r, mean) => {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do { k += 1; p *= r(); } while (p > limit && k < 60);
  return k - 1;
};

const TYPES = ['feat', 'fix', 'fix', 'chore', 'refactor', 'docs', 'perf', 'test'];
const SCOPES = ['auth', 'billing', 'checkout', 'search', 'onboarding', 'ui', 'deps', 'ci', 'analytics', 'settings'];
const SUBJECTS = [
  'handle expired sessions gracefully', 'add retry with exponential backoff', 'tighten input validation',
  'extract shared hook', 'speed up initial render', 'update dependencies', 'fix flaky test', 'add empty state',
  'support keyboard navigation', 'remove dead code', 'improve error messages', 'cache expensive query',
];
const hex = (r, n) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('');

// Work happens mostly 08:00-19:00 UTC; night owls and weekend work add a realistic tail.
function hourFor(r, person) {
  if (person?.nightOwl && r() < 0.45) return Math.floor(r() * 5) + 21 + (r() < 0.5 ? 0 : -21); // 21-01 / 0-4
  const base = 8 + Math.floor((r() + r()) * 5.5); // triangular-ish around 13:00
  return Math.min(23, base);
}

function generate(spec, nowMs) {
  const commits = [];
  const pulls = [];
  if (spec.empty) return { commits, pulls, total: 0 };
  const todayIdx = Math.floor(nowMs / DAY);
  const people = spec.people.map((i) => PEOPLE[i]);

  if (spec.single) {
    const r = rng(hash(spec.name));
    commits.push({
      sha: hex(r, 40), message: 'Initial commit', author_login: people[0].login, author_name: people[0].name,
      committed_at: new Date(nowMs - 3 * DAY).toISOString(), html_url: `https://github.com/${OWNER}/${spec.name}/commit/init`,
    });
    return { commits, pulls, total: 1 };
  }

  const horizon = 185;
  for (let back = horizon; back >= 0; back--) {
    const idx = todayIdx - back;
    if (spec.quietAfterDays && back < spec.quietAfterDays) continue;
    const r = rng(hash(`${spec.name}:${idx}`));
    const weekday = new Date(idx * DAY).getUTCDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.18 : 1;
    const trend = 1 + spec.trend * ((horizon - back) / horizon - 0.5);
    const noise = 0.55 + r() * 0.9;
    const n = poisson(r, spec.perDay * weekendFactor * trend * noise);

    for (let k = 0; k < n; k++) {
      const author = weighted(r, people);
      const at = idx * DAY + hourFor(r, author) * 3600000 + Math.floor(r() * 3600000);
      if (at > nowMs) continue;
      commits.push({
        sha: hex(r, 40),
        message: `${pick(r, TYPES)}(${pick(r, SCOPES)}): ${pick(r, SUBJECTS)}`,
        author_login: author.login,
        author_name: author.name,
        committed_at: new Date(at).toISOString(),
        html_url: `https://github.com/${OWNER}/${spec.name}/commit/${hex(r, 7)}`,
      });
    }

    const prCount = poisson(r, spec.prRate * weekendFactor * 0.8);
    for (let k = 0; k < prCount; k++) {
      const author = weighted(r, people.filter((p) => p.login));
      const created = idx * DAY + (8 + Math.floor(r() * 10)) * 3600000 + Math.floor(r() * 3600000);
      if (created > nowMs) continue;
      const lead = spec.leadHours * author.lead * Math.exp((r() + r() + r() - 1.5) * 1.6) * 3600000;
      const fate = r();
      const stale = back > 18 && fate < 0.05;
      const mergedAt = created + lead;
      let state = 'merged';
      if (stale || mergedAt > nowMs) state = 'open';
      else if (fate > 0.88) state = 'closed';
      const number = 1000 + idx * 32 + k;
      pulls.push({
        number,
        title: `${pick(r, TYPES)}: ${pick(r, SUBJECTS)}`,
        state,
        author_login: author.login,
        created_at: new Date(created).toISOString(),
        updated_at: new Date(state === 'open' ? created : Math.min(nowMs, mergedAt)).toISOString(),
        closed_at: state === 'open' ? null : new Date(mergedAt).toISOString(),
        merged_at: state === 'merged' ? new Date(mergedAt).toISOString() : null,
        html_url: `https://github.com/${OWNER}/${spec.name}/pull/${number}`,
      });
    }
  }
  commits.sort((a, b) => (a.committed_at < b.committed_at ? 1 : -1));
  return { commits, pulls, total: commits.length };
}

const find = (name) => REPOS.find((s) => s.name === name);
const meta = (spec) => ({
  github_id: 900000 + hash(spec.name) % 90000,
  owner: OWNER,
  name: spec.name,
  full_name: `${OWNER}/${spec.name}`,
  description: spec.description,
  language: spec.language,
  stars: spec.stars,
  forks: spec.forks,
  open_issues: spec.issues,
  is_private: spec.name === 'api' || spec.name === 'mobile',
  html_url: `https://github.com/${OWNER}/${spec.name}`,
  pushed_at: null,
});

// --- same surface as githubService ----------------------------------------
const demoGithub = {
  async listRepositories() {
    const now = Date.now();
    return REPOS.map((s) => {
      const { commits } = generate(s, now);
      return { ...meta(s), pushed_at: commits[0]?.committed_at || new Date(now - 90 * DAY).toISOString() };
    });
  },
  async getRepository(token, owner, name) {
    const spec = owner === OWNER && find(name);
    if (!spec) throw new HttpError(404, 'Repository not found or not accessible');
    const { commits } = generate(spec, Date.now());
    return { ...meta(spec), pushed_at: commits[0]?.committed_at || null };
  },
  async listCommits(token, owner, name, since) {
    const spec = owner === OWNER && find(name);
    if (!spec) throw new HttpError(404, 'Repository not found or not accessible');
    if (spec.empty) throw new HttpError(409, 'Repository is empty');
    const { commits } = generate(spec, Date.now());
    const inRange = commits.filter((c) => c.committed_at >= since);
    return { commits: inRange.slice(0, COMMIT_CAP), truncated: inRange.length > COMMIT_CAP };
  },
  async listPullRequests(token, owner, name, since) {
    const spec = owner === OWNER && find(name);
    if (!spec) throw new HttpError(404, 'Repository not found or not accessible');
    const { pulls } = generate(spec, Date.now());
    return { pulls: pulls.filter((p) => p.updated_at >= since || p.state === 'open'), truncated: false };
  },
};

module.exports = { demoGithub, DEMO_OWNER: OWNER };
