const moment = require('moment');

const { getFullCompetitionDate } = require('./competitionDates.helper.js');
const { parseCompetitionVenue } = require('./competitionVenue.helper.js');
const { getStateFromCity } = require('./states.helper.js');

// Maps WCA records and related data to the app's competition row shape.
function formatCompetitionData(
  comps,
  competitionsWithVolunteerApp,
  registrationDataByWcaId,
  majorWcaIds = new Set(),
  stateByWcaId = new Map(),
) {
  return [...comps]
    .sort((a, b) => (moment(a.start_date).isBefore(b.start_date) ? -1 : 1))
    .map((competition) => {
      // Create extra fields for competition data and strip out unnecessary data.
      const wcaCompetitionId = String(competition.id);
      const registrationData = registrationDataByWcaId.get(wcaCompetitionId);
      const venue = parseCompetitionVenue(competition.venue);
      return {
        url: competition.url,
        wca_competition_id: competition.id,
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
        delegates: competition.delegates,
        organizers: competition.organizers,
        venue: venue.venueName,
        venue_url: venue.venueUrl,
        state: stateByWcaId.has(wcaCompetitionId)
          ? stateByWcaId.get(wcaCompetitionId)
          : getStateFromCity(competition.city),
        is_major: majorWcaIds.has(wcaCompetitionId) || Boolean(competition.is_major),
        is_in_volunteer_application: competitionsWithVolunteerApp.includes(competition.name),
        accepted_registrations: registrationData?.acceptedRegistrations ?? 0,
        waiting_list_count: registrationData?.waitingListCount ?? null,
        waiting_list_count_updated_at: registrationData?.waitingListCountUpdatedAt ?? null,
        full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
        is_announced: Boolean(competition.announced_at),
      };
    });
}

module.exports = { formatCompetitionData };