import { Injectable } from '@angular/core';
import { Colors } from '../shared/types';

@Injectable({
  providedIn: 'root'
})

// theme service is to interact with scss variables to universally control how the UI looks
export class ThemeService {

  constructor() { }

  // Sets the left pane color variable in the scss
  setMainPaneColor(color: Colors) {
    document.documentElement.style.setProperty(`--main-pane-color`, color);
  }
}
