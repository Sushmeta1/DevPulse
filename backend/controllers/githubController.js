// backend/controllers/githubController.js
const axios = require('axios')
const pool  = require('../config/db')

// Helper: GitHub API client for logged-in user
const getGitHubClient = async (userId) => {
  const result = await pool.query(
    'SELECT access_token FROM users WHERE id=$1', [userId]
  )
  const token = result.rows[0]?.access_token
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
}

// Helper: get cached data
const getCache = async (userId, repo, type) => {
  const res = await pool.query(
    `SELECT data FROM metrics_cache
     WHERE user_id=$1 AND repo_name=$2
     AND metric_type=$3
     AND cached_at > NOW() - INTERVAL '30 minutes'`,
    [userId, repo, type]
  )
  return res.rows[0]?.data || null
}

// Helper: save to cache
const setCache = async (userId, repo, type, data) => {
  await pool.query(
    `INSERT INTO metrics_cache (user_id, repo_name, metric_type, data)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, repo_name, metric_type)
     DO UPDATE SET data=$4, cached_at=NOW()`,
    [userId, repo, type, JSON.stringify(data)]
  )
}

// GET /api/github/repos
const getRepos = async (req, res) => {
  try {
    const gh = await getGitHubClient(req.session.userId)
    const repos = await gh.get('/user/repos?sort=updated&per_page=50')
    res.json(repos.data.map(r => ({
      id:        r.id,
      full_name: r.full_name,
      private:   r.private,
      language:  r.language,
      stars:     r.stargazers_count
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// GET /api/github/stats?repo=owner/name
const getStats = async (req, res) => {
  const { repo }  = req.query
  const userId    = req.session.userId
  try {
    // Check cache first
    const cached = await getCache(userId, repo, 'stats')
    if (cached) return res.json(cached)

    const gh = await getGitHubClient(userId)
    const [commitsRes, prsRes, activityRes] = await Promise.all([
      gh.get(`/repos/${repo}/commits?per_page=100`),
      gh.get(`/repos/${repo}/pulls?state=all&per_page=100`),
      gh.get(`/repos/${repo}/stats/commit_activity`)
    ])

    const prs       = prsRes.data
    const openPRs   = prs.filter(p => p.state === 'open').length
    const mergedPRs = prs.filter(p => p.merged_at).length
    const closedPRs = prs.filter(p => p.state === 'closed' && !p.merged_at).length

    // Build commit activity for last 30 days
    const commitActivity = activityRes.data
      ?.slice(-4)
      .flatMap(week =>
        week.days.map((count, i) => ({
          date:    new Date((week.week + i * 86400) * 1000)
                   .toLocaleDateString('en-US', { month:'short', day:'numeric' }),
          commits: count
        }))
      ) || []

    const data = {
      totalCommits:      commitsRes.data.length,
      openPRs,
      mergedPRs,
      closedPRs,
      totalContributors: new Set(
        commitsRes.data.map(c => c.author?.login).filter(Boolean)
      ).size,
      commitActivity,
      prStats: [{
        week:   'This Period',
        open:   openPRs,
        merged: mergedPRs,
        closed: closedPRs
      }]
    }

    await setCache(userId, repo, 'stats', data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// GET /api/github/contributors?repo=owner/name
const getContributors = async (req, res) => {
  const { repo } = req.query
  const userId   = req.session.userId
  try {
    const cached = await getCache(userId, repo, 'contributors')
    if (cached) return res.json(cached)

    const gh   = await getGitHubClient(userId)
    const cont = await gh.get(`/repos/${repo}/contributors?per_page=10`)
    const data = cont.data.map(c => ({
      login:         c.login,
      contributions: c.contributions,
      avatar:        c.avatar_url
    }))

    await setCache(userId, repo, 'contributors', data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getRepos, getStats, getContributors }