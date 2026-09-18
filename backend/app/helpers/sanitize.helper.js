// Strips carriage-return/newline characters from a string so it can't be used to
// inject extra headers (e.g. BCC, forged From) into outgoing email or other
// header-like fields built from user-supplied input.
function stripNewlines(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/[\r\n]+/g, '');
}

// Neutralizes Discord mention syntax in untrusted text (e.g. a WCA competition
// name/city) so it can't trigger an unwanted @everyone/@here mass-ping or forge
// an arbitrary role/user mention when interpolated into a Discord message.
// - Newlines are stripped so the injected text can't break the message's
//   intended line structure.
// - @everyone/@here are broken up with a zero-width space, which stops Discord
//   from parsing them as mentions while leaving the text visually unchanged.
// - Raw mention snowflakes (<@123...>, <@!123...>, <@&123...>) are stripped
//   entirely, since there's no safe display-only rendering of those - only
//   the hardcoded, trusted parts of a message (e.g. the state role tag) should
//   ever produce a real mention.
function neutralizeMentions(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return stripNewlines(value)
    .replace(/@(everyone|here)/gi, '@\u200B$1')
    .replace(/<@[!&]?\d+>/g, '');
}

module.exports = { stripNewlines, neutralizeMentions };
