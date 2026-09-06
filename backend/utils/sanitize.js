// Strips carriage-return/newline characters from a string so it can't be used to
// inject extra headers (e.g. BCC, forged From) into outgoing email or other
// header-like fields built from user-supplied input.
function stripNewlines(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/[\r\n]+/g, '');
}

module.exports = { stripNewlines };
