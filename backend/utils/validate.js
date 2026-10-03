const { HttpError } = require('./httpError');

// GitHub owner/repo names: alphanumerics, '-', '_', '.'
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const valid = (s) => NAME_RE.test(s || '') && s !== '.' && s !== '..'; // no path traversal into the GitHub URL

function parseRepo(owner, name) {
  if (!valid(owner) || !valid(name)) {
    throw new HttpError(400, 'Invalid repository name');
  }
  return { owner, name };
}

function parseFullName(full) {
  const [owner, name, ...rest] = String(full || '').split('/');
  if (rest.length) throw new HttpError(400, 'Invalid repository name');
  return parseRepo(owner, name);
}

function parseDays(value, fallback = 30) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 90) {
    throw new HttpError(400, 'days must be an integer between 1 and 90');
  }
  return n;
}

// Minutes east of UTC; real-world offsets span -12:00 .. +14:00.
function parseTzOffset(value) {
  if (value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < -720 || n > 840) throw new HttpError(400, 'tzOffset must be minutes between -720 and 840');
  return n;
}

module.exports = { parseRepo, parseFullName, parseDays, parseTzOffset };
