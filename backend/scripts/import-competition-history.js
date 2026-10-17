const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const moment = require('moment');

const wca = require('../app/integrations/wca.integration.js');
const competitionEventsDb = require('../app/database/competitions/competitionEvents.database.js');
const competitionDelegatesDb = require('../app/database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../app/database/competitions/competitionOrganizers.database.js');
const competitionUnofficialEventsDb = require('../app/database/competitions/competitionUnofficialEvents.database.js');
const peopleDb = require('../app/database/people/people.database.js');
const { pool, withRetry } = require('../app/database/pool.js');
const { getFullCompetitionDate } = require('../app/helpers/competitions/competitionDates.helper.js');
const { chunk } = require('../app/helpers/chunk.helper.js');
const { SOUTHEAST_STATES } = require('../app/helpers/competitions/states.helper.js');
const logger = require('../app/utils/logger.util.js');

const START_DATE = '2003-01-01';
const MAX_PAGES = 20;
const IMPORT_BATCH_SIZE = 250;
const PEOPLE_BATCH_SIZE = 25;
const MANIFEST_PATH = path.join(__dirname, 'competition-history.json');
const VENUE_LINK_PATTERN = /\[(.+)\]\((.+)\)/;
const HISTORICAL_COLUMNS = [
  'id',
  'url',
  'name',
  'website',
  'city',
  'venue_address',
  'venue_details',
  'latitude_degrees',
  'longitude_degrees',
  'country_iso2',
  'start_date',
  'registration_open',
  'registration_close',
  'end_date',
  'competitor_limit',
  'venue',
  'venue_url',
  'state',
  'full_date',
  'wca_competition_id',
  'is_announced',
  'wca_drive_link',
  'wca_drive_folder_type',
  'is_cancelled',
  'announced_on_discord_at',
];

// Returns the canonical tracked state from the final segment of a WCA city.
function getTrackedState(city) {
  if (typeof city !== 'string') return null;
  const stateName = city
    .substring(city.lastIndexOf(',') + 1)
    .trim()
    .toLowerCase();
  return SOUTHEAST_STATES.find((state) => state.toLowerCase() === stateName) ?? null;
}

// Loads every page of current WCA US competition data and fails on an incomplete pull.
async function fetchAllUsCompetitions() {
  const competitions = [];
  let reachedLastPage = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageCompetitions = await wca.fetchUSCompetitionsPage({ page, startDate: START_DATE });
    competitions.push(...pageCompetitions);

    if (pageCompetitions.length < wca.US_COMPETITIONS_PAGE_SIZE) {
      reachedLastPage = true;
      break;
    }
  }

  if (!reachedLastPage) {
    throw new Error(`Reached the ${MAX_PAGES}-page limit before WCA pagination completed.`);
  }
  return competitions;
}

// Validates the compiled JSON's identity and JSON-managed fields before import.
function validateManifest(manifest) {
  if (!Array.isArray(manifest)) {
    throw new Error('Competition history JSON must be an array.');
  }

  const seenIds = new Set();
  for (const entry of manifest) {
    if (typeof entry.wcaCompetitionId !== 'string' || !entry.wcaCompetitionId) {
      throw new Error('Every competition history entry must have a WCA competition ID.');
    }
    if (seenIds.has(entry.wcaCompetitionId)) {
      throw new Error(`Competition history JSON repeats ${entry.wcaCompetitionId}.`);
    }
    seenIds.add(entry.wcaCompetitionId);

    if (entry.driveFolderId !== null && typeof entry.driveFolderId !== 'string') {
      throw new Error(`Competition ${entry.wcaCompetitionId} has an invalid Drive folder ID.`);
    }
    if (!Array.isArray(entry.unofficialEvents)) {
      throw new Error(`Competition ${entry.wcaCompetitionId} has invalid unofficial events.`);
    }
    for (const event of entry.unofficialEvents) {
      if (
        typeof event.eventName !== 'string' ||
        !event.eventName ||
        typeof event.icon !== 'string' ||
        !event.icon
      ) {
        throw new Error(`Competition ${entry.wcaCompetitionId} has a malformed unofficial event.`);
      }
    }
    if (entry.leadDelegateWcaId !== null && typeof entry.leadDelegateWcaId !== 'string') {
      throw new Error(`Competition ${entry.wcaCompetitionId} has an invalid lead Delegate WCA ID.`);
    }
  }
}

