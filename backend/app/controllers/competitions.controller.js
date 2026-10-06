const logger = require('../utils/logger.util.js');

const competitionsDb = require('../database/competitions.database.js');
const {
  runCoordinatedCompetitionRefresh,
  refreshCompetitionFromWCA,
  getAnnouncedUpcomingCompetitions,
  getAnnouncedUpcomingCompetitionsRevision,
  getAllUpcomingCompetitionsForPlanner,
  getUnannouncedCompetitionBanners,
  getUnannouncedCompetitionLinkOptions,
  dismissUnannouncedCompetition,
  linkManagedCompetitionToPlanner,
  createCompetition,
  updateCompetition,
  deleteCompetition,
} = require('../services/competitions.service.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

// Gets upcoming competitions from the database.
async function getCompetitions(req, res) {
  const etag = `W/"${getAnnouncedUpcomingCompetitionsRevision()}"`;
  res.set('Cache-Control', 'no-cache');
  res.set('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  try {
    const comps = await getAnnouncedUpcomingCompetitions();
    res.status(200).json(comps);
  } catch {
    res.status(503).json({ message: 'Competition data is temporarily unavailable.' });
    return;
  }
}

// Gets every upcoming competition regardless of status for the Competition Planner tool.
async function getPlannerCompetitions(req, res) {
  try {
    const [competitions, lastBulkRefreshAt] = await Promise.all([
      getAllUpcomingCompetitionsForPlanner(),
      competitionsDb.getLastBulkRefreshAt(),
    ]);
    res.status(200).json({ competitions, meta: { lastBulkRefreshAt } });
  } catch (err) {
    logger.error('Failed to fetch competitions for the Competition Planner: ', err);
    res.status(503).json({ message: 'Competition data is temporarily unavailable.' });
    return;
  }
}

// Refreshes upcoming WCA competitions for the signed-in Planner user.
async function refreshPlannerCompetitions(req, res) {
  try {
    const { competitions, discordPostFailures } = await runCoordinatedCompetitionRefresh({
      peopleId: req.user.people_id,
      sessionId: req.user.sessionId,
    });
    const lastBulkRefreshAt = await competitionsDb.getLastBulkRefreshAt();
    res.status(200).json({
      competitions,
      discordPostFailures: discordPostFailures.map((comp) => ({ id: comp.id, name: comp.name })),
      meta: { lastBulkRefreshAt },
    });
  } catch (err) {
    if (err.status === 409) {
      res.status(409).json({
        message: err.message,
        meta: { lastBulkRefreshAt: err.refreshState?.lastBulkRefreshAt ?? null },
      });
      return;
    }
    res.status(err.status && err.status < 500 ? err.status : 500).json({
      message: err.status && err.status < 500 ? err.message : 'Failed to refresh competitions.',
    });
  }
}

// Refreshes one WCA-linked Planner competition without using the bulk cooldown.
async function refreshPlannerCompetition(req, res) {
  try {
    const competition = await refreshCompetitionFromWCA(req.params.competitionId, {
      peopleId: req.user.people_id,
      sessionId: req.user.sessionId,
    });
    res.status(200).json(competition);
  } catch (err) {
    res.status(err.status && err.status < 500 ? err.status : 500).json({
      message: err.status && err.status < 500 ? err.message : 'Failed to refresh competition.',
    });
  }
}

// Lists managed, unlinked WCA competitions eligible for automatic banners.
async function getPlannerUnannouncedCompetitionBanners(req, res) {
  try {
    const competitions = await getUnannouncedCompetitionBanners(req.user.people_id);
    res.status(200).json(competitions);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to fetch unannounced competition banners');
  }
}

// Lists managed, unlinked WCA competitions for the standalone link sheet.
async function getPlannerWcaLinkOptions(req, res) {
  try {
    const competitions = await getUnannouncedCompetitionLinkOptions(req.user.people_id);
    res.status(200).json(competitions);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to fetch WCA competition link options');
  }
}

// Permanently dismisses one WCA competition banner for the signed-in person.
async function dismissPlannerUnannouncedCompetition(req, res) {
  try {
    await dismissUnannouncedCompetition(req.user.people_id, req.params.wcaCompetitionId);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to dismiss unannounced competition');
  }
}

// Links a WCA competition to a Potential row, or creates a linked Planner row.
async function linkPlannerCompetitionToWca(req, res) {
  try {
    const competitionId = await linkManagedCompetitionToPlanner({
      peopleId: req.user.people_id,
      wcaCompetitionId: req.body?.wcaCompetitionId,
      plannerCompetitionId: req.body?.plannerCompetitionId,
    });
    const competitions = await getAllUpcomingCompetitionsForPlanner();
    res.status(200).json(competitions.find((competition) => competition.id === competitionId));
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to link WCA competition');
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
  getPlannerCompetitions,
  refreshPlannerCompetitions,
  refreshPlannerCompetition,
  getPlannerUnannouncedCompetitionBanners,
  getPlannerWcaLinkOptions,
  dismissPlannerUnannouncedCompetition,
  linkPlannerCompetitionToWca,
  createPlannerCompetition,
  updatePlannerCompetition,
  deletePlannerCompetition,
};
