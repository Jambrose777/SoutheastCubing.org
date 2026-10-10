const crypto = require('crypto');
const moment = require('moment');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');
const { SOUTHEAST_STATES } = require('../helpers/southeastStates.helper.js');

// Treat older refresh claims as abandoned so a crashed process cannot block future refreshes.
const BULK_REFRESH_LOCK_TIMEOUT_MINUTES = 10;

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
  'waiting_list_count',
  'waiting_list_count_updated_at',
  'full_date',
  'wca_competition_id',
  'is_announced',
  'wca_drive_link',
  'wca_drive_folder_type',
  'is_multiple_cities_competition',
  'is_major',
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
    comp.waiting_list_count ?? null,
    comp.waiting_list_count_updated_at ?? null,
    comp.full_date,
    comp.wca_competition_id ?? null,
    comp.is_announced ?? false,
    comp.wca_drive_link ?? null,
    comp.wca_drive_folder_type ?? null,
    comp.is_multiple_cities_competition ?? false,
    comp.is_major ?? false,
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
    waiting_list_count: row.waiting_list_count,
    waiting_list_count_updated_at: row.waiting_list_count_updated_at,
    full_date: row.full_date,
    wca_competition_id: row.wca_competition_id,
    is_announced: row.is_announced,
    wca_drive_link: row.wca_drive_link,
    wca_drive_folder_type: row.wca_drive_folder_type,
    is_multiple_cities_competition: Boolean(row.is_multiple_cities_competition),
    is_major: Boolean(row.is_major),
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
  if (!batch.length) {
    return { insertedIds: [], batchWithIds: [], wcaDriveFolderNameChangedIds: [] };
  }

  return db.withRetry(async (client) => {
    const { rows: existingRows } = await client.query(
      'SELECT id, wca_competition_id, name, start_date, wca_drive_link FROM competitions WHERE wca_competition_id = ANY($1)',
      [batch.map((comp) => comp.wca_competition_id)],
    );
    const existingRowByWcaId = new Map(existingRows.map((row) => [row.wca_competition_id, row]));

    const insertedIds = [];
    const wcaDriveFolderNameChangedIds = [];
    const batchWithIds = batch.map((comp) => {
      const existingRow = existingRowByWcaId.get(comp.wca_competition_id);
      const existingId = existingRow?.id;
      const id = existingId ?? crypto.randomUUID();
      if (!existingId) insertedIds.push(id);
      if (
        existingRow?.wca_drive_link &&
        (existingRow.name !== comp.name ||
          moment.utc(existingRow.start_date).format('YYYY-MM-DD') !==
            moment.utc(comp.start_date).format('YYYY-MM-DD'))
      ) {
        wcaDriveFolderNameChangedIds.push(id);
      }
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
      .map((col) => {
        if (col === 'accepted_registrations') {
          return `${col} = CASE WHEN EXCLUDED.${col} = 0 AND competitions.${col} > 0 THEN competitions.${col} ELSE EXCLUDED.${col} END`;
        }
        if (col === 'waiting_list_count' || col === 'waiting_list_count_updated_at') {
          return `${col} = COALESCE(EXCLUDED.${col}, competitions.${col})`;
        }
        if (col === 'wca_drive_link') {
          return `${col} = COALESCE(EXCLUDED.${col}, competitions.${col})`;
        }
        if (col === 'wca_drive_folder_type') {
          return `${col} = COALESCE(EXCLUDED.${col}, competitions.${col})`;
        }
        if (col === 'is_major') {
          return `${col} = COALESCE(competitions.${col}, false) OR EXCLUDED.${col}`;
        }
        return `${col} = EXCLUDED.${col}`;
      })
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
    return { insertedIds, batchWithIds, wcaDriveFolderNameChangedIds };
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
      `SELECT id, url, name, website, city, venue_address, venue_details,
              latitude_degrees, longitude_degrees, country_iso2, start_date,
              registration_open, registration_close, end_date, competitor_limit,
              venue, venue_url, state, is_in_volunteer_application,
              accepted_registrations, waiting_list_count, waiting_list_count_updated_at,
              full_date, wca_competition_id, is_announced, is_multiple_cities_competition,
              is_major
       FROM competitions
       WHERE end_date >= $1 AND is_announced IS TRUE
         AND (is_major IS NOT TRUE OR LOWER(BTRIM(state)) = ANY($2::text[]))
       ORDER BY start_date ASC, name ASC`,
      [
        moment().add(-1, 'day').format('YYYY-MM-DD'),
        SOUTHEAST_STATES.map((state) => state.toLowerCase()),
      ],
    );
    return rows.map((row) => fromRow(row, []));
  } catch (err) {
    logger.error('Failed to fetch upcoming competitions from the competitions table: ', err);
    throw err;
  }
}

// Lists WCA ids already represented by major rows to bound supplemental lookups.
async function getTrackedMajorWcaIds() {
  try {
    const { rows } = await db.pool.query(
      `SELECT DISTINCT wca_competition_id
       FROM competitions
       WHERE is_major IS TRUE AND wca_competition_id IS NOT NULL`,
    );
    logger.debug(`Fetched ${rows.length} tracked major WCA id(s) from the competitions table.`);
    return rows.map((row) => row.wca_competition_id);
  } catch (err) {
    logger.error('Failed to fetch tracked major WCA ids from the competitions table: ', err);
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

// Refreshes WCA-owned fields on every local row for one multi-city competition.
async function updateMultiCityCompetitionRowsByWcaId(wcaCompetitionId, competition) {
  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        `UPDATE competitions
         SET url = $1, name = $2, website = $3, country_iso2 = $4,
             start_date = $5, registration_open = $6, registration_close = $7,
             end_date = $8, is_in_volunteer_application = $9,
             accepted_registrations = CASE
               WHEN $10 = 0 AND accepted_registrations > 0 THEN accepted_registrations
               ELSE $10
             END,
             waiting_list_count = COALESCE($11, waiting_list_count),
             waiting_list_count_updated_at = COALESCE($12, waiting_list_count_updated_at),
             full_date = $13, is_announced = $14,
             is_multiple_cities_competition = true
         WHERE wca_competition_id = $15
           AND is_multiple_cities_competition IS TRUE
         RETURNING id`,
        [
          competition.url,
          competition.name,
          competition.website,
          competition.country_iso2,
          competition.start_date,
          competition.registration_open,
          competition.registration_close,
          competition.end_date,
          competition.is_in_volunteer_application ?? false,
          competition.accepted_registrations ?? 0,
          competition.waiting_list_count ?? null,
          competition.waiting_list_count_updated_at ?? null,
          competition.full_date,
          competition.is_announced ?? false,
          String(wcaCompetitionId),
        ],
      ),
    );
    if (rows.length) {
      logger.debug(
        `Refreshed WCA-owned fields for ${rows.length} multi-city location row(s) for WCA competition ${wcaCompetitionId}.`,
      );
    }
    return rows.map((row) => row.id);
  } catch (error) {
    logger.error(
      `Failed to refresh multi-city location rows for WCA competition ${wcaCompetitionId}: `,
      error,
    );
    throw error;
  }
}

