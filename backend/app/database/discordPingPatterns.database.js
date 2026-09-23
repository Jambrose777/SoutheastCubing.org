const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Converts a stored wildcard pattern (using `*` to mean "any characters") to
// a RegExp anchored to the whole string, so e.g. 'NAC*' matches 'NAC2026'
// but not 'xNAC2026x'.
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

// True if `id` matches `pattern` (see patternToRegExp for the wildcard
// syntax).
function matchesIdPattern(id, pattern) {
  return patternToRegExp(pattern).test(id);
}

// Returns every stored competition id pattern along with try_direct_lookup
// (whether it needs the supplemental direct-by-id lookup for non-SE-hosted
// matches.
async function getPatterns() {
  try {
    const { rows } = await db.pool.query(
      'SELECT id_pattern, try_direct_lookup FROM competition_patterns_for_discord_pings',
    );
    logger.debug(
      `Fetched ${rows.length} Discord ping pattern(s) from the competition_patterns_for_discord_pings table.`,
    );
    return rows;
  } catch (err) {
    logger.error(
      'Failed to fetch Discord ping patterns from the competition_patterns_for_discord_pings table: ',
      err,
    );
    throw err;
  }
}

module.exports = { getPatterns, matchesIdPattern };
