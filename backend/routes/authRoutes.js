const express = require('express')
const router  = express.Router()
const {
  redirectToGithub,
  handleCallback,
  logout
} = require('../controllers/authController')

router.get('/github',          redirectToGithub)
router.get('/github/callback', handleCallback)
router.post('/logout',         logout)

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({
    userId:   req.session.userId,
    username: req.session.username,
    avatar:   req.session.avatar
  })
})

module.exports = router