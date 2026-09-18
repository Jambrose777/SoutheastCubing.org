const db = require('./pool.js');

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
  const { rows } = await db.pool.query(
    'SELECT id_pattern, try_direct_lookup FROM competition_patterns_for_discord_pings',
  );
  return rows;
}

module.exports = { getPatterns, matchesIdPattern };
