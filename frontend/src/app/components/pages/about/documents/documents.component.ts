import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DocumentLink } from 'src/app/models/Document';

@Component({
    selector: 'se-documents',
    templateUrl: './documents.component.html',
    styleUrls: ['./documents.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DoucmentsComponent implements OnInit {
  @Input() documents: DocumentLink[];

  constructor() { }

  ngOnInit(): void {
  }

}
