import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { handleVaultDelete, parseFirestoreFields } from '../server/vaultDeletion.js';

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

describe('Cloudinary Vault Asset Deletion Security & Recovery (handleVaultDelete)', () => {
  const TEST_UID = 'user_abc_123';
  const OTHER_UID = 'user_hacker_999';
  const TEST_FILE_ID = 'vault_doc_789';
  const VALID_PUBLIC_ID = `health-vault/${TEST_UID}/blood_test_report`;

  test('rejects unauthenticated request with 401', async () => {
    const req = { user: null, body: { fileId: TEST_FILE_ID } };
    const res = createMockRes();

    await handleVaultDelete(req, res);

    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /Unauthorized/);
  });

  test('rejects missing fileId with 400', async () => {
    const req = { user: { uid: TEST_UID }, body: {} };
    const res = createMockRes();

    await handleVaultDelete(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /File ID is required/);
  });

  test('rejects path traversal or illegal characters in fileId with 400', async () => {
    const maliciousIds = [
      '../secret_doc',
      'subfolder/doc_1',
      '..\\windows\\traversal',
      'doc$name#bad'
    ];

    for (const badId of maliciousIds) {
      const req = { user: { uid: TEST_UID }, body: { fileId: badId } };
      const res = createMockRes();

      await handleVaultDelete(req, res);

      assert.equal(res.statusCode, 400, `Expected 400 for fileId: ${badId}`);
      assert.match(res.body.error, /Invalid file ID format/);
    }
  });

  test('returns 404 when requested document record is missing in Firestore', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: 'non_existent_doc' } };
    const res = createMockRes();

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => null // record not found
    });

    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /not found in your health records/);
  });

  test('returns 403 when Firestore rules deny access (cross-user document access)', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: 'victim_file_123' } };
    const res = createMockRes();

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => {
        const err = new Error('Permission denied on resource');
        err.status = 403;
        throw err;
      }
    });

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /Access to requested vault document is denied/);
  });

  test('rejects mismatched public ID with 400 when client ID differs from server record', async () => {
    const req = {
      user: { uid: TEST_UID },
      body: {
        fileId: TEST_FILE_ID,
        publicId: `health-vault/${TEST_UID}/different_public_id` // mismatch!
      }
    };
    const res = createMockRes();

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => ({
        cloudinaryId: VALID_PUBLIC_ID,
        fileType: 'pdf'
      })
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Mismatched public ID/);
  });

  test('rejects deletion with 403 if server record points to an asset outside user vault folder', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: TEST_FILE_ID } };
    const res = createMockRes();

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => ({
        cloudinaryId: `health-vault/${OTHER_UID}/stolen_scan.pdf`,
        fileType: 'pdf'
      })
    });

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /does not belong to your personal vault folder/);
  });

  test('preserves Firestore record and returns 500 when Cloudinary deletion fails', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: TEST_FILE_ID } };
    const res = createMockRes();
    let firestoreDeleted = false;

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => ({
        cloudinaryId: VALID_PUBLIC_ID,
        fileType: 'pdf'
      }),
      destroyCloudinaryAsset: async () => {
        throw new Error('Cloudinary connection timeout');
      },
      deleteFirestoreDoc: async () => {
        firestoreDeleted = true;
      }
    });

    assert.equal(res.statusCode, 500);
    assert.match(res.body.error, /Failed to delete asset from cloud storage/);
    assert.equal(firestoreDeleted, false, 'Firestore record MUST NOT be deleted if Cloudinary fails');
  });

  test('handles partial failure safely when Cloudinary succeeds but Firestore deletion fails', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: TEST_FILE_ID } };
    const res = createMockRes();
    let cloudinaryDestroyed = false;

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => ({
        cloudinaryId: VALID_PUBLIC_ID,
        fileType: 'pdf'
      }),
      destroyCloudinaryAsset: async () => {
        cloudinaryDestroyed = true;
        return { result: 'ok' };
      },
      deleteFirestoreDoc: async () => {
        throw new Error('Firestore database offline');
      }
    });

    assert.equal(cloudinaryDestroyed, true, 'Cloudinary asset was destroyed');
    assert.equal(res.statusCode, 500, 'Must return 500 on partial failure, not 200');
    assert.equal(res.body.partialFailure, true, 'Must flag partial failure');
    assert.equal(res.body.stage, 'firestore_cleanup_failed');
    assert.match(res.body.error, /can be retried safely/);
  });

  test('successfully deletes authorized vault document and cloud asset', async () => {
    const req = {
      user: { uid: TEST_UID },
      body: { fileId: TEST_FILE_ID, publicId: VALID_PUBLIC_ID }
    };
    const res = createMockRes();
    let destroyedAssetId = null;
    let deletedDocId = null;

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async ({ uid, fileId }) => {
        assert.equal(uid, TEST_UID);
        assert.equal(fileId, TEST_FILE_ID);
        return {
          title: 'Lab Report',
          cloudinaryId: VALID_PUBLIC_ID,
          fileType: 'pdf'
        };
      },
      destroyCloudinaryAsset: async (publicId) => {
        destroyedAssetId = publicId;
        return { result: 'ok' };
      },
      deleteFirestoreDoc: async ({ fileId }) => {
        deletedDocId = fileId;
        return true;
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.fileId, TEST_FILE_ID);
    assert.equal(destroyedAssetId, VALID_PUBLIC_ID);
    assert.equal(deletedDocId, TEST_FILE_ID);
  });

  test('safely reconciles retry when Cloudinary asset was already deleted (returns not found)', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: TEST_FILE_ID } };
    const res = createMockRes();
    let firestoreDeleted = false;

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => ({
        cloudinaryId: VALID_PUBLIC_ID,
        fileType: 'image/png'
      }),
      destroyCloudinaryAsset: async () => {
        // Asset already gone on Cloudinary from prior run
        return { result: 'not found' };
      },
      deleteFirestoreDoc: async () => {
        firestoreDeleted = true;
        return true;
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(firestoreDeleted, true, 'Firestore cleanup successfully completed on retry');
  });

  test('successfully deletes metadata-only vault document without Cloudinary asset', async () => {
    const req = { user: { uid: TEST_UID }, body: { fileId: 'doc_no_cloud_asset' } };
    const res = createMockRes();
    let cloudinaryCalled = false;
    let firestoreDeleted = false;

    await handleVaultDelete(req, res, {
      fetchFirestoreDoc: async () => ({
        title: 'Physical Prescription Note',
        notes: 'Kept in physical file cabinet'
        // no cloudinaryId
      }),
      destroyCloudinaryAsset: async () => {
        cloudinaryCalled = true;
      },
      deleteFirestoreDoc: async () => {
        firestoreDeleted = true;
        return true;
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(cloudinaryCalled, false, 'Cloudinary destroy was not needed');
    assert.equal(firestoreDeleted, true);
  });

  test('parseFirestoreFields correctly converts Firestore REST field structures', () => {
    const rawFields = {
      title: { stringValue: 'Blood Test 2026' },
      fileType: { stringValue: 'pdf' },
      fileSize: { integerValue: '1048576' },
      ratio: { doubleValue: 1.25 },
      verified: { booleanValue: true },
      emptyNote: { nullValue: null }
    };

    const parsed = parseFirestoreFields(rawFields);

    assert.equal(parsed.title, 'Blood Test 2026');
    assert.equal(parsed.fileType, 'pdf');
    assert.equal(parsed.fileSize, 1048576);
    assert.equal(parsed.ratio, 1.25);
    assert.equal(parsed.verified, true);
    assert.equal(parsed.emptyNote, null);
  });
});
