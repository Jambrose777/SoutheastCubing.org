const crypto = require('crypto');
const moment = require('moment');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Columns of the `competitions` table, in the order used when building the
// multi-row upsert below - keep this in sync with the competitions table in
// schema-snapshot.sql
const COLUMNS = [
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
  'is_in_volunteer_application',
  'accepted_registrations',
  'full_date',
  'wca_competition_id',
  'is_announced',
];

// Maps a formatted WCA competition object (see competitions.js's
// formatCompetitionData()) to a `competitions` row value tuple, in COLUMNS
// order. Event ids are stored separately in competition_events (see 
// upsertCompetitions), so they're not part of this row.
function toRow(id, comp) {
  return [
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
    comp.venue_url ?? null,
    comp.state,
    comp.is_in_volunteer_application ?? false,
    comp.accepted_registrations ?? null,
    comp.full_date,
    comp.wca_competition_id ?? null,
    comp.is_announced ?? false,
  ];
}

// Maps a `competitions` row (plus its already-fetched event ids) back to
// the object shape formatCompetitionData() produces.
function fromRow(row, eventIds) {
  return {
    url: row.url,
    id: row.id,
    name: row.name,
    website: row.website,
    city: row.city,
    venue_address: row.venue_address,
    venue_details: row.venue_details,
    latitude_degrees: row.latitude_degrees,
    longitude_degrees: row.longitude_degrees,
    country_iso2: row.country_iso2,
    start_date: row.start_date,
    registration_open: row.registration_open,
    registration_close: row.registration_close,
    end_date: row.end_date,
    competitor_limit: row.competitor_limit,
    event_ids: eventIds,
    venue: row.venue,
    venue_url: row.venue_url,
    state: row.state,
    is_in_volunteer_application: row.is_in_volunteer_application,
    accepted_registrations: row.accepted_registrations,
    full_date: row.full_date,
    wca_competition_id: row.wca_competition_id,
    is_announced: row.is_announced,
  };
}

// Total row count in the competitions table - detectss first-time-population case.
async function getCompetitionsCount() {
  const { rows } = await db.pool.query('SELECT COUNT(*) FROM competitions');
  return Number(rows[0].count);
}

// Upserts one batch of `comps` (each with a `wca_competition_id`) in a single
// transaction, returning `{ insertedIds, batchWithIds }` - `insertedIds` is the
// subset of surrogate ids newly inserted in this batch `batchWithIds` pairs 
// every comp in the batch (new or updated) with its surrogate id,
// `wca_competition_id` isn't a unique column - looks up any existing row per 
// `wca_competition_id` first and reuses its surrogate id, generating a fresh 
// one only when none exists yet, then upserts by that id.
async function upsertCompetitionsBatch(batch) {
  if (!batch.length) return { insertedIds: [], batchWithIds: [] };

  return db.withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT id, wca_competition_id FROM competitions WHERE wca_competition_id = ANY($1)',
      [batch.map((comp) => comp.wca_competition_id)],
    );
    const existingIdByWcaId = new Map(existingRows.map((row) => [row.wca_competition_id, row.id]));

    const insertedIds = [];
    const batchWithIds = batch.map((comp) => {
      const existingId = existingIdByWcaId.get(comp.wca_competition_id);
      const id = existingId ?? crypto.randomUUID();
      if (!existingId) insertedIds.push(id);
      return { id, comp };
    });

    const valueGroups = [];
    const params = [];
    batchWithIds.forEach(({ id, comp }, i) => {
      const row = toRow(id, comp);
      const placeholders = row.map((_, colIdx) => `$${i * COLUMNS.length + colIdx + 1}`);
      valueGroups.push(`(${placeholders.join(', ')})`);
      params.push(...row);
    });

    const updateSet = COLUMNS.filter((col) => col !== 'id')
      .map((col) =>
        // A re-synced 0 should never  clobber a previously-stored real count.
        col === 'accepted_registrations'
          ? `${col} = CASE WHEN EXCLUDED.${col} = 0 THEN competitions.${col} ELSE EXCLUDED.${col} END`
          : `${col} = EXCLUDED.${col}`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO competitions (${COLUMNS.join(', ')})
       VALUES ${valueGroups.join(', ')}
       ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
      params,
    );

    logger.debug(
      `Upserted ${batch.length} competition(s) in the competitions table (${insertedIds.length} newly inserted).`,
    );
    return { insertedIds, batchWithIds };
  });
}

