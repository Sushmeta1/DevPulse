const axios = require('axios')
const pool  = require('../config/db')

const redirectToGithub = (req, res) => {
  const githubAuthURL =
    `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,read:user`
  res.redirect(githubAuthURL)
}

const handleCallback = async (req, res) => {
  const { code } = req.query
  try {
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      { headers: { Accept: 'application/json' } }
    )

    const { access_token } = tokenRes.data

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    })

    const { id, login, avatar_url } = userRes.data

    const result = await pool.query(
      `INSERT INTO users (github_id, username, avatar_url, access_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_id) DO UPDATE
       SET access_token = $4, avatar_url = $3
       RETURNING id`,
      [id, login, avatar_url, access_token]
    )

    req.session.userId   = result.rows[0].id
    req.session.username = login
    req.session.avatar   = avatar_url

    req.session.save(() => {
      res.redirect(`${process.env.FRONTEND_URL}/dashboard`)
    })

  } catch (err) {
    console.error('❌ OAuth error:', err.message)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
  }
}

const logout = (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' })
  })
}

module.exports = { redirectToGithub, handleCallback, logout }