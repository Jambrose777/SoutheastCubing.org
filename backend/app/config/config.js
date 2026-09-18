const { z } = require('zod');

// Logger
const logger = require('../utils/logger.util.js');

// Every env var app.js validates at boot. Required fields have no `.optional()` - a
// missing/empty value fails validation and the process exits before the server
// starts listening. Optional fields use `.optional()` with no `.default()` - the
// schema only confirms the value is a non-empty string *if present*; each dependent
// module (contentful.js/email.js/discord.js) decides for itself what "missing"
// means for its own feature instead of a fallback value being baked in here.
const configSchema = z.object({
  CORS_ORIGIN: z.string().min(1),
  DSQL_ENDPOINT: z.string().min(1),
  // Not read directly via process.env anywhere in this codebase - the AWS SDK's
  // default credential provider chain picks these up implicitly to sign the DSQL
  // auth token in db/pool.js's generateAuthToken(). Still required for the DB
  // connection to work, so they belong in the fail-fast schema despite that.
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  // optional env vars
  CONTENTFUL_SPACE: z.string().min(1).optional(),
  CONTENTFUL_ACCESS_TOKEN: z.string().min(1).optional(),
  EMAIL_USER: z.string().min(1).optional(),
  EMAIL_PASS: z.string().min(1).optional(),
  EMAIL_TO_BOARD: z.string().min(1).optional(),
  EMAIL_TO_CLUBS: z.string().min(1).optional(),
  EMAIL_TO_COMPETITIONS: z.string().min(1).optional(),
  EMAIL_TO_CONTACT: z.string().min(1).optional(),
  DISCORD_WEBHOOK: z.string().min(1).optional(),
});

// Human-readable description of what's disabled when each optional var is
// missing, used to produce a useful boot-time warning. Required vars don't need
// an entry here - they fail fast instead of warning.
const OPTIONAL_VAR_DESCRIPTIONS = {
  CONTENTFUL_SPACE:
    'manually-added Contentful competitions will be skipped (WCA-sourced competitions still work)',
  CONTENTFUL_ACCESS_TOKEN:
    'manually-added Contentful competitions will be skipped (WCA-sourced competitions still work)',
  EMAIL_USER: 'POST /email will respond 503 until this is set',
  EMAIL_PASS: 'POST /email will respond 503 until this is set',
  EMAIL_TO_BOARD:
    'POST /email requests for the "getInvolved" category will respond 503 until this is set',
  EMAIL_TO_CLUBS:
    'POST /email requests for the "clubs" category will respond 503 until this is set',
  EMAIL_TO_COMPETITIONS:
    'POST /email requests for the "organizing" category will respond 503 until this is set',
  EMAIL_TO_CONTACT:
    'POST /email requests for the remaining categories will respond 503 until this is set',
  DISCORD_WEBHOOK:
    'competition Discord posts will be skipped (the competitions refresh itself still succeeds)',
};

// Validates process.env against the schema above and returns a frozen config
// object. Runs once, the first time this module is required - which app.js does
// before requiring any other backend module - so a misconfigured deployment
// fails immediately at boot with a clear message naming the offending
// variable(s). Optional vars missing only log a warning naming the feature they
// disable - the app still starts normally. Every other module reads its config
// from the returned object instead of touching process.env directly, so there's
// a single point where env vars are read/validated across the whole backend.
function loadConfig(env = process.env) {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const missing = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    logger.fatal(`Missing/invalid required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  Object.entries(OPTIONAL_VAR_DESCRIPTIONS).forEach(([key, description]) => {
    if (!result.data[key]) {
      logger.warn(`${key} is not set - ${description}.`);
    }
  });

  return Object.freeze(result.data);
}

// Loaded/validated once at first require - frozen so nothing downstream can
// accidentally mutate it.
const config = loadConfig();

module.exports = { config };
