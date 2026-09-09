const contentful = require('contentful');

// Logger
const logger = require('./logger.js');

const cdaClient = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
});

// retrieves all Contentful "Entries" pertaining to a "Content Type".
function getContentfulCompetitions() {
  return cdaClient.getEntries(Object.assign({ content_type: 'competition' })).catch((err) => {
    logger.error('Error retrieving competitions from Contentful: ', err);
    throw err;
  });
}

module.exports = { getContentfulCompetitions };
