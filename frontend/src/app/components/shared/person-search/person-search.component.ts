import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  effect,
  signal,
  computed,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError, map } from 'rxjs';
import { PeopleApiService } from 'src/app/services/southeastcubing-api/people-api.service';
import { WCA_ID_FORMAT } from 'src/app/shared/wcaId.util';
import { PersonSearchResult, SelectedPerson, WcaPersonLookupResult } from 'src/app/models/Person';
import { AvatarComponent } from '../avatar/avatar.component';

// Search-as-you-type combobox for "add an existing person, or add by WCA
// ID" flows. Emits `selected` once a result (local or WCA fallback) is picked.
@Component({
  selector: 'se-person-search',
  templateUrl: './person-search.component.html',
  styleUrls: ['./person-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormField, MatLabel, MatInput, AvatarComponent],
})
export class PersonSearchComponent implements OnInit {
  private peopleApi = inject(PeopleApiService);
  private destroyRef = inject(DestroyRef);

  // Local search results already excluded by the host (e.g. teams'
  // already-active members) are filtered out before this component ever
  // sees them.
  excludeResult = input<(result: PersonSearchResult) => boolean>(() => false);

  // Shown when `excludeResult` filtered out every local match.
  excludedMessage = input('This person was already excluded from these results.');

  // Disables the search input entirely.
  disabled = input(false);

  selected = output<SelectedPerson>();

  searchControl = new FormControl('');
  searching = signal(false);
  searchResults = signal<PersonSearchResult[]>([]);
  wcaLookupResult = signal<WcaPersonLookupResult | null>(null);
  // True when the only local match(es) for the current search were
  // filtered out by `excludeResult`.
  onlyMatchExcluded = signal(false);
  // True once a real search (query >= 2 chars) has actually completed.
  hasSearched = signal(false);

  // True once a completed search comes back completely empty (no local
  // matches at all, and no WCA-ID fallback either) - `onlyMatchExcluded`
  // covers the "found some, but all excluded" case separately, so this
  // only fires when there was truly nothing to show.
  noResultsFound = computed(
    () =>
      this.hasSearched() &&
      !this.searching() &&
      this.searchResults().length === 0 &&
      !this.wcaLookupResult() &&
      !this.onlyMatchExcluded(),
  );

  constructor() {
    effect(() => {
      if (this.disabled()) {
        this.searchControl.disable();
      } else {
        this.searchControl.enable();
      }
    });
  }

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = (query ?? '').trim();
          if (trimmed.length < 2) {
            this.searchResults.set([]);
            this.wcaLookupResult.set(null);
            this.onlyMatchExcluded.set(false);
            this.hasSearched.set(false);
            return of(null);
          }
          this.searching.set(true);
          // WCA's own lookup endpoint (and our WCA_ID_FORMAT, which gates
          // it) expects WCA's own uppercase formatting.
          return this.peopleApi.searchPeople(trimmed).pipe(
            switchMap((results) => {
              const upperCased = trimmed.toUpperCase();
              if (results.length === 0 && WCA_ID_FORMAT.test(upperCased)) {
                return this.peopleApi.lookupWcaId(upperCased).pipe(
                  map((wcaResult) => ({ results, wcaResult })),
                  catchError(() => of({ results, wcaResult: null })),
                );
              }
              return of({ results, wcaResult: null });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.searching.set(false);
        if (!data) return;
        const exclude = this.excludeResult();
        const filteredResults = data.results.filter((result) => !exclude(result));
        this.searchResults.set(filteredResults);
        this.wcaLookupResult.set(data.wcaResult);
        this.onlyMatchExcluded.set(
          data.results.length > 0 && filteredResults.length === 0 && !data.wcaResult,
        );
        this.hasSearched.set(true);
      });
  }

  selectResult(result: PersonSearchResult) {
    this.selected.emit({
      peopleId: result.id,
      name: result.name,
      pictureUrl: result.picture_url,
      thumbnailCropX: result.thumbnail_crop_x,
      thumbnailCropY: result.thumbnail_crop_y,
      thumbnailCropW: result.thumbnail_crop_w,
      thumbnailCropH: result.thumbnail_crop_h,
    });
  }

  // A fresh WCA-ID lookup result never carries crop data - it isn't a
  // `people` row yet.
  selectWcaResult(result: WcaPersonLookupResult) {
    this.selected.emit({
      wcaId: result.wcaId,
      name: result.name,
      pictureUrl: result.pictureUrl,
    });
  }

  // Lets the host reset this combobox after a "Change" action.
  clear() {
    this.searchControl.setValue('');
    this.searchResults.set([]);
    this.wcaLookupResult.set(null);
    this.onlyMatchExcluded.set(false);
    this.hasSearched.set(false);
  }
}
