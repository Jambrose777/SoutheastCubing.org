import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

// Small, transient confirmation for a mutation that succeeded and doesn't
// need the user's sustained attention - as opposed to ErrorBannerService,
// which is for a failure serious enough to warrant a bigger, harder-to-miss
// banner.
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private snackBar = inject(MatSnackBar);

  success(message: string) {
    // The action button doubles as a manual-dismiss "X" - clicking it
    // dismisses the snack bar immediately, on top of the auto-dismiss timer.
    this.snackBar.open(message, '✕', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: 'se-toast-success',
    });
  }
}
