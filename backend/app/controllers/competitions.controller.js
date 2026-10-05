const moment = require('moment');

const logger = require('../utils/logger.util.js');

const competitionsDb = require('../database/competitions.database.js');
const {
  refreshCompetitionsFromWCA,
  getAnnouncedUpcomingCompetitions,
  getAllUpcomingCompetitionsForPlanner,
  createCompetition,
  updateCompetition,
  deleteCompetition,
} = require('../services/competitions.service.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

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

  try {
    const comps = await getAnnouncedUpcomingCompetitions();
    res.status(200).json(comps);
  } catch {
    res.status(503).json({ message: 'Competition data is temporarily unavailable.' });
    return;
  }
}

// updates competitions with a fresh pull from wca.
async function updateCompetitions(req, res) {
  const lastChecked = await competitionsDb.getLastChecked();

  // deny request if updated within the last hour
  if (lastChecked && lastChecked.isAfter(moment().add(-1, 'hour'))) {
    logger.info('attempted update-competitions within 1 hour of a refresh.');
    res.status(400).json({
      message:
        'Cannot update multiple times within an hour. Last update was: ' +
        lastChecked.format('YYYY-MM-DD HH:mm:ss'),
    });
  } else {
    // pull competitions from WCA
    logger.info('Fetching competitions from wca on update-competitions request.');
    try {
      const { competitions, discordPostFailures } = await refreshCompetitionsFromWCA();
      logger.info('Successfully Fetched competitions from wca on update-competitions request.');

      res.send({
        competitions,
        discordPostFailures: discordPostFailures.map((comp) => ({ id: comp.id, name: comp.name })),
      });
    } catch (err) {
      logger.error('Failed to fetch competitions from wca on update-competitions request: ', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to fetch competitions from WCA.' });
      }
    }
  }
}

// Gets every upcoming competition regardless of status for the Competition Planner tool.
async function getPlannerCompetitions(req, res) {
  try {
    const comps = await getAllUpcomingCompetitionsForPlanner();
    res.status(200).json(comps);
  } catch (err) {
    logger.error('Failed to fetch competitions for the Competition Planner: ', err);
    res.status(503).json({ message: 'Competition data is temporarily unavailable.' });
    return;
  }
}

// POST /dashboard/competition-planner/competitions - creates a new Planner competition.
async function createPlannerCompetition(req, res) {
  try {
    const id = await createCompetition(req.body ?? {});
    const comps = await getAllUpcomingCompetitionsForPlanner();
    res.status(201).json(comps.find((comp) => comp.id === id));
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to create competition');
  }
}

// PUT /dashboard/competition-planner/competitions/:competitionId - edits a Planner competition.
async function updatePlannerCompetition(req, res) {
  try {
    await updateCompetition(req.params.competitionId, req.body ?? {});
    const comps = await getAllUpcomingCompetitionsForPlanner();
    res.json(comps.find((comp) => comp.id === req.params.competitionId));
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update competition');
  }
}

// DELETE /dashboard/competition-planner/competitions/:competitionId - deletes a Planner
// competition (Potential/Planning only).
async function deletePlannerCompetition(req, res) {
  try {
    await deleteCompetition(req.params.competitionId);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to delete competition');
  }
}

module.exports = {
  getCompetitions,
  updateCompetitions,
  getPlannerCompetitions,
  createPlannerCompetition,
  updatePlannerCompetition,
  deletePlannerCompetition,
};
