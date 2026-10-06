import { Component, ChangeDetectionStrategy, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ManageUsersApiService } from 'src/app/services/southeastcubing-api/manage-users-api.service';
import { formatLongDate } from 'src/app/shared/date.util';
import { RANK_LABELS } from 'src/app/models/Delegate';
import { ManageUser } from 'src/app/models/ManageUser';
import { PictureCropSheetComponent } from '../../../../shared/picture-crop-sheet/picture-crop-sheet.component';
import { DelegateBioComponent } from '../../../../shared/delegate-bio/delegate-bio.component';

const CLOSE_ANIMATION_MS = 200;

interface DirtyCheckable {
  isDirty(): boolean;
}

// Manage Users' own edit sheet.
@Component({
  selector: 'se-edit-user-sheet',
  templateUrl: './edit-user-sheet.component.html',
  styleUrls: ['./edit-user-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTooltipModule, PictureCropSheetComponent, DelegateBioComponent],
})
export class EditUserSheetComponent {
  private manageUsersApi = inject(ManageUsersApiService);

  user = input.required<ManageUser>();
  closed = output<void>();
  // A mutation (bio save, or a Picture & Crop sheet save) resolved.
  saved = output<void>();

  formatLongDate = formatLongDate;
  rankLabel(rank: string): string {
    return RANK_LABELS[rank] ?? rank;
  }

  // Picture & Crop nested sheet.
  pictureSheetOpen = signal(false);
  isSheetClosing = signal(false);

  // Bound to this specific person's peopleId - passed to the shared,
  // now-generic Picture & Crop sheet in place of My Info's own self-service
  // calls.
  setSyncEnabled = (enabled: boolean) =>
    this.manageUsersApi.setSyncEnabled(this.user().peopleId, enabled);
  uploadPhoto = (file: File) => this.manageUsersApi.uploadPhoto(this.user().peopleId, file);
  updateCrop = (crop: { cropX: number; cropY: number; cropW: number; cropH: number }) =>
    this.manageUsersApi.updateCrop(this.user().peopleId, crop);

  // Bound the same way, for the shared Delegate Bio field.
  updateBio = (bio: string) => this.manageUsersApi.updateBio(this.user().peopleId, bio);

  close() {
    this.closed.emit();
  }

  openPictureSheet() {
    this.pictureSheetOpen.set(true);
  }

  private closeNestedSheet() {
    this.isSheetClosing.set(true);
    setTimeout(() => {
      this.pictureSheetOpen.set(false);
      this.isSheetClosing.set(false);
    }, CLOSE_ANIMATION_MS);
  }

  // Only requests a close when the backdrop itself (not a click bubbling up
  // from the sheet panel inside it) was the actual click target.
  closeNestedSheetIfBackdrop(event: MouseEvent, sheet: DirtyCheckable) {
    if (event.target === event.currentTarget) {
      this.requestCloseNestedSheet(sheet);
    }
  }

  requestCloseNestedSheet(sheet: DirtyCheckable) {
    if (sheet.isDirty() && !confirm('You have an unsaved crop change. Discard it?')) {
      return;
    }
    this.closeNestedSheet();
  }

  onPictureSheetSaved() {
    this.saved.emit();
  }
}
