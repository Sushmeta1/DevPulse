const { HttpError } = require('./httpError');

/** fetch() with a hard deadline, so a stalled upstream (GitHub, Gemini, OpenAI) can't hang a request. */
async function fetchWithTimeout(url, options = {}, ms = 15000) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new HttpError(504, 'An upstream service took too long to respond. Please try again.');
    }
    throw new HttpError(502, 'Could not reach an upstream service. Please try again.');
  }
}

module.exports = { fetchWithTimeout };
