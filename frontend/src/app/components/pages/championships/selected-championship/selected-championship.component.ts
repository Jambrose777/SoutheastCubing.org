import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Championship } from 'src/app/models/Championship';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'se-selected-championship',
  templateUrl: './selected-championship.component.html',
  styleUrls: ['./selected-championship.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MarkdownComponent],
})
export class SelectedChampionshipComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);

  isMobile: boolean;
  enviroment = environment;
  selectedChampionship = input<Championship>();
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(
      this.screenSizeService
        .getIsMobileSubject()
        .subscribe((isMobile) => (this.isMobile = isMobile)),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
