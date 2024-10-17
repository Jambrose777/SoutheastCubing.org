import { Component, Input, OnInit } from '@angular/core';
import { DocumentLink } from 'src/app/models/Document';

@Component({
  selector: 'se-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss']
})
export class DoucmentsComponent implements OnInit {
  @Input() documents: DocumentLink[];

  constructor() { }

  ngOnInit(): void {
  }

}
