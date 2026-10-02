import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MarkdownComponent } from 'ngx-markdown';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'src/app/services/toast.service';
import { ErrorBannerService } from 'src/app/services/error-banner.service';

// Delegate Bio - an inline edit-button/textarea/Save-Cancel field, saving
// itself immediately rather than being staged for a page/sheet-wide Save.
@Component({
  selector: 'se-delegate-bio',
  templateUrl: './delegate-bio.component.html',
  styleUrls: ['./delegate-bio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { id: 'delegate-bio-field' },
  imports: [FormsModule, MatTooltipModule, MarkdownComponent],
})
export class DelegateBioComponent {
  private toastService = inject(ToastService);
  private errorBannerService = inject(ErrorBannerService);

  bio = input.required<string | null>();
  // The actual save call - bound by the parent to whichever API/target
  // peopleId is appropriate.
  updateBio = input.required<(bio: string) => Observable<unknown>>();
  // My Info's own notification-badge convention (a blank bio is a pending item)
  pending = input<boolean>(false);
  saved = output<void>();

  editingBio = signal(false);
  bioDraft = signal('');
  savingBio = signal(false);

  private bioTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('bioTextarea');

  // Opens the textarea, seeded with the current bio
  startEditing() {
    this.bioDraft.set(this.bio() ?? '');
    this.editingBio.set(true);
  }

  focusTextarea() {
    this.bioTextarea()?.nativeElement.focus();
  }

  cancelEditing() {
    this.editingBio.set(false);
  }

  save() {
    this.savingBio.set(true);
    this.updateBio()(this.bioDraft()).subscribe({
      next: () => {
        this.savingBio.set(false);
        this.editingBio.set(false);
        this.toastService.success('Delegate bio updated.');
        this.saved.emit();
      },
      error: (err) => {
        this.savingBio.set(false);
        this.errorBannerService.show(err?.error?.message ?? 'Failed to update Delegate bio.');
      },
    });
  }
}
