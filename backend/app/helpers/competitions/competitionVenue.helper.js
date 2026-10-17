// Matches a `[name](url)` markdown-style venue link. Greedy captures so an unbalanced
// `)`/`]` inside the name or URL doesn't truncate the match early - this finds the
// *last* `)`/`]` in the string rather than the first.
const VENUE_LINK_PATTERN = /\[(.+)\]\((.+)\)/;

// converts "[Name](url)" to name, url and "Name" to name, undefined
function parseCompetitionVenue(venue) {
  const match = venue && venue.match(VENUE_LINK_PATTERN);
  return {
    venueName: match ? match[1] : venue,
    venueUrl: match ? match[2] : undefined,
  };
}

module.exports = { parseCompetitionVenue };