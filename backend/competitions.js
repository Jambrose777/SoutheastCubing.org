const axios = require('axios');
const moment = require('moment');

// Logger
const logger = require('./logger.js');

const googleForm = require('./googleForm.js');
const contentful = require('./contentful.js');
const discord = require('./discord.js');
const competitionsDb = require('./db/competitions.js');
const discordPingPatternsDb = require('./db/discordPingPatterns.js');
const majorChampionships = require('./majorChampionships.js');
const { getFullCompetitionDate } = require('./utils/competitionDates.js');
const { isInSEState } = require('./utils/seState.js');

// Gets upcoming competitions from the database.
async function getCompetitions(req, res) {
  const lastChecked = await competitionsDb.getLastChecked();
  res.set('Cache-Control', 'no-cache');

  if (lastChecked) {
    // Weak ETag derived from lastChecked rather than the response body, so
    // it represents freshness of the underlying data, not a byte-for-byte
    // match of the response body.
    const etag = `W/"${lastChecked.valueOf()}"`;
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
  }

  let comps;
  try {
    comps = await competitionsDb.getUpcomingCompetitions();
  } catch (err) {
    logger.error('Failed to load upcoming competitions from the database: ', err);
    res.status(503).json({ message: 'Competition data is temporarily unavailable.' });
    return;
  }

  res.status(200).json(comps);
}

// updates competitions with a fresh pull from wca.
async function updateCompetitions(req, res) {
  const lastChecked = await competitionsDb.getLastChecked();

  // deny request if updated within the last hour
  if (lastChecked && lastChecked.isAfter(moment().add(-1, 'hour'))) {
    logger.info('ip-' + req.ip + ' attempted update-competitions within 1 hour of a refresh.');
    res.status(400).json({
      message:
        'Cannot update multiple times within an hour. Last update was: ' +
        lastChecked.format('YYYY-MM-DD HH:mm:ss'),
    });
  } else {
    // pull competitions from WCA
    logger.info('ip-' + req.ip + ' Fetching competitions from wca on update-competitions request.');
    try {
      const { competitions, discordPostFailures } = await refreshCompetitionsFromWCA();
      logger.info(
        'ip-' +
          req.ip +
          ' Successfully Fetched competitions from wca on update-competitions request.',
      );
      
      res.send({
        competitions,
        discordPostFailures: discordPostFailures.map((comp) => ({ id: comp.id, name: comp.name })),
      });
    } catch (err) {
      logger.error(
        'ip-' + req.ip + ' Failed to fetch competitions from wca on update-competitions request: ',
        err,
      );
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to fetch competitions from WCA.' });
      }
    }
  }
}

// Refetches competitions from WCA if the stored data is stale.
async function fetchCompetitions() {
  const lastChecked = await competitionsDb.getLastChecked();

  if (
    !lastChecked ||
    lastChecked.isBefore(moment().set('hour', 0).set('minute', 0).set('second', 0))
  ) {
    logger.info('Fetching competitions from wca since stored data is stale.');
    await refreshCompetitionsFromWCA().catch((err) => {
      logger.error('Failed to fetch competitions from wca on stale-data refresh: ', err);
    });
    logger.info('Successfully Fetched competitions from wca.');
  }
}

// Posts every competition in `competitions` to Discord (chunked/rate-limit-safe
// - see discord.js's postToDiscordInChunks). A competition whose id matches any
// stored pattern gets an @everyone ping instead of its state's
// role ping. Only ids whose post succeeds are marked announced - anything
// still failing after discord.js's retries is left unannounced so it's
// retried on the next refresh.
async function postCompetitionsToDiscord(competitions) {
  const patterns = await discordPingPatternsDb.getPatterns();
  const usesEveryonePing = (competitionId) =>
    patterns.some((pattern) => discordPingPatternsDb.matchesIdPattern(competitionId, pattern.id_pattern));

  return discord.postToDiscordInChunks(sortForDiscordPosting(competitions), {
    postFn: (competition) =>
      discord.postCompetitionInDiscord(competition, {
        pingOverride: usesEveryonePing(competition.id) ? 'everyone' : undefined,
      }),
    markAnnouncedFn: (ids) => competitionsDb.markAnnounced(ids),
    getId: (competition) => competition.id,
  });
}

