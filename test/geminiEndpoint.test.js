import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeFetchCloudinaryDocument } from '../server/urlSecurity.js';
import { validateDocument } from '../server/documentValidator.js';

// Helper to create a mock Express response object
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

// Handler mimicking the exact secure logic in /api/gemini
async function handleGeminiRequest(req, res) {
  const { prompt, fileData } = req.body;
  if (!prompt && !fileData) {
    return res.status(400).json({ error: 'Prompt or file data is required' });
  }

  try {
    let inlinePart = null;
    if (fileData) {
      try {
        if (fileData.base64) {
          const buffer = Buffer.from(fileData.base64, 'base64');
          const validation = validateDocument(buffer, fileData.mimeType);
          inlinePart = {
            inlineData: {
              data: fileData.base64,
              mimeType: validation.mimeType
            }
          };
        } else if (fileData.url) {
          const { base64Data, contentType } = await safeFetchCloudinaryDocument(fileData.url, {
            expectedCloudName: 'offfbqj0',
            maxSizeBytes: 10 * 1024 * 1024,
            timeoutMs: 5000
          });
          const buffer = Buffer.from(base64Data, 'base64');
          const validation = validateDocument(buffer, fileData.mimeType || contentType);
          inlinePart = {
            inlineData: {
              data: base64Data,
              mimeType: validation.mimeType
            }
          };
        } else {
          return res.status(400).json({ error: 'fileData must contain either base64 or a valid url.' });
        }
      } catch (docErr) {
        return res.status(400).json({ error: docErr.message });
      }
    }

    return res.status(200).json({ success: true, inlinePart });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Failed to communicate with Gemini API',
      details: error.message
    });
  }
}

describe('/api/gemini Endpoint Security Logic', () => {
  test('returns 400 when prompt and fileData are missing', async () => {
    const req = { body: {} };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Prompt or file data is required/);
  });

  test('returns 400 Bad Request and rejects SSRF attempt to internal metadata IP', async () => {
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { url: 'http://169.254.169.254/latest/meta-data/' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Insecure URL protocol: Only HTTPS URLs are allowed/);
  });

  test('returns 400 Bad Request and rejects SSRF attempt to localhost', async () => {
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { url: 'https://localhost/offfbqj0/report.pdf' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Untrusted host "localhost"/);
  });

  test('returns 400 Bad Request and rejects arbitrary external domain', async () => {
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { url: 'https://attacker.com/offfbqj0/report.pdf' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Untrusted host "attacker.com"/);
  });

  test('returns 400 Bad Request and rejects unauthorized Cloudinary cloud account', async () => {
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { url: 'https://res.cloudinary.com/attacker_cloud/image/upload/sample.pdf' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Unauthorized Cloudinary cloud name "attacker_cloud"/);
  });

  test('returns 400 Bad Request and rejects unusual ports', async () => {
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { url: 'https://res.cloudinary.com:8443/offfbqj0/image/upload/sample.pdf' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Unusual port rejected \(8443\)/);
  });

  test('accepts valid base64 PDF upload and verifies MIME type', async () => {
    const validPdfBase64 = Buffer.from('%PDF-1.4\n%test\n').toString('base64');
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { base64: validPdfBase64, mimeType: 'application/pdf' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.inlinePart.inlineData.mimeType, 'application/pdf');
  });

  test('rejects base64 document with unsupported type (e.g. HTML payload)', async () => {
    const htmlBase64 = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { base64: htmlBase64, mimeType: 'text/html' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Unsupported document format/);
  });

  test('rejects base64 document with spoofed / inconsistent MIME type', async () => {
    // Real content is PDF, but claimed to be image/png
    const pdfBase64 = Buffer.from('%PDF-1.4\n%content\n').toString('base64');
    const req = {
      body: {
        prompt: 'Analyze report',
        fileData: { base64: pdfBase64, mimeType: 'image/png' }
      }
    };
    const res = createMockRes();

    await handleGeminiRequest(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Inconsistent document type/);
  });
});
