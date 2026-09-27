import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { SoutheastcubingApiService } from './southeastcubing-api.service';

// Display labels for each preset key the backend can offer.
const PRESET_LABELS: Record<string, string> = {
  none: 'No special role',
  admin: 'Admin',
  board: 'Board Member',
  regionalDelegate: 'Regional Delegate',
};

// Dev-only role-impersonation runtime config check
@Injectable({
  providedIn: 'root',
})
export class DevImpersonationService {
  private api = inject(SoutheastcubingApiService);

  private enabledSignal = signal(false);
  enabled = this.enabledSignal.asReadonly();

  private presetsSignal = signal<string[]>([]);
  presets = this.presetsSignal.asReadonly();

  // Called once on app init - a failed fetch just leaves the safe disabled default in
  // place.
  checkEnabled() {
    this.api
      .getDevImpersonationConfig()
      .pipe(take(1))
      .subscribe({
        next: (config) => {
          this.enabledSignal.set(config.enabled);
          this.presetsSignal.set(config.presets);
        },
        error: (err) => {
          console.error('Failed to load dev role-impersonation config:', err);
        },
      });
  }

  labelFor(presetKey: string): string {
    return PRESET_LABELS[presetKey] ?? presetKey;
  }
}
