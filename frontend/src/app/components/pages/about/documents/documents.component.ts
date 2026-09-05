import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { DocumentLink } from 'src/app/models/Document';

@Component({
  selector: 'se-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoucmentsComponent {
  documents = input<DocumentLink[]>();
}
