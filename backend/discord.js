const axios = require('axios');
const moment = require('moment-timezone');
const { neutralizeMentions } = require('./utils/sanitize');

// Logger
const logger = require('./logger.js');

// Discord Icon and Tag Ids
const eventIconMap = {
  333: '1200949445106356274',
  222: '1200949441402765392',
  444: '1200949447568400424',
  555: '1200949449560707114',
  666: '1200949450911260763',
  777: '1200949452400242849',
  '333bf': '1200949443910979654',
  '333fm': '1200949558239301712',
  '333oh': '1200949455822803035',
  clock: '1200949556502863962',
  fto: '1547768263654510765',
  minx: '1200949560315494481',
  pyram: '1200949562857230336',
  skewb: '1200949563918385233',
  sq1: '1200949565306703953',
  '444bf': '1200949445978763295',
  '555bf': '1200949448667316334',
  '333mbf': '1200949559166255114',
};

const stateTagIds = {
  Alabama: '1070759114860396645',
  Florida: '1070759217541173288',
  Georgia: '1070759140999299224',
  'North Carolina': '1070759467249045545',
  'South Carolina': '1070759276030738584',
  Tennessee: '1070759168295833800',
};

// Max number of extra attempts for a single post that comes back 429, on top
// of the initial attempt.
const MAX_RATE_LIMIT_RETRIES = 2;

// Post message on Discord using SoutheastCubing API Webhook.
async function postCompetitionInDiscord(competition, attempt = 0) {
  // Neutralize untrusted WCA/Contentful fields
  const name = neutralizeMentions(competition.name);
  const city = neutralizeMentions(competition.city);

  // Reorder event_ids to match eventIconMap's key order.
  const eventOrder = Object.keys(eventIconMap);
  const orderedEventIds = [...competition.event_ids].sort((a, b) => {
    const aIndex = eventOrder.indexOf(a);
    const bIndex = eventOrder.indexOf(b);
    return (aIndex === -1 ? eventOrder.length : aIndex) - (bIndex === -1 ? eventOrder.length : bIndex);
  });

  // compose Discord Message
  let discordMessage = `[${name}](https://www.worldcubeassociation.org/competitions/${competition.id})\n`;
  discordMessage += `${city} - ${competition.full_date}\n`;
  discordMessage +=
    orderedEventIds
      .map((eventId) => (eventIconMap[eventId] ? '<:emojiName:' + eventIconMap[eventId] + '>' : eventId))
      .join(' ') + `\n`;
  discordMessage += `Competitor Limit: ${competition.competitor_limit}\n\n`;
  discordMessage += `<@&${stateTagIds[competition.state]}>\n\n`;
  discordMessage += `Registrations opens ${moment(competition.registration_open).tz('America/New_York').format('dddd, MMMM Do [at] h:mm a')} Eastern / ${moment(competition.registration_open).tz('America/Chicago').format('h:mm a')} Central\n\n`;
  discordMessage += `https://www.worldcubeassociation.org/competitions/${competition.id}`;

  // Post message
  try {
    const res = await axios.post(
      process.env.DISCORD_WEBHOOK,
      JSON.stringify({
        content: discordMessage,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    logger.info('Successfully posted competition on Discord');
    return res;
  } catch (err) {
    // A 429 means this webhook's rate-limit bucket hasn't fully reset despite the
    // chunked spacing competitions.js already does between groups of posts.
    // Wait however long Discord says to (retry_after, in seconds) and retry
    // this specific post, up to MAX_RATE_LIMIT_RETRIES times, before giving
    // up on it.
    const retryAfterSeconds = err.response?.status === 429 ? err.response.data?.retry_after : undefined;
    if (retryAfterSeconds !== undefined && attempt < MAX_RATE_LIMIT_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return postCompetitionInDiscord(competition, attempt + 1);
    }

    logger.error('Error posting competitions on Discord: ', err);
    throw err;
  }
}

module.exports = { postCompetitionInDiscord };
