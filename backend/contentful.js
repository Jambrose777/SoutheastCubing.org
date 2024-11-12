const contentful = require("contentful");

// Logger
const log4js = require("log4js");
const logger = log4js.getLogger();
logger.level = "debug";

const cdaClient = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
});

  // retrieves all Contentful "Entries" pertaining to a "Content Type".
function getContentfulCompetitions() {
  return cdaClient.getEntries(Object.assign({ content_type: 'competition' }))
    .catch(err => {
      logger.error('Error retrieving competitions from Contentful: ', err);
    });
}

module.exports = { getContentfulCompetitions };
