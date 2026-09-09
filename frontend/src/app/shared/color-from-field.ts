import { Colors } from './types';

// Converts a Contentful "color" field - a free-text string that's meant to
// name one of the `Colors` enum members (e.g. "red") - into its typed
// `Colors` value. The field is optional/untyped at the CMS level, so callers
// only ever have a plain `string | undefined` to work with; this centralizes
// the safe lookup (falling back to `Colors.grey` for a missing/unrecognized
// value) instead of repeating an unsafe enum index at every call site.
export function colorFromField(color: string | undefined, fallback: Colors = Colors.grey): Colors {
  return color && color in Colors ? Colors[color as keyof typeof Colors] : fallback;
}
