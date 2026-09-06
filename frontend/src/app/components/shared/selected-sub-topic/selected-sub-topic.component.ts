import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SubTopic } from 'src/app/models/SubTopic';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { MarkdownComponent } from 'ngx-markdown';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'se-selected-sub-topic',
  templateUrl: './selected-sub-topic.component.html',
  styleUrls: ['./selected-sub-topic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent, RouterLink, NgOptimizedImage],
})
export class SelectedSubTopicComponent {
  private screenSizeService = inject(ScreenSizeService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });
  selectedSubTopic = input<SubTopic>();

  // Single-item array for the @for that keys the photo <img>, memoized so its
  // reference only changes when the photo URL itself changes.
  photoAsArray = computed(() => {
    const photo = this.selectedSubTopic()?.photo;
    return photo ? [photo] : [];
  });
}
