import { v2 as cloudinary } from 'cloudinary';

/**
 * Parses Firestore REST API field format into a plain JavaScript object.
 *
 * @param {object} fields Firestore document fields object
 * @returns {object} Plain JS object
 */
export function parseFirestoreFields(fields = {}) {
  const result = {};
  for (const [key, valueObj] of Object.entries(fields)) {
    if (!valueObj || typeof valueObj !== 'object') continue;
    if (valueObj.stringValue !== undefined) result[key] = valueObj.stringValue;
    else if (valueObj.integerValue !== undefined) result[key] = Number(valueObj.integerValue);
    else if (valueObj.doubleValue !== undefined) result[key] = Number(valueObj.doubleValue);
    else if (valueObj.booleanValue !== undefined) result[key] = valueObj.booleanValue;
    else if (valueObj.timestampValue !== undefined) result[key] = valueObj.timestampValue;
    else if (valueObj.nullValue !== undefined) result[key] = null;
    else result[key] = valueObj;
  }
  return result;
}

/**
 * Default production helper to fetch a Firestore document using the official Firestore REST API
 * authenticated with the user's verified Firebase ID token.
 */
export async function defaultFetchFirestoreDoc({ projectId, uid, fileId, idToken }) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}/vault/${encodeURIComponent(fileId)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Accept': 'application/json'
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status === 403) {
    const error = new Error('Forbidden: Access to requested vault record denied.');
    error.status = 403;
    throw error;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const error = new Error(`Firestore REST API returned ${response.status}: ${errText}`);
    error.status = response.status;
    throw error;
  }

  const json = await response.json();
  return parseFirestoreFields(json.fields);
}

/**
 * Default production helper to delete a Firestore document using the official Firestore REST API.
 */
export async function defaultDeleteFirestoreDoc({ projectId, uid, fileId, idToken }) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}/vault/${encodeURIComponent(fileId)}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Accept': 'application/json'
    }
  });

  if (response.status === 404 || response.ok) {
    return true;
  }

  const errText = await response.text().catch(() => '');
  const error = new Error(`Failed to delete Firestore record (${response.status}): ${errText}`);
  error.status = response.status;
  throw error;
}

/**
 * Default production Cloudinary destroy wrapper.
 */
export async function defaultDestroyCloudinaryAsset(publicId, options) {
  return await cloudinary.uploader.destroy(publicId, options);
}

/**
 * Shared production deletion handler for vault documents.
 * 
 * Verifies authenticated user, verifies document existence in Firestore under users/{uid}/vault/{fileId},
 * derives Cloudinary public ID and resource type from verified server-side record data,
 * validates user folder ownership, destroys Cloudinary asset, and deletes Firestore document.
 * 
 * In case of partial failure (Cloudinary deleted but Firestore delete fails), reports specific
 * error with partialFailure: true so it can be retried or reconciled safely without data corruption.
 */
export async function handleVaultDelete(req, res, options = {}) {
  // 1. Authenticate the Firebase user
  if (!req.user || !req.user.uid) {
    return res.status(401).json({ error: 'Unauthorized: User authentication required.' });
  }

  const uid = req.user.uid;
  const { fileId, publicId: clientPublicId } = req.body || {};

  // 2. Validate requested fileId
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'File ID is required and must be a string.' });
  }

  const trimmedFileId = fileId.trim();

  // Basic sanity and path traversal prevention on fileId
  if (
    trimmedFileId.includes('..') ||
    trimmedFileId.includes('/') ||
    trimmedFileId.includes('\\') ||
    !/^[a-zA-Z0-9_\-.]+$/.test(trimmedFileId)
  ) {
    return res.status(400).json({ error: 'Invalid file ID format.' });
  }

  // 3. Resolve dependencies (production defaults or test overrides)
  const fetchDoc = options.fetchFirestoreDoc || defaultFetchFirestoreDoc;
  const deleteDoc = options.deleteFirestoreDoc || defaultDeleteFirestoreDoc;
  const destroyAsset = options.destroyCloudinaryAsset || defaultDestroyCloudinaryAsset;
  const projectId = options.projectId || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'ai-health-brain';

  // Extract auth bearer token for Firestore REST calls
  const authHeader = req.headers?.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (options.idToken || '');

  // 4. Verify the requested vault document exists under users/{authenticatedUid}/vault/{fileId}
  let vaultRecord = null;
  try {
    vaultRecord = await fetchDoc({ projectId, uid, fileId: trimmedFileId, idToken });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: 'Forbidden: Access to requested vault document is denied.' });
    }
    return res.status(500).json({
      error: 'Failed to retrieve vault document record from database.',
      details: err.message
    });
  }

  if (!vaultRecord) {
    return res.status(404).json({ error: 'Vault document not found in your health records.' });
  }

  // 5. Derive the Cloudinary public ID and resource type from trusted server-side record data
  const serverPublicId = vaultRecord.cloudinaryId || null;
  const serverFileType = vaultRecord.fileType || vaultRecord.format || '';

  // Cross-check: If client supplied a public ID, verify it matches the server-side record
  if (clientPublicId && typeof clientPublicId === 'string') {
    const trimmedClientPublicId = clientPublicId.trim();
    if (serverPublicId && trimmedClientPublicId !== serverPublicId) {
      return res.status(400).json({
        error: 'Mismatched public ID: supplied public ID does not match the server-side vault record.'
      });
    }
  }

  // 6. Ensure the asset belongs to the authenticated user's vault folder
  if (serverPublicId) {
    const userFolderPrefix = `health-vault/${uid}/`;
    if (!serverPublicId.startsWith(userFolderPrefix)) {
      return res.status(403).json({
        error: 'Forbidden: Cloud asset does not belong to your personal vault folder.'
      });
    }
  }

  // 7. If document has a Cloudinary asset, delete from Cloudinary first
  let cloudinaryDeleted = false;
  if (serverPublicId) {
    try {
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(serverFileType.toLowerCase());
      const typesToTry = isImage ? ['image', 'raw', 'video'] : ['raw', 'image', 'video'];

      let lastResult = null;
      for (const type of typesToTry) {
        const result = await destroyAsset(serverPublicId, {
          resource_type: type,
          invalidate: true
        });
        lastResult = result;
        if (result && (result.result === 'ok' || result.result === 'not found')) {
          cloudinaryDeleted = true;
          break;
        }
      }

      if (!cloudinaryDeleted) {
        return res.status(500).json({
          error: 'Failed to delete asset from cloud storage.',
          details: lastResult?.result || 'Cloudinary deletion returned non-ok status'
        });
      }
    } catch (cloudErr) {
      return res.status(500).json({
        error: 'Failed to delete asset from cloud storage.',
        details: cloudErr.message
      });
    }
  }

  // 8. Delete the Firestore metadata record
  try {
    await deleteDoc({ projectId, uid, fileId: trimmedFileId, idToken });
  } catch (firestoreErr) {
    // Cloudinary succeeded, but Firestore deletion failed.
    // Return explicit 500 with partial failure flag so user/client knows and can retry safely!
    return res.status(500).json({
      error: 'Cloud storage asset was deleted, but failed to remove document record from database. The deletion can be retried safely.',
      partialFailure: true,
      stage: 'firestore_cleanup_failed',
      details: firestoreErr.message
    });
  }

  // 9. Complete Success
  return res.json({
    success: true,
    message: 'Vault document and cloud asset successfully deleted.',
    fileId: trimmedFileId,
    cloudinaryDeleted
  });
}