// Checks WCA people have a WCA user ID and rejects repeated identities per assignment list.
function getAssignedPeople(people, competitionId, assignmentName) {
  if (people == null) return [];
  if (!Array.isArray(people)) {
    throw new Error(`WCA ${assignmentName} data is invalid for ${competitionId}.`);
  }

  const seenPeople = new Set();
  for (const person of people) {
    const wcaId = person?.wca_id ?? null;
    const wcaUserId = person?.id == null ? '' : String(person.id);
    if (
      !wcaUserId ||
      typeof person.name !== 'string' ||
      !person.name.trim() ||
      (wcaId !== null && (typeof wcaId !== 'string' || !wcaId))
    ) {
      throw new Error(
        `WCA ${assignmentName} data is missing a person identity for ${competitionId}.`,
      );
    }
    const identity = wcaId ? `wca:${wcaId}` : `user:${wcaUserId}`;
    if (seenPeople.has(identity)) {
      throw new Error(
        `WCA ${assignmentName} data repeats person ${identity} for ${competitionId}.`,
      );
    }
    seenPeople.add(identity);
  }
  return people;
}

// Normalizes one current WCA record and its manifest-managed historical fields.
function formatHistoricalCompetition(competition, entry, state) {
  const competitionId = String(competition.id);
  if (
    typeof competition.start_date !== 'string' ||
    !moment.utc(competition.start_date, 'YYYY-MM-DD', true).isValid() ||
    typeof competition.end_date !== 'string' ||
    !moment.utc(competition.end_date, 'YYYY-MM-DD', true).isValid()
  ) {
    throw new Error(`WCA competition ${competitionId} has invalid start/end dates.`);
  }
  if (
    !Array.isArray(competition.event_ids) ||
    competition.event_ids.some((eventId) => typeof eventId !== 'string')
  ) {
    throw new Error(`WCA competition ${competitionId} has invalid official events.`);
  }

  const delegates = getAssignedPeople(competition.delegates, competitionId, 'delegate');
  const organizers = getAssignedPeople(competition.organizers, competitionId, 'organizer');
  const delegateWcaIds = new Set(delegates.map((delegate) => delegate.wca_id));
  if (entry.leadDelegateWcaId && !delegateWcaIds.has(entry.leadDelegateWcaId)) {
    throw new Error(
      `Lead Delegate ${entry.leadDelegateWcaId} is not assigned to WCA competition ${competitionId}.`,
    );
  }

  const venueMatch =
    typeof competition.venue === 'string' ? competition.venue.match(VENUE_LINK_PATTERN) : null;
  const driveFolderId = entry.driveFolderId;

  return {
    url: competition.url ?? null,
    wca_competition_id: competitionId,
    name: competition.name ?? null,
    website: competition.website ?? null,
    city: competition.city ?? null,
    venue_address: competition.venue_address ?? null,
    venue_details: competition.venue_details ?? null,
    latitude_degrees: competition.latitude_degrees ?? null,
    longitude_degrees: competition.longitude_degrees ?? null,
    country_iso2: competition.country_iso2 ?? null,
    start_date: competition.start_date,
    registration_open: competition.registration_open ?? null,
    registration_close: competition.registration_close ?? null,
    end_date: competition.end_date,
    competitor_limit: competition.competitor_limit ?? null,
    event_ids: competition.event_ids,
    delegates,
    organizers,
    venue: venueMatch ? venueMatch[1] : (competition.venue ?? null),
    venue_url: venueMatch ? venueMatch[2] : null,
    state,
    full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
    is_announced: Boolean(competition.announced_at),
    is_cancelled: competition.cancelled_at != null,
    wca_drive_link: driveFolderId
      ? `https://drive.google.com/drive/folders/${driveFolderId}`
      : null,
    wca_drive_folder_type: driveFolderId ? 'past' : null,
    leadDelegateWcaId: entry.leadDelegateWcaId,
    unofficialEvents: entry.unofficialEvents,
  };
}

// Filters to tracked Southeast states before matching manifest competitions.
function prepareHistoricalCompetitions(manifest, wcaCompetitions) {
  const southeastCompetitions = wcaCompetitions.filter((competition) =>
    getTrackedState(competition.city),
  );
  const wcaById = new Map();
  for (const competition of southeastCompetitions) {
    const competitionId = String(competition.id);
    if (wcaById.has(competitionId)) {
      throw new Error(`WCA returned competition ${competitionId} more than once.`);
    }
    wcaById.set(competitionId, competition);
  }

  const prepared = [];

  for (const entry of manifest) {
    const competition = wcaById.get(entry.wcaCompetitionId);
    if (!competition) {
      throw new Error(
        `WCA did not return Southeast competition ${entry.wcaCompetitionId} from WCA.`,
      );
    }
    if (
      typeof competition.start_date !== 'string' ||
      !moment.utc(competition.start_date, 'YYYY-MM-DD', true).isValid()
    ) {
      throw new Error(`WCA competition ${entry.wcaCompetitionId} has an invalid start date.`);
    }

    const state = getTrackedState(competition.city);
    if (!state) {
      throw new Error(`WCA competition ${entry.wcaCompetitionId} is no longer in a tracked state.`);
    }
    prepared.push(formatHistoricalCompetition(competition, entry, state));
  }

  prepared.sort(
    (left, right) =>
      left.start_date.localeCompare(right.start_date) ||
      left.wca_competition_id.localeCompare(right.wca_competition_id),
  );
  return {
    competitions: prepared,
    filteredNonSoutheast: wcaCompetitions.length - southeastCompetitions.length,
  };
}