// Returns every competition still pending announcement on Discord.
async function getCompetitionsPendingDiscordAnnouncement() {
  try {
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE announced_on_discord_at IS NULL AND is_announced IS TRUE',
    );
    return rows.map((row) => fromRow(row, []));
  } catch (err) {
    logger.error(
      'Failed to fetch competitions pending Discord announcement from the competitions table: ',
      err,
    );
    throw err;
  }
}

// Reads when competitions were last refreshed from WCA.
async function getLastBulkRefreshAt() {
  try {
    const { rows } = await db.pool.query(
      'SELECT last_bulk_refresh_at FROM competitions_meta WHERE id = 1',
    );
    return rows[0]?.last_bulk_refresh_at ? moment(rows[0].last_bulk_refresh_at) : null;
  } catch (err) {
    logger.error('Failed to fetch last_bulk_refresh_at from the competitions_meta table: ', err);
    throw err;
  }
}

// Reads the last successful full refresh and whether one is running.
async function getBulkRefreshState() {
  try {
    const { rows } = await db.pool.query(
      'SELECT last_bulk_refresh_at, bulk_refresh_started_at FROM competitions_meta WHERE id = 1',
    );
    const row = rows[0];
    const lockCutoff = moment().subtract(BULK_REFRESH_LOCK_TIMEOUT_MINUTES, 'minutes');
    const refreshStartedAt = row?.bulk_refresh_started_at;
    return {
      lastBulkRefreshAt: row?.last_bulk_refresh_at ?? null,
      isRunning: !!refreshStartedAt && moment(refreshStartedAt).isAfter(lockCutoff),
    };
  } catch (err) {
    logger.error('Failed to fetch bulk refresh state from the competitions_meta table: ', err);
    throw err;
  }
}

