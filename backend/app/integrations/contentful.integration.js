const contentful = require('contentful');

const { config } = require('../config/config.js');
const logger = require('../utils/logger.util.js');

const HOME_PAGE_ENTRY_ID = 'VBd7CLFJeHCRE5VbPaIg3';

// Only build the client when both Contentful credentials are present.
let cdaClient;
if (config.CONTENTFUL_SPACE && config.CONTENTFUL_ACCESS_TOKEN) {
  cdaClient = contentful.createClient({
    space: config.CONTENTFUL_SPACE,
    accessToken: config.CONTENTFUL_ACCESS_TOKEN,
  });
}

// True once CONTENTFUL_SPACE/CONTENTFUL_ACCESS_TOKEN are present and the
// client is built.
function isConfigured() {
  return !!cdaClient;
}

// The underlying Contentful client.
function getClient() {
  return cdaClient;
}

// Fetches the home-page entry used by the health check.
async function getHomePageEntry() {
  try {
    if (!cdaClient) {
      throw new Error('Contentful is not configured.');
    }

    const entry = await cdaClient.getEntry(HOME_PAGE_ENTRY_ID);
    logger.debug('Successfully fetched the home-page entry from Contentful.');
    return entry;
  } catch (error) {
    logger.error('Failed to fetch the home-page entry from Contentful: ', error);
    throw error;
  }
}

module.exports = { isConfigured, getClient, getHomePageEntry };
