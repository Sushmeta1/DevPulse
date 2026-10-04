const axios = require('axios')
const pool  = require('../config/db')

const buildPrompt = (metrics, contributors, repoName) => `
You are a senior engineering manager analyzing GitHub repository metrics.
Analyze the following data for repository '${repoName}' and provide insights.

METRICS:
- Total Commits: ${metrics.totalCommits || 0}
- Open Pull Requests: ${metrics.openPRs || 0}
- Merged Pull Requests: ${metrics.mergedPRs || 0}
- Total Contributors: ${metrics.totalContributors || 0}
- Top Contributors: ${contributors.slice(0,3).map(c =>
    `${c.login} (${c.contributions} commits)`).join(', ')}

Respond ONLY with valid JSON in this exact format, no markdown, no backticks:
{
  "sprintOverview": "2-3 sentences summarizing overall sprint health",
  "productivityInsights": "2-3 sentences on team productivity patterns",
  "suggestedImprovements": "2-3 actionable recommendations"
}
`

const generateSummary = async (req, res) => {
  const { repo } = req.body
  const userId   = req.session.userId

  try {
    // Check cache first (1 hour TTL)
    const cached = await pool.query(
      `SELECT summary FROM ai_summaries
       WHERE user_id=$1 AND repo_name=$2
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId, repo]
    )
    if (cached.rows.length > 0) {
      return res.json(JSON.parse(cached.rows[0].summary))
    }

    // Get latest metrics from cache
    const [metricsRes, contribRes] = await Promise.all([
      pool.query(
        `SELECT data FROM metrics_cache
         WHERE user_id=$1 AND repo_name=$2 AND metric_type='stats'`,
        [userId, repo]
      ),
      pool.query(
        `SELECT data FROM metrics_cache
         WHERE user_id=$1 AND repo_name=$2 AND metric_type='contributors'`,
        [userId, repo]
      )
    ])

    const metrics      = metricsRes.rows[0]?.data || {}
    const contributors = contribRes.rows[0]?.data || []
    const prompt       = buildPrompt(metrics, contributors, repo)

    let summaryText

    // Try Gemini first, fallback to OpenAI
    if (process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'will_add_later') {
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      )
      summaryText =
        geminiRes.data.candidates[0].content.parts[0].text
    } else if (process.env.OPENAI_API_KEY &&
               process.env.OPENAI_API_KEY !== 'will_add_later') {
      const openaiRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model:    'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
      )
      summaryText = openaiRes.data.choices[0].message.content
    } else {
      // Fallback mock response for testing without API keys
      summaryText = JSON.stringify({
        sprintOverview:         "Your team has been actively contributing to the repository with consistent commit activity. The overall sprint health looks stable based on the current metrics.",
        productivityInsights:   "The contributor distribution shows good team collaboration. PR merge rates indicate a healthy review process is in place.",
        suggestedImprovements:  "Consider adding more detailed commit messages for better traceability. Regular code reviews and increasing test coverage would further improve code quality."
      })
    }

    const summary = JSON.parse(summaryText)

    // Cache the summary
    await pool.query(
      `INSERT INTO ai_summaries (user_id, repo_name, summary)
       VALUES ($1, $2, $3)`,
      [userId, repo, JSON.stringify(summary)]
    )

    res.json(summary)

  } catch (err) {
    console.error('❌ AI error:', err.message)
    res.status(500).json({ error: 'Failed to generate summary' })
  }
}

module.exports = { generateSummary }