// Resolves every distinct assigned WCA person once for the full import.
async function resolveImportedPeople(competitions) {
  const profileByIdentity = new Map();
  const identityByWcaId = new Map();
  const identityByWcaUserId = new Map();

  for (const competition of competitions) {
    for (const person of [...competition.delegates, ...competition.organizers]) {
      const wcaId = person.wca_id ?? null;
      const wcaUserId = String(person.id);
      const wcaIdentity = wcaId ? identityByWcaId.get(wcaId) : null;
      const userIdentity = identityByWcaUserId.get(wcaUserId);
      if (wcaIdentity && userIdentity && wcaIdentity !== userIdentity) {
        throw new Error(`WCA person identifiers conflict for user ${wcaUserId}.`);
      }
      const identity =
        wcaIdentity ?? userIdentity ?? (wcaId ? `wca:${wcaId}` : `user:${wcaUserId}`);
      const existingProfile = profileByIdentity.get(identity);
      if (existingProfile && existingProfile.wcaUserId !== wcaUserId) {
        throw new Error(`WCA ID ${wcaId} is associated with multiple WCA user IDs.`);
      }
      if (existingProfile?.wcaId && wcaId && existingProfile.wcaId !== wcaId) {
        throw new Error(`WCA user ${wcaUserId} is associated with multiple WCA IDs.`);
      }

      if (wcaId) identityByWcaId.set(wcaId, identity);
      identityByWcaUserId.set(wcaUserId, identity);

      const profile = {
        wcaId: wcaId ?? existingProfile?.wcaId ?? null,
        wcaUserId,
        name: person.name,
        pictureUrl: person.avatar?.thumb_url ?? null,
      };
      profileByIdentity.set(
        identity,
        existingProfile
          ? {
              ...existingProfile,
              wcaId: existingProfile.wcaId ?? wcaId,
              pictureUrl: existingProfile.pictureUrl ?? profile.pictureUrl,
            }
          : profile,
      );
    }
  }

  const peopleIdByWcaId = new Map();
  const peopleIdByWcaUserId = new Map();
  for (const personBatch of chunk([...profileByIdentity.values()], PEOPLE_BATCH_SIZE)) {
    const people = await Promise.all(
      personBatch.map((person) => peopleDb.findOrCreatePersonFromWcaProfile(person)),
    );
    personBatch.forEach((person, index) => {
      if (person.wcaId) peopleIdByWcaId.set(person.wcaId, people[index].id);
      peopleIdByWcaUserId.set(person.wcaUserId, people[index].id);
    });
  }
  return { peopleIdByWcaId, peopleIdByWcaUserId };
}

