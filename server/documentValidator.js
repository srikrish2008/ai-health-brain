/**
 * Document and Image Content-Type Validator
 *
 * Inspects binary magic bytes and validates MIME types for documents and images
 * uploaded or fetched for Gemini AI analysis.
 *
 * Ensures:
 * 1. Only permitted health document/image formats (PDF, JPEG, PNG, WEBP, GIF) are accepted.
 * 2. Client-supplied MIME types are not blindly trusted.
 * 3. Inconsistent or spoofed MIME types (e.g. claiming image/png for an executable or PDF) are rejected.
 */

export const PERMITTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

/**
 * Detects MIME type from the binary signature (magic bytes) of a buffer.
 *
 * @param {Buffer} buffer
 * @returns {string|null} Detected MIME type or null if unrecognized
 */
export function detectMimeTypeFromBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  // 1. PDF: starts with %PDF- (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // 2. JPEG: starts with 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // 3. PNG: starts with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // 4. WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // 5. GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  return null;
}

/**
 * Normalizes common extension aliases and MIME types.
 *
 * @param {string} input
 * @returns {string|null} Normalized MIME type
 */
export function normalizeMimeType(input) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase().split(';')[0];
  if (cleaned === 'jpg' || cleaned === 'jpeg' || cleaned === 'image/jpg') {
    return 'image/jpeg';
  }
  if (cleaned === 'pdf') {
    return 'application/pdf';
  }
  if (cleaned === 'png') {
    return 'image/png';
  }
  if (cleaned === 'webp') {
    return 'image/webp';
  }
  if (cleaned === 'gif') {
    return 'image/gif';
  }
  return cleaned;
}

/**
 * Validates document buffer against permitted health document formats
 * and checks for consistency with any declared MIME type.
 *
 * @param {Buffer} buffer
 * @param {string} [declaredMimeType]
 * @returns {{ valid: boolean, mimeType: string, sizeBytes: number }}
 * @throws {Error} If document is invalid, unsupported, or inconsistent
 */
export function validateDocument(buffer, declaredMimeType) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty or invalid document payload.');
  }

  const detectedMime = detectMimeTypeFromBuffer(buffer);

  if (!detectedMime || !PERMITTED_MIME_TYPES.has(detectedMime)) {
    throw new Error(
      'Unsupported document format. Only PDF, JPEG, PNG, WEBP, and GIF files are permitted.'
    );
  }

  if (declaredMimeType) {
    const normalizedDeclared = normalizeMimeType(declaredMimeType);
    if (!PERMITTED_MIME_TYPES.has(normalizedDeclared)) {
      throw new Error(
        `Unsupported declared document MIME type: "${declaredMimeType}". Only PDF, JPEG, PNG, WEBP, and GIF are permitted.`
      );
    }
    if (normalizedDeclared !== detectedMime) {
      throw new Error(
        `Inconsistent document type: declared as "${declaredMimeType}" (${normalizedDeclared}) but file content signature is "${detectedMime}".`
      );
    }
  }

  return {
    valid: true,
    mimeType: detectedMime,
    sizeBytes: buffer.length
  };
}
