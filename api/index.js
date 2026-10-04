// Vercel serverless entry point: every /api/* request is rewritten here (see vercel.json).
// The React app is served as static files from the CDN, so this function only runs the API.
const { config } = require('../backend/config/env');
const { createHandler } = require('../backend/serverless');

module.exports = createHandler({ config });
