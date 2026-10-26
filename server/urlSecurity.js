/**
 * Cloudinary Document URL Security & Safe Downloader
 * 
 * Protects the AI Health Brain backend against Server-Side Request Forgery (SSRF),
 * denial-of-service (DoS) via slow downloads or oversized files, and unauthorized data access.
 */

// Maximum allowed document size (10 MB) - generous for lab reports & medical PDFs
export const DEFAULT_MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

// Maximum download timeout (10 seconds) to prevent hanging requests
export const DEFAULT_DOWNLOAD_TIMEOUT_MS = 10000;

// Cloudinary official delivery CDN hostname
export const ALLOWED_CLOUDINARY_HOSTNAME = 'res.cloudinary.com';

/**
 * Custom error class for URL validation and security rejections.
 * Carries an HTTP 400 Bad Request status code.
 */
export class UrlValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlValidationError';
    this.statusCode = 400;
    this.isClientError = true;
  }
}

/**
 * Validates that a user-supplied URL belongs strictly to the user's expected
 * Cloudinary account and uses secure HTTPS with standard ports.
 *
 * @param {string} rawUrl - The URL provided by the client.
 * @param {string} [expectedCloudName] - The expected Cloudinary cloud name (e.g. from env).
 * @returns {string} The normalized and validated URL string.
 * @throws {UrlValidationError} If the URL violates any security constraint.
 */
export function validateCloudinaryUrl(rawUrl, expectedCloudName) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new UrlValidationError('Invalid document URL: URL must be a non-empty string.');
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new UrlValidationError('Invalid document URL: URL cannot be empty.');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UrlValidationError('Invalid document URL: Malformed URL format.');
  }

  // 1. Enforce HTTPS only (rejects http, ftp, file, javascript, data, etc.)
  if (parsed.protocol !== 'https:') {
    throw new UrlValidationError('Insecure URL protocol: Only HTTPS URLs are allowed.');
  }

  // 2. Reject credentials in URL (e.g., https://user:pass@host/...)
  if (parsed.username || parsed.password) {
    throw new UrlValidationError('Invalid document URL: Embedded user credentials are not allowed.');
  }

  // 3. Reject unusual ports (allow only default HTTPS port or explicit 443)
  if (parsed.port !== '' && parsed.port !== '443') {
    throw new UrlValidationError(`Unusual port rejected (${parsed.port}): Only standard HTTPS port 443 is allowed.`);
  }

  // 4. Enforce strict hostname match against Cloudinary CDN
  // (Prevents SSRF to localhost, 127.0.0.1, 169.254.169.254, internal IPs, and arbitrary hosts)
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== ALLOWED_CLOUDINARY_HOSTNAME) {
    throw new UrlValidationError(
      `Untrusted host "${hostname}": Only files from ${ALLOWED_CLOUDINARY_HOSTNAME} are permitted.`
    );
  }

  // 5. Enforce matching expected Cloudinary cloud name in URL path
  // Cloudinary delivery URL structure: https://res.cloudinary.com/<cloud_name>/<resource_type>/...
  const targetCloudName = (
    expectedCloudName ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    'offfbqj0'
  ).trim().toLowerCase();

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  if (pathSegments.length < 2) {
    throw new UrlValidationError('Invalid Cloudinary URL structure: Missing cloud name or resource path.');
  }

  const urlCloudName = pathSegments[0].toLowerCase();
  if (urlCloudName !== targetCloudName) {
    throw new UrlValidationError(
      `Unauthorized Cloudinary cloud name "${urlCloudName}": Does not match expected account.`
    );
  }

  return parsed.href;
}

/**
 * Securely downloads a document from Cloudinary after strict validation,
 * with timeout enforcement, size limits, and safe redirect validation.
 *
 * @param {string} rawUrl - The document URL to fetch.
 * @param {object} [options] - Configuration options.
 * @param {string} [options.expectedCloudName] - Expected Cloudinary cloud name.
 * @param {number} [options.maxSizeBytes] - Maximum file size in bytes (default 10MB).
 * @param {number} [options.timeoutMs] - Download timeout in milliseconds (default 10s).
 * @param {number} [options.maxRedirects] - Maximum allowed redirects (default 2).
 * @returns {Promise<{ buffer: Buffer, base64Data: string, contentType: string, byteLength: number }>}
 */
