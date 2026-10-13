const moment = require('moment-timezone');

const competitionsDb = require('../database/competitions.database.js');
const competitionEquipmentHoldersDb = require('../database/competitionEquipmentHolders.database.js');
const discord = require('../integrations/discord.integration.js');
const { groupBy } = require('../helpers/groupBy.helper.js');
const logger = require('../utils/logger.util.js');

const EASTERN_TIME_ZONE = 'America/New_York';

// Finds the Monday in the 3-9 calendar-day window before a competition starts.
function getEquipmentReminderMonday(startDate) {
  const start = moment.tz(startDate, 'YYYY-MM-DD', EASTERN_TIME_ZONE);
  if (!start.isValid()) return null;
  return start.subtract(3, 'days').startOf('isoWeek').format('YYYY-MM-DD');
}

// Posts due reminders during the daily refresh and leaves failed posts retryable.
async function sendDueEquipmentReminders() {
  const today = moment().tz(EASTERN_TIME_ZONE).format('YYYY-MM-DD');
  const candidates = await competitionsDb.getEquipmentReminderCandidates(today);
  const dueCompetitions = candidates.filter((competition) => {
    const reminderMonday = getEquipmentReminderMonday(competition.start_date);
    return reminderMonday && today >= reminderMonday && today < competition.start_date;
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
    markAnnouncedFn: (ids) => competitionsDb.markEquipmentRemindersSent(ids),
    getId: (competition) => competition.id,
  });
  logger.info(
    `Processed equipment reminders for ${reminders.length} competition(s): ${failures.length} post(s) failed.`,
  );
}

module.exports = { sendDueEquipmentReminders };
