import { ImageLoaderConfig } from '@angular/common';

// Contentful serves images through its Images API, which supports on-the-fly
// resizing via query params (e.g. `?w=400&fm=webp`). This loader rewrites
// NgOptimizedImage's requested width into that query string so the browser
// only downloads an image sized for where it's actually rendered, instead of
// the full-resolution asset uploaded to the CMS.
//
// Non-Contentful sources (local assets like `assets/wca_logo.svg`) are passed
// through untouched.
export function contentfulImageLoader(config: ImageLoaderConfig): string {
  if (!config.src.includes('ctfassets.net')) {
    return config.src;
  }

  // Contentful's API returns protocol-relative asset URLs (`//images.ctfassets.net/...`).
  // Left as-is, the browser resolves them against the *page's* protocol - which
  // is `http:` in local dev (http://localhost) - producing a resolved origin of
  // `http://images.ctfassets.net` that doesn't match the `https://` preconnect
  // hint in index.html, so NgOptimizedImage's NG02956 check never finds a
  // match. Normalizing to an explicit `https:` scheme keeps the resolved
  // origin consistent (and correct) in both dev and production.
  const src = config.src.startsWith('//') ? `https:${config.src}` : config.src;

  const params = ['fm=webp'];
  // config.width isn't always provided
  if (config.width) {
    params.push(`w=${config.width}`);
  }
  return `${src}?${params.join('&')}`;
}
