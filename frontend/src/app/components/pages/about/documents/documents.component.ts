import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { DocumentLink } from 'src/app/models/Document';

@Component({
  selector: 'se-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DoucmentsComponent {
  @Input() documents: DocumentLink[];

  constructor() {}
}
