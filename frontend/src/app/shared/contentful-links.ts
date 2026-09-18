import type { Asset, Entry, EntrySkeletonType, UnresolvedLink } from 'contentful';
import type { SubTopicSkeleton } from 'src/app/models/ContentfulSkeletons';

// The `contentful` SDK types every Asset/Entry link as possibly unresolved
// (e.g. if the linked entity was deleted or unpublished after the referencing
// entry was saved) even though `resolveLinks` defaults to true and every
// asset/entry this app links to is expected to resolve in practice. These
// narrow that union down to the resolved shape so `.fields` access type-checks,
// falling back to `undefined` in the (unexpected) unresolved case instead of
// throwing.
export function resolvedAsset(
  link: Asset<undefined> | UnresolvedLink<'Asset'> | undefined,
): Asset<undefined> | undefined {
  return link && 'fields' in link ? link : undefined;
}

export function resolvedEntry<Skeleton extends EntrySkeletonType>(
  link: Entry<Skeleton, undefined> | UnresolvedLink<'Entry'> | undefined,
): Entry<Skeleton, undefined> | undefined {
  return link && 'fields' in link ? link : undefined;
}

// The Contentful SDK's resolved type for a `subTopic` entry link, as it appears both
// on a page's own `subTopics` field and (self-referentially) on a subtopic's own
// nested `subTopics` field - both link to the same `SubTopicSkeleton`, so this single
// alias covers the link type at either nesting level.
export type SubTopicEntryLink = NonNullable<
  Entry<SubTopicSkeleton, undefined>['fields']['subTopics']
>[number];
