import { Injectable } from '@angular/core';
import { darkTheme } from 'src/themes/dark';
import { defaultTheme } from 'src/themes/default';
import { LocalStorageService } from './local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  constructor(private localStorageService: LocalStorageService) { }

  applyTheme(): void {
    let themeText = this.localStorageService.getTheme();
    if(!themeText) {
      this.localStorageService.setTheme('default');
    }
    let theme = themeText === 'dark' ? darkTheme.styles : defaultTheme.styles;

    Object.keys(theme).forEach(key => document.documentElement.style.setProperty(`--${key}`, theme[key]));
  }

  swapTheme(): void {
    let themeText = this.localStorageService.getTheme();
    if(themeText === 'default') {
      this.localStorageService.setTheme('dark');
    } else {
      this.localStorageService.setTheme('default');
    }

    this.applyTheme();
  }
}
