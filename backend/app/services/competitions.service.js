const crypto = require('crypto');
const moment = require('moment');

const logger = require('../utils/logger.util.js');

const wca = require('../integrations/wca.integration.js');
const googleForm = require('../integrations/googleForm.integration.js');
const googleDrive = require('../integrations/googleDrive.integration.js');
const contentful = require('../integrations/contentful.integration.js');
const discord = require('../integrations/discord.integration.js');
const authService = require('./auth.service.js');
const competitionsDb = require('../database/competitions.database.js');
const competitionBannerDismissalsDb = require('../database/competitionBannerDismissals.database.js');
const competitionEventsDb = require('../database/competitionEvents.database.js');
const competitionDelegatesDb = require('../database/competitionDelegates.database.js');
const competitionOrganizersDb = require('../database/competitionOrganizers.database.js');
const competitionEquipmentHoldersDb = require('../database/competitionEquipmentHolders.database.js');
const peopleDb = require('../database/people.database.js');
const delegatesDb = require('../database/delegates.database.js');
const discordPingPatternsDb = require('../database/discordPingPatterns.database.js');
const majorChampionships = require('./majorChampionships.service.js');
const { getFullCompetitionDate } = require('../helpers/competitionDates.helper.js');
const { SOUTHEAST_STATES } = require('../helpers/southeastStates.helper.js');
const { chunk } = require('../helpers/chunk.helper.js');
const { groupBy } = require('../helpers/groupBy.helper.js');
const { withResolvedPicture } = require('../helpers/personPicture.helper.js');
const { httpError } = require('../helpers/httpError.helper.js');
const { VALID_EVENT_IDS } = require('../helpers/wcaEvents.helper.js');

// Max rows upserted per statement, to keep each one well under DSQL's
// 3,000-row transaction cap as the retained history keeps growing.
const UPSERT_CHUNK_SIZE = 500;
const MANAGED_COMPETITIONS_MAX_PAGES = 20;
const BULK_REFRESH_COOLDOWN_MINUTES = 5;

// In-process cache of the last getAnnouncedUpcomingCompetitions() result.
// Cleared by invalidateCache() whenever a write changes the store, so repeat
// requests between refreshes don't all re-query the database.
let competitionsCache = null;
const competitionsCacheInstanceId = crypto.randomUUID();
let competitionsCacheRevision = 0;

function invalidateCache() {
  competitionsCache = null;
  competitionsCacheRevision++;
}

// Provides a cheap validator for the public competition list without reading its data.
function getAnnouncedUpcomingCompetitionsRevision() {
  return `${competitionsCacheInstanceId}-${competitionsCacheRevision}`;
}

// Merges each comp's event ids with its data.
async function withEventIds(comps) {
  const eventIdsByCompetition = await competitionEventsDb.getEventIdsByCompetition(
    comps.map((comp) => comp.id),
  );
  return comps.map((comp) => ({
    ...comp,
    event_ids: eventIdsByCompetition.get(comp.id) ?? [],
  }));
}

// Public page's announced-only upcoming list, cached since it's hit on every
// page load.
async function getAnnouncedUpcomingCompetitions() {
  if (competitionsCache) {
    logger.debug('Served upcoming competitions from cache.');
    return competitionsCache;
  }

  const comps = await withEventIds(await competitionsDb.getAnnouncedUpcomingCompetitions());
  competitionsCache = comps;
  logger.debug(`Fetched ${comps.length} upcoming competition(s) from the competitions table.`);
  return competitionsCache;
}

// Derives a competition's Competition Planner status from its raw
// wca_competition_id/is_announced fields.
function derivePlannerStatus(comp) {
  if (!comp.wca_competition_id) return 'potential';
  return comp.is_announced ? 'announced' : 'planning';
}

// Competition Planner's full (every status) upcoming list - never cached.
async function getAllUpcomingCompetitionsForPlanner() {
  const comps = await withEventIds(await competitionsDb.getAllUpcomingCompetitionsForPlanner());
  const competitionIds = comps.map((comp) => comp.id);

  const delegateRowsByCompetition = groupBy(
    await competitionDelegatesDb.listForCompetitions(competitionIds),
    'competition_id',
  );
  const organizerRowsByCompetition = groupBy(
    await competitionOrganizersDb.listForCompetitions(competitionIds),
    'competition_id',
  );
  const equipmentRowsByCompetition = groupBy(
    await competitionEquipmentHoldersDb.listForCompetitions(competitionIds),
    'competition_id',
  );

  const toPerson = (row) => {
    const resolved = withResolvedPicture(row);
    return {
      peopleId: resolved.people_id,
      name: resolved.name,
      wcaId: resolved.wca_id,
      pictureUrl: resolved.picture_url,
      thumbnailCropX: resolved.thumbnail_crop_x,
      thumbnailCropY: resolved.thumbnail_crop_y,
      thumbnailCropW: resolved.thumbnail_crop_w,
      thumbnailCropH: resolved.thumbnail_crop_h,
      isLead: resolved.is_lead,
    };
  };

  // An equipment holder's people_id is null for the plain "Other" option,
  // which never resolves to a person.
  const toEquipmentHolder = (row) =>
    row.people_id === null ? { peopleId: null } : toPerson(row);

  return comps.map((comp) => ({
    ...comp,
    status: derivePlannerStatus(comp),
    delegates: (delegateRowsByCompetition.get(comp.id) ?? []).map(toPerson),
    organizers: (organizerRowsByCompetition.get(comp.id) ?? []).map(toPerson),
    equipmentHolders: (equipmentRowsByCompetition.get(comp.id) ?? []).map(toEquipmentHolder),
  }));
}

// Appends the end date's year to a hand-entered name that has no 4-digit
// year in it already.
function withYearInName(name, endDate) {
  if (/\d{4}/.test(name)) return name;
  return `${name.trim()} ${moment(endDate).format('YYYY')}`;
}

// Throws if any id in `peopleIds` doesn't exist as a `people` row.
async function assertPeopleExist(peopleIds, label) {
  if (!peopleIds.length) return;
  const existingIds = await peopleDb.findExistingIds(peopleIds);
  const missing = peopleIds.filter((id) => !existingIds.includes(id));
  if (missing.length) {
    throw httpError(400, `${label} includes unknown person id(s): ${missing.join(', ')}`);
  }
}

// Equipment holders are drawn from the Delegate roster generally (plus the
// plain "Other" option, a null entry).
async function assertEquipmentHoldersAreDelegates(equipmentPeopleIds) {
  const peopleIds = equipmentPeopleIds.filter((peopleId) => peopleId !== null);
  if (!peopleIds.length) return;
  const openDelegatePeopleIds = await delegatesDb.findOpenDelegatePeopleIds(peopleIds);
  const invalid = peopleIds.some((peopleId) => !openDelegatePeopleIds.includes(peopleId));
  if (invalid) {
    throw httpError(400, 'Equipment holders must be current Delegates.');
  }
}

