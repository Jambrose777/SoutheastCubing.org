const moment = require('moment');
const db = require('./pool.js');

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
  'is_manual_competition',
];

// Max rows upserted per statement, to keep each one well under DSQL's
// 3,000-row transaction cap as the retained history keeps growing.
const UPSERT_CHUNK_SIZE = 500;

// Competitions typically carry at most ~20 WCA event ids each. Chunking
// competition ids into groups of this size before replacing their
// competition_events rows keeps each DELETE/INSERT comfortably under DSQL's
// row cap even though a single competitions batch (UPSERT_CHUNK_SIZE) can be
// much larger.
const EVENT_ID_CHUNK_SIZE = 100;

// In-process cache of the last getUpcomingCompetitions() result. Cleared by
// invalidateCache() whenever a write changes the store, so repeat requests
// between refreshes don't all re-query the database.
let competitionsCache = null;

function invalidateCache() {
  competitionsCache = null;
}

// Maps a formatted WCA competition object (see competitions.js's
// formatCompetitionData()) to a `competitions` row value tuple, in COLUMNS
// order. Event ids are stored separately in competition_events (see
// upsertCompetitions), so they're not part of this row.
function toRow(comp) {
  return [
    comp.id,
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
    comp.is_manual_competition ?? false,
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
    is_manual_competition: row.is_manual_competition,
  };
}

// Splits `items` into chunks of at most `size`.
function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Fetches event ids for the given competition ids via `queryable`, grouped
// by competition.
async function getEventIdsByCompetition(queryable, competitionIds) {
  const eventIdsByCompetition = new Map();
  if (!competitionIds.length) return eventIdsByCompetition;

  const { rows } = await queryable.query(
    'SELECT competition_id, event_id FROM competition_events WHERE competition_id = ANY($1)',
    [competitionIds],
  );
  rows.forEach((row) => {
    if (!eventIdsByCompetition.has(row.competition_id)) {
      eventIdsByCompetition.set(row.competition_id, []);
    }
    eventIdsByCompetition.get(row.competition_id).push(row.event_id);
  });
  return eventIdsByCompetition;
}

// Replaces the competition_events rows for competitions whose incoming
// event_ids actually differ from what's stored, skipping the rest - most
// competitions' events don't change between refreshes. `comps` is
// chunked internally to keep each DELETE/INSERT under DSQL's row cap even
// when called with a much larger competitions batch.
async function replaceEventIds(client, comps) {
  for (const eventBatch of chunk(comps, EVENT_ID_CHUNK_SIZE)) {
    const competitionIds = eventBatch.map((comp) => comp.id);
    const existingEventIdsByCompetition = await getEventIdsByCompetition(client, competitionIds);

    // Compare as sorted arrays since WCA's event id order isn't meaningful -
    // only competitions with an actual difference need their rows replaced.
    const changedComps = eventBatch.filter((comp) => {
      const incoming = [...(comp.event_ids ?? [])].sort();
      const existing = [...(existingEventIdsByCompetition.get(comp.id) ?? [])].sort();
      return incoming.length !== existing.length || incoming.some((id, i) => id !== existing[i]);
    });
    if (!changedComps.length) continue;

    const changedIds = changedComps.map((comp) => comp.id);
    await client.query('DELETE FROM competition_events WHERE competition_id = ANY($1)', [
      changedIds,
    ]);

    const valueGroups = [];
    const params = [];
    let paramIdx = 1;
    changedComps.forEach((comp) => {
      (comp.event_ids ?? []).forEach((eventId) => {
        valueGroups.push(`($${paramIdx}, $${paramIdx + 1})`);
        params.push(comp.id, eventId);
        paramIdx += 2;
      });
    });

    if (valueGroups.length) {
      await client.query(
        `INSERT INTO competition_events (competition_id, event_id) VALUES ${valueGroups.join(', ')}`,
        params,
      );
    }
  }
}

