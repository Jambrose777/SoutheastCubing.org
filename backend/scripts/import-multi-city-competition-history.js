const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const moment = require('moment');

const wca = require('../app/integrations/wca.integration.js');
const competitionEventsDb = require('../app/database/competitions/competitionEvents.database.js');
const competitionDelegatesDb = require('../app/database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../app/database/competitions/competitionOrganizers.database.js');
const peopleDb = require('../app/database/people/people.database.js');
const peopleService = require('../app/services/people/people.service.js');
const { pool, withRetry } = require('../app/database/pool.js');
const { getFullCompetitionDate } = require('../app/helpers/competitions/competitionDates.helper.js');
const { SOUTHEAST_STATES } = require('../app/helpers/competitions/states.helper.js');
const logger = require('../app/utils/logger.util.js');

const MANIFEST_PATH = path.join(__dirname, 'competitions-history-multi-city.json');
const WCA_ID_PATTERN = /^\d{4}[A-Z]{4}\d{2}$/;
const WCA_DRIVE_FOLDER_PATTERN = /^https:\/\/drive\.google\.com\/drive\/folders\/[^/?#]+$/;
const UPSERTED_COLUMNS = [
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
  'is_multiple_cities_competition',
  'is_cancelled',
];

// Converts a JSON number or numeric string to a finite number.
function parseFiniteNumber(value, fieldName, competitionId) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (value === null || value === '' || !Number.isFinite(parsed)) {
    throw new Error(`${fieldName} is invalid for ${competitionId}.`);
  }
  return parsed;
}

// Validates and canonicalizes one manually sourced Southeast location.
function normalizeLocation(location, competitionId) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new Error(`A location entry is invalid for ${competitionId}.`);
  }

  for (const field of ['city', 'venue', 'venueDetails', 'venueAddress']) {
    if (typeof location[field] !== 'string' || !location[field].trim()) {
      throw new Error(`${field} is required for ${competitionId}.`);
    }
  }

  const state = SOUTHEAST_STATES.find(
    (candidate) => candidate.toLowerCase() === String(location.state).trim().toLowerCase(),
  );
  if (!state) throw new Error(`State is not a Southeast state for ${competitionId}.`);

  const competitorLimit = parseFiniteNumber(
    location.competitorLimit,
    'Competitor limit',
    competitionId,
  );
  if (!Number.isInteger(competitorLimit) || competitorLimit < 0) {
    throw new Error(`Competitor limit must be a non-negative integer for ${competitionId}.`);
  }

  if (!Array.isArray(location.delegates) || location.delegates.length === 0) {
    throw new Error(`At least one Delegate is required for ${competitionId}.`);
  }
  const seenDelegateIds = new Set();
  for (const delegate of location.delegates) {
    if (
      typeof delegate?.name !== 'string' ||
      !delegate.name.trim() ||
      typeof delegate.wcaId !== 'string' ||
      !WCA_ID_PATTERN.test(delegate.wcaId)
    ) {
      throw new Error(`A Delegate is missing a valid WCA ID for ${competitionId}.`);
    }
    if (seenDelegateIds.has(delegate.wcaId)) {
      throw new Error(`Delegate ${delegate.wcaId} is repeated for ${competitionId}.`);
    }
    seenDelegateIds.add(delegate.wcaId);
  }
  if (
    typeof location.leadDelegateWcaId !== 'string' ||
    !seenDelegateIds.has(location.leadDelegateWcaId)
  ) {
    throw new Error(`Lead Delegate is not assigned to a location for ${competitionId}.`);
  }

  return {
    city: location.city.trim(),
    state,
    delegates: location.delegates,
    leadDelegateWcaId: location.leadDelegateWcaId,
    competitorLimit,
    venue: location.venue.trim(),
    venueDetails: location.venueDetails.trim(),
    venueUrl: typeof location.venueUrl === 'string' ? location.venueUrl.trim() || null : null,
    venueAddress: location.venueAddress.trim(),
    latitudeDegrees: parseFiniteNumber(location.latitudeDegrees, 'Latitude', competitionId),
    longitudeDegrees: parseFiniteNumber(location.longitudeDegrees, 'Longitude', competitionId),
  };
}

// Validates manifest identities, Drive links, and per-competition locations.
function validateManifest(manifest) {
  if (!Array.isArray(manifest)) throw new Error('Multi-city history JSON must be an array.');
  const seenCompetitionIds = new Set();

  return manifest.map((entry) => {
    if (typeof entry?.competitionId !== 'string' || !entry.competitionId) {
      throw new Error('Every multi-city history entry must have a competition ID.');
    }
    if (seenCompetitionIds.has(entry.competitionId)) {
      throw new Error(`Multi-city history JSON repeats ${entry.competitionId}.`);
    }
    seenCompetitionIds.add(entry.competitionId);

    if (
      entry.wcaDriveLink !== null &&
      (typeof entry.wcaDriveLink !== 'string' || !WCA_DRIVE_FOLDER_PATTERN.test(entry.wcaDriveLink))
    ) {
      throw new Error(`WCA Drive folder URL is invalid for ${entry.competitionId}.`);
    }
    if (!Array.isArray(entry.locations) || entry.locations.length === 0) {
      throw new Error(`At least one location is required for ${entry.competitionId}.`);
    }

    const locations = entry.locations.map((location) =>
      normalizeLocation(location, entry.competitionId),
    );
    const locationKeys = new Set();
    for (const location of locations) {
      const key = `${location.city.toLowerCase()}|${location.state.toLowerCase()}`;
      if (locationKeys.has(key)) {
        throw new Error(
          `Location ${location.city}, ${location.state} is repeated for ${entry.competitionId}.`,
        );
      }
      locationKeys.add(key);
    }
    return { competitionId: entry.competitionId, wcaDriveLink: entry.wcaDriveLink, locations };
  });
}

