import { Injectable } from '@angular/core';
import { Colors } from '../shared/types';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  constructor() { }

  setRightPaneColor(color: Colors) {
    document.documentElement.style.setProperty(`--right-pane-color`, color);
  }
}
