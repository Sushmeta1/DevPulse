function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(JSON.stringify({ level: 'error', id: req.id, msg: err.message, stack: err.stack?.split('\n').slice(0, 6).join('\n') }));
  }
  const message = status >= 500 && !err.status ? 'Internal server error' : err.message;
  res.status(status).json({ error: message, requestId: req.id });
}

module.exports = { notFound, errorHandler };
