const moment = require('moment');

// Logger
const logger = require('../utils/logger.util.js');

const competitionsDb = require('../database/competitions.database.js');
const { refreshCompetitionsFromWCA } = require('../services/competitions.service.js');

// Gets upcoming competitions from the database.
async function getCompetitions(req, res) {
  const lastChecked = await competitionsDb.getLastChecked();
  res.set('Cache-Control', 'no-cache');

  if (lastChecked) {
    // Weak ETag derived from lastChecked rather than the response body, so
    // it represents freshness of the underlying data, not a byte-for-byte
    // match of the response body.
    const etag = `W/"${lastChecked.valueOf()}"`;
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
  }

  let comps;
  try {
    comps = await competitionsDb.getUpcomingCompetitions();
  } catch (err) {
    logger.error('Failed to load upcoming competitions from the database: ', err);
    res.status(503).json({ message: 'Competition data is temporarily unavailable.' });
    return;
  }

  res.status(200).json(comps);
}

// updates competitions with a fresh pull from wca.
async function updateCompetitions(req, res) {
  const lastChecked = await competitionsDb.getLastChecked();

  // deny request if updated within the last hour
  if (lastChecked && lastChecked.isAfter(moment().add(-1, 'hour'))) {
    logger.info('ip-' + req.ip + ' attempted update-competitions within 1 hour of a refresh.');
    res.status(400).json({
      message:
        'Cannot update multiple times within an hour. Last update was: ' +
        lastChecked.format('YYYY-MM-DD HH:mm:ss'),
    });
  } else {
    // pull competitions from WCA
    logger.info('ip-' + req.ip + ' Fetching competitions from wca on update-competitions request.');
    try {
      const { competitions, discordPostFailures } = await refreshCompetitionsFromWCA();
      logger.info(
        'ip-' +
          req.ip +
          ' Successfully Fetched competitions from wca on update-competitions request.',
      );

      res.send({
        competitions,
        discordPostFailures: discordPostFailures.map((comp) => ({ id: comp.id, name: comp.name })),
      });
    } catch (err) {
      logger.error(
        'ip-' + req.ip + ' Failed to fetch competitions from wca on update-competitions request: ',
        err,
      );
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to fetch competitions from WCA.' });
      }
    }
  }
}

module.exports = { getCompetitions, updateCompetitions };