// Throws if any id in `eventIds` isn't a real WCA event id.
function assertValidEventIds(eventIds) {
  const invalid = eventIds.filter((eventId) => !VALID_EVENT_IDS.includes(eventId));
  if (invalid.length) {
    throw httpError(400, `Invalid event id(s): ${invalid.join(', ')}`);
  }
}

// WCA competitions need at least this many days' notice - a hand-entered
// Planner start date earlier than that isn't a realistic competition date.
const MIN_START_DATE_LEAD_DAYS = 28;

// Parse only real calendar dates in the Planner API's YYYY-MM-DD format.
function parsePlannerDate(value, fieldName) {
  const parsed = typeof value === 'string' ? moment.utc(value, 'YYYY-MM-DD', true) : null;
  if (!parsed?.isValid()) {
    throw httpError(400, `${fieldName} must be a valid date in YYYY-MM-DD format.`);
  }
  return parsed;
}

// Validate the date pair before deriving dates or persisting competition fields.
function assertValidPlannerDates(startDate, endDate) {
  const start = parsePlannerDate(startDate, 'Start date');
  const end = parsePlannerDate(endDate, 'End date');
  if (end.isBefore(start, 'day')) {
    throw httpError(400, 'End date must be on or after start date.');
  }
}

// The database column is INTEGER; omitted and null limits both mean unlimited.
function assertValidCompetitorLimit(competitorLimit) {
  if (competitorLimit == null) return;
  if (!Number.isInteger(competitorLimit) || competitorLimit < 0) {
    throw httpError(400, 'Competitor limit must be a non-negative integer.');
  }
}

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

