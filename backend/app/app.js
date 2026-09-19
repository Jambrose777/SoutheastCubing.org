const express = require('express');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

// Logger
const logger = require('./utils/logger.util.js');

// Loads/validates all env vars once, at the very top before any other backend
// module is required - requiring it here is what fails the process fast on a
// missing/empty required var, before controllers/database/pool.js etc. get a
// chance to run with an invalid value.
const { config } = require('./config/config.js');

// Debug-level logs in development, info-level (quieter) in production -
// unset NODE_ENV is treated as development, per config.js's schema.
// LOG_LEVEL, when set, overrides this default.
logger.setLevel(config.LOG_LEVEL ?? (config.NODE_ENV === 'production' ? 'info' : 'debug'));

const db = require('./database/pool.js');

const { applySecurity } = require('./middleware/security.middleware.js');
const assignRequestId = require('./middleware/requestId.middleware.js');
const requestLogging = require('./middleware/requestLogging.middleware.js');
const { errorHandler } = require('./middleware/errorHandler.middleware.js');
const { attachSession } = require('./middleware/session.middleware.js');

const publicRoutes = require('./routes/public.routes.js');
const authRoutes = require('./routes/auth.routes.js');
const dashboardRoutes = require('./routes/dashboard.routes.js');

const { registerCompetitionsRefreshJob } = require('./jobs/competitionsRefresh.job.js');
const { registerSessionsCleanupJob } = require('./jobs/sessionsCleanup.job.js');
const { swaggerSpec } = require('./config/swagger.config.js');

const app = express();

// Setup middlewares
applySecurity(app, config);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
// Assigns req.id before morgan/business-code logging so both can tag
// themselves with it from the very first middleware onward.
app.use(assignRequestId);
app.use(requestLogging);
// Resolves the session cookie (if any) into req.user for every route below -
// most routes are public and simply ignore req.user; a route that requires
// auth checks it itself.
app.use(attachSession);

// Confirm the pooled DSQL connection actually works on boot - logged only, so a
// misconfigured/unreachable cluster is visible immediately.
db.verifyConnection()
  .then(() => logger.info('Successfully connected to the dev DSQL cluster.'))
  .catch((e) => logger.error('Failed to connect to the dev DSQL cluster: ', e));

registerCompetitionsRefreshJob();
registerSessionsCleanupJob();

// Public, unauthenticated docs UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(publicRoutes);
app.use(authRoutes);
app.use(dashboardRoutes);

// Registered last so it only catches errors that got past every route above.
app.use(errorHandler);

module.exports = app;
