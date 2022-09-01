import { Component, OnInit } from '@angular/core';
import * as moment from 'moment';
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { WcaService } from 'src/app/services/wca.service';

@Component({
  selector: 'app-competitions',
  templateUrl: './competitions.component.html',
  styleUrls: ['./competitions.component.scss']
})
export class CompetitionsComponent implements OnInit {
  title: string = '';
  description: string = '';
  competitions: Competition[] = [];
  loadingContent: boolean = true;
  loadingCompetitions: boolean = true;

  constructor(private contentful: ContentfulService, private wca: WcaService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry('competitions').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.loadingContent = false;
    });

    this.wca.getUpcomingCompetitions().subscribe(res => {
      this.competitions = res;
      this.loadingCompetitions = false;
    });
  }

}
