const path = require('path');
const fs = require('fs');
const google = require('@googleapis/drive');

const { config } = require('../config/config.js');
const logger = require('../utils/logger.util.js');

const credentialsPath = path.join(__dirname, '..', '..', '.env', 'southeastcubing-org-api.json');
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// Return the complete per-environment WCA Drive folder configuration.
function getWcaDriveFolderIds() {
  const folderIds = {
    root: config.WCA_DRIVE_ROOT_FOLDER_ID,
    upcoming: config.WCA_DRIVE_UPCOMING_FOLDER_ID,
    past: config.WCA_DRIVE_PAST_FOLDER_ID,
    proposalsInProgress: config.WCA_DRIVE_PROPOSALS_IN_PROGRESS_FOLDER_ID,
    abandoned: config.WCA_DRIVE_ABANDONED_FOLDER_ID,
  };
  const missing = Object.entries(folderIds)
    .filter(([, folderId]) => !folderId)
    .map(([name]) => name);

  if (missing.length > 0) {
    const error = new Error(`WCA Drive is not fully configured; missing folder IDs: ${missing.join(', ')}.`);
    error.code = 'WCA_DRIVE_UNAVAILABLE';
    throw error;
  }

  return folderIds;
}

// Build a Drive API client only when a caller requests Drive work.
function getDriveClient() {
  getWcaDriveFolderIds();

  if (!fs.existsSync(credentialsPath)) {
    const error = new Error('Google service-account credentials are not configured for WCA Drive.');
    error.code = 'WCA_DRIVE_UNAVAILABLE';
    throw error;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [DRIVE_SCOPE],
  });

  return google.drive({ version: 'v3', auth });
}

// Verify optional Drive configuration and credentials without making an API request.
function assertDriveAvailable() {
  getDriveClient();
}

// Keep Drive API success and failure logs at the integration boundary.
async function runDriveRequest(operation, request) {
  const drive = getDriveClient();

  try {
    const result = await request(drive);
    logger.debug(`Successfully ${operation} on Google Drive.`);
    return result;
  } catch (error) {
    logger.error(`Error attempting to ${operation} on Google Drive:`, error);
    throw error;
  }
}

// Restrict folder creation and moves to this environment's configured categories.
function assertCategoryFolder(folderId) {
  const folders = getWcaDriveFolderIds();
  if (
    ![
      folders.upcoming,
      folders.past,
      folders.proposalsInProgress,
      folders.abandoned,
    ].includes(folderId)
  ) {
    throw new Error('The destination is not a configured WCA Drive category folder.');
  }
}

// Create a bare competition folder under a configured category folder.
async function createFolder(name, parentFolderId) {
  assertCategoryFolder(parentFolderId);

  return runDriveRequest('create a folder', async (drive) => {
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME_TYPE,
        parents: [parentFolderId],
      },
      fields: 'id,name,mimeType,parents,webViewLink',
      // Required for any request touching an item inside a Shared Drive -
      // without it, the API returns "not found" even for a file the caller
      // genuinely has access to.
      supportsAllDrives: true,
    });

    return response.data;
  });
}

// Read the name and parent metadata needed to validate an existing folder link.
async function getFolder(folderId) {
  return runDriveRequest('read folder details', async (drive) => {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,parents,webViewLink',
      supportsAllDrives: true,
    });

    return response.data;
  });
}

// Move a folder between this environment's configured category folders.
async function moveFolder(folderId, currentParentFolderId, targetParentFolderId) {
  assertCategoryFolder(currentParentFolderId);
  assertCategoryFolder(targetParentFolderId);

  return runDriveRequest('move a folder', async (drive) => {
    const response = await drive.files.update({
      fileId: folderId,
      addParents: targetParentFolderId,
      removeParents: currentParentFolderId,
      fields: 'id,name,mimeType,parents,webViewLink',
      supportsAllDrives: true,
    });

    return response.data;
  });
}

// Rename a linked competition folder to match its current competition details.
async function renameFolder(folderId, name) {
  return runDriveRequest('rename a folder', async (drive) => {
    const response = await drive.files.update({
      fileId: folderId,
      requestBody: { name },
      fields: 'id,name,mimeType,parents,webViewLink',
      supportsAllDrives: true,
    });

    return response.data;
  });
}

module.exports = {
  createFolder,
  assertDriveAvailable,
  getFolder,
  getWcaDriveFolderIds,
  moveFolder,
  renameFolder,
};