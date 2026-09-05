import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'se-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LoadingSpinnerComponent {
  constructor() {}
}
