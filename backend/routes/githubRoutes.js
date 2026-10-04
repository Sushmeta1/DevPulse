// backend/routes/githubRoutes.js
const express  = require('express')
const router   = express.Router()
const {
  getRepos,
  getStats,
  getContributors
} = require('../controllers/githubController')

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

router.get('/repos',        requireAuth, getRepos)
router.get('/stats',        requireAuth, getStats)
router.get('/contributors', requireAuth, getContributors)

module.exports = router