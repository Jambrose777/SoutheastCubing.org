const emailIntegration = require('../integrations/email.integration.js');
const emailService = require('../services/email.service.js');

// Logger
const logger = require('../utils/logger.util.js');

// Sends email from notifications@southeastcubing.org to requested entity
function sendEmail(req, res) {
  // Validations
  if (!req.body || !req.body.name || !req.body.email || !req.body.text || !req.body.subject) {
    res.status(400).json({ message: 'must provide name, email, subject, and text.' });
    return;
  }
  if (!req.body.emailType || !emailService.EmailType[req.body.emailType]) {
    res.status(400).json({ message: 'must provide a valid emailType.' });
    return;
  }

  const message = emailService.buildContactFormMessage({
    name: req.body.name,
    email: req.body.email,
    subject: req.body.subject,
    text: req.body.text,
    ip: req.ip,
    emailType: req.body.emailType,
  });

  // EMAIL_USER/EMAIL_PASS/the relevant EMAIL_TO_* are optional env vars - sending
  // this email is this route's entire job (a direct-purpose route, not a
  // background side effect), so a missing one must fail the request rather than
  // silently no-op or crash trying to use an unconfigured transporter.
  if (!emailIntegration.isConfigured() || !message) {
    logger.warn(
      `Cannot send email for emailType "${req.body.emailType}" - EMAIL_USER/EMAIL_PASS or the destination address env var is not configured.`,
    );
    res.status(503).json({ message: 'Email is not configured. Please try again later.' });
    return;
  }

  emailIntegration
    .sendMail(message)
    .then(() => {
      res.send({ status: 'success' });
    })
    .catch((err) => {
      logger.error('ip-' + req.ip + ' Error sending email: ', err);
      res.status(500).json({ message: 'Failed to send email. Please try again later.' });
    });
}

module.exports = { sendEmail };
