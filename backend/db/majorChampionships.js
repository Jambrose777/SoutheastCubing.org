const db = require('./pool.js');

// Columns of the `major_championship_announcements` table, in the order used
// when building the multi-row upsert below.
const COLUMNS = [
  'id',
  'name',
  'city',
  'start_date',
  'end_date',
  'full_date',
  'competitor_limit',
  'registration_open',
];

// Maps a WCA competition object to a `major_championship_announcements` row
// value tuple, in COLUMNS order. Event ids are stored separately in
// major_championship_events (see upsertMajorChampionships), so they're not
// part of this row.
function toRow(comp) {
  return [
    comp.id,
    comp.name,
    comp.city,
    comp.start_date,
    comp.end_date,
    comp.full_date,
    comp.competitor_limit,
    comp.registration_open,
  ];
}

// Maps a `major_championship_announcements` row (plus its already-fetched
// event ids) back to the object shape discord.js's postCompetitionInDiscord
// expects.
function fromRow(row, eventIds) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    start_date: row.start_date,
    end_date: row.end_date,
    full_date: row.full_date,
    competitor_limit: row.competitor_limit,
    registration_open: row.registration_open,
    event_ids: eventIds,
  };
}

// Fetches event ids for the given major championship ids, grouped by
// major championship.
async function getEventIdsByMajorChampionship(queryable, majorChampionshipIds) {
  const eventIdsByMajorChampionship = new Map();
  if (!majorChampionshipIds.length) return eventIdsByMajorChampionship;

  const { rows } = await queryable.query(
    'SELECT major_championship_id, event_id FROM major_championship_events WHERE major_championship_id = ANY($1)',
    [majorChampionshipIds],
  );
  rows.forEach((row) => {
    if (!eventIdsByMajorChampionship.has(row.major_championship_id)) {
      eventIdsByMajorChampionship.set(row.major_championship_id, []);
    }
    eventIdsByMajorChampionship.get(row.major_championship_id).push(row.event_id);
  });
  return eventIdsByMajorChampionship;
}

// Upserts `comps` (keyed on id), replacing each one's event ids. Volume here
// is at most a handful of competitions a year (Nats/NAC/Worlds), so unlike
// db/competitions.js this doesn't need chunked batches or a cold-start guard.
async function upsertMajorChampionships(comps) {
  if (!comps.length) return;

  await db.withRetry(async (client) => {
    const valueGroups = [];
    const params = [];
    comps.forEach((comp, i) => {
      const row = toRow(comp);
      const placeholders = row.map((_, colIdx) => `$${i * COLUMNS.length + colIdx + 1}`);
      valueGroups.push(`(${placeholders.join(', ')})`);
      params.push(...row);
    });

    const updateSet = COLUMNS.filter((col) => col !== 'id')
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(', ');

    await client.query(
      `INSERT INTO major_championship_announcements (${COLUMNS.join(', ')})
       VALUES ${valueGroups.join(', ')}
       ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
      params,
    );

    const competitionIds = comps.map((comp) => comp.id);
    await client.query('DELETE FROM major_championship_events WHERE major_championship_id = ANY($1)', [
      competitionIds,
    ]);

    const eventValueGroups = [];
    const eventParams = [];
    let paramIdx = 1;
    comps.forEach((comp) => {
      (comp.event_ids ?? []).forEach((eventId) => {
        eventValueGroups.push(`($${paramIdx}, $${paramIdx + 1})`);
        eventParams.push(comp.id, eventId);
        paramIdx += 2;
      });
    });

    if (eventValueGroups.length) {
      await client.query(
        `INSERT INTO major_championship_events (major_championship_id, event_id) VALUES ${eventValueGroups.join(', ')}`,
        eventParams,
      );
    }
  });
}

// Marks the given major championship ids as announced.
async function markAnnounced(ids) {
  if (!ids.length) return;
  await db.withRetry(async (client) => {
    await client.query(
      'UPDATE major_championship_announcements SET announced_on_discord_at = now() WHERE id = ANY($1)',
      [ids],
    );
  });
}

// Returns every major championship that hasn't been announced on Discord yet.
async function getUnannounced() {
  const { rows } = await db.pool.query(
    'SELECT * FROM major_championship_announcements WHERE announced_on_discord_at IS NULL',
  );
  const eventIdsByMajorChampionship = await getEventIdsByMajorChampionship(
    db.pool,
    rows.map((row) => row.id),
  );
  return rows.map((row) => fromRow(row, eventIdsByMajorChampionship.get(row.id) ?? []));
}

// Returns every tracked major championship id (announced or not). Used to
// figure out which years are already known for a given prefix (e.g. "NAC").
async function getTrackedIds() {
  const { rows } = await db.pool.query('SELECT id FROM major_championship_announcements');
  return rows.map((row) => row.id);
}

module.exports = { upsertMajorChampionships, markAnnounced, getUnannounced, getTrackedIds };
