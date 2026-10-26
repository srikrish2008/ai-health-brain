import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMimeTypeFromBuffer,
  normalizeMimeType,
  validateDocument,
  PERMITTED_MIME_TYPES
} from '../server/documentValidator.js';

describe('Document and Image Content-Type Validator (server/documentValidator.js)', () => {
  // Sample valid buffers with real magic bytes
  const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n');
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from('WEBPVP8 ')
  ]);
  const validGifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00');

  describe('detectMimeTypeFromBuffer', () => {
    test('detects PDF magic bytes (%PDF-)', () => {
      assert.equal(detectMimeTypeFromBuffer(validPdfBuffer), 'application/pdf');
    });

    test('detects JPEG magic bytes (0xFF 0xD8 0xFF)', () => {
      assert.equal(detectMimeTypeFromBuffer(validJpegBuffer), 'image/jpeg');
    });

    test('detects PNG magic bytes (0x89PNG)', () => {
      assert.equal(detectMimeTypeFromBuffer(validPngBuffer), 'image/png');
    });

    test('detects WebP magic bytes (RIFF....WEBP)', () => {
      assert.equal(detectMimeTypeFromBuffer(validWebpBuffer), 'image/webp');
    });

    test('detects GIF magic bytes (GIF87a / GIF89a)', () => {
      assert.equal(detectMimeTypeFromBuffer(validGifBuffer), 'image/gif');
      assert.equal(detectMimeTypeFromBuffer(Buffer.from('GIF87a\x01\x00')), 'image/gif');
    });

    test('returns null for HTML, text, executable, or unrecognized buffers', () => {
      assert.equal(detectMimeTypeFromBuffer(Buffer.from('<!DOCTYPE html><html>')), null);
      assert.equal(detectMimeTypeFromBuffer(Buffer.from('Hello world plain text')), null);
      assert.equal(detectMimeTypeFromBuffer(Buffer.from('MZ\x90\x00\x03\x00\x00\x00')), null); // Windows PE
      assert.equal(detectMimeTypeFromBuffer(Buffer.from('\x7fELF\x02\x01\x01')), null); // Linux ELF
      assert.equal(detectMimeTypeFromBuffer(Buffer.from('{\n  "json": true\n}')), null);
    });

    test('returns null for empty or too-short buffers', () => {
      assert.equal(detectMimeTypeFromBuffer(null), null);
      assert.equal(detectMimeTypeFromBuffer(Buffer.alloc(0)), null);
      assert.equal(detectMimeTypeFromBuffer(Buffer.from([0x25, 0x50])), null);
    });
  });

  describe('normalizeMimeType', () => {
    test('normalizes extension shorthands and aliases', () => {
      assert.equal(normalizeMimeType('jpg'), 'image/jpeg');
      assert.equal(normalizeMimeType('jpeg'), 'image/jpeg');
      assert.equal(normalizeMimeType('image/jpg'), 'image/jpeg');
      assert.equal(normalizeMimeType('pdf'), 'application/pdf');
      assert.equal(normalizeMimeType('png'), 'image/png');
      assert.equal(normalizeMimeType('webp'), 'image/webp');
      assert.equal(normalizeMimeType('gif'), 'image/gif');
    });

    test('strips MIME parameters like charset', () => {
      assert.equal(normalizeMimeType('application/pdf; charset=utf-8'), 'application/pdf');
    });

    test('returns null for non-string or falsy values', () => {
      assert.equal(normalizeMimeType(null), null);
      assert.equal(normalizeMimeType(''), null);
      assert.equal(normalizeMimeType(undefined), null);
    });
  });

  describe('validateDocument', () => {
    test('accepts valid PDF with matching declared MIME type', () => {
      const res = validateDocument(validPdfBuffer, 'application/pdf');
      assert.equal(res.valid, true);
      assert.equal(res.mimeType, 'application/pdf');
      assert.equal(res.sizeBytes, validPdfBuffer.length);
    });

    test('accepts valid JPEG with extension alias "jpg"', () => {
      const res = validateDocument(validJpegBuffer, 'jpg');
      assert.equal(res.valid, true);
      assert.equal(res.mimeType, 'image/jpeg');
    });

    test('accepts valid PNG with matching declared MIME type', () => {
      const res = validateDocument(validPngBuffer, 'image/png');
      assert.equal(res.valid, true);
      assert.equal(res.mimeType, 'image/png');
    });

    test('accepts valid WebP with matching declared MIME type', () => {
      const res = validateDocument(validWebpBuffer, 'image/webp');
      assert.equal(res.valid, true);
      assert.equal(res.mimeType, 'image/webp');
    });

    test('accepts valid GIF with matching declared MIME type', () => {
      const res = validateDocument(validGifBuffer, 'image/gif');
      assert.equal(res.valid, true);
      assert.equal(res.mimeType, 'image/gif');
    });

    test('derives MIME type automatically when declared MIME is omitted', () => {
      const resPdf = validateDocument(validPdfBuffer);
      assert.equal(resPdf.mimeType, 'application/pdf');

      const resPng = validateDocument(validPngBuffer);
      assert.equal(resPng.mimeType, 'image/png');
    });

    test('rejects empty or corrupt document buffers', () => {
      assert.throws(() => validateDocument(Buffer.alloc(0)), /Empty or invalid document payload/);
      assert.throws(() => validateDocument(null), /Empty or invalid document payload/);
    });

    test('rejects unsupported document formats (e.g., HTML, JS, Executables)', () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body>Medical Report</body></html>');
      assert.throws(
        () => validateDocument(htmlBuffer, 'text/html'),
        /Unsupported document format/
      );

      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff');
      assert.throws(
        () => validateDocument(exeBuffer, 'application/octet-stream'),
        /Unsupported document format/
      );
    });

    test('rejects unsupported declared MIME type even if file signature was recognizable', () => {
      assert.throws(
        () => validateDocument(validPdfBuffer, 'application/x-sh'),
        /Unsupported declared document MIME type/
      );
    });

    test('rejects inconsistent MIME type (MIME spoofing attack)', () => {
      // Attacker claims this PDF is a PNG
      assert.throws(
        () => validateDocument(validPdfBuffer, 'image/png'),
        /Inconsistent document type: declared as "image\/png" \(image\/png\) but file content signature is "application\/pdf"/
      );

      // Attacker claims this JPEG is a PDF
      assert.throws(
        () => validateDocument(validJpegBuffer, 'application/pdf'),
        /Inconsistent document type: declared as "application\/pdf" \(application\/pdf\) but file content signature is "image\/jpeg"/
      );
    });
  });
});
