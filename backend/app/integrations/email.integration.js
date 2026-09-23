const nodemailer = require('nodemailer');
const { config } = require('../config/config.js');

const logger = require('../utils/logger.util.js');

// Email mailer - only built once EMAIL_USER/EMAIL_PASS are confirmed present, so a
// missing pair disables sending (see isConfigured() below) instead of handing
// nodemailer undefined credentials and deferring the failure to the first send.
let transporter;
if (config.EMAIL_USER && config.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    },
  });

  // verify that the transporter is successfully setup
  transporter
    .verify()
    .then(() => {
      logger.info('Email transporter successfully setup.');
    })
    .catch((err) => {
      logger.fatal('Error setting up email transporter: ', err);
    });
}

// True once EMAIL_USER/EMAIL_PASS are present and the transporter is built.
function isConfigured() {
  return !!transporter;
}

// Sends `mailOptions` through the configured SMTP transporter. `description`
// is a caller-supplied, non-PII label for the debug/error log (e.g. an email
// category) - callers must never pass anything derived from user-supplied
// content (recipient address, subject, etc.) here, since sendMail itself has
// no way to guarantee `mailOptions` won't contain a real competitor/user
// address in the future.
async function sendMail(mailOptions, description) {
  const suffix = description ? ` ${description}` : '';
  try {
    const info = await transporter.sendMail(mailOptions);
    logger.debug(`Successfully sent email${suffix}.`);
    return info;
  } catch (err) {
    logger.error(`Failed to send email${suffix}: `, err);
    throw err;
  }
}

module.exports = { isConfigured, sendMail };
