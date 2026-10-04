export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.data = data; // the parsed error body, e.g. per-channel results from a failed test digest
  }
}

// Minutes east of UTC, so the server buckets days/hours the way the viewer experiences them.
const tzOffset = () => -new Date().getTimezoneOffset();

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the DevPulse server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  return data;
}

const enc = encodeURIComponent;
const repoPath = (repo) => repo.split('/').map(enc).join('/');

export const api = {
  config: (signal) => request('/config', { signal }),
  me: (signal) => request('/user', { signal }),
  demoLogin: () => request('/auth/demo', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  repositories: (refresh, signal) => request(`/repositories${refresh ? '?refresh=true' : ''}`, { signal }),
  deleteAccount: () => request('/account', { method: 'DELETE' }),
  summary: (repo, days, refresh, signal) =>
    request(`/analytics/summary?repo=${enc(repo)}&days=${days}&tzOffset=${tzOffset()}${refresh ? '&refresh=true' : ''}`, { signal }),
  pulls: (repo, days, signal) => request(`/repositories/${repoPath(repo)}/pulls?days=${days}`, { signal }),
  commits: (repo, days, signal) => request(`/repositories/${repoPath(repo)}/commits?days=${days}`, { signal }),
  reports: (repo, signal) => request(`/ai/reports?repo=${enc(repo)}`, { signal }),
  generateSummary: (repo, days) => request('/ai/sprint-summary', { method: 'POST', body: { repo, days, tzOffset: tzOffset() } }),
  team: (repos, days, refresh, signal) => {
    const list = repos?.length ? `&repos=${enc(repos.join(','))}` : '';
    return request(`/team/summary?days=${days}&tzOffset=${tzOffset()}${list}${refresh ? '&refresh=true' : ''}`, { signal });
  },
  digest: (signal) => request('/digest', { signal }),
  saveDigest: (body) => request('/digest', { method: 'PUT', body: { ...body, tzOffset: tzOffset() } }),
  deleteDigest: () => request('/digest', { method: 'DELETE' }),
  previewDigest: (repos, signal) => request('/digest/preview', { method: 'POST', body: { repos, tzOffset: tzOffset() }, signal }),
  sendTestDigest: () => request('/digest/send-test', { method: 'POST' }),
  loginUrl: '/api/auth/github',
};
