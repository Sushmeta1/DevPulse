require('dotenv').config({ path: '../.env' })
const express   = require('express')
const cors      = require('cors')
const session   = require('express-session')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Middleware ──────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Session ─────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'devpulse-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 86400000
  }
}))


// ── Routes ──────────────────────────────────────────────
const authRoutes   = require('./routes/authRoutes')
const githubRoutes = require('./routes/githubRoutes')
const aiRoutes     = require('./routes/aiRoutes')

app.use('/auth',       authRoutes)
app.use('/api/github', githubRoutes)
app.use('/api/ai',     aiRoutes)

// ── Health Check ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    uptime:    process.uptime(),
    timestamp: new Date()
  })
})

// ── Root ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'DevPulse API is running 🚀' })
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
})

module.exports = app