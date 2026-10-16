const crypto = require('crypto');
const moment = require('moment');
const db = require('../../pool.js');
const logger = require('../../../utils/logger.util.js');
const { COLUMNS, toRow, fromRow } = require('../../../helpers/competitions/competitionRows.helper.js');

// Returns the requested Planner date scope with the existing one-day grace period.
async function getCompetitionsForPlanner(view) {
  try {
    const isPast = view === 'past';
    const dateOperator = isPast ? '<' : '>=';
    const startDateDirection = isPast ? 'DESC' : 'ASC';
    const { rows } = await db.pool.query(
      `SELECT * FROM competitions
       WHERE end_date ${dateOperator} $1
       ORDER BY start_date ${startDateDirection}, name ASC`,
      [moment().add(-1, 'day').format('YYYY-MM-DD')],
    );
    return rows.map((row) => fromRow(row, []));
  } catch (err) {
    logger.error(`Failed to fetch ${view} competitions for the Competition Planner: `, err);
    throw err;
  }
}

// Inserts a brand-new Planner-created competition row with every field a Delegate can supply by hand.
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

// Updates a Planner-created competition's own hand-entered fields - only ever called while still Potential.
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

// Clears only the WCA competition id, leaving the Planner row and its data intact.
async function unlinkPlannerCompetitionFromWca(id) {
  try {
    const { rows } = await db.withRetry(async (client) =>
      client.query(
        `UPDATE competitions
         SET wca_competition_id = NULL
         WHERE id = $1
           AND wca_competition_id IS NOT NULL
           AND COALESCE(is_announced, false) = false
         RETURNING id`,
        [id],
      ),
    );
    if (rows.length) {
      logger.debug(`Unlinked WCA competition from Planner competition ${id} in the competitions table.`);
    }
    return rows.length > 0;
  } catch (error) {
    logger.error(`Failed to unlink WCA competition from Planner competition ${id}:`, error);
    throw error;
  }
}

// Deletes a Planner-created competition row and its join-table rows - only ever called before announcement.
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
  getCompetitionsForPlanner,
  createPlannerCompetition,
  createPlannerCompetitionLinkedToWca,
  linkPlannerCompetitionToWca,
  updatePlannerCompetitionFields,
  updateMultiCityLocationFields,
  unlinkPlannerCompetitionFromWca,
  deletePlannerCompetition,
};