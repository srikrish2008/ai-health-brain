import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../server/rateLimiter.js';

// Helper to create a mock Express response object
function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, val) {
      headers[name.toLowerCase()] = val;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    }
  };
  return res;
}

describe('Rate Limiter Middleware (createRateLimiter)', () => {
  test('allows requests within configured threshold', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 3 });
    const req = { user: { uid: 'user_rate_1' } };

    for (let i = 0; i < 3; i++) {
      let nextCalled = false;
      const res = createMockRes();
      limiter(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, `Request ${i + 1} should be allowed`);
      assert.equal(res.statusCode, 200);
      assert.equal(res.getHeader('x-ratelimit-remaining'), 3 - (i + 1));
    }
  });

  test('blocks requests exceeding threshold with HTTP 429 and Retry-After header', () => {
    const limiter = createRateLimiter({
      windowMs: 5000,
      max: 2,
      message: 'Rate limit exceeded'
    });
    const req = { user: { uid: 'user_rate_2' } };

    // Request 1: allowed
    let next1 = false;
    limiter(req, createMockRes(), () => { next1 = true; });
    assert.equal(next1, true);

    // Request 2: allowed
    let next2 = false;
    limiter(req, createMockRes(), () => { next2 = true; });
    assert.equal(next2, true);

    // Request 3: blocked
    let next3 = false;
    const res3 = createMockRes();
    limiter(req, res3, () => { next3 = true; });

    assert.equal(next3, false, '3rd request should be blocked');
    assert.equal(res3.statusCode, 429);
    assert.equal(res3.body.error, 'Rate limit exceeded');
    assert.ok(res3.getHeader('retry-after') >= 1);
    assert.equal(res3.getHeader('x-ratelimit-remaining'), 0);
  });

  test('tracks different users independently', () => {
    const limiter = createRateLimiter({ windowMs: 5000, max: 1 });
    const reqUserA = { user: { uid: 'user_A' } };
    const reqUserB = { user: { uid: 'user_B' } };

    // User A uses their 1 request
    let nextA1 = false;
    limiter(reqUserA, createMockRes(), () => { nextA1 = true; });
    assert.equal(nextA1, true);

    // User A blocked on 2nd request
    let nextA2 = false;
    const resA2 = createMockRes();
    limiter(reqUserA, resA2, () => { nextA2 = true; });
    assert.equal(nextA2, false);
    assert.equal(resA2.statusCode, 429);

    // User B should NOT be blocked
    let nextB1 = false;
    const resB1 = createMockRes();
    limiter(reqUserB, resB1, () => { nextB1 = true; });
    assert.equal(nextB1, true);
    assert.equal(resB1.statusCode, 200);
  });

  test('tracks unauthenticated clients by IP address', () => {
    const limiter = createRateLimiter({ windowMs: 5000, max: 1 });
    const reqIp = { ip: '198.51.100.42', headers: {}, socket: {} };

    let next1 = false;
    limiter(reqIp, createMockRes(), () => { next1 = true; });
    assert.equal(next1, true);

    let next2 = false;
    const res2 = createMockRes();
    limiter(reqIp, res2, () => { next2 = true; });
    assert.equal(next2, false);
    assert.equal(res2.statusCode, 429);
  });
});

describe('Payload Size & Error Handling Middleware Logic', () => {
  // Mock error handler identical to server/index.js
  function handlePayloadError(err, req, res, next) {
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res.status(413).json({
        error: 'Payload Too Large: The submitted request body exceeds the maximum permitted size limit.'
      });
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: 'Bad Request: Malformed JSON payload in request body.'
      });
    }
    next(err);
  }

  test('returns clean JSON 413 for entity.too.large without crash or stack trace', () => {
    const err = new Error('request entity too large');
    err.type = 'entity.too.large';
    err.status = 413;

    const res = createMockRes();
    let nextCalled = false;

    handlePayloadError(err, {}, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 413);
    assert.match(res.body.error, /Payload Too Large/);
    assert.equal(res.body.stack, undefined, 'Stack trace must never be leaked');
  });

  test('returns clean JSON 400 for malformed JSON payload without crash', () => {
    const err = new SyntaxError('Unexpected token } in JSON at position 10');
    err.status = 400;
    err.body = '{ "invalid": }';

    const res = createMockRes();
    let nextCalled = false;

    handlePayloadError(err, {}, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Malformed JSON payload/);
    assert.equal(res.body.stack, undefined, 'Stack trace must never be leaked');
  });
});
