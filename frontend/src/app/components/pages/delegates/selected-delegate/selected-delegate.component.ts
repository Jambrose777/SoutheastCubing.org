import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { Delegate, RANK_LABELS } from 'src/app/models/Delegate';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';
import { NgOptimizedImage } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'se-selected-delegate',
  templateUrl: './selected-delegate.component.html',
  styleUrls: ['./selected-delegate.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent, NgOptimizedImage, MatTooltipModule],
})
export class SelectedDelegateComponent {
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  environment = environment;
  selectedDelegate = input<Delegate>();

  // Single-item array for the @for that keys the photo <img>, memoized so its
  // reference only changes when the photo URL itself changes.
  photoAsArray = computed(() => {
    const photo = this.selectedDelegate()?.pictureUrl;
    return photo ? [photo] : [];
  });

  rankLabel = computed(() => {
    const rank = this.selectedDelegate()?.rank;
    return rank ? (RANK_LABELS[rank] ?? rank) : '';
  });
}