// Upserts `comps` (keyed on id) and returns the subset of ids that were
// newly inserted rather than updates to an existing row - callers use this
// to decide which competitions still need to be announced on Discord. New
// competitions get inserted, existing ones get all their columns refreshed
// to the latest WCA data, in one statement. If the table was empty before
// this call, every inserted row is stamped as already-announced instead, so a
// first-time-populated store doesn't post its entire backlog to Discord.
async function upsertCompetitions(comps) {
  if (!comps.length) return [];

  const { rows: countRows } = await db.pool.query('SELECT COUNT(*) FROM competitions');
  const wasEmpty = Number(countRows[0].count) === 0;

  const insertedIds = [];
  for (const batch of chunk(comps, UPSERT_CHUNK_SIZE)) {
    await db.withRetry(async (client) => {
      // Classify which of this batch's ids are new before upserting, since
      // the upsert itself doesn't distinguish inserts from updates.
      const { rows: existingRows } = await client.query(
        'SELECT id FROM competitions WHERE id = ANY($1)',
        [batch.map((comp) => comp.id)],
      );
      const existingIds = new Set(existingRows.map((row) => row.id));
      batch.forEach((comp) => {
        if (!existingIds.has(comp.id)) insertedIds.push(comp.id);
      });

      const valueGroups = [];
      const params = [];
      batch.forEach((comp, i) => {
        const row = toRow(comp);
        const placeholders = row.map((_, colIdx) => `$${i * COLUMNS.length + colIdx + 1}`);
        valueGroups.push(`(${placeholders.join(', ')})`);
        params.push(...row);
      });

      const updateSet = COLUMNS.filter((col) => col !== 'id')
        .map((col) => `${col} = EXCLUDED.${col}`)
        .join(', ');

      await client.query(
        `INSERT INTO competitions (${COLUMNS.join(', ')})
         VALUES ${valueGroups.join(', ')}
         ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
        params,
      );

      await replaceEventIds(client, batch);
    });
  }

  invalidateCache();

  // One-time bootstrap: if the store was empty before this call, every id in
  // insertedIds is actually the entire existing WCA competition history, not
  // a genuinely new competition - so they're stamped as already-announced
  // immediately and none are returned, instead of letting the caller post
  // the whole backlog to Discord as if it were new.
  if (wasEmpty) {
    if (insertedIds.length) {
      await db.withRetry(async (client) => {
        await client.query(
          'UPDATE competitions SET announced_on_discord_at = now() WHERE id = ANY($1) AND announced_on_discord_at IS NULL',
          [insertedIds],
        );
      });
    }
    return [];
  }

  return insertedIds;
}

// Marks the given competition ids as announced, so they're never re-posted
// to Discord on a later refresh.
async function markAnnounced(ids) {
  if (!ids.length) return;
  await db.withRetry(async (client) => {
    await client.query(
      'UPDATE competitions SET announced_on_discord_at = now() WHERE id = ANY($1)',
      [ids],
    );
  });
  invalidateCache();
}

// Returns every competition ending on or after yesterday, ordered by start
// date, ties broken by name.
async function getUpcomingCompetitions() {
  if (competitionsCache) {
    return competitionsCache;
  }

  const { rows } = await db.pool.query(
    'SELECT * FROM competitions WHERE end_date >= $1 ORDER BY start_date ASC, name ASC',
    [moment().add(-1, 'day').format('YYYY-MM-DD')],
  );
  const eventIdsByCompetition = await getEventIdsByCompetition(
    db.pool,
    rows.map((row) => row.id),
  );
  competitionsCache = rows.map((row) => fromRow(row, eventIdsByCompetition.get(row.id) ?? []));
  return competitionsCache;
}

// Returns every competition that hasn't been announced on Discord yet.
async function getUnannouncedCompetitions() {
  const { rows } = await db.pool.query(
    'SELECT * FROM competitions WHERE announced_on_discord_at IS NULL',
  );
  const eventIdsByCompetition = await getEventIdsByCompetition(
    db.pool,
    rows.map((row) => row.id),
  );
  return rows.map((row) => fromRow(row, eventIdsByCompetition.get(row.id) ?? []));
}

// Reads when competitions were last refreshed from WCA - used to rate-limit
// POST /update-competitions and to decide whether a boot-time refresh is
// needed.
async function getLastChecked() {
  const { rows } = await db.pool.query('SELECT last_checked FROM competitions_meta WHERE id = 1');
  return rows[0]?.last_checked ? moment(rows[0].last_checked) : null;
}

// Records that competitions were just refreshed from WCA.
async function setLastChecked(checkedAt) {
  await db.withRetry(async (client) => {
    await client.query('UPDATE competitions_meta SET last_checked = $1 WHERE id = 1', [
      checkedAt.toDate(),
    ]);
  });
  invalidateCache();
}

module.exports = {
  upsertCompetitions,
  markAnnounced,
  getUpcomingCompetitions,
  getUnannouncedCompetitions,
  getLastChecked,
  setLastChecked,
};
