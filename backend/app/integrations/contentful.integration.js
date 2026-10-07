const contentful = require('contentful');

const { config } = require('../config/config.js');

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

module.exports = { isConfigured, getClient };
