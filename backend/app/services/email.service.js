const { stripNewlines } = require('../helpers/sanitize.helper.js');
const { config } = require('../config/config.js');
const teamsDb = require('../database/teams.database.js');
const { BOARD_TEAM_ID } = require('../helpers/fixedTeams.helper.js');

const logger = require('../utils/logger.util.js');

const EmailType = {
  clubs: 'clubs',
  pastCompetition: 'pastCompetition',
  getInvolved: 'getInvolved',
  socialMedia: 'socialMedia',
  software: 'software',
  general: 'general',
  organizing: 'organizing',
};

// The ordinary team backing the "clubs" contact-form category.
const CLUBS_TEAM_ID = 'clubs_team';

// In production returns the real address for the email to send to.
// Outside production, aliases `realAddress` to `${localPart}+${context}@${domain}`
// derived from DEV_EMAIL_OVERRIDE. Returns null (never `realAddress`) if it can't
// safely alias which the controller's existing check turns into a 503.
function resolveRecipient(realAddress, context) {
  if (config.NODE_ENV === 'production') {
    return realAddress;
  }
  if (!config.DEV_EMAIL_OVERRIDE) {
    logger.warn(
      `DEV_EMAIL_OVERRIDE is not set - refusing to send to "${realAddress}" outside production (context: "${context}").`,
    );
    return null;
  }
  const [localPart, domain] = config.DEV_EMAIL_OVERRIDE.split('@');
  return `${localPart}+${context}@${domain}`;
}

// Converts email type to a send to address.
async function getToEmail(emailType) {
  switch (emailType) {
    case EmailType.getInvolved:
      return resolveTeamEmail(BOARD_TEAM_ID, emailType, 'contact-get-involved');
    case EmailType.clubs:
      return resolveTeamEmail(CLUBS_TEAM_ID, emailType, 'contact-clubs');
    case EmailType.organizing:
      return resolveRecipient(config.EMAIL_TO_COMPETITIONS, 'contact-organizing');
    case EmailType.pastCompetition:
    case EmailType.socialMedia:
    case EmailType.software:
    case EmailType.general:
    default:
      return resolveRecipient(config.EMAIL_TO_CONTACT, 'contact');
  }
}

// Looks up `teamId`'s teams.email for a contact-form category backed by a
// team - falls back to EMAIL_TO_CONTACT (logging a warning) if that team
// has no email set.
async function resolveTeamEmail(teamId, emailType, context) {
  const team = await teamsDb.findTeamById(teamId);
  if (team?.email) {
    return resolveRecipient(team.email, context);
  }
  logger.warn(
    `Team "${teamId}" has no email set - falling back to EMAIL_TO_CONTACT for the "${emailType}" contact-form category.`,
  );
  return resolveRecipient(config.EMAIL_TO_CONTACT, 'contact');
}

// Formats Subject
function getEmailSubject(subject) {
  return '[SoutheastCubing.org] Contact Form - ' + subject;
}

// Formats email body
function getEmailText(name, email, text, ip) {
  let emailText = `You've received an email from ${name} <${email}>`;
  if (ip) {
    emailText += ' - ' + ip;
  }
  emailText +=
    "\n\nPlease note: all messages sent through this form are unauthenticated. If the person is asking for a request relating to them (ie. cancelling a registration, updating their name), make sure to receive verification with the persons email as seen on WCA.\n\nThey've sent the following message:\n\n" +
    text;

  return emailText;
}

// Builds the reminder email a newly-promoted Delegate with a still-blank
// bio gets.
function buildDelegateBioReminderMessage({ name, wcaEmail }) {
  const toEmail = resolveRecipient(wcaEmail, 'delegate-bio-reminder');
  if (!toEmail) {
    return null;
  }

  const myInfoUrl = new URL('/dashboard/my-info', config.FRONTEND_URL);
  myInfoUrl.searchParams.set('focusField', 'delegate-bio-field');

  return {
    from: `"Southeast Cubing" <${config.EMAIL_USER}>`,
    to: toEmail,
    subject: '[SoutheastCubing.org] Welcome! Add your Delegate bio',
    text:
      `Congratulations on becoming a Delegate, ${stripNewlines(name)}!\n\n` +
      "We'd love for the Southeast Cubing community to get to know you a bit better. " +
      'Whenever you get a chance, sign in and add a short Delegate bio on your My Info page:\n\n' +
      `${myInfoUrl.toString()}\n\n` +
      "Sign in with the WCA account linked to your Delegate role. This is a one-time email - you won't be reminded again once it's filled in.",
  };
}

// Builds the nodemailer message options for a contact-form submission -
// resolves the destination address from emailType and strips \r/\n from
// user-supplied fields that end up in email headers. Returns null if
// emailType has no configured destination address, leaving it to the caller
// to decide how to respond to that.
async function buildContactFormMessage({ name, email, subject, text, ip, emailType }) {
  const toEmail = await getToEmail(emailType);
  if (!toEmail) {
    return null;
  }

  const sanitizedName = stripNewlines(name);
  const sanitizedEmail = stripNewlines(email);
  const sanitizedSubject = stripNewlines(subject);

  return {
    from: `"${sanitizedName}" <${config.EMAIL_USER}>`,
    replyTo: sanitizedEmail,
    to: toEmail,
    subject: getEmailSubject(sanitizedSubject),
    text: getEmailText(sanitizedName, sanitizedEmail, text, ip),
  };
}

module.exports = {
  EmailType,
  buildContactFormMessage,
  buildDelegateBioReminderMessage,
  resolveRecipient,
};
