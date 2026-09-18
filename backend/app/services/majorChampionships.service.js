// Detection/posting logic for major championships (Nats/NAC/Worlds) that
// aren't hosted in an SE state. Those never appear on the public competitions
// page - they're tracked in their own table (database/majorChampionships.js)
// purely so they can be announced on Discord with an @everyone ping. A major
// championship that IS SE-hosted skips this module entirely.

const moment = require('moment');

const wca = require('../integrations/wca.integration.js');
const discord = require('../integrations/discord.integration.js');
const majorChampionshipsDb = require('../database/majorChampionships.database.js');
const discordPingPatternsDb = require('../database/discordPingPatterns.database.js');
const { getFullCompetitionDate } = require('../helpers/competitionDates.helper.js');

// Logger
const logger = require('../utils/logger.util.js');

// How many years beyond the current year to probe for a not-yet-tracked
// supplemental competition.
const SUPPLEMENTAL_LOOKAHEAD_YEARS = 2;

// Looks up competition `id` directly against the WCA API's single-competition
// endpoint, returning its record or null if it doesn't exist yet or the
// lookup fails.
async function lookupCompetitionById(id) {
  try {
    return await wca.fetchCompetitionById(id);
  } catch (err) {
    // A 404 just means that year's competition doesn't exist yet - the
    // expected outcome for most probed years, so only unexpected failures
    // are logged.
    if (!err.response || err.response.status !== 404) {
      logger.error(`Failed to look up supplemental major championship ${id}: `, err);
    }
    return null;
  }
}

// Probes the WCA API directly for competitions that wouldn't appear in the
// country_iso2=US-filtered main fetch (i.e. hosted outside the US) - driven
// entirely by the DB's try_direct_lookup patterns (e.g. NAC/WC can be held
// outside the US).
async function fetchSupplementalMajorChampionships(alreadyFetchedIds, patterns) {
  // Each pattern's id prefix is derived by stripping its trailing '*'
  // (patterns needing this lookup are expected to be a plain prefix, e.g.
  // 'NAC*', so years can be appended directly).
  const prefixes = patterns
    .filter((pattern) => pattern.try_direct_lookup)
    .map((pattern) => pattern.id_pattern.replace(/\*$/, ''));

  const trackedIds = await majorChampionshipsDb.getTrackedIds();
  const currentYear = moment().year();

  const found = [];
  for (const prefix of prefixes) {
    // Only years after the highest one already tracked in
    // major_championship_announcements are probed (e.g. once NAC2026 is
    // known, years 2026 and earlier are skipped for NAC).
    const maxTrackedYear = trackedIds
      .filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length)))
      .map((id) => Number(id.slice(prefix.length)))
      .reduce((max, year) => Math.max(max, year), 0);

    // Probe up to SUPPLEMENTAL_LOOKAHEAD_YEARS beyond the current year.
    const startYear = Math.max(currentYear, maxTrackedYear + 1);
    for (let year = startYear; year <= currentYear + SUPPLEMENTAL_LOOKAHEAD_YEARS; year++) {
      const id = `${prefix}${year}`;
      // Ids from the main US-filtered fetch are skipped since those are
      // already covered.
      if (alreadyFetchedIds.has(id)) continue;

      const comp = await lookupCompetitionById(id);
      // No `start=` date filter here, so an already-past find has to be excluded explicitly.
      if (comp && moment(comp.end_date).isAfter(moment().add(-1, 'day'))) {
        found.push(comp);
      }
    }
  }
  return found;
}

// Returns the subset of `wcaCompetitions` whose id matches one of
// `patterns`, mapped to the trimmed record shape stored in
// major_championship_announcements/posted to Discord.
function detectMajorChampionships(wcaCompetitions, patterns) {
  return wcaCompetitions
    .filter((comp) =>
      patterns.some((pattern) =>
        discordPingPatternsDb.matchesIdPattern(comp.id, pattern.id_pattern),
      ),
    )
    .map((comp) => ({
      id: comp.id,
      name: comp.name,
      city: comp.city,
      start_date: comp.start_date,
      end_date: comp.end_date,
      full_date: getFullCompetitionDate(comp.start_date, comp.end_date),
      competitor_limit: comp.competitor_limit,
      registration_open: comp.registration_open,
      event_ids: comp.event_ids,
    }));
}

// Detects Nats/NAC/Worlds from the raw WCA competition list (matched against
// `patterns`, before the SE-state filter competitions.js applies for the
// main competitions table) plus a supplemental direct lookup for patterns
// not covered by the country_iso2=US-filtered main fetch, upserts
// newly-detected ones, and posts any still-unannounced ones to Discord with
// an @everyone ping. Returns the competitions that still failed to post
// after discord.js's own retries, for the caller to report/leave for the
// next refresh.
async function refreshMajorChampionships(wcaCompetitions, patterns, excludedIds = new Set()) {
  if (!patterns.length) return [];

  // `wcaCompetitions` must be the FULL fetched list (not pre-filtered), even
  // though a match in `excludedIds` won't end up tracked here - the full
  // list is what keeps fetchSupplementalMajorChampionships from re-probing
  // (and re-detecting as "hidden") a major championship that's already
  // accounted for elsewhere.
  const alreadyFetchedIds = new Set(wcaCompetitions.map((comp) => comp.id));
  const supplemental = await fetchSupplementalMajorChampionships(alreadyFetchedIds, patterns);

  // `excludedIds` is for competitions that competitions.js is instead
  // handling through the normal public-page pipeline.
  const detected = detectMajorChampionships(wcaCompetitions.concat(supplemental), patterns).filter(
    (comp) => !excludedIds.has(comp.id),
  );
  if (!detected.length) return [];

  await majorChampionshipsDb.upsertMajorChampionships(detected);

  // post any unannounced major championships to Discord with an @everyone ping
  const unannounced = await majorChampionshipsDb.getUnannounced();
  if (!unannounced.length) return [];

  logger.info(`Posting ${unannounced.length} unannounced major championship(s) to Discord.`);
  return discord.postToDiscordInChunks(unannounced, {
    postFn: (majorChampionship) =>
      discord.postCompetitionInDiscord(majorChampionship, { pingOverride: 'everyone' }),
    markAnnouncedFn: majorChampionshipsDb.markAnnounced,
    getId: (majorChampionship) => majorChampionship.id,
  });
}

module.exports = { refreshMajorChampionships };
