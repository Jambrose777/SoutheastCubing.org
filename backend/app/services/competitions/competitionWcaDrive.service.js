const moment = require('moment');

const logger = require('../../utils/logger.util.js');
const googleDrive = require('../../integrations/googleDrive.integration.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const competitionWcaDriveDb = require('../../database/competitions/competitions-table/competitionWcaDrive.database.js');
const { httpError } = require('../../helpers/httpError.helper.js');

// Convert missing optional Drive setup into the backend's explicit 503 response.
function rethrowWcaDriveUnavailable(error) {
  if (error.code === 'WCA_DRIVE_UNAVAILABLE') {
    throw httpError(
      503,
      'WCA Drive folder actions are unavailable because this environment is not fully configured.',
      'WCA_DRIVE_UNAVAILABLE',
    );
  }
  throw error;
}

// Restrict linked URLs to the standard Google Drive folder URL format.
function getWcaDriveFolderId(folderLink) {
  let parsedUrl;
  try {
    parsedUrl = new URL(folderLink);
  } catch {
    throw httpError(400, 'Enter a valid Google Drive folder link.');
  }

  const segments = parsedUrl.pathname.split('/');
  const folderSegmentIndex = segments.indexOf('folders');
  const folderId = segments[folderSegmentIndex + 1];
  if (parsedUrl.hostname !== 'drive.google.com' || !folderId) {
    throw httpError(400, 'Enter a valid Google Drive folder link.');
  }
  return folderId;
}

// Reject conflicting ways to supply a competition's WCA Drive folder.
function assertWcaDriveOptions({ createWcaDriveFolder, wcaDriveLink }) {
  if (createWcaDriveFolder && wcaDriveLink) {
    throw httpError(400, 'Choose either a new WCA Drive folder or an existing folder link.');
  }
}

// Validate optional Drive setup and a supplied folder link using the established error mapping.
function validateWcaDriveRequest(folderLink) {
  try {
    googleDrive.assertDriveAvailable();
    if (folderLink) getWcaDriveFolderId(folderLink);
  } catch (error) {
    rethrowWcaDriveUnavailable(error);
  }
}

// Remove a year from the competition title and prefix its start month.
function getWcaDriveFolderName(competition) {
  const startDate = moment.utc(competition.start_date, 'YYYY-MM-DD', true);
  if (!startDate.isValid()) {
    const error = new Error(
      'Stored competition start date is invalid; cannot name its WCA Drive folder.',
    );
    error.code = 'WCA_DRIVE_INVALID_COMPETITION_DATE';
    throw error;
  }

  const nameWithoutYear = String(competition.name ?? '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:-]+|[\s,:-]+$/g, '');
  return `${startDate.format('YYYY-MM')} - ${nameWithoutYear}`;
}

// Select the WCA Drive category for the competition's current status and dates.
function getWcaDriveTargetFolderType(competition) {
  if (!competition.wca_competition_id || !competition.is_announced) {
    return 'proposalsInProgress';
  }

  const endDate = moment.utc(competition.end_date, 'YYYY-MM-DD', true);
  if (
    endDate.isValid() &&
    moment.utc().startOf('day').isSameOrAfter(endDate.clone().add(7, 'days').startOf('day'))
  ) {
    return 'past';
  }
  return 'upcoming';
}

// Validate an existing folder, move it into its current category, and normalize its name.
async function prepareWcaDriveFolder(competition, folderLink, targetFolderType) {
  const folderId = getWcaDriveFolderId(folderLink);
  const folderIds = googleDrive.getWcaDriveFolderIds();
  let folder;
  try {
    folder = await googleDrive.getFolder(folderId);
  } catch (error) {
    if ([403, 404].includes(Number(error.code))) {
      throw httpError(400, 'The folder must be accessible to the WCA Drive service account.');
    }
    throw error;
  }

  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw httpError(400, 'The link must point to a Google Drive folder.');
  }

  const categoryFolderIds = [
    folderIds.upcoming,
    folderIds.past,
    folderIds.proposalsInProgress,
    folderIds.abandoned,
  ];
  const currentParentFolderId = folder.parents?.find((parentId) =>
    categoryFolderIds.includes(parentId),
  );
  if (!currentParentFolderId) {
    throw httpError(
      400,
      'The folder must be inside one of the configured WCA Drive category folders.',
    );
  }

  const requiredFolderType = targetFolderType ?? getWcaDriveTargetFolderType(competition);
  const requiredParentFolderId = folderIds[requiredFolderType];
  if (!requiredParentFolderId) {
    throw new Error(`Unknown WCA Drive folder type: ${requiredFolderType}.`);
  }
  if (currentParentFolderId !== requiredParentFolderId) {
    folder = await googleDrive.moveFolder(folderId, currentParentFolderId, requiredParentFolderId);
  }

  const requiredName = getWcaDriveFolderName(competition);
  if (folder.name !== requiredName) {
    folder = await googleDrive.renameFolder(folderId, requiredName);
  }

  return {
    folderId,
    folderLink: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`,
    folderType: requiredFolderType,
  };
}

// Run a direct Drive action and expose unavailable optional setup as HTTP 503.
async function withWcaDriveAction(action) {
  try {
    googleDrive.assertDriveAvailable();
    return await action();
  } catch (error) {
    rethrowWcaDriveUnavailable(error);
  }
}

// Create and persist a new WCA Drive folder for a Planner competition.
async function createWcaDriveFolderForCompetition(competitionId) {
  const competition = await competitionsDb.getCompetitionById(competitionId);
  if (!competition) throw httpError(404, 'Competition not found.');
  if (competition.wca_drive_link) {
    throw httpError(409, 'This competition already has a WCA Drive folder.');
  }

  return withWcaDriveAction(async () => {
    const folderIds = googleDrive.getWcaDriveFolderIds();
    const folderType = getWcaDriveTargetFolderType(competition);
    const parentFolderId = folderIds[folderType];
    const folder = await googleDrive.createFolder(
      getWcaDriveFolderName(competition),
      parentFolderId,
    );
    const folderLink = folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`;
    await competitionWcaDriveDb.setWcaDriveLink(competitionId, folderLink, folderType);
    return folderLink;
  });
}

