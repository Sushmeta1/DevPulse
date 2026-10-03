const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

/** Builds the Express app. `deps` = { config, db, github } so tests can inject fakes. */
function createApp(deps) {
  const { config } = deps;
  const app = express();
  app.locals.deps = deps;
  app.set('trust proxy', 1); // Railway / reverse proxies

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // GitHub avatars (profile + contributor lists)
        'img-src': ["'self'", 'data:', 'https://avatars.githubusercontent.com', 'https://github.com'],
      },
    },
  }));
  app.use(compression());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', routes);
  app.use('/api', notFound);

  // Single-container deployment: serve the built React app and fall back to index.html for client routes.
  const indexHtml = path.join(config.frontendDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    // Vite fingerprints everything in /assets, so it can be cached forever; index.html must always revalidate.
    app.use('/assets', express.static(path.join(config.frontendDist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(config.frontendDist, { index: false, maxAge: 0 }));
    app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/assets/') ? res.sendFile(indexHtml) : next()));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
