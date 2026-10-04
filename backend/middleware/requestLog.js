const crypto = require('crypto');

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Assigns every request an id (echoed in X-Request-Id and in error logs, so a user's report can be
 * matched to a log line) and writes one JSON line per request. Query strings are deliberately never
 * logged: the OAuth callback carries a one-time code there.
 */
function requestLog({ enabled }) {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
    res.set('X-Request-Id', req.id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (!enabled || req.path === '/api/health') return;
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : 'info',
        id: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        user: req.user?.id,
      }));
    });
    next();
  };
}

module.exports = { requestLog };
