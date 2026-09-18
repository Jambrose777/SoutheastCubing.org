const axios = require('axios');
const moment = require('moment-timezone');
const { neutralizeMentions } = require('../helpers/sanitize.helper.js');
const { config } = require('../config/config.js');

// Logger
const logger = require('../utils/logger.util.js');

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

// Number of Discord webhook posts allowed per rate-limit window (5 requests
// per 2 seconds per webhook).
const DISCORD_CHUNK_SIZE = 5;
const DISCORD_CHUNK_DELAY_MS = 2000;

// Splits `items` into chunks of at most `size`.
function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Post message on Discord using SoutheastCubing API Webhook. `pingOverride:
// 'everyone'` pings @everyone instead of the competition's state role - used
// for major championships (Nats/NAC/Worlds, which have no SE state) and for
// SE-wide events like the SE Championship.
async function postCompetitionInDiscord(competition, { attempt = 0, pingOverride } = {}) {
  // Background/incidental caller (only POST /update-competitions today) - warn and
  // skip this one post instead of handing axios an undefined URL, so the
  // competitions refresh itself still succeeds. Throwing (rather than resolving)
  // keeps this competition unannounced on Discord, same as any other post failure,
  // so it's retried on the next refresh once DISCORD_WEBHOOK is configured.
  if (!config.DISCORD_WEBHOOK) {
    logger.warn(
      `DISCORD_WEBHOOK is not set - skipping Discord post for competition ${competition.id}.`,
    );
    throw new Error('DISCORD_WEBHOOK is not configured');
  }

  // Neutralize untrusted WCA/Contentful fields
  const name = neutralizeMentions(competition.name);
  const city = neutralizeMentions(competition.city);

  // Reorder event_ids to match eventIconMap's key order.
  const eventOrder = Object.keys(eventIconMap);
  const orderedEventIds = [...competition.event_ids].sort((a, b) => {
    const aIndex = eventOrder.indexOf(a);
    const bIndex = eventOrder.indexOf(b);
    return (
      (aIndex === -1 ? eventOrder.length : aIndex) - (bIndex === -1 ? eventOrder.length : bIndex)
    );
  });

  let pingLine;
  if (pingOverride === 'everyone') {
    pingLine = '@everyone';
  } else if (stateTagIds[competition.state]) {
    pingLine = `<@&${stateTagIds[competition.state]}>`;
  } else {
    // competition.state didn't match any configured Discord role tag (e.g. a
    // casing difference from WCA, or a state with no tag configured) - post
    // without a role ping rather than a broken `<@&undefined>` mention.
    logger.warn(
      `No Discord role tag configured for state "${competition.state}" (competition ${competition.id}) - posting without a role ping.`,
    );
    pingLine = '';
  }

  // compose Discord Message
  let discordMessage = `[${name}](https://www.worldcubeassociation.org/competitions/${competition.id})\n`;
  discordMessage += `${city} - ${competition.full_date}\n`;
  discordMessage +=
    orderedEventIds
      .map((eventId) =>
        eventIconMap[eventId] ? '<:emojiName:' + eventIconMap[eventId] + '>' : eventId,
      )
      .join(' ') + `\n`;
  discordMessage += `Competitor Limit: ${competition.competitor_limit}\n\n`;
  discordMessage += `${pingLine}\n\n`;
  discordMessage += `Registrations opens ${moment(competition.registration_open).tz('America/New_York').format('dddd, MMMM Do [at] h:mm a')} Eastern / ${moment(competition.registration_open).tz('America/Chicago').format('h:mm a')} Central\n\n`;
  discordMessage += `https://www.worldcubeassociation.org/competitions/${competition.id}`;

  // Post message
  try {
    const res = await axios.post(
      config.DISCORD_WEBHOOK,
      JSON.stringify({
        content: discordMessage,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    logger.debug(`Successfully posted ${competition.id} on Discord`);
    return res;
  } catch (err) {
    // A 429 means this webhook's rate-limit bucket hasn't fully reset despite the
    // chunked spacing competitions.js already does between groups of posts.
    // Wait however long Discord says to (retry_after, in seconds) and retry
    // this specific post, up to MAX_RATE_LIMIT_RETRIES times, before giving
    // up on it.
    const retryAfterSeconds =
      err.response?.status === 429 ? err.response.data?.retry_after : undefined;
    if (retryAfterSeconds !== undefined && attempt < MAX_RATE_LIMIT_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return postCompetitionInDiscord(competition, { attempt: attempt + 1, pingOverride });
    }

    logger.error('Error posting competitions on Discord: ', err);
    throw err;
  }
}

// Posts every item in `items` to Discord via `postFn`, chunked into groups of
// DISCORD_CHUNK_SIZE with a DISCORD_CHUNK_DELAY_MS wait between groups to
// stay within Discord's per-webhook rate limit. Items within a chunk are
// posted one at a time (not concurrently) so they land in Discord in the
// same order `items` was sorted into. Only items whose post succeeds are passed to
// `markAnnouncedFn` - anything still failing after `postFn`'s own retries is
// returned to the caller so it stays unannounced (and gets retried on the
// next refresh) instead of being silently dropped.
async function postToDiscordInChunks(items, { postFn, markAnnouncedFn, getId }) {
  const chunks = chunk(items, DISCORD_CHUNK_SIZE);
  const failures = [];
  for (const [i, batch] of chunks.entries()) {
    const results = [];
    for (const item of batch) {
      try {
        await postFn(item);
        results.push({ item, succeeded: true });
      } catch {
        results.push({ item, succeeded: false });
      }
    }

    const succeededIds = results
      .filter((result) => result.succeeded)
      .map((result) => getId(result.item));
    if (succeededIds.length) {
      await markAnnouncedFn(succeededIds);
    }
    results.filter((result) => !result.succeeded).forEach((result) => failures.push(result.item));

    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DISCORD_CHUNK_DELAY_MS));
    }
  }
  return failures;
}

module.exports = { postCompetitionInDiscord, postToDiscordInChunks, stateTagIds };
