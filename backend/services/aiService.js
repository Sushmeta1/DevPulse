const { HttpError } = require('../utils/httpError');

function buildPrompt(repoName, summary) {
  const t = summary.totals;
  const metrics = {
    repository: repoName,
    periodDays: summary.range.days,
    commits: t.commits,
    pullRequests: t.pullRequests,
    openPullRequests: t.openPullRequests,
    mergedPullRequests: t.mergedPullRequests,
    closedPullRequests: t.closedPullRequests,
    contributors: t.contributors,
    avgHoursToMerge: t.avgMergeHours,
    busiestDay: t.busiestDay,
    topContributors: summary.topContributors.slice(0, 5),
    commitsPerDay: summary.commitsByDay.map((d) => d.commits),
  };
  return `You are an engineering-productivity analyst. Based on these GitHub activity metrics, write a sprint report.
Respond ONLY with JSON of the form:
{"summary": "<2-4 sentence sprint summary>", "insights": ["<productivity insight>", ...3-5 items], "suggestions": ["<actionable suggestion>", ...3-5 items]}
Be specific, reference the numbers, and do not invent data that is not provided.

Metrics:
${JSON.stringify(metrics)}`;
}

function parseReport(text) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new HttpError(502, 'AI provider returned an unreadable response');
  }
  const list = (v) => (Array.isArray(v) ? v.map(String).slice(0, 8) : []);
  return { summary: String(data.summary || ''), insights: list(data.insights), suggestions: list(data.suggestions) };
}

// Rule-based report, used when no AI key is configured so the feature still works offline.
function localReport(repoName, summary) {
  const t = summary.totals;
  const days = summary.range.days;
  const lead = summary.topContributors[0];
  const insights = [];
  const suggestions = [];

  insights.push(`${t.commits} commits and ${t.pullRequests} pull requests from ${t.contributors} contributor(s) in ${days} days.`);
  if (t.busiestDay) insights.push(`Most active day was ${t.busiestDay.date} with ${t.busiestDay.commits} commits.`);
  if (lead) insights.push(`${lead.login} led activity with ${lead.commits} commits and ${lead.pullRequests} PRs.`);
  if (t.avgMergeHours !== null) insights.push(`Merged PRs took ${t.avgMergeHours}h on average to land.`);

  if (t.openPullRequests > 3) suggestions.push(`Review the ${t.openPullRequests} open pull requests to keep work from piling up.`);
  if (t.avgMergeHours !== null && t.avgMergeHours > 48) suggestions.push('Review turnaround is above 48h; consider smaller PRs or review rotations.');
  if (t.contributors === 1 && t.commits > 0) suggestions.push('Only one person is contributing; pairing or code reviews would spread knowledge.');
  if (t.commits === 0) suggestions.push('No commits in this period; check whether work is blocked or tracked elsewhere.');
  if (!suggestions.length) suggestions.push('Activity looks healthy; keep PRs small and reviews prompt.');

  return {
    summary: `${repoName} saw ${t.commits} commits and ${t.pullRequests} pull requests (${t.mergedPullRequests} merged, ${t.openPullRequests} open) over the last ${days} days.`,
    insights,
    suggestions,
  };
}

async function callGemini(ai, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ai.geminiModel}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.geminiApiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    },
  );
  if (!res.ok) throw new HttpError(502, `Gemini API error (${res.status})`);
  const body = await res.json();
  return { text: body.candidates?.[0]?.content?.parts?.[0]?.text || '', model: ai.geminiModel };
}

async function callOpenAI(ai, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.openaiApiKey}` },
    body: JSON.stringify({
      model: ai.openaiModel,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new HttpError(502, `OpenAI API error (${res.status})`);
  const body = await res.json();
  return { text: body.choices?.[0]?.message?.content || '', model: ai.openaiModel };
}

async function generateReport(ai, repoName, summary) {
  const usable =
    (ai.provider === 'gemini' && ai.geminiApiKey) || (ai.provider === 'openai' && ai.openaiApiKey);
  if (!usable) {
    return { provider: 'local', model: null, content: localReport(repoName, summary) };
  }
  const prompt = buildPrompt(repoName, summary);
  const { text, model } = ai.provider === 'gemini' ? await callGemini(ai, prompt) : await callOpenAI(ai, prompt);
  return { provider: ai.provider, model, content: parseReport(text) };
}

module.exports = { generateReport, buildPrompt, parseReport, localReport };
