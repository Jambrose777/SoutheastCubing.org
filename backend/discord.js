const axios = require("axios");
const moment = require("moment-timezone");

const eventIconMap = {
  '333': '1200949445106356274',
  '222': '1200949441402765392',
  '444': '1200949447568400424',
  '555': '1200949449560707114',
  '666': '1200949450911260763',
  '777': '1200949452400242849',
  '333bf': '1200949443910979654',
  '333fm': '1200949558239301712',
  '333oh': '1200949455822803035',
  'clock': '1200949556502863962',
  'minx': '1200949560315494481',
  'pyram': '1200949562857230336',
  'skewb': '1200949563918385233',
  'sq1': '1200949565306703953',
  '444bf': '1200949445978763295',
  '555bf': '1200949448667316334',
  '333mbf': '1200949559166255114',
}

const stateTagIds = {
  'Alabama': '1070759114860396645',
  'Florida': '1070759217541173288',
  'Georgia': '1070759140999299224',
  'North Carolina': '1070759467249045545',
  'South Carolina': '1070759276030738584',
  'Tennessee': '1070759168295833800',
}

function postCompetitionInDiscord(competition) {
  // compose Discord Message
  let discordMessage = `[${competition.name}](https://www.worldcubeassociation.org/competitions/${competition.id})\n`;
  discordMessage += `${competition.city} - ${competition.full_date}\n`;
  discordMessage += competition.event_ids.map(eventId => '<:emojiName:' + eventIconMap[eventId] + '>').join(" ") + `\n`;
  discordMessage += `Competitor Limit: ${competition.competitor_limit}\n\n`
  discordMessage += `<@&${stateTagIds[competition.state]}>\n\n`;
  discordMessage += `Registrations opens ${moment(competition.registration_open).tz("America/New_York").format("dddd, MMMM Do [at] h:mm a")} Eastern / ${moment(competition.registration_open).tz("America/Chicago").format("h:mm a")} Central\n\n`;
  discordMessage += `https://www.worldcubeassociation.org/competitions/${competition.id}`;

  return axios.post(
    process.env.DISCORD_WEBHOOK,
    JSON.stringify({
      content: discordMessage,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then(res => res)
    .catch(err => console.log(err));
}

module.exports = { postCompetitionInDiscord };