// Remove a year from the competition title and prefix its start month.
function getWcaDriveFolderName(competition) {
  const startDate = moment.utc(competition.start_date, 'YYYY-MM-DD', true);
  if (!startDate.isValid()) {
    const error = new Error('Stored competition start date is invalid; cannot name its WCA Drive folder.');
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
    throw httpError(400, 'The folder must be inside one of the configured WCA Drive category folders.');
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
    const folderLink =
      folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`;
    await competitionsDb.setWcaDriveLink(competitionId, folderLink, folderType);
    return folderLink;
  });
}

// Link, replace, or clear a competition's WCA Drive folder.
async function setCompetitionWcaDriveLink(competitionId, folderLink) {
  const competition = await competitionsDb.getCompetitionById(competitionId);
  if (!competition) throw httpError(404, 'Competition not found.');

  // Removes drive link.
  if (typeof folderLink !== 'string' || !folderLink.trim()) {
    await competitionsDb.setWcaDriveLink(competitionId, null);
    return null;
  }

  return withWcaDriveAction(async () => {
    const { folderLink: normalizedFolderLink, folderType } = await prepareWcaDriveFolder(
      competition,
      folderLink,
    );
    await competitionsDb.setWcaDriveLink(competitionId, normalizedFolderLink, folderType);
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
  if (!competition?.wca_drive_link) return;

  try {
    const requiredFolderType =
      targetFolderType ?? getWcaDriveTargetFolderType(competition);

    // Returns and dies nothing if folder hasnt changed
    if (!forceCheck && competition.wca_drive_folder_type === requiredFolderType) return;

    googleDrive.assertDriveAvailable();
    const { folderLink, folderType } = await prepareWcaDriveFolder(
      competition,
      competition.wca_drive_link,
      requiredFolderType,
    );
    await competitionsDb.setWcaDriveLink(competition.id, folderLink, folderType);
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
    competitions = await competitionsDb.getCompetitionsWithWcaDriveLink();
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

// Throws if `startDate` is less than MIN_START_DATE_LEAD_DAYS out from today.
function assertStartDateFarEnoughOut(startDate) {
  if (moment(startDate).isBefore(moment().add(MIN_START_DATE_LEAD_DAYS, 'days'), 'day')) {
    throw httpError(400, `Start date must be at least ${MIN_START_DATE_LEAD_DAYS} days out.`);
  }
}

// True for a managed WCA competition in a tracked state with enough lead time.
function isEligibleManagedCompetition(comp) {
  const startDate = moment(comp.start_date, 'YYYY-MM-DD', true);
  return (
    !!comp.id &&
    startDate.isValid() &&
    !startDate.isBefore(moment().add(MIN_START_DATE_LEAD_DAYS, 'days'), 'day') &&
    isInSEState(comp)
  );
}

// Matches the Planner's upcoming window, including its one-day timezone grace period.
function isUpcomingCompetition(comp) {
  const endDate = moment(comp.end_date, 'YYYY-MM-DD', true);
  return endDate.isValid() && !endDate.isBefore(moment().subtract(1, 'day'), 'day');
}

// Reads every page of the current Delegate's managed US competitions.
async function fetchManagedWcaCompetitions(
  accessToken,
  peopleId,
  {
    startDate = moment().add(MIN_START_DATE_LEAD_DAYS, 'days').format('YYYY-MM-DD'),
    isEligible = isEligibleManagedCompetition,
  } = {},
) {
  let competitions = [];

  for (let page = 1; page <= MANAGED_COMPETITIONS_MAX_PAGES; page++) {
    let pageData;
    try {
      pageData = await wca.fetchManagedCompetitionsPage({ page, startDate, accessToken });
    } catch (err) {
      if (err.wcaAuthorizationFailure === wca.WCA_MANAGED_COMPETITIONS_UNAUTHORIZED_CODE) {
        await authService.invalidateManageCompetitionsGrant(
          peopleId,
          'managed_competitions_401',
        );
        throw authService.createManageCompetitionsReauthRequiredError();
      }
      throw err;
    }
    competitions = competitions.concat(pageData);

    if (pageData.length < wca.US_COMPETITIONS_PAGE_SIZE) break;
    if (page === MANAGED_COMPETITIONS_MAX_PAGES) {
      logger.warn(
        `Hit the WCA managed competitions pagination cap of ${MANAGED_COMPETITIONS_MAX_PAGES} pages - some competitions may be missing.`,
      );
    }
  }

  return competitions.filter(isEligible);
}

// Lists eligible managed competitions that are not already linked in Planner.
async function getEligibleUnlinkedManagedCompetitions(accessToken, peopleId) {
  const [managedCompetitions, plannerCompetitions] = await Promise.all([
    fetchManagedWcaCompetitions(accessToken, peopleId),
    competitionsDb.getAllUpcomingCompetitionsForPlanner(),
  ]);
  const linkedWcaIds = new Set(
    plannerCompetitions
      .map((comp) => comp.wca_competition_id)
      .filter(Boolean)
      .map(String),
  );

  return managedCompetitions
    .filter((comp) => !linkedWcaIds.has(String(comp.id)))
    .map((comp) => ({
      wca_competition_id: String(comp.id),
      name: comp.name,
      city: comp.city,
      state: getTrackedSEState(comp.city),
      start_date: comp.start_date,
    }));
}

// Supplies auto-detected banners; standalone link choices intentionally keep dismissed ids.
async function getUnannouncedCompetitionBanners(peopleId) {
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) return [];

  const [competitions, dismissedIds] = await Promise.all([
    getEligibleUnlinkedManagedCompetitions(accessToken, peopleId),
    competitionBannerDismissalsDb.listDismissedWcaCompetitionIds(peopleId),
  ]);
  const dismissedIdSet = new Set(dismissedIds.map(String));
  return competitions.filter((comp) => !dismissedIdSet.has(comp.wca_competition_id));
}

// Supplies every eligible unlinked managed competition for the standalone sheet.
async function getUnannouncedCompetitionLinkOptions(peopleId) {
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) return [];
  return getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
}

// Permanently hides one WCA competition banner for this Delegate.
async function dismissUnannouncedCompetition(peopleId, wcaCompetitionId) {
  await competitionBannerDismissalsDb.createDismissal(peopleId, wcaCompetitionId);
}

// Creates a brand-new Planner competition.
async function createCompetition(input) {
  const { name, city, state, startDate, endDate, leadPeopleId } = input;
  if (!name || !city || !state || !startDate || !endDate || !leadPeopleId) {
    throw httpError(400, 'name, city, state, start date, end date, and lead Delegate are required.');
  }
  assertValidPlannerDates(startDate, endDate);
  assertStartDateFarEnoughOut(startDate);
  assertValidCompetitorLimit(input.competitorLimit);

  // Validates Google Drive params.
  if (input.createWcaDriveFolder && input.wcaDriveLink) {
    throw httpError(400, 'Choose either a new WCA Drive folder or an existing folder link.');
  }
  if (input.createWcaDriveFolder || input.wcaDriveLink) {
    try {
      googleDrive.assertDriveAvailable();
      if (input.wcaDriveLink) getWcaDriveFolderId(input.wcaDriveLink);
    } catch (error) {
      rethrowWcaDriveUnavailable(error);
    }
  }

  const delegatePeopleIds = input.delegatePeopleIds ?? [];
  const organizerPeopleIds = input.organizerPeopleIds ?? [];
  const equipmentPeopleIds = input.equipmentPeopleIds ?? [];
  const eventIds = input.eventIds ?? [];
  if (!delegatePeopleIds.includes(leadPeopleId)) {
    throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
  }
  await assertPeopleExist(delegatePeopleIds, 'Delegates');
  await assertPeopleExist(organizerPeopleIds, 'Organizers');
  await assertEquipmentHoldersAreDelegates(equipmentPeopleIds);
  assertValidEventIds(eventIds);

  const id = crypto.randomUUID();
  await competitionsDb.createPlannerCompetition({
    id,
    name: withYearInName(name, endDate),
    city: `${city}, ${state}`,
    state,
    venueAddress: input.venueAddress,
    venueDetails: input.venueDetails,
    venue: input.venue,
    venueUrl: input.venueUrl,
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
    startDate,
    endDate,
    fullDate: getFullCompetitionDate(startDate, endDate),
    competitorLimit: input.competitorLimit,
  });

  await competitionDelegatesDb.replaceDelegatesForCompetition(
    id,
    delegatePeopleIds.map((peopleId) => ({
      peopleId,
      isLead: peopleId === leadPeopleId,
    })),
  );
  await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
  await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(id, equipmentPeopleIds);
  await competitionEventsDb.replaceEventIds([{ id, event_ids: eventIds }]);

  if (input.createWcaDriveFolder) {
    await createWcaDriveFolderForCompetition(id);
  } else if (input.wcaDriveLink) {
    await setCompetitionWcaDriveLink(id, input.wcaDriveLink);
  }

  logger.debug(`Created Planner competition "${name}" (id ${id}), led by people_id ${leadPeopleId}.`);
  return id;
}


// Updates an existing Planner competition, enforcing the status-gated
// editability rules: hand-entered fields and Delegates/Organizers are only
// writable while still Potential (unsynced).
async function updateCompetition(id, input) {
  const comp = await competitionsDb.getCompetitionById(id);
  if (!comp) throw httpError(404, 'Competition not found.');
  const status = derivePlannerStatus(comp);
  const hasDriveLinkUpdate = Object.hasOwn(input, 'wcaDriveLink'); // true even if null.
  if (hasDriveLinkUpdate && input.wcaDriveLink) {
    try {
      googleDrive.assertDriveAvailable();
      getWcaDriveFolderId(input.wcaDriveLink);
    } catch (error) {
      rethrowWcaDriveUnavailable(error);
    }
  }

  if (!input.leadPeopleId) {
    throw httpError(400, 'Lead Delegate is required.');
  }

  const equipmentPeopleIds = input.equipmentPeopleIds ?? [];
  await assertEquipmentHoldersAreDelegates(equipmentPeopleIds);

  let updatedCompetition = null;
  if (status === 'potential') {
    const { name, city, state, startDate, endDate } = input;
    if (!name || !city || !state || !startDate || !endDate) {
      throw httpError(400, 'name, city, state, start date, and end date are required.');
    }
    assertValidPlannerDates(startDate, endDate);
    assertStartDateFarEnoughOut(startDate);
    assertValidCompetitorLimit(input.competitorLimit);

    const delegatePeopleIds = input.delegatePeopleIds ?? [];
    const organizerPeopleIds = input.organizerPeopleIds ?? [];
    const eventIds = input.eventIds ?? [];
    if (!delegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await assertPeopleExist(delegatePeopleIds, 'Delegates');
    await assertPeopleExist(organizerPeopleIds, 'Organizers');
    assertValidEventIds(eventIds);

    const fullDate = getFullCompetitionDate(input.startDate, input.endDate);
    updatedCompetition = await competitionsDb.updatePlannerCompetitionFields(id, {
      name: withYearInName(input.name, input.endDate),
      city: `${input.city}, ${input.state}`,
      state: input.state,
      venueAddress: input.venueAddress,
      venueDetails: input.venueDetails,
      venue: input.venue,
      venueUrl: input.venueUrl,
      latitudeDegrees: input.latitudeDegrees,
      longitudeDegrees: input.longitudeDegrees,
      startDate: input.startDate,
      endDate: input.endDate,
      fullDate,
      competitorLimit: input.competitorLimit,
    });
    await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
    await competitionDelegatesDb.replaceDelegatesForCompetition(
      id,
      delegatePeopleIds.map((peopleId) => ({
        peopleId,
        isLead: peopleId === input.leadPeopleId,
      })),
    );
    await competitionEventsDb.replaceEventIds([{ id, event_ids: eventIds }]);
  } else {
    // Once linked, membership is sync-owned and only the lead flag changes
    // here (setLead), never which rows exist.
    const currentDelegatePeopleIds = (await competitionDelegatesDb.listForCompetitions([id])).map(
      (row) => row.people_id,
    );
    if (!currentDelegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await competitionDelegatesDb.setLead(id, input.leadPeopleId);
  }

  // Equipment stays editable regardless of status - Planner-owned, never synced.
  await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(id, equipmentPeopleIds);

  if (hasDriveLinkUpdate) {
    await setCompetitionWcaDriveLink(id, input.wcaDriveLink);
  } else if (
    comp.wca_drive_link &&
    updatedCompetition &&
    getWcaDriveFolderName(comp) !== getWcaDriveFolderName(updatedCompetition)
  ) {
    await syncWcaDriveFolderBestEffort(updatedCompetition, 'competition update', undefined, true);
  }

  logger.debug(`Updated Planner competition (id ${id}, status ${status}).`);
}

// Deletes a Planner competition - never allowed once Announced.
async function deleteCompetition(id) {
  const comp = await competitionsDb.getCompetitionById(id);
  if (!comp) throw httpError(404, 'Competition not found.');
  if (derivePlannerStatus(comp) === 'announced') {
    throw httpError(400, 'An announced competition can never be deleted.');
  }

  await syncWcaDriveFolderBestEffort(comp, 'Planner competition deletion', 'abandoned', true);
  await competitionsDb.deletePlannerCompetition(id);
  logger.debug(`Deleted Planner competition (id ${id}).`);
}

// Resolves a WCA Person sub-resource into a `people` row id.
async function resolvePersonId(wcaPerson) {
  const person = await peopleDb.findOrCreatePersonFromWcaProfile({
    wcaId: wcaPerson.wca_id ?? null,
    wcaUserId: String(wcaPerson.id),
    name: wcaPerson.name,
    pictureUrl: wcaPerson.avatar?.thumb_url ?? null,
  });
  return person.id;
}

// Syncs one competition's delegates/organizers from the already-fetched WCA
// data. WCA's API exposes no lead-delegate signal, `existingIsLeadByPeopleId` 
// carries forward any manual pick for a delegate who's still on the competition.
async function syncDelegatesAndOrganizers({ id, delegates, organizers, existingIsLeadByPeopleId }) {
  const delegatePeopleIds = await Promise.all((delegates ?? []).map(resolvePersonId));
  const organizerPeopleIds = await Promise.all((organizers ?? []).map(resolvePersonId));

  await competitionDelegatesDb.replaceDelegatesForCompetition(
    id,
    delegatePeopleIds.map((peopleId) => ({
      peopleId,
      isLead: existingIsLeadByPeopleId.get(peopleId) ?? false,
    })),
  );
  await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
}

// Links an eligible managed WCA competition to an existing Potential row or creates a new row.
async function linkManagedCompetitionToPlanner({
  peopleId,
  wcaCompetitionId,
  plannerCompetitionId,
  createWcaDriveFolder,
  wcaDriveLink,
}) {
  // Validate requested Drive setup before linking the WCA competition.
  if (createWcaDriveFolder && wcaDriveLink) {
    throw httpError(400, 'Choose either a new WCA Drive folder or an existing folder link.');
  }
  if (createWcaDriveFolder || wcaDriveLink) {
    try {
      googleDrive.assertDriveAvailable();
      if (wcaDriveLink) getWcaDriveFolderId(wcaDriveLink);
    } catch (error) {
      rethrowWcaDriveUnavailable(error);
    }
  }

  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) {
    throw httpError(403, 'WCA manage_competitions access is required to link a competition.');
  }

  const eligibleCompetitions = await getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
  if (!eligibleCompetitions.some((comp) => comp.wca_competition_id === String(wcaCompetitionId))) {
    throw httpError(400, 'This WCA competition is not available to link.');
  }

  let existingIsLeadByPeopleId = new Map();
  if (plannerCompetitionId) {
    const plannerCompetition = await competitionsDb.getCompetitionById(plannerCompetitionId);
    if (!plannerCompetition) throw httpError(404, 'Competition not found.');
    if (derivePlannerStatus(plannerCompetition) !== 'potential') {
      throw httpError(400, 'Only a Potential competition can be linked to WCA.');
    }

    const existingDelegateRows = await competitionDelegatesDb.listForCompetitions([
      plannerCompetitionId,
    ]);
    existingIsLeadByPeopleId = new Map(
      existingDelegateRows.map((row) => [row.people_id, row.is_lead]),
    );
  }

  // Fetch and validate the selected WCA record before the first Planner write.
  const wcaCompetition = await wca.fetchCompetitionById(String(wcaCompetitionId), { accessToken });
  if (!isEligibleManagedCompetition(wcaCompetition)) {
    throw httpError(400, 'This WCA competition is no longer eligible to link.');
  }

  // Fetch registration data to add to the competition.
  const competitionsToFormat = filterCompetitionsToTrackedSEStates([wcaCompetition]);
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(competitionsToFormat, {
    accessToken,
    adminCompetitionIds: new Set([String(wcaCompetition.id)]),
  });
  const [formattedCompetition] = formatCompetitionData(competitionsToFormat, [], registrationDataByWcaId);
  if (!formattedCompetition) {
    throw httpError(400, 'This WCA competition could not be prepared for Planner.');
  }
  formattedCompetition.is_announced = false;

  let competitionId = plannerCompetitionId;
  if (competitionId) {
    const linked = await competitionsDb.linkPlannerCompetitionToWca(
      competitionId,
      formattedCompetition,
    );
    if (!linked) {
      throw httpError(409, 'This Potential competition has already been linked.');
    }
  } else {
    competitionId = await competitionsDb.createPlannerCompetitionLinkedToWca(formattedCompetition);
  }

  await competitionEventsDb.replaceEventIds([
    { id: competitionId, event_ids: formattedCompetition.event_ids ?? [] },
  ]);
  await syncDelegatesAndOrganizers({
    id: competitionId,
    delegates: formattedCompetition.delegates,
    organizers: formattedCompetition.organizers,
    existingIsLeadByPeopleId,
  });

  if (createWcaDriveFolder) {
    await createWcaDriveFolderForCompetition(competitionId);
  } else if (wcaDriveLink) {
    await setCompetitionWcaDriveLink(competitionId, wcaDriveLink);
  } else {
    const linkedCompetition = await competitionsDb.getCompetitionById(competitionId);
    await syncWcaDriveFolderBestEffort(
      linkedCompetition,
      'WCA competition linking',
      undefined,
      true,
    );
  }

  return competitionId;
}

// Upserts `comps` in chunks under DSQL's row cap, returning the ids newly
// inserted across every chunk. On first-time population, public competitions
// are stamped as posted to avoid a Discord backlog; unannounced rows stay pending.
// Returns linked competitions whose folder names may need updating.
async function upsertCompetitions(comps) {
  if (!comps.length) {
    return { insertedIds: [], wcaDriveFolderNameChangedIds: [] };
  }

  try {
    const wasEmpty = (await competitionsDb.getCompetitionsCount()) === 0;

    let insertedIds = [];
    let allBatchWithIds = [];
    let wcaDriveFolderNameChangedIds = [];
    for (const batch of chunk(comps, UPSERT_CHUNK_SIZE)) {
      const result = await competitionsDb.upsertCompetitionsBatch(batch);
      insertedIds = insertedIds.concat(result.insertedIds);
      allBatchWithIds = allBatchWithIds.concat(result.batchWithIds);
      wcaDriveFolderNameChangedIds = wcaDriveFolderNameChangedIds.concat(
        result.wcaDriveFolderNameChangedIds,
      );
    }

    await competitionEventsDb.replaceEventIds(
      allBatchWithIds.map(({ id, comp }) => ({ id, event_ids: comp.event_ids })),
    );

    // Delegate/organizer sync - Existing delegates (for carrying forward any 
    // manual lead pick) are fetched.
    const linkedBatchWithIds = allBatchWithIds.filter(({ comp }) => comp.wca_competition_id);
    const existingDelegateRowsByCompetition = groupBy(
      await competitionDelegatesDb.listForCompetitions(linkedBatchWithIds.map(({ id }) => id)),
      'competition_id',
    );
    for (const { id, comp } of linkedBatchWithIds) {
      const existingIsLeadByPeopleId = new Map(
        (existingDelegateRowsByCompetition.get(id) ?? []).map((row) => [
          row.people_id,
          row.is_lead,
        ]),
      );
      await syncDelegatesAndOrganizers({
        id,
        delegates: comp.delegates,
        organizers: comp.organizers,
        existingIsLeadByPeopleId,
      });
    }

    invalidateCache();

    if (wasEmpty) {
      const insertedIdSet = new Set(insertedIds);
      const announcedInsertedIds = allBatchWithIds
        .filter(({ id, comp }) => insertedIdSet.has(id) && comp.is_announced)
        .map(({ id }) => id);
      if (announcedInsertedIds.length) {
        await competitionsDb.markAnnounced(announcedInsertedIds);
      }
      logger.debug(
        `Upserted ${comps.length} competitions in the competitions table (first-time population).`,
      );
      return { insertedIds, wcaDriveFolderNameChangedIds: [] };
    }

    logger.debug(
      `Upserted ${comps.length} competitions in the competitions table (${insertedIds.length} newly inserted).`,
    );
    return { insertedIds, wcaDriveFolderNameChangedIds };
  } catch (err) {
    logger.error(`Failed to upsert ${comps.length} competitions in the competitions table: `, err);
    throw err;
  }
}

// Refetches competitions from WCA if the stored data is stale.
async function fetchCompetitions() {
  const lastBulkRefreshAt = await competitionsDb.getLastBulkRefreshAt();

  if (
    !lastBulkRefreshAt ||
    lastBulkRefreshAt.isBefore(moment().set('hour', 0).set('minute', 0).set('second', 0))
  ) {
    logger.info('Stored competitions data is stale - fetching from WCA.');
    await runCoordinatedCompetitionRefresh();
    logger.info('Successfully fetched competitions from WCA.');
  } else {
    logger.info('Stored competitions data is already fresh - skipping fetch.');
  }
}

// Posts every competition in `competitions` to Discord (chunked/rate-limit-safe
// - see discord.js's postToDiscordInChunks). A competition whose wca_competition_id
// matches any stored pattern gets an @everyone ping instead of its state's
// role ping. Only ids whose post succeeds are marked announced - anything
// still failing after discord.js's retries is left unannounced so it's
// retried on the next refresh.
async function postCompetitionsToDiscord(competitions) {
  const patterns = await discordPingPatternsDb.getPatterns();
  const usesEveryonePing = (wcaCompetitionId) =>
    patterns.some((pattern) =>
      discordPingPatternsDb.matchesIdPattern(wcaCompetitionId, pattern.id_pattern),
    );

  return discord.postToDiscordInChunks(sortForDiscordPosting(competitions), {
    postFn: (competition) =>
      discord.postCompetitionInDiscord(
        { ...competition, id: competition.wca_competition_id },
        {
          pingOverride: usesEveryonePing(competition.wca_competition_id) ? 'everyone' : undefined,
        },
      ),
    markAnnouncedFn: (ids) => competitionsDb.markAnnounced(ids),
    getId: (competition) => competition.id,
  });
}

// Orders competitions for a Discord posting run: grouped by state first, then
// by start_date ascending, then alphabetically by name.
function sortForDiscordPosting(competitions) {
  const stateOrder = Object.keys(discord.stateTagIds);
  return [...competitions].sort((a, b) => {
    const stateDiff = stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state);
    if (stateDiff !== 0) {
      return stateDiff;
    }
    const dateDiff = moment(a.start_date).diff(moment(b.start_date));
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

// Claims the global refresh slot and records only successful full refreshes.
async function runCoordinatedCompetitionRefresh(actor) {
  const cooldownCutoff = moment().subtract(BULK_REFRESH_COOLDOWN_MINUTES, 'minutes');
  const refreshState = await competitionsDb.tryStartBulkRefresh(cooldownCutoff.toDate());

  if (!refreshState.started) {
    const reason = refreshState.isRunning
      ? 'A competition refresh is already in progress.'
      : 'Competitions were refreshed less than 5 minutes ago.';
    const error = httpError(409, reason);
    error.refreshState = refreshState;
    throw error;
  }

  try {
    const result = await refreshCompetitionsFromWCA(actor);
    if (result.competitions.length) {
      await competitionsDb.completeBulkRefresh(moment(), refreshState.bulkRefreshStartedAt);
    } else {
      await competitionsDb.releaseBulkRefresh(refreshState.bulkRefreshStartedAt);
    }
    return result;
  } catch (err) {
    await competitionsDb.releaseBulkRefresh(refreshState.bulkRefreshStartedAt);
    throw err;
  }
}

// Refreshes one existing Planner row without taking the global bulk-refresh slot.
async function refreshCompetitionFromWCA(competitionId, actor = {}) {
  const plannerCompetition = await competitionsDb.getCompetitionById(competitionId);
  if (!plannerCompetition || !plannerCompetition.wca_competition_id) {
    throw httpError(404, 'WCA-linked competition not found.');
  }

  const { peopleId } = actor;
  const [isAssignedDelegate, isAssignedOrganizer] = peopleId
    ? await Promise.all([
        competitionDelegatesDb.isDelegateOnCompetition(peopleId, plannerCompetition.id),
        competitionOrganizersDb.isOrganizerOnCompetition(peopleId, plannerCompetition.id),
      ])
    : [false, false];
  const isAssignedManager = isAssignedDelegate || isAssignedOrganizer;
  let accessToken;

  // Unannounced competitions can only be refreshed by an assigned manager.
  if (!plannerCompetition.is_announced) {
    if (!isAssignedManager) {
      throw httpError(403, 'Only an assigned Delegate or Organizer can refresh this competition.');
    }

    accessToken = await authService.getValidAccessTokenForPerson(peopleId);
    if (!accessToken) {
      throw httpError(403, 'WCA manage_competitions access is required to refresh this competition.');
    }
  } else if (isAssignedManager && peopleId) {
    try {
      accessToken = await authService.getValidAccessTokenForPerson(peopleId);
    } catch {
      // Public competition and registration data can still refresh without the private token.
      accessToken = null;
    }
  }

  const wcaCompetition = await wca.fetchCompetitionById(
    String(plannerCompetition.wca_competition_id),
    accessToken ? { accessToken } : undefined,
  );

  const competitionsToFormat = filterCompetitionsToTrackedSEStates([wcaCompetition]);
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(competitionsToFormat, {
    accessToken,
    adminCompetitionIds: isAssignedManager ? new Set([String(wcaCompetition.id)]) : new Set(),
  });
  const [competition] = formatCompetitionData(competitionsToFormat, [], registrationDataByWcaId);
  if (!competition) {
    throw httpError(400, 'Competition is no longer in a tracked state.');
  }

  competition.is_announced = Boolean(wcaCompetition.announced_at);
  competition.is_in_volunteer_application = plannerCompetition.is_in_volunteer_application;
  await upsertCompetitions([competition]);
  const refreshedCompetition = await competitionsDb.getCompetitionById(plannerCompetition.id);
  await syncWcaDriveFolderBestEffort(refreshedCompetition, 'single competition refresh', undefined, true);

  return { ...competition, id: plannerCompetition.id };
}

// Fetches and persists the full competition list from WCA and supporting sources.
async function refreshCompetitionsFromWCA(actor) {
  // WCA paginates at per_page results; loop through successive pages
  // (stopping once a page returns fewer than per_page results, the
  // standard "last page" signal) so a true count over 1000 doesn't
  // silently drop competitions. Capped at maxPages (20,000 competitions)
  // as a guard against an unexpected API change causing an infinite loop.
  const maxPages = 20;
  let wcaCompetitions = [];
  for (let page = 1; page <= maxPages; page++) {
    const pageData = await wca.fetchUSCompetitionsPage({
      page,
      startDate: moment().add(-1, 'day').format('YYYY-MM-DD'),
    });

    wcaCompetitions = wcaCompetitions.concat(pageData);

    if (pageData.length < wca.US_COMPETITIONS_PAGE_SIZE) {
      // Short page means there's nothing more to fetch.
      break;
    }

    if (page === maxPages) {
      logger.warn(
        `Hit the WCA competitions pagination cap of ${maxPages} pages - some competitions may be missing.`,
      );
    }
  }

  const publicWcaCompetitionIds = new Set(
    wcaCompetitions.map((competition) => String(competition.id)),
  );

  // Get managed competitions and registration-admin access for assigned organizers/delegates.
  let managedOnlyCompetitions = [];
  const peopleId = actor?.peopleId;
  let accessToken;
  let privateDataRefreshFailed = false;
  let adminRegistrationCompetitionIds = new Set();
  if (peopleId) {
    const plannerCompetitions = await competitionsDb.getAllUpcomingCompetitionsForPlanner();
    const plannerCompetitionIds = plannerCompetitions.map((competition) => competition.id);
    const [delegateRows, organizerRows] = await Promise.all([
      competitionDelegatesDb.listForCompetitions(plannerCompetitionIds),
      competitionOrganizersDb.listForCompetitions(plannerCompetitionIds),
    ]);
    const assignedPlannerCompetitionIds = new Set(
      [...delegateRows, ...organizerRows]
        .filter((row) => String(row.people_id) === String(peopleId))
        .map((row) => String(row.competition_id)),
    );
    const assignedPlannerCompetitions = plannerCompetitions.filter((competition) =>
      assignedPlannerCompetitionIds.has(String(competition.id)),
    );
    adminRegistrationCompetitionIds = new Set(
      assignedPlannerCompetitions
        .filter(
          (competition) =>
            competition.wca_competition_id &&
            !moment.utc(competition.registration_open).isAfter(moment.now()),
        )
        .map((competition) => String(competition.wca_competition_id)),
    );

    // Only fetch unannounced WCA competitions assigned to this caller.
    const managedPlannerCompetitionIds = new Set(
      assignedPlannerCompetitions
        .filter((competition) => !competition.is_announced && competition.wca_competition_id)
        .map((competition) => String(competition.wca_competition_id)),
    );

    // Fetch Access Token
    if (adminRegistrationCompetitionIds.size || managedPlannerCompetitionIds.size) {
      try {
        accessToken = await authService.getValidAccessTokenForPerson(peopleId);
      } catch {
        privateDataRefreshFailed = true;
      }
      if (!accessToken) privateDataRefreshFailed = true;
    }

    if (managedPlannerCompetitionIds.size && accessToken) {
      try {
        const managedCompetitions = await fetchManagedWcaCompetitions(accessToken, peopleId, {
          startDate: moment().subtract(1, 'day').format('YYYY-MM-DD'),
          isEligible: (competition) =>
            isUpcomingCompetition(competition) && isInSEState(competition),
        });
        managedOnlyCompetitions = managedCompetitions.filter(
          (competition) =>
            managedPlannerCompetitionIds.has(String(competition.id)) &&
            !publicWcaCompetitionIds.has(String(competition.id)),
        );
      } catch {
        privateDataRefreshFailed = true;
      }
    }
  }

  const managedOnlyCompetitionIds = new Set(
    managedOnlyCompetitions.map((competition) => String(competition.id)),
  );
  wcaCompetitions = wcaCompetitions.concat(managedOnlyCompetitions);

  // fetch manual competitions from Contentful. Isolated in its own
  // try/catch so a Contentful outage doesn't block the WCA-only data from
  // being formatted and saved below - it just means no manually-added
  // competitions are merged in for this cycle.
  let contentfulEntries;
  try {
    contentfulEntries = await contentful.getContentfulCompetitions();
  } catch {
    contentfulEntries = { items: [] };
  }

  // Guard against a malformed/missing `items` field (a Contentful response
  // shape break).
  if (!Array.isArray(contentfulEntries.items)) {
    logger.warn('Contentful competitions response has no items array, treating as empty.');
    contentfulEntries = { items: [] };
  }

  let contentfulCompetitions = await Promise.all(
    contentfulEntries.items.map(async (contentfulComp) => {
      // Skip entries missing the fields this merge relies on, instead of
      // crashing the whole fetch cycle over one malformed Contentful entry.
      if (!contentfulComp.fields || !contentfulComp.fields.id || !contentfulComp.fields.name) {
        logger.warn(
          `Skipping malformed Contentful competition entry (sys id: ${contentfulComp.sys && contentfulComp.sys.id}) - missing fields.id or fields.name.`,
        );
        return null;
      }

      // fetch info on contentful competition from WCA
      const wcaCompetition = await getWCACompetition(wcaCompetitions, contentfulComp.fields.id);

      // Drop this manual competition entirely if its WCA lookup failed
      if (!wcaCompetition) {
        logger.warn(
          `Dropping manual competition "${contentfulComp.fields.name}" (${contentfulComp.fields.id}) - WCA lookup failed.`,
        );
        return null;
      }

      logger.debug(
        `Merged manual competition "${contentfulComp.fields.name}" (${contentfulComp.fields.id}) from Contentful.`,
      );

      return applyContentfulCompetitionOverrides(wcaCompetition, contentfulComp);
    }),
  );

  // Filter out competitions whose WCA lookup failed, then past competitions
  contentfulCompetitions = contentfulCompetitions
    .filter((comp) => comp)
    .filter(isUpcomingCompetition);

  // fetch competitions with a volunteer application
  let competitionsWithVolunteerApp = await googleForm.getCompetitionsInVolunteerForm();

  const patterns = await discordPingPatternsDb.getPatterns();
  const matchesDiscordPingPattern = (competitionId) =>
    patterns.some((pattern) =>
      discordPingPatternsDb.matchesIdPattern(competitionId, pattern.id_pattern),
    );

  // Nats/NAC/Worlds are usually held outside the tracked SE states, so
  // they're normally Discord-only and tracked separately rather than ever reaching the public
  // competitions page. But any of them CAN land in an SE state - when that happens it should
  // still show up on the public page like any other SE competition, just
  // with an @everyone ping instead of its state's role ping.
  const seHostedPatternMatchIds = new Set(
    wcaCompetitions
      .filter((comp) => matchesDiscordPingPattern(comp.id) && isInSEState(comp))
      .map((comp) => comp.id),
  );
  const majorChampionshipDiscordFailures = await majorChampionships.refreshMajorChampionships(
    wcaCompetitions,
    patterns,
    seHostedPatternMatchIds,
  );

  // Fetch registration data before formatting the WCA competition records.
  const competitionsToFormat = filterCompetitionsToTrackedSEStates(
    wcaCompetitions.concat(contentfulCompetitions),
  );
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(competitionsToFormat, {
    accessToken,
    adminCompetitionIds: adminRegistrationCompetitionIds,
  });
  privateDataRefreshFailed ||= [...registrationDataByWcaId.values()].some(
    (registrationData) => registrationData.adminRegistrationFetchFailed,
  );
  const comps = formatCompetitionData(
    competitionsToFormat,
    competitionsWithVolunteerApp,
    registrationDataByWcaId,
  );

  // overwrite is_announced of the private managed only competitions
  for (const comp of comps) {
    if (managedOnlyCompetitionIds.has(String(comp.wca_competition_id))) {
      comp.is_announced = false;
    }
  }

  let discordPostFailures = [...majorChampionshipDiscordFailures];
  let nameChangedDriveFolderIds = [];
  if (comps && comps.length) {
    logger.debug(`Formatted ${comps.length} competitions for the public list.`);

    // Upsert into the database. upsertCompetitions handles the cold-start
    // case internally (stamping a first-time population as already
    // announced).
    const upsertResult = await upsertCompetitions(comps);
    nameChangedDriveFolderIds = upsertResult.wcaDriveFolderNameChangedIds;

    // Post pending competitions on Discord.
    const competitionsPendingDiscordAnnouncement = await withEventIds(
      (await competitionsDb.getCompetitionsPendingDiscordAnnouncement()).filter(
        (competition) =>
          !managedOnlyCompetitionIds.has(String(competition.wca_competition_id)),
      ),
    );
    if (competitionsPendingDiscordAnnouncement.length) {
      discordPostFailures = discordPostFailures.concat(
        await postCompetitionsToDiscord(competitionsPendingDiscordAnnouncement),
      );
    }

    // Only recorded on a non-empty result - an empty result is more likely a
    // WCA API glitch than a genuine zero-competition period in these states,
    // so it's treated as an unconfirmed check rather than a successful one.
    // This keeps update-competitions' rate limit and fetchCompetitions'
    // staleness check retrying instead of going stale on bad data.
    invalidateCache();
  } else {
    logger.warn('There are no competitions!');
  }

  // Sync WCA Drive Folders
  await syncAllWcaDriveFoldersBestEffort(nameChangedDriveFolderIds);

  return { competitions: comps, discordPostFailures, privateDataRefreshFailed };
}

// Applies the editorial fields configured for a WCA competition in Contentful.
function applyContentfulCompetitionOverrides(wcaCompetition, contentfulCompetition) {
  const fields = contentfulCompetition.fields;
  return {
    ...wcaCompetition,
    name: fields.name,
    city: fields.city,
    venue_address: fields.venueAddress,
    venue_details: fields.venueDetails,
    latitude_degrees: fields.latitudeDegrees,
    longitude_degrees: fields.longitudeDegrees,
    country_iso2: fields.countryIso2,
    competitor_limit: fields.competitorLimit,
  };
}

// Filters `comps` down to competitions in the tracked SE states and maps
// each one to the trimmed/enriched object shape used by the database layer
// and frontend
function formatCompetitionData(
  comps,
  competitionsWithVolunteerApp,
  registrationDataByWcaId,
) {
  return comps
    // Sort by date.
    .sort((a, b) => (moment(a.start_date).isBefore(b.start_date) ? -1 : 1))

    // Create extra fields for competition data and strip out unnecessary data.
    .map((competition) => {
      const registrationData = registrationDataByWcaId.get(String(competition.id));
      return {
        url: competition.url,
        wca_competition_id: competition.id,
        name: competition.name,
        website: competition.website,
        city: competition.city,
        venue_address: competition.venue_address,
        venue_details: competition.venue_details,
        latitude_degrees: competition.latitude_degrees,
        longitude_degrees: competition.longitude_degrees,
        country_iso2: competition.country_iso2,
        start_date: competition.start_date,
        registration_open: competition.registration_open,
        registration_close: competition.registration_close,
        end_date: competition.end_date,
        competitor_limit: competition.competitor_limit,
        event_ids: competition.event_ids,
        delegates: competition.delegates,
        organizers: competition.organizers,
        venue: getCompetitionVenueName(competition.venue),
        venue_url: getCompetitionVenueUrl(competition.venue),
        state: getStateFromCity(competition.city),
        is_in_volunteer_application: competitionsWithVolunteerApp.includes(competition.name),
        accepted_registrations: registrationData?.acceptedRegistrations ?? 0,
        waiting_list_count: registrationData?.waitingListCount ?? null,
        waiting_list_count_updated_at: registrationData?.waitingListCountUpdatedAt ?? null,
        full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
        // WCA's announced_at timestamp determines whether this is public yet.
        is_announced: Boolean(competition.announced_at),
      };
    });
}

// Keeps only competitions whose city belongs to a tracked Southeast state.
function filterCompetitionsToTrackedSEStates(competitions) {
  return competitions.filter(isInSEState);
}

// Fetches registration counts, using the admin endpoint only when the caller has an assigned token.
async function getRegistrationsFromWCA(competition, accessToken) {
  // Before registration opens there can't be any registrants yet - skip the
  // call rather than hitting WCA for a guaranteed 0.
  if (moment.utc(competition.registration_open).isAfter(moment.now())) {
    return {
      acceptedRegistrations: 0,
      waitingListCount: null,
      waitingListCountUpdatedAt: null,
    };
  }

  let adminRegistrationFetchFailed = false;
  if (accessToken) {
    try {
      const registrations = await wca.fetchCompetitionAdminRegistrations(
        String(competition.id),
        accessToken,
      );
      return {
        acceptedRegistrations: registrations.filter(
          (registration) => registration?.competing?.registration_status === 'accepted',
        ).length,
        waitingListCount: registrations.filter(
          (registration) => registration?.competing?.registration_status === 'waiting_list',
        ).length,
        waitingListCountUpdatedAt: new Date(),
      };
    } catch {
      // The integration logs the admin failure; continue with the public accepted count
      // as a fallback.
      adminRegistrationFetchFailed = true;
    }
  }

  let acceptedRegistrations = 0;
  try {
    acceptedRegistrations = await wca.fetchCompetitionRegistrationsCount(competition.id);
  } catch {
    // The integration logs the public failure; preserve the refresh flow with a zero result.
  }
  return {
    acceptedRegistrations,
    waitingListCount: null,
    waitingListCountUpdatedAt: null,
    adminRegistrationFetchFailed,
  };
}

// Fetches counts at the call site so competition formatting remains API-independent.
async function fetchRegistrationDataByWcaId(
  competitions,
  { accessToken, adminCompetitionIds = new Set() } = {},
) {
  const entries = await Promise.all(
    competitions.map(async (competition) => {
      const competitionId = String(competition.id);
      const token = adminCompetitionIds.has(competitionId) ? accessToken : undefined;
      return [competitionId, await getRegistrationsFromWCA(competition, token)];
    }),
  );
  return new Map(entries);
}

// Fetches a single competition's information
function getWCACompetition(competitions, competitionId) {
  // chcek if competition is already in the list of fetched competitions
  let wcaCompetition = competitions.find((wcaCompetition) => wcaCompetition.id === competitionId);
  if (wcaCompetition) {
    return Promise.resolve(wcaCompetition);
  } else {
    // fetch competition from WCA - wca.integration.js already logs the failure
    return wca.fetchCompetitionById(competitionId).catch(() => {
      // Signal failure explicitly so callers can drop this competition instead of
      // spreading undefined fields into a broken/incomplete record.
      return null;
    });
  }
}

// Matches a `[name](url)` markdown-style venue link. Greedy captures so an unbalanced
// `)`/`]` inside the name or URL doesn't truncate the match early - this finds the
// *last* `)`/`]` in the string rather than the first.
const VENUE_LINK_PATTERN = /\[(.+)\]\((.+)\)/;

// If Venue includes a hyperlink in markdown format, then strip "text" out of it. ie. [text](url)
// If not, then return Venue name as is
function getCompetitionVenueName(venue) {
  const match = venue && venue.match(VENUE_LINK_PATTERN);
  return match ? match[1] : venue;
}

// If Venue includes a hyperlink in markdown format, then strip "url" out of it. ie. [text](url)
// If not, then return nothing
function getCompetitionVenueUrl(venue) {
  const match = venue && venue.match(VENUE_LINK_PATTERN);
  return match ? match[2] : undefined;
}

// Returns the trimmed segment after the last comma in a WCA/Contentful city string
// (e.g. "Atlanta, Georgia" -> "Georgia")
function getStateFromCity(city) {
  if (!city) {
    return undefined;
  }
  return city.substring(city.lastIndexOf(',') + 1).trim();
}

// Returns the canonical Title-Case tracked-state name if `city`'s parsed state
// matches one of TRACKED_SE_STATES case-insensitively, or undefined otherwise.
function getTrackedSEState(city) {
  const state = getStateFromCity(city);
  return state && SOUTHEAST_STATES.find((tracked) => tracked.toLowerCase() === state.toLowerCase());
}

// True if `comp`'s city is in one of the 6 states SECI tracks.
function isInSEState(comp) {
  return !!getTrackedSEState(comp.city);
}

module.exports = {
  fetchCompetitions,
  runCoordinatedCompetitionRefresh,
  refreshCompetitionFromWCA,
  getAnnouncedUpcomingCompetitions,
  getAnnouncedUpcomingCompetitionsRevision,
  getAllUpcomingCompetitionsForPlanner,
  getUnannouncedCompetitionBanners,
  getUnannouncedCompetitionLinkOptions,
  dismissUnannouncedCompetition,
  linkManagedCompetitionToPlanner,
  createCompetition,
  createWcaDriveFolderForCompetition,
  setCompetitionWcaDriveLink,
  updateCompetition,
  deleteCompetition,
};
