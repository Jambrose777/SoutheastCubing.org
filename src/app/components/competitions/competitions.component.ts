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

  constructor(private contentful: ContentfulService, private wca: WcaService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry('competitions').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
    });

    this.wca.getUpcomingCompetitions().subscribe(res => {
      console.log(res.map(r => r.name));
      this.competitions = res.filter(comp =>
        comp.city.includes(', Georgia') || 
        comp.city.includes(', Tennessee') || 
        comp.city.includes(', North Carolina') || 
        comp.city.includes(', South Carolina') || 
        comp.city.includes(', Kentucky') || 
        comp.city.includes(', Alabama') || 
        comp.city.includes(', Florida')
      ).sort((a, b) => moment(a.start_date).isBefore(b.start_date) ? -1 : 1)
      .map(competition => ({
        ...competition,
        full_date: this.getFullCompetitionDate(competition.start_date, competition.end_date)
      }));
      this.competitions.forEach(comeptition => this.setRegistrationStatus(comeptition))
      console.log(this.competitions);
    });
  }

  getFullCompetitionDate(start: string, end: string) {
    if (start === end) return moment(start).format("MMM D, YYYY");
    let mstart = moment(start);
    let mend = moment(end);

    if (mstart.year === mend.year) {
      if (mstart.month === mend.month) {
        return mstart.format("MMM D") + " - " + mend.format("D, YYYY");
      } else {
        return mstart.format("MMM D") + " - " + mend.format("MMM D, YYYY");
      }
    } else {
      return mstart.format("MMM D, YYYY") + " - " + mend.format("MMM D, YYYY");
    }

  }

  setRegistrationStatus(competition: Competition) {
    if (moment.utc(competition.registration_close).isBefore(moment.now())) {
      competition.registration_status = 'Registration has closed.'
    } else if (moment.utc(competition.registration_open).isAfter(moment.now())) {
      competition.registration_status = 'Registration will open at ' + moment.utc(competition.registration_open).local().format("MMM D, YYYY [at] h:mm A") + '.';
    } else {
      competition.registration_status = 'Registration is currently open.';
    }
  }

}
