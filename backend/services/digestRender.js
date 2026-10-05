/**
 * Pure rendering of the weekly digest into e-mail (HTML + text) and Slack. No I/O, so every branch is unit-testable.
 * Everything that originates on GitHub (PR titles, logins, repo names) is untrusted text and is escaped for its target.
 */

const HOUR_LABEL = (h) => {
  if (h === null || h === undefined) return '-';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)}h`;
  const d = h / 24;
  return `${d < 10 ? Math.round(d * 10) / 10 : Math.round(d)}d`;
};

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Slack mrkdwn only needs these three escaped.
const escSlack = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Links come from GitHub, but a digest goes out by e-mail and chat, so only ever emit plain https links.
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s<>"']+$/.test(u) ? u : null);
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

/** "+12%", "-8%", "new", or "" when there is nothing honest to compare with. */
function change(current, previous) {
  if (previous === null || previous === undefined || current === null || current === undefined) return '';
  if (previous === 0) return current === 0 ? '' : 'new';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? '' : `${pct > 0 ? '+' : ''}${pct}%`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Collects everything the renderers need from a team result and an AI/rule-based report. */
function digestModel({ team, report, baseUrl }) {
  const a = team.aggregate;
  const t = a.totals;
  const rv = a.reviews;
  const link = (path) => `${baseUrl}${path}`;
  const repoLink = (full) => link(`/dashboard?repo=${encodeURIComponent(full)}&range=7`);
  return {
    repoCount: team.repos.length,
    skipped: team.skipped,
    stats: [
      { label: 'Commits', value: String(t.commits), change: change(t.commits, a.previous?.commits) },
      { label: 'PRs merged', value: String(t.mergedPullRequests), change: change(t.mergedPullRequests, a.previous?.mergedPullRequests) },
      { label: 'Median time to merge', value: HOUR_LABEL(t.medianMergeHours), change: change(t.medianMergeHours, a.previous?.medianMergeHours), lowerIsBetter: true },
      { label: 'Median time to first review', value: HOUR_LABEL(rv.firstReview.medianHours), change: change(rv.firstReview.medianHours, rv.previousMedianHours), lowerIsBetter: true },
    ],
    waitingCount: rv.waitingCount,
    waiting: rv.waiting.slice(0, 5).map((w) => ({ ...w, wait: HOUR_LABEL(w.hoursWaiting), url: safeUrl(w.htmlUrl) })),
    stale: t.stalePullRequests,
    contributors: a.topContributors.slice(0, 3).map((p) => ({ login: p.login, commits: p.commits, prs: p.pullRequests })),
    reviewers: rv.reviewers.slice(0, 3).map((r) => ({ login: r.login, reviews: r.reviews, share: r.share })),
    topReviewerShare: rv.topReviewerShare,
    repos: team.repos.slice(0, 5).map((r) => ({ name: r.fullName, commits: r.commits, merged: r.mergedPullRequests, waiting: r.waitingForReview, url: repoLink(r.fullName) })),
    summary: report?.content?.summary || '',
    suggestions: (report?.content?.suggestions || []).slice(0, 3),
    provider: report?.provider || null,
    incomplete: a.dataQuality?.incomplete ? a.dataQuality.incompleteRepos : [],
    teamUrl: link('/dashboard/team?range=7'),
    manageUrl: link('/dashboard/digest'),
  };
}

function subjectFor(m) {
  const merged = m.stats[1].value;
  const tail = m.waitingCount ? `, ${m.waitingCount} waiting for review` : '';
  return `DevPulse weekly: ${plural(Number(m.stats[0].value), 'commit')}, ${merged} merged${tail}`;
}

function renderText(m) {
  const lines = [subjectFor(m), '', `Last 7 days across ${plural(m.repoCount, 'repository', 'repositories')}`, ''];
  for (const s of m.stats) lines.push(`${s.label}: ${s.value}${s.change ? ` (${s.change})` : ''}`);
  if (m.waiting.length) {
    lines.push('', `Waiting for a first review (${m.waitingCount}):`);
    for (const w of m.waiting) lines.push(`- ${w.repo ? `${w.repo} ` : ''}#${w.number} ${clip(w.title, 80)} (${w.wait}) ${w.url}`);
  }
  if (m.stale) lines.push('', `${plural(m.stale, 'pull request')} open for more than 14 days.`);
  if (m.reviewers.length) lines.push('', `Top reviewers: ${m.reviewers.map((r) => `${r.login} (${r.reviews})`).join(', ')}`);
  if (m.contributors.length) lines.push(`Top contributors: ${m.contributors.map((c) => `${c.login} (${c.commits})`).join(', ')}`);
  if (m.summary) lines.push('', 'Summary', m.summary, ...m.suggestions.map((s) => `- ${s}`));
  if (m.incomplete.length) lines.push('', `Note: history is incomplete for ${m.incomplete.join(', ')} (GitHub pagination limit).`);
  lines.push('', `Open the team view: ${m.teamUrl}`, `Manage or stop this digest: ${m.manageUrl}`);
  return lines.join('\n');
}

