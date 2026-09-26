import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { MyInfoService } from 'src/app/services/southeastcubing-api/my-info.service';
import { ToastService } from 'src/app/services/toast.service';
import { Colors } from 'src/app/shared/types';
import { formatDate } from 'src/app/shared/date.util';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { PictureCropSheetComponent } from '../../../shared/picture-crop-sheet/picture-crop-sheet.component';
import { cacheBustUrl } from 'src/app/shared/cache-bust-url.util';
import { MyInfo } from 'src/app/models/MyInfo';

// A DirtyCheckable sheet component, checked before actually dismissing it.
interface DirtyCheckable {
  isDirty(): boolean;
}

const CLOSE_ANIMATION_MS = 200;

// The "Who We Are" page's URL.
const WHO_WE_ARE_URL = buildDetailUrl('/about', 'Who We Are');

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
  ],
})
export class MyInfoComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private myInfoApi = inject(MyInfoService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;
  whoWeAreUrl = WHO_WE_ARE_URL;

  loading = signal(true);
  myInfo = signal<MyInfo | null>(null);

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

  formatDate = formatDate;

  ngOnInit(): void {
    this.themeService.setMainPaneColor(Colors.grey);
    this.loadMyInfo();
    this.handleStepUpRedirectParams();
  }

  private loadMyInfo() {
    this.loading.set(true);
    this.myInfoApi.getMyInfo().subscribe({
      next: (myInfo) => {
        this.myInfo.set(myInfo);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
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
      this.toastService.error('Date of birth request was declined.');
    } else {
      this.toastService.error('Something went wrong granting date of birth access.');
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