// Claims the global bulk refresh slot unless another refresh is running or the
// last successful Planner bulk refresh is inside the cooldown window.
async function tryStartBulkRefresh(cooldownCutoff) {
  try {
    return await db.withRetry(async (client) => {
      const staleLockCutoff = moment()
        .subtract(BULK_REFRESH_LOCK_TIMEOUT_MINUTES, 'minutes')
        .toDate();
      const { rows: claimedRows } = await client.query(
        `UPDATE competitions_meta
         SET bulk_refresh_started_at = date_trunc('milliseconds', now())
         WHERE id = 1
           AND (bulk_refresh_started_at IS NULL OR bulk_refresh_started_at <= $2)
           AND (last_bulk_refresh_at IS NULL OR last_bulk_refresh_at <= $1)
         RETURNING last_bulk_refresh_at, bulk_refresh_started_at`,
        [cooldownCutoff, staleLockCutoff],
      );
      if (claimedRows.length) {
        return {
          started: true,
          lastBulkRefreshAt: claimedRows[0].last_bulk_refresh_at ?? null,
          bulkRefreshStartedAt: claimedRows[0].bulk_refresh_started_at,
          isRunning: true,
        };
      }

      const { rows } = await client.query(
        'SELECT last_bulk_refresh_at, bulk_refresh_started_at FROM competitions_meta WHERE id = 1',
      );
      const refreshStartedAt = rows[0]?.bulk_refresh_started_at;
      return {
        started: false,
        lastBulkRefreshAt: rows[0]?.last_bulk_refresh_at ?? null,
        bulkRefreshStartedAt: refreshStartedAt ?? null,
        isRunning:
          !!refreshStartedAt &&
          moment(refreshStartedAt).isAfter(
            moment().subtract(BULK_REFRESH_LOCK_TIMEOUT_MINUTES, 'minutes'),
          ),
      };
    });
  } catch (err) {
    logger.error('Failed to claim the bulk refresh slot in the competitions_meta table: ', err);
    throw err;
  }
}

// Records a successful full refresh and releases its global slot.
async function completeBulkRefresh(checkedAt, bulkRefreshStartedAt) {
  try {
    await db.withRetry(async (client) => {
      const { rows } = await client.query(
        `UPDATE competitions_meta
         SET last_bulk_refresh_at = $1, bulk_refresh_started_at = NULL
         WHERE id = 1 AND bulk_refresh_started_at = $2
         RETURNING id`,
        [checkedAt.toDate(), bulkRefreshStartedAt],
      );
      if (!rows.length) {
        throw new Error('Bulk refresh lock expired or was claimed by another refresh.');
      }
    });
    logger.debug(`Recorded successful full refresh at ${checkedAt.toISOString()}.`);
  } catch (err) {
    logger.error('Failed to record the full refresh in the competitions_meta table: ', err);
    throw err;
  }
}

// Releases the global slot after a failed Planner bulk refresh without
// advancing the last-successful-refresh timestamp.
async function releaseBulkRefresh(bulkRefreshStartedAt) {
  try {
    await db.withRetry(async (client) => {
      await client.query(
        `UPDATE competitions_meta
         SET bulk_refresh_started_at = NULL
         WHERE id = 1 AND bulk_refresh_started_at = $1`,
        [bulkRefreshStartedAt],
      );
    });
    logger.debug('Released the full refresh slot in the competitions_meta table.');
  } catch (err) {
    logger.error('Failed to release the bulk refresh slot in the competitions_meta table: ', err);
    throw err;
  }
}

// Fetches a single competition row by id, or null if it doesn't exist.
async function getCompetitionById(id) {
  const { rows } = await db.pool.query('SELECT * FROM competitions WHERE id = $1', [id]);
  return rows[0] ? fromRow(rows[0], []) : null;
}

// Finds the Drive folder already associated with a multi-city WCA competition.
async function getWcaDriveLinkByWcaCompetitionId(wcaCompetitionId) {
  try {
    const { rows } = await db.pool.query(
      `SELECT wca_drive_link, wca_drive_folder_type
       FROM competitions
       WHERE wca_competition_id = $1
         AND is_multiple_cities_competition IS TRUE
         AND wca_drive_link IS NOT NULL
       ORDER BY id
       LIMIT 1`,
      [String(wcaCompetitionId)],
    );
    return rows[0] ?? null;
  } catch (error) {
    logger.error(
      `Failed to fetch the WCA Drive folder link for WCA competition ${wcaCompetitionId}:`,
      error,
    );
    throw error;
  }
}

