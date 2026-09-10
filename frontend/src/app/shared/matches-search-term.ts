// Case-insensitive substring match of `searchTerm` against any of `fields`.
// An empty search term matches everything.
export function matchesSearchTerm(searchTerm: string, fields: (string | undefined)[]): boolean {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) {
    return true;
  }
  return fields.some((field) => field?.toLowerCase().includes(normalizedTerm));
}
