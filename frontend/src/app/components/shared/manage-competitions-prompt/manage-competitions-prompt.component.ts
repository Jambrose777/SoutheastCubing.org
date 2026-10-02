import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';

// How long the slide-up exit animation takes to play, in ms.
const CLOSE_ANIMATION_MS = 200;

// Shared "grant manage_competitions" banner.
// Renders itself when the signed-in user hasn't granted the scope yet;
// dismissing only hides it for this visit.
@Component({
  selector: 'se-manage-competitions-prompt',
  templateUrl: './manage-competitions-prompt.component.html',
  styleUrls: ['./manage-competitions-prompt.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageCompetitionsPromptComponent {
  private authService = inject(AuthService);

  private dismissed = signal(false);
  // Kept true for the duration of the slide-up exit animation after
  // dismiss(), so the element isn't yanked out of the DOM mid-animation.
  closing = signal(false);

  show(): boolean {
    return (
      (!this.authService.currentUser()?.hasManageCompetitionsGrant && !this.dismissed()) ||
      this.closing()
    );
  }

  dismiss() {
    this.closing.set(true);
    setTimeout(() => {
      this.dismissed.set(true);
      this.closing.set(false);
    }, CLOSE_ANIMATION_MS);
  }

  grant() {
    this.authService.beginManageCompetitionsStepUp(`${location.pathname}${location.search}`);
  }
}
