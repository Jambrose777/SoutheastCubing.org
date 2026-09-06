// Contentful assets are frequently uploaded at a much higher resolution than
// they're ever displayed at on this site (e.g. an 800x800 upload for a photo
// that only ever renders in a ~300px-tall box). Binding NgOptimizedImage's
// `width`/`height` directly to those native dimensions - as done for the
// `photoWidth`/`photoHeight` etc. fields below - forces a full-resolution
// download on every "large detail photo" (delegate/cat/club/sub-topic),
// several hundred KB each, making switching between selected items
// noticeably slow. This scales the native dimensions down (preserving
// aspect ratio, never upscaling past the original) so `nativeHeight` never
// exceeds `maxDimension`.
//
// Height (not the longer edge) is what's capped: every one of these detail
// photo boxes is constrained by CSS `max-height` (300-400px) with a much more
// generous `max-width` (80% of a ~600px pane), so height is the real
// bottleneck.
export function scaleToDisplaySize(
  nativeWidth: number | undefined,
  nativeHeight: number | undefined,
  maxDimension = 400,
): { width: number | undefined; height: number | undefined } {
  if (!nativeWidth || !nativeHeight) {
    return { width: nativeWidth, height: nativeHeight };
  }

  const scale = Math.min(1, maxDimension / nativeHeight);
  return {
    width: Math.round(nativeWidth * scale),
    height: Math.round(nativeHeight * scale),
  };
}