// Marks the given competition ids as announced, so they're never re-posted
// to Discord on a later refresh.
async function markAnnounced(ids) {
  if (!ids.length) return;
  try {
    await db.withRetry(async (client) => {
      await client.query(
        'UPDATE competitions SET announced_on_discord_at = now() WHERE id = ANY($1)',
        [ids],
      );
    });
    logger.debug(`Marked ${ids.length} competition(s) as announced in the competitions table.`);
  } catch (err) {
    logger.error(
      `Failed to mark ${ids.length} competition(s) as announced in the competitions table: `,
      err,
    );
    throw err;
  }
}

// Returns every announced competition ending on or after yesterday, ordered
// by start date, ties broken by name.
async function getAnnouncedUpcomingCompetitions() {
  try {
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE end_date >= $1 AND is_announced IS TRUE ORDER BY start_date ASC, name ASC',
      [moment().add(-1, 'day').format('YYYY-MM-DD')],
    );
    return rows.map((row) => fromRow(row, []));
  } catch (err) {
    logger.error('Failed to fetch upcoming competitions from the competitions table: ', err);
    throw err;
  }
}

// Returns every upcoming competition regardless of status for the Competition
// Planner tool. Given a 1 day grace period so competitions don't disappear
// from the list due to timezones.
async function getAllUpcomingCompetitionsForPlanner() {
  try {
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE end_date >= $1 ORDER BY start_date ASC, name ASC',
      [moment().add(-1, 'day').format('YYYY-MM-DD')],
    );
    const comps = rows.map((row) => fromRow(row, []));
    return comps;
  } catch (err) {
    logger.error('Failed to fetch upcoming competitions for the Competition Planner: ', err);
    throw err;
  }
}

// Returns every competition that hasn't been announced on Discord yet.
async function getUnannouncedCompetitions() {
  try {
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE announced_on_discord_at IS NULL',
    );
    return rows.map((row) => fromRow(row, []));
  } catch (err) {
    logger.error('Failed to fetch unannounced competitions from the competitions table: ', err);
    throw err;
  }
}

// Reads when competitions were last refreshed from WCA - used to rate-limit
// POST /update-competitions and to decide whether a boot-time refresh is
// needed.
async function getLastChecked() {
  try {
    const { rows } = await db.pool.query('SELECT last_checked FROM competitions_meta WHERE id = 1');
    logger.debug(
      `Fetched last_checked from the competitions_meta table: ${rows[0]?.last_checked ?? 'never'}.`,
    );
    return rows[0]?.last_checked ? moment(rows[0].last_checked) : null;
  } catch (err) {
    logger.error('Failed to fetch last_checked from the competitions_meta table: ', err);
    throw err;
  }
}

// Records that competitions were just refreshed from WCA.
async function setLastChecked(checkedAt) {
  try {
    await db.withRetry(async (client) => {
      await client.query('UPDATE competitions_meta SET last_checked = $1 WHERE id = 1', [
        checkedAt.toDate(),
      ]);
    });
    logger.debug(`Set last_checked in the competitions_meta table to ${checkedAt.toISOString()}.`);
  } catch (err) {
    logger.error('Failed to set last_checked in the competitions_meta table: ', err);
    throw err;
  }
}

// Fetches a single competition row by id, or null if it doesn't exist.
async function getCompetitionById(id) {
  const { rows } = await db.pool.query('SELECT * FROM competitions WHERE id = $1', [id]);
  return rows[0] ? fromRow(rows[0], []) : null;
}

