import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  validateCloudinaryUrl,
  safeFetchCloudinaryDocument,
  UrlValidationError,
  ALLOWED_CLOUDINARY_HOSTNAME
} from '../server/urlSecurity.js';

const TEST_CLOUD_NAME = 'offfbqj0';

describe('Cloudinary URL Security & Validation (validateCloudinaryUrl)', () => {
  describe('Valid URLs', () => {
    test('accepts valid Cloudinary image upload URL', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/v1729700000/health-vault/123/report.pdf`;
      const validated = validateCloudinaryUrl(url, TEST_CLOUD_NAME);
      assert.equal(validated, url);
    });

    test('accepts valid Cloudinary raw upload URL', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/raw/upload/v1729700000/prescription.pdf`;
      const validated = validateCloudinaryUrl(url, TEST_CLOUD_NAME);
      assert.equal(validated, url);
    });

    test('accepts valid URL with standard explicit port 443', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}:443/${TEST_CLOUD_NAME}/image/upload/report.jpg`;
      const validated = validateCloudinaryUrl(url, TEST_CLOUD_NAME);
      assert.ok(validated.startsWith(`https://${ALLOWED_CLOUDINARY_HOSTNAME}`));
    });

    test('accepts case-insensitive hostname and cloud name', () => {
      const url = `https://RES.CLOUDINARY.COM/${TEST_CLOUD_NAME.toUpperCase()}/image/upload/report.pdf`;
      const validated = validateCloudinaryUrl(url, TEST_CLOUD_NAME);
      assert.ok(validated.toLowerCase().includes(TEST_CLOUD_NAME));
    });
  });

  describe('Rejected URLs: Insecure Protocols', () => {
    test('rejects HTTP (non-HTTPS)', () => {
      const url = `http://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Only HTTPS URLs are allowed/
      });
    });

    test('rejects FTP protocol', () => {
      const url = `ftp://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Only HTTPS URLs are allowed/
      });
    });

    test('rejects file protocol', () => {
      assert.throws(() => validateCloudinaryUrl('file:///etc/passwd', TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Only HTTPS URLs are allowed/
      });
    });

    test('rejects javascript protocol', () => {
      assert.throws(() => validateCloudinaryUrl('javascript:alert(1)', TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
    });
  });

  describe('Rejected URLs: Localhost & SSRF Targets', () => {
    test('rejects localhost', () => {
      assert.throws(() => validateCloudinaryUrl('http://localhost:5000/api/internal', TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
      assert.throws(() => validateCloudinaryUrl(`https://localhost/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });

    test('rejects 127.0.0.1 (IPv4 loopback)', () => {
      assert.throws(() => validateCloudinaryUrl('http://127.0.0.1:5000/report.pdf', TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
      assert.throws(() => validateCloudinaryUrl(`https://127.0.0.1/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });

    test('rejects [::1] (IPv6 loopback)', () => {
      assert.throws(() => validateCloudinaryUrl(`https://[::1]/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
      assert.throws(() => validateCloudinaryUrl(`https://[::1]:5000/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
    });

    test('rejects 169.254.169.254 (Cloud metadata service IP)', () => {
      assert.throws(() => validateCloudinaryUrl('http://169.254.169.254/latest/meta-data/', TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
      assert.throws(() => validateCloudinaryUrl(`https://169.254.169.254/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });

    test('rejects private network IPs (RFC 1918)', () => {
      assert.throws(() => validateCloudinaryUrl(`https://10.0.0.1/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
      assert.throws(() => validateCloudinaryUrl(`https://192.168.1.1/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
      assert.throws(() => validateCloudinaryUrl(`https://172.16.0.1/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });
  });

  describe('Rejected URLs: Untrusted Hosts & Domain Spoofing', () => {
    test('rejects arbitrary external hosts', () => {
      assert.throws(() => validateCloudinaryUrl(`https://evil.com/${TEST_CLOUD_NAME}/report.pdf`, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });

    test('rejects subdomain spoofing attack (res.cloudinary.com.attacker.com)', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}.attacker.com/${TEST_CLOUD_NAME}/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });

    test('rejects path spoofing on arbitrary host', () => {
      const url = `https://attacker.com/${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Untrusted host/
      });
    });
  });

  describe('Rejected URLs: Unauthorized Cloud Names (Multi-tenant Isolation)', () => {
    test('rejects Cloudinary URLs belonging to another cloud account', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}/attacker_cloud/image/upload/malicious.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Unauthorized Cloudinary cloud name "attacker_cloud"/
      });
    });

    test('rejects URL with missing path segments after cloud name', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Missing cloud name or resource path/
      });
    });

    test('rejects path traversal attempting to escape expected cloud name', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/../other_cloud/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Unauthorized Cloudinary cloud name/
      });
    });
  });

  describe('Rejected URLs: Unusual Ports & Credentials', () => {
    test('rejects unusual ports (e.g. 8080, 8443, 22)', () => {
      const url = `https://${ALLOWED_CLOUDINARY_HOSTNAME}:8080/${TEST_CLOUD_NAME}/image/upload/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Unusual port rejected \(8080\)/
      });
    });

    test('rejects embedded user credentials in URL', () => {
      const url = `https://user:password@${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/report.pdf`;
      assert.throws(() => validateCloudinaryUrl(url, TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Embedded user credentials are not allowed/
      });
    });
  });

  describe('Rejected URLs: Malformed & Empty Inputs', () => {
    test('rejects empty string', () => {
      assert.throws(() => validateCloudinaryUrl('', TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /URL must be a non-empty string/
      });
    });

    test('rejects whitespace only', () => {
      assert.throws(() => validateCloudinaryUrl('   ', TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /URL cannot be empty/
      });
    });

    test('rejects null and undefined', () => {
      assert.throws(() => validateCloudinaryUrl(null, TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
      assert.throws(() => validateCloudinaryUrl(undefined, TEST_CLOUD_NAME), {
        name: 'UrlValidationError'
      });
    });

    test('rejects non-URL string', () => {
      assert.throws(() => validateCloudinaryUrl('just-a-plain-string', TEST_CLOUD_NAME), {
        name: 'UrlValidationError',
        message: /Malformed URL format/
      });
    });
  });
});

describe('Cloudinary Safe Document Fetcher (safeFetchCloudinaryDocument)', () => {
  let mockServer;
  let mockPort;
  let mockHandler;

  test.beforeEach(async () => {
    await new Promise((resolve) => {
      mockServer = http.createServer((req, res) => {
        if (mockHandler) {
          mockHandler(req, res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = mockServer.address().port;
        resolve();
      });
    });
  });

  test.afterEach(async () => {
    if (mockServer) {
      await new Promise((resolve) => mockServer.close(resolve));
    }
  });

  test('rejects fetch immediately for invalid host without network call', async () => {
    let serverCalled = false;
    mockHandler = () => { serverCalled = true; };

    await assert.rejects(
      async () => {
        await safeFetchCloudinaryDocument(`http://127.0.0.1:${mockPort}/test.pdf`, {
          expectedCloudName: TEST_CLOUD_NAME
        });
      },
      {
        name: 'UrlValidationError'
      }
    );

    assert.equal(serverCalled, false, 'Internal server must never be contacted for invalid URL');
  });

  test('enforces max document size via Content-Length header', async () => {
    const originalFetch = globalThis.fetch;
    // Mock fetch to simulate response from valid Cloudinary URL with large Content-Length
    globalThis.fetch = async () => {
      return new Response('dummy', {
        status: 200,
        headers: {
          'content-length': '20971520', // 20MB
          'content-type': 'application/pdf'
        }
      });
    };

    try {
      await assert.rejects(
        async () => {
          await safeFetchCloudinaryDocument(
            `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/sample.pdf`,
            {
              expectedCloudName: TEST_CLOUD_NAME,
              maxSizeBytes: 10 * 1024 * 1024 // 10MB limit
            }
          );
        },
        {
          name: 'UrlValidationError',
          message: /Document exceeds maximum allowed size of 10MB/
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('enforces max document size during chunked stream read without Content-Length', async () => {
    const originalFetch = globalThis.fetch;
    const oversizedChunk = Buffer.alloc(1500, 'x'); // 1500 bytes

    globalThis.fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(oversizedChunk);
          controller.close();
        }
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'application/pdf' }
      });
    };

    try {
      await assert.rejects(
        async () => {
          await safeFetchCloudinaryDocument(
            `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/sample.pdf`,
            {
              expectedCloudName: TEST_CLOUD_NAME,
              maxSizeBytes: 1000 // 1000 byte limit for test
            }
          );
        },
        {
          name: 'UrlValidationError',
          message: /Document exceeds maximum allowed size/
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('enforces download timeout when fetch hangs', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    try {
      await assert.rejects(
        async () => {
          await safeFetchCloudinaryDocument(
            `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/sample.pdf`,
            {
              expectedCloudName: TEST_CLOUD_NAME,
              timeoutMs: 100 // 100ms timeout
            }
          );
        },
        {
          name: 'UrlValidationError',
          message: /Document download timed out/
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('blocks unsafe redirect to internal/arbitrary host', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(null, {
        status: 302,
        headers: {
          'location': 'http://169.254.169.254/latest/meta-data/'
        }
      });
    };

    try {
      await assert.rejects(
        async () => {
          await safeFetchCloudinaryDocument(
            `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/sample.pdf`,
            {
              expectedCloudName: TEST_CLOUD_NAME
            }
          );
        },
        {
          name: 'UrlValidationError',
          message: /Only HTTPS URLs are allowed/
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('blocks unsafe redirect to another Cloudinary account', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      return new Response(null, {
        status: 302,
        headers: {
          'location': `https://${ALLOWED_CLOUDINARY_HOSTNAME}/attacker_account/raw/upload/file.pdf`
        }
      });
    };

    try {
      await assert.rejects(
        async () => {
          await safeFetchCloudinaryDocument(
            `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/sample.pdf`,
            {
              expectedCloudName: TEST_CLOUD_NAME
            }
          );
        },
        {
          name: 'UrlValidationError',
          message: /Unauthorized Cloudinary cloud name "attacker_account"/
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('successfully downloads document within size and timeout limits', async () => {
    const originalFetch = globalThis.fetch;
    const testPayload = Buffer.from('%PDF-1.4 Mock PDF Content');

    globalThis.fetch = async () => {
      return new Response(testPayload, {
        status: 200,
        headers: {
          'content-length': testPayload.length.toString(),
          'content-type': 'application/pdf'
        }
      });
    };

    try {
      const result = await safeFetchCloudinaryDocument(
        `https://${ALLOWED_CLOUDINARY_HOSTNAME}/${TEST_CLOUD_NAME}/image/upload/sample.pdf`,
        {
          expectedCloudName: TEST_CLOUD_NAME
        }
      );

      assert.equal(result.byteLength, testPayload.length);
      assert.equal(result.contentType, 'application/pdf');
      assert.equal(result.base64Data, testPayload.toString('base64'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
