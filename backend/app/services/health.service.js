const moment = require('moment');
const { z } = require('zod');

const db = require('../database/pool.js');
const { config } = require('../config/config.js');
const { httpError } = require('../helpers/httpError.helper.js');
const contentful = require('../integrations/contentful.integration.js');
const email = require('../integrations/email.integration.js');
const googleDrive = require('../integrations/googleDrive.integration.js');
const wca = require('../integrations/wca.integration.js');
const logger = require('../utils/logger.util.js');

const HEALTHY = 'healthy';
const UNHEALTHY = 'unhealthy';
const PERSON_WCA_ID = '2010AMBR01';

class HealthValidationError extends Error {}

const nonEmptyString = z.string().refine((value) => value.trim().length > 0);
const finiteNumber = z.number().refine(Number.isFinite);
const nullableString = z.string().nullable();
const nullableAvatarUrl = nullableString;

const competitionAvatarSchema = z
  .object({
    thumb_url: nullableAvatarUrl,
  })
  .nullable();

const lookupAvatarSchema = z
  .object({
    thumb_url: nullableAvatarUrl,
    url: nullableAvatarUrl,
  })
  .nullable();

const nestedPersonSchema = z.object({
  id: z.number().int().positive(),
  name: nonEmptyString,
  wca_id: nullableString,
  avatar: competitionAvatarSchema,
});

const wcaCompetitionSchema = z.object({
  id: z.union([nonEmptyString, finiteNumber]),
  name: nonEmptyString,
  city: nonEmptyString,
  country_iso2: nonEmptyString,
  start_date: nonEmptyString,
  end_date: nonEmptyString,
  event_ids: z.array(nonEmptyString),
  latitude_degrees: finiteNumber,
  longitude_degrees: finiteNumber,
  registration_open: nonEmptyString,
  registration_close: nonEmptyString,
  delegates: z.array(nestedPersonSchema),
  organizers: z.array(nestedPersonSchema),
  announced_at: nonEmptyString.refine((value) => Number.isFinite(Date.parse(value))),
  url: nullableString,
  website: nullableString,
  venue: nullableString,
  venue_address: nullableString,
  venue_details: nullableString,
  competitor_limit: finiteNumber.nullable(),
});

const wcaLookupPersonSchema = z.object({
  wca_id: z.literal(PERSON_WCA_ID),
  name: nonEmptyString,
  avatar: lookupAvatarSchema,
});

// Parses an approved response shape and reports field paths without logging response data.
function validateResponse(schema, response, label) {
  const result = schema.safeParse(response);
  if (!result.success) {
    const invalidFields = result.error.issues
      .map((issue) => issue.path.join('.') || '<root>')
      .join(', ');
    throw new HealthValidationError(`${label} has missing or invalid fields: ${invalidFields}.`);
  }
  return result.data;
}

// Runs the WCA list, detail, registration-count, and person lookup checks.
async function checkWca() {
  const competitions = await wca.fetchUSCompetitionsPage({
    page: 1,
    startDate: moment().subtract(1, 'day').format('YYYY-MM-DD'),
  });
  if (!Array.isArray(competitions)) {
    throw new HealthValidationError('WCA competition list is not an array.');
  }

  // Probe one listed competition to bound the follow-up WCA calls.
  const competition = competitions[0];
  if (!competition) {
    throw new HealthValidationError('The WCA competition list is empty.');
  }
  validateResponse(wcaCompetitionSchema, competition, 'WCA competition');

  // Reuse this competition ID for both detail and registration-count requests.
  const competitionId = String(competition.id);
  const details = await wca.fetchCompetitionById(competitionId);
  validateResponse(wcaCompetitionSchema, details, 'WCA competition detail');
  if (String(details.id) !== competitionId) {
    throw new HealthValidationError('WCA competition detail returned a different ID.');
  }

  const registrationCount = await wca.fetchCompetitionRegistrationsCount(competitionId);
  if (!Number.isInteger(registrationCount) || registrationCount < 0) {
    throw new HealthValidationError('WCA registration count is invalid.');
  }

  // Exercise the direct person lookup used by person-resolution flows.
  validateResponse(
    wcaLookupPersonSchema,
    await wca.fetchPersonByWcaId(PERSON_WCA_ID),
    'WCA person',
  );
  return true;
}

// Confirms Contentful returns the home-page entry with a non-empty title.
async function checkContentful() {
  const entry = await contentful.getHomePageEntry();
  if (typeof entry?.fields?.title !== 'string' || !entry.fields.title.trim()) {
    throw new HealthValidationError('Contentful home-page entry has no title.');
  }
  return true;
}

// Confirms the configured Drive root folder is readable and matches its ID.
async function checkDrive() {
  const folder = await googleDrive.getFolder(config.WCA_DRIVE_ROOT_FOLDER_ID);
  if (folder?.id !== config.WCA_DRIVE_ROOT_FOLDER_ID) {
    throw new HealthValidationError('Google Drive returned a different root folder ID.');
  }
  return true;
}

// Verifies SMTP connectivity without sending a message.
async function checkEmail() {
  await email.verifyTransporter();
  return true;
}

// Validates a selector before any health checks run.
function selectChecks(availableChecks, checkParameter) {
  if (checkParameter === undefined) return Object.keys(availableChecks);
  if (typeof checkParameter !== 'string') {
    throw httpError(400, 'The check parameter must be a comma-separated list of check names.');
  }

  const names = checkParameter.split(',').map((name) => name.trim());
  if (names.some((name) => !name || !Object.prototype.hasOwnProperty.call(availableChecks, name))) {
    throw httpError(400, 'The check parameter contains an empty or unsupported check name.');
  }
  return [...new Set(names)];
}

// Runs selected checks independently and returns sanitized aggregate statuses.
async function runChecks(availableChecks, checkParameter) {
  const names = selectChecks(availableChecks, checkParameter);
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const healthy = await availableChecks[name]();
        return [name, healthy ? HEALTHY : UNHEALTHY];
      } catch (error) {
        if (error instanceof HealthValidationError) {
          logger.error(`${name} health response validation failed: ${error.message}`);
        }
        return [name, UNHEALTHY];
      }
    }),
  );

  const checks = Object.fromEntries(results);
  const status = Object.values(checks).every((value) => value === HEALTHY) ? HEALTHY : UNHEALTHY;
  return { status, checks };
}

// Confirms this request reached the backend process.
async function checkBackend() {
  return true;
}

// Executes a read-only query through the pooled DSQL connection.
async function checkDsql() {
  try {
    await db.verifyConnection();
    return true;
  } catch (error) {
    logger.error('Health check could not reach DSQL: ', error);
    throw error;
  }
}

// Runs the backend and DSQL checks requested by GET /health.
async function getInternalHealth(checkParameter) {
  return runChecks(
    {
      backend: checkBackend,
      dsql: checkDsql,
    },
    checkParameter,
  );
}

// Runs the external service checks requested by GET /health/external.
async function getExternalHealth(checkParameter) {
  return runChecks(
    {
      wca: checkWca,
      contentful: checkContentful,
      drive: checkDrive,
      email: checkEmail,
    },
    checkParameter,
  );
}

module.exports = { getInternalHealth, getExternalHealth };