// Link, replace, or clear a competition's WCA Drive folder.
async function setCompetitionWcaDriveLink(competitionId, folderLink) {
  const competition = await competitionsDb.getCompetitionById(competitionId);
  if (!competition) throw httpError(404, 'Competition not found.');

  // Removes drive link.
  if (typeof folderLink !== 'string' || !folderLink.trim()) {
    await competitionWcaDriveDb.setWcaDriveLink(competitionId, null);
    return null;
  }

  return withWcaDriveAction(async () => {
    const { folderLink: normalizedFolderLink, folderType } = await prepareWcaDriveFolder(
      competition,
      folderLink,
    );
    await competitionWcaDriveDb.setWcaDriveLink(competitionId, normalizedFolderLink, folderType);
    return normalizedFolderLink;
  });
}

// Synchronize a linked folder as best-effort work within a non-Drive operation.
async function syncWcaDriveFolderBestEffort(
  competition,
  context,
  targetFolderType,
  forceCheck = false,
) {
  if (competition?.is_major || !competition?.wca_drive_link) return;

  try {
    const requiredFolderType = targetFolderType ?? getWcaDriveTargetFolderType(competition);

    // Returns and dies nothing if folder hasnt changed
    if (!forceCheck && competition.wca_drive_folder_type === requiredFolderType) return;

    googleDrive.assertDriveAvailable();
    const { folderLink, folderType } = await prepareWcaDriveFolder(
      competition,
      competition.wca_drive_link,
      requiredFolderType,
    );
    await competitionWcaDriveDb.setWcaDriveLink(competition.id, folderLink, folderType);
  } catch (error) {
    if (error.code === 'WCA_DRIVE_UNAVAILABLE') {
      logger.warn(`Skipping WCA Drive folder work during ${context}: ${error.message}`);
    } else if (error.code === 'WCA_DRIVE_INVALID_COMPETITION_DATE') {
      logger.warn(`Skipping WCA Drive folder work during ${context}: ${error.message}`);
    } else if (error.status === 400) {
      logger.warn(`Skipping WCA Drive folder work during ${context}: ${error.message}`);
    }
  }
}

// Reconcile every linked folder, including competitions that have aged out of the upcoming list.
async function syncAllWcaDriveFoldersBestEffort(nameChangedCompetitionIds = []) {
  let competitions;
  try {
    competitions = await competitionWcaDriveDb.getCompetitionsWithWcaDriveLink();
  } catch {
    return;
  }
  if (!competitions.length) return;

  try {
    googleDrive.assertDriveAvailable();
  } catch (error) {
    if (error.code === 'WCA_DRIVE_UNAVAILABLE') {
      logger.warn(`Skipping WCA Drive folder work during competition refresh: ${error.message}`);
    }
    return;
  }

  const nameChangedIds = new Set(nameChangedCompetitionIds);
  for (const competition of competitions) {
    await syncWcaDriveFolderBestEffort(
      competition,
      'competition refresh',
      undefined,
      nameChangedIds.has(competition.id),
    );
  }
}

module.exports = {
  assertWcaDriveOptions,
  validateWcaDriveRequest,
  getWcaDriveFolderId,
  getWcaDriveFolderName,
  createWcaDriveFolderForCompetition,
  setCompetitionWcaDriveLink,
  syncWcaDriveFolderBestEffort,
  syncAllWcaDriveFoldersBestEffort,
};