// Inserts a brand-new Planner-created competition row with every field a
// Delegate can supply by hand.
async function createPlannerCompetition({
  id,
  name,
  city,
  state,
  venueAddress,
  venueDetails,
  venue,
  venueUrl,
  latitudeDegrees,
  longitudeDegrees,
  startDate,
  endDate,
  fullDate,
  competitorLimit,
}) {
  await db.pool.query(
    `INSERT INTO competitions (
       id, name, city, state, venue_address, venue_details, venue, venue_url,
       latitude_degrees, longitude_degrees, start_date, end_date, full_date,
       competitor_limit, is_announced
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
    [
      id,
      name,
      city,
      state,
      venueAddress ?? null,
      venueDetails ?? null,
      venue ?? null,
      venueUrl ?? null,
      latitudeDegrees ?? null,
      longitudeDegrees ?? null,
      startDate,
      endDate,
      fullDate,
      competitorLimit ?? null,
    ],
  );
  logger.debug(`Created a new Planner competition row (id ${id}).`);
}

// Creates a new Planner row directly from an unannounced WCA competition.
async function createPlannerCompetitionLinkedToWca(comp) {
  const id = crypto.randomUUID();
  const row = toRow(id, { ...comp, is_announced: false });
  try {
    await db.withRetry(async (client) => {
      const placeholders = row.map((_, index) => `$${index + 1}`);
      await client.query(
        `INSERT INTO competitions (${COLUMNS.join(', ')})
         VALUES (${placeholders.join(', ')})`,
        row,
      );
    });
    logger.debug(
      `Created a WCA-linked competition row (id ${id}, WCA competition ${comp.wca_competition_id}) in the competitions table.`,
    );
    return id;
  } catch (error) {
    logger.error(
      `Failed to create a WCA-linked competition row for WCA competition ${comp.wca_competition_id}: `,
      error,
    );
    throw error;
  }
}

// Links a WCA competition to an existing Potential row, preserving its Planner id.
async function linkPlannerCompetitionToWca(id, comp) {
  const row = toRow(id, { ...comp, is_announced: false });
  const columnsToUpdate = COLUMNS.slice(1);
  const updateSet = columnsToUpdate
    .map((column, index) => `${column} = $${index + 1}`)
    .join(', ');
  const params = [...row.slice(1), id];

  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        `UPDATE competitions
         SET ${updateSet}
         WHERE id = $${params.length} AND wca_competition_id IS NULL
         RETURNING id`,
        params,
      ),
    );
    if (rows.length) {
      logger.debug(
        `Linked WCA competition ${comp.wca_competition_id} to competition row ${id} in the competitions table.`,
      );
    }
    return rows.length > 0;
  } catch (error) {
    logger.error(
      `Failed to link WCA competition ${comp.wca_competition_id} to competition row ${id}: `,
      error,
    );
    throw error;
  }
}

// Updates a Planner-created competition's own hand-entered fields - only
// ever called while still Potential, since these become WCA-synced (and
// read-only) once linked.
async function updatePlannerCompetitionFields(
  id,
  {
    name,
    city,
    state,
    venueAddress,
    venueDetails,
    venue,
    venueUrl,
    latitudeDegrees,
    longitudeDegrees,
    startDate,
    endDate,
    fullDate,
    competitorLimit,
  },
) {
  await db.pool.query(
    `UPDATE competitions
     SET name = $1, city = $2, state = $3, venue_address = $4, venue_details = $5,
         venue = $6, venue_url = $7, latitude_degrees = $8, longitude_degrees = $9,
         start_date = $10, end_date = $11, full_date = $12, competitor_limit = $13
     WHERE id = $14`,
    [
      name,
      city,
      state,
      venueAddress ?? null,
      venueDetails ?? null,
      venue ?? null,
      venueUrl ?? null,
      latitudeDegrees ?? null,
      longitudeDegrees ?? null,
      startDate,
      endDate,
      fullDate,
      competitorLimit ?? null,
      id,
    ],
  );
  logger.debug(`Updated Planner competition fields for competition_id ${id}.`);
}


// Deletes a Planner-created competition row and its join-table rows - only
// ever called for a still-Potential/Planning competition.
async function deletePlannerCompetition(id) {
  await db.withRetry(async (client) => {
    await client.query('DELETE FROM competition_delegates WHERE competition_id = $1', [id]);
    await client.query('DELETE FROM competition_organizers WHERE competition_id = $1', [id]);
    await client.query('DELETE FROM competition_equipment_holders WHERE competition_id = $1', [
      id,
    ]);
    await client.query('DELETE FROM competition_events WHERE competition_id = $1', [id]);
    await client.query('DELETE FROM competitions WHERE id = $1', [id]);
  });
  logger.debug(`Deleted Planner competition (id ${id}).`);
}

module.exports = {
  getCompetitionsCount,
  upsertCompetitionsBatch,
  markAnnounced,
  getAnnouncedUpcomingCompetitions,
  getAllUpcomingCompetitionsForPlanner,
  getUnannouncedCompetitions,
  getLastChecked,
  setLastChecked,
  getCompetitionById,
  createPlannerCompetition,
  createPlannerCompetitionLinkedToWca,
  linkPlannerCompetitionToWca,
  updatePlannerCompetitionFields,
  deletePlannerCompetition,
};
