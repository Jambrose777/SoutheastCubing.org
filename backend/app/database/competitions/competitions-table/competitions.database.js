const crypto = require('crypto');
const moment = require('moment');
const db = require('../../pool.js');

const logger = require('../../../utils/logger.util.js');
const { SOUTHEAST_STATES } = require('../../../helpers/southeastStates.helper.js');
const { COLUMNS, toRow, fromRow } = require('../../../helpers/competitions/competitionRows.helper.js');

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

// Fetches a single competition row by id, or null if it doesn't exist.
async function getCompetitionById(id) {
  const { rows } = await db.pool.query('SELECT * FROM competitions WHERE id = $1', [id]);
  return rows[0] ? fromRow(rows[0], []) : null;
}

module.exports = {
  getCompetitionsCount,
  upsertCompetitionsBatch,
  markAnnounced,
  getAnnouncedUpcomingCompetitions,
  getTrackedMajorWcaIds,
  updateMultiCityCompetitionRowsByWcaId,
  getCompetitionById,
};