// Lists every competition with a Drive folder, including past competitions up to 14 days ago.
async function getCompetitionsWithWcaDriveLink() {
  try {
    const cutoffDate = moment.utc().subtract(14, 'days').format('YYYY-MM-DD');
    const { rows } = await db.pool.query(
      'SELECT * FROM competitions WHERE wca_drive_link IS NOT NULL AND end_date >= $1',
      [cutoffDate],
    );
    return rows.map((row) => fromRow(row, []));
  } catch (error) {
    logger.error(
      'Failed to fetch competitions with WCA Drive folders from the competitions table:',
      error,
    );
    throw error;
  }
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
  isMajor = false,
}) {
  await db.pool.query(
    `INSERT INTO competitions (
       id, name, city, state, venue_address, venue_details, venue, venue_url,
       latitude_degrees, longitude_degrees, start_date, end_date, full_date,
       competitor_limit, is_announced, is_major
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false, $15)`,
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
      isMajor,
    ],
  );
  logger.debug(`Created a new Planner competition row (id ${id}).`);
}

// Creates a new Planner row directly from an unannounced WCA competition.
async function createPlannerCompetitionLinkedToWca(comp) {
  const id = crypto.randomUUID();
  const row = toRow(id, comp);
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
  const row = toRow(id, comp);
  const columnsToUpdate = COLUMNS.filter(
    (column) =>
      column !== 'id' &&
      column !== 'wca_drive_link' &&
      column !== 'wca_drive_folder_type' &&
      column !== 'is_major',
  );
  const rowByColumn = Object.fromEntries(COLUMNS.map((column, index) => [column, row[index]]));
  const updateSet = columnsToUpdate.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const params = [...columnsToUpdate.map((column) => rowByColumn[column]), id];

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

// Sets or clears a competition's Drive folder URL and synchronized category.
async function setWcaDriveLink(id, folderLink, folderType = null) {
  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        'UPDATE competitions SET wca_drive_link = $1, wca_drive_folder_type = $2 WHERE id = $3 RETURNING id',
        [folderLink ?? null, folderLink ? folderType : null, id],
      ),
    );
    if (rows.length) {
      logger.debug(
        `Updated the WCA Drive folder link for competition ${id} in the competitions table.`,
      );
    }
    return rows.length > 0;
  } catch (error) {
    logger.error(`Failed to update the WCA Drive folder link for competition ${id}:`, error);
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
  const { rows } = await db.pool.query(
    `UPDATE competitions
     SET name = $1, city = $2, state = $3, venue_address = $4, venue_details = $5,
         venue = $6, venue_url = $7, latitude_degrees = $8, longitude_degrees = $9,
         start_date = $10, end_date = $11, full_date = $12, competitor_limit = $13
       WHERE id = $14
       RETURNING *`,
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
  return rows[0] ? fromRow(rows[0], []) : null;
}

// Updates only the Planner-owned location fields on a linked multi-city row.
async function updateMultiCityLocationFields(id, location) {
  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        `UPDATE competitions
         SET city = $1, state = $2, venue_address = $3, venue_details = $4,
             venue = $5, venue_url = $6, latitude_degrees = $7,
             longitude_degrees = $8, competitor_limit = $9
         WHERE id = $10 AND is_multiple_cities_competition IS TRUE
         RETURNING *`,
        [
          location.city,
          location.state,
          location.venueAddress,
          location.venueDetails,
          location.venue,
          location.venueUrl ?? null,
          location.latitudeDegrees,
          location.longitudeDegrees,
          location.competitorLimit,
          id,
        ],
      ),
    );
    if (rows.length) {
      logger.debug(`Updated Planner location fields for multi-city competition (id ${id}).`);
    }
    return rows[0] ? fromRow(rows[0], []) : null;
  } catch (error) {
    logger.error(
      `Failed to update Planner location fields for multi-city competition (id ${id}):`,
      error,
    );
    throw error;
  }
}

// Deletes a Planner-created competition row and its join-table rows - only
// ever called for a still-Potential/Planning competition.
async function deletePlannerCompetition(id) {
  await db.withRetry(async (client) => {
    await client.query('DELETE FROM competition_delegates WHERE competition_id = $1', [id]);
    await client.query('DELETE FROM competition_organizers WHERE competition_id = $1', [id]);
    await client.query('DELETE FROM competition_equipment_holders WHERE competition_id = $1', [id]);
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
  getTrackedMajorWcaIds,
  updateMultiCityCompetitionRowsByWcaId,
  getCompetitionsPendingDiscordAnnouncement,
  getLastBulkRefreshAt,
  getBulkRefreshState,
  tryStartBulkRefresh,
  completeBulkRefresh,
  releaseBulkRefresh,
  getCompetitionById,
  getWcaDriveLinkByWcaCompetitionId,
  getCompetitionsWithWcaDriveLink,
  createPlannerCompetition,
  createPlannerCompetitionLinkedToWca,
  linkPlannerCompetitionToWca,
  updatePlannerCompetitionFields,
  updateMultiCityLocationFields,
  setWcaDriveLink,
  deletePlannerCompetition,
};
