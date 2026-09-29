// One local `people`/`users` match from the search-as-you-type combobox.
export interface PersonSearchResult {
  id: string;
  name: string;
  picture_url: string | null;
  thumbnail_crop_x: number | null;
  thumbnail_crop_y: number | null;
  thumbnail_crop_w: number | null;
  thumbnail_crop_h: number | null;
  wca_id: string | null;
  wca_user_id: string | null;
  email: string | null;
  has_account: boolean;
}

// An "add by WCA ID" fallback result, proxied from WCA directly - not yet a
// `people` row until actually selected/added.
export interface WcaPersonLookupResult {
  wcaId: string;
  name: string;
  pictureUrl: string | null;
}

// A person selected either from local search results or the WCA-ID lookup
// fallback - not yet a `people` row (and so no crop data) in the latter case.
export interface SelectedPerson {
  peopleId?: string;
  wcaId?: string;
  name: string;
  pictureUrl: string | null;
  thumbnailCropX?: number | null;
  thumbnailCropY?: number | null;
  thumbnailCropW?: number | null;
  thumbnailCropH?: number | null;
}
