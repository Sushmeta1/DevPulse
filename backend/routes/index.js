const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const auth = require('../controllers/authController');
const user = require('../controllers/userController');
const repos = require('../controllers/repositoryController');
const analytics = require('../controllers/analyticsController');
const ai = require('../controllers/aiController');

const limiter = (max, windowMs = 15 * 60 * 1000) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await req.app.locals.deps.db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

router.get('/config', auth.publicConfig);
router.post('/auth/demo', limiter(30), auth.demoLogin);
router.get('/auth/github', limiter(30), auth.redirectToGithub);
router.get('/auth/github/callback', limiter(30), auth.handleCallback);
router.post('/auth/logout', auth.logout);

router.use(limiter(600));
router.get('/user', requireAuth, user.getUser);

router.get('/repositories', requireAuth, repos.listRepositories);
router.get('/repositories/:owner/:repo/commits', requireAuth, repos.listCommits);
router.get('/repositories/:owner/:repo/pulls', requireAuth, repos.listPulls);

router.get('/analytics/summary', requireAuth, analytics.getSummary);

router.post('/ai/sprint-summary', requireAuth, limiter(20, 60 * 1000), ai.createSprintSummary);
router.get('/ai/reports', requireAuth, ai.listReports);

module.exports = router;
