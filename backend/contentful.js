const contentful = require("contentful");

const cdaClient = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
});

  // retrieves all Contentful "Entries" pertaining to a "Content Type".
function getContentfulCompetitions() {
  return cdaClient.getEntries(Object.assign({ content_type: 'competition' }));
}

module.exports = { getContentfulCompetitions };
