const express  = require('express')
const router   = express.Router()
const { generateSummary } = require('../controllers/aiController')

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

router.post('/summary', requireAuth, generateSummary)

module.exports = router