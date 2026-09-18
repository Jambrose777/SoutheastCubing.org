// Thin entry point: builds the fully configured app (see app/app.js) and
// starts it listening - kept separate so a future test suite can import the
// app without also starting a live listener.
const app = require('./app/app.js');
const logger = require('./app/utils/logger.util.js');

const port = 8080;

app.listen(port, function () {
  logger.info(`Server Started. Listening on port ${port}`);
});
