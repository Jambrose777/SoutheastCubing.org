import { CubingIcons } from '@cubing/icons/js';
import { EventNames } from 'src/app/shared/types';

export const BANANA_ICON_ID = 'custom-2x2x3-banana';
export const OTHER_ICON_ID = 'fa-cube';

const CUSTOM_ICON_ASSETS: Record<string, string> = {
  [BANANA_ICON_ID]: 'assets/2x2x3-banana.svg',
};

const CUSTOM_ICON_OPTIONS: UnofficialIconOption[] = [
  { icon: BANANA_ICON_ID, name: '2x2x3 Banana' },
];

const OTHER_ICON_OPTION: UnofficialIconOption = { icon: OTHER_ICON_ID, name: 'Other' };

export interface UnofficialIconOption {
  icon: string;
  name: string;
}

export interface UnofficialEventDraft {
  id: number;
  eventName: string;
  icon: string;
}

const UNOFFICIAL_EVENT_ABBREVIATIONS: Record<string, string> = {
  bf: 'Blindfolded',
  bld: 'Blind',
  fm: 'Fewest Moves',
  oh: 'One-Handed',
  ft: 'With Feet',
  mts: 'Match The Scramble',
  mbo: 'Multi-Blind (old style)',
};

const UNOFFICIAL_EVENT_NAME_ALIASES = new Map<string, string>([
  ['mpyram', 'Master Pyraminx'],
  ['mskewb', 'Master Skewb'],
  ['mtetram', 'Master Tetraminx'],
  ['magic', 'Magic'],
  ['mmagic', 'Master Magic'],
]);

// Converts upstream and custom icon identifiers into editable display names.
export function getUnofficialIconName(icon: string): string {
  const customOption = CUSTOM_ICON_OPTIONS.find((option) => option.icon === icon);
  if (customOption) return customOption.name;
  if (icon === OTHER_ICON_ID) return OTHER_ICON_OPTION.name;

  const normalizedIcon = icon.replace(/^(?:unofficial-|event-)/, '').replace(/_/g, ' ');
  if (icon.startsWith('event-') && EventNames[normalizedIcon]) {
    return EventNames[normalizedIcon];
  }
  const alias = UNOFFICIAL_EVENT_NAME_ALIASES.get(normalizedIcon);
  if (alias) return alias;

  const relayMatch = normalizedIcon.match(/(\d+)relay\b/i);
  if (relayMatch) {
    const digits = relayMatch[1];
    const lastDigit = Number(digits[digits.length - 1]);
    const sequence = Array.from({ length: lastDigit - 1 }, (_, index) => `${index + 2}`).join('');
    if (digits === sequence) {
      return normalizedIcon.replace(relayMatch[0], `${digits[0]}-${lastDigit} Relay`);
    }
  }

  return normalizedIcon
    .replace(/([2-7])\1\1/g, '$1x$1x$1')
    .replace(/(\d+)(fto|mts|mbo|bld|bf|fm|oh|ft)\b/gi, '$1 $2')
    .replace(
      /\b(fto|mts|mbo|bld|bf|fm|oh|ft)\b/gi,
      (abbreviation) =>
        UNOFFICIAL_EVENT_ABBREVIATIONS[abbreviation.toLowerCase()] ?? abbreviation.toUpperCase(),
    )
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

// Builds the sorted event catalog and keeps the general-purpose option last.
export function getUnofficialIconOptions(): UnofficialIconOption[] {
  const eventOptions: UnofficialIconOption[] = Object.values(CubingIcons)
    .filter((icon) => icon.startsWith('event-') || icon.startsWith('unofficial-'))
    .map((icon) => ({ icon, name: getUnofficialIconName(icon) }));
  return [...eventOptions, ...CUSTOM_ICON_OPTIONS]
    .sort((left, right) => left.name.localeCompare(right.name))
    .concat(OTHER_ICON_OPTION);
}

// Resolves custom event IDs to the SVG asset configured for that icon.
export function getCustomUnofficialIconAsset(icon: string): string | null {
  return CUSTOM_ICON_ASSETS[icon] ?? null;
}

// Sorts drafts without changing their stable identities.
export function sortUnofficialEventDrafts(
  events: readonly UnofficialEventDraft[],
): UnofficialEventDraft[] {
  return [...events].sort((left, right) => left.eventName.localeCompare(right.eventName));
}
