// Builds the `/basePath[/urlKey]` path used when replacing the browser's
// history entry after selecting/deselecting an item.
export function buildDetailUrl(basePath: string, urlKey?: string): string {
  return basePath + (urlKey ? '/' + urlKey.replace(/ +/g, '-') : '');
}
