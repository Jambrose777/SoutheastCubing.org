const moment = require('moment');

const competitionRemindersDb = require('../database/competitions/competitions-table/competitionReminders.database.js');
const emailIntegration = require('../integrations/email.integration.js');
const emailService = require('./email.service.js');
const { groupBy } = require('../helpers/groupBy.helper.js');
const logger = require('../utils/logger.util.js');

const DEADLINE_REMINDER_DAYS = 28 + 5;

// Sends each due competition's reminder once during the daily scheduled run.
async function sendDueWcaDeadlineReminders() {
  const reminderDate = moment.utc().add(DEADLINE_REMINDER_DAYS, 'days').format('YYYY-MM-DD');
  const candidateRows = await competitionRemindersDb.getUnannouncedDeadlineReminderCandidates(
    reminderDate,
  );
  const rowsByCompetition = groupBy(candidateRows, 'competition_id');
  const reminders = [...rowsByCompetition.values()]
    .map((rows) => ({
      competition: rows[0],
      recipients: [
        ...new Set(
          rows
            .map((row) => row.delegate_email?.trim())
            .filter(Boolean),
        ),
      ],
    }))
    .filter((reminder) => reminder.recipients.length > 0);

  if (!reminders.length) return;
  if (!emailIntegration.isConfigured()) {
    logger.warn(
      `Skipping ${reminders.length} WCA deadline reminder(s) because email is not configured.`,
    );
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const { competition, recipients } of reminders) {
    const message = emailService.buildWcaDeadlineReminderMessage({
      competitionName: competition.competition_name,
      competitionDate: competition.start_date,
      recipients,
    });
    if (!message) continue;

    try {
      await emailIntegration.sendMail(
        message,
        `WCA deadline reminder for competition_id ${competition.competition_id}`,
      );
      sent++;
    } catch {
      // Failures are logged in emailIntegration.sendMail itself.
      failed++;
    }
  }

  logger.info(
    `Processed WCA deadline reminders: ${sent} sent, ${failed} failed, ${reminders.length} eligible competition(s).`,
  );
}

module.exports = { sendDueWcaDeadlineReminders };