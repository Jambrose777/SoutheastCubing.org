const crypto = require('crypto');
const moment = require('moment');

const logger = require('../utils/logger.util.js');

const wca = require('../integrations/wca.integration.js');
const googleForm = require('../integrations/googleForm.integration.js');
const googleDrive = require('../integrations/googleDrive.integration.js');
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

// Checks that a multi-city competition has the required public location data.
function hasCompletePublicMultiCityData(competition) {
  return (
    !!competition.city?.trim() &&
    !!competition.state &&
    !!competition.venue_address?.trim() &&
    !!competition.venue_details?.trim() &&
    !!competition.venue?.trim() &&
    Number.isFinite(competition.latitude_degrees) &&
    Number.isFinite(competition.longitude_degrees) &&
    competition.competitor_limit != null &&
    competition.competitor_limit >= 1
  );
}

// Public page's announced upcoming list, cached since it's hit on every page load.
async function getAnnouncedUpcomingCompetitions() {
  if (competitionsCache) {
    logger.debug('Served upcoming competitions from cache.');
    return competitionsCache;
  }

  const comps = await competitionsDb.getAnnouncedUpcomingCompetitions();
  const publicCompetitions = comps.filter(
    (competition) =>
      !competition.is_multiple_cities_competition || hasCompletePublicMultiCityData(competition),
  );

  competitionsCache = await withEventIds(publicCompetitions);
  logger.debug(
    `Fetched ${competitionsCache.length} upcoming competition(s) from the competitions table.`,
  );
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
  const toEquipmentHolder = (row) => (row.people_id === null ? { peopleId: null } : toPerson(row));

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

// Validates a Planner location state and returns its canonical display name.
function getSoutheastState(state) {
  const canonicalState =
    typeof state === 'string'
      ? SOUTHEAST_STATES.find((candidate) => candidate.toLowerCase() === state.trim().toLowerCase())
      : undefined;
  if (!canonicalState) {
    throw httpError(400, 'State must be one of the Southeast states.');
  }
  return canonicalState;
}

// Validates required manual values for a multi-city location and canonicalizes its state.
function getValidatedMultiCityLocation(location) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw httpError(400, 'Each multi-city location must be an object.');
  }
  const requiredTextFields = [
    ['city', location.city],
    ['venue address', location.venueAddress],
    ['venue details', location.venueDetails],
    ['venue', location.venue],
  ];
  const missingField = requiredTextFields.find(
    ([, value]) => typeof value !== 'string' || !value.trim(),
  );
  if (missingField) {
    throw httpError(400, `${missingField[0]} is required for a multi-city location.`);
  }
  if (!Number.isFinite(location.latitudeDegrees) || !Number.isFinite(location.longitudeDegrees)) {
    throw httpError(400, 'Latitude and longitude are required for a multi-city location.');
  }
  if (location.competitorLimit == null) {
    throw httpError(400, 'Competitor limit is required for a multi-city location.');
  }
  assertValidCompetitorLimit(location.competitorLimit);

  return {
    city: location.city.trim(),
    state: getSoutheastState(location.state),
    venueAddress: location.venueAddress.trim(),
    venueDetails: location.venueDetails.trim(),
    venue: location.venue.trim(),
    venueUrl: typeof location.venueUrl === 'string' ? location.venueUrl.trim() || null : null,
    latitudeDegrees: location.latitudeDegrees,
    longitudeDegrees: location.longitudeDegrees,
    competitorLimit: location.competitorLimit,
  };
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

// Identifies WCA competitions whose locations are represented by separate local rows.
function isMultipleCitiesWcaCompetition(comp) {
  return comp.city?.trim().toLowerCase() === 'multiple cities';
}

