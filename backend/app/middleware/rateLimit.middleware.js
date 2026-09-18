const rateLimit = require('express-rate-limit');

// Limits the public contact form to 3 *successfully sent* emails/hour per IP.
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skipFailedRequests: true,
  message: { message: 'Too many emails sent from this IP, please try again later.' },
});

module.exports = { emailLimiter };
