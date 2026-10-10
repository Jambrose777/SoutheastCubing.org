// Detects announced major championships, including non-US majors found by direct WCA lookup.

const moment = require('moment');

const wca = require('../integrations/wca.integration.js');
const competitionsDb = require('../database/competitions.database.js');
const discordPingPatternsDb = require('../database/discordPingPatterns.database.js');

const logger = require('../utils/logger.util.js');

// How many years beyond the current year to probe for a not-yet-tracked
// supplemental competition.
const SUPPLEMENTAL_LOOKAHEAD_YEARS = 2;

// Looks up competition `id` directly against the WCA API's single-competition
// endpoint, returning its record or null if it doesn't exist yet or the
// lookup fails.
async function lookupCompetitionById(id) {
  try {
    // A 404 just means that year's competition doesn't exist yet - the
    // expected outcome for most probed years, so wca.integration.js logs it
    // at debug instead of error.
    return await wca.fetchCompetitionById(id, { suppressNotFoundLogging: true });
  } catch {
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

  const trackedIds = (await competitionsDb.getTrackedMajorWcaIds()).map(String);
  const currentYear = moment().year();

  const found = [];
  for (const prefix of prefixes) {
    // Only years after the highest one already tracked as a major row are probed
    // (e.g. once NAC2026 is known, years 2026 and earlier are skipped for NAC).
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

// Returns announced WCA records whose ids match a configured major pattern.
function detectMajorChampionships(wcaCompetitions, patterns) {
  return wcaCompetitions
    .filter((comp) => Boolean(comp.announced_at))
    .filter((comp) =>
      patterns.some((pattern) =>
        discordPingPatternsDb.matchesIdPattern(String(comp.id), pattern.id_pattern),
      ),
    );
}

// Detects announced majors from the main list plus supplemental direct-by-id lookups.
async function getDetectedMajorChampionships(wcaCompetitions, patterns) {
  if (!patterns.length) return [];

  const alreadyFetchedIds = new Set(wcaCompetitions.map((comp) => String(comp.id)));
  const supplemental = await fetchSupplementalMajorChampionships(alreadyFetchedIds, patterns);
  const detected = detectMajorChampionships(wcaCompetitions.concat(supplemental), patterns);
  logger.debug(`Detected ${detected.length} major championship(s) this cycle.`);
  return detected;
}

// Prepares non-US major locations with the WCA country name and state override.
async function prepareMajorCompetitionsForFormatting(competitions, majorWcaIds) {
  const nonUsCompetitions = competitions.filter(
    (competition) =>
      majorWcaIds.has(String(competition.id)) &&
      String(competition.country_iso2).toUpperCase() !== 'US',
  );
  if (!nonUsCompetitions.length) {
    return { competitions, stateByWcaId: new Map() };
  }

  const countries = await wca.fetchCountries();
  const countryNameByIso2 = new Map(
    countries.map((country) => [country.iso2.toUpperCase(), country.name]),
  );
  const stateByWcaId = new Map();
  const preparedCompetitions = competitions
    .map((competition) => {
      if (
        !majorWcaIds.has(String(competition.id)) ||
        String(competition.country_iso2).toUpperCase() === 'US'
      ) {
        return competition;
      }

      const wcaCompetitionId = String(competition.id);
      const countryIso2 = String(competition.country_iso2).toUpperCase();
      const countryName = countryNameByIso2.get(countryIso2) ?? countryIso2;
      const city = typeof competition.city === 'string' ? competition.city.trim() : '';
      if (!city) {
        logger.warn(`Skipping WCA major ${wcaCompetitionId} because it has no city.`);
        return null;
      }

      stateByWcaId.set(wcaCompetitionId, countryName);
      const suffix = `, ${countryName}`;
      return {
        ...competition,
        city: city.toLowerCase().endsWith(suffix.toLowerCase()) ? city : `${city}, ${countryName}`,
      };
    })
    .filter(Boolean);

  return { competitions: preparedCompetitions, stateByWcaId };
}

// Matches WCA cities exactly against stored cities with or without State / Country.
function findMatchingManualMajorCompetitions(wcaCity, candidates) {
  const normalize = (value) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  const targetCity = normalize(wcaCity);
  if (!targetCity) return [];

  return candidates.filter((candidate) => {
    const city = normalize(candidate.city);
    const stateOrCountry = normalize(candidate.state);
    const cityWithoutStateOrCountry =
      stateOrCountry && city.endsWith(`, ${stateOrCountry}`)
        ? city.slice(0, -stateOrCountry.length - 2)
        : city;
    return targetCity === city || targetCity === cityWithoutStateOrCountry;
  });
}

module.exports = {
  getDetectedMajorChampionships,
  detectMajorChampionships,
  prepareMajorCompetitionsForFormatting,
  findMatchingManualMajorCompetitions,
};
