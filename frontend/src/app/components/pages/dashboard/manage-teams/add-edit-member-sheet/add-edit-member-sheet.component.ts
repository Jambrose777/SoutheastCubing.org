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
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel, MatError, MatHint } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import { NgOptimizedImage } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError, map, filter } from 'rxjs';
import { ManageTeamsApiService } from 'src/app/services/manage-teams-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { toDateInputValue, checkBadDateInput } from 'src/app/shared/date.util';
import {
  ManageTeam,
  PersonSearchResult,
  TeamMembership,
  TeamMemberColor,
  WcaPersonLookupResult,
} from 'src/app/models/ManageTeam';
import { WCA_ID_FORMAT } from 'src/app/shared/wcaId.util';

// A person selected either from our own search results or from the WCA-ID
// lookup fallback - not yet a `people` row in the latter case.
interface SelectedPerson {
  peopleId?: string;
  wcaId?: string;
  name: string;
  pictureUrl: string | null;
}

const COLOR_OPTIONS: { value: TeamMemberColor; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'blue', label: 'Blue' },
  { value: 'dark_grey', label: 'Dark Grey' },
  { value: 'green', label: 'Green' },
  { value: 'grey', label: 'Grey' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Slide-in "Add/Edit Member" sheet. Add mode's first step is a
// search-as-you-type combobox; once a person is picked, the
// second step shows their auto-calculated-but-editable dates, special role,
// and color. Nothing is persisted until Save is clicked.
@Component({
  selector: 'se-add-edit-member-sheet',
  templateUrl: './add-edit-member-sheet.component.html',
  styleUrls: ['./add-edit-member-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    NgOptimizedImage,
  ],
})
export class AddEditMemberSheetComponent implements OnInit {
  private manageTeamsApi = inject(ManageTeamsApiService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  // Preset (and not user-changeable) for the normal per-team-row "Add
  // member" flow. Left null for the top toolbar's own "Add Member" button,
  // which instead shows the team dropdown below (populated from `teams`)
  // so the user picks one - Admin is excluded, since it's never editable
  // through this dashboard at all.
  team = input<ManageTeam | null>(null);
  teams = input<ManageTeam[]>([]);
  addableTeams = computed(() => this.teams().filter((team) => team.kind !== 'admin'));

  pickedTeamId = signal<string | null>(null);
  selectedTeam = computed(
    () => this.team() ?? this.teams().find((team) => team.id === this.pickedTeamId()) ?? null,
  );

  // Every people_id already an active member of the selected team - add
  // mode only.
  activeMemberPeopleIds = computed(() => {
    if (this.membership()) return new Set<string>();
    const team = this.selectedTeam();
    if (!team) return new Set<string>();
    return new Set(
      team.members.filter((member) => !member.end_date).map((member) => member.people_id),
    );
  });

  // null = add mode.
  membership = input<TeamMembership | null>(null);
  closed = output<void>();
  saved = output<TeamMembership>();

  colorOptions = COLOR_OPTIONS;
  saving = false;
  searching = signal(false);
  searchResults = signal<PersonSearchResult[]>([]);
  wcaLookupResult = signal<WcaPersonLookupResult | null>(null);
  // True when the only local match(es) for the current search were
  // filtered out as already-active members of this team.
  onlyMatchIsAlreadyMember = signal(false);
  selectedPerson = signal<SelectedPerson | null>(null);

  searchControl = new FormControl('');
  checkBadDateInput = checkBadDateInput;

  detailsForm = new FormGroup({
    startDate: new FormControl(today(), Validators.required),
    endDate: new FormControl<string | null>(null),
    specialRole: new FormControl(''),
    color: new FormControl<TeamMemberColor | null>(null),
  });

  isBoardTeam = computed(() => this.selectedTeam()?.kind === 'board');

  constructor() {
    // Edit mode always starts with the person already known; add mode
    // starts at the search step.
    effect(() => {
      const membership = this.membership();
      if (membership) {
        this.selectedPerson.set({
          peopleId: membership.people_id,
          name: membership.name,
          pictureUrl: membership.picture_url,
        });
        this.detailsForm.reset({
          startDate: toDateInputValue(membership.start_date),
          endDate: toDateInputValue(membership.end_date),
          specialRole: membership.special_role ?? '',
          color: membership.color,
        });
      } else {
        this.selectedPerson.set(null);
        this.detailsForm.reset({
          startDate: today(),
          endDate: null,
          specialRole: '',
          color: null,
        });
      }
    });

    // Search is unusable until a team is selected (only relevant when
    // opened without a preset team).
    effect(() => {
      if (this.selectedTeam()) {
        this.searchControl.enable();
      } else {
        this.searchControl.disable();
      }
    });
  }

  ngOnInit(): void {
    // Sets up the search-as-you-type behavior for the person search input.
    this.searchControl.valueChanges
      .pipe(
        filter(() => !this.membership()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = (query ?? '').trim();
          if (trimmed.length < 2) {
            this.searchResults.set([]);
            this.wcaLookupResult.set(null);
            this.onlyMatchIsAlreadyMember.set(false);
            return of(null);
          }
          this.searching.set(true);
          // WCA's own lookup endpoint (and our WCA_ID_FORMAT, which gates it)
          // does expect WCA's own uppercase formatting.
          return this.manageTeamsApi.searchPeople(trimmed).pipe(
            switchMap((results) => {
              const upperCased = trimmed.toUpperCase();
              if (results.length === 0 && WCA_ID_FORMAT.test(upperCased)) {
                return this.manageTeamsApi.lookupWcaId(upperCased).pipe(
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
        // Excludes anyone already an active member of this team.
        const activeIds = this.activeMemberPeopleIds();
        const filteredResults = data.results.filter((result) => !activeIds.has(result.id));
        this.searchResults.set(filteredResults);
        this.wcaLookupResult.set(data.wcaResult);
        this.onlyMatchIsAlreadyMember.set(
          data.results.length > 0 && filteredResults.length === 0 && !data.wcaResult,
        );
      });
  }

  selectPerson(result: PersonSearchResult) {
    this.selectedPerson.set({
      peopleId: result.id,
      name: result.name,
      pictureUrl: result.picture_url,
    });
  }

  selectWcaResult(result: WcaPersonLookupResult) {
    this.selectedPerson.set({
      wcaId: result.wcaId,
      name: result.name,
      pictureUrl: result.pictureUrl,
    });
  }

  pickTeam(teamId: string) {
    this.pickedTeamId.set(teamId);
  }

  // Only available in add mode - lets the user back out of a selection and
  // search again.
  changePerson() {
    this.selectedPerson.set(null);
    this.searchControl.setValue('');
  }

  // Used by the parent to decide whether closing this sheet needs an "are
  // you sure" confirmation first.
  isDirty(): boolean {
    return !!this.selectedPerson() && this.detailsForm.dirty;
  }

  save() {
    const person = this.selectedPerson();
    const team = this.selectedTeam();
    if (!person || !team || this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.detailsForm.getRawValue();
    const specialRole = this.isBoardTeam() ? null : value.specialRole || null;

    const existingMembership = this.membership();
    const request = existingMembership
      ? this.manageTeamsApi.updateMembership(existingMembership.id, {
          startDate: value.startDate ?? today(),
          endDate: value.endDate || null,
          specialRole,
          color: value.color,
        })
      : this.manageTeamsApi.addMember(team.id, {
          peopleId: person.peopleId,
          wcaId: person.wcaId,
          specialRole,
          color: value.color,
          startDate: value.startDate ?? today(),
          endDate: value.endDate || null,
        });

    request.subscribe({
      next: (membership) => {
        this.saving = false;
        this.toastService.success(existingMembership ? 'Member updated.' : 'Member added.');
        this.saved.emit(membership);
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message ?? 'Failed to save member.');
      },
    });
  }

  close() {
    this.closed.emit();
  }
}
