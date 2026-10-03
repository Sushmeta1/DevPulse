export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

const enc = encodeURIComponent;

export const api = {
  me: (signal) => request('/user', { signal }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  repositories: (signal) => request('/repositories', { signal }),
  summary: (repo, days, refresh, signal) =>
    request(`/analytics/summary?repo=${enc(repo)}&days=${days}${refresh ? '&refresh=true' : ''}`, { signal }),
  pulls: (repo, days, signal) => {
    const [owner, name] = repo.split('/');
    return request(`/repositories/${enc(owner)}/${enc(name)}/pulls?days=${days}`, { signal });
  },
  reports: (repo, signal) => request(`/ai/reports?repo=${enc(repo)}`, { signal }),
  generateSummary: (repo, days) => request('/ai/sprint-summary', { method: 'POST', body: { repo, days } }),
  loginUrl: '/api/auth/github',
};
