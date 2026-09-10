import { EntryFieldTypes } from 'contentful';

// `EntrySkeletonType<Fields>` definitions matching the actual shape of each
// Contentful content type this app queries, parameterized per call site in
// `ContentfulService.getContentfulGroup`/`getContentfulEntry`.

// --- Nested content types, linked from the entries below ---

export type SubTopicSkeleton = {
  contentTypeId: 'subTopic';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    photo?: EntryFieldTypes.AssetLink;
    buttonText?: EntryFieldTypes.Symbol;
    buttonIcon?: EntryFieldTypes.Symbol;
    buttonInternalLink?: EntryFieldTypes.Symbol;
    buttonExternalLink?: EntryFieldTypes.Symbol;
    color?: EntryFieldTypes.Symbol;
  };
};

export type ChampionSkeleton = {
  contentTypeId: 'champion';
  fields: {
    year: EntryFieldTypes.Integer;
    event: EntryFieldTypes.Symbol;
    seChampName?: EntryFieldTypes.Symbol;
    seChampResult?: EntryFieldTypes.Symbol;
    overallChampName?: EntryFieldTypes.Symbol;
    overallChampResult?: EntryFieldTypes.Symbol;
  };
};

export type TeamMemberSkeleton = {
  contentTypeId: 'teamMember';
  fields: {
    name: EntryFieldTypes.Symbol;
    color?: EntryFieldTypes.Symbol;
    title?: EntryFieldTypes.Symbol;
    thumbnail?: EntryFieldTypes.AssetLink;
  };
};

// --- List content types, queried via `getContentfulGroup` ---

export type DelegateSkeleton = {
  contentTypeId: 'delegates';
  fields: {
    name: EntryFieldTypes.Symbol;
    order: EntryFieldTypes.Integer;
    contact?: EntryFieldTypes.Symbol;
    delegateType?: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    photo?: EntryFieldTypes.AssetLink;
    thumbnail?: EntryFieldTypes.AssetLink;
    state?: EntryFieldTypes.Symbol;
    wcaid?: EntryFieldTypes.Symbol;
  };
};

export type DocumentSkeleton = {
  contentTypeId: 'documents';
  fields: {
    name: EntryFieldTypes.Symbol;
    order: EntryFieldTypes.Symbol;
    link: EntryFieldTypes.Symbol;
    color?: EntryFieldTypes.Symbol;
  };
};

export type ClubSkeleton = {
  contentTypeId: 'clubs';
  fields: {
    id: EntryFieldTypes.Symbol;
    name: EntryFieldTypes.Symbol;
    city: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    image?: EntryFieldTypes.AssetLink;
    venue?: EntryFieldTypes.Symbol;
    address?: EntryFieldTypes.Symbol;
    meetingInformation?: EntryFieldTypes.Text;
    contactName?: EntryFieldTypes.Symbol;
    contactInfo?: EntryFieldTypes.Symbol;
    contactEmail?: EntryFieldTypes.Symbol;
    website?: EntryFieldTypes.Symbol;
    latitude?: EntryFieldTypes.Number;
    longitude?: EntryFieldTypes.Number;
  };
};

export type ChampionshipSkeleton = {
  contentTypeId: 'championships';
  fields: {
    id: EntryFieldTypes.Symbol;
    name: EntryFieldTypes.Symbol;
    year: EntryFieldTypes.Integer;
    cityState: EntryFieldTypes.Text;
    city: EntryFieldTypes.Symbol;
    date: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    competitors?: EntryFieldTypes.Integer;
    logo?: EntryFieldTypes.AssetLink;
    images?: EntryFieldTypes.Array<EntryFieldTypes.AssetLink>;
    champions?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<ChampionSkeleton>>;
  };
};

export type TeamSkeleton = {
  contentTypeId: 'teams';
  fields: {
    name: EntryFieldTypes.Symbol;
    order: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    teamMembers: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<TeamMemberSkeleton>>;
  };
};

export type CatSkeleton = {
  contentTypeId: 'cats';
  fields: {
    name: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    photo?: EntryFieldTypes.AssetLink;
    thumbnail?: EntryFieldTypes.AssetLink;
    color?: EntryFieldTypes.Symbol;
  };
};

// --- Singleton "page" entries, queried via `getContentfulEntry` ---

export type HomePageSkeleton = {
  contentTypeId: 'home';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subTopics?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<SubTopicSkeleton>>;
    photos?: EntryFieldTypes.Array<EntryFieldTypes.AssetLink>;
  };
};

export type AboutPageSkeleton = {
  contentTypeId: 'about';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subTopics: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<SubTopicSkeleton>>;
  };
};

export type InvolvementPageSkeleton = {
  contentTypeId: 'involvement';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subTopics: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<SubTopicSkeleton>>;
  };
};

export type OrganizersPageSkeleton = {
  contentTypeId: 'organizers';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subTopics?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<SubTopicSkeleton>>;
    subText1?: EntryFieldTypes.Text;
    subText1ButtonText?: EntryFieldTypes.Symbol;
    subText1ButtonLink?: EntryFieldTypes.Symbol;
  };
};

export type ChampionshipsPageSkeleton = {
  contentTypeId: 'championshipsPage';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subText1?: EntryFieldTypes.Text;
  };
};

export type ClubsPageSkeleton = {
  contentTypeId: 'clubsPage';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subText1?: EntryFieldTypes.Text;
    subText1ButtonText?: EntryFieldTypes.Symbol;
    subText1ButtonLink?: EntryFieldTypes.Symbol;
    subText2?: EntryFieldTypes.Text;
    subText2ButtonText?: EntryFieldTypes.Symbol;
    subText2ButtonLink?: EntryFieldTypes.Symbol;
    subTopics?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<SubTopicSkeleton>>;
  };
};

export type CompetitionsPageSkeleton = {
  contentTypeId: 'competitionsPage';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subText1?: EntryFieldTypes.Text;
    subTopics?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<SubTopicSkeleton>>;
  };
};

export type DelegatesPageSkeleton = {
  contentTypeId: 'delegatesPage';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
    subText1?: EntryFieldTypes.Text;
    subText1ButtonText?: EntryFieldTypes.Symbol;
    subText1ButtonLink?: EntryFieldTypes.Symbol;
  };
};

export type ContactPageSkeleton = {
  contentTypeId: 'contact';
  fields: {
    description?: EntryFieldTypes.Text;
  };
};

export type PageNotFoundSkeleton = {
  contentTypeId: 'pageNotFound';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
  };
};

export type CatsPageSkeleton = {
  contentTypeId: 'catsPage';
  fields: {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
  };
};

export type LinksConfigurationSkeleton = {
  contentTypeId: 'linksConfiguration';
  fields: {
    discord?: EntryFieldTypes.Symbol;
    facebook?: EntryFieldTypes.Symbol;
    instagram?: EntryFieldTypes.Symbol;
    youtube?: EntryFieldTypes.Symbol;
    applyToStaffForm?: EntryFieldTypes.Symbol;
  };
};