// Validates the directly fetched WCA record and creates its shared field set.
function normalizeWcaCompetition(competition, expectedId, wcaDriveLink) {
  if (!competition || String(competition.id) !== expectedId) {
    throw new Error(`WCA returned the wrong competition for ${expectedId}.`);
  }
  if (
    typeof competition.city !== 'string' ||
    competition.city.trim().toLowerCase() !== 'multiple cities'
  ) {
    throw new Error(`WCA competition ${expectedId} is no longer marked Multiple cities.`);
  }
  for (const field of ['start_date', 'end_date']) {
    if (
      typeof competition[field] !== 'string' ||
      !moment.utc(competition[field], 'YYYY-MM-DD', true).isValid()
    ) {
      throw new Error(`WCA competition ${expectedId} has an invalid ${field}.`);
    }
  }
  if (
    !Array.isArray(competition.event_ids) ||
    competition.event_ids.some((eventId) => typeof eventId !== 'string')
  ) {
    throw new Error(`WCA competition ${expectedId} has invalid official events.`);
  }
  if (competition.organizers != null && !Array.isArray(competition.organizers)) {
    throw new Error(`WCA competition ${expectedId} has invalid organizers.`);
  }

  return {
    url: competition.url ?? null,
    name: competition.name ?? null,
    website: competition.website ?? null,
    country_iso2: competition.country_iso2 ?? null,
    start_date: competition.start_date,
    registration_open: competition.registration_open ?? null,
    registration_close: competition.registration_close ?? null,
    end_date: competition.end_date,
    full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
    wca_competition_id: expectedId,
    is_announced: Boolean(competition.announced_at),
    is_cancelled: competition.cancelled_at != null,
    wca_drive_link: wcaDriveLink,
    wca_drive_folder_type: wcaDriveLink ? 'past' : null,
    event_ids: competition.event_ids,
    organizers: competition.organizers ?? [],
  };
}

// Resolves each distinct manually assigned location Delegate from WCA once.
async function resolveLocationDelegates(competitions) {
  const wcaIds = new Set();
  for (const competition of competitions) {
    for (const location of competition.locations) {
      for (const delegate of location.delegates) wcaIds.add(delegate.wcaId);
    }
  }

  const peopleIdByWcaId = new Map();
  for (const wcaId of wcaIds) {
    const person = await peopleService.resolvePerson({ wcaId });
    if (person.wcaId !== wcaId) {
      throw new Error(`Resolved person does not match Delegate WCA ID ${wcaId}.`);
    }
    peopleIdByWcaId.set(wcaId, person.peopleId);
  }
  return peopleIdByWcaId;
}

// Resolves WCA organizer profiles once and shares their local ids across rows.
async function resolveOrganizers(competitions) {
  const profilesByIdentity = new Map();
  for (const competition of competitions) {
    for (const person of competition.organizers) {
      const wcaId = person?.wca_id ?? null;
      const wcaUserId = person?.id == null ? '' : String(person.id);
      if (!wcaUserId || typeof person.name !== 'string' || !person.name.trim()) {
        throw new Error(
          `WCA organizer data is missing an identity for ${competition.wca_competition_id}.`,
        );
      }
      const identity = wcaId ? `wca:${wcaId}` : `user:${wcaUserId}`;
      const priorProfile = profilesByIdentity.get(identity);
      if (priorProfile && priorProfile.wcaUserId !== wcaUserId) {
        throw new Error(`WCA organizer identifiers conflict for ${identity}.`);
      }
      profilesByIdentity.set(identity, {
        wcaId,
        wcaUserId,
        name: person.name,
        pictureUrl: person.avatar?.thumb_url ?? null,
      });
    }
  }

  const peopleIdByIdentity = new Map();
  for (const profile of profilesByIdentity.values()) {
    const person = await peopleDb.findOrCreatePersonFromWcaProfile(profile);
    const identity = profile.wcaId ? `wca:${profile.wcaId}` : `user:${profile.wcaUserId}`;
    peopleIdByIdentity.set(identity, person.id);
  }
  return peopleIdByIdentity;
}

