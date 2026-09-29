import {
  afterNextRender,
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MarkdownComponent } from 'ngx-markdown';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { MyInfoService } from 'src/app/services/southeastcubing-api/my-info.service';
import { ToastService } from 'src/app/services/toast.service';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { Colors } from 'src/app/shared/types';
import { formatDate } from 'src/app/shared/date.util';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { scrollIntoViewSafely } from 'src/app/shared/scroll-into-view-safely';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { PictureCropSheetComponent } from '../../../shared/picture-crop-sheet/picture-crop-sheet.component';
import { cacheBustUrl } from 'src/app/shared/cache-bust-url.util';
import { MyInfo, MyInfoCurrentEntry, MyInfoPastEntry } from 'src/app/models/MyInfo';
import { RANK_LABELS } from 'src/app/models/Delegate';

// A DirtyCheckable sheet component, checked before actually dismissing it.
interface DirtyCheckable {
  isDirty(): boolean;
}

const CLOSE_ANIMATION_MS = 200;

// The "Who We Are" page's URL.
const WHO_WE_ARE_URL = buildDetailUrl('/about', 'Who We Are');

// The signed-in Delegate's own public Delegate page URL - same
// /delegates/{name} slug pattern delegates.component.ts already uses.
function delegatePageUrl(name: string): string {
  return buildDetailUrl('/delegates', name);
}

// A stable track() key for a current/past roles-list entry.
function myInfoEntryTrackKey(entry: MyInfoCurrentEntry | MyInfoPastEntry): string {
  switch (entry.type) {
    case 'membership':
      return `membership-${entry.membershipId}`;
    case 'leadershipStint':
      return `leadershipStint-${entry.leaderId}`;
    case 'delegateRank':
      return `delegateRank-${entry.rankRowId}`;
    case 'delegateState':
      return `delegateState-${entry.stateRowId}`;
  }
}