function renderHtml(m) {
  const good = (s) => (s.change.startsWith('-') ? Boolean(s.lowerIsBetter) : s.change.startsWith('+') || s.change === 'new' ? !s.lowerIsBetter : null);
  const color = (s) => (good(s) === null ? '#6b7280' : good(s) ? '#0a6847' : '#b3121d');
  const stat = (s) => `
    <td style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;vertical-align:top">
      <div style="font-size:12px;color:#6b7280">${escHtml(s.label)}</div>
      <div style="font-size:22px;font-weight:600;margin-top:2px">${escHtml(s.value)}</div>
      ${s.change ? `<div style="font-size:12px;color:${color(s)}">${escHtml(s.change)} vs previous week</div>` : '<div style="font-size:12px">&nbsp;</div>'}
    </td>`;
  const li = (html) => `<li style="margin:0 0 6px">${html}</li>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>${escHtml(subjectFor(m))}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
    <div style="font-size:13px;color:#6b7280">DevPulse · last 7 days · ${escHtml(plural(m.repoCount, 'repository', 'repositories'))}</div>
    <h1 style="font-size:20px;margin:6px 0 18px">${escHtml(subjectFor(m).replace('DevPulse weekly: ', 'Your week: '))}</h1>
    <table role="presentation" width="100%" cellspacing="8" style="border-collapse:separate;margin:-8px"><tr>${stat(m.stats[0])}${stat(m.stats[1])}</tr><tr>${stat(m.stats[2])}${stat(m.stats[3])}</tr></table>
    ${m.waiting.length ? `<h2 style="font-size:15px;margin:22px 0 8px">Waiting for a first review (${m.waitingCount})</h2><ul style="padding-left:18px;margin:0;font-size:14px">${m.waiting.map((w) => li(`${w.repo ? `<span style="color:#6b7280">${escHtml(w.repo)}</span> ` : ''}${w.url ? `<a href="${escHtml(w.url)}" style="color:#0060d6">#${w.number} ${escHtml(clip(w.title, 80))}</a>` : `#${w.number} ${escHtml(clip(w.title, 80))}`} <span style="color:#6b7280">waiting ${escHtml(w.wait)}</span>`)).join('')}</ul>` : ''}
    ${m.stale ? `<p style="font-size:14px;margin:14px 0 0">${escHtml(plural(m.stale, 'pull request'))} open for more than 14 days.</p>` : ''}
    ${m.summary ? `<h2 style="font-size:15px;margin:22px 0 8px">Summary</h2><p style="font-size:14px;line-height:1.55;margin:0">${escHtml(m.summary)}</p>${m.suggestions.length ? `<ul style="padding-left:18px;margin:10px 0 0;font-size:14px">${m.suggestions.map((s) => li(escHtml(s))).join('')}</ul>` : ''}` : ''}
    ${m.repos.length ? `<h2 style="font-size:15px;margin:22px 0 8px">Most active repositories</h2><table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">${m.repos.map((r) => `<tr><td style="padding:6px 0;border-top:1px solid #f0f0f0"><a href="${escHtml(r.url)}" style="color:#111827">${escHtml(r.name)}</a></td><td align="right" style="padding:6px 0;border-top:1px solid #f0f0f0;color:#6b7280">${r.commits} commits · ${r.merged} merged${r.waiting ? ` · ${r.waiting} waiting` : ''}</td></tr>`).join('')}</table>` : ''}
    ${m.reviewers.length || m.contributors.length ? `<p style="font-size:13px;color:#6b7280;margin:18px 0 0">${m.reviewers.length ? `Top reviewers: ${m.reviewers.map((r) => `${escHtml(r.login)} (${r.reviews})`).join(', ')}. ` : ''}${m.contributors.length ? `Top contributors: ${m.contributors.map((c) => `${escHtml(c.login)} (${c.commits})`).join(', ')}.` : ''}</p>` : ''}
    ${m.incomplete.length ? `<p style="font-size:12px;color:#8a4600;margin:14px 0 0">History is incomplete for ${escHtml(m.incomplete.join(', '))} because of GitHub's pagination limit.</p>` : ''}
    <p style="margin:24px 0 0"><a href="${escHtml(m.teamUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:9px 14px;border-radius:8px;font-size:14px">Open the team view</a></p>
  </div>
  <p style="font-size:12px;color:#6b7280;text-align:center;margin:14px 0 0">You get this because you turned on the weekly digest. <a href="${escHtml(m.manageUrl)}" style="color:#6b7280">Change or stop it</a>.</p>
</div></body></html>`;
}

function renderSlack(m) {
  const stat = (s) => `*${escSlack(s.label)}*\n${escSlack(s.value)}${s.change ? `  _${escSlack(s.change)}_` : ''}`;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: clip(subjectFor(m).replace('DevPulse weekly: ', 'Your week: '), 140) } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Last 7 days across ${escSlack(plural(m.repoCount, 'repository', 'repositories'))}` }] },
    { type: 'section', fields: m.stats.map((s) => ({ type: 'mrkdwn', text: stat(s) })) },
  ];
  if (m.waiting.length) {
    const rows = m.waiting.map((w) => `• ${w.repo ? `${escSlack(w.repo)} ` : ''}${w.url ? `<${w.url}|#${w.number} ${escSlack(clip(w.title, 70))}>` : `#${w.number} ${escSlack(clip(w.title, 70))}`} - waiting ${escSlack(w.wait)}`).join('\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Waiting for a first review (${m.waitingCount})*\n${rows}` } });
  }
  if (m.stale) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `${escSlack(plural(m.stale, 'pull request'))} open for more than 14 days` }] });
  if (m.summary) {
    const tips = m.suggestions.map((s) => `• ${escSlack(s)}`).join('\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: clip(`*Summary*\n${escSlack(m.summary)}${tips ? `\n${tips}` : ''}`, 2900) } });
  }
  blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open the team view' }, url: m.teamUrl }] });
  return { text: subjectFor(m), blocks };
}

function renderDigest(input) {
  const m = digestModel(input);
  return { subject: subjectFor(m), text: renderText(m), html: renderHtml(m), slack: renderSlack(m), model: m };
}

module.exports = { safeUrl, renderDigest, digestModel, subjectFor, change, escHtml, escSlack, HOUR_LABEL };
