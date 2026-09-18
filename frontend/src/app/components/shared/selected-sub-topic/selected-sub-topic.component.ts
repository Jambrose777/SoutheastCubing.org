import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { SubTopic } from 'src/app/models/SubTopic';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { MarkdownComponent } from 'ngx-markdown';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { SafeUrlPipe } from 'src/app/pipes/safeUrl.pipe';

@Component({
  selector: 'se-selected-sub-topic',
  templateUrl: './selected-sub-topic.component.html',
  styleUrls: ['./selected-sub-topic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent, RouterLink, NgOptimizedImage, SafeUrlPipe],
})
export class SelectedSubTopicComponent {
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;
  selectedSubTopic = input<SubTopic>();

  // Single-item array for the @for that keys the photo <img>, memoized so its
  // reference only changes when the photo URL itself changes.
  photoAsArray = computed(() => {
    const photo = this.selectedSubTopic()?.photo;
    return photo ? [photo] : [];
  });
}
