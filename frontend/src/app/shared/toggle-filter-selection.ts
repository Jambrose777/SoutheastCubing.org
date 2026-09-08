// Toggles `value` in `current` (adds it if absent, removes it if present),
// used by the clubs/competitions state and event filter chips. Once every
// available option ends up selected, that's treated as equivalent to "no
// filter" and reset to an empty array instead of leaving a maxed-out,
// functionally no-op filter in place.
export function toggleFilterSelection<T>(current: T[], value: T, maxLength: number): T[] {
  const updated = current.includes(value)
    ? current.filter((filteredValue) => filteredValue !== value)
    : [...current, value];
  return updated.length === maxLength ? [] : updated;
}