// Reconciles only fetched fields, reusing existing row IDs and leaving other columns untouched.
async function upsertHistoricalCompetitionBatch(batch) {
  if (!batch.length) return { batchWithIds: [], insertedIds: [] };

  return withRetry(async (client) => {
    const wcaCompetitionIds = batch.map((competition) => competition.wca_competition_id);
    const { rows: existingRows } = await client.query(
      `SELECT id, wca_competition_id, is_multiple_cities_competition
       FROM competitions
       WHERE wca_competition_id = ANY($1)`,
      [wcaCompetitionIds],
    );
    const existingByWcaId = new Map();
    for (const row of existingRows) {
      const wcaCompetitionId = String(row.wca_competition_id);
      if (row.is_multiple_cities_competition) {
        throw new Error(
          `Refusing to import multi-city WCA competition ${wcaCompetitionId} in the standard history path.`,
        );
      }
      if (existingByWcaId.has(wcaCompetitionId)) {
        throw new Error(
          `Multiple existing competition rows use WCA competition ID ${wcaCompetitionId}.`,
        );
      }
      existingByWcaId.set(wcaCompetitionId, row);
    }

    const insertedIds = [];
    const batchWithIds = batch.map((competition) => {
      const existing = existingByWcaId.get(competition.wca_competition_id);
      const id = existing?.id ?? crypto.randomUUID();
      if (!existing) insertedIds.push(id);
      return { id, comp: competition };
    });
    const now = new Date();
    const valueGroups = [];
    const params = [];

    batchWithIds.forEach(({ id, comp }, rowIndex) => {
      const values = [
        id,
        comp.url,
        comp.name,
        comp.website,
        comp.city,
        comp.venue_address,
        comp.venue_details,
        comp.latitude_degrees,
        comp.longitude_degrees,
        comp.country_iso2,
        comp.start_date,
        comp.registration_open,
        comp.registration_close,
        comp.end_date,
        comp.competitor_limit,
        comp.venue,
        comp.venue_url,
        comp.state,
        comp.full_date,
        comp.wca_competition_id,
        comp.is_announced,
        comp.wca_drive_link,
        comp.wca_drive_folder_type,
        comp.is_cancelled,
        now,
      ];
      const placeholders = values.map(
        (_, columnIndex) => `$${rowIndex * HISTORICAL_COLUMNS.length + columnIndex + 1}`,
      );
      valueGroups.push(`(${placeholders.join(', ')})`);
      params.push(...values);
    });

    const updateSet = HISTORICAL_COLUMNS.filter((column) => column !== 'id')
      .map((column) => {
        if (column === 'announced_on_discord_at') {
          return `${column} = COALESCE(competitions.${column}, EXCLUDED.${column})`;
        }
        return `${column} = EXCLUDED.${column}`;
      })
      .join(', ');
    await client.query(
      `INSERT INTO competitions (${HISTORICAL_COLUMNS.join(', ')})
       VALUES ${valueGroups.join(', ')}
       ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
      params,
    );

    return { batchWithIds, insertedIds };
  });
}

// Reconciles competition data and replaces fetched event/assignment rows without refresh side effects.
async function persistHistoricalCompetitions(
  competitions,
  { peopleIdByWcaId, peopleIdByWcaUserId },
) {
  let imported = 0;
  let inserted = 0;

  for (const batch of chunk(competitions, IMPORT_BATCH_SIZE)) {
    const result = await upsertHistoricalCompetitionBatch(batch);
    const competitionIds = result.batchWithIds.map(({ id }) => id);
    await competitionEventsDb.replaceEventIds(
      result.batchWithIds.map(({ id, comp }) => ({ id, event_ids: comp.event_ids })),
    );

    const existingDelegateRows = await competitionDelegatesDb.listForCompetitions(competitionIds);
    const existingLeadWcaIds = new Map();
    for (const row of existingDelegateRows) {
      if (!row.is_lead) continue;
      const currentLeadWcaId = existingLeadWcaIds.get(row.competition_id);
      if (currentLeadWcaId) {
        throw new Error(`Multiple lead Delegate rows exist for competition ${row.competition_id}.`);
      }
      existingLeadWcaIds.set(row.competition_id, row.wca_id);
    }

    for (const { id, comp } of result.batchWithIds) {
      const delegateWcaIds = new Set(comp.delegates.map((delegate) => delegate.wca_id));
      const leadWcaId = comp.leadDelegateWcaId ?? existingLeadWcaIds.get(id);
      const retainedLeadWcaId = delegateWcaIds.has(leadWcaId) ? leadWcaId : null;
      await competitionDelegatesDb.replaceDelegatesForCompetition(
        id,
        comp.delegates.map((delegate) => ({
          peopleId: delegate.wca_id
            ? peopleIdByWcaId.get(delegate.wca_id)
            : peopleIdByWcaUserId.get(String(delegate.id)),
          isLead: retainedLeadWcaId !== null && delegate.wca_id === retainedLeadWcaId,
        })),
      );
      await competitionOrganizersDb.replaceOrganizersForCompetition(
        id,
        comp.organizers.map((organizer) =>
          organizer.wca_id
            ? peopleIdByWcaId.get(organizer.wca_id)
            : peopleIdByWcaUserId.get(String(organizer.id)),
        ),
      );
      await competitionUnofficialEventsDb.replaceUnofficialEventsForCompetition(
        id,
        comp.unofficialEvents,
      );
    }

    imported += result.batchWithIds.length;
    inserted += result.insertedIds.length;
  }
  return { imported, inserted };
}

// Runs the one-time standard competition history reconciliation.
async function main() {
  try {
    const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
    validateManifest(manifest);

    const wcaCompetitions = await fetchAllUsCompetitions();
    const { competitions, filteredNonSoutheast } = prepareHistoricalCompetitions(
      manifest,
      wcaCompetitions,
    );
    const resolvedPeople = await resolveImportedPeople(competitions);
    const result = await persistHistoricalCompetitions(competitions, resolvedPeople);

    logger.info(
      `Imported ${result.imported} competition(s) ` +
        `(${result.inserted} newly inserted); filtered ${filteredNonSoutheast} ` +
        `non-Southeast WCA competition(s).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Historical competition import failed:', error);
  process.exitCode = 1;
});
