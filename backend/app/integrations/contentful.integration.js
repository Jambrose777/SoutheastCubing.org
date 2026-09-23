const contentful = require('contentful');

const logger = require('../utils/logger.util.js');
const { config } = require('../config/config.js');

// Only built when both credentials are present - avoids handing the Contentful
// client an undefined space/token pair and deferring the failure to whenever the
// first getContentfulCompetitions() call happens to fire.
let cdaClient;
if (config.CONTENTFUL_SPACE && config.CONTENTFUL_ACCESS_TOKEN) {
  cdaClient = contentful.createClient({
    space: config.CONTENTFUL_SPACE,
    accessToken: config.CONTENTFUL_ACCESS_TOKEN,
  });
}

// retrieves all Contentful "Entries" pertaining to a "Content Type". Short-
// circuits to an empty result if Contentful isn't configured.
async function getContentfulCompetitions() {
  if (!cdaClient) {
    logger.warn(
      'CONTENTFUL_SPACE/CONTENTFUL_ACCESS_TOKEN not set - skipping Contentful fetch and returning no manually-added competitions.',
    );
    return { items: [] };
  }
  try {
    const entries = await cdaClient.getEntries(Object.assign({ content_type: 'competition' }));
    logger.debug(`Fetched ${entries.items.length} competition entries from Contentful.`);
    return entries;
  } catch (err) {
    logger.error('Failed to fetch competitions from Contentful: ', err);
    throw err;
  }
}

module.exports = { getContentfulCompetitions };
