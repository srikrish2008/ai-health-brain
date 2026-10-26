/**
 * In-Memory Sliding-Window Rate Limiter Middleware
 *
 * Provides lightweight, zero-dependency rate limiting for Express routes.
 * Tracks requests per client key (authenticated Firebase user UID or client IP).
 * Automatically sets standard HTTP 429 and Retry-After headers when limits are reached.
 *
 * ARCHITECTURAL LIMITATION & SERVERLESS CONSIDERATION:
 * This rate limiter tracks request timestamps in an in-memory Map within the local Node.js process.
 * On serverless platforms (such as Vercel Serverless Functions), functions run in isolated,
 * short-lived containers that spin up and down on demand.
 * 
 * Consequently:
 * 1. This limiter provides effective burst and single-container rate limiting for concurrent requests
 *    hitting the same container, but does NOT provide unified global rate limiting across multiple
 *    concurrently running serverless container instances.
 * 2. True distributed global rate limiting across serverless instances requires an external shared
 *    datastore (e.g., Upstash Redis, Redis Cloud, or Cloudflare KV).
 * 3. In accordance with project requirements to avoid paid infrastructure, third-party services,
 *    and unnecessary dependencies, this lightweight in-process limiter is used as a baseline defense.
 */

/**
 * Creates an Express middleware function for rate limiting.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000] - Time window in milliseconds (default: 1 minute).
 * @param {number} [options.max=30] - Maximum allowed requests per window per client.
 * @param {string} [options.message] - Custom error message for HTTP 429 response.
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 30;
  const message = options.message || 'Too many requests. Please slow down and try again later.';

  // Map of clientKey -> Array of epoch millisecond timestamps
  const hits = new Map();

  // Periodic cleanup of stale timestamps to prevent memory growth
  // (Skip interval timer in Vercel serverless functions where background timers can hang execution)
  if (!process.env.VERCEL) {
    const sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of hits.entries()) {
        const active = timestamps.filter(t => now - t < windowMs);
        if (active.length === 0) {
          hits.delete(key);
        } else {
          hits.set(key, active);
        }
      }
    }, Math.max(windowMs, 60000));

    // Allow process to exit cleanly if this is the only active timer
    if (sweepInterval.unref) {
      sweepInterval.unref();
    }
  }

  const middleware = (req, res, next) => {
    // Prefer authenticated user UID; fall back to client IP address
    const clientKey = req.user?.uid
      ? `user:${req.user.uid}`
      : `ip:${req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'}`;

    const now = Date.now();
    const clientHits = hits.get(clientKey) || [];

    // Filter out hits older than the sliding window
    const recentHits = clientHits.filter(t => now - t < windowMs);

    if (recentHits.length >= max) {
      const oldestHit = recentHits[0];
      const resetTimeMs = windowMs - (now - oldestHit);
      const retryAfterSeconds = Math.max(1, Math.ceil(resetTimeMs / 1000));

      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((oldestHit + windowMs) / 1000));

      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    recentHits.push(now);
    hits.set(clientKey, recentHits);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - recentHits.length));

    next();
  };

  // Helper for test suites to inspect and reset state
  middleware.reset = () => hits.clear();
  middleware.getHits = (key) => hits.get(key) || [];

  return middleware;
}
