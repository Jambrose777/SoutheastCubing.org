// Extracts the trimmed segment after the last comma in a Contentful-entered
// "City, ST" string - tolerant of trailing whitespace/punctuation after the state
// abbreviation, unlike a fixed last-2-characters slice.
export function stateAbbreviationFromCity(city: string): string {
  return city.substring(city.lastIndexOf(',') + 1).trim();
}
