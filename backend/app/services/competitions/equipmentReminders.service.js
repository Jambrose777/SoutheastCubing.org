const moment = require('moment-timezone');

const competitionRemindersDb = require('../../database/competitions/competitions-table/competitionReminders.database.js');
const competitionEquipmentHoldersDb = require('../../database/competitions/competitionEquipmentHolders.database.js');
const discord = require('../../integrations/discord.integration.js');
const { groupBy } = require('../../helpers/groupBy.helper.js');
const logger = require('../../utils/logger.util.js');

const EASTERN_TIME_ZONE = 'America/New_York';

// Finds the Wednesday strictly before the competition's Eastern calendar date.
function getEquipmentReminderWednesday(startDate) {
  const start = moment.tz(startDate, 'YYYY-MM-DD', EASTERN_TIME_ZONE);
  if (!start.isValid()) return null;
  const daysSinceWednesday = (start.isoWeekday() - 3 + 7) % 7;
  const daysBeforeCompetition = daysSinceWednesday === 0 ? 7 : daysSinceWednesday;
  return start.subtract(daysBeforeCompetition, 'days').format('YYYY-MM-DD');
}

// Posts due reminders during the daily refresh and leaves failed posts retryable.
async function sendDueEquipmentReminders() {
  const today = moment().tz(EASTERN_TIME_ZONE).format('YYYY-MM-DD');
  const candidates = await competitionRemindersDb.getEquipmentReminderCandidates(today);
  const dueCompetitions = candidates.filter((competition) => {
    const reminderWednesday = getEquipmentReminderWednesday(competition.start_date);
    return reminderWednesday && today >= reminderWednesday && today < competition.start_date;
  });
  if (!dueCompetitions.length) return;

  const holderRows = await competitionEquipmentHoldersDb.listForCompetitions(
    dueCompetitions.map((competition) => competition.id),
  );
  const holdersByCompetition = groupBy(holderRows, 'competition_id');
  const reminders = dueCompetitions.filter(
    (competition) => holdersByCompetition.get(competition.id)?.length,
  );
  if (!reminders.length) return;

  const failures = await discord.postToDiscordInChunks(reminders, {
    postFn: (competition) =>
      discord.postEquipmentReminderInDiscord(
        competition,
        holdersByCompetition.get(competition.id) ?? [],
      ),
    markAnnouncedFn: (ids) => competitionRemindersDb.markEquipmentRemindersSent(ids),
    getId: (competition) => competition.id,
  });
  logger.info(
    `Processed equipment reminders for ${reminders.length} competition(s): ${failures.length} post(s) failed.`,
  );
}

module.exports = { sendDueEquipmentReminders };
