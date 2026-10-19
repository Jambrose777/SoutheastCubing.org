// Request only the Contentful image width needed by its largest intended display.
export function contentfulImageUrl(url: string, width: number): string {
  const resizedUrl = new URL(url, 'https://images.ctfassets.net');
  resizedUrl.searchParams.set('w', String(width));
  return resizedUrl.toString();
}