// Maps one location and its shared WCA record to the owned database columns.
function formatLocationCompetition(wcaCompetition, location) {
  return {
    ...wcaCompetition,
    city: location.city,
    state: location.state,
    venue_address: location.venueAddress,
    venue_details: location.venueDetails,
    latitude_degrees: location.latitudeDegrees,
    longitude_degrees: location.longitudeDegrees,
    competitor_limit: location.competitorLimit,
    venue: location.venue,
    venue_url: location.venueUrl,
    is_multiple_cities_competition: true,
    delegates: location.delegates,
    leadDelegateWcaId: location.leadDelegateWcaId,
  };
}

// Inserts or refreshes one location while preserving its local id and other fields.
async function upsertLocationCompetition(comp) {
  return withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      `SELECT id, city, state, is_multiple_cities_competition
       FROM competitions
       WHERE wca_competition_id = $1`,
      [comp.wca_competition_id],
    );
    if (existingRows.some((row) => !row.is_multiple_cities_competition)) {
      throw new Error(
        `Refusing to reconcile ${comp.wca_competition_id}: an ordinary competition row uses its WCA ID.`,
      );
    }

    const locationKey = (city, state) =>
      `${city?.trim().toLowerCase()}|${state?.trim().toLowerCase()}`;
    const targetKey = locationKey(comp.city, comp.state);
    const matches = existingRows.filter((row) => locationKey(row.city, row.state) === targetKey);
    if (matches.length > 1) {
      throw new Error(
        `Multiple local rows match ${comp.wca_competition_id} at ${comp.city}, ${comp.state}.`,
      );
    }
    if (existingRows.some((row) => !row.city || !row.state)) {
      throw new Error(
        `Cannot safely match an incomplete location for multi-city WCA competition ${comp.wca_competition_id}.`,
      );
    }

    const existing = matches[0];
    const values = UPSERTED_COLUMNS.map((column) => comp[column] ?? null);
    if (existing) {
      const assignments = UPSERTED_COLUMNS.map((column, index) => `${column} = $${index + 1}`);
      assignments.push('announced_on_discord_at = COALESCE(announced_on_discord_at, now())');
      await client.query(
        `UPDATE competitions SET ${assignments.join(', ')} WHERE id = $${values.length + 1}`,
        [...values, existing.id],
      );
      return { id: existing.id, inserted: false };
    }

    const id = crypto.randomUUID();
    const columns = ['id', ...UPSERTED_COLUMNS, 'announced_on_discord_at'];
    const placeholders = UPSERTED_COLUMNS.map((_, index) => `$${index + 2}`);
    await client.query(
      `INSERT INTO competitions (${columns.join(', ')})
       VALUES ($1, ${placeholders.join(', ')}, now())`,
      [id, ...values],
    );
    return { id, inserted: true };
  });
}

// Saves location rows and replaces only WCA events and owned assignments.
async function persistCompetitions(competitions, peopleIdByWcaId, organizerIdsByIdentity) {
  let imported = 0;
  let inserted = 0;
  for (const competition of competitions) {
    const savedRows = [];
    for (const location of competition.locations) {
      const formatted = formatLocationCompetition(competition, location);
      const result = await upsertLocationCompetition(formatted);
      savedRows.push({ id: result.id, comp: formatted });
      imported += 1;
      if (result.inserted) inserted += 1;

      await competitionDelegatesDb.replaceDelegatesForCompetition(
        result.id,
        location.delegates.map((delegate) => ({
          peopleId: peopleIdByWcaId.get(delegate.wcaId),
          isLead: delegate.wcaId === location.leadDelegateWcaId,
        })),
      );
      const organizerPeopleIds = competition.organizers.map((organizer) => {
        const identity = organizer.wca_id
          ? `wca:${organizer.wca_id}`
          : `user:${String(organizer.id)}`;
        const peopleId = organizerIdsByIdentity.get(identity);
        if (!peopleId) {
          throw new Error(
            `WCA organizer ${identity} was not resolved for ${competition.wca_competition_id}.`,
          );
        }
        return peopleId;
      });
      await competitionOrganizersDb.replaceOrganizersForCompetition(result.id, organizerPeopleIds);
    }
    await competitionEventsDb.replaceEventIds(
      savedRows.map(({ id, comp }) => ({ id, event_ids: comp.event_ids })),
    );
  }
  return { imported, inserted };
}

// Fetches and validates each manifest competition directly from WCA.
async function fetchCompetitions(manifest) {
  const competitions = [];
  for (const entry of manifest) {
    const record = await wca.fetchCompetitionById(entry.competitionId);
    competitions.push({
      ...normalizeWcaCompetition(record, entry.competitionId, entry.wcaDriveLink),
      locations: entry.locations,
    });
  }
  return competitions;
}

// Runs the one-time multi-city competition history reconciliation.
async function main() {
  try {
    const manifest = validateManifest(JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')));
    const competitions = await fetchCompetitions(manifest);
    const peopleIdByWcaId = await resolveLocationDelegates(competitions);
    const organizerIdsByIdentity = await resolveOrganizers(competitions);
    const result = await persistCompetitions(competitions, peopleIdByWcaId, organizerIdsByIdentity);
    logger.info(
      `Imported ${result.imported} multi-city location(s) (${result.inserted} newly inserted).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Multi-city competition history import failed:', error);
  process.exitCode = 1;
});