// My Info tab - every stored profile field for the signed-in user, the dob
// step-up flow, and their current/past roles-memberships.
@Component({
  selector: 'se-my-info',
  templateUrl: './my-info.component.html',
  styleUrls: ['./my-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    DashboardSidePaneComponent,
    LoadingSpinnerComponent,
    RouterLink,
    MatTooltipModule,
    PictureCropSheetComponent,
    FormsModule,
    MarkdownComponent,
  ],
})
export class MyInfoComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private myInfoApi = inject(MyInfoService);
  private toastService = inject(ToastService);
  private errorBannerService = inject(ErrorBannerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;
  whoWeAreUrl = WHO_WE_ARE_URL;
  delegatePageUrl = computed(() => delegatePageUrl(this.myInfo()?.name ?? ''));

  loading = signal(true);
  myInfo = signal<MyInfo | null>(null);

  // Drives the "!" badge next to the "Delegate Bio" label itself.
  hasBioPendingItem = computed(() =>
    (this.authService.currentUser()?.pendingItems ?? []).some(
      (item) => item.fieldId === 'delegate-bio-field',
    ),
  );

  // Cache-busted so a managed photo replaced via the Picture & Crop sheet
  // actually reloads here too.
  pictureUrl = computed(() => {
    const url = this.myInfo()?.pictureUrl;
    return url ? cacheBustUrl(url) : null;
  });

  pictureSheetOpen = signal(false);
  // True for the duration of the slide-out exit animation, so the template
  // keeps the sheet mounted long enough for it to actually play.
  isSheetClosing = signal(false);

  // Delegate Bio inline edit - a plain textarea/save button.
  editingBio = signal(false);
  bioDraft = signal('');
  savingBio = signal(false);
  // Only present while editingBio() is true.
  bioTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('bioTextarea');

  formatDate = formatDate;
  rankLabel(rank: string): string {
    return RANK_LABELS[rank] ?? rank;
  }
  trackKey = myInfoEntryTrackKey;

  ngOnInit(): void {
    this.themeService.setMainPaneColor(Colors.grey);
    this.loadMyInfo();
    this.handleStepUpRedirectParams();

    // Ensures the flow for handleFocusFieldParam happens on side
    // pane click of My Info even if already on the My Info Tool.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.loading()) return;
      this.handleFocusFieldParam();
    });
  }

  private loadMyInfo() {
    this.loading.set(true);
    this.myInfoApi.getMyInfo().subscribe({
      next: (myInfo) => {
        this.myInfo.set(myInfo);
        this.loading.set(false);
        this.handleFocusFieldParam();
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // The generic notification-badge mechanism's click-through lands here
  // with ?focusField=<id> - scrolls to that field once the page's data is
  // ready, then strips the param so a refresh doesn't keep re-scrolling.
  // The blank-bio pending item's own field additionally opens the bio
  // editor, rather than just scrolling to a "not set" prompt.
  private handleFocusFieldParam() {
    const focusField = this.route.snapshot.queryParamMap.get('focusField');
    if (!focusField) return;

    const isBlankBioField = focusField === 'delegate-bio-field' && !this.myInfo()?.delegateBio;
    if (isBlankBioField) {
      this.startEditingBio();
    }
    this.scrollToFieldOnceImagesLoaded(
      focusField,
      isBlankBioField ? () => this.bioTextarea()?.nativeElement.focus() : undefined,
    );

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focusField: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // scrollIntoViewSafely's own afterNextRender only waits for Angular to
  // flush the DOM update - it doesn't account for the profile photo (an
  // <img> whose own height isn't known until its bytes actually finish
  // loading) still growing the page underneath the scroll target after
  // that. Waits for every still-loading <img> on the page to finish first,
  // so the computed scroll position reflects the page's final layout
  // rather than a still-shorter in-progress one.
  private scrollToFieldOnceImagesLoaded(fieldId: string, onScrolled?: () => void) {
    afterNextRender(
      () => {
        const pendingImages = Array.from(document.querySelectorAll('img')).filter(
          (img) => !img.complete,
        );
        const scrollThenFocus = () => {
          scrollIntoViewSafely(fieldId, this.injector);
          onScrolled?.();
        };

        if (!pendingImages.length) {
          scrollThenFocus();
          return;
        }

        Promise.all(
          pendingImages.map(
            (img) =>
              new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }),
          ),
        ).then(scrollThenFocus);
      },
      { injector: this.injector },
    );
  }

  // Re-fetches without toggling `loading` - used while the Picture & Crop
  // sheet is open, so the page behind it doesn't flash to the loading
  // spinner (which would also unmount the sheet's backdrop) on every save.
  private refreshMyInfo() {
    this.myInfoApi.getMyInfo().subscribe({
      next: (myInfo) => this.myInfo.set(myInfo),
    });
  }

  // The dob step-up callback lands back here with ?dobGranted=1 or
  // ?authError=denied|failed - surface a toast either way, then strip the
  // param so a page refresh doesn't re-show it.
  private handleStepUpRedirectParams() {
    const params = this.route.snapshot.queryParamMap;
    const dobGranted = params.get('dobGranted');
    const authError = params.get('authError');
    if (!dobGranted && !authError) return;

    if (dobGranted) {
      this.toastService.success('Date of birth added.');
    } else if (authError === 'denied') {
      this.errorBannerService.show('Date of birth request was declined.');
    } else {
      this.errorBannerService.show('Something went wrong granting date of birth access.');
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { dobGranted: null, authError: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // My Info's dob field click-to-grant action.
  beginDobStepUp() {
    this.authService.beginDobStepUp();
  }

  // Opens the bio textarea, seeded with the current bio.
  startEditingBio() {
    this.bioDraft.set(this.myInfo()?.delegateBio ?? '');
    this.editingBio.set(true);
  }

  cancelEditingBio() {
    this.editingBio.set(false);
  }

  saveBio() {
    this.savingBio.set(true);
    this.myInfoApi.updateBio(this.bioDraft()).subscribe({
      next: (myInfo) => {
        this.myInfo.set(myInfo);
        this.savingBio.set(false);
        this.editingBio.set(false);
        this.toastService.success('Delegate bio updated.');
        // Re-checks pendingItems.
        this.authService.refreshCurrentUser();
      },
      error: () => {
        this.savingBio.set(false);
        this.errorBannerService.show('Failed to update Delegate bio.');
      },
    });
  }

  openPictureSheet() {
    this.pictureSheetOpen.set(true);
  }

  private closeSheet() {
    this.isSheetClosing.set(true);
    setTimeout(() => {
      this.pictureSheetOpen.set(false);
      this.isSheetClosing.set(false);
    }, CLOSE_ANIMATION_MS);
  }

  // Only requests a close when the backdrop itself (not a click bubbling up
  // from the sheet panel inside it) was the actual click target.
  closeSheetIfBackdrop(event: MouseEvent, sheet: DirtyCheckable) {
    if (event.target === event.currentTarget) {
      this.requestCloseSheet(sheet);
    }
  }

  // Any way of dismissing the sheet (backdrop click, Escape, or its own
  // back button) routes through here.
  requestCloseSheet(sheet: DirtyCheckable) {
    if (sheet.isDirty() && !confirm('You have an unsaved crop change. Discard it?')) {
      return;
    }
    this.closeSheet();
  }

  // A mutation inside the sheet (sync toggle, upload, or crop save)
  // resolved - refetch so the sheet (and the rest of the page) reflects the
  // new server state, without closing the sheet itself.
  onPictureSheetSaved() {
    this.refreshMyInfo();
    this.authService.refreshCurrentUser();
  }
}