export async function safeFetchCloudinaryDocument(rawUrl, options = {}) {
  const expectedCloudName = (
    options.expectedCloudName ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    'offfbqj0'
  ).trim().toLowerCase();

  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_DOCUMENT_SIZE;
  const timeoutMs = options.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT_MS;
  const maxRedirects = typeof options.maxRedirects === 'number' ? options.maxRedirects : 2;

  // Initial URL validation
  let currentUrl = validateCloudinaryUrl(rawUrl, expectedCloudName);

  // Setup abort controller for timeout
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response;
    let redirectsFollowed = 0;

    // Fetch loop with safe redirect validation
    while (true) {
      try {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual', // Never follow redirects blindly
          headers: {
            'Accept': 'application/pdf,image/jpeg,image/png,image/webp,*/*',
            'User-Agent': 'HealthMate-AI-Backend/1.0'
          }
        });
      } catch (err) {
        if (timedOut || err.name === 'AbortError') {
          throw new UrlValidationError(`Document download timed out after ${timeoutMs / 1000} seconds.`);
        }
        throw new UrlValidationError(`Network error while downloading document: ${err.message}`);
      }

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (response.status >= 300 && response.status < 400) {
        redirectsFollowed++;
        if (redirectsFollowed > maxRedirects) {
          throw new UrlValidationError('Too many redirects encountered while fetching document.');
        }

        const locationHeader = response.headers.get('location');
        if (!locationHeader) {
          throw new UrlValidationError(`Redirect response (HTTP ${response.status}) missing Location header.`);
        }

        // Resolve relative redirects safely against current URL
        let resolvedLocation;
        try {
          resolvedLocation = new URL(locationHeader, currentUrl).href;
        } catch {
          throw new UrlValidationError('Invalid redirect destination URL.');
        }

        // Validate that redirect destination is ALSO a valid Cloudinary URL with the same cloud name!
        // This stops open-redirect SSRF attacks in their tracks.
        currentUrl = validateCloudinaryUrl(resolvedLocation, expectedCloudName);
        continue;
      }

      break;
    }

    if (!response.ok) {
      throw new UrlValidationError(
        `Failed to download document from storage (HTTP ${response.status} ${response.statusText}).`
      );
    }

    // Check Content-Length header early if available
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const parsedLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(parsedLength) && parsedLength > maxSizeBytes) {
        throw new UrlValidationError(
          `Document exceeds maximum allowed size of ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
        );
      }
    }

    // Stream chunks and enforce byte limit dynamically
    // (Prevents zip bombs, chunked encoding bypasses, or slow memory exhaustion)
    const chunks = [];
    let totalBytes = 0;

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      while (true) {
        let chunkResult;
        try {
          chunkResult = await reader.read();
        } catch (err) {
          if (timedOut || err.name === 'AbortError') {
            throw new UrlValidationError(`Document download timed out after ${timeoutMs / 1000} seconds.`);
          }
          throw err;
        }

        if (chunkResult.done) break;

        const chunk = chunkResult.value;
        totalBytes += chunk.length;
        if (totalBytes > maxSizeBytes) {
          controller.abort();
          throw new UrlValidationError(
            `Document exceeds maximum allowed size of ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
          );
        }
        chunks.push(Buffer.from(chunk));
      }
    } else if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
      try {
        for await (const chunk of response.body) {
          totalBytes += chunk.length;
          if (totalBytes > maxSizeBytes) {
            controller.abort();
            throw new UrlValidationError(
              `Document exceeds maximum allowed size of ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
            );
          }
          chunks.push(Buffer.from(chunk));
        }
      } catch (err) {
        if (timedOut || err.name === 'AbortError') {
          throw new UrlValidationError(`Document download timed out after ${timeoutMs / 1000} seconds.`);
        }
        throw err;
      }
    } else {
      // Fallback for mock environments without stream reader
      const arrayBuf = await response.arrayBuffer();
      if (arrayBuf.byteLength > maxSizeBytes) {
        throw new UrlValidationError(
          `Document exceeds maximum allowed size of ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
        );
      }
      chunks.push(Buffer.from(arrayBuf));
      totalBytes = arrayBuf.byteLength;
    }

    const buffer = Buffer.concat(chunks);
    const contentType = response.headers.get('content-type') || 'application/pdf';

    return {
      buffer,
      base64Data: buffer.toString('base64'),
      contentType,
      byteLength: totalBytes
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