// Orders competitions for a Discord posting run: grouped by state first, then
// by start_date ascending, then alphabetically by name.
function sortForDiscordPosting(competitions) {
  const stateOrder = Object.keys(discord.stateTagIds);
  return [...competitions].sort((a, b) => {
    const stateDiff = stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state);
    if (stateDiff !== 0) {
      return stateDiff;
    }
    const dateDiff = moment(a.start_date).diff(moment(b.start_date));
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

// gets full competition list from WCA
async function refreshCompetitionsFromWCA() {
  try {
    // WCA paginates at per_page results; loop through successive pages
    // (stopping once a page returns fewer than per_page results, the
    // standard "last page" signal) so a true count over 1000 doesn't
    // silently drop competitions. Capped at maxPages (20,000 competitions)
    // as a guard against an unexpected API change causing an infinite loop.
    const per_page = 1000;
    const maxPages = 20;
    let wcaCompetitions = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await axios.get(
        'https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=' +
          per_page +
          '&page=' +
          page +
          '&start=' +
          moment().add(-1, 'day').format('YYYY-MM-DD'),
      );

      // Fail loudly on a genuine WCA API shape break
      if (!Array.isArray(res.data)) {
        throw new Error('Unexpected WCA competitions response shape');
      }

      wcaCompetitions = wcaCompetitions.concat(res.data);

      if (res.data.length < per_page) {
        // Short page means there's nothing more to fetch.
        break;
      }

      if (page === maxPages) {
        logger.warn(
          `Hit the WCA competitions pagination cap of ${maxPages} pages - some competitions may be missing.`,
        );
      }
    }

    // fetch manual competitions from Contentful. Isolated in its own
    // try/catch so a Contentful outage doesn't block the WCA-only data from
    // being formatted and saved below - it just means no manually-added
    // competitions are merged in for this cycle.
    let contentfulEntries;
    try {
      contentfulEntries = await contentful.getContentfulCompetitions();
    } catch (err) {
      logger.error(
        'Failed to fetch manual competitions from Contentful, continuing with WCA-only data: ',
        err,
      );
      contentfulEntries = { items: [] };
    }

    // Guard against a malformed/missing `items` field (a Contentful response
    // shape break).
    if (!Array.isArray(contentfulEntries.items)) {
      logger.warn('Contentful competitions response has no items array, treating as empty.');
      contentfulEntries = { items: [] };
    }

    let contentfulCompetitions = await Promise.all(
      contentfulEntries.items.map(async (contentfulComp) => {
        // Skip entries missing the fields this merge relies on, instead of
        // crashing the whole fetch cycle over one malformed Contentful entry.
        if (!contentfulComp.fields || !contentfulComp.fields.id || !contentfulComp.fields.name) {
          logger.warn(
            `Skipping malformed Contentful competition entry (sys id: ${contentfulComp.sys && contentfulComp.sys.id}) - missing fields.id or fields.name.`,
          );
          return null;
        }

        // fetch info on contentful competition from WCA
        const wcaCompetition = await getWCACompetition(wcaCompetitions, contentfulComp.fields.id);

        // Drop this manual competition entirely if its WCA lookup failed
        if (!wcaCompetition) {
          logger.warn(
            `Dropping manual competition "${contentfulComp.fields.name}" (${contentfulComp.fields.id}) - WCA lookup failed.`,
          );
          return null;
        }

        return {
          ...wcaCompetition,
          name: contentfulComp.fields.name,
          city: contentfulComp.fields.city,
          venue_address: contentfulComp.fields.venueAddress,
          venue_details: contentfulComp.fields.venueDetails,
          latitude_degrees: contentfulComp.fields.latitudeDegrees,
          longitude_degrees: contentfulComp.fields.longitudeDegrees,
          country_iso2: contentfulComp.fields.countryIso2,
          competitor_limit: contentfulComp.fields.competitorLimit,
          is_manual_competition: true, // indicates it is from contentful
        };
      }),
    );

    // Filter out competitions whose WCA lookup failed, then past competitions
    contentfulCompetitions = contentfulCompetitions
      .filter((comp) => comp)
      .filter((comp) => moment(comp.end_date).isAfter(moment().add(-1, 'day')));

    // fetch competitions with a volunteer application
    let competitionsWithVolunteerApp = await googleForm.getCompetitionsInVolunteerForm();

    const patterns = await discordPingPatternsDb.getPatterns();
    const matchesDiscordPingPattern = (competitionId) =>
      patterns.some((pattern) => discordPingPatternsDb.matchesIdPattern(competitionId, pattern.id_pattern));

    // Nats/NAC/Worlds are usually held outside the tracked SE states, so
    // they're normally Discord-only and tracked separately rather than ever reaching the public
    // competitions page. But any of them CAN land in an SE state - when that happens it should
    // still show up on the public page like any other SE competition, just
    // with an @everyone ping instead of its state's role ping.
    const seHostedPatternMatchIds = new Set(
      wcaCompetitions.filter((comp) => matchesDiscordPingPattern(comp.id) && isInSEState(comp)).map((comp) => comp.id),
    );
    const majorChampionshipDiscordFailures = await majorChampionships.refreshMajorChampionships(
      wcaCompetitions,
      patterns,
      seHostedPatternMatchIds,
    );

    // format competition data
    let comps = await formatCompetitionData(
      wcaCompetitions.concat(contentfulCompetitions),
      competitionsWithVolunteerApp,
    );

    let discordPostFailures = [...majorChampionshipDiscordFailures];
    if (comps && comps.length) {
      // Upsert into the database. upsertCompetitions handles the cold-start
      // case internally (stamping a first-time population as already
      // announced).
      await competitionsDb.upsertCompetitions(comps);

      const unannouncedCompetitions = await competitionsDb.getUnannouncedCompetitions();
      if (unannouncedCompetitions.length) {
        discordPostFailures = discordPostFailures.concat(await postCompetitionsToDiscord(unannouncedCompetitions));
      }

      // Only recorded on a non-empty result - an empty result is more likely a
      // WCA API glitch than a genuine zero-competition period in these states,
      // so it's treated as an unconfirmed check rather than a successful one.
      // This keeps update-competitions' rate limit and fetchCompetitions'
      // staleness check retrying instead of going stale on bad data.
      await competitionsDb.setLastChecked(moment());
    } else {
      logger.warn('There are no competitions!');
    }

    return { competitions: comps, discordPostFailures };
  } catch (err) {
    logger.error('Failed to Fetched competitions from wca: ', err);
    throw err;
  }
}

// Filters `comps` down to competitions in the tracked SE states and maps 
// each one to the trimmed/enriched object shape used by the database layer 
// and frontend 
async function formatCompetitionData(comps, competitionsWithVolunteerApp) {
  return await Promise.all(
    comps
      // Filter to only SE comp Dates.
      .filter((comp) => {
        // Guard for a missing city first - a competition without one can't
        // match any SE state.
        if (!comp.city) {
          logger.warn(
            `Skipping competition ${comp.id || '(no id)'} "${comp.name || '(no name)'}" - missing city.`,
          );
          return false;
        }
        return isInSEState(comp);
      })

      //  Sort by date
      .sort((a, b) => (moment(a.start_date).isBefore(b.start_date) ? -1 : 1))

      // Create extra fields for competititon data & strip out unnecessary data
      .map(async (competition) => ({
        url: competition.url,
        id: competition.id,
        name: competition.name,
        website: competition.website,
        city: competition.city,
        venue_address: competition.venue_address,
        venue_details: competition.venue_details,
        latitude_degrees: competition.latitude_degrees,
        longitude_degrees: competition.longitude_degrees,
        country_iso2: competition.country_iso2,
        start_date: competition.start_date,
        registration_open: competition.registration_open,
        registration_close: competition.registration_close,
        end_date: competition.end_date,
        competitor_limit: competition.competitor_limit,
        event_ids: competition.event_ids,
        venue: getCompetitionVenueName(competition.venue),
        venue_url: getCompetitionVenueUrl(competition.venue),
        state: competition.city.substring(competition.city.lastIndexOf(',') + 1).trim(),
        is_in_volunteer_application: competitionsWithVolunteerApp.includes(competition.name),
        accepted_registrations: await getRegistrationsFromWCA(competition),
        full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
        is_manual_competition: competition.is_manual_competition || false,
      })),
  );
}

// gets registration data & returns how many registered competitors there are for a competition.
function getRegistrationsFromWCA(competition) {
  // check if registration is open
  if (
    moment.utc(competition.registration_close).isBefore(moment.now()) ||
    moment.utc(competition.registration_open).isAfter(moment.now())
  ) {
    return Promise.resolve(0);
  } else {
    // fetch registrations from WCA
    return axios
      .get(
        `https://www.worldcubeassociation.org/api/v0/competitions/${competition.id}/registrations`,
      )
      .then((res) => res.data.length)
      .catch((err) => {
        logger.error(`Failed to fetch registrations from wca for ${competition.id}: `, err);
        // Don't let one competition's failed lookup break the whole fetch cycle -
        // treat it as having 0 registrations rather than propagating undefined.
        return 0;
      });
  }
}

// Fetches a single competition's information
function getWCACompetition(competitions, competitionId) {
  // chcek if competition is already in the list of fetched competitions
  let wcaCompetition = competitions.find((wcaCompetition) => wcaCompetition.id === competitionId);
  if (wcaCompetition) {
    return Promise.resolve(wcaCompetition);
  } else {
    // fetch competition from WCA
    return axios
      .get(`https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}`)
      .then((res) => res.data)
      .catch((err) => {
        logger.error(`Failed to fetch competition from wca for ${competitionId}: `, err);
        // Signal failure explicitly so callers can drop this competition instead of
        // spreading undefined fields into a broken/incomplete record.
        return null;
      });
  }
}

// If Venue includes a hyperlink in markdown format, then strip "text" out of it. ie. [text](url)
// If not, then return Venue name as is
function getCompetitionVenueName(venue) {
  if (venue && venue.indexOf(']') !== -1) {
    return venue.substring(1, venue.indexOf(']'));
  } else {
    return venue;
  }
}

// If Venue includes a hyperlink in markdown format, then strip "url" out of it. ie. [text](url)
// If not, then return nothing
function getCompetitionVenueUrl(venue) {
  if (venue && venue.indexOf('(') !== -1 && venue.indexOf(')') !== -1) {
    return venue.substring(venue.indexOf('(') + 1, venue.indexOf(')'));
  } else {
    return undefined;
  }
}

module.exports = {
  getCompetitions,
  updateCompetitions,
  fetchCompetitions,
  refreshCompetitionsFromWCA,
};
