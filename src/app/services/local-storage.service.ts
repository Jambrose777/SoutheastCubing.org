import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { Competition } from '../models/Competition';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  constructor() { }

  getTheme(): string {
    return localStorage.getItem('theme');
  }
  
  setTheme(theme: string) {
    localStorage.setItem('theme', theme);
  }

  getCompetitions(): Competition[] {
    return JSON.parse(localStorage.getItem('competitions'));
  }

  setCompetitions(competitions: Competition[]) {
    localStorage.setItem('competitions', JSON.stringify(competitions));
    localStorage.setItem('competitionsTTL', moment().format('YYYY-MM-DD'));
  }

  getCompetitionsTTL(): string {
    return localStorage.getItem('competitionsTTL');
  }
}