// True for an upcoming managed WCA competition in a tracked state or multi-city format.
function isEligibleManagedCompetition(comp, majorWcaIds) {
  const startDate = moment(comp.start_date, 'YYYY-MM-DD', true);
  const isMultipleCities = isMultipleCitiesWcaCompetition(comp);
  const isMajor = majorWcaIds?.has(String(comp.id));
  const hasEnoughNotice = !startDate.isBefore(
    moment().add(MIN_START_DATE_LEAD_DAYS, 'days'),
    'day',
  );
  return (
    !!comp.id &&
    startDate.isValid() &&
    (isMultipleCities || (hasEnoughNotice && (isMajor || isInSEState(comp))))
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
    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD'),
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
        await authService.invalidateManageCompetitionsGrant(peopleId, 'managed_competitions_401');
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

// Lists eligible managed competitions and formats any matching major locations.
async function getEligibleUnlinkedManagedCompetitions(
  accessToken,
  peopleId,
  { includeLinkedMultiCity = true } = {},
) {
  // Fetch dependencies for compiling managed competitions.
  const [managedCompetitions, plannerCompetitions, patterns] = await Promise.all([
    fetchManagedWcaCompetitions(accessToken, peopleId, { isEligible: isUpcomingCompetition }),
    competitionsDb.getAllUpcomingCompetitionsForPlanner(),
    discordPingPatternsDb.getPatterns(),
  ]);

  // Create references for Major Championships.
  const detectedMajors = majorChampionships.detectMajorChampionships(managedCompetitions, patterns);
  const preparedMajors = await majorChampionships.prepareMajorCompetitionsForFormatting(
    detectedMajors,
    new Set(detectedMajors.map((competition) => String(competition.id))),
  );
  const preparedMajorByWcaId = new Map(
    preparedMajors.competitions.map((competition) => [String(competition.id), competition]),
  );
  const majorWcaIds = new Set(preparedMajorByWcaId.keys());

  // Already linked competitions.
  const linkedWcaIds = new Set(
    plannerCompetitions
      .map((competition) => competition.wca_competition_id)
      .filter(Boolean)
      .map(String),
  );

  // Create a set of managed competitions w/ majors overwritten.
  const competitionsByWcaId = new Map(
    managedCompetitions.map((competition) => [String(competition.id), competition]),
  );
  for (const [wcaCompetitionId, competition] of preparedMajorByWcaId) {
    competitionsByWcaId.set(wcaCompetitionId, competition);
  }

  return [...competitionsByWcaId.values()]
    .filter((competition) => isEligibleManagedCompetition(competition, majorWcaIds))
    .filter(
      (competition) =>
        (includeLinkedMultiCity && isMultipleCitiesWcaCompetition(competition)) ||
        !linkedWcaIds.has(String(competition.id)),
    )
    .map((competition) => {
      const wcaCompetitionId = String(competition.id);
      const major = preparedMajorByWcaId.get(wcaCompetitionId);
      return {
        wca_competition_id: wcaCompetitionId,
        name: competition.name,
        url: competition.url,
        website: competition.website,
        city: major?.city ?? competition.city,
        state:
          preparedMajors.stateByWcaId.get(wcaCompetitionId) ??
          (major ? getStateFromCity(major.city) : getTrackedSEState(competition.city)),
        start_date: competition.start_date,
        end_date: competition.end_date,
        event_ids: competition.event_ids ?? [],
        delegates: (competition.delegates ?? []).map((person) => ({
          name: person.name,
          wcaId: person.wca_id ?? null,
        })),
        organizers: (competition.organizers ?? []).map((person) => person.name),
        is_multiple_cities_competition: isMultipleCitiesWcaCompetition(competition),
        is_major: Boolean(major),
      };
    });
}

// Supplies upcoming managed competitions and detected majors for banners.
async function getUnannouncedCompetitionBanners(peopleId) {
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) return [];

  const [competitions, dismissedIds] = await Promise.all([
    getEligibleUnlinkedManagedCompetitions(accessToken, peopleId, {
      includeLinkedMultiCity: false,
    }),
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
    throw httpError(
      400,
      'name, city, state, start date, end date, and lead Delegate are required.',
    );
  }
  const southeastState = getSoutheastState(state);
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
    city: `${city}, ${southeastState}`,
    state: southeastState,
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

  logger.debug(
    `Created Planner competition "${name}" (id ${id}), led by people_id ${leadPeopleId}.`,
  );
  return id;
}

// Creates a manual major without Southeast-only location or lead-Delegate requirements.
async function createMajorCompetition(input) {
  // Validate input.
  const { name, city, stateOrCountry, startDate, endDate } = input;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof city !== 'string' ||
    !city.trim() ||
    typeof stateOrCountry !== 'string' ||
    !stateOrCountry.trim() ||
    !startDate ||
    !endDate
  ) {
    throw httpError(
      400,
      'Name, city, State / Country, start date, and end date are required for a major.',
    );
  }
  if (input.createWcaDriveFolder || input.wcaDriveLink) {
    throw httpError(400, 'Major competitions do not use WCA Drive folders.');
  }

  const normalizedStateOrCountry = stateOrCountry.trim();
  assertValidPlannerDates(startDate, endDate);
  assertStartDateFarEnoughOut(startDate);
  assertValidCompetitorLimit(input.competitorLimit);

  const delegatePeopleIds = input.delegatePeopleIds ?? [];
  const organizerPeopleIds = input.organizerPeopleIds ?? [];
  const equipmentPeopleIds = input.equipmentPeopleIds ?? [];
  const eventIds = input.eventIds ?? [];
  if (
    !Array.isArray(delegatePeopleIds) ||
    !Array.isArray(organizerPeopleIds) ||
    !Array.isArray(equipmentPeopleIds) ||
    !Array.isArray(eventIds)
  ) {
    throw httpError(400, 'Delegates, organizers, equipment holders, and events must be arrays.');
  }

  const leadPeopleId = input.leadPeopleId ?? null;
  if (leadPeopleId && !delegatePeopleIds.includes(leadPeopleId)) {
    throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
  }
  await assertPeopleExist(delegatePeopleIds, 'Delegates');
  await assertPeopleExist(organizerPeopleIds, 'Organizers');
  await assertEquipmentHoldersAreDelegates(equipmentPeopleIds);
  assertValidEventIds(eventIds);

  // Create a new competition.
  const id = crypto.randomUUID();
  await competitionsDb.createPlannerCompetition({
    id,
    name: withYearInName(name, endDate),
    city: `${city.trim()}, ${normalizedStateOrCountry}`,
    state: normalizedStateOrCountry,
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
    isMajor: true,
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

  logger.debug(`Created manual major Planner competition "${name}".`);
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

  if (!comp.is_major && !input.leadPeopleId) {
    throw httpError(400, 'Lead Delegate is required.');
  }

  const equipmentPeopleIds = input.equipmentPeopleIds ?? [];
  await assertEquipmentHoldersAreDelegates(equipmentPeopleIds);

  let updatedCompetition = null;
  if (status === 'potential') {
    const { name, city, startDate, endDate } = input;
    const stateOrCountry = comp.is_major ? input.stateOrCountry : input.state;
    if (!name || !city || !stateOrCountry || !startDate || !endDate) {
      throw httpError(
        400,
        comp.is_major
          ? 'name, city, State / Country, start date, and end date are required.'
          : 'name, city, state, start date, and end date are required.',
      );
    }
    const state = comp.is_major ? stateOrCountry.trim() : getSoutheastState(stateOrCountry);
    assertValidPlannerDates(startDate, endDate);
    assertStartDateFarEnoughOut(startDate);
    assertValidCompetitorLimit(input.competitorLimit);

    const delegatePeopleIds = input.delegatePeopleIds ?? [];
    const organizerPeopleIds = input.organizerPeopleIds ?? [];
    const eventIds = input.eventIds ?? [];
    if (input.leadPeopleId && !delegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await assertPeopleExist(delegatePeopleIds, 'Delegates');
    await assertPeopleExist(organizerPeopleIds, 'Organizers');
    assertValidEventIds(eventIds);

    const fullDate = getFullCompetitionDate(input.startDate, input.endDate);
    updatedCompetition = await competitionsDb.updatePlannerCompetitionFields(id, {
      name: withYearInName(input.name, input.endDate),
      city: `${input.city.trim()}, ${state}`,
      state,
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
  } else if (comp.is_multiple_cities_competition) {
    const location = getValidatedMultiCityLocation(input);
    const delegatePeopleIds = input.delegatePeopleIds ?? [];
    if (!Array.isArray(delegatePeopleIds) || !delegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await assertPeopleExist(delegatePeopleIds, 'Delegates');

    updatedCompetition = await competitionsDb.updateMultiCityLocationFields(id, {
      ...location,
      city: `${location.city}, ${location.state}`,
    });
    if (!updatedCompetition) throw httpError(404, 'Competition not found.');
    await competitionDelegatesDb.replaceDelegatesForCompetition(
      id,
      delegatePeopleIds.map((peopleId) => ({
        peopleId,
        isLead: peopleId === input.leadPeopleId,
      })),
    );
  } else if (comp.is_major) {
    // announced majors can change lead Delegate.
    const leadPeopleId = input.leadPeopleId ?? null;
    if (leadPeopleId) {
      const currentDelegatePeopleIds = (await competitionDelegatesDb.listForCompetitions([id])).map(
        (row) => row.people_id,
      );
      if (!currentDelegatePeopleIds.includes(leadPeopleId)) {
        throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
      }
    }
    // Allows null to clear.
    if (Object.hasOwn(input, 'leadPeopleId')) {
      await competitionDelegatesDb.setLead(id, leadPeopleId);
    }
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
  // A supplied folder URL and a request to create a folder are mutually exclusive.
  if (createWcaDriveFolder && wcaDriveLink) {
    throw httpError(400, 'Choose either a new WCA Drive folder or an existing folder link.');
  }

  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) {
    throw httpError(403, 'WCA manage_competitions access is required to link a competition.');
  }

  const eligibleCompetitions = await getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
  const eligibleCompetition = eligibleCompetitions.find(
    (competition) => competition.wca_competition_id === String(wcaCompetitionId),
  );
  if (!eligibleCompetition) {
    throw httpError(400, 'This WCA competition is not available to link.');
  }

  let existingIsLeadByPeopleId = new Map();
  let plannerCompetition = null;
  if (plannerCompetitionId) {
    plannerCompetition = await competitionsDb.getCompetitionById(plannerCompetitionId);
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
  const majorWcaIds = eligibleCompetition.is_major
    ? new Set([String(wcaCompetition.id)])
    : new Set();
  if (!isEligibleManagedCompetition(wcaCompetition, majorWcaIds)) {
    throw httpError(400, 'This WCA competition is no longer eligible to link.');
  }
  const isMajor = majorWcaIds.has(String(wcaCompetition.id));
  if (plannerCompetition && Boolean(plannerCompetition.is_major) !== isMajor) {
    throw httpError(
      400,
      'The Planner row and WCA competition must both be majors or both be regular competitions.',
    );
  }

  // Multi-city locations must start from a manually entered Potential row.
  const isMultipleCities = isMultipleCitiesWcaCompetition(wcaCompetition);
  if (isMultipleCities && !plannerCompetition) {
    throw httpError(
      400,
      'Create a Southeast location row before linking a multi-city WCA competition.',
    );
  }
  const existingMultiCityDriveFolder =
    isMultipleCities && !isMajor
      ? await competitionsDb.getWcaDriveLinkByWcaCompetitionId(wcaCompetition.id)
      : null;
  if (!isMajor && !existingMultiCityDriveFolder && (createWcaDriveFolder || wcaDriveLink)) {
    try {
      googleDrive.assertDriveAvailable();
      if (wcaDriveLink) getWcaDriveFolderId(wcaDriveLink);
    } catch (error) {
      rethrowWcaDriveUnavailable(error);
    }
  }

  const competitionsToPrepare =
    isMajor || isMultipleCities
      ? [wcaCompetition]
      : filterCompetitionsToTrackedSEStates([wcaCompetition]);
  const preparedCompetitions = isMajor
    ? await majorChampionships.prepareMajorCompetitionsForFormatting(
        competitionsToPrepare,
        majorWcaIds,
      )
    : { competitions: competitionsToPrepare, stateByWcaId: new Map() };

  // Fetch registration data to add to the competition.
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(
    preparedCompetitions.competitions,
    {
      accessToken,
      adminCompetitionIds: new Set([String(wcaCompetition.id)]),
    },
  );

  // Format Competition information.
  const [formattedCompetition] = formatCompetitionData(
    preparedCompetitions.competitions,
    [],
    registrationDataByWcaId,
    majorWcaIds,
    preparedCompetitions.stateByWcaId,
  );
  if (!formattedCompetition) {
    throw httpError(400, 'This WCA competition could not be prepared for Planner.');
  }
  if (isMultipleCities) {
    Object.assign(formattedCompetition, {
      city: plannerCompetition.city,
      state: plannerCompetition.state,
      venue_address: plannerCompetition.venue_address,
      venue_details: plannerCompetition.venue_details,
      venue: plannerCompetition.venue,
      venue_url: plannerCompetition.venue_url,
      latitude_degrees: plannerCompetition.latitude_degrees,
      longitude_degrees: plannerCompetition.longitude_degrees,
      competitor_limit: plannerCompetition.competitor_limit,
      is_multiple_cities_competition: true,
    });
  }

  // Check that the competition has not already been linked
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
  if (isMultipleCities) {
    // Organizers are WCA-owned; multi-city Delegates are assigned per location.
    await competitionOrganizersDb.replaceOrganizersForCompetition(
      competitionId,
      await Promise.all((formattedCompetition.organizers ?? []).map(resolvePersonId)),
    );
  } else {
    await syncDelegatesAndOrganizers({
      id: competitionId,
      delegates: formattedCompetition.delegates,
      organizers: formattedCompetition.organizers,
      existingIsLeadByPeopleId,
    });
  }

  // WCA Drive creation & Sync.
  if (isMajor) {
    // Major competitions do not use WCA Drive linkage or folder automation.
  } else if (existingMultiCityDriveFolder) {
    await competitionsDb.setWcaDriveLink(
      competitionId,
      existingMultiCityDriveFolder.wca_drive_link,
      existingMultiCityDriveFolder.wca_drive_folder_type,
    );
    const linkedCompetition = await competitionsDb.getCompetitionById(competitionId);
    await syncWcaDriveFolderBestEffort(
      linkedCompetition,
      'WCA competition linking',
      undefined,
      true,
    );
  } else if (createWcaDriveFolder) {
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

// Creates linked Planner rows for every validated Southeast location of one managed WCA competition.
async function createMultiCityCompetitionFromWca({
  peopleId,
  wcaCompetitionId,
  locations,
  createWcaDriveFolder,
  wcaDriveLink,
}) {
  // A supplied folder URL and a request to create a folder are mutually exclusive.
  if (createWcaDriveFolder && wcaDriveLink) {
    throw httpError(400, 'Choose either a new WCA Drive folder or an existing folder link.');
  }

  // Confirm the caller can manage the selected WCA competition.
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) {
    throw httpError(
      403,
      'WCA manage_competitions access is required to create a linked competition.',
    );
  }

  const eligibleCompetitions = await getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
  if (!eligibleCompetitions.some((comp) => comp.wca_competition_id === String(wcaCompetitionId))) {
    throw httpError(400, 'This WCA competition is not available to link.');
  }

  // Fetch and validate the selected WCA record before the first Planner write.
  const wcaCompetition = await wca.fetchCompetitionById(String(wcaCompetitionId), { accessToken });
  if (
    !isEligibleManagedCompetition(wcaCompetition) ||
    !isMultipleCitiesWcaCompetition(wcaCompetition)
  ) {
    throw httpError(400, 'This WCA competition is not an eligible multi-city competition.');
  }

  // Validate every location and assignment before creating any rows.
  if (!Array.isArray(locations) || !locations.length) {
    throw httpError(400, 'At least one location is required to create a multi-city competition.');
  }
  const validatedLocations = locations.map((location) => {
    const validatedLocation = getValidatedMultiCityLocation(location);
    const delegatePeopleIds = location.delegatePeopleIds;
    const equipmentPeopleIds = location.equipmentPeopleIds ?? [];
    if (!Array.isArray(delegatePeopleIds) || !delegatePeopleIds.length) {
      throw httpError(400, 'At least one Delegate is required for each multi-city location.');
    }
    if (!delegatePeopleIds.includes(location.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    if (!Array.isArray(equipmentPeopleIds)) {
      throw httpError(400, 'Equipment holders must be an array.');
    }
    return {
      ...validatedLocation,
      delegatePeopleIds,
      leadPeopleId: location.leadPeopleId,
      equipmentPeopleIds,
    };
  });
  await assertPeopleExist(
    validatedLocations.flatMap((location) => location.delegatePeopleIds),
    'Delegates',
  );
  await assertEquipmentHoldersAreDelegates(
    validatedLocations.flatMap((location) => location.equipmentPeopleIds),
  );

  // Reuse an existing shared folder; otherwise validate any requested Drive action.
  const existingDriveFolder = await competitionsDb.getWcaDriveLinkByWcaCompetitionId(
    wcaCompetition.id,
  );
  if (!existingDriveFolder && (createWcaDriveFolder || wcaDriveLink)) {
    try {
      googleDrive.assertDriveAvailable();
      if (wcaDriveLink) getWcaDriveFolderId(wcaDriveLink);
    } catch (error) {
      rethrowWcaDriveUnavailable(error);
    }
  }

  // Fetch registration data and format WCA-owned fields once for all local rows.
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId([wcaCompetition], {
    accessToken,
    adminCompetitionIds: new Set([String(wcaCompetition.id)]),
  });
  const [formattedCompetition] = formatCompetitionData(
    [wcaCompetition],
    [],
    registrationDataByWcaId,
  );
  if (!formattedCompetition) {
    throw httpError(400, 'This WCA competition could not be prepared for Planner.');
  }
  formattedCompetition.is_multiple_cities_competition = true;

  // Create one local Planner row for each validated Southeast location.
  const competitionIds = [];
  for (const location of validatedLocations) {
    const competitionId = await competitionsDb.createPlannerCompetitionLinkedToWca({
      ...formattedCompetition,
      city: `${location.city}, ${location.state}`,
      state: location.state,
      venue_address: location.venueAddress,
      venue_details: location.venueDetails,
      venue: location.venue,
      venue_url: location.venueUrl,
      latitude_degrees: location.latitudeDegrees,
      longitude_degrees: location.longitudeDegrees,
      competitor_limit: location.competitorLimit,
    });
    competitionIds.push(competitionId);
  }

  // Store shared events and organizers alongside each location's assignments.
  await competitionEventsDb.replaceEventIds(
    competitionIds.map((id) => ({ id, event_ids: formattedCompetition.event_ids ?? [] })),
  );
  const organizerPeopleIds = await Promise.all(
    (formattedCompetition.organizers ?? []).map(resolvePersonId),
  );
  for (const [index, competitionId] of competitionIds.entries()) {
    const location = validatedLocations[index];
    await competitionOrganizersDb.replaceOrganizersForCompetition(
      competitionId,
      organizerPeopleIds,
    );
    await competitionDelegatesDb.replaceDelegatesForCompetition(
      competitionId,
      location.delegatePeopleIds.map((peopleId) => ({
        peopleId,
        isLead: peopleId === location.leadPeopleId,
      })),
    );
    await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(
      competitionId,
      location.equipmentPeopleIds,
    );
  }

  // Share one Drive folder across the rows, creating or preparing it only once.
  const firstCompetitionId = competitionIds[0];
  if (existingDriveFolder) {
    for (const competitionId of competitionIds) {
      await competitionsDb.setWcaDriveLink(
        competitionId,
        existingDriveFolder.wca_drive_link,
        existingDriveFolder.wca_drive_folder_type,
      );
    }
    const competition = await competitionsDb.getCompetitionById(firstCompetitionId);
    await syncWcaDriveFolderBestEffort(competition, 'WCA competition linking', undefined, true);
  } else if (createWcaDriveFolder) {
    await createWcaDriveFolderForCompetition(firstCompetitionId);
    const firstCompetition = await competitionsDb.getCompetitionById(firstCompetitionId);
    for (const competitionId of competitionIds.slice(1)) {
      await competitionsDb.setWcaDriveLink(
        competitionId,
        firstCompetition.wca_drive_link,
        firstCompetition.wca_drive_folder_type,
      );
    }
  } else if (wcaDriveLink) {
    await setCompetitionWcaDriveLink(firstCompetitionId, wcaDriveLink);
    const firstCompetition = await competitionsDb.getCompetitionById(firstCompetitionId);
    for (const competitionId of competitionIds.slice(1)) {
      await competitionsDb.setWcaDriveLink(
        competitionId,
        firstCompetition.wca_drive_link,
        firstCompetition.wca_drive_folder_type,
      );
    }
  }

  return competitionIds;
}

// Upserts `comps` in chunks under DSQL's row cap, returning the ids newly
// inserted across every chunk. On first-time population, announced rows are
// stamped as posted to avoid a Discord backlog; unannounced rows stay pending.
// Returns linked competitions whose folder names may need updating.
async function upsertCompetitions(comps, isFirstPopulation) {
  if (!comps.length) {
    return { insertedIds: [], wcaDriveFolderNameChangedIds: [] };
  }

  try {
    const wasEmpty = isFirstPopulation ?? (await competitionsDb.getCompetitionsCount()) === 0;

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

// Links a detected major to a manual row only when exactly one candidate matches.
async function linkDetectedMajorsToUniqueManualRows(competitions, plannerCompetitions) {
  const linkedWcaCompetitionIds = new Set(
    plannerCompetitions
      .map((competition) => competition.wca_competition_id)
      .filter(Boolean)
      .map(String),
  );

  for (const competition of competitions) {
    const wcaCompetitionId = String(competition.wca_competition_id);
    if (linkedWcaCompetitionIds.has(wcaCompetitionId)) continue;

    const candidates = plannerCompetitions.filter(
      (plannerCompetition) =>
        plannerCompetition.is_major &&
        !plannerCompetition.wca_competition_id &&
        plannerCompetition.start_date === competition.start_date &&
        plannerCompetition.end_date === competition.end_date,
    );
    const matches = majorChampionships.findMatchingManualMajorCompetitions(
      competition.city,
      candidates,
    );
    if (matches.length !== 1) continue;

    const manualCompetition = matches[0];
    const existingDelegateRows = await competitionDelegatesDb.listForCompetitions([
      manualCompetition.id,
    ]);
    const existingIsLeadByPeopleId = new Map(
      existingDelegateRows.map((row) => [row.people_id, row.is_lead]),
    );
    const linked = await competitionsDb.linkPlannerCompetitionToWca(
      manualCompetition.id,
      competition,
    );
    if (!linked) continue;

    await competitionEventsDb.replaceEventIds([
      { id: manualCompetition.id, event_ids: competition.event_ids ?? [] },
    ]);
    await syncDelegatesAndOrganizers({
      id: manualCompetition.id,
      delegates: competition.delegates,
      organizers: competition.organizers,
      existingIsLeadByPeopleId,
    });
    invalidateCache();
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
  return discord.postToDiscordInChunks(sortForDiscordPosting(competitions), {
    postFn: (competition) =>
      discord.postCompetitionInDiscord(
        { ...competition, id: competition.wca_competition_id },
        {
          pingOverride: competition.is_major ? 'everyone' : undefined,
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
      throw httpError(
        403,
        'WCA manage_competitions access is required to refresh this competition.',
      );
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

  const competitionsToPrepare = plannerCompetition.is_major
    ? [wcaCompetition]
    : filterCompetitionsToTrackedSEStates([wcaCompetition]);
  const majorWcaIds = plannerCompetition.is_major
    ? new Set([String(wcaCompetition.id)])
    : new Set();
  const preparedCompetitions = plannerCompetition.is_major
    ? await majorChampionships.prepareMajorCompetitionsForFormatting(
        competitionsToPrepare,
        majorWcaIds,
      )
    : { competitions: competitionsToPrepare, stateByWcaId: new Map() };
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(
    preparedCompetitions.competitions,
    {
      accessToken,
      adminCompetitionIds: isAssignedManager ? new Set([String(wcaCompetition.id)]) : new Set(),
    },
  );
  const [competition] = formatCompetitionData(
    preparedCompetitions.competitions,
    [],
    registrationDataByWcaId,
    majorWcaIds,
    preparedCompetitions.stateByWcaId,
  );
  if (!competition) {
    throw httpError(400, 'Competition is no longer in a tracked state.');
  }

  competition.is_announced = Boolean(wcaCompetition.announced_at);
  competition.is_in_volunteer_application = plannerCompetition.is_in_volunteer_application;
  await upsertCompetitions([competition]);
  const refreshedCompetition = await competitionsDb.getCompetitionById(plannerCompetition.id);
  await syncWcaDriveFolderBestEffort(
    refreshedCompetition,
    'single competition refresh',
    undefined,
    true,
  );

  return { ...competition, id: plannerCompetition.id };
}

// Checks each upcoming multi-city WCA id once and refreshes all its local rows when public.
async function refreshUpcomingMultiCityCompetitions(
  plannerCompetitions,
  volunteerCompetitionNames,
  accessToken,
  adminRegistrationCompetitionIds,
) {
  // Group all the same WCA Ids together for multi city competitions.
  const announcedByWcaCompetitionId = new Map();
  for (const competition of plannerCompetitions) {
    if (!competition.is_multiple_cities_competition || !competition.wca_competition_id) continue;
    const wcaCompetitionId = String(competition.wca_competition_id);
    announcedByWcaCompetitionId.set(
      wcaCompetitionId,
      announcedByWcaCompetitionId.get(wcaCompetitionId) || Boolean(competition.is_announced),
    );
  }

  const failedWcaCompetitionIds = [];
  const updatedWcaCompetitionIds = [];
  let shouldInvalidatePublicCache = false;

  for (const [wcaCompetitionId, wasAnnounced] of announcedByWcaCompetitionId) {
    // Fetch competition from WCA.
    let wcaCompetition;
    try {
      wcaCompetition = await wca.fetchCompetitionById(wcaCompetitionId, {
        suppressNotFoundLogging: !wasAnnounced,
        accessToken,
      });
    } catch (error) {
      if (error.response?.status !== 404 || wasAnnounced) {
        failedWcaCompetitionIds.push(wcaCompetitionId);
      }
      continue;
    }

    // fetch registrations for competition.
    const registrationDataByWcaId = await fetchRegistrationDataByWcaId([wcaCompetition], {
      accessToken,
      adminCompetitionIds: adminRegistrationCompetitionIds,
    });

    // Format competition.
    const [formattedCompetition] = formatCompetitionData(
      [wcaCompetition],
      volunteerCompetitionNames,
      registrationDataByWcaId,
    );
    formattedCompetition.is_multiple_cities_competition = true;

    // Preform update. Returns all internal ids that link to the same WCA Id.
    const competitionIds = await competitionsDb.updateMultiCityCompetitionRowsByWcaId(
      wcaCompetitionId,
      formattedCompetition,
    );
    if (!competitionIds.length) continue;
    shouldInvalidatePublicCache ||= wasAnnounced || formattedCompetition.is_announced;

    await competitionEventsDb.replaceEventIds(
      competitionIds.map((id) => ({ id, event_ids: formattedCompetition.event_ids ?? [] })),
    );
    const organizerPeopleIds = await Promise.all(
      (formattedCompetition.organizers ?? []).map(resolvePersonId),
    );
    for (const competitionId of competitionIds) {
      await competitionOrganizersDb.replaceOrganizersForCompetition(
        competitionId,
        organizerPeopleIds,
      );
    }
    updatedWcaCompetitionIds.push(wcaCompetitionId);
  }

  if (shouldInvalidatePublicCache) invalidateCache();
  return { failedWcaCompetitionIds, updatedWcaCompetitionIds };
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
  const plannerCompetitions = await competitionsDb.getAllUpcomingCompetitionsForPlanner();

  // Get managed competitions and registration-admin access for assigned organizers/delegates.
  let managedOnlyCompetitions = [];
  const peopleId = actor?.peopleId;
  let accessToken;
  let privateDataRefreshFailed = false;
  let adminRegistrationCompetitionIds = new Set();
  if (peopleId) {
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

  // fetch competitions with a volunteer application
  let competitionsWithVolunteerApp = await googleForm.getCompetitionsInVolunteerForm();

  const patterns = await discordPingPatternsDb.getPatterns();
  const detectedMajors = await majorChampionships.getDetectedMajorChampionships(
    wcaCompetitions,
    patterns,
  );
  const majorWcaIds = new Set(detectedMajors.map((competition) => String(competition.id)));
  const competitionByWcaId = new Map();
  [...filterCompetitionsToTrackedSEStates(wcaCompetitions), ...detectedMajors].forEach(
    (competition) => competitionByWcaId.set(String(competition.id), competition),
  );

  // Include every detected major in the same row-based formatting and persistence flow.
  const competitionsToFormat = [...competitionByWcaId.values()];
  const preparedCompetitions = await majorChampionships.prepareMajorCompetitionsForFormatting(
    competitionsToFormat,
    majorWcaIds,
  );
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(
    preparedCompetitions.competitions,
    {
      accessToken,
      adminCompetitionIds: adminRegistrationCompetitionIds,
    },
  );
  privateDataRefreshFailed ||= [...registrationDataByWcaId.values()].some(
    (registrationData) => registrationData.adminRegistrationFetchFailed,
  );
  const formattedCompetitions = formatCompetitionData(
    preparedCompetitions.competitions,
    competitionsWithVolunteerApp,
    registrationDataByWcaId,
    majorWcaIds,
    preparedCompetitions.stateByWcaId,
  );

  // check if blank database before populating any of it.
  const isFirstPopulation = (await competitionsDb.getCompetitionsCount()) === 0;
  await linkDetectedMajorsToUniqueManualRows(
    formattedCompetitions.filter((competition) => competition.is_major),
    plannerCompetitions,
  );
  const comps = formattedCompetitions;

  // overwrite is_announced of the private managed only competitions
  for (const comp of comps) {
    if (managedOnlyCompetitionIds.has(String(comp.wca_competition_id))) {
      comp.is_announced = false;
    }
  }

  let nameChangedDriveFolderIds = [];
  if (comps && comps.length) {
    logger.debug(`Formatted ${comps.length} competitions for the public list.`);

    // Upsert into the database. upsertCompetitions handles the cold-start
    // case internally (stamping a first-time population as already
    // announced).
    const upsertResult = await upsertCompetitions(comps, isFirstPopulation);
    nameChangedDriveFolderIds = upsertResult.wcaDriveFolderNameChangedIds;

    // Only recorded on a non-empty result - an empty result is more likely a
    // WCA API glitch than a genuine zero-competition period in these states,
    // so it's treated as an unconfirmed check rather than a successful one.
    // This keeps update-competitions' rate limit and fetchCompetitions'
    // staleness check retrying instead of going stale on bad data.
    invalidateCache();
  } else {
    logger.warn('There are no competitions!');
  }

  // Refresh Multiple City Competitions.
  const multiCityRefreshResult = await refreshUpcomingMultiCityCompetitions(
    plannerCompetitions,
    competitionsWithVolunteerApp,
    accessToken,
    adminRegistrationCompetitionIds,
  );
  const multiCityRefreshFailedIds = multiCityRefreshResult.failedWcaCompetitionIds;

  // Posts pending competitions on Discord.
  let discordPostFailures = [];
  if (comps.length || multiCityRefreshResult.updatedWcaCompetitionIds.length) {
    const updatedMultiCityIdSet = new Set(multiCityRefreshResult.updatedWcaCompetitionIds);
    // A regular refresh scans all pending public rows, including multi-city rows; otherwise,
    // limit announcements to multi-city WCA ids refreshed in this run.
    const competitionsPendingDiscordAnnouncement = await withEventIds(
      (await competitionsDb.getCompetitionsPendingDiscordAnnouncement()).filter((competition) =>
        comps.length
          ? !managedOnlyCompetitionIds.has(String(competition.wca_competition_id))
          : updatedMultiCityIdSet.has(String(competition.wca_competition_id)),
      ),
    );
    if (competitionsPendingDiscordAnnouncement.length) {
      discordPostFailures = await postCompetitionsToDiscord(competitionsPendingDiscordAnnouncement);
    }
  }

  // Sync WCA Drive Folders
  await syncAllWcaDriveFoldersBestEffort(nameChangedDriveFolderIds);

  return {
    competitions: comps,
    discordPostFailures,
    privateDataRefreshFailed,
    multiCityRefreshFailedIds,
  };
}

// Maps WCA records to the competition-row shape used by the database and frontend.
function formatCompetitionData(
  comps,
  competitionsWithVolunteerApp,
  registrationDataByWcaId,
  majorWcaIds = new Set(),
  stateByWcaId = new Map(),
) {
  return (
    comps
      // Sort by date.
      .sort((a, b) => (moment(a.start_date).isBefore(b.start_date) ? -1 : 1))

      // Create extra fields for competition data and strip out unnecessary data.
      .map((competition) => {
        const wcaCompetitionId = String(competition.id);
        const registrationData = registrationDataByWcaId.get(wcaCompetitionId);
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
          state: stateByWcaId.has(wcaCompetitionId)
            ? stateByWcaId.get(wcaCompetitionId)
            : getStateFromCity(competition.city),
          is_major: majorWcaIds.has(wcaCompetitionId) || Boolean(competition.is_major),
          is_in_volunteer_application: competitionsWithVolunteerApp.includes(competition.name),
          accepted_registrations: registrationData?.acceptedRegistrations ?? 0,
          waiting_list_count: registrationData?.waitingListCount ?? null,
          waiting_list_count_updated_at: registrationData?.waitingListCountUpdatedAt ?? null,
          full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
          // WCA's announced_at timestamp determines whether this is public yet.
          is_announced: Boolean(competition.announced_at),
        };
      })
  );
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
  createMultiCityCompetitionFromWca,
  createCompetition,
  createMajorCompetition,
  createWcaDriveFolderForCompetition,
  setCompetitionWcaDriveLink,
  updateCompetition,
  deleteCompetition,
};
