// Appends a cache-busting query param to `url`. A managed photo always
// lives at the same fixed URL (e.g. /photos/<peopleId>.jpg) even after an
// upload/resync/crop replaces its actual bytes, so binding a template
// straight to that URL string never re-triggers a fetch - the browser just
// keeps serving its cached copy. Call this from a computed/getter that
// re-runs whenever the underlying data is re-fetched, so the appended value
// actually changes and the browser is forced to load the fresh image.
export function cacheBustUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}